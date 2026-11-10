import JSZip from 'jszip';
import { GroundTruthMask } from '../types/video';

export interface MovingTargetSpec {
  id?: number;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  vx?: number;
  vy?: number;
  shape: 'ellipse' | 'rect';
}

/**
 * Generates an exact CDnet-2014 compatible ground-truth mask:
 * - 0: Background
 * - 50: Cast Shadow
 * - 85: Outside ROI (optional border margin)
 * - 170: Unknown / Motion Boundary (1px transition rim if enabled)
 * - 255: Foreground
 *
 * Also generates:
 * - backgroundMask (255 where true background, 0 elsewhere)
 * - validityMask (255 where pixel is inside valid ROI & known, 0 where 85/170 or warped border)
 */
export function generateSyntheticGroundTruthMask(
  frameIndex: number,
  width: number,
  height: number,
  targets: MovingTargetSpec[],
  camDx = 0,
  camDy = 0,
  camDa = 0,
  options?: {
    includeCastShadows?: boolean;
    includeOutsideRoiBorder?: boolean;
    includeUnknownBoundary?: boolean;
  }
): GroundTruthMask {
  const nPixels = width * height;
  const mask = new Uint8Array(nPixels);
  const backgroundMask = new Uint8Array(nPixels);
  const validityMask = new Uint8Array(nPixels);

  const includeShadows = options?.includeCastShadows ?? true;
  const includeRoiBorder = options?.includeOutsideRoiBorder ?? false;
  const includeBoundary = options?.includeUnknownBoundary ?? false;

  const centerX = width * 0.5;
  const centerY = height * 0.5;
  const cosA = Math.cos(-camDa);
  const sinA = Math.sin(-camDa);

  const roiMarginX = includeRoiBorder ? Math.max(6, Math.round(width * 0.04)) : 0;
  const roiMarginY = includeRoiBorder ? Math.max(4, Math.round(height * 0.04)) : 0;

  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const idx = row + x;

      // Check Outside ROI border (CDnet label 85)
      if (
        includeRoiBorder &&
        (x < roiMarginX ||
          x >= width - roiMarginX ||
          y < roiMarginY ||
          y >= height - roiMarginY)
      ) {
        mask[idx] = 85;
        backgroundMask[idx] = 0;
        validityMask[idx] = 0;
        continue;
      }

      // Map camera-observed pixel back to world coordinates
      const dx = x - centerX - camDx;
      const dy = y - centerY - camDy;
      const wx = cosA * dx - sinA * dy + centerX;
      const wy = sinA * dx + cosA * dy + centerY;

      // If camera shift moved outside world frame, mark validityMask = 0 (Outside ROI 85)
      if (wx < 0 || wx >= width || wy < 0 || wy >= height) {
        mask[idx] = 85;
        backgroundMask[idx] = 0;
        validityMask[idx] = 0;
        continue;
      }

      let isForeground = false;
      let isUnknownBoundary = false;
      let isShadow = false;

      for (const t of targets) {
        if (t.shape === 'ellipse') {
          const nx = (wx - t.cx) / Math.max(1, t.rx);
          const ny = (wy - t.cy) / Math.max(1, t.ry);
          const distSq = nx * nx + ny * ny;
          if (distSq <= 1.0) {
            isForeground = true;
            break;
          } else if (includeBoundary && distSq <= 1.14) {
            isUnknownBoundary = true;
          }
        } else {
          const ax = Math.abs(wx - t.cx);
          const ay = Math.abs(wy - t.cy);
          if (ax <= t.rx && ay <= t.ry) {
            isForeground = true;
            break;
          } else if (includeBoundary && ax <= t.rx + 1.2 && ay <= t.ry + 1.2) {
            isUnknownBoundary = true;
          }
        }

        // Check cast shadow offset (+7px, +7px) -> CDnet label 50
        if (includeShadows && !isForeground) {
          const sx = (wx - (t.cx + 7)) / (Math.max(1, t.rx) * 1.05);
          const sy = (wy - (t.cy + 7)) / (Math.max(1, t.ry) * 1.05);
          if (sx * sx + sy * sy <= 1.0) {
            isShadow = true;
          }
        }
      }

      if (isForeground) {
        mask[idx] = 255;
        backgroundMask[idx] = 0;
        validityMask[idx] = 255;
      } else if (isUnknownBoundary) {
        mask[idx] = 170; // CDnet Unknown
        backgroundMask[idx] = 0;
        validityMask[idx] = 0;
      } else if (isShadow) {
        mask[idx] = 50; // CDnet Shadow
        backgroundMask[idx] = 255;
        validityMask[idx] = 255;
      } else {
        mask[idx] = 0; // CDnet Background
        backgroundMask[idx] = 255;
        validityMask[idx] = 255;
      }
    }
  }

  return {
    frameIndex,
    width,
    height,
    mask,
    backgroundMask,
    validityMask,
    hasCdnetLabels: true,
    objectPositions: targets.map((t, idx) => ({
      id: t.id ?? idx + 1,
      cx: t.cx,
      cy: t.cy,
      vx: t.vx ?? 0,
      vy: t.vy ?? 0,
    })),
  };
}

