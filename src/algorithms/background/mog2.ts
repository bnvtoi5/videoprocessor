import { Mog2Params } from '../../types/algorithm';
import { rgbaToGrayscale } from '../stabilization/opticalFlow';

/**
 * Multi-modal Gaussian Mixture Model (MOG2) per-pixel implementation in TypeScript
 * used when OpenCV.js BackgroundSubtractorMOG2 is unavailable or in Node unit tests.
 * Distinguishes Background (0), Shadow (127), and Foreground (255).
 */
export function runMog2TypeScriptSequence(
  rgbaFrames: Uint8ClampedArray[],
  width: number,
  height: number,
  params: Mog2Params
): { masks: Uint8Array[]; timesMs: number[]; engine: string } {
  const numFrames = rgbaFrames.length;
  const nPixels = width * height;
  if (numFrames === 0) {
    return { masks: [], timesMs: [], engine: 'Gaussian Mixture Model MOG2 (TypeScript)' };
  }

  // 3 Gaussian components per pixel: mean, variance, weight
  const K = 3;
  const means = new Float32Array(nPixels * K);
  const vars = new Float32Array(nPixels * K);
  const weights = new Float32Array(nPixels * K);

  const firstGray = rgbaToGrayscale(rgbaFrames[0], width, height);
  const initVar = 15.0 * 15.0;

  for (let p = 0; p < nPixels; p++) {
    const base = p * K;
    means[base] = firstGray[p];
    vars[base] = initVar;
    weights[base] = 1.0;

    for (let k = 1; k < K; k++) {
      means[base + k] = firstGray[p];
      vars[base + k] = initVar * 2;
      weights[base + k] = 0.0;
    }
  }

  const alpha =
    params.learningRate > 0 && params.learningRate <= 1
      ? params.learningRate
      : 1.0 / Math.max(10, params.history);

  const varThreshold = Math.max(4, params.varThreshold);
  const masks: Uint8Array[] = [];
  const timesMs: number[] = [];

  for (let f = 0; f < numFrames; f++) {
    const t0 = performance.now();
    const gray = rgbaToGrayscale(rgbaFrames[f], width, height);
    const mask = new Uint8Array(nPixels);

    for (let p = 0; p < nPixels; p++) {
      const val = gray[p];
      const base = p * K;
      let matched = false;
      let isBackground = false;

      // Check match against dominant Gaussian components
      let weightSum = 0;
      for (let k = 0; k < K; k++) {
        const w = weights[base + k];
        const mu = means[base + k];
        const sigma2 = Math.max(9.0, vars[base + k]);
        const diff = val - mu;
        const dist2 = (diff * diff) / sigma2;

        if (!matched && dist2 <= varThreshold) {
          matched = true;
          if (weightSum < 0.75 || k === 0) {
            isBackground = true;
          }
          // Update matched Gaussian
          weights[base + k] = (1 - alpha) * w + alpha;
          const rho = alpha;
          means[base + k] = (1 - rho) * mu + rho * val;
          vars[base + k] = Math.max(
            9.0,
            Math.min(900.0, (1 - rho) * sigma2 + rho * diff * diff)
          );
        } else {
          weights[base + k] = (1 - alpha) * w;
        }
        weightSum += w;
      }

      if (!matched) {
        // Replace weakest Gaussian component
        let minK = K - 1;
        let minW = weights[base + minK];
        for (let k = 0; k < K; k++) {
          if (weights[base + k] < minW) {
            minW = weights[base + k];
            minK = k;
          }
        }
        means[base + minK] = val;
        vars[base + minK] = initVar * 1.5;
        weights[base + minK] = Math.max(0.05, alpha);
      }

      // Normalize weights
      let normW = 0;
      for (let k = 0; k < K; k++) normW += weights[base + k];
      if (normW > 0) {
        for (let k = 0; k < K; k++) weights[base + k] /= normW;
      }

      if (f === 0 || isBackground) {
        mask[p] = 0;
      } else {
        // Check shadow condition if detectShadows is enabled
        const bgMean = means[base];
        if (
          params.detectShadows &&
          bgMean > 20 &&
          val < bgMean &&
          val >= bgMean * params.shadowThreshold
        ) {
          mask[p] = 127; // Shadow pixel value
        } else {
          mask[p] = 255; // Foreground pixel value
        }
      }
    }

    timesMs.push(performance.now() - t0);
    masks.push(mask);
  }

  return {
    masks,
    timesMs,
    engine: 'Adaptive Gaussian Mixture Model MOG2',
  };
}

/**
 * Runs OpenCV.js BackgroundSubtractorMOG2 when available in the runtime,
 * with explicit shadow value (127) vs foreground (255) handling and strict Mat cleanup.
 */
export function runMog2Sequence(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cv: any,
  rgbaFrames: Uint8ClampedArray[],
  width: number,
  height: number,
  params: Mog2Params
): { masks: Uint8Array[]; timesMs: number[]; engine: string } {
  const canUseOpenCvMog2 =
    cv &&
    typeof cv.Mat === 'function' &&
    typeof cv.BackgroundSubtractorMOG2 === 'function';

  if (!canUseOpenCvMog2) {
    return runMog2TypeScriptSequence(rgbaFrames, width, height, params);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let subtractor: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let frameMat: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fgMaskMat: any = null;

  try {
    subtractor = new cv.BackgroundSubtractorMOG2(
      Math.max(5, Math.round(params.history)),
      Math.max(2, params.varThreshold),
      Boolean(params.detectShadows)
    );
    frameMat = new cv.Mat(height, width, cv.CV_8UC4);
    fgMaskMat = new cv.Mat(height, width, cv.CV_8UC1);

    const masks: Uint8Array[] = [];
    const timesMs: number[] = [];
    const nPixels = width * height;

    for (let f = 0; f < rgbaFrames.length; f++) {
      const t0 = performance.now();
      frameMat.data.set(rgbaFrames[f]);
      const lr =
        params.learningRate > 0 && params.learningRate <= 1
          ? params.learningRate
          : -1;
      subtractor.apply(frameMat, fgMaskMat, lr);

      const rawMask = new Uint8Array(nPixels);
      const data = fgMaskMat.data;

      for (let i = 0; i < nPixels; i++) {
        const v = data[i];
        if (!params.detectShadows) {
          // When shadow detection is disabled, only >= 200 is foreground
          rawMask[i] = v >= 200 ? 255 : 0;
        } else {
          // OpenCV MOG2 encodes shadow as 127 and foreground as 255
          if (v === 127) {
            rawMask[i] = 127;
          } else if (v >= 200) {
            rawMask[i] = 255;
          } else {
            rawMask[i] = 0;
          }
        }
      }

      timesMs.push(performance.now() - t0);
      masks.push(rawMask);
    }

    return {
      masks,
      timesMs,
      engine: 'OpenCV.js WASM (BackgroundSubtractorMOG2)',
    };
  } catch {
    return runMog2TypeScriptSequence(rgbaFrames, width, height, params);
  } finally {
    if (frameMat) frameMat.delete();
    if (fgMaskMat) fgMaskMat.delete();
    if (subtractor && typeof subtractor.delete === 'function') {
      subtractor.delete();
    }
  }
}
