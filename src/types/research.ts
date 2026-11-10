import {
  BackgroundMethodId,
  FrameDiffParams,
  Mog2Params,
  MorphologyConfig,
  SampleKnnParams,
  StabilizationMethodId,
  StabilizationParams,
} from './algorithm';
import { SyntheticScenarioId } from './video';

export type ResearchQuestionId = 'RQ1' | 'RQ2' | 'RQ3' | 'RQ4' | 'RQ5';
export type HypothesisId = 'H1' | 'H2' | 'H3' | 'H4' | 'H5' | 'H6' | 'H7';

export interface ResearchQuestionSpec {
  id: ResearchQuestionId;
  title: string;
  questionVi: string;
  questionEn: string;
  linkedHypotheses: HypothesisId[];
  independentVariables: string[];
  dependentVariables: string[];
  experimentalMethod: string;
  evaluationMetrics: string[];
  requiredMeasurements: string[];
  supportingLiteratureIds: string[];
}

export interface ResearchHypothesisSpec {
  id: HypothesisId;
  linkedRq: ResearchQuestionId;
  statementVi: string;
  statementEn: string;
  nullHypothesisVi: string;
  testablePrediction: string;
  targetExperimentGroup: 'Group A' | 'Group B' | 'Group C' | 'Group D' | 'Group E';
  verificationCriteria: string;
}

export type PublicationCategory =
  | 'Original Research'
  | 'Survey / Review'
  | 'Benchmark / Dataset'
  | 'Software Documentation';

export interface LiteratureEntry {
  id: string;
  indexNumber: number;
  domain:
    | 'Video Stabilization'
    | 'Background Subtraction'
    | 'Moving Camera & Foreground Extraction'
    | 'Datasets & Evaluation';
  category: PublicationCategory;
  authors: string;
  year: number;
  title: string;
  venue: string;
  doi: string;
  url: string;
  apa7Citation: string;
  inTextCitation: string;
  verificationStatus: 'Metadata & DOI Verified' | 'Metadata & Official URL Verified';
  proposedMethod: string;
  experimentalDataset: string;
  reportedMetrics: string[];
  experimentalConditions: string;
  mainFindings: string;
  limitations: string;
  relevantProjectSection: string;
  supportedRqs: ResearchQuestionId[];
  supportedHypotheses: HypothesisId[];
  relationshipToOurResults: string;
}

export interface CameraMotionGroundTruthMetrics {
  hasGroundTruthTransform: boolean;
  /** Inter-frame step motion estimation RMSE (pixels) */
  translationRmsePx: number | null;
  /** Inter-frame step rotation estimation RMSE (degrees) */
  rotationRmseDeg: number | null;
  /** Scale estimation error RMSE */
  scaleRmse: number | null;
  /** 2x3 Affine transformation matrix Frobenius norm RMSE */
  transformMatrixRmse: number | null;
  /** Residual camera displacement RMS after stabilization warp (pixels) */
  residualMotionAfterStabilizationPx: number | null;
  /** Second-order trajectory finite difference RMS (proxy smoothness metric) */
  trajectorySmoothnessJitterRmsPx: number;
}

export interface RuntimeVariabilityStats {
  repetitions: number;
  warmUpExecuted: boolean;
  perRunMeanFrameMs: number[];
  perRunTotalMs: number[];
  meanLatencyMs: number;
  medianLatencyMs: number;
  stdDevLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  meanFps: number;
  allocatedFrameBufferMb: number;
}

export interface BoxPlotSummary {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  mean: number;
  stdDev: number;
  n: number;
}

export interface PairedStatisticalTestResult {
  metricName: string;
  unit: string;
  methodAName: string;
  methodBName: string;
  sampleSizeN: number;
  meanA: number;
  meanB: number;
  meanDifference: number; // B - A
  medianDifference: number;
  stdDevDifference: number;
  confidenceInterval95: [number, number];
  blockBootstrapCi95: [number, number];
  cohensDzEffectSize: number;
  effectMagnitudeLabel: 'Negligible' | 'Small' | 'Medium' | 'Large';
  pairedTTest: {
    tStatistic: number;
    degreesOfFreedom: number;
    pValueTwoTailed: number;
  };
  wilcoxonSignedRank: {
    wStatistic: number;
    zScore: number;
    pValueTwoTailed: number;
    nonZeroPairs: number;
  };
  boxPlotA: BoxPlotSummary;
  boxPlotB: BoxPlotSummary;
  perFrameSeries: {
    frameIndex: number;
    valueA: number;
    valueB: number;
    diff: number;
  }[];
  autocorrelationWarning: string;
  interpretationVi: string;
}

