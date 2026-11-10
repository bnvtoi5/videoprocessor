import { MorphologyConfig, MovingComponentBox } from '../../types/algorithm';

/**
 * Converts a raw mask (which may contain 127 shadow values from MOG2)
 * into a strict binary mask (0 or 255), excluding shadow pixels (127 -> 0).
 */
export function toStrictBinaryMask(rawMask: Uint8Array): Uint8Array {
  const n = rawMask.length;
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = rawMask[i] >= 200 ? 255 : 0;
  }
  return out;
}

/**
 * Separable 2D box/Gaussian blur approximation on 8-bit grayscale/mask buffer.
 */
export function gaussianBlurMask(
  src: Uint8Array,
  width: number,
  height: number,
  kernelSize: number
): Uint8Array {
  const r = Math.max(1, Math.min(4, (kernelSize - 1) >> 1));
  const temp = new Float32Array(width * height);
  const dst = new Uint8Array(width * height);

  const weights: number[] = [];
  let wSum = 0;
  const sigma = Math.max(0.8, r * 0.65);
  for (let k = -r; k <= r; k++) {
    const w = Math.exp(-(k * k) / (2 * sigma * sigma));
    weights.push(w);
    wSum += w;
  }
  for (let i = 0; i < weights.length; i++) weights[i] /= wSum;

  // Horizontal pass
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) {
        const xx = Math.max(0, Math.min(width - 1, x + k));
        sum += src[row + xx] * weights[k + r];
      }
      temp[row + x] = sum;
    }
  }

  // Vertical pass
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) {
        const yy = Math.max(0, Math.min(height - 1, y + k));
        sum += temp[yy * width + x] * weights[k + r];
      }
      dst[row + x] = Math.round(sum);
    }
  }

  return dst;
}

export function thresholdMask(src: Uint8Array, thresholdValue: number): Uint8Array {
  const n = src.length;
  const dst = new Uint8Array(n);
  const t = Math.max(1, Math.min(254, thresholdValue));
  for (let i = 0; i < n; i++) {
    dst[i] = src[i] >= t ? 255 : 0;
  }
  return dst;
}

export function erodeBinaryMask(
  src: Uint8Array,
  width: number,
  height: number,
  kernelSize = 3
): Uint8Array {
  const r = Math.max(1, Math.min(4, (kernelSize - 1) >> 1));
  const dst = new Uint8Array(width * height);

  for (let y = r; y < height - r; y++) {
    const row = y * width;
    for (let x = r; x < width - r; x++) {
      let allFg = true;
      for (let ky = -r; ky <= r; ky++) {
        const kRow = (y + ky) * width + x;
        for (let kx = -r; kx <= r; kx++) {
          if (src[kRow + kx] === 0) {
            allFg = false;
            break;
          }
        }
        if (!allFg) break;
      }
      dst[row + x] = allFg ? 255 : 0;
    }
  }
  return dst;
}

export function dilateBinaryMask(
  src: Uint8Array,
  width: number,
  height: number,
  kernelSize = 3
): Uint8Array {
  const r = Math.max(1, Math.min(4, (kernelSize - 1) >> 1));
  const dst = new Uint8Array(width * height);

  for (let y = r; y < height - r; y++) {
    const row = y * width;
    for (let x = r; x < width - r; x++) {
      let anyFg = false;
      for (let ky = -r; ky <= r; ky++) {
        const kRow = (y + ky) * width + x;
        for (let kx = -r; kx <= r; kx++) {
          if (src[kRow + kx] > 0) {
            anyFg = true;
            break;
          }
        }
        if (anyFg) break;
      }
      dst[row + x] = anyFg ? 255 : 0;
    }
  }
  return dst;
}

export function morphologicalOpening(
  src: Uint8Array,
  width: number,
  height: number,
  kernelSize = 3
): Uint8Array {
  const eroded = erodeBinaryMask(src, width, height, kernelSize);
  return dilateBinaryMask(eroded, width, height, kernelSize);
}