/**
 * Warps a GroundTruthMask by a corrective transformation (corrDx, corrDy, corrDa)
 * using STRICT NEAREST-NEIGHBOR INTERPOLATION (never linear interpolation, preserving exact
 * CDnet discrete labels 0, 50, 85, 170, 255) and marks out-of-frame borders in validityMask = 0.
 */
export function warpGroundTruthMaskNearestNeighbor(
  gt: GroundTruthMask,
  corrDx: number,
  corrDy: number,
  corrDa: number,
  cropRatio = 0
): GroundTruthMask {
  const { width, height, mask, validityMask } = gt;
  const nPixels = width * height;
  const outMask = new Uint8Array(nPixels);
  const outBg = new Uint8Array(nPixels);
  const outValid = new Uint8Array(nPixels);

  const cx = width * 0.5;
  const cy = height * 0.5;
  const zoom = 1.0 / Math.max(0.8, 1.0 - Math.max(0, Math.min(0.2, cropRatio)));
  const invScale = 1 / zoom;
  const cosA = Math.cos(-corrDa) * invScale;
  const sinA = Math.sin(-corrDa) * invScale;

  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const idx = row + x;
      // Inverse map destination pixel (x, y) back to source pixel (srcX, srcY)
      const dx = x - cx - corrDx;
      const dy = y - cy - corrDy;
      const srcX = Math.round(cosA * dx - sinA * dy + cx);
      const srcY = Math.round(sinA * dx + cosA * dy + cy);

      if (srcX < 0 || srcX >= width || srcY < 0 || srcY >= height) {
        outMask[idx] = 85; // Outside ROI / Invalid border
        outBg[idx] = 0;
        outValid[idx] = 0;
      } else {
        const srcIdx = srcY * width + srcX;
        const lbl = mask[srcIdx];
        outMask[idx] = lbl;
        outBg[idx] = lbl === 0 || lbl === 50 ? 255 : 0;
        const origValid = validityMask ? validityMask[srcIdx] : 255;
        const nearWarpedBorder =
          srcX < 2 || srcX >= width - 2 || srcY < 2 || srcY >= height - 2;
        outValid[idx] =
          !nearWarpedBorder && origValid > 0 && lbl !== 85 && lbl !== 170
            ? 255
            : 0;
      }
    }
  }

  return {
    ...gt,
    mask: outMask,
    backgroundMask: outBg,
    validityMask: outValid,
  };
}

/**
 * Warps a predicted binary foreground mask (0/255) by a corrective transformation
 * using nearest-neighbor interpolation (used for Experiment Group C3:
 * Background Subtraction on Original -> Motion-compensated Mask Alignment).
 */
export function warpBinaryMaskNearestNeighbor(
  binaryMask: Uint8Array,
  width: number,
  height: number,
  corrDx: number,
  corrDy: number,
  corrDa: number,
  cropRatio = 0
): Uint8Array {
  const out = new Uint8Array(width * height);
  const cx = width * 0.5;
  const cy = height * 0.5;
  const zoom = 1.0 / Math.max(0.8, 1.0 - Math.max(0, Math.min(0.2, cropRatio)));
  const invScale = 1 / zoom;
  const cosA = Math.cos(-corrDa) * invScale;
  const sinA = Math.sin(-corrDa) * invScale;

  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const dx = x - cx - corrDx;
      const dy = y - cy - corrDy;
      const srcX = Math.round(cosA * dx - sinA * dy + cx);
      const srcY = Math.round(sinA * dx + cosA * dy + cy);
      if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
        out[row + x] = binaryMask[srcY * width + srcX];
      }
    }
  }
  return out;
}

