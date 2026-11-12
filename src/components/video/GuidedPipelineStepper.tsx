import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Code2,
  Cpu,
  Layers,
  RefreshCw,
  Sliders,
} from 'lucide-react';
import { getCachedOpenCv } from '../../core/openCvLoader';
import { DecodedVideoSession } from '../../types/video';
import {
  BackgroundMethodId,
  BackgroundRunResult,
  ForegroundDisplayConfig,
  FrameDiffParams,
  Mog2Params,
  MorphologyConfig,
  SampleKnnParams,
  StabilizationParams,
  StabilizationRunResult,
  TrackedFeaturePoint,
} from '../../types/algorithm';
import { rgbaToGrayscale } from '../../algorithms/stabilization/opticalFlow';
import { runStabilizationPipeline } from '../../algorithms/stabilization/stabilizationPipeline';
import {
  maskToRgba,
  runBackgroundPipeline,
} from '../../algorithms/background/foregroundExtraction';
import { computeRemeasuredOutputJitterRms } from '../../evaluation/stabilizationMetrics';
import { FrameCanvas } from './FrameCanvas';

export interface GuidedPipelineStepperProps {
  session: DecodedVideoSession;
  stabilizationParams: StabilizationParams;
  selectedBgMethod: BackgroundMethodId;
  frameDiffParams: FrameDiffParams;
  mog2Params: Mog2Params;
  sampleKnnParams: SampleKnnParams;
  morphologyConfig: MorphologyConfig;
  displayConfig: ForegroundDisplayConfig;
}

interface PipelineStageSpec {
  stepNumber: number;
  id: string;
  title: string;
  category: 'Stabilization (Branch A)' | 'Background Separation (Branch B)';
  inputSignal: string;
  mathOperation: string;
  sourceFile: string;
  sourceFunction: string;
  description: string;
}

