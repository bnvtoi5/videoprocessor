import { StabilizationParams, TrackedFeaturePoint } from '../../types/algorithm';

/**
 * Converts RGBA buffer to 8-bit single-channel luminance grayscale.
 */
export function rgbaToGrayscale(
  rgba: Uint8ClampedArray,
  width: number,
  height: number
): Uint8Array {
  const n = width * height;
  const gray = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const idx = i << 2;
    // ITU-R BT.601 luminance
    gray[i] = (77 * rgba[idx] + 150 * rgba[idx + 1] + 29 * rgba[idx + 2]) >> 8;
  }
  return gray;
}

/**
 * Pure TypeScript Shi-Tomasi Good Features to Track + Lucas-Kanade Optical Flow
 * used when OpenCV WASM runtime is not passed (e.g., Node.js unit tests) or as verified fallback.
 */
export function trackFeaturesTypeScript(
  prevGray: Uint8Array,
  currGray: Uint8Array,
  width: number,
  height: number,
  params: StabilizationParams
): TrackedFeaturePoint[] {
  const border = 8;
  const Ix = new Float32Array(width * height);
  const Iy = new Float32Array(width * height);
  const cornerScore = new Float32Array(width * height);

  // Compute spatial gradients
  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) {
      const idx = row + x;
      Ix[idx] = (prevGray[idx + 1] - prevGray[idx - 1]) * 0.5;
      Iy[idx] = (prevGray[idx + width] - prevGray[idx - width]) * 0.5;
    }
  }

  let maxScore = 0;
  // 3x3 structure tensor minimum eigenvalue (Shi-Tomasi criterion)
  for (let y = border; y < height - border; y += 2) {
    for (let x = border; x < width - border; x += 2) {
      let sxx = 0;
      let syy = 0;
      let sxy = 0;
      for (let wy = -1; wy <= 1; wy++) {
        const r = (y + wy) * width + x;
        for (let wx = -1; wx <= 1; wx++) {
          const gIdx = r + wx;
          const gx = Ix[gIdx];
          const gy = Iy[gIdx];
          sxx += gx * gx;
          syy += gy * gy;
          sxy += gx * gy;
        }
      }
      const trace = sxx + syy;
      const det = sxx * syy - sxy * sxy;
      const disc = Math.sqrt(Math.max(0, trace * trace * 0.25 - det));
      const lambdaMin = trace * 0.5 - disc;
      const idx = y * width + x;
      cornerScore[idx] = lambdaMin;
      if (lambdaMin > maxScore) maxScore = lambdaMin;
    }
  }

  if (maxScore <= 1e-3) {
    return [];
  }

  const threshold = maxScore * Math.max(0.005, Math.min(0.5, params.qualityLevel));
  const candidates: { x: number; y: number; score: number }[] = [];

  for (let y = border; y < height - border; y += 2) {
    for (let x = border; x < width - border; x += 2) {
      const s = cornerScore[y * width + x];
      if (s >= threshold) {
        candidates.push({ x, y, score: s });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  const selected: { x: number; y: number }[] = [];
  const minDistSq = params.minDistance * params.minDistance;

  for (const c of candidates) {
    if (selected.length >= params.maxCorners) break;
    let tooClose = false;
    for (const s of selected) {
      const dx = c.x - s.x;
      const dy = c.y - s.y;
      if (dx * dx + dy * dy < minDistSq) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) {
      selected.push({ x: c.x, y: c.y });
    }
  }

  // Iterative Lucas-Kanade optical flow over 7x7 window
  const halfWin = 3;
  const tracked: TrackedFeaturePoint[] = [];

  const sampleBilinear = (img: Uint8Array, fx: number, fy: number): number => {
    const x0 = Math.max(0, Math.min(width - 2, Math.floor(fx)));
    const y0 = Math.max(0, Math.min(height - 2, Math.floor(fy)));
    const ax = fx - x0;
    const ay = fy - y0;
    const idx = y0 * width + x0;
    const i00 = img[idx];
    const i10 = img[idx + 1];
    const i01 = img[idx + width];
    const i11 = img[idx + width + 1];
    return (
      (1 - ax) * (1 - ay) * i00 +
      ax * (1 - ay) * i10 +
      (1 - ax) * ay * i01 +
      ax * ay * i11
    );
  };

  for (const pt of selected) {
    let u = 0;
    let v = 0;
    let valid = true;

    let gxx = 0;
    let gyy = 0;
    let gxy = 0;

    for (let wy = -halfWin; wy <= halfWin; wy++) {
      for (let wx = -halfWin; wx <= halfWin; wx++) {
        const idx = (pt.y + wy) * width + (pt.x + wx);
        const gx = Ix[idx];
        const gy = Iy[idx];
        gxx += gx * gx;
        gyy += gy * gy;
        gxy += gx * gy;
      }
    }

    const det = gxx * gyy - gxy * gxy;
    if (det < 1e-2) continue;
    const invDet = 1.0 / det;

    for (let iter = 0; iter < 8; iter++) {
      let bx = 0;
      let by = 0;
      for (let wy = -halfWin; wy <= halfWin; wy++) {
        for (let wx = -halfWin; wx <= halfWin; wx++) {
          const px = pt.x + wx;
          const py = pt.y + wy;
          const qx = px + u;
          const qy = py + v;
          if (qx < 1 || qx >= width - 2 || qy < 1 || qy >= height - 2) {
            valid = false;
            break;
          }
          const idx = py * width + px;
          const it = sampleBilinear(currGray, qx, qy) - prevGray[idx];
          bx -= Ix[idx] * it;
          by -= Iy[idx] * it;
        }
        if (!valid) break;
      }
      if (!valid) break;

      const du = (gyy * bx - gxy * by) * invDet;
      const dv = (-gxy * bx + gxx * by) * invDet;
      u += du;
      v += dv;

      if (Math.hypot(du, dv) < 0.02) break;
    }

    const finalX = pt.x + u;
    const finalY = pt.y + v;
    if (
      valid &&
      finalX >= 2 &&
      finalX < width - 2 &&
      finalY >= 2 &&
      finalY < height - 2 &&
      Math.hypot(u, v) < Math.max(width, height) * 0.25
    ) {
      tracked.push({
        prevX: pt.x,
        prevY: pt.y,
        currX: finalX,
        currY: finalY,
        isInlier: true,
      });
    }
  }

  return tracked;
}

/**
 * Detects Shi-Tomasi corners with cv.goodFeaturesToTrack and tracks them with
 * cv.calcOpticalFlowPyrLK when OpenCV.js WASM is available, with guaranteed cv.Mat cleanup.
 */
export function detectAndTrackOpticalFlow(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cv: any,
  prevGray: Uint8Array,
  currGray: Uint8Array,
  width: number,
  height: number,
  params: StabilizationParams
): { points: TrackedFeaturePoint[]; engine: string } {
  const canUseOpenCv =
    cv &&
    typeof cv.Mat === 'function' &&
    typeof cv.goodFeaturesToTrack === 'function' &&
    typeof cv.calcOpticalFlowPyrLK === 'function';

  if (!canUseOpenCv) {
    return {
      points: trackFeaturesTypeScript(prevGray, currGray, width, height, params),
      engine: 'TypeScript Shi-Tomasi + Pyramidal LK',
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prevMat: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let currMat: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let p0: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let p1: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let st: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let err: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mask: any = null;

  try {
    prevMat = cv.matFromArray(height, width, cv.CV_8UC1, prevGray);
    currMat = cv.matFromArray(height, width, cv.CV_8UC1, currGray);
    p0 = new cv.Mat();
    mask = new cv.Mat();

    cv.goodFeaturesToTrack(
      prevMat,
      p0,
      Math.max(10, Math.round(params.maxCorners)),
      Math.max(0.001, Math.min(0.5, params.qualityLevel)),
      Math.max(1, params.minDistance),
      mask,
      3,
      false,
      0.04
    );

    if (p0.rows === 0) {
      return {
        points: [],
        engine: 'OpenCV.js WASM (goodFeaturesToTrack + calcOpticalFlowPyrLK)',
      };
    }

    p1 = new cv.Mat();
    st = new cv.Mat();
    err = new cv.Mat();

    const winSize = new cv.Size(15, 15);
    const maxLevel = 2;
    const criteria = new cv.TermCriteria(
      cv.TERM_CRITERIA_EPS | cv.TERM_CRITERIA_COUNT,
      20,
      0.03
    );

    cv.calcOpticalFlowPyrLK(
      prevMat,
      currMat,
      p0,
      p1,
      st,
      err,
      winSize,
      maxLevel,
      criteria
    );

    const points: TrackedFeaturePoint[] = [];
    const numPts = p0.rows;

    for (let i = 0; i < numPts; i++) {
      const status = st.data[i];
      if (status === 1) {
        const prevX = p0.data32F[i * 2];
        const prevY = p0.data32F[i * 2 + 1];
        const currX = p1.data32F[i * 2];
        const currY = p1.data32F[i * 2 + 1];

        if (
          currX >= 0 &&
          currX < width &&
          currY >= 0 &&
          currY < height &&
          Math.hypot(currX - prevX, currY - prevY) < Math.max(width, height) * 0.3
        ) {
          points.push({
            prevX,
            prevY,
            currX,
            currY,
            isInlier: true,
          });
        }
      }
    }

    return {
      points,
      engine: 'OpenCV.js WASM (goodFeaturesToTrack + calcOpticalFlowPyrLK)',
    };
  } catch {
    return {
      points: trackFeaturesTypeScript(prevGray, currGray, width, height, params),
      engine: 'TypeScript Shi-Tomasi + Pyramidal LK (Fallback)',
    };
  } finally {
    if (prevMat) prevMat.delete();
    if (currMat) currMat.delete();
    if (p0) p0.delete();
    if (p1) p1.delete();
    if (st) st.delete();
    if (err) err.delete();
    if (mask) mask.delete();
  }
}
