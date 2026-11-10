import { GroundTruthMask, RawFrameData } from '../../types/video';
import {
  BackgroundMethodId,
  BackgroundRunResult,
  ForegroundDisplayConfig,
  FrameDiffParams,
  Mog2Params,
  MorphologyConfig,
  MovingComponentBox,
  SampleKnnParams,
} from '../../types/algorithm';
import { runFrameDifferencingSequence } from './frameDifference';
import { runMog2Sequence } from './mog2';
import { runSampleKnnSequence } from './sampleKnn';
import { applyMorphologyPipeline } from './morphology';
import {
  computeFrameSegmentationMetrics,
  computeMaskFlickerRatio,
} from '../../evaluation/segmentationMetrics';

/**
 * Generates the three derived RGBA visualizations for a single frame:
 * 1. Foreground Overlay (with customizable color, opacity, contour highlight, and optional bounding boxes)
 * 2. Foreground Only (moving components preserved over solid background fill)
 * 3. Background Only (static background preserved, moving foreground masked out)
 */
export function synthesizeForegroundViewsForFrame(
  originalRgba: Uint8ClampedArray,
  cleanedMask: Uint8Array,
  boxes: MovingComponentBox[],
  width: number,
  height: number,
  displayConfig: ForegroundDisplayConfig
): {
  overlayRgba: Uint8ClampedArray;
  foregroundOnlyRgba: Uint8ClampedArray;
  backgroundOnlyRgba: Uint8ClampedArray;
} {
  const nPixels = width * height;
  const overlayRgba = new Uint8ClampedArray(nPixels * 4);
  const foregroundOnlyRgba = new Uint8ClampedArray(nPixels * 4);
  const backgroundOnlyRgba = new Uint8ClampedArray(nPixels * 4);

  const [ovR, ovG, ovB] = displayConfig.overlayColor;
  const alpha = Math.max(0, Math.min(1, displayConfig.overlayOpacity));
  const invAlpha = 1 - alpha;
  const [bgR, bgG, bgB] = displayConfig.backgroundFillColor;

  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const p = row + x;
      const idx = p << 2;
      const r = originalRgba[idx];
      const g = originalRgba[idx + 1];
      const b = originalRgba[idx + 2];
      const isFg = cleanedMask[p] > 0;

      if (isFg) {
        // Check if pixel lies on contour boundary
        let isContour = false;
        if (
          displayConfig.showContours &&
          x > 0 &&
          x < width - 1 &&
          y > 0 &&
          y < height - 1
        ) {
          if (
            cleanedMask[p - 1] === 0 ||
            cleanedMask[p + 1] === 0 ||
            cleanedMask[p - width] === 0 ||
            cleanedMask[p + width] === 0
          ) {
            isContour = true;
          }
        }

        if (isContour) {
          overlayRgba[idx] = 6;
          overlayRgba[idx + 1] = 182;
          overlayRgba[idx + 2] = 212;
          overlayRgba[idx + 3] = 255;
        } else {
          overlayRgba[idx] = Math.round(invAlpha * r + alpha * ovR);
          overlayRgba[idx + 1] = Math.round(invAlpha * g + alpha * ovG);
          overlayRgba[idx + 2] = Math.round(invAlpha * b + alpha * ovB);
          overlayRgba[idx + 3] = 255;
        }

        foregroundOnlyRgba[idx] = r;
        foregroundOnlyRgba[idx + 1] = g;
        foregroundOnlyRgba[idx + 2] = b;
        foregroundOnlyRgba[idx + 3] = 255;

        backgroundOnlyRgba[idx] = 15;
        backgroundOnlyRgba[idx + 1] = 23;
        backgroundOnlyRgba[idx + 2] = 42;
        backgroundOnlyRgba[idx + 3] = 255;
      } else {
        overlayRgba[idx] = r;
        overlayRgba[idx + 1] = g;
        overlayRgba[idx + 2] = b;
        overlayRgba[idx + 3] = 255;

        foregroundOnlyRgba[idx] = bgR;
        foregroundOnlyRgba[idx + 1] = bgG;
        foregroundOnlyRgba[idx + 2] = bgB;
        foregroundOnlyRgba[idx + 3] = 255;

        backgroundOnlyRgba[idx] = r;
        backgroundOnlyRgba[idx + 1] = g;
        backgroundOnlyRgba[idx + 2] = b;
        backgroundOnlyRgba[idx + 3] = 255;
      }
    }
  }

  // Draw bounding boxes on Overlay view if enabled
  if (displayConfig.showBoundingBoxes && boxes.length > 0) {
    for (const box of boxes) {
      const x0 = Math.max(0, box.x);
      const y0 = Math.max(0, box.y);
      const x1 = Math.min(width - 1, box.x + box.width - 1);
      const y1 = Math.min(height - 1, box.y + box.height - 1);

      for (let x = x0; x <= x1; x++) {
        const topIdx = (y0 * width + x) << 2;
        const botIdx = (y1 * width + x) << 2;
        overlayRgba[topIdx] = 245;
        overlayRgba[topIdx + 1] = 158;
        overlayRgba[topIdx + 2] = 11;
        overlayRgba[botIdx] = 245;
        overlayRgba[botIdx + 1] = 158;
        overlayRgba[botIdx + 2] = 11;
      }
      for (let y = y0; y <= y1; y++) {
        const leftIdx = (y * width + x0) << 2;
        const rightIdx = (y * width + x1) << 2;
        overlayRgba[leftIdx] = 245;
        overlayRgba[leftIdx + 1] = 158;
        overlayRgba[leftIdx + 2] = 11;
        overlayRgba[rightIdx] = 245;
        overlayRgba[rightIdx + 1] = 158;
        overlayRgba[rightIdx + 2] = 11;
      }
    }
  }

  return {
    overlayRgba,
    foregroundOnlyRgba,
    backgroundOnlyRgba,
  };
}