const PIPELINE_STAGE_SPECS: PipelineStageSpec[] = [
  {
    stepNumber: 1,
    id: 'original_frame',
    title: '1. Original Frame Input',
    category: 'Stabilization (Branch A)',
    inputSignal: 'Decoded HTML5 Video Frame Tensor I_RGBA(x, y, t) ∈ [0, 255]^{W×H×4}',
    mathOperation: 'I(x, y, t) = [R(x,y,t), G(x,y,t), B(x,y,t), 255]^T',
    sourceFile: 'src/core/videoDecoder.ts',
    sourceFunction: 'decodeUploadedVideoFile() / generateSyntheticSession()',
    description:
      'Raw unstabilized video frame sampled at fixed temporal step Δt = 1/FPS. Contains both true scene object motion and unwanted camera shake.',
  },
  {
    stepNumber: 2,
    id: 'grayscale_frame',
    title: '2. Luminance Grayscale Conversion',
    category: 'Stabilization (Branch A)',
    inputSignal: 'RGBA Frame I_RGBA(x, y, t) (4 channels, 8-bit)',
    mathOperation: 'Y(x, y, t) = round(0.299·R(x,y,t) + 0.587·G(x,y,t) + 0.114·B(x,y,t))',
    sourceFile: 'src/algorithms/stabilization/opticalFlow.ts',
    sourceFunction: 'rgbaToGrayscale(rgba, width, height)',
    description:
      'Projects 3-channel RGB color onto ITU-R BT.601 luminance space Y ∈ [0, 255] required for spatial gradient and structure tensor computation.',
  },
  {
    stepNumber: 3,
    id: 'shi_tomasi',
    title: '3. Shi–Tomasi Corner Feature Detection',
    category: 'Stabilization (Branch A)',
    inputSignal: 'Previous Grayscale Frame Y(x, y, t-1)',
    mathOperation:
      'M = ∑_{w} [I_x²  I_x I_y ; I_x I_y  I_y²],  Corner Response R = min(λ_1, λ_2) > τ_q · max(R)',
    sourceFile: 'src/algorithms/stabilization/opticalFlow.ts',
    sourceFunction: 'detectAndTrackOpticalFlow() / cv.goodFeaturesToTrack()',
    description:
      'Selects salient 2D corner landmarks with strong orthogonal spatial gradients so optical flow equations are well-conditioned (avoiding aperture ambiguity).',
  },
  {
    stepNumber: 4,
    id: 'optical_flow',
    title: '4. Pyramidal Lucas–Kanade Optical Flow',
    category: 'Stabilization (Branch A)',
    inputSignal: 'Corner set P(t-1) = {p_i} on Y(t-1) and current frame Y(t)',
    mathOperation:
      'u* = argmin_u ∑_{x ∈ W(p_i)} [Y(x + u, t) - Y(x, t-1)]²  ⇒  u = (A^T A)^{-1} A^T b',
    sourceFile: 'src/algorithms/stabilization/opticalFlow.ts',
    sourceFunction: 'detectAndTrackOpticalFlow() / cv.calcOpticalFlowPyrLK()',
    description:
      'Tracks displacement vectors u_i = p_i(t) - p_i(t-1) across coarse-to-fine Gaussian pyramid levels.',
  },
  {
    stepNumber: 5,
    id: 'ransac_inliers',
    title: '5. 2D Similarity RANSAC Inliers vs. Outliers',
    category: 'Stabilization (Branch A)',
    inputSignal: 'Matched point correspondences {(p_i(t-1), p_i(t))}_{i=1..N}',
    mathOperation:
      'Inlier(i) = 1 if || T_sim(dx, dy, dθ, s)·p_i(t-1) - p_i(t) ||_2 ≤ ε_ransac else 0',
    sourceFile: 'src/algorithms/stabilization/ransac.ts',
    sourceFunction: 'estimateSimilarityTransformRansac()',
    description:
      'Separates background camera motion (green inliers) from independently moving foreground objects or tracking errors (orange/red outliers).',
  },
  {
    stepNumber: 6,
    id: 'trajectory_smoothing',
    title: '6. Raw vs. Smoothed Camera Trajectory',
    category: 'Stabilization (Branch A)',
    inputSignal: 'Inter-frame step transforms (Δx_t, Δy_t, Δθ_t)',
    mathOperation:
      'P(t) = ∑_{k=1}^t ΔT(k),   S(t) = ∑_{k=-R}^R K(k) · P(t+k)  (Gaussian or Boxcar)',
    sourceFile: 'src/algorithms/stabilization/trajectory.ts',
    sourceFunction: 'computeSmoothedTrajectory() / gaussianSmooth1D() / movingAverageSmooth1D()',
    description:
      'Accumulates cumulative camera trajectory P(t) and applies a temporal low-pass filter of radius R to remove high-frequency hand jitter while preserving intentional panning.',
  },
  {
    stepNumber: 7,
    id: 'corrective_warp',
    title: '7. Corrective Geometric Warp Field',
    category: 'Stabilization (Branch A)',
    inputSignal: 'Trajectory residual ΔP(t) = S(t) - P(t) = (corrDx_t, corrDy_t, corrDa_t)',
    mathOperation:
      'M_corr(t) = [ cos(δθ)  -sin(δθ)  δx ; sin(δθ)  cos(δθ)  δy ] · Scale(1 / (1 - cropRatio))',
    sourceFile: 'src/algorithms/stabilization/stabilizationPipeline.ts',
    sourceFunction: 'warpFrameAffineRgba()',
    description:
      'Constructs the inverse 2×3 affine corrective matrix and applies uniform border zoom (cropRatio) to eliminate undefined boundary wedges.',
  },
  {
    stepNumber: 8,
    id: 'stabilized_frame',
    title: '8. Motion-Compensated Stabilized Frame',
    category: 'Stabilization (Branch A)',
    inputSignal: 'Original Frame I(x, y, t) and corrective matrix M_corr(t)',
    mathOperation: 'I_stab(x, y, t) = BilinearSample(I(t), M_corr(t)^{-1} · [x, y, 1]^T)',
    sourceFile: 'src/algorithms/stabilization/stabilizationPipeline.ts',
    sourceFunction: 'runStabilizationPipeline() + computeRemeasuredOutputJitterRms()',
    description:
      'Produces the stabilized output sequence where background pixel coordinates remain stationary across frames, ready for downstream background modeling.',
  },
  {
    stepNumber: 9,
    id: 'background_model',
    title: '9. Adaptive Spatiotemporal Background Model',
    category: 'Background Separation (Branch B)',
    inputSignal: 'Stabilized Sequence I_stab(x, y, 0..t)',
    mathOperation:
      'P(I_t) = ∑_{k=1}^K w_{k,t} · N(I_t; μ_{k,t}, σ_{k,t}² I),  μ_{k,t} = (1-α)μ_{k,t-1} + α I_t',
    sourceFile: 'src/algorithms/background/mog2.ts',
    sourceFunction: 'runMog2Sequence() / runFrameDifferencingSequence() / runSampleKnnSequence()',
    description:
      'Maintains a per-pixel statistical model of the stationary scene background B(x, y, t) while excluding moving foreground objects.',
  },
  {
    stepNumber: 10,
    id: 'raw_fg_mask',
    title: '10. Raw Binary Foreground Mask (Pre-Morphology)',
    category: 'Background Separation (Branch B)',
    inputSignal: 'Stabilized Frame I_stab(x, y, t) vs. Background Model B(x, y, t)',
    mathOperation:
      'M_raw(x,y,t) = 255 if d_Mahalanobis²(I_stab(x,y,t), B_k) > T_var (and ≠ shadow 127) else 0',
    sourceFile: 'src/algorithms/background/mog2.ts',
    sourceFunction: 'runMog2Sequence()',
    description:
      'Initial pixel-level foreground classification before spatial filtering; typically contains isolated salt-and-pepper sensor noise and small interior holes.',
  },
  {
    stepNumber: 11,
    id: 'morphology_stages',
    title: '11. Morphological Spatial Filtering (Blur → Threshold → Opening → Closing)',
    category: 'Background Separation (Branch B)',
    inputSignal: 'Raw Foreground Mask M_raw(x, y, t)',
    mathOperation:
      'M_open = (M_blur ⊖ K_o) ⊕ K_o,   M_close = (M_open ⊕ K_c) ⊖ K_c',
    sourceFile: 'src/algorithms/background/morphology.ts',
    sourceFunction: 'applyMorphologyPipeline()',
    description:
      'Applies 3×3 Gaussian smoothing + re-thresholding, Morphological Opening to erase isolated false-positive speckles, and Closing to bridge fragmented object holes.',
  },
  {
    stepNumber: 12,
    id: 'connected_components',
    title: '12. Connected Components & Final Foreground Extraction',
    category: 'Background Separation (Branch B)',
    inputSignal: 'Morphologically filtered mask M_close(x, y, t)',
    mathOperation:
      'M_final(x,y) = 255 if (x,y) ∈ C_k and Area(C_k) ≥ A_min;  BBox(C_k) = [x_min, y_min, w, h]',
    sourceFile: 'src/algorithms/background/morphology.ts',
    sourceFunction: 'applyMorphologyPipeline() + countConnectedComponentsRaw()',
    description:
      'Executes 8-connectivity flood-fill labeling, removes regions smaller than minComponentArea, records pre/post component counts, and extracts final object bounding boxes.',
  },
];

