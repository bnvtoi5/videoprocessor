import { DecodedVideoSession, RawFrameData } from '../types/video';
import {
  CombinedPipelineComparisonResult,
  CombinedPipelineConfig,
} from '../types/algorithm';
import { runStabilizationPipeline } from '../algorithms/stabilization/stabilizationPipeline';
import { runBackgroundPipeline } from '../algorithms/background/foregroundExtraction';
import { computeMaskFlickerRatio } from '../evaluation/segmentationMetrics';

/**
 * Executes the 8-stage Combined Spatiotemporal Pipeline:
 *   1. Video Input
 *   2. Motion Estimation
 *   3. Video Stabilization
 *   4. Background Modeling
 *   5. Foreground Mask
 *   6. Object Extraction
 *   7. Quantitative Evaluation
 *   8. Output Comparison (Flow A: Original -> BG vs Flow B: Stabilized -> BG)
 */
export function runCombinedSpatiotemporalPipeline(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cv: any,
  session: DecodedVideoSession,
  config: CombinedPipelineConfig,
  onProgress?: (stageName: string, percent: number) => void
): CombinedPipelineComparisonResult {
  const frames = session.frames;
  const gtMap = session.groundTruthMasks;

  onProgress?.('Stage 2–3: Motion Estimation & Video Stabilization', 20);
  const stabMethod =
    config.enableMotionEstimation && config.enableStabilization
      ? config.stabilizationMethod
      : 'none';

  const stabilizationResult = runStabilizationPipeline(
    cv,
    frames,
    stabMethod,
    config.stabilizationParams
  );

  // Measure camera motion amplitude to warn if background model assumption is violated
  let totalDisp = 0;
  for (const t of stabilizationResult.trajectories) {
    totalDisp += Math.hypot(t.rawX, t.rawY);
  }
  const meanCameraDisplacementPx =
    stabilizationResult.trajectories.length > 0
      ? totalDisp / stabilizationResult.trajectories.length
      : 0;
  const highCameraMotionWarning = meanCameraDisplacementPx > 14.0;

  onProgress?.('Stage 4–6 (Flow A): Original Video → Background Subtraction', 55);
  const flowA_OriginalToBg = runBackgroundPipeline(
    cv,
    frames,
    config.backgroundMethod,
    config.frameDiffParams,
    config.mog2Params,
    config.sampleKnnParams,
    config.enableMorphology,
    config.morphologyConfig,
    config.displayConfig,
    gtMap
  );

  onProgress?.('Stage 4–6 (Flow B): Stabilized Video → Background Subtraction', 85);
  const stabilizedRawFrames: RawFrameData[] = frames.map((f, idx) => ({
    ...f,
    rgba: stabilizationResult.stabilizedFrames[idx] ?? f.rgba,
  }));

  // Warp ground truth masks by the exact corrective transform applied to each stabilized frame
  // so ground truth evaluation remains pixel-aligned after stabilization warping.
  const stabilizedGtMap = new Map(gtMap);
  if (gtMap.size > 0 && stabMethod !== 'none') {
    const w = session.metadata.processingWidth;
    const h = session.metadata.processingHeight;
    const cx = w * 0.5;
    const cy = h * 0.5;
    const cropRatio = config.stabilizationParams.cropRatio;
    const zoom = 1.0 / Math.max(0.8, 1.0 - Math.max(0, Math.min(0.2, cropRatio)));
    const invScale = 1.0 / zoom;

    for (let i = 0; i < frames.length; i++) {
      const origGt = gtMap.get(frames[i].index);
      const traj = stabilizationResult.trajectories[i];
      if (!origGt || !traj) continue;

      const corrDx = -traj.corrDx;
      const corrDy = -traj.corrDy;
      const corrDa = -traj.corrDa;
      const cosA = Math.cos(-corrDa) * invScale;
      const sinA = Math.sin(-corrDa) * invScale;
      const warpedMask = new Uint8Array(w * h);

      for (let y = 0; y < h; y++) {
        const dy = y - cy - corrDy;
        const row = y * w;
        for (let x = 0; x < w; x++) {
          const dx = x - cx - corrDx;
          const sx = Math.round(cosA * dx - sinA * dy + cx);
          const sy = Math.round(sinA * dx + cosA * dy + cy);
          if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
            warpedMask[row + x] = origGt.mask[sy * w + sx];
          }
        }
      }
      stabilizedGtMap.set(frames[i].index, {
        frameIndex: frames[i].index,
        width: w,
        height: h,
        mask: warpedMask,
      });
    }
  }

  const flowB_StabilizedToBg = runBackgroundPipeline(
    cv,
    stabilizedRawFrames,
    config.backgroundMethod,
    config.frameDiffParams,
    config.mog2Params,
    config.sampleKnnParams,
    config.enableMorphology,
    config.morphologyConfig,
    config.displayConfig,
    stabilizedGtMap
  );

  onProgress?.('Stage 7–8: Comparative Discrepancy Evaluation', 98);
  const maskDifferenceRatioPerFrame: number[] = [];
  for (let i = 0; i < frames.length; i++) {
    const maskA = flowA_OriginalToBg.cleanedMasks[i];
    const maskB = flowB_StabilizedToBg.cleanedMasks[i];
    if (maskA && maskB) {
      maskDifferenceRatioPerFrame.push(computeMaskFlickerRatio(maskA, maskB));
    } else {
      maskDifferenceRatioPerFrame.push(0);
    }
  }

  const meanMaskDifferencePercent =
    maskDifferenceRatioPerFrame.length > 0
      ? (maskDifferenceRatioPerFrame.reduce((a, b) => a + b, 0) /
          maskDifferenceRatioPerFrame.length) *
        100
      : 0;

  onProgress?.('Pipeline Complete', 100);

  return {
    flowA_OriginalToBg,
    flowB_StabilizedToBg,
    stabilizationResult,
    highCameraMotionWarning,
    meanCameraDisplacementPx,
    maskDifferenceRatioPerFrame,
    meanMaskDifferencePercent,
  };
}
