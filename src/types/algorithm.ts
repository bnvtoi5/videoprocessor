export type StabilizationMethodId = 'none' | 'lk_ransac' | 'ecc';

export type BackgroundMethodId = 'frame_diff' | 'mog2' | 'sample_knn';

export type ForegroundViewMode =
  | 'original'
  | 'binary_mask'
  | 'overlay'
  | 'foreground_only'
  | 'background_only';

export interface StabilizationParams {
  maxCorners: number;
  qualityLevel: number;
  minDistance: number;
  ransacThreshold: number;
  smoothingRadius: number;
  smoothRotation: boolean;
  cropRatio: number; // 0.0 to 0.20 border crop compensation
  eccIterations: number;
  eccEps: number;
}

export interface FrameDiffParams {
  threshold: number;
  referenceMode: 'first_frame' | 'median_first_n' | 'adaptive_running';
  medianFrameCount: number;
  adaptiveAlpha: number;
}

export interface Mog2Params {
  history: number;
  varThreshold: number;
  learningRate: number; // -1 for auto, or 0..1
  detectShadows: boolean;
  shadowThreshold: number;
}

export interface SampleKnnParams {
  numSamples: number;
  kNeighbors: number;
  distanceThreshold: number;
  learningRate: number; // probability 1/T or 0.01..0.2
  sampleReplacementRate: number;
}

export interface MorphologyConfig {
  enableGaussianBlur: boolean;
  gaussianKernelSize: number;
  enableThreshold: boolean;
  thresholdValue: number;
  enableOpening: boolean;
  openingKernelSize: number;
  enableClosing: boolean;
  closingKernelSize: number;
  enableErosion: boolean;
  erosionIterations: number;
  enableDilation: boolean;
  dilationIterations: number;
  minComponentArea: number;
}

export interface ForegroundDisplayConfig {
  overlayColor: [number, number, number]; // RGB
  overlayOpacity: number; // 0..1
  showContours: boolean;
  showBoundingBoxes: boolean;
  backgroundFillColor: [number, number, number]; // RGB for Foreground Only
}

export interface TrackedFeaturePoint {
  prevX: number;
  prevY: number;
  currX: number;
  currY: number;
  isInlier: boolean;
}

export interface FrameTransform {
  frameIndex: number;
  dx: number;
  dy: number;
  da: number; // radians
  scale: number;
  inliersCount: number;
  totalFeatures: number;
  inlierRatio: number;
  eccConverged: boolean;
  eccScore: number;
  processingTimeMs: number;
}

export interface TrajectoryState {
  frameIndex: number;
  rawX: number;
  rawY: number;
  rawAngle: number; // degrees
  smoothX: number;
  smoothY: number;
  smoothAngle: number; // degrees
  corrDx: number;
  corrDy: number;
  corrDa: number; // radians
}

export interface MovingComponentBox {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  area: number;
  centroidX: number;
  centroidY: number;
}

export interface StabilizationRunResult {
  method: StabilizationMethodId;
  engineUsed: string;
  stabilizedFrames: Uint8ClampedArray[];
  transforms: FrameTransform[];
  trajectories: TrajectoryState[];
  trackedFeaturesPerFrame: TrackedFeaturePoint[][];
  validAreaRatioPerFrame: number[];
  borderLossRatioPerFrame: number[];
  totalProcessingTimeMs: number;
  avgProcessingTimeMs: number;
  fps: number;
  eccConvergenceRate: number;
  eccFailedFrames: number[];
  meanInlierCount: number;
  meanInlierRatio: number;
  rawTranslationJitterRms: number;
  stabilizedTranslationJitterRms: number;
  rawRotationJitterRms: number;
  stabilizedRotationJitterRms: number;
  trajectoryAccelerationRms: number;
  meanValidAreaPercent: number;
  meanBorderLossPercent: number;
}

export interface BackgroundFrameMetrics {
  frameIndex: number;
  tp: number;
  fp: number;
  fn: number;
  tn: number;
  precision: number | null;
  recall: number | null;
  f1: number | null;
  iou: number | null;
  foregroundRatio: number;
  flickerRatio: number;
  processingTimeMs: number;
  componentCount: number;
}

export interface BackgroundRunResult {
  method: BackgroundMethodId;
  engineUsed: string;
  binaryMasks: Uint8Array[]; // 0 = bg, 127 = shadow (if MOG2), 255 = fg
  cleanedMasks: Uint8Array[]; // 0 or 255 after morphology + minComponentArea
  overlayFrames: Uint8ClampedArray[];
  foregroundOnlyFrames: Uint8ClampedArray[];
  backgroundOnlyFrames: Uint8ClampedArray[];
  boundingBoxesPerFrame: MovingComponentBox[][];
  frameMetrics: BackgroundFrameMetrics[];
  totalProcessingTimeMs: number;
  avgProcessingTimeMs: number;
  fps: number;
  hasGroundTruthEvaluated: boolean;
  meanPrecision: number | null;
  meanRecall: number | null;
  meanF1: number | null;
  meanIoU: number | null;
  meanForegroundRatio: number;
  meanMaskFlicker: number;
}

export interface CombinedPipelineConfig {
  enableMotionEstimation: boolean;
  enableStabilization: boolean;
  stabilizationMethod: StabilizationMethodId;
  stabilizationParams: StabilizationParams;
  backgroundInputSource: 'original' | 'stabilized';
  enableBackgroundModeling: boolean;
  backgroundMethod: BackgroundMethodId;
  frameDiffParams: FrameDiffParams;
  mog2Params: Mog2Params;
  sampleKnnParams: SampleKnnParams;
  enableMorphology: boolean;
  morphologyConfig: MorphologyConfig;
  displayConfig: ForegroundDisplayConfig;
}

export interface CombinedPipelineComparisonResult {
  flowA_OriginalToBg: BackgroundRunResult;
  flowB_StabilizedToBg: BackgroundRunResult;
  stabilizationResult: StabilizationRunResult;
  highCameraMotionWarning: boolean;
  meanCameraDisplacementPx: number;
  maskDifferenceRatioPerFrame: number[];
  meanMaskDifferencePercent: number;
}
