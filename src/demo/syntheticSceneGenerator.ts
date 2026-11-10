import {
  DecodedVideoSession,
  GroundTruthMask,
  RawFrameData,
  SyntheticGeneratorConfig,
  SyntheticScenarioId,
  TrueCameraTransform,
} from '../types/video';
import {
  generateSyntheticGroundTruthMask,
  MovingTargetSpec,
} from './groundTruthGenerator';

export interface SyntheticScenarioDefinition {
  id: SyntheticScenarioId;
  title: string;
  subtitle: string;
  description: string;
  primaryPurpose: string;
  recommendedModule: 'stabilization' | 'background' | 'benchmark';
  defaultFrames: number;
  width: number;
  height: number;
  fps: number;
  defaultConfig: SyntheticGeneratorConfig;
}

export const SYNTHETIC_SCENARIOS: SyntheticScenarioDefinition[] = [
  {
    id: 'shaky_camera',
    title: 'Scenario 1: Camera Jitter + Moving Object',
    subtitle: 'High-Frequency Hand-Shake Translation & Roll Jitter + Moving Target',
    description:
      'Simulates high-frequency camera shake (dx, dy, dθ) on a structured calibration background while a foreground target moves across the scene. Includes exact camera transform matrices and CDnet ground-truth masks.',
    primaryPurpose: 'Evaluate RQ1 (LK+RANSAC vs ECC), RQ3 (C1/C2/C3 Processing Order), and H4.',
    recommendedModule: 'stabilization',
    defaultFrames: 40,
    width: 320,
    height: 180,
    fps: 24,
    defaultConfig: {
      scenarioId: 'shaky_camera',
      width: 320,
      height: 180,
      fps: 24,
      frameCount: 40,
      translationAmplitudePx: 3.6,
      rotationAmplitudeDeg: 0.6,
      motionFrequencyHz: 1.8,
      objectVelocityFactor: 1.0,
      illuminationVariationLevel: 0,
      backgroundComplexity: 'high',
      noiseLevelSigma: 0,
      includeCastShadows: true,
      includeOutsideRoiBorder: false,
    },
  },
  {
    id: 'moving_object',
    title: 'Scenario 2: Moving Foreground Object (Multi-Object)',
    subtitle: 'Static Camera, Multi-Component Articulated Motion + CDnet GT',
    description:
      'Fixed camera overlooking a textured scene with two moving foreground objects crossing at different velocities and casting realistic shadows (CDnet label 50).',
    primaryPurpose: 'Benchmark RQ2 Segmentation IoU, Precision, Recall, F1, FPR, FNR, and PWC.',
    recommendedModule: 'background',
    defaultFrames: 40,
    width: 320,
    height: 180,
    fps: 24,
    defaultConfig: {
      scenarioId: 'moving_object',
      width: 320,
      height: 180,
      fps: 24,
      frameCount: 40,
      translationAmplitudePx: 0,
      rotationAmplitudeDeg: 0,
      motionFrequencyHz: 1.0,
      objectVelocityFactor: 1.0,
      illuminationVariationLevel: 0,
      backgroundComplexity: 'medium',
      noiseLevelSigma: 0,
      includeCastShadows: true,
      includeOutsideRoiBorder: false,
    },
  },
  {
    id: 'illumination_change',
    title: 'Scenario 3: Illumination Variation',
    subtitle: 'Gradual & Stepwise Ambient Lighting Drift + Moving Object',
    description:
      'Applies progressive ambient luminance drift (+45 intensity) and a mid-sequence lighting step to test adaptive background modeling (MOG2 & Sample KNN vs static Frame Differencing).',
    primaryPurpose: 'Test RQ2 & Hypothesis H3 under non-stationary illumination.',
    recommendedModule: 'benchmark',
    defaultFrames: 40,
    width: 320,
    height: 180,
    fps: 24,
    defaultConfig: {
      scenarioId: 'illumination_change',
      width: 320,
      height: 180,
      fps: 24,
      frameCount: 40,
      translationAmplitudePx: 0,
      rotationAmplitudeDeg: 0,
      motionFrequencyHz: 1.0,
      objectVelocityFactor: 1.0,
      illuminationVariationLevel: 45,
      backgroundComplexity: 'medium',
      noiseLevelSigma: 0,
      includeCastShadows: true,
      includeOutsideRoiBorder: false,
    },
  },
  {
    id: 'static_camera',
    title: 'Scenario 4: Static Camera Baseline',
    subtitle: 'Zero Camera Motion + Single Clean Moving Foreground Target',
    description:
      'Pure stationary camera control baseline with zero jitter and zero illumination drift for isolating pure segmentation accuracy.',
    primaryPurpose: 'Control baseline for Group B and Group D ablations.',
    recommendedModule: 'background',
    defaultFrames: 36,
    width: 320,
    height: 180,
    fps: 24,
    defaultConfig: {
      scenarioId: 'static_camera',
      width: 320,
      height: 180,
      fps: 24,
      frameCount: 36,
      translationAmplitudePx: 0,
      rotationAmplitudeDeg: 0,
      motionFrequencyHz: 0,
      objectVelocityFactor: 1.0,
      illuminationVariationLevel: 0,
      backgroundComplexity: 'medium',
      noiseLevelSigma: 0,
      includeCastShadows: false,
      includeOutsideRoiBorder: false,
    },
  },
  {
    id: 'camera_translation',
    title: 'Scenario 5: Pure Camera Translation',
    subtitle: 'Controlled Horizontal/Vertical Camera Pan + Translational Jitter',
    description:
      'Isolates 2D translational camera motion (dx, dy) with zero rotation (dθ = 0) for evaluating Translation RMSE against exact ground-truth matrices.',
    primaryPurpose: 'Evaluate Translation RMSE in Group A (RQ1 & H2).',
    recommendedModule: 'stabilization',
    defaultFrames: 36,
    width: 320,
    height: 180,
    fps: 24,
    defaultConfig: {
      scenarioId: 'camera_translation',
      width: 320,
      height: 180,
      fps: 24,
      frameCount: 36,
      translationAmplitudePx: 5.5,
      rotationAmplitudeDeg: 0,
      motionFrequencyHz: 1.8,
      objectVelocityFactor: 1.0,
      illuminationVariationLevel: 0,
      backgroundComplexity: 'high',
      noiseLevelSigma: 0,
      includeCastShadows: false,
      includeOutsideRoiBorder: false,
    },
  },
  {
    id: 'camera_rotation',
    title: 'Scenario 6: Pure Camera Roll Rotation',
    subtitle: 'Controlled In-Plane Angular Oscillation (dθ) Around Optical Center',
    description:
      'Isolates rotational camera roll oscillation with zero translation to evaluate Rotation RMSE (degrees) and angular trajectory smoothing.',
    primaryPurpose: 'Evaluate Rotation RMSE and angular smoothing in Group A & Group D.',
    recommendedModule: 'stabilization',
    defaultFrames: 36,
    width: 320,
    height: 180,
    fps: 24,
    defaultConfig: {
      scenarioId: 'camera_rotation',
      width: 320,
      height: 180,
      fps: 24,
      frameCount: 36,
      translationAmplitudePx: 0,
      rotationAmplitudeDeg: 1.8,
      motionFrequencyHz: 1.6,
      objectVelocityFactor: 1.0,
      illuminationVariationLevel: 0,
      backgroundComplexity: 'high',
      noiseLevelSigma: 0,
      includeCastShadows: false,
      includeOutsideRoiBorder: false,
    },
  },
  {
    id: 'combined_translation_rotation',
    title: 'Scenario 7: Combined Translation + Rotation',
    subtitle: 'Full Euclidean/Similarity Camera Motion + Moving Object',
    description:
      'Simultaneous large-amplitude 2D translation and roll rotation with moving foreground outliers to stress-test RANSAC inlier filtering vs ECC convergence.',
    primaryPurpose: 'Test RQ1 & H2 under coupled Euclidean camera motion.',
    recommendedModule: 'stabilization',
    defaultFrames: 36,
    width: 320,
    height: 180,
    fps: 24,
    defaultConfig: {
      scenarioId: 'combined_translation_rotation',
      width: 320,
      height: 180,
      fps: 24,
      frameCount: 36,
      translationAmplitudePx: 5.0,
      rotationAmplitudeDeg: 1.4,
      motionFrequencyHz: 2.0,
      objectVelocityFactor: 1.1,
      illuminationVariationLevel: 0,
      backgroundComplexity: 'high',
      noiseLevelSigma: 0,
      includeCastShadows: true,
      includeOutsideRoiBorder: false,
    },
  },
  {
    id: 'dynamic_background',
    title: 'Scenario 8: Dynamic Background (Oscillating Clutter)',
    subtitle: 'Repetitive Background Texture Oscillation + Foreground Object',
    description:
      'Simulates swaying/oscillating background elements (like foliage or ripples) that remain part of the background (label 0) while a true foreground object (label 255) moves across.',
    primaryPurpose: 'Test RQ2 & H3 multi-modal background adaptation (MOG2 & KNN vs Frame Diff).',
    recommendedModule: 'background',
    defaultFrames: 36,
    width: 320,
    height: 180,
    fps: 24,
    defaultConfig: {
      scenarioId: 'dynamic_background',
      width: 320,
      height: 180,
      fps: 24,
      frameCount: 36,
      translationAmplitudePx: 0,
      rotationAmplitudeDeg: 0,
      motionFrequencyHz: 2.5,
      objectVelocityFactor: 1.0,
      illuminationVariationLevel: 0,
      backgroundComplexity: 'high',
      noiseLevelSigma: 2,
      includeCastShadows: true,
      includeOutsideRoiBorder: false,
    },
  },
  {
    id: 'shadow_scene',
    title: 'Scenario 9: High-Contrast Cast Shadows (CDnet Label 50)',
    subtitle: 'Pronounced Moving Cast Shadows + CDnet ROI Border (Label 85)',
    description:
      'Generates strong moving shadows attached to foreground targets (annotated with CDnet label 50) and an outer ROI border (label 85) to test MOG2 shadow suppression (D6 ablation).',
    primaryPurpose: 'Evaluate Shadow Suppression (D6) and CDnet label compliance.',
    recommendedModule: 'background',
    defaultFrames: 36,
    width: 320,
    height: 180,
    fps: 24,
    defaultConfig: {
      scenarioId: 'shadow_scene',
      width: 320,
      height: 180,
      fps: 24,
      frameCount: 36,
      translationAmplitudePx: 0,
      rotationAmplitudeDeg: 0,
      motionFrequencyHz: 1.0,
      objectVelocityFactor: 1.0,
      illuminationVariationLevel: 0,
      backgroundComplexity: 'medium',
      noiseLevelSigma: 0,
      includeCastShadows: true,
      includeOutsideRoiBorder: true,
    },
  },
  {
    id: 'parallax_demo',
    title: 'Scenario 10: Multi-Depth Parallax Demonstration',
    subtitle: 'Non-Planar Depth Layers Under Camera Translation',
    description:
      'Simulates a near-field structural pillar moving at 1.5x camera displacement relative to the far-field background plane, illustrating why 2D global affine stabilization cannot fully cancel 3D parallax.',
    primaryPurpose: 'Illustrate 2D global motion limitation (Chapel & Bouwmans, 2021; Liu et al., 2013).',
    recommendedModule: 'benchmark',
    defaultFrames: 36,
    width: 320,
    height: 180,
    fps: 24,
    defaultConfig: {
      scenarioId: 'parallax_demo',
      width: 320,
      height: 180,
      fps: 24,
      frameCount: 36,
      translationAmplitudePx: 5.0,
      rotationAmplitudeDeg: 0.4,
      motionFrequencyHz: 1.5,
      objectVelocityFactor: 1.0,
      illuminationVariationLevel: 0,
      backgroundComplexity: 'high',
      noiseLevelSigma: 0,
      includeCastShadows: true,
      includeOutsideRoiBorder: false,
    },
  },
];

