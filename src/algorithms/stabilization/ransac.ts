import { TrackedFeaturePoint } from '../../types/algorithm';

export interface SimilarityTransform2D {
  dx: number;
  dy: number;
  da: number; // rotation angle in radians
  scale: number;
  inliers: boolean[];
  inliersCount: number;
  inlierRatio: number;
}

/**
 * Estimates a 2D similarity transform (translation dx, dy, rotation da, uniform scale s)
 * from two point correspondences (p1 -> q1) and (p2 -> q2):
 *   qx = s * (cos(da) * px - sin(da) * py) + dx
 *   qy = s * (sin(da) * px + cos(da) * py) + dy
 */
export function fitSimilarityFromTwoPairs(
  p1x: number,
  p1y: number,
  q1x: number,
  q1y: number,
  p2x: number,
  p2y: number,
  q2x: number,
  q2y: number
): { dx: number; dy: number; da: number; scale: number } | null {
  const dpx = p2x - p1x;
  const dpy = p2y - p1y;
  const dqx = q2x - q1x;
  const dqy = q2y - q1y;

  const normP2 = dpx * dpx + dpy * dpy;
  if (normP2 < 1e-6) {
    return null;
  }

  // a = s * cos(da), b = s * sin(da)
  const a = (dpx * dqx + dpy * dqy) / normP2;
  const b = (dpx * dqy - dpy * dqx) / normP2;

  // Check scale consistency to reject mismatched feature pairs, then enforce unit scale for 2D Euclidean camera motion
  const rawScale = Math.hypot(a, b);
  if (rawScale < 0.8 || rawScale > 1.25 || !Number.isFinite(rawScale)) {
    return null;
  }

  const scale = 1.0;
  const da = Math.atan2(b, a);
  const cosA = Math.cos(da);
  const sinA = Math.sin(da);

  const dx = q1x - (cosA * p1x - sinA * p1y);
  const dy = q1y - (sinA * p1x + cosA * p1y);

  return { dx, dy, da, scale };
}

/**
 * Refines a 2D Euclidean/Similarity transform over all inlier correspondences via closed-form
 * orthogonal Procrustes solver (Kabsch/Umeyama with unit scale for rigid 2D camera motion).
 */
export function refineSimilarityLeastSquares(
  points: TrackedFeaturePoint[],
  inlierMask: boolean[]
): { dx: number; dy: number; da: number; scale: number } {
  let sumPx = 0;
  let sumPy = 0;
  let sumQx = 0;
  let sumQy = 0;
  let count = 0;

  for (let i = 0; i < points.length; i++) {
    if (!inlierMask[i]) continue;
    sumPx += points[i].prevX;
    sumPy += points[i].prevY;
    sumQx += points[i].currX;
    sumQy += points[i].currY;
    count++;
  }

  if (count === 0) {
    return { dx: 0, dy: 0, da: 0, scale: 1 };
  }

  const meanPx = sumPx / count;
  const meanPy = sumPy / count;
  const meanQx = sumQx / count;
  const meanQy = sumQy / count;

  if (count === 1) {
    return {
      dx: meanQx - meanPx,
      dy: meanQy - meanPy,
      da: 0,
      scale: 1,
    };
  }

  let sxxPlusSyy = 0;
  let sxyMinusSyx = 0;
  let normP = 0;

  for (let i = 0; i < points.length; i++) {
    if (!inlierMask[i]) continue;
    const px = points[i].prevX - meanPx;
    const py = points[i].prevY - meanPy;
    const qx = points[i].currX - meanQx;
    const qy = points[i].currY - meanQy;

    sxxPlusSyy += px * qx + py * qy;
    sxyMinusSyx += px * qy - py * qx;
    normP += px * px + py * py;
  }

  if (normP < 1e-6) {
    return {
      dx: meanQx - meanPx,
      dy: meanQy - meanPy,
      da: 0,
      scale: 1,
    };
  }

  const da = Math.atan2(sxyMinusSyx, sxxPlusSyy);
  const scale = 1.0;

  const cosA = Math.cos(da);
  const sinA = Math.sin(da);

  const dx = meanQx - (cosA * meanPx - sinA * meanPy);
  const dy = meanQy - (sinA * meanPx + cosA * meanPy);

  return { dx, dy, da, scale };
}