export function morphologicalClosing(
  src: Uint8Array,
  width: number,
  height: number,
  kernelSize = 3
): Uint8Array {
  const dilated = dilateBinaryMask(src, width, height, kernelSize);
  return erodeBinaryMask(dilated, width, height, kernelSize);
}

/**
 * Connected-component labeling (8-connectivity BFS) that removes small noise blobs
 * below minComponentArea and returns bounding boxes for valid moving components.
 */
export function filterConnectedComponentsAndExtractBoxes(
  binaryMask: Uint8Array,
  width: number,
  height: number,
  minComponentArea: number
): { cleanedMask: Uint8Array; boxes: MovingComponentBox[] } {
  const n = width * height;
  const visited = new Uint8Array(n);
  const cleanedMask = new Uint8Array(n);
  const boxes: MovingComponentBox[] = [];
  const queue = new Int32Array(n);

  let componentId = 1;
  const minArea = Math.max(1, minComponentArea);

  for (let i = 0; i < n; i++) {
    if (binaryMask[i] === 0 || visited[i] !== 0) continue;

    let head = 0;
    let tail = 0;
    queue[tail++] = i;
    visited[i] = 1;

    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;
    let sumX = 0;
    let sumY = 0;

    while (head < tail) {
      const curr = queue[head++];
      const cy = Math.floor(curr / width);
      const cx = curr - cy * width;

      if (cx < minX) minX = cx;
      if (cx > maxX) maxX = cx;
      if (cy < minY) minY = cy;
      if (cy > maxY) maxY = cy;
      sumX += cx;
      sumY += cy;

      // 8-neighbors
      for (let dy = -1; dy <= 1; dy++) {
        const ny = cy + dy;
        if (ny < 0 || ny >= height) continue;
        const nRow = ny * width;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = cx + dx;
          if (nx < 0 || nx >= width) continue;
          const nIdx = nRow + nx;
          if (binaryMask[nIdx] > 0 && visited[nIdx] === 0) {
            visited[nIdx] = 1;
            queue[tail++] = nIdx;
          }
        }
      }
    }

    const area = tail;
    if (area >= minArea) {
      for (let k = 0; k < tail; k++) {
        cleanedMask[queue[k]] = 255;
      }
      boxes.push({
        id: componentId++,
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
        area,
        centroidX: sumX / area,
        centroidY: sumY / area,
      });
    }
  }

  boxes.sort((a, b) => b.area - a.area);
  return { cleanedMask, boxes };
}

/**
 * Applies the complete configurable morphological chain to a raw foreground mask.
 */
export function applyMorphologyPipeline(
  rawMask: Uint8Array,
  width: number,
  height: number,
  config: MorphologyConfig
): { cleanedMask: Uint8Array; boxes: MovingComponentBox[] } {
  let current: Uint8Array = toStrictBinaryMask(rawMask);

  if (config.enableGaussianBlur) {
    current = gaussianBlurMask(current, width, height, config.gaussianKernelSize);
  }

  if (config.enableThreshold || config.enableGaussianBlur) {
    current = thresholdMask(
      current,
      config.enableThreshold ? config.thresholdValue : 127
    );
  }

  if (config.enableOpening) {
    current = morphologicalOpening(current, width, height, config.openingKernelSize);
  }

  if (config.enableClosing) {
    current = morphologicalClosing(current, width, height, config.closingKernelSize);
  }

  if (config.enableErosion) {
    for (let i = 0; i < Math.max(1, config.erosionIterations); i++) {
      current = erodeBinaryMask(current, width, height, 3);
    }
  }

  if (config.enableDilation) {
    for (let i = 0; i < Math.max(1, config.dilationIterations); i++) {
      current = dilateBinaryMask(current, width, height, 3);
    }
  }

  return filterConnectedComponentsAndExtractBoxes(
    current,
    width,
    height,
    config.minComponentArea
  );
}
