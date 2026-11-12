import { FrameTransform, TrajectoryState } from '../../types/algorithm';

/**
 * Computes normalized 1D Gaussian kernel weights for radius R.
 */
export function buildGaussianKernel1D(radius: number): number[] {
  const r = Math.max(1, Math.round(radius));
  const sigma = Math.max(0.8, r / 2.2);
  const kernel: number[] = [];
  let sum = 0;
  for (let i = -r; i <= r; i++) {
    const w = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel.push(w);
    sum += w;
  }
  return kernel.map((w) => w / sum);
}

/**
 * Convolves a 1D signal with reflective boundary padding using a Gaussian smoothing kernel.
 */
export function gaussianSmooth1D(signal: number[], radius: number): number[] {
  if (signal.length <= 1 || radius <= 0) {
    return [...signal];
  }
  const kernel = buildGaussianKernel1D(radius);
  const r = (kernel.length - 1) >> 1;
  const n = signal.length;
  const out = new Array<number>(n);

  for (let i = 0; i < n; i++) {
    let acc = 0;
    for (let k = -r; k <= r; k++) {
      let idx = i + k;
      if (idx < 0) idx = -idx;
      if (idx >= n) idx = 2 * n - 2 - idx;
      idx = Math.max(0, Math.min(n - 1, idx));
      acc += signal[idx] * kernel[k + r];
    }
    out[i] = acc;
  }
  return out;
}

/**
 * Convolves a 1D signal with reflective boundary padding using a uniform Boxcar (Moving-Average) filter of radius R.
 * Used in Ablation D3 to compare trajectory smoothing strategies (Gaussian vs Moving-Average) under identical warp conditions.
 */
export function movingAverageSmooth1D(signal: number[], radius: number): number[] {
  if (signal.length <= 1 || radius <= 0) {
    return [...signal];
  }
  const r = Math.max(1, Math.round(radius));
  const windowLen = 2 * r + 1;
  const n = signal.length;
  const out = new Array<number>(n);

  for (let i = 0; i < n; i++) {
    let acc = 0;
    for (let k = -r; k <= r; k++) {
      let idx = i + k;
      if (idx < 0) idx = -idx;
      if (idx >= n) idx = 2 * n - 2 - idx;
      idx = Math.max(0, Math.min(n - 1, idx));
      acc += signal[idx];
    }
    out[i] = acc / windowLen;
  }
  return out;
}

/**
 * Accumulates inter-frame transforms into a cumulative camera trajectory,
 * applies trajectory smoothing (Gaussian, Moving-Average, Rigid-Lock, or Zero-Correction),
 * and computes per-frame corrective transforms.
 */
export function computeSmoothedTrajectory(
  transforms: FrameTransform[],
  smoothingRadius: number,
  smoothRotation = true,
  trajectoryMode: 'gaussian_smooth' | 'moving_average' | 'rigid_lock' | 'zero_correction' = 'gaussian_smooth'
): TrajectoryState[] {
  const n = transforms.length;
  if (n === 0) return [];

  const rawX = new Array<number>(n);
  const rawY = new Array<number>(n);
  const rawA = new Array<number>(n);

  let accX = 0;
  let accY = 0;
  let accA = 0;

  for (let i = 0; i < n; i++) {
    accX += transforms[i].dx;
    accY += transforms[i].dy;
    accA += transforms[i].da;
    rawX[i] = accX;
    rawY[i] = accY;
    rawA[i] = accA;
  }

  let smoothX: number[];
  let smoothY: number[];
  let smoothA: number[];

  if (trajectoryMode === 'rigid_lock') {
    // Locks directly to Frame 0 reference without low-pass trajectory smoothing (ΔC = -P_raw)
    smoothX = new Array<number>(n).fill(0);
    smoothY = new Array<number>(n).fill(0);
    smoothA = smoothRotation ? new Array<number>(n).fill(0) : [...rawA];
  } else if (trajectoryMode === 'zero_correction' || smoothingRadius <= 0) {
    // Radius 0 convention (P_smooth = P_raw => ΔC = 0)
    smoothX = [...rawX];
    smoothY = [...rawY];
    smoothA = [...rawA];
  } else if (trajectoryMode === 'moving_average') {
    // Uniform Boxcar Moving-Average low-pass trajectory smoothing (Ablation D3 alternative strategy)
    smoothX = movingAverageSmooth1D(rawX, smoothingRadius);
    smoothY = movingAverageSmooth1D(rawY, smoothingRadius);
    smoothA = smoothRotation ? movingAverageSmooth1D(rawA, smoothingRadius) : [...rawA];
  } else {
    smoothX = gaussianSmooth1D(rawX, smoothingRadius);
    smoothY = gaussianSmooth1D(rawY, smoothingRadius);
    smoothA = smoothRotation ? gaussianSmooth1D(rawA, smoothingRadius) : [...rawA];
  }

  const trajectories: TrajectoryState[] = [];
  for (let i = 0; i < n; i++) {
    const diffX = smoothX[i] - rawX[i];
    const diffY = smoothY[i] - rawY[i];
    const diffA = smoothA[i] - rawA[i];

    trajectories.push({
      frameIndex: transforms[i].frameIndex,
      rawX: rawX[i],
      rawY: rawY[i],
      rawAngle: (rawA[i] * 180) / Math.PI,
      smoothX: smoothX[i],
      smoothY: smoothY[i],
      smoothAngle: (smoothA[i] * 180) / Math.PI,
      corrDx: diffX,
      corrDy: diffY,
      corrDa: diffA,
    });
  }

  return trajectories;
}
