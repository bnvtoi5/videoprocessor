import { RawFrameData } from '../../types/video';
import {
  FrameTransform,
  StabilizationMethodId,
  StabilizationParams,
  StabilizationRunResult,
  TrackedFeaturePoint,
} from '../../types/algorithm';
import { detectAndTrackOpticalFlow, rgbaToGrayscale } from './opticalFlow';
import { estimateSimilarityTransformRansac } from './ransac';
import { estimateEccTransform } from './ecc';
import { computeSmoothedTrajectory } from './trajectory';
import { computeTrajectoryJitterMetrics } from '../../evaluation/stabilizationMetrics';

/**
 * Warps an RGBA frame by corrective transform (corrDx, corrDy, corrDa) around image center,
 * optionally applying border crop compensation (cropRatio), and computes exact
 * valid image area ratio and border loss ratio.
 */
export function warpFrameAffineRgba(
  srcRgba: Uint8ClampedArray,
  width: number,
  height: number,
  corrDx: number,
  corrDy: number,
  corrDa: number,
  cropRatio = 0
): {
  warpedRgba: Uint8ClampedArray;
  validAreaRatio: number;
  borderLossRatio: number;
} {
  const dst = new Uint8ClampedArray(width * height * 4);
  const cx = width * 0.5;
  const cy = height * 0.5;

  // Inverse mapping from destination pixel (x, y) to source pixel (sx, sy)
  const zoom = 1.0 / Math.max(0.8, 1.0 - Math.max(0, Math.min(0.2, cropRatio)));
  const invScale = 1.0 / zoom;
  const cosA = Math.cos(-corrDa) * invScale;
  const sinA = Math.sin(-corrDa) * invScale;

  let validPixels = 0;
  const totalPixels = width * height;

  for (let y = 0; y < height; y++) {
    const dy = y - cy - corrDy;
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      const dx = x - cx - corrDx;
      const sx = cosA * dx - sinA * dy + cx;
      const sy = sinA * dx + cosA * dy + cy;

      const dstIdx = (rowOffset + x) << 2;

      if (sx >= 0 && sx < width - 1 && sy >= 0 && sy < height - 1) {
        validPixels++;
        const x0 = Math.floor(sx);
        const y0 = Math.floor(sy);
        const ax = sx - x0;
        const ay = sy - y0;
        const w00 = (1 - ax) * (1 - ay);
        const w10 = ax * (1 - ay);
        const w01 = (1 - ax) * ay;
        const w11 = ax * ay;

        const idx00 = (y0 * width + x0) << 2;
        const idx10 = idx00 + 4;
        const idx01 = idx00 + (width << 2);
        const idx11 = idx01 + 4;

        dst[dstIdx] =
          w00 * srcRgba[idx00] +
          w10 * srcRgba[idx10] +
          w01 * srcRgba[idx01] +
          w11 * srcRgba[idx11];
        dst[dstIdx + 1] =
          w00 * srcRgba[idx00 + 1] +
          w10 * srcRgba[idx10 + 1] +
          w01 * srcRgba[idx01 + 1] +
          w11 * srcRgba[idx11 + 1];
        dst[dstIdx + 2] =
          w00 * srcRgba[idx00 + 2] +
          w10 * srcRgba[idx10 + 2] +
          w01 * srcRgba[idx01 + 2] +
          w11 * srcRgba[idx11 + 2];
        dst[dstIdx + 3] = 255;
      } else {
        // Replicate nearest border pixel (cv.BORDER_REPLICATE equivalent) so moving black borders do not create false positives in downstream BG subtraction
        const clampX = Math.max(0, Math.min(width - 1, Math.round(sx)));
        const clampY = Math.max(0, Math.min(height - 1, Math.round(sy)));
        const borderIdx = (clampY * width + clampX) << 2;
        dst[dstIdx] = srcRgba[borderIdx];
        dst[dstIdx + 1] = srcRgba[borderIdx + 1];
        dst[dstIdx + 2] = srcRgba[borderIdx + 2];
        dst[dstIdx + 3] = 255;
      }
    }
  }

  const validAreaRatio = totalPixels > 0 ? validPixels / totalPixels : 1;
  const borderLossRatio = Math.max(0, 1 - validAreaRatio);

  return {
    warpedRgba: dst,
    validAreaRatio,
    borderLossRatio,
  };
}

/**
 * Runs complete Video Stabilization pipeline for method: 'none' | 'lk_ransac' | 'ecc'.
 */