export type ExperimentGroupType =
  | 'Group A: Stabilization'
  | 'Group B: Background Subtraction'
  | 'Group C: Processing Order'
  | 'Group D: Ablation Study'
  | 'Group E: Parameter Sensitivity';

export interface ResearchExperimentRow {
  experimentId: string;
  group: ExperimentGroupType;
  researchQuestion: ResearchQuestionId;
  hypothesis: HypothesisId;
  datasetName: string;
  scenarioId?: SyntheticScenarioId;
  algorithmLabel: string;
  configSummary: string;
  bypassNote?: string;
  // Ground-Truth Objective Segmentation Metrics
  tp: number | null;
  tn: number | null;
  fp: number | null;
  fn: number | null;
  iou: number | null;
  f1: number | null;
  precision: number | null;
  recall: number | null;
  fpr: number | null;
  fnr: number | null;
  pwcErrorPercent: number | null;
  // Ground-Truth Objective Camera Motion Metrics
  translationRmsePx: number | null;
  rotationRmseDeg: number | null;
  transformMatrixRmse: number | null;
  residualMotionPx: number | null;
  // Proxy & Trajectory Metrics
  jitterRmsPx: number | null;
  rotationJitterRmsDeg: number | null;
  accelerationRms: number | null;
  inlierRatioPercent: number | null;
  eccConvergencePercent: number | null;
  maskFlickerPercent: number | null;
  validAreaPercent: number | null;
  borderLossPercent: number | null;
  // Performance & Runtime Metrics
  fps: number;
  meanLatencyMs: number;
  medianLatencyMs: number;
  stdDevLatencyMs: number;
  totalPipelineTimeMs: number;
  repetitions: number;
  status: 'Measured (Empirical)' | 'Baseline' | 'Ablation Variant' | 'Theoretical Reference';
}

export type SensitivityParameterKey =
  | 'gaussianKernelSize'
  | 'maxCorners'
  | 'ransacThreshold'
  | 'smoothingRadius'
  | 'eccIterations'
  | 'mog2LearningRate'
  | 'mog2VarThreshold'
  | 'knnDistanceThreshold'
  | 'morphKernelSize';

export interface ParameterSensitivityPoint {
  paramValue: number;
  paramLabel: string;
  iou: number | null;
  f1: number | null;
  jitterRmsPx: number | null;
  translationRmsePx: number | null;
  maskFlickerPercent: number | null;
  fps: number;
  latencyMs: number;
}

export interface ParameterSensitivitySweepResult {
  sweepId: string;
  timestamp: string;
  parameterKey: SensitivityParameterKey;
  parameterNameVi: string;
  datasetName: string;
  points: ParameterSensitivityPoint[];
  optimalValueNoteVi: string;
}

export interface TraceableExperimentLogEntry {
  experimentId: string;
  timestamp: string;
  group: ExperimentGroupType;
  rqId: ResearchQuestionId;
  hypothesisId: HypothesisId;
  datasetName: string;
  videoMetadata: {
    fileName: string;
    resolution: string;
    frameCount: number;
    fps: number;
    hasGroundTruth: boolean;
    hasCameraGroundTruth: boolean;
  };
  independentVariables: string[];
  dependentVariables: string[];
  controlledVariables: string[];
  expectedObservation: string;
  measuredRows: ResearchExperimentRow[];
  pairedStats?: PairedStatisticalTestResult[];
  hypothesisVerdict:
    | 'Supported by Empirical Data'
    | 'Partially Supported'
    | 'Refuted by Empirical Data'
    | 'Pending Ground Truth / Untested';
  conclusionVi: string;
  supportingCitations: string[];
  reproducibleConfigJson: {
    stabilizationMethod: StabilizationMethodId;
    backgroundMethod: BackgroundMethodId;
    stabilizationParams: StabilizationParams;
    frameDiffParams: FrameDiffParams;
    mog2Params: Mog2Params;
    sampleKnnParams: SampleKnnParams;
    morphologyConfig: MorphologyConfig;
  };
}
