import { FrameTransform, TrajectoryState } from '../types/algorithm';
import { CameraMotionGroundTruthMetrics } from '../types/research';
import { TrueCameraTransform } from '../types/video';

export interface TrajectoryJitterMetrics {
  rawTranslationJitterRms: number;
  stabilizedTranslationJitterRms: number;
  rawRotationJitterRms: number;
  stabilizedRotationJitterRms: number;
  rawAccelerationRms: number;
  stabilizedAccelerationRms: number;
}

/**
 * Computes second-order finite difference RMS (acceleration / high-frequency jitter proxy):
 *   d2[t] = x[t+1] - 2*x[t] + x[t-1]
 * For real-world videos without motion-capture ground truth, second-order trajectory
 * finite difference RMS measures high-frequency trajectory roughness independently
 * of constant-velocity intentional camera pans.
 */
export function secondOrderDifferenceRms(series: number[]): number {
  const n = series.length;
  if (n < 3) return 0;

  let sumSq = 0;
  let count = 0;
  for (let i = 1; i < n - 1; i++) {
    const d2 = series[i + 1] - 2 * series[i] + series[i - 1];
    sumSq += d2 * d2;
    count++;
  }
  return count > 0 ? Math.sqrt(sumSq / count) : 0;
}

/**
 * Computes comprehensive stabilization trajectory metrics separating:
 * - Raw trajectory (uncorrected camera motion)
 * - Smoothed intentional trajectory (low-pass Gaussian trajectory)
 * - High-frequency residual jitter RMS (second-order finite difference)
 */
export function computeTrajectoryJitterMetrics(
  trajectories: TrajectoryState[]
): TrajectoryJitterMetrics {
  if (trajectories.length < 3) {
    return {
      rawTranslationJitterRms: 0,
      stabilizedTranslationJitterRms: 0,
      rawRotationJitterRms: 0,
      stabilizedRotationJitterRms: 0,
      rawAccelerationRms: 0,
      stabilizedAccelerationRms: 0,
    };
  }

  const rawX = trajectories.map((t) => t.rawX);
  const rawY = trajectories.map((t) => t.rawY);
  const rawAngle = trajectories.map((t) => t.rawAngle);

  const smoothX = trajectories.map((t) => t.smoothX);
  const smoothY = trajectories.map((t) => t.smoothY);
  const smoothAngle = trajectories.map((t) => t.smoothAngle);

  const rawJitterX = secondOrderDifferenceRms(rawX);
  const rawJitterY = secondOrderDifferenceRms(rawY);
  const rawTranslationJitterRms = Math.hypot(rawJitterX, rawJitterY);

  const stabJitterX = secondOrderDifferenceRms(smoothX);
  const stabJitterY = secondOrderDifferenceRms(smoothY);
  const stabilizedTranslationJitterRms = Math.hypot(stabJitterX, stabJitterY);

  const rawRotationJitterRms = secondOrderDifferenceRms(rawAngle);
  const stabilizedRotationJitterRms = secondOrderDifferenceRms(smoothAngle);

  return {
    rawTranslationJitterRms,
    stabilizedTranslationJitterRms,
    rawRotationJitterRms,
    stabilizedRotationJitterRms,
    rawAccelerationRms: rawTranslationJitterRms,
    stabilizedAccelerationRms: stabilizedTranslationJitterRms,
  };
}

/**
 * Computes Ground-Truth Camera Motion Estimation Error (Translation RMSE, Rotation RMSE,
 * Scale RMSE, 2x3 Matrix Frobenius RMSE) and Residual Motion After Stabilization,
 * strictly separated from Trajectory Smoothness (Jitter RMS).
 *
 * Coordinate convention normalization:
 * - In synthetic scene generation, trueTransforms[t] stores cumulative camera shift
 *   (dx, dy, da) from frame 0, and stepDx = dx[t] - dx[t-1].
 * - Estimated inter-frame transform transforms[t] estimates motion from frame t-1 to t.
 */
