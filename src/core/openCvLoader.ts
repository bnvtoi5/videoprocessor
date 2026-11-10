import cvModule from '@techstark/opencv-js';

export interface OpenCvCapabilities {
  isReady: boolean;
  version: string;
  hasGoodFeaturesToTrack: boolean;
  hasCalcOpticalFlowPyrLK: boolean;
  hasEstimateAffinePartial2D: boolean;
  hasFindTransformECC: boolean;
  hasWarpAffine: boolean;
  hasBackgroundSubtractorMOG2: boolean;
  hasBackgroundSubtractorKNN: boolean;
  hasMorphologyEx: boolean;
  hasConnectedComponentsWithStats: boolean;
  buildInformationSummary: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedCv: any = null;
let cachedCapabilities: OpenCvCapabilities | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let initPromise: Promise<{ cv: any; capabilities: OpenCvCapabilities }> | null = null;

export function inspectOpenCvCapabilities(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cv: any
): OpenCvCapabilities {
  if (!cv || typeof cv.Mat !== 'function') {
    return {
      isReady: false,
      version: 'Unavailable',
      hasGoodFeaturesToTrack: false,
      hasCalcOpticalFlowPyrLK: false,
      hasEstimateAffinePartial2D: false,
      hasFindTransformECC: false,
      hasWarpAffine: false,
      hasBackgroundSubtractorMOG2: false,
      hasBackgroundSubtractorKNN: false,
      hasMorphologyEx: false,
      hasConnectedComponentsWithStats: false,
      buildInformationSummary: 'OpenCV WebAssembly not initialized',
    };
  }

  let buildInfo = 'OpenCV.js WASM 5.0.0-release.1';
  try {
    if (typeof cv.getBuildInformation === 'function') {
      const rawInfo = String(cv.getBuildInformation());
      const firstLine = rawInfo.split('\n').find((l) => l.trim().length > 0);
      if (firstLine) buildInfo = firstLine.trim();
    }
  } catch {
    // ignore
  }

  return {
    isReady: true,
    version: '5.0.0-release.1 (WASM)',
    hasGoodFeaturesToTrack: typeof cv.goodFeaturesToTrack === 'function',
    hasCalcOpticalFlowPyrLK: typeof cv.calcOpticalFlowPyrLK === 'function',
    hasEstimateAffinePartial2D: typeof cv.estimateAffinePartial2D === 'function',
    hasFindTransformECC: typeof cv.findTransformECC === 'function',
    hasWarpAffine: typeof cv.warpAffine === 'function',
    hasBackgroundSubtractorMOG2: typeof cv.BackgroundSubtractorMOG2 === 'function',
    hasBackgroundSubtractorKNN: typeof cv.BackgroundSubtractorKNN === 'function',
    hasMorphologyEx: typeof cv.morphologyEx === 'function',
    hasConnectedComponentsWithStats: typeof cv.connectedComponentsWithStats === 'function',
    buildInformationSummary: buildInfo,
  };
}

export async function loadOpenCv(): Promise<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cv: any;
  capabilities: OpenCvCapabilities;
}> {
  if (cachedCv && cachedCapabilities?.isReady) {
    return { cv: cachedCv, capabilities: cachedCapabilities };
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let cv: any = cvModule;

      if (cv instanceof Promise) {
        cv = await cv;
      } else if (cv && typeof cv.then === 'function') {
        cv = await cv;
      } else if (cv && !cv.Mat) {
        await new Promise<void>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            if (cv && cv.Mat) {
              resolve();
            } else {
              reject(new Error('OpenCV.js initialization timed out after 15s'));
            }
          }, 15000);

          const prevCallback = cv.onRuntimeInitialized;
          cv.onRuntimeInitialized = () => {
            clearTimeout(timeoutId);
            if (typeof prevCallback === 'function') prevCallback();
            resolve();
          };

          if (cv.Mat) {
            clearTimeout(timeoutId);
            resolve();
          }
        });
      }

      cachedCv = cv;
      cachedCapabilities = inspectOpenCvCapabilities(cv);
      return { cv: cachedCv, capabilities: cachedCapabilities };
    } catch (err) {
      const fallbackCaps = inspectOpenCvCapabilities(null);
      cachedCapabilities = {
        ...fallbackCaps,
        buildInformationSummary:
          err instanceof Error ? err.message : 'OpenCV initialization error',
      };
      return { cv: null, capabilities: cachedCapabilities };
    }
  })();

  return initPromise;
}

export function getCachedOpenCv() {
  return {
    cv: cachedCv,
    capabilities: cachedCapabilities ?? inspectOpenCvCapabilities(cachedCv),
  };
}
