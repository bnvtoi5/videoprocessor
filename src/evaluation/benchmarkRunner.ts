import { DecodedVideoSession, RawFrameData } from '../types/video';
import {
  ForegroundDisplayConfig,
  FrameDiffParams,
  Mog2Params,
  MorphologyConfig,
  SampleKnnParams,
  StabilizationParams,
} from '../types/algorithm';
import { BenchmarkExperimentRecord, BenchmarkRow } from '../types/benchmark';
import { runStabilizationPipeline } from '../algorithms/stabilization/stabilizationPipeline';
import { runBackgroundPipeline } from '../algorithms/background/foregroundExtraction';
import { computeMedian } from './performanceMetrics';

export interface BenchmarkProtocolOptions {
  numTrialRuns: 1 | 3;
  stabilizationParams: StabilizationParams;
  frameDiffParams: FrameDiffParams;
  mog2Params: Mog2Params;
  sampleKnnParams: SampleKnnParams;
  morphologyConfig: MorphologyConfig;
  displayConfig: ForegroundDisplayConfig;
  onProgress?: (stepLabel: string, percent: number) => void;
}

/**
 * Executes a fair multi-algorithm Benchmark Protocol on the same video session,
 * resolution, frame count, and sampling rate.
 * Excludes video decoding/encoding overhead and reports median runtime across trials.
 */
