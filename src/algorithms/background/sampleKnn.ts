import { SampleKnnParams } from '../../types/algorithm';
import { rgbaToGrayscale } from '../stabilization/opticalFlow';

/**
 * Project Sample-based KNN Background Subtraction (TypeScript Implementation).
 * Note: Explicitly labeled as Project Sample-based KNN, not OpenCV native BackgroundSubtractorKNN.
 *
 * Principle:
 * - Each pixel stores a history bank of N grayscale samples.
 * - For each incoming frame, computes absolute intensity distance to stored samples.
 * - If at least K samples are within distanceThreshold, pixel is classified as Background (0);
 *   otherwise classified as Foreground (255).
 * - Background pixels (and stochastic learning-rate updates) replace a sample slot in the bank.
 */
export function runSampleKnnSequence(
  rgbaFrames: Uint8ClampedArray[],
  width: number,
  height: number,
  params: SampleKnnParams
): { masks: Uint8Array[]; timesMs: number[]; engine: string } {
  const numFrames = rgbaFrames.length;
  const nPixels = width * height;
  if (numFrames === 0) {
    return {
      masks: [],
      timesMs: [],
      engine: 'Project Sample-based KNN (TypeScript)',
    };
  }

  const N = Math.max(4, Math.min(30, Math.round(params.numSamples)));
  const K = Math.max(1, Math.min(N - 1, Math.round(params.kNeighbors)));
  const distThresh = Math.max(3, params.distanceThreshold);
  const updateProb = Math.max(0.01, Math.min(1.0, params.learningRate * params.sampleReplacementRate));

  // Flattened sample bank: nPixels * N
  const sampleBank = new Uint8Array(nPixels * N);
  const firstGray = rgbaToGrayscale(rgbaFrames[0], width, height);

  // Initialize sample bank with first frame + slight deterministic variation
  for (let p = 0; p < nPixels; p++) {
    const base = p * N;
    const v = firstGray[p];
    for (let s = 0; s < N; s++) {
      const offset = (s % 3) - 1;
      sampleBank[base + s] = Math.max(0, Math.min(255, v + offset));
    }
  }

  const masks: Uint8Array[] = [];
  const timesMs: number[] = [];
  let ringIndex = 0;

  for (let f = 0; f < numFrames; f++) {
    const t0 = performance.now();
    const gray = rgbaToGrayscale(rgbaFrames[f], width, height);
    const mask = new Uint8Array(nPixels);

    // Deterministic step for sample updates
    const shouldUpdateFrame = f > 0;
    const slotToUpdate = ringIndex % N;
    ringIndex++;

    for (let p = 0; p < nPixels; p++) {
      const val = gray[p];
      const base = p * N;
      let closeCount = 0;

      for (let s = 0; s < N; s++) {
        const diff = Math.abs(val - sampleBank[base + s]);
        if (diff <= distThresh) {
          closeCount++;
          if (closeCount >= K) break;
        }
      }

      const isBackground = f === 0 || closeCount >= K;
      mask[p] = isBackground ? 0 : 255;

      // Update sample bank for background pixels, or slowly adapt for static changes
      if (shouldUpdateFrame) {
        if (isBackground) {
          if (((p + f) % Math.max(1, Math.round(1 / updateProb))) === 0) {
            sampleBank[base + slotToUpdate] = val;
          }
        } else if (((p + f) % Math.max(5, Math.round(6 / updateProb))) === 0) {
          // Slow blind adaptation so illumination shifts eventually enter background history
          sampleBank[base + slotToUpdate] = val;
        }
      }
    }

    timesMs.push(performance.now() - t0);
    masks.push(mask);
  }

  return {
    masks,
    timesMs,
    engine: 'Project Sample-based KNN (TypeScript)',
  };
}
