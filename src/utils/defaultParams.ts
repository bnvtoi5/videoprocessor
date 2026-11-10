import {
  CombinedPipelineConfig,
  ForegroundDisplayConfig,
  FrameDiffParams,
  Mog2Params,
  MorphologyConfig,
  SampleKnnParams,
  StabilizationParams,
} from '../types/algorithm';

export const DEFAULT_STABILIZATION_PARAMS: StabilizationParams = {
  maxCorners: 180,
  qualityLevel: 0.015,
  minDistance: 8,
  ransacThreshold: 2.5,
  smoothingRadius: 10,
  smoothRotation: true,
  cropRatio: 0.0,
  eccIterations: 35,
  eccEps: 0.001,
};

export const DEFAULT_FRAME_DIFF_PARAMS: FrameDiffParams = {
  threshold: 28,
  referenceMode: 'median_first_n',
  medianFrameCount: 5,
  adaptiveAlpha: 0.04,
};

export const DEFAULT_MOG2_PARAMS: Mog2Params = {
  history: 60,
  varThreshold: 16,
  learningRate: 0.03,
  detectShadows: true,
  shadowThreshold: 0.55,
};

export const DEFAULT_SAMPLE_KNN_PARAMS: SampleKnnParams = {
  numSamples: 14,
  kNeighbors: 3,
  distanceThreshold: 24,
  learningRate: 0.08,
  sampleReplacementRate: 1.0,
};

export const DEFAULT_MORPHOLOGY_CONFIG: MorphologyConfig = {
  enableGaussianBlur: true,
  gaussianKernelSize: 3,
  enableThreshold: true,
  thresholdValue: 127,
  enableOpening: true,
  openingKernelSize: 3,
  enableClosing: true,
  closingKernelSize: 3,
  enableErosion: false,
  erosionIterations: 1,
  enableDilation: false,
  dilationIterations: 1,
  minComponentArea: 28,
};

export const DEFAULT_FOREGROUND_DISPLAY_CONFIG: ForegroundDisplayConfig = {
  overlayColor: [16, 185, 129], // Emerald #10B981
  overlayOpacity: 0.55,
  showContours: true,
  showBoundingBoxes: true,
  backgroundFillColor: [11, 14, 23],
};

export const DEFAULT_COMBINED_PIPELINE_CONFIG: CombinedPipelineConfig = {
  enableMotionEstimation: true,
  enableStabilization: true,
  stabilizationMethod: 'lk_ransac',
  stabilizationParams: DEFAULT_STABILIZATION_PARAMS,
  backgroundInputSource: 'stabilized',
  enableBackgroundModeling: true,
  backgroundMethod: 'mog2',
  frameDiffParams: DEFAULT_FRAME_DIFF_PARAMS,
  mog2Params: DEFAULT_MOG2_PARAMS,
  sampleKnnParams: DEFAULT_SAMPLE_KNN_PARAMS,
  enableMorphology: true,
  morphologyConfig: DEFAULT_MORPHOLOGY_CONFIG,
  displayConfig: DEFAULT_FOREGROUND_DISPLAY_CONFIG,
};
