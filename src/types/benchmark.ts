import {
  StabilizationParams,
  FrameDiffParams,
  Mog2Params,
  SampleKnnParams,
  MorphologyConfig,
} from './algorithm';

export interface BenchmarkRow {
  id: string;
  algorithmName: string;
  category: 'Stabilization' | 'Background Separation' | 'Combined Pipeline';
  engineNote: string;
  runsCompleted: number;
  algorithmProcessingTimeMs: number; // Median per frame (ms)
  totalPipelineTimeMs: number; // Total run time (ms)
  fps: number;
  jitterRmsPx: number | null;
  rotationJitterRmsDeg: number | null;
  accelerationRms: number | null;
  inlierRatioPercent: number | null;
  eccSuccessRatePercent: number | null;
  iou: number | null;
  precision: number | null;
  recall: number | null;
  f1: number | null;
  foregroundRatioPercent: number | null;
  maskFlickerPercent: number | null;
  borderLossPercent: number | null;
  status: 'Completed' | 'Partial Fallback' | 'Baseline';
}

export interface BenchmarkExperimentRecord {
  experimentId: string;
  timestamp: string;
  videoFileName: string;
  resolution: string;
  frameCount: number;
  samplingFps: number;
  numTrialRuns: number;
  hasGroundTruth: boolean;
  rows: BenchmarkRow[];
  trajectorySeries: {
    frame: number;
    originalX: number;
    originalY: number;
    originalAngle: number;
    lkSmoothX: number;
    lkSmoothY: number;
    lkSmoothAngle: number;
    eccSmoothX: number;
    eccSmoothY: number;
    eccSmoothAngle: number;
    lkJitterDelta: number;
    eccJitterDelta: number;
  }[];
  configSnapshot: {
    stabilization: StabilizationParams;
    frameDiff: FrameDiffParams;
    mog2: Mog2Params;
    sampleKnn: SampleKnnParams;
    morphology: MorphologyConfig;
  };
}
