/**
 * Computes the arithmetic mean of a numeric array.
 */
export function computeMean(values: number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
  }
  return sum / values.length;
}

/**
 * Computes the sample standard deviation of a numeric array.
 */
export function computeStdDev(values: number[], meanOverride?: number): number {
  if (values.length <= 1) return 0;
  const mean = meanOverride ?? computeMean(values);
  let sumSq = 0;
  for (let i = 0; i < values.length; i++) {
    const d = values[i] - mean;
    sumSq += d * d;
  }
  return Math.sqrt(sumSq / (values.length - 1));
}

/**
 * Computes the statistical median of a numeric array (used for 3-run benchmark protocol).
 */
export function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) * 0.5;
}

export interface TimingBreakdown {
  algorithmProcessingTimeMs: number;
  totalPipelineTimeMs: number;
  exportEncodingTimeMs: number;
  effectiveFps: number;
}

export function summarizeTimingBreakdown(
  perFrameTimesMs: number[],
  totalPipelineTimeMs: number,
  exportEncodingTimeMs = 0
): TimingBreakdown {
  const n = perFrameTimesMs.length;
  const avgFrameMs =
    n > 0 ? perFrameTimesMs.reduce((a, b) => a + b, 0) / n : 0.1;
  const safeAvg = Math.max(0.05, avgFrameMs);
  return {
    algorithmProcessingTimeMs: safeAvg,
    totalPipelineTimeMs: Math.max(totalPipelineTimeMs, safeAvg * n),
    exportEncodingTimeMs,
    effectiveFps: 1000 / safeAvg,
  };
}