export function runStabilizationPipeline(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cv: any,
  frames: RawFrameData[],
  method: StabilizationMethodId,
  params: StabilizationParams,
  onProgress?: (current: number, total: number) => void
): StabilizationRunResult {
  const n = frames.length;
  if (n === 0) {
    return {
      method,
      engineUsed: 'None (Empty input)',
      stabilizedFrames: [],
      transforms: [],
      trajectories: [],
      trackedFeaturesPerFrame: [],
      validAreaRatioPerFrame: [],
      borderLossRatioPerFrame: [],
      totalProcessingTimeMs: 0,
      avgProcessingTimeMs: 0,
      fps: 0,
      eccConvergenceRate: 100,
      eccFailedFrames: [],
      meanInlierCount: 0,
      meanInlierRatio: 0,
      rawTranslationJitterRms: 0,
      stabilizedTranslationJitterRms: 0,
      rawRotationJitterRms: 0,
      stabilizedRotationJitterRms: 0,
      trajectoryAccelerationRms: 0,
      meanValidAreaPercent: 100,
      meanBorderLossPercent: 0,
    };
  }

  const width = frames[0].width;
  const height = frames[0].height;
  const startTotal = performance.now();

  if (method === 'none') {
    const transforms: FrameTransform[] = frames.map((f) => ({
      frameIndex: f.index,
      dx: 0,
      dy: 0,
      da: 0,
      scale: 1,
      inliersCount: 0,
      totalFeatures: 0,
      inlierRatio: 1,
      eccConverged: true,
      eccScore: 1,
      processingTimeMs: 0.05,
    }));
    const trajectories = computeSmoothedTrajectory(transforms, params.smoothingRadius, params.smoothRotation);
    return {
      method: 'none',
      engineUsed: 'Baseline Pass-through (Unstabilized)',
      stabilizedFrames: frames.map((f) => new Uint8ClampedArray(f.rgba)),
      transforms,
      trajectories,
      trackedFeaturesPerFrame: frames.map(() => []),
      validAreaRatioPerFrame: frames.map(() => 1),
      borderLossRatioPerFrame: frames.map(() => 0),
      totalProcessingTimeMs: 0.1 * n,
      avgProcessingTimeMs: 0.1,
      fps: 10000,
      eccConvergenceRate: 100,
      eccFailedFrames: [],
      meanInlierCount: 0,
      meanInlierRatio: 100,
      rawTranslationJitterRms: 0,
      stabilizedTranslationJitterRms: 0,
      rawRotationJitterRms: 0,
      stabilizedRotationJitterRms: 0,
      trajectoryAccelerationRms: 0,
      meanValidAreaPercent: 100,
      meanBorderLossPercent: 0,
    };
  }

  const transforms: FrameTransform[] = [];
  const trackedFeaturesPerFrame: TrackedFeaturePoint[][] = [];
  const eccFailedFrames: number[] = [];
  let engineLabel = '';

  let prevGray = rgbaToGrayscale(frames[0].rgba, width, height);

  // Frame 0 identity transform
  transforms.push({
    frameIndex: frames[0].index,
    dx: 0,
    dy: 0,
    da: 0,
    scale: 1,
    inliersCount: 0,
    totalFeatures: 0,
    inlierRatio: 1,
    eccConverged: true,
    eccScore: 1,
    processingTimeMs: 0,
  });
  trackedFeaturesPerFrame.push([]);

  for (let i = 1; i < n; i++) {
    const t0 = performance.now();
    const currGray = rgbaToGrayscale(frames[i].rgba, width, height);

    if (method === 'lk_ransac') {
      const flowRes = detectAndTrackOpticalFlow(
        cv,
        prevGray,
        currGray,
        width,
        height,
        params
      );
      const ransacRes = estimateSimilarityTransformRansac(
        flowRes.points,
        params.ransacThreshold
      );

      engineLabel = `${flowRes.engine} + TypeScript 2D Similarity RANSAC`;

      const annotatedPts = flowRes.points.map((pt, idx) => ({
        ...pt,
        isInlier: ransacRes.inliers[idx] ?? false,
      }));
      trackedFeaturesPerFrame.push(annotatedPts);

      const cx = width * 0.5;
      const cy = height * 0.5;
      const cosA = Math.cos(ransacRes.da);
      const sinA = Math.sin(ransacRes.da);
      const centerDx = ransacRes.dx + (cosA * cx - sinA * cy) - cx;
      const centerDy = ransacRes.dy + (sinA * cx + cosA * cy) - cy;

      // Inter-frame feature displacement in image coordinates around optical center
      const camDx = centerDx;
      const camDy = centerDy;
      const camDa = ransacRes.da;

      const dt = performance.now() - t0;
      transforms.push({
        frameIndex: frames[i].index,
        dx: camDx,
        dy: camDy,
        da: camDa,
        scale: ransacRes.scale,
        inliersCount: ransacRes.inliersCount,
        totalFeatures: flowRes.points.length,
        inlierRatio: ransacRes.inlierRatio,
        eccConverged: true,
        eccScore: 1,
        processingTimeMs: dt,
      });
    } else {
      // ECC stabilization
      const eccRes = estimateEccTransform(
        cv,
        prevGray,
        currGray,
        width,
        height,
        params.eccIterations,
        params.eccEps
      );
      engineLabel = eccRes.engine;
      trackedFeaturesPerFrame.push([]);

      if (!eccRes.converged) {
        eccFailedFrames.push(frames[i].index);
      }

      const cx = width * 0.5;
      const cy = height * 0.5;
      const cosA = Math.cos(eccRes.da);
      const sinA = Math.sin(eccRes.da);
      const centerDx = eccRes.dx + (cosA * cx - sinA * cy) - cx;
      const centerDy = eccRes.dy + (sinA * cx + cosA * cy) - cy;

      const camDx = eccRes.converged ? centerDx : 0;
      const camDy = eccRes.converged ? centerDy : 0;
      const camDa = eccRes.converged ? eccRes.da : 0;

      const dt = performance.now() - t0;
      transforms.push({
        frameIndex: frames[i].index,
        dx: camDx,
        dy: camDy,
        da: camDa,
        scale: 1,
        inliersCount: 0,
        totalFeatures: 0,
        inlierRatio: eccRes.converged ? 1 : 0,
        eccConverged: eccRes.converged,
        eccScore: eccRes.correlationScore,
        processingTimeMs: dt,
      });
    }

    prevGray = currGray;
    if (onProgress && i % 3 === 0) {
      onProgress(i, n * 2);
    }
  }

  // Compute smoothed camera trajectory & corrective transforms
  const trajectories = computeSmoothedTrajectory(
    transforms,
    params.smoothingRadius,
    params.smoothRotation,
    params.trajectoryMode ?? 'gaussian_smooth'
  );

  // Warp each frame with corrective transform
  const stabilizedFrames: Uint8ClampedArray[] = [];
  const validAreaRatioPerFrame: number[] = [];
  const borderLossRatioPerFrame: number[] = [];

  for (let i = 0; i < n; i++) {
    const tWarp0 = performance.now();
    const traj = trajectories[i];
    const warped = warpFrameAffineRgba(
      frames[i].rgba,
      width,
      height,
      traj.corrDx,
      traj.corrDy,
      traj.corrDa,
      params.cropRatio
    );
    transforms[i].processingTimeMs += performance.now() - tWarp0;

    stabilizedFrames.push(warped.warpedRgba);
    validAreaRatioPerFrame.push(warped.validAreaRatio);
    borderLossRatioPerFrame.push(warped.borderLossRatio);

    if (onProgress && i % 3 === 0) {
      onProgress(n + i, n * 2);
    }
  }

  const totalTimeMs = Math.max(0.1, performance.now() - startTotal);
  const avgTimeMs = totalTimeMs / n;
  const fps = 1000 / avgTimeMs;

  const jitterMetrics = computeTrajectoryJitterMetrics(trajectories);

  const validFramesForInliers = transforms.slice(1);
  const meanInlierCount =
    validFramesForInliers.length > 0
      ? validFramesForInliers.reduce((acc, t) => acc + t.inliersCount, 0) /
        validFramesForInliers.length
      : 0;
  const meanInlierRatio =
    validFramesForInliers.length > 0
      ? (validFramesForInliers.reduce((acc, t) => acc + t.inlierRatio, 0) /
          validFramesForInliers.length) *
        100
      : 0;

  const eccConvergenceRate =
    validFramesForInliers.length > 0
      ? ((validFramesForInliers.length - eccFailedFrames.length) /
          validFramesForInliers.length) *
        100
      : 100;

  const meanValidAreaPercent =
    (validAreaRatioPerFrame.reduce((a, b) => a + b, 0) / n) * 100;
  const meanBorderLossPercent =
    (borderLossRatioPerFrame.reduce((a, b) => a + b, 0) / n) * 100;

  return {
    method,
    engineUsed: engineLabel || 'OpenCV.js + TypeScript Pipeline',
    stabilizedFrames,
    transforms,
    trajectories,
    trackedFeaturesPerFrame,
    validAreaRatioPerFrame,
    borderLossRatioPerFrame,
    totalProcessingTimeMs: totalTimeMs,
    avgProcessingTimeMs: avgTimeMs,
    fps,
    eccConvergenceRate,
    eccFailedFrames,
    meanInlierCount,
    meanInlierRatio,
    rawTranslationJitterRms: jitterMetrics.rawTranslationJitterRms,
    stabilizedTranslationJitterRms: jitterMetrics.stabilizedTranslationJitterRms,
    rawRotationJitterRms: jitterMetrics.rawRotationJitterRms,
    stabilizedRotationJitterRms: jitterMetrics.stabilizedRotationJitterRms,
    trajectoryAccelerationRms: jitterMetrics.stabilizedAccelerationRms,
    meanValidAreaPercent,
    meanBorderLossPercent,
  };
}