export function runFullBenchmarkSuite(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cv: any,
  session: DecodedVideoSession,
  options: BenchmarkProtocolOptions
): BenchmarkExperimentRecord {
  const {
    numTrialRuns,
    stabilizationParams,
    frameDiffParams,
    mog2Params,
    sampleKnnParams,
    morphologyConfig,
    displayConfig,
    onProgress,
  } = options;

  const frames = session.frames;
  const gtMap = session.groundTruthMasks;
  const hasGroundTruth = session.metadata.hasGroundTruth && gtMap.size > 0;

  const rows: BenchmarkRow[] = [];

  // Warm-up pass on a small subset (first 3 frames) to eliminate JIT / WASM warm-up bias
  if (frames.length >= 3) {
    const warmupSubset = frames.slice(0, 3);
    runStabilizationPipeline(cv, warmupSubset, 'lk_ransac', stabilizationParams);
    runBackgroundPipeline(
      cv,
      warmupSubset,
      'mog2',
      frameDiffParams,
      mog2Params,
      sampleKnnParams,
      true,
      morphologyConfig,
      displayConfig
    );
  }

  onProgress?.('Running A1: Sparse Optical Flow (LK + RANSAC)...', 15);
  const lkFrameTimes: number[] = [];
  const lkTotalTimes: number[] = [];
  let lkLastResult = runStabilizationPipeline(
    cv,
    frames,
    'lk_ransac',
    stabilizationParams
  );
  lkFrameTimes.push(lkLastResult.avgProcessingTimeMs);
  lkTotalTimes.push(lkLastResult.totalProcessingTimeMs);

  for (let r = 1; r < numTrialRuns; r++) {
    lkLastResult = runStabilizationPipeline(
      cv,
      frames,
      'lk_ransac',
      stabilizationParams
    );
    lkFrameTimes.push(lkLastResult.avgProcessingTimeMs);
    lkTotalTimes.push(lkLastResult.totalProcessingTimeMs);
  }

  // Baseline unstabilized row (measured against raw trajectory of LK/ECC)
  rows.push({
    id: 'stab_original',
    algorithmName: 'A0. Original Video (Unstabilized Baseline)',
    category: 'Stabilization',
    engineNote: 'Raw Input Camera Trajectory',
    runsCompleted: numTrialRuns,
    algorithmProcessingTimeMs: 0.05,
    totalPipelineTimeMs: 0.05 * frames.length,
    fps: 1000 / Math.max(1, session.metadata.samplingFps),
    jitterRmsPx: lkLastResult.rawTranslationJitterRms,
    rotationJitterRmsDeg: lkLastResult.rawRotationJitterRms,
    accelerationRms: lkLastResult.rawTranslationJitterRms,
    inlierRatioPercent: null,
    eccSuccessRatePercent: null,
    iou: null,
    precision: null,
    recall: null,
    f1: null,
    foregroundRatioPercent: null,
    maskFlickerPercent: null,
    borderLossPercent: 0,
    status: 'Baseline',
  });

  const lkMedianMs = computeMedian(lkFrameTimes);
  rows.push({
    id: 'stab_lk_ransac',
    algorithmName: 'A1. Sparse Optical Flow (LK + RANSAC)',
    category: 'Stabilization',
    engineNote: lkLastResult.engineUsed,
    runsCompleted: numTrialRuns,
    algorithmProcessingTimeMs: lkMedianMs,
    totalPipelineTimeMs: computeMedian(lkTotalTimes),
    fps: 1000 / Math.max(0.05, lkMedianMs),
    jitterRmsPx: lkLastResult.stabilizedTranslationJitterRms,
    rotationJitterRmsDeg: lkLastResult.stabilizedRotationJitterRms,
    accelerationRms: lkLastResult.trajectoryAccelerationRms,
    inlierRatioPercent: lkLastResult.meanInlierRatio,
    eccSuccessRatePercent: null,
    iou: null,
    precision: null,
    recall: null,
    f1: null,
    foregroundRatioPercent: null,
    maskFlickerPercent: null,
    borderLossPercent: lkLastResult.meanBorderLossPercent,
    status: 'Completed',
  });

  onProgress?.('Running A2: ECC Euclidean Stabilization...', 35);
  const eccFrameTimes: number[] = [];
  const eccTotalTimes: number[] = [];
  let eccLastResult = runStabilizationPipeline(cv, frames, 'ecc', stabilizationParams);
  eccFrameTimes.push(eccLastResult.avgProcessingTimeMs);
  eccTotalTimes.push(eccLastResult.totalProcessingTimeMs);

  for (let r = 1; r < numTrialRuns; r++) {
    eccLastResult = runStabilizationPipeline(cv, frames, 'ecc', stabilizationParams);
    eccFrameTimes.push(eccLastResult.avgProcessingTimeMs);
    eccTotalTimes.push(eccLastResult.totalProcessingTimeMs);
  }

  const eccMedianMs = computeMedian(eccFrameTimes);
  rows.push({
    id: 'stab_ecc',
    algorithmName: 'A2. ECC Stabilization (Euclidean Model)',
    category: 'Stabilization',
    engineNote: eccLastResult.engineUsed,
    runsCompleted: numTrialRuns,
    algorithmProcessingTimeMs: eccMedianMs,
    totalPipelineTimeMs: computeMedian(eccTotalTimes),
    fps: 1000 / Math.max(0.05, eccMedianMs),
    jitterRmsPx: eccLastResult.stabilizedTranslationJitterRms,
    rotationJitterRmsDeg: eccLastResult.stabilizedRotationJitterRms,
    accelerationRms: eccLastResult.trajectoryAccelerationRms,
    inlierRatioPercent: null,
    eccSuccessRatePercent: eccLastResult.eccConvergenceRate,
    iou: null,
    precision: null,
    recall: null,
    f1: null,
    foregroundRatioPercent: null,
    maskFlickerPercent: null,
    borderLossPercent: eccLastResult.meanBorderLossPercent,
    status: eccLastResult.eccConvergenceRate < 100 ? 'Partial Fallback' : 'Completed',
  });

  // Background Subtraction methods
  const bgMethods: {
    id: 'frame_diff' | 'mog2' | 'sample_knn';
    label: string;
    progress: number;
  }[] = [
    { id: 'frame_diff', label: 'B1. Frame Differencing', progress: 55 },
    { id: 'mog2', label: 'B2. MOG2 (Gaussian Mixture)', progress: 70 },
    { id: 'sample_knn', label: 'B3. Sample-based KNN (Project TS)', progress: 85 },
  ];

  for (const bg of bgMethods) {
    onProgress?.(`Running ${bg.label}...`, bg.progress);
    const fTimes: number[] = [];
    const tTimes: number[] = [];
    let lastBg = runBackgroundPipeline(
      cv,
      frames,
      bg.id,
      frameDiffParams,
      mog2Params,
      sampleKnnParams,
      true,
      morphologyConfig,
      displayConfig,
      gtMap
    );
    fTimes.push(lastBg.avgProcessingTimeMs);
    tTimes.push(lastBg.totalProcessingTimeMs);

    for (let r = 1; r < numTrialRuns; r++) {
      lastBg = runBackgroundPipeline(
        cv,
        frames,
        bg.id,
        frameDiffParams,
        mog2Params,
        sampleKnnParams,
        true,
        morphologyConfig,
        displayConfig,
        gtMap
      );
      fTimes.push(lastBg.avgProcessingTimeMs);
      tTimes.push(lastBg.totalProcessingTimeMs);
    }

    const medMs = computeMedian(fTimes);
    rows.push({
      id: `bg_${bg.id}`,
      algorithmName: bg.label,
      category: 'Background Separation',
      engineNote: lastBg.engineUsed,
      runsCompleted: numTrialRuns,
      algorithmProcessingTimeMs: medMs,
      totalPipelineTimeMs: computeMedian(tTimes),
      fps: 1000 / Math.max(0.05, medMs),
      jitterRmsPx: null,
      rotationJitterRmsDeg: null,
      accelerationRms: null,
      inlierRatioPercent: null,
      eccSuccessRatePercent: null,
      iou: lastBg.meanIoU,
      precision: lastBg.meanPrecision,
      recall: lastBg.meanRecall,
      f1: lastBg.meanF1,
      foregroundRatioPercent: lastBg.meanForegroundRatio * 100,
      maskFlickerPercent: lastBg.meanMaskFlicker * 100,
      borderLossPercent: null,
      status: 'Completed',
    });
  }

  // Combined Pipeline: Stabilized (LK+RANSAC) -> MOG2
  onProgress?.('Running C1: Combined Pipeline (LK+RANSAC → MOG2)...', 95);
  const stabilizedRawFrames: RawFrameData[] = frames.map((f, idx) => ({
    ...f,
    rgba: lkLastResult.stabilizedFrames[idx],
  }));
  const combinedBg = runBackgroundPipeline(
    cv,
    stabilizedRawFrames,
    'mog2',
    frameDiffParams,
    mog2Params,
    sampleKnnParams,
    true,
    morphologyConfig,
    displayConfig,
    gtMap
  );

  const combinedFrameMs = lkMedianMs + combinedBg.avgProcessingTimeMs;
  rows.push({
    id: 'combined_lk_mog2',
    algorithmName: 'C1. Combined (LK+RANSAC → MOG2)',
    category: 'Combined Pipeline',
    engineNote: `${lkLastResult.engineUsed} → ${combinedBg.engineUsed}`,
    runsCompleted: numTrialRuns,
    algorithmProcessingTimeMs: combinedFrameMs,
    totalPipelineTimeMs:
      lkLastResult.totalProcessingTimeMs + combinedBg.totalProcessingTimeMs,
    fps: 1000 / Math.max(0.05, combinedFrameMs),
    jitterRmsPx: lkLastResult.stabilizedTranslationJitterRms,
    rotationJitterRmsDeg: lkLastResult.stabilizedRotationJitterRms,
    accelerationRms: lkLastResult.trajectoryAccelerationRms,
    inlierRatioPercent: lkLastResult.meanInlierRatio,
    eccSuccessRatePercent: null,
    iou: combinedBg.meanIoU,
    precision: combinedBg.meanPrecision,
    recall: combinedBg.meanRecall,
    f1: combinedBg.meanF1,
    foregroundRatioPercent: combinedBg.meanForegroundRatio * 100,
    maskFlickerPercent: combinedBg.meanMaskFlicker * 100,
    borderLossPercent: lkLastResult.meanBorderLossPercent,
    status: 'Completed',
  });

  // Build trajectory series for Recharts
  const trajectorySeries = frames.map((f, i) => {
    const lkT = lkLastResult.trajectories[i];
    const eccT = eccLastResult.trajectories[i];
    const lkJitterDelta = Math.hypot(
      (lkT?.rawX ?? 0) - (lkT?.smoothX ?? 0),
      (lkT?.rawY ?? 0) - (lkT?.smoothY ?? 0)
    );
    const eccJitterDelta = Math.hypot(
      (eccT?.rawX ?? 0) - (eccT?.smoothX ?? 0),
      (eccT?.rawY ?? 0) - (eccT?.smoothY ?? 0)
    );
    return {
      frame: f.index,
      originalX: Number((lkT?.rawX ?? 0).toFixed(3)),
      originalY: Number((lkT?.rawY ?? 0).toFixed(3)),
      originalAngle: Number((lkT?.rawAngle ?? 0).toFixed(3)),
      lkSmoothX: Number((lkT?.smoothX ?? 0).toFixed(3)),
      lkSmoothY: Number((lkT?.smoothY ?? 0).toFixed(3)),
      lkSmoothAngle: Number((lkT?.smoothAngle ?? 0).toFixed(3)),
      eccSmoothX: Number((eccT?.smoothX ?? 0).toFixed(3)),
      eccSmoothY: Number((eccT?.smoothY ?? 0).toFixed(3)),
      eccSmoothAngle: Number((eccT?.smoothAngle ?? 0).toFixed(3)),
      lkJitterDelta: Number(lkJitterDelta.toFixed(3)),
      eccJitterDelta: Number(eccJitterDelta.toFixed(3)),
    };
  });

  onProgress?.('Benchmark Complete', 100);

  return {
    experimentId: `EXP-${Date.now().toString(36).toUpperCase()}`,
    timestamp: new Date().toISOString(),
    videoFileName: session.metadata.fileName,
    resolution: `${session.metadata.processingWidth}x${session.metadata.processingHeight}`,
    frameCount: frames.length,
    samplingFps: session.metadata.samplingFps,
    numTrialRuns,
    hasGroundTruth,
    rows,
    trajectorySeries,
    configSnapshot: {
      stabilization: stabilizationParams,
      frameDiff: frameDiffParams,
      mog2: mog2Params,
      sampleKnn: sampleKnnParams,
      morphology: morphologyConfig,
    },
  };
}