/**
 * Maps any grayscale pixel value to the closest canonical CDnet-2014 label:
 * 0 (Background), 50 (Shadow), 85 (Outside ROI), 170 (Unknown), 255 (Foreground).
 */
export function quantizeToCdnetLabel(luminance: number): number {
  if (luminance < 25) return 0;
  if (luminance < 68) return 50;
  if (luminance < 125) return 85;
  if (luminance < 212) return 170;
  return 255;
}

/**
 * Parses a user-uploaded ZIP archive containing Ground Truth PNG/BMP masks,
 * matching files by frame index and validating dimensions against the video session.
 * Preserves CDnet-2014 discrete labels (0, 50, 85, 170, 255) without linear interpolation.
 */
export async function loadGroundTruthMasksFromZip(
  zipFile: File,
  expectedWidth: number,
  expectedHeight: number,
  maxFrames: number
): Promise<{
  masks: Map<number, GroundTruthMask>;
  matchedCount: number;
  skippedDimensionMismatch: number;
  detectedLabels: number[];
  summaryMessage: string;
}> {
  const zip = await JSZip.loadAsync(zipFile);
  const masks = new Map<number, GroundTruthMask>();
  let skippedDimensionMismatch = 0;
  const labelSet = new Set<number>();

  const pngEntries: { frameIndex: number; entry: JSZip.JSZipObject }[] = [];

  zip.forEach((relativePath, fileEntry) => {
    if (fileEntry.dir) return;
    const lower = relativePath.toLowerCase();
    if (!lower.endsWith('.png') && !lower.endsWith('.pgm') && !lower.endsWith('.bmp')) {
      return;
    }
    const baseName = relativePath.split('/').pop() || relativePath;
    const numMatches = baseName.match(/(\d+)/g);
    if (numMatches && numMatches.length > 0) {
      const idx = parseInt(numMatches[numMatches.length - 1], 10);
      if (!Number.isNaN(idx) && idx >= 0 && idx < maxFrames * 2) {
        pngEntries.push({ frameIndex: idx, entry: fileEntry });
      }
    }
  });

  pngEntries.sort((a, b) => a.frameIndex - b.frameIndex);

  const hasZero = pngEntries.some((e) => e.frameIndex === 0);
  const offset =
    !hasZero && pngEntries.length > 0 && pngEntries[0].frameIndex === 1 ? -1 : 0;

  const canvas = document.createElement('canvas');
  canvas.width = expectedWidth;
  canvas.height = expectedHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) {
    throw new Error('Could not initialize 2D canvas context for Ground Truth decoding.');
  }
  ctx.imageSmoothingEnabled = false;

  for (const item of pngEntries) {
    const normalizedIdx = item.frameIndex + offset;
    if (normalizedIdx < 0 || normalizedIdx >= maxFrames) continue;

    const blob = await item.entry.async('blob');
    const bitmap = await createImageBitmap(blob);

    if (bitmap.width !== expectedWidth || bitmap.height !== expectedHeight) {
      skippedDimensionMismatch++;
      bitmap.close();
      continue;
    }

    ctx.clearRect(0, 0, expectedWidth, expectedHeight);
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    const imgData = ctx.getImageData(0, 0, expectedWidth, expectedHeight).data;
    const nPixels = expectedWidth * expectedHeight;
    const maskArr = new Uint8Array(nPixels);
    const validArr = new Uint8Array(nPixels);
    const bgArr = new Uint8Array(nPixels);

    for (let i = 0; i < nPixels; i++) {
      const r = imgData[i * 4];
      const g = imgData[i * 4 + 1];
      const b = imgData[i * 4 + 2];
      const lum = Math.round((r + g + b) / 3);
      const cdnetLbl = quantizeToCdnetLabel(lum);
      maskArr[i] = cdnetLbl;
      bgArr[i] = cdnetLbl === 0 || cdnetLbl === 50 ? 255 : 0;
      validArr[i] = cdnetLbl === 85 || cdnetLbl === 170 ? 0 : 255;
      labelSet.add(cdnetLbl);
    }

    masks.set(normalizedIdx, {
      frameIndex: normalizedIdx,
      width: expectedWidth,
      height: expectedHeight,
      mask: maskArr,
      backgroundMask: bgArr,
      validityMask: validArr,
      hasCdnetLabels: true,
    });
  }

  const detectedLabels = Array.from(labelSet).sort((a, b) => a - b);

  return {
    masks,
    matchedCount: masks.size,
    skippedDimensionMismatch,
    detectedLabels,
    summaryMessage:
      masks.size > 0
        ? `Đã nạp ${masks.size} ảnh Ground Truth Mask chuẩn CDnet (Nhãn phát hiện: [${detectedLabels.join(', ')}]; Bỏ qua ${skippedDimensionMismatch} ảnh lệch kích thước).`
        : `Cảnh báo: Không tìm thấy ảnh mask khớp độ phân giải xử lý ${expectedWidth}×${expectedHeight} (${skippedDimensionMismatch} file bị lệch độ phân giải).`,
  };
}