function grayscaleToRgba(gray: Uint8Array, width: number, height: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const v = gray[i];
    const idx = i * 4;
    out[idx] = v;
    out[idx + 1] = v;
    out[idx + 2] = v;
    out[idx + 3] = 255;
  }
  return out;
}

function renderWarpGridPreviewRgba(
  stabilizedRgba: Uint8ClampedArray,
  dx: number,
  dy: number,
  da: number,
  width: number,
  height: number
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(stabilizedRgba);
  const step = 24;
  const cosA = Math.cos(da);
  const sinA = Math.sin(da);
  const cx = width / 2;
  const cy = height / 2;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const rx = cosA * (x - cx) - sinA * (y - cy) + cx + dx;
      const ry = sinA * (x - cx) + cosA * (y - cy) + cy + dy;
      const gx = Math.abs(Math.round(rx) % step);
      const gy = Math.abs(Math.round(ry) % step);
      if (gx === 0 || gy === 0) {
        const idx = (y * width + x) * 4;
        out[idx] = Math.round(out[idx] * 0.5 + 37 * 0.5);
        out[idx + 1] = Math.round(out[idx + 1] * 0.5 + 99 * 0.5);
        out[idx + 2] = Math.round(out[idx + 2] * 0.5 + 235 * 0.5);
      }
    }
  }
  return out;
}