/**
 * Deterministic pseudo-random generator for reproducible scientific experiments.
 */
function createDeterministicRng(seed = 1337): () => number {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Estimates 2D Similarity Transform using RANSAC and least-squares Procrustes refinement.
 */
export function estimateSimilarityTransformRansac(
  points: TrackedFeaturePoint[],
  ransacThresholdPx = 3.0,
  maxIterations = 120,
  seed = 42
): SimilarityTransform2D {
  const n = points.length;
  if (n === 0) {
    return {
      dx: 0,
      dy: 0,
      da: 0,
      scale: 1,
      inliers: [],
      inliersCount: 0,
      inlierRatio: 0,
    };
  }

  if (n === 1) {
    return {
      dx: points[0].currX - points[0].prevX,
      dy: points[0].currY - points[0].prevY,
      da: 0,
      scale: 1,
      inliers: [true],
      inliersCount: 1,
      inlierRatio: 1,
    };
  }

  const rng = createDeterministicRng(seed + n);
  const threshSq = ransacThresholdPx * ransacThresholdPx;

  let bestInlierCount = -1;
  let bestInliers: boolean[] = new Array(n).fill(false);

  for (let iter = 0; iter < maxIterations; iter++) {
    const i1 = Math.floor(rng() * n);
    let i2 = Math.floor(rng() * (n - 1));
    if (i2 >= i1) i2++;

    const p1 = points[i1];
    const p2 = points[i2];

    const model = fitSimilarityFromTwoPairs(
      p1.prevX,
      p1.prevY,
      p1.currX,
      p1.currY,
      p2.prevX,
      p2.prevY,
      p2.currX,
      p2.currY
    );

    if (!model) continue;

    const cosA = Math.cos(model.da) * model.scale;
    const sinA = Math.sin(model.da) * model.scale;

    let inlierCount = 0;
    const currentInliers = new Array<boolean>(n);

    for (let k = 0; k < n; k++) {
      const pt = points[k];
      const predX = cosA * pt.prevX - sinA * pt.prevY + model.dx;
      const predY = sinA * pt.prevX + cosA * pt.prevY + model.dy;
      const errSq =
        (predX - pt.currX) * (predX - pt.currX) +
        (predY - pt.currY) * (predY - pt.currY);

      if (errSq <= threshSq) {
        currentInliers[k] = true;
        inlierCount++;
      } else {
        currentInliers[k] = false;
      }
    }

    if (inlierCount > bestInlierCount) {
      bestInlierCount = inlierCount;
      bestInliers = currentInliers;
      if (inlierCount === n) break;
    }
  }

  if (bestInlierCount <= 0) {
    // Fallback to median translation if no 2-point similarity model found
    bestInliers = new Array(n).fill(true);
    bestInlierCount = n;
  }

  const refined = refineSimilarityLeastSquares(points, bestInliers);

  // Re-evaluate final inliers under refined model
  const cosR = Math.cos(refined.da) * refined.scale;
  const sinR = Math.sin(refined.da) * refined.scale;
  let finalInlierCount = 0;
  const finalInliers = new Array<boolean>(n);

  for (let k = 0; k < n; k++) {
    const pt = points[k];
    const predX = cosR * pt.prevX - sinR * pt.prevY + refined.dx;
    const predY = sinR * pt.prevX + cosR * pt.prevY + refined.dy;
    const errSq =
      (predX - pt.currX) * (predX - pt.currX) +
      (predY - pt.currY) * (predY - pt.currY);
    if (errSq <= threshSq * 1.25) {
      finalInliers[k] = true;
      finalInlierCount++;
    } else {
      finalInliers[k] = false;
    }
  }

  if (finalInlierCount === 0) {
    finalInlierCount = bestInlierCount;
    for (let k = 0; k < n; k++) finalInliers[k] = bestInliers[k];
  }

  return {
    dx: refined.dx,
    dy: refined.dy,
    da: refined.da,
    scale: refined.scale,
    inliers: finalInliers,
    inliersCount: finalInlierCount,
    inlierRatio: n > 0 ? finalInlierCount / n : 0,
  };
}