/**
 * Converts a single-channel mask (0 = bg, 127 = shadow, 255 = fg) to RGBA for canvas rendering.
 */
export function maskToRgba(
  mask: Uint8Array,
  width: number,
  height: number
): Uint8ClampedArray {
  const n = width * height;
  const rgba = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    const v = mask[i];
    const idx = i << 2;
    if (v === 127) {
      // Distinct cyan-slate tint for MOG2 shadow pixels
      rgba[idx] = 100;
      rgba[idx + 1] = 116;
      rgba[idx + 2] = 139;
      rgba[idx + 3] = 255;
    } else {
      rgba[idx] = v;
      rgba[idx + 1] = v;
      rgba[idx + 2] = v;
      rgba[idx + 3] = 255;
    }
  }
  return rgba;
}

/**
 * Runs complete Background & Foreground Separation pipeline for a chosen algorithm.
 */
export function runBackgroundPipeline(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cv: any,
  frames: RawFrameData[],
  method: BackgroundMethodId,
  frameDiffParams: FrameDiffParams,
  mog2Params: Mog2Params,
  sampleKnnParams: SampleKnnParams,
  enableMorphology: boolean,
  morphologyConfig: MorphologyConfig,
  displayConfig: ForegroundDisplayConfig,
  groundTruthMasks?: Map<number, GroundTruthMask>
): BackgroundRunResult {
  const n = frames.length;
  if (n === 0) {
    return {
      method,
      engineUsed: 'None',
      binaryMasks: [],
      cleanedMasks: [],
      overlayFrames: [],
      foregroundOnlyFrames: [],
      backgroundOnlyFrames: [],
      boundingBoxesPerFrame: [],
      frameMetrics: [],
      totalProcessingTimeMs: 0,
      avgProcessingTimeMs: 0,
      fps: 0,
      hasGroundTruthEvaluated: false,
      meanPrecision: null,
      meanRecall: null,
      meanF1: null,
      meanIoU: null,
      meanForegroundRatio: 0,
      meanMaskFlicker: 0,
    };
  }

  const width = frames[0].width;
  const height = frames[0].height;
  const rgbaBuffers = frames.map((f) => f.rgba);

  let rawResult: { masks: Uint8Array[]; timesMs: number[]; engine: string };
  if (method === 'frame_diff') {
    rawResult = runFrameDifferencingSequence(rgbaBuffers, width, height, frameDiffParams);
  } else if (method === 'mog2') {
    rawResult = runMog2Sequence(cv, rgbaBuffers, width, height, mog2Params);
  } else {
    rawResult = runSampleKnnSequence(rgbaBuffers, width, height, sampleKnnParams);
  }

  const cleanedMasks: Uint8Array[] = [];
  const overlayFrames: Uint8ClampedArray[] = [];
  const foregroundOnlyFrames: Uint8ClampedArray[] = [];
  const backgroundOnlyFrames: Uint8ClampedArray[] = [];
  const boundingBoxesPerFrame: MovingComponentBox[][] = [];
  const frameMetrics = [];

  let totalTimeMs = 0;

  for (let i = 0; i < n; i++) {
    const tMorph0 = performance.now();
    const rawMask = rawResult.masks[i];

    let cleanedMask: Uint8Array;
    let boxes: MovingComponentBox[];

    if (enableMorphology) {
      const morphRes = applyMorphologyPipeline(rawMask, width, height, morphologyConfig);
      cleanedMask = morphRes.cleanedMask;
      boxes = morphRes.boxes;
    } else {
      const morphRes = applyMorphologyPipeline(rawMask, width, height, {
        enableGaussianBlur: false,
        gaussianKernelSize: 3,
        enableThreshold: false,
        thresholdValue: 127,
        enableOpening: false,
        openingKernelSize: 3,
        enableClosing: false,
        closingKernelSize: 3,
        enableErosion: false,
        erosionIterations: 1,
        enableDilation: false,
        dilationIterations: 1,
        minComponentArea: Math.max(1, morphologyConfig.minComponentArea),
      });
      cleanedMask = morphRes.cleanedMask;
      boxes = morphRes.boxes;
    }

    const morphTime = performance.now() - tMorph0;
    const frameTime = rawResult.timesMs[i] + morphTime;
    totalTimeMs += frameTime;

    cleanedMasks.push(cleanedMask);
    boundingBoxesPerFrame.push(boxes);

    const views = synthesizeForegroundViewsForFrame(
      rgbaBuffers[i],
      cleanedMask,
      boxes,
      width,
      height,
      displayConfig
    );
    overlayFrames.push(views.overlayRgba);
    foregroundOnlyFrames.push(views.foregroundOnlyRgba);
    backgroundOnlyFrames.push(views.backgroundOnlyRgba);

    const gt = groundTruthMasks?.get(frames[i].index);
    const gtMask =
      gt && gt.width === width && gt.height === height ? gt.mask : undefined;
    const gtValidMask =
      gt && gt.width === width && gt.height === height
        ? gt.validityMask
        : undefined;

    const prevMask = i > 0 ? cleanedMasks[i - 1] : undefined;
    const flicker = prevMask ? computeMaskFlickerRatio(prevMask, cleanedMask) : 0;

    const m = computeFrameSegmentationMetrics(
      frames[i].index,
      cleanedMask,
      gtMask,
      flicker,
      frameTime,
      boxes.length,
      gtValidMask
    );
    frameMetrics.push(m);
  }

  // Evaluate averages across frames that have Ground Truth (excluding frame 0 initialization frame)
  const evalFrames = frameMetrics.slice(1).filter((m) => m.iou !== null);
  const hasGt = evalFrames.length > 0;

  const meanPrecision = hasGt
    ? evalFrames.reduce((a, b) => a + (b.precision ?? 0), 0) / evalFrames.length
    : null;
  const meanRecall = hasGt
    ? evalFrames.reduce((a, b) => a + (b.recall ?? 0), 0) / evalFrames.length
    : null;
  const meanF1 = hasGt
    ? evalFrames.reduce((a, b) => a + (b.f1 ?? 0), 0) / evalFrames.length
    : null;
  const meanIoU = hasGt
    ? evalFrames.reduce((a, b) => a + (b.iou ?? 0), 0) / evalFrames.length
    : null;

  const meanForegroundRatio =
    frameMetrics.reduce((a, b) => a + b.foregroundRatio, 0) / n;
  const meanMaskFlicker =
    n > 1
      ? frameMetrics.slice(1).reduce((a, b) => a + b.flickerRatio, 0) / (n - 1)
      : 0;

  const avgProcessingTimeMs = Math.max(0.05, totalTimeMs / n);
  const fps = 1000 / avgProcessingTimeMs;

  return {
    method,
    engineUsed: rawResult.engine,
    binaryMasks: rawResult.masks,
    cleanedMasks,
    overlayFrames,
    foregroundOnlyFrames,
    backgroundOnlyFrames,
    boundingBoxesPerFrame,
    frameMetrics,
    totalProcessingTimeMs: totalTimeMs,
    avgProcessingTimeMs,
    fps,
    hasGroundTruthEvaluated: hasGt,
    meanPrecision,
    meanRecall,
    meanF1,
    meanIoU,
    meanForegroundRatio,
    meanMaskFlicker,
  };
}