/**
 * Decodes a user-uploaded Ground-Truth Mask Video (.mp4 / .webm) at the same sampling timestamps
 * as the input video session using nearest-neighbor canvas sampling (imageSmoothingEnabled = false)
 * and maps intensities to CDnet-2014 labels (0, 50, 85, 170, 255).
 */
export async function loadGroundTruthMasksFromVideoFile(
  maskVideoFile: File,
  expectedWidth: number,
  expectedHeight: number,
  frameTimestamps: number[]
): Promise<{
  masks: Map<number, GroundTruthMask>;
  matchedCount: number;
  detectedLabels: number[];
  warningMessage: string | null;
  summaryMessage: string;
}> {
  const objectUrl = URL.createObjectURL(maskVideoFile);
  const video = document.createElement('video');
  video.src = objectUrl;
  video.muted = true;
  video.playsInline = true;

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () =>
        reject(new Error('Không thể giải mã file video Ground Truth Mask.'));
    });

    let warningMessage: string | null = null;
    if (
      video.videoWidth !== expectedWidth ||
      video.videoHeight !== expectedHeight
    ) {
      warningMessage = `Lưu ý: Độ phân giải gốc của video mask (${video.videoWidth}×${video.videoHeight}) khác độ phân giải xử lý (${expectedWidth}×${expectedHeight}). Đã lấy mẫu bằng Nearest-Neighbor (không nội suy tuyến tính) để bảo toàn nhãn rời rạc CDnet.`;
    }

    const canvas = document.createElement('canvas');
    canvas.width = expectedWidth;
    canvas.height = expectedHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      throw new Error('Could not initialize 2D canvas context.');
    }
    ctx.imageSmoothingEnabled = false;

    const masks = new Map<number, GroundTruthMask>();
    const labelSet = new Set<number>();
    const nPixels = expectedWidth * expectedHeight;

    for (let i = 0; i < frameTimestamps.length; i++) {
      const ts = Math.min(Math.max(0, frameTimestamps[i]), Math.max(0, video.duration - 0.01));
      video.currentTime = ts;
      await new Promise<void>((resolve) => {
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked);
          resolve();
        };
        video.addEventListener('seeked', onSeeked);
      });

      ctx.clearRect(0, 0, expectedWidth, expectedHeight);
      ctx.drawImage(video, 0, 0, expectedWidth, expectedHeight);
      const imgData = ctx.getImageData(0, 0, expectedWidth, expectedHeight).data;

      const maskArr = new Uint8Array(nPixels);
      const validArr = new Uint8Array(nPixels);
      const bgArr = new Uint8Array(nPixels);

      for (let p = 0; p < nPixels; p++) {
        const lum = Math.round(
          (imgData[p * 4] + imgData[p * 4 + 1] + imgData[p * 4 + 2]) / 3
        );
        const cdnetLbl = quantizeToCdnetLabel(lum);
        maskArr[p] = cdnetLbl;
        bgArr[p] = cdnetLbl === 0 || cdnetLbl === 50 ? 255 : 0;
        validArr[p] = cdnetLbl === 85 || cdnetLbl === 170 ? 0 : 255;
        labelSet.add(cdnetLbl);
      }

      masks.set(i, {
        frameIndex: i,
        width: expectedWidth,
        height: expectedHeight,
        mask: maskArr,
        backgroundMask: bgArr,
        validityMask: validArr,
        hasCdnetLabels: true,
      });
    }

    const detectedLabels = Array.from(labelSet).sort((a, b) => a - b);
    return {
      masks,
      matchedCount: masks.size,
      detectedLabels,
      warningMessage,
      summaryMessage: `Đã nạp ${masks.size} khung hình Ground Truth Mask từ video "${maskVideoFile.name}" (Nhãn CDnet: [${detectedLabels.join(', ')}]).`,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