function sampleWorldBackgroundRgb(
  wx: number,
  wy: number,
  width: number,
  height: number,
  illuminationOffset = 0,
  complexity: 'low' | 'medium' | 'high' = 'high',
  dynamicWavePhase = 0
): [number, number, number] {
  const waveShift = dynamicWavePhase !== 0 ? 3.2 * Math.sin(wy * 0.25 + dynamicWavePhase) : 0;
  const sx = wx + waveShift;
  const sy = wy;

  // Base continuous spatial gradient + multi-scale 2D cosine field (provides smooth Ix, Iy everywhere for LK & ECC)
  const amp = complexity === 'low' ? 18 : complexity === 'medium' ? 34 : 46;
  const freq1 = complexity === 'low' ? 0.12 : 0.18;
  const freq2 = complexity === 'low' ? 0.06 : 0.095;

  const tex1 = Math.cos(sx * freq1) * Math.cos(sy * freq1);
  const tex2 = Math.sin(sx * freq2 + sy * freq2 * 0.8) * Math.cos(sx * freq2 * 0.7 - sy * freq2);
  const tex3 = Math.cos(sx * 0.31) * Math.sin(sy * 0.31);

  let r = Math.round(68 + (sx / width) * 18 + amp * (0.55 * tex1 + 0.3 * tex2 + 0.15 * tex3));
  let g = Math.round(82 + (sy / height) * 20 + amp * (0.55 * tex1 + 0.3 * tex2 - 0.15 * tex3));
  let b = Math.round(108 + ((sx + sy) / (width + height)) * 22 + amp * (0.6 * tex1 + 0.25 * tex2 + 0.15 * tex3));

  // Smooth cosine architectural grid lines (period = 24px) for strong 2D Shi-Tomasi corners
  const gridPeriod = complexity === 'low' ? 36 : 24;
  const gxCos = Math.cos((sx * 2 * Math.PI) / gridPeriod);
  const gyCos = Math.cos((sy * 2 * Math.PI) / gridPeriod);
  if (gxCos > 0.7 || gyCos > 0.7) {
    const boost = Math.round(28 * Math.max(0, (Math.max(gxCos, gyCos) - 0.7) / 0.3));
    r += boost;
    g += boost + 4;
    b += boost + 8;
  }

  if (illuminationOffset !== 0) {
    const spatialFactor = 0.7 + 0.6 * (wx / width);
    const delta = Math.round(illuminationOffset * spatialFactor);
    r += delta;
    g += delta;
    b += delta;
  }

  return [
    Math.max(0, Math.min(255, r)),
    Math.max(0, Math.min(255, g)),
    Math.max(0, Math.min(255, b)),
  ];
}

