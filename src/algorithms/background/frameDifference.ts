import { FrameDiffParams } from '../../types/algorithm';
import { rgbaToGrayscale } from '../stabilization/opticalFlow';

/**
 * Computes pixel-wise median grayscale background from the first K frames.
 */
export function buildMedianReferenceGray(
  grayFrames: Uint8Array[],
  width: number,
  height: number,
  maxFramesToUse: number
): Uint8Array {
  const count = Math.max(1, Math.min(grayFrames.length, maxFramesToUse));
  const n = width * height;
  const reference = new Uint8Array(n);

  if (count === 1) {
    reference.set(grayFrames[0]);
    return reference;
  }

  const column = new Uint8Array(count);
  const mid = count >> 1;

  for (let p = 0; p < n; p++) {
    for (let f = 0; f < count; f++) {
      column[f] = grayFrames[f][p];
    }
    column.sort();
    reference[p] = count % 2 === 1 ? column[mid] : (column[mid - 1] + column[mid]) >> 1;
  }

  return reference;
}

/**
 * Runs Frame Differencing across a sequence of RGBA frames.
 */
export function runFrameDifferencingSequence(
  rgbaFrames: Uint8ClampedArray[],
  width: number,
  height: number,
  params: FrameDiffParams
): { masks: Uint8Array[]; timesMs: number[]; engine: string } {
  const numFrames = rgbaFrames.length;
  if (numFrames === 0) {
    return { masks: [], timesMs: [], engine: 'Frame Differencing (TypeScript/WASM)' };
  }

  const grayFrames = rgbaFrames.map((f) => rgbaToGrayscale(f, width, height));
  const nPixels = width * height;

  const refGray =
    params.referenceMode === 'median_first_n'
      ? buildMedianReferenceGray(grayFrames, width, height, params.medianFrameCount)
      : new Uint8Array(grayFrames[0]);

  const runningRef = new Float32Array(nPixels);
  for (let i = 0; i < nPixels; i++) {
    runningRef[i] = refGray[i];
  }

  const masks: Uint8Array[] = [];
  const timesMs: number[] = [];
  const thresh = Math.max(1, Math.min(254, params.threshold));
  const alpha = Math.max(0.001, Math.min(0.5, params.adaptiveAlpha));

  for (let f = 0; f < numFrames; f++) {
    const t0 = performance.now();
    const curr = grayFrames[f];
    const mask = new Uint8Array(nPixels);

    for (let p = 0; p < nPixels; p++) {
      const refVal =
        params.referenceMode === 'adaptive_running' ? runningRef[p] : refGray[p];
      const diff = Math.abs(curr[p] - refVal);
      mask[p] = diff >= thresh ? 255 : 0;

      if (params.referenceMode === 'adaptive_running' && f > 0) {
        runningRef[p] = (1 - alpha) * runningRef[p] + alpha * curr[p];
      }
    }

    timesMs.push(performance.now() - t0);
    masks.push(mask);
  }

  return {
    masks,
    timesMs,
    engine: `Absolute Frame Differencing (${params.referenceMode})`,
  };
}