export const GuidedPipelineStepper: React.FC<GuidedPipelineStepperProps> = ({
  session,
  stabilizationParams,
  selectedBgMethod,
  frameDiffParams,
  mog2Params,
  sampleKnnParams,
  morphologyConfig,
  displayConfig,
}) => {
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [frameIndex, setFrameIndex] = useState<number>(() =>
    Math.min(14, Math.max(1, Math.floor(session.frames.length / 2)))
  );
  const [isComputing, setIsComputing] = useState<boolean>(false);
  const [stabResult, setStabResult] = useState<StabilizationRunResult | null>(null);
  const [remeasuredJitter, setRemeasuredJitter] = useState<number>(0);
  const [bgResult, setBgResult] = useState<BackgroundRunResult | null>(null);

  const totalFrames = session.frames.length;
  const safeFrameIdx = Math.min(Math.max(1, frameIndex), Math.max(1, totalFrames - 1));
  const width = session.metadata.processingWidth;
  const height = session.metadata.processingHeight;

  const runLivePipelineInspection = () => {
    if (session.frames.length === 0) return;
    setIsComputing(true);
    setTimeout(() => {
      try {
        const { cv } = getCachedOpenCv();
        const stab = runStabilizationPipeline(
          cv,
          session.frames,
          'lk_ransac',
          stabilizationParams
        );
        const remeasured = computeRemeasuredOutputJitterRms(
          cv,
          stab.stabilizedFrames,
          width,
          height,
          stabilizationParams
        );
        const stabilizedFramesList = session.frames.map((f, idx) => ({
          ...f,
          rgba: stab.stabilizedFrames[idx] ?? f.rgba,
        }));
        const bg = runBackgroundPipeline(
          cv,
          stabilizedFramesList,
          selectedBgMethod,
          frameDiffParams,
          mog2Params,
          sampleKnnParams,
          true,
          morphologyConfig,
          displayConfig,
          session.groundTruthMasks
        );
        setStabResult(stab);
        setRemeasuredJitter(remeasured);
        setBgResult(bg);
      } finally {
        setIsComputing(false);
      }
    }, 10);
  };

  useEffect(() => {
    runLivePipelineInspection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    session.id,
    selectedBgMethod,
    stabilizationParams.smoothingRadius,
    stabilizationParams.trajectoryMode,
    morphologyConfig.minComponentArea,
  ]);

  const currentStage = PIPELINE_STAGE_SPECS[activeStepIndex];

  const stageArtifacts = useMemo(() => {
    const origFrame = session.frames[safeFrameIdx]?.rgba;
    if (!origFrame) return null;

    const grayBytes = rgbaToGrayscale(origFrame, width, height);
    const grayRgba = grayscaleToRgba(grayBytes, width, height);

    const features: TrackedFeaturePoint[] =
      stabResult?.trackedFeaturesPerFrame[safeFrameIdx] ?? [];
    const trajPt = stabResult?.trajectories[safeFrameIdx];
    const transformPt = stabResult?.transforms[safeFrameIdx];
    const stabRgba = stabResult?.stabilizedFrames[safeFrameIdx] ?? origFrame;

    const corrDx = trajPt?.corrDx ?? 0;
    const corrDy = trajPt?.corrDy ?? 0;
    const corrDa = trajPt?.corrDa ?? 0;
    const warpGridRgba = renderWarpGridPreviewRgba(
      stabRgba,
      corrDx,
      corrDy,
      corrDa,
      width,
      height
    );

    const bgModelRgba = bgResult?.backgroundOnlyFrames[safeFrameIdx] ?? stabRgba;
    const rawMask = bgResult?.binaryMasks[safeFrameIdx];
    const cleanedMask = bgResult?.cleanedMasks[safeFrameIdx];
    const rawMaskRgba = rawMask ? maskToRgba(rawMask, width, height) : grayRgba;
    const cleanedMaskRgba = cleanedMask ? maskToRgba(cleanedMask, width, height) : grayRgba;
    const finalOverlayRgba = bgResult?.overlayFrames[safeFrameIdx] ?? stabRgba;
    const boxes = bgResult?.boundingBoxesPerFrame[safeFrameIdx] ?? [];
    const frameMetric = bgResult?.frameMetrics[safeFrameIdx];

    const inliersCount = features.filter((pt) => pt.isInlier).length;
    const outliersCount = Math.max(0, features.length - inliersCount);

    return {
      origFrame,
      grayRgba,
      features,
      inliersCount,
      outliersCount,
      trajPt,
      transformPt,
      corrDx,
      corrDy,
      corrDa,
      warpGridRgba,
      stabRgba,
      bgModelRgba,
      rawMaskRgba,
      cleanedMaskRgba,
      finalOverlayRgba,
      boxes,
      frameMetric,
    };
  }, [session, safeFrameIdx, width, height, stabResult, bgResult]);

  const getStageCanvasConfig = () => {
    if (!stageArtifacts) return null;
    switch (currentStage.id) {
      case 'original_frame':
        return {
          rgba: stageArtifacts.origFrame,
          title: `Stage 01 · Original Input Frame #${safeFrameIdx}`,
          subtitle: `${width}×${height} RGBA · Source: ${session.metadata.fileName}`,
          trackedFeatures: undefined,
          showInliers: false,
          showOutliers: false,
          showMotionVectors: false,
          boxes: undefined,
        };
      case 'grayscale_frame':
        return {
          rgba: stageArtifacts.grayRgba,
          title: `Stage 02 · ITU-R BT.601 Luminance Frame #${safeFrameIdx}`,
          subtitle: `8-bit Single-Channel Grayscale Y ∈ [0, 255]`,
          trackedFeatures: undefined,
          showInliers: false,
          showOutliers: false,
          showMotionVectors: false,
          boxes: undefined,
        };
      case 'shi_tomasi':
        return {
          rgba: stageArtifacts.grayRgba,
          title: `Stage 03 · Detected Shi–Tomasi Corner Landmarks`,
          subtitle: `${stageArtifacts.features.length} features detected (maxCorners=${stabilizationParams.maxCorners}, quality=${stabilizationParams.qualityLevel})`,
          trackedFeatures: stageArtifacts.features,
          showInliers: true,
          showOutliers: true,
          showMotionVectors: false,
          boxes: undefined,
        };
      case 'optical_flow':
        return {
          rgba: stageArtifacts.grayRgba,
          title: `Stage 04 · Pyramidal Lucas–Kanade Optical Flow Vectors`,
          subtitle: `${stageArtifacts.features.length} displacement vectors tracked between Frame #${safeFrameIdx - 1} and #${safeFrameIdx}`,
          trackedFeatures: stageArtifacts.features,
          showInliers: true,
          showOutliers: true,
          showMotionVectors: true,
          boxes: undefined,
        };
      case 'ransac_inliers':
        return {
          rgba: stageArtifacts.origFrame,
          title: `Stage 05 · 2D Similarity RANSAC Consensus Classification`,
          subtitle: `Green Inliers = ${stageArtifacts.inliersCount} (Camera BG) · Orange Outliers = ${stageArtifacts.outliersCount} (Moving FG / Noise)`,
          trackedFeatures: stageArtifacts.features,
          showInliers: true,
          showOutliers: true,
          showMotionVectors: true,
          boxes: undefined,
        };
      case 'trajectory_smoothing':
        return {
          rgba: stageArtifacts.stabRgba,
          title: `Stage 06 · Cumulative Trajectory Filtering (${(stabilizationParams.trajectoryMode ?? 'gaussian_smooth').toUpperCase()}, R=${stabilizationParams.smoothingRadius})`,
          subtitle: `Raw (x=${(stageArtifacts.trajPt?.rawX ?? 0).toFixed(2)}px, y=${(stageArtifacts.trajPt?.rawY ?? 0).toFixed(2)}px) → Smoothed (x=${(stageArtifacts.trajPt?.smoothX ?? 0).toFixed(2)}px, y=${(stageArtifacts.trajPt?.smoothY ?? 0).toFixed(2)}px)`,
          trackedFeatures: undefined,
          showInliers: false,
          showOutliers: false,
          showMotionVectors: false,
          boxes: undefined,
        };
      case 'corrective_warp':
        return {
          rgba: stageArtifacts.warpGridRgba,
          title: `Stage 07 · Corrective Affine Warp Field + Border Zoom (${Math.round(stabilizationParams.cropRatio * 100)}%)`,
          subtitle: `Corrective Δx=${stageArtifacts.corrDx.toFixed(2)}px, Δy=${stageArtifacts.corrDy.toFixed(2)}px, Δθ=${((stageArtifacts.corrDa * 180) / Math.PI).toFixed(2)}°`,
          trackedFeatures: undefined,
          showInliers: false,
          showOutliers: false,
          showMotionVectors: false,
          boxes: undefined,
        };
      case 'stabilized_frame':
        return {
          rgba: stageArtifacts.stabRgba,
          title: `Stage 08 · Motion-Compensated Stabilized Frame #${safeFrameIdx}`,
          subtitle: `Raw Jitter=${(stabResult?.rawTranslationJitterRms ?? 0).toFixed(3)}px → Re-measured Output Jitter=${remeasuredJitter.toFixed(3)}px`,
          trackedFeatures: undefined,
          showInliers: false,
          showOutliers: false,
          showMotionVectors: false,
          boxes: undefined,
        };
      case 'background_model':
        return {
          rgba: stageArtifacts.bgModelRgba,
          title: `Stage 09 · Reconstructed Background Model (${selectedBgMethod.toUpperCase()})`,
          subtitle: `Stationary scene representation B(x, y, t) learned over stabilized coordinates`,
          trackedFeatures: undefined,
          showInliers: false,
          showOutliers: false,
          showMotionVectors: false,
          boxes: undefined,
        };
      case 'raw_fg_mask':
        return {
          rgba: stageArtifacts.rawMaskRgba,
          title: `Stage 10 · Raw Foreground Binary Mask M_raw(x, y, t)`,
          subtitle: `Pre-Morphology Connected Components = ${stageArtifacts.frameMetric?.rawComponentCount ?? 0}`,
          trackedFeatures: undefined,
          showInliers: false,
          showOutliers: false,
          showMotionVectors: false,
          boxes: undefined,
        };
      case 'morphology_stages':
        return {
          rgba: stageArtifacts.cleanedMaskRgba,
          title: `Stage 11 · Morphologically Filtered Mask (Blur 3×3 → Open ${morphologyConfig.openingKernelSize}×${morphologyConfig.openingKernelSize} → Close ${morphologyConfig.closingKernelSize}×${morphologyConfig.closingKernelSize})`,
          subtitle: `Components reduced from ${stageArtifacts.frameMetric?.rawComponentCount ?? 0} (raw) to ${stageArtifacts.boxes.length} (cleaned)`,
          trackedFeatures: undefined,
          showInliers: false,
          showOutliers: false,
          showMotionVectors: false,
          boxes: undefined,
        };
      case 'connected_components':
      default:
        return {
          rgba: stageArtifacts.finalOverlayRgba,
          title: `Stage 12 · Connected Components & Bounding Boxes (Area ≥ ${morphologyConfig.minComponentArea}px²)`,
          subtitle: `${stageArtifacts.boxes.length} validated foreground objects · FG Ratio = ${((stageArtifacts.frameMetric?.foregroundRatio ?? 0) * 100).toFixed(2)}%`,
          trackedFeatures: undefined,
          showInliers: false,
          showOutliers: false,
          showMotionVectors: false,
          boxes: stageArtifacts.boxes,
        };
    }
  };

  const canvasConfig = getStageCanvasConfig();

  return (
    <div
      data-testid="guided-pipeline-stepper"
      className="bg-white border border-slate-200 shadow-xs p-5 space-y-5"
    >
      {/* Top Presentation Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-blue-700 uppercase">
            <Layers className="w-4 h-4" />
            <span>SECTION 8 · GUIDED STEP-BY-STEP PIPELINE PRESENTATION MODE (12 STAGES)</span>
          </div>
          <h2 className="text-base font-bold text-slate-900 mt-0.5">
            Interactive Spatiotemporal Signal Processing Walkthrough ({session.metadata.fileName})
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Step through every intermediate DSP transformation from raw video frame to stabilized foreground extraction with live telemetry, mathematical formulas, and source code mapping.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isComputing}
            onClick={runLivePipelineInspection}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isComputing ? 'animate-spin' : ''}`} />
            <span>{isComputing ? 'Recomputing Stages...' : 'Recompute All 12 Stages'}</span>
          </button>
        </div>
      </div>

      {/* 12-Stage Horizontal Progress Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-1.5">
        {PIPELINE_STAGE_SPECS.map((stage, idx) => {
          const isActive = idx === activeStepIndex;
          const isStab = stage.stepNumber <= 8;
          return (
            <button
              key={stage.id}
              type="button"
              data-testid={`pipeline-step-btn-${stage.stepNumber}`}
              onClick={() => setActiveStepIndex(idx)}
              className={`p-2 text-left border transition-colors cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white border-blue-700 font-semibold'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className={isActive ? 'text-blue-100' : isStab ? 'text-blue-700' : 'text-emerald-700'}>
                  STAGE {String(stage.stepNumber).padStart(2, '0')}
                </span>
                <span>{isStab ? 'STAB' : 'BGS'}</span>
              </div>
              <div className="text-xs truncate mt-0.5">{stage.title.replace(/^\d+\.\s*/, '')}</div>
            </button>
          );
        })}
      </div>

      {/* Stepper Navigation + Frame Scrubber Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 border border-slate-200 p-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={activeStepIndex === 0}
            onClick={() => setActiveStepIndex((p) => Math.max(0, p - 1))}
            className="px-3 py-1.5 bg-white hover:bg-slate-100 disabled:opacity-40 border border-slate-300 text-slate-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Prev Stage</span>
          </button>
          <span className="px-3 py-1 bg-blue-50 border border-blue-200 text-blue-900 text-xs font-mono font-bold">
            Stage {currentStage.stepNumber} / 12 · {currentStage.category}
          </span>
          <button
            type="button"
            disabled={activeStepIndex === PIPELINE_STAGE_SPECS.length - 1}
            onClick={() =>
              setActiveStepIndex((p) => Math.min(PIPELINE_STAGE_SPECS.length - 1, p + 1))
            }
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
          >
            <span>Next Stage</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-700">Inspect Frame Index:</span>
          <input
            type="range"
            min={1}
            max={Math.max(1, totalFrames - 1)}
            value={safeFrameIdx}
            onChange={(e) => setFrameIndex(Number(e.target.value))}
            className="w-40 accent-blue-600 cursor-pointer"
          />
          <span className="text-xs font-mono font-bold text-slate-900 tabular-nums">
            Frame #{safeFrameIdx} / {totalFrames - 1}
          </span>
        </div>
      </div>

      {/* Main Split View: Left = Visual Stage Output + Comparison, Right = Technical Spec Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-7 space-y-4">
          {canvasConfig && (
            <FrameCanvas
              rgba={canvasConfig.rgba}
              width={width}
              height={height}
              title={canvasConfig.title}
              subtitle={canvasConfig.subtitle}
              trackedFeatures={canvasConfig.trackedFeatures}
              showInliers={canvasConfig.showInliers}
              showOutliers={canvasConfig.showOutliers}
              showMotionVectors={canvasConfig.showMotionVectors}
              boundingBoxes={canvasConfig.boxes}
              showBoundingBoxes={Boolean(canvasConfig.boxes)}
              testId="guided-stage-primary-canvas"
            />
          )}

          {/* Reference Comparison Strip */}
          {stageArtifacts && (
            <div className="grid grid-cols-2 gap-3">
              <FrameCanvas
                rgba={stageArtifacts.origFrame}
                width={width}
                height={height}
                title={`Reference: Original Frame #${safeFrameIdx}`}
                subtitle="Unprocessed input frame"
              />
              <FrameCanvas
                rgba={
                  currentStage.stepNumber <= 8
                    ? stageArtifacts.stabRgba
                    : stageArtifacts.cleanedMaskRgba
                }
                width={width}
                height={height}
                title={
                  currentStage.stepNumber <= 8
                    ? `Stabilized Output Frame #${safeFrameIdx}`
                    : `Cleaned Foreground Mask #${safeFrameIdx}`
                }
                subtitle={
                  currentStage.stepNumber <= 8
                    ? `Post-warp stabilized frame`
                    : `Post-morphology binary mask`
                }
              />
            </div>
          )}
        </div>

        {/* Right Column: Required Academic Presentation Metadata */}
        <div className="lg:col-span-5 bg-slate-50 border border-slate-200 p-4 space-y-3.5 text-xs">
          <div className="border-b border-slate-200 pb-2.5">
            <div className="text-[11px] font-mono font-bold text-blue-700 uppercase">
              STAGE {String(currentStage.stepNumber).padStart(2, '0')} SPECIFICATION
            </div>
            <h3 className="text-sm font-bold text-slate-900 mt-0.5">{currentStage.title}</h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              {currentStage.description}
            </p>
          </div>

          <div className="space-y-1">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-blue-600" />
              <span>1. Input Signal / Tensor</span>
            </div>
            <div className="bg-white border border-slate-200 p-2 font-mono text-[11px] text-slate-800">
              {currentStage.inputSignal}
            </div>
          </div>

          <div className="space-y-1">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-emerald-600" />
              <span>2. Mathematical Operation</span>
            </div>
            <div className="bg-white border border-slate-200 p-2.5 font-mono text-[11px] text-blue-900 leading-relaxed">
              {currentStage.mathOperation}
            </div>
          </div>

          <div className="space-y-1">
            <div className="font-bold text-slate-800">3. Active Parameters Used</div>
            <div className="bg-white border border-slate-200 p-2.5 font-mono text-[11px] text-slate-700 space-y-1 tabular-nums">
              {currentStage.stepNumber <= 8 ? (
                <>
                  <div>
                    maxCorners = <strong>{stabilizationParams.maxCorners}</strong> · qualityLevel ={' '}
                    <strong>{stabilizationParams.qualityLevel}</strong> · minDistance ={' '}
                    <strong>{stabilizationParams.minDistance}px</strong>
                  </div>
                  <div>
                    ransacThreshold = <strong>{stabilizationParams.ransacThreshold}px</strong> ·
                    smoothingMode = <strong>{stabilizationParams.trajectoryMode ?? 'gaussian_smooth'}</strong> (R ={' '}
                    <strong>{stabilizationParams.smoothingRadius}</strong>)
                  </div>
                  <div>
                    cropRatio = <strong>{(stabilizationParams.cropRatio * 100).toFixed(1)}%</strong>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    bgMethod = <strong>{selectedBgMethod.toUpperCase()}</strong> · mog2History ={' '}
                    <strong>{mog2Params.history}</strong> · varThreshold ={' '}
                    <strong>{mog2Params.varThreshold}</strong>
                  </div>
                  <div>
                    gaussianBlur = <strong>{String(morphologyConfig.enableGaussianBlur)}</strong> ·
                    opening = <strong>{morphologyConfig.openingKernelSize}×{morphologyConfig.openingKernelSize}</strong> ·
                    closing = <strong>{morphologyConfig.closingKernelSize}×{morphologyConfig.closingKernelSize}</strong>
                  </div>
                  <div>
                    minComponentArea = <strong>{morphologyConfig.minComponentArea} px²</strong>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <div className="font-bold text-slate-800">
              4. Key Numeric Measurements (Frame #{safeFrameIdx})
            </div>
            <div className="bg-white border border-slate-200 p-2.5 font-mono text-[11px] text-slate-800 space-y-1 tabular-nums">
              <div>
                Tracked Corners: <strong>{stageArtifacts?.features.length ?? 0}</strong> · RANSAC
                Inliers: <strong>{stageArtifacts?.inliersCount ?? 0}</strong> (
                {((stageArtifacts?.transformPt?.inlierRatio ?? 1) * 100).toFixed(1)}%)
              </div>
              <div>
                Estimated Jitter RMS (Before → After):{' '}
                <strong>{(stabResult?.rawTranslationJitterRms ?? 0).toFixed(3)} px</strong> →{' '}
                <strong>{(stabResult?.stabilizedTranslationJitterRms ?? 0).toFixed(3)} px</strong>
              </div>
              <div>
                Re-measured Output Residual Jitter RMS:{' '}
                <strong className="text-blue-700">{remeasuredJitter.toFixed(3)} px</strong> | Valid
                Area: <strong>{(stabResult?.meanValidAreaPercent ?? 100).toFixed(1)}%</strong>
              </div>
              <div>
                Connected Components (Before → After Morphology):{' '}
                <strong className="text-amber-700">
                  {stageArtifacts?.frameMetric?.rawComponentCount ?? 0}
                </strong>{' '}
                →{' '}
                <strong className="text-emerald-700">
                  {stageArtifacts?.boxes.length ?? 0}
                </strong>{' '}
                | FG Area:{' '}
                <strong>
                  {((stageArtifacts?.frameMetric?.foregroundRatio ?? 0) * 100).toFixed(2)}%
                </strong>
              </div>
              <div>
                Ground-Truth F1 / IoU:{' '}
                <strong>
                  {stageArtifacts?.frameMetric?.f1 !== null &&
                  stageArtifacts?.frameMetric?.f1 !== undefined
                    ? `${(stageArtifacts.frameMetric.f1 * 100).toFixed(2)}% / ${(
                        (stageArtifacts.frameMetric.iou ?? 0) * 100
                      ).toFixed(2)}%`
                    : 'N/A — Ground Truth Unavailable'}
                </strong>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <Code2 className="w-3.5 h-3.5 text-purple-700" />
              <span>5. Source Code Implementation Reference</span>
            </div>
            <div className="bg-white border border-slate-200 p-2.5 font-mono text-[11px] text-slate-800">
              <div className="text-blue-700 font-bold">{currentStage.sourceFile}</div>
              <div className="text-slate-600 mt-0.5">Function: {currentStage.sourceFunction}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
