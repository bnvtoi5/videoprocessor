export type SyntheticScenarioId =
  | 'shaky_camera'
  | 'moving_object'
  | 'illumination_change'
  | 'static_camera'
  | 'camera_translation'
  | 'camera_rotation'
  | 'combined_translation_rotation'
  | 'dynamic_background'
  | 'shadow_scene'
  | 'parallax_demo';

export interface VideoMetadata {
  fileName: string;
  fileSize: number; // bytes
  width: number;
  height: number;
  processingWidth: number;
  processingHeight: number;
  fps: number;
  samplingFps: number;
  duration: number; // seconds
  totalFrameCount: number;
  processedFrameLimit: number;
  codec: string;
  sourceType: 'upload' | 'synthetic';
  scenarioId?: SyntheticScenarioId;
  hasGroundTruth: boolean;
  hasCameraGroundTruth?: boolean;
  cdnetLabelCompatible?: boolean;
}

export interface RawFrameData {
  index: number;
  timestamp: number; // seconds
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
}

/**
 * CDnet 2014 Compatible Ground Truth Mask:
 * - 0: Background
 * - 50: Shadow
 * - 85: Outside ROI
 * - 170: Unknown / Motion Boundary
 * - 255: Foreground
 */
export interface GroundTruthMask {
  frameIndex: number;
  width: number;
  height: number;
  mask: Uint8Array; // 0, 50, 85, 170, 255
  backgroundMask?: Uint8Array; // 255 where true background (label 0 or 50), 0 elsewhere
  validityMask?: Uint8Array; // 255 = valid evaluation pixel, 0 = outside ROI (85), unknown (170), or warp border
  hasCdnetLabels?: boolean;
  objectPositions?: {
    id: number;
    cx: number;
    cy: number;
    vx: number;
    vy: number;
  }[];
}

export interface TrueCameraTransform {
  frameIndex: number;
  /** Cumulative camera displacement X from frame 0 (pixels) */
  dx: number;
  /** Cumulative camera displacement Y from frame 0 (pixels) */
  dy: number;
  /** Cumulative camera rotation angle from frame 0 (radians) */
  da: number;
  /** Scale factor (default 1.0) */
  scale?: number;
  /** Inter-frame step motion from frame t-1 to frame t */
  stepDx?: number;
  stepDy?: number;
  stepDa?: number;
  /** 2x3 affine transformation matrix [a, b, tx, c, d, ty] */
  matrix2x3?: [number, number, number, number, number, number];
}

export interface SyntheticGeneratorConfig {
  scenarioId: SyntheticScenarioId;
  width: number;
  height: number;
  fps: number;
  frameCount: number;
  translationAmplitudePx: number;
  rotationAmplitudeDeg: number;
  motionFrequencyHz: number;
  objectVelocityFactor: number;
  illuminationVariationLevel: number;
  backgroundComplexity: 'low' | 'medium' | 'high';
  noiseLevelSigma: number;
  includeCastShadows: boolean;
  includeOutsideRoiBorder: boolean;
}

export interface VideoInputConfig {
  maxFrames: number;
  maxWidth: number;
  targetFps: number;
  maxDurationSec: number;
}

export interface DecodedVideoSession {
  id: string;
  metadata: VideoMetadata;
  frames: RawFrameData[];
  groundTruthMasks: Map<number, GroundTruthMask>;
  trueTransforms?: TrueCameraTransform[];
  syntheticConfig?: SyntheticGeneratorConfig;
  createdAt: string;
}