export function computeCameraTransformGroundTruthError(
  estimatedTransforms: FrameTransform[],
  trajectories: TrajectoryState[],
  trueTransforms?: TrueCameraTransform[]
): CameraMotionGroundTruthMetrics {
  const jitter = computeTrajectoryJitterMetrics(trajectories);

  if (
    !trueTransforms ||
    trueTransforms.length === 0 ||
    estimatedTransforms.length === 0
  ) {
    return {
      hasGroundTruthTransform: false,
      translationRmsePx: null,
      rotationRmseDeg: null,
      scaleRmse: null,
      transformMatrixRmse: null,
      residualMotionAfterStabilizationPx: null,
      trajectorySmoothnessJitterRmsPx: jitter.stabilizedTranslationJitterRms,
    };
  }

  const n = Math.min(
    estimatedTransforms.length,
    trueTransforms.length,
    trajectories.length
  );
  if (n < 2) {
    return {
      hasGroundTruthTransform: false,
      translationRmsePx: null,
      rotationRmseDeg: null,
      scaleRmse: null,
      transformMatrixRmse: null,
      residualMotionAfterStabilizationPx: null,
      trajectorySmoothnessJitterRmsPx: jitter.stabilizedTranslationJitterRms,
    };
  }

  let sumSqTransErr = 0;
  let sumSqRotDegErr = 0;
  let sumSqScaleErr = 0;
  let sumSqMatrixErr = 0;
  let sumSqResidualAfterWarp = 0;
  let count = 0;

  for (let i = 1; i < n; i++) {
    const est = estimatedTransforms[i];
    const gtCurr = trueTransforms[i];
    const gtPrev = trueTransforms[i - 1];
    const traj = trajectories[i];

    const trueStepDx =
      gtCurr.stepDx !== undefined ? gtCurr.stepDx : gtCurr.dx - gtPrev.dx;
    const trueStepDy =
      gtCurr.stepDy !== undefined ? gtCurr.stepDy : gtCurr.dy - gtPrev.dy;
    const trueStepDa =
      gtCurr.stepDa !== undefined ? gtCurr.stepDa : gtCurr.da - gtPrev.da;
    const trueScale = gtCurr.scale ?? 1.0;

    // 1. Inter-frame motion estimation error
    const estStepDx = est.dx;
    const estStepDy = est.dy;
    const estStepDa = est.da;

    const errDx = estStepDx - trueStepDx;
    const errDy = estStepDy - trueStepDy;
    sumSqTransErr += errDx * errDx + errDy * errDy;

    const errDeg = ((estStepDa - trueStepDa) * 180) / Math.PI;
    sumSqRotDegErr += errDeg * errDeg;

    const errScale = (est.scale ?? 1.0) - trueScale;
    sumSqScaleErr += errScale * errScale;

    // 2. 2x3 Affine Matrix Frobenius Norm Error
    const estCos = (est.scale ?? 1.0) * Math.cos(estStepDa);
    const estSin = (est.scale ?? 1.0) * Math.sin(estStepDa);
    const gtCos = trueScale * Math.cos(trueStepDa);
    const gtSin = trueScale * Math.sin(trueStepDa);

    const mDiffSq =
      2 * (estCos - gtCos) * (estCos - gtCos) +
      2 * (estSin - gtSin) * (estSin - gtSin) +
      errDx * errDx +
      errDy * errDy;
    sumSqMatrixErr += mDiffSq / 6;

    // 3. Residual camera displacement after corrective warp (+traj.corrDx applied to gtCurr.dx)
    const residualX = gtCurr.dx + traj.corrDx;
    const residualY = gtCurr.dy + traj.corrDy;
    sumSqResidualAfterWarp += residualX * residualX + residualY * residualY;

    count++;
  }

  return {
    hasGroundTruthTransform: true,
    translationRmsePx: count > 0 ? Math.sqrt(sumSqTransErr / count) : 0,
    rotationRmseDeg: count > 0 ? Math.sqrt(sumSqRotDegErr / count) : 0,
    scaleRmse: count > 0 ? Math.sqrt(sumSqScaleErr / count) : 0,
    transformMatrixRmse: count > 0 ? Math.sqrt(sumSqMatrixErr / count) : 0,
    residualMotionAfterStabilizationPx:
      count > 0 ? Math.sqrt(sumSqResidualAfterWarp / count) : 0,
    trajectorySmoothnessJitterRmsPx: jitter.stabilizedTranslationJitterRms,
  };
}