/**
 * Generates a complete DecodedVideoSession from a custom SyntheticGeneratorConfig
 * with exact RGB frames, CDnet-2014 Ground Truth masks, validity masks, and
 * camera transformation matrices.
 */
export function generateCustomSyntheticSession(
  config: SyntheticGeneratorConfig
): DecodedVideoSession {
  const {
    scenarioId,
    width,
    height,
    fps,
    frameCount: numFrames,
    translationAmplitudePx,
    rotationAmplitudeDeg,
    motionFrequencyHz,
    objectVelocityFactor,
    illuminationVariationLevel,
    backgroundComplexity,
    noiseLevelSigma,
    includeCastShadows,
    includeOutsideRoiBorder,
  } = config;

  const frames: RawFrameData[] = [];
  const groundTruthMasks = new Map<number, GroundTruthMask>();
  const trueTransforms: TrueCameraTransform[] = [];

  const centerX = width * 0.5;
  const centerY = height * 0.5;

  let prevCamDx = 0;
  let prevCamDy = 0;
  let prevCamDa = 0;

  for (let f = 0; f < numFrames; f++) {
    const t = f / Math.max(1, numFrames - 1);

    let camDx = 0;
    let camDy = 0;
    let camDa = 0;

    if (f > 0 && (translationAmplitudePx > 0 || rotationAmplitudeDeg > 0)) {
      const freq = Math.max(0.5, motionFrequencyHz);
      if (scenarioId === 'camera_translation') {
        camDx =
          translationAmplitudePx * Math.sin(t * Math.PI * 2) +
          0.6 * translationAmplitudePx * Math.sin(f * freq);
        camDy =
          0.7 * translationAmplitudePx * Math.cos(t * Math.PI * 2) +
          0.5 * translationAmplitudePx * Math.cos(f * freq * 1.2);
      } else if (scenarioId === 'camera_rotation') {
        camDa =
          ((rotationAmplitudeDeg * Math.sin(f * freq) +
            0.5 * rotationAmplitudeDeg * Math.cos(f * freq * 1.7)) *
            Math.PI) /
          180;
      } else if (scenarioId === 'shaky_camera') {
        // High-frequency zero-mean camera jitter around fixed optical axis (CDnet cameraJitter model)
        camDx =
          0.7 * translationAmplitudePx * Math.sin(f * freq) +
          0.3 * translationAmplitudePx * Math.sin(f * freq * 1.7);
        camDy =
          0.65 * translationAmplitudePx * Math.sin(f * (freq + 0.3)) +
          0.35 * translationAmplitudePx * Math.cos(f * freq * 1.9);
        camDa =
          (rotationAmplitudeDeg * Math.sin(f * (freq + 0.1)) * Math.PI) /
          180;
      } else {
        const smoothPanX = 0.6 * translationAmplitudePx * Math.sin(t * Math.PI);
        const smoothPanY = 0.4 * translationAmplitudePx * Math.sin(t * Math.PI * 2);
        const jitterX =
          0.65 * translationAmplitudePx * Math.sin(f * freq) +
          0.35 * translationAmplitudePx * Math.sin(f * freq * 1.7);
        const jitterY =
          0.55 * translationAmplitudePx * Math.sin(f * (freq + 0.3)) +
          0.3 * translationAmplitudePx * Math.sin(f * freq * 1.9);
        const jitterAngle =
          (rotationAmplitudeDeg * Math.sin(f * (freq + 0.1)) * Math.PI) / 180;

        camDx = smoothPanX + jitterX;
        camDy = smoothPanY + jitterY;
        camDa = jitterAngle;
      }
    }

    const stepDx = camDx - prevCamDx;
    const stepDy = camDy - prevCamDy;
    const stepDa = camDa - prevCamDa;
    prevCamDx = camDx;
    prevCamDy = camDy;
    prevCamDa = camDa;

    const cosM = Math.cos(camDa);
    const sinM = Math.sin(camDa);
    const matrix2x3: [number, number, number, number, number, number] = [
      cosM,
      -sinM,
      camDx,
      sinM,
      cosM,
      camDy,
    ];

    trueTransforms.push({
      frameIndex: f,
      dx: camDx,
      dy: camDy,
      da: camDa,
      scale: 1.0,
      stepDx,
      stepDy,
      stepDa,
      matrix2x3,
    });

    const targets: (MovingTargetSpec & { color: [number, number, number] })[] = [];

    if (f >= 2) {
      const v = Math.max(0.2, objectVelocityFactor);
      const prog = Math.min(1, t * v);
      const obj1X = width * (0.16 + 0.68 * prog);
      const obj1Y = height * (0.52 + 0.14 * Math.sin(prog * Math.PI * 2));
      const vx1 = (width * 0.68 * v) / Math.max(1, numFrames - 1);
      const vy1 =
        (height * 0.14 * Math.PI * 2 * Math.cos(prog * Math.PI * 2)) /
        Math.max(1, numFrames - 1);

      targets.push({
        id: 1,
        cx: obj1X,
        cy: obj1Y,
        rx: Math.max(15, Math.round(width * 0.08)),
        ry: Math.max(18, Math.round(height * 0.135)),
        vx: vx1,
        vy: vy1,
        shape: 'ellipse',
        color: [250, 155, 35],
      });

      if (scenarioId === 'moving_object' || scenarioId === 'shadow_scene') {
        const obj2X = width * (0.82 - 0.62 * prog);
        const obj2Y = height * 0.32;
        targets.push({
          id: 2,
          cx: obj2X,
          cy: obj2Y,
          rx: Math.max(10, Math.round(width * 0.05)),
          ry: Math.max(10, Math.round(height * 0.08)),
          vx: (-width * 0.62 * v) / Math.max(1, numFrames - 1),
          vy: 0,
          shape: 'rect',
          color: [6, 214, 160],
        });
      }
    }

    const illumOffset =
      illuminationVariationLevel > 0
        ? illuminationVariationLevel * Math.sin(t * Math.PI) +
          (f > numFrames * 0.5 ? illuminationVariationLevel * 0.35 : 0)
        : 0;

    const dynamicPhase = scenarioId === 'dynamic_background' ? f * 0.9 : 0;

    const rgba = new Uint8ClampedArray(width * height * 4);
    const cosA = Math.cos(-camDa);
    const sinA = Math.sin(-camDa);

    // Simple deterministic LCG for optional sensor noise
    let noiseSeed = (f + 1) * 9876543;

    for (let y = 0; y < height; y++) {
      const row = y * width;
      for (let x = 0; x < width; x++) {
        const dx = x - centerX - camDx;
        const dy = y - centerY - camDy;
        const wx = cosA * dx - sinA * dy + centerX;
        const wy = sinA * dx + cosA * dy + centerY;

        let [r, g, b] = sampleWorldBackgroundRgb(
          wx,
          wy,
          width,
          height,
          illumOffset,
          backgroundComplexity,
          dynamicPhase
        );

        // Near-field parallax pillar for Scenario 10 (moves at 1.55x camera shift)
        if (scenarioId === 'parallax_demo') {
          const px = x - centerX - camDx * 1.55;
          const pwx = cosA * px - sinA * dy + centerX;
          if (Math.abs(pwx - width * 0.48) < 14 && wy > height * 0.15 && wy < height * 0.85) {
            r = 95;
            g = 115;
            b = 145;
          }
        }

        const shadowAttenuation = scenarioId === 'shadow_scene' ? 0.45 : 0.62;

        for (const tgt of targets) {
          if (includeCastShadows) {
            const sx = (wx - (tgt.cx + 7)) / (tgt.rx * 1.05);
            const sy = (wy - (tgt.cy + 7)) / (tgt.ry * 1.05);
            if (sx * sx + sy * sy <= 1.0) {
              r = Math.round(r * shadowAttenuation);
              g = Math.round(g * shadowAttenuation);
              b = Math.round(b * shadowAttenuation);
            }
          }

          let inObj = false;
          if (tgt.shape === 'ellipse') {
            const nx = (wx - tgt.cx) / tgt.rx;
            const ny = (wy - tgt.cy) / tgt.ry;
            if (nx * nx + ny * ny <= 1.0) inObj = true;
          } else {
            if (Math.abs(wx - tgt.cx) <= tgt.rx && Math.abs(wy - tgt.cy) <= tgt.ry) {
              inObj = true;
            }
          }

          if (inObj) {
            const stripe =
              ((Math.floor(wx - tgt.cx) + Math.floor(wy - tgt.cy)) & 4) !== 0
                ? 15
                : -10;
            r = Math.max(0, Math.min(255, tgt.color[0] + stripe));
            g = Math.max(0, Math.min(255, tgt.color[1] + stripe));
            b = Math.max(0, Math.min(255, tgt.color[2] + stripe));
          }
        }

        if (noiseLevelSigma > 0) {
          noiseSeed = (noiseSeed * 1664525 + 1013904223) >>> 0;
          const nDelta =
            (((noiseSeed & 0xff) / 255 - 0.5) * 2 * noiseLevelSigma) | 0;
          r = Math.max(0, Math.min(255, r + nDelta));
          g = Math.max(0, Math.min(255, g + nDelta));
          b = Math.max(0, Math.min(255, b + nDelta));
        }

        const idx = (row + x) << 2;
        rgba[idx] = r;
        rgba[idx + 1] = g;
        rgba[idx + 2] = b;
        rgba[idx + 3] = 255;
      }
    }

    frames.push({
      index: f,
      timestamp: f / fps,
      width,
      height,
      rgba,
    });

    const gt = generateSyntheticGroundTruthMask(
      f,
      width,
      height,
      targets,
      camDx,
      camDy,
      camDa,
      {
        includeCastShadows,
        includeOutsideRoiBorder,
        includeUnknownBoundary: false,
      }
    );
    groundTruthMasks.set(f, gt);
  }

  return {
    id: `SYN-${scenarioId.toUpperCase()}-${Date.now().toString(36)}`,
    metadata: {
      fileName: `synthetic_${scenarioId}_${width}x${height}.mp4`,
      fileSize: width * height * 4 * numFrames,
      width,
      height,
      processingWidth: width,
      processingHeight: height,
      fps,
      samplingFps: fps,
      duration: numFrames / fps,
      totalFrameCount: numFrames,
      processedFrameLimit: numFrames,
      codec: 'Synthetic Controlled Dataset + CDnet-2014 & Camera Motion GT',
      sourceType: 'synthetic',
      scenarioId,
      hasGroundTruth: true,
      hasCameraGroundTruth: true,
      cdnetLabelCompatible: true,
    },
    frames,
    groundTruthMasks,
    trueTransforms,
    syntheticConfig: config,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Generates a complete DecodedVideoSession for any preset scenario ID.
 */
export function generateSyntheticSession(
  scenarioId: SyntheticScenarioId,
  customFrameCount?: number,
  customWidth?: number
): DecodedVideoSession {
  const spec =
    SYNTHETIC_SCENARIOS.find((s) => s.id === scenarioId) ?? SYNTHETIC_SCENARIOS[0];

  const width = customWidth ?? spec.width;
  const height = Math.round((width * 9) / 16);
  const frameCount = customFrameCount ?? spec.defaultFrames;

  return generateCustomSyntheticSession({
    ...spec.defaultConfig,
    scenarioId,
    width,
    height,
    frameCount,
  });
}
