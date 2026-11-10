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
 * Accumulates inter-frame transforms into a cumulative camera trajectory,
 * applies Gaussian trajectory smoothing, and computes per-frame corrective transforms.
 */
export function computeSmoothedTrajectory(
  transforms: FrameTransform[],
  smoothingRadius: number,
  smoothRotation = true
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

  const smoothX = gaussianSmooth1D(rawX, smoothingRadius);
  const smoothY = gaussianSmooth1D(rawY, smoothingRadius);
  const smoothA = smoothRotation ? gaussianSmooth1D(rawA, smoothingRadius) : [...rawA];

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
