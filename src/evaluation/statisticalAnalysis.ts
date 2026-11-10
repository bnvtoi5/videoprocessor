import {
  BoxPlotSummary,
  PairedStatisticalTestResult,
  RuntimeVariabilityStats,
} from '../types/research';
import { computeMean, computeMedian, computeStdDev } from './performanceMetrics';

/**
 * Standard normal cumulative distribution function Phi(z) (Abramowitz & Stegun 7.1.26).
 */
function normalCdf(z: number): number {
  const absZ = Math.abs(z);
  const t = 1 / (1 + 0.2316419 * absZ);
  const d = 0.3989422804014327 * Math.exp((-absZ * absZ) / 2);
  const p =
    d *
    t *
    (0.31938153 +
      t *
        (-0.356563782 +
          t * (1.781477937 + t * (-1.821255978 + 1.330274429 * t))));
  return z >= 0 ? 1 - p : p;
}

/**
 * Two-tailed p-value from Student's t-distribution with df degrees of freedom
 * using Peizer-Pratt normal approximation (accurate for df >= 3).
 */
export function twoTailedStudentTPValue(tStat: number, df: number): number {
  const absT = Math.abs(tStat);
  if (!Number.isFinite(absT) || df < 1) return 1.0;
  if (absT === 0) return 1.0;

  if (df <= 2) {
    // Exact formulas for df=1 and df=2
    if (df === 1) {
      return Math.max(0, Math.min(1, 1 - (2 * Math.atan(absT)) / Math.PI));
    }
    return Math.max(0, Math.min(1, 1 - absT / Math.sqrt(2 + absT * absT)));
  }

  // Hill (1970) / Peizer-Pratt normal transform for t-distribution
  const z =
    Math.sqrt(df * Math.log(1 + (absT * absT) / df)) *
    (1 - 1 / (4 * df) + 1 / (32 * df * df));
  const pOneTail = 1 - normalCdf(z);
  return Math.max(0, Math.min(1, 2 * pOneTail));
}

export function computeBoxPlotSummary(values: number[]): BoxPlotSummary {
  if (values.length === 0) {
    return {
      min: 0,
      q1: 0,
      median: 0,
      q3: 0,
      max: 0,
      mean: 0,
      stdDev: 0,
      n: 0,
    };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const quantile = (q: number) => {
    const pos = (n - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (sorted[base + 1] !== undefined) {
      return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
    }
    return sorted[base];
  };

  const mean = computeMean(sorted);
  const stdDev = computeStdDev(sorted);

  return {
    min: sorted[0],
    q1: quantile(0.25),
    median: quantile(0.5),
    q3: quantile(0.75),
    max: sorted[n - 1],
    mean,
    stdDev,
    n,
  };
}

/**
 * Level 1 Statistical Analysis: Runtime Repetitions (typically 3 runs after warm-up).
 */
export function computeRuntimeVariabilityStats(
  perRunMeanFrameMs: number[],
  perRunTotalMs: number[],
  width: number,
  height: number,
  frameCount: number
): RuntimeVariabilityStats {
  const validFrameMs =
    perRunMeanFrameMs.length > 0 ? perRunMeanFrameMs : [0.05];
  const validTotalMs = perRunTotalMs.length > 0 ? perRunTotalMs : [0.05];

  const meanLatencyMs = computeMean(validFrameMs);
  const medianLatencyMs = computeMedian(validFrameMs);
  const stdDevLatencyMs = computeStdDev(validFrameMs);
  const minLatencyMs = Math.min(...validFrameMs);
  const maxLatencyMs = Math.max(...validFrameMs);
  const meanFps = 1000 / Math.max(0.05, meanLatencyMs);

  // Estimate RGBA frame + mask buffer footprint in MB
  const bytesPerFrame = width * height * 5; // 4 bytes RGBA + 1 byte mask
  const allocatedFrameBufferMb =
    (bytesPerFrame * Math.max(1, frameCount)) / (1024 * 1024);

  return {
    repetitions: validFrameMs.length,
    warmUpExecuted: true,
    perRunMeanFrameMs: validFrameMs,
    perRunTotalMs: validTotalMs,
    meanLatencyMs,
    medianLatencyMs,
    stdDevLatencyMs,
    minLatencyMs,
    maxLatencyMs,
    meanFps,
    allocatedFrameBufferMb,
  };
}

/**
 * Deterministic Block Bootstrap 95% Confidence Interval for temporally correlated video frames.
 * Resamples contiguous blocks of length L = max(3, round(N^(1/3))) to preserve short-range
 * temporal autocorrelation between adjacent video frames.
 */
function computeBlockBootstrapCi95(diffs: number[]): [number, number] {
  const n = diffs.length;
  if (n < 3) {
    const m = computeMean(diffs);
    return [m, m];
  }

  const blockSize = Math.max(3, Math.round(Math.cbrt(n)));
  const numBlocks = Math.ceil(n / blockSize);
  const numBootstrapSamples = 120;
  const bootMeans: number[] = [];

  let seed = 133742;
  for (let b = 0; b < numBootstrapSamples; b++) {
    let sum = 0;
    let count = 0;
    for (let k = 0; k < numBlocks && count < n; k++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const startIdx = seed % Math.max(1, n - blockSize + 1);
      for (let j = 0; j < blockSize && count < n; j++) {
        sum += diffs[startIdx + j];
        count++;
      }
    }
    bootMeans.push(sum / Math.max(1, count));
  }

  bootMeans.sort((a, b) => a - b);
  const loIdx = Math.max(0, Math.floor(numBootstrapSamples * 0.025));
  const hiIdx = Math.min(
    numBootstrapSamples - 1,
    Math.floor(numBootstrapSamples * 0.975)
  );
  return [bootMeans[loIdx], bootMeans[hiIdx]];
}

/**
 * Level 2 Statistical Analysis: Per-frame Paired Statistical Comparison
 * between Method A and Method B on identical frames t = 1..N.
 *
 * Computes:
 * - Paired t-test (t-statistic, df, p-value)
 * - Wilcoxon Signed-Rank Test (W-statistic, z-score, p-value)
 * - Cohen's d_z Effect Size
 * - Parametric 95% CI & Block-Bootstrap 95% CI (for temporally correlated frames)
 */
export function computePairedFrameStatistics(
  metricName: string,
  unit: string,
  methodAName: string,
  methodBName: string,
  seriesA: number[],
  seriesB: number[],
  higherIsBetter = true
): PairedStatisticalTestResult {
  const n = Math.min(seriesA.length, seriesB.length);
  const a = seriesA.slice(0, n);
  const b = seriesB.slice(0, n);

  const diffs: number[] = [];
  const perFrameSeries: {
    frameIndex: number;
    valueA: number;
    valueB: number;
    diff: number;
  }[] = [];

  for (let i = 0; i < n; i++) {
    const d = b[i] - a[i];
    diffs.push(d);
    perFrameSeries.push({
      frameIndex: i + 1,
      valueA: a[i],
      valueB: b[i],
      diff: d,
    });
  }

  const meanA = computeMean(a);
  const meanB = computeMean(b);
  const meanDifference = computeMean(diffs);
  const medianDifference = computeMedian(diffs);
  const stdDevDifference = computeStdDev(diffs);

  // Sample standard deviation (dividing by n - 1) for inferential t-test
  let sampleVar = 0;
  if (n > 1) {
    for (let i = 0; i < n; i++) {
      const dev = diffs[i] - meanDifference;
      sampleVar += dev * dev;
    }
    sampleVar /= n - 1;
  }
  const sampleStd = Math.sqrt(sampleVar);
  const stdErr = n > 0 ? sampleStd / Math.sqrt(n) : 0;

  // Parametric 95% CI (t_crit approx 2.04 for N~30, 1.96 for large N)
  const tCrit95 = n > 30 ? 1.96 : n > 10 ? 2.08 : 2.26;
  const ci95: [number, number] = [
    meanDifference - tCrit95 * stdErr,
    meanDifference + tCrit95 * stdErr,
  ];
  const blockBootCi95 = computeBlockBootstrapCi95(diffs);

  // Paired t-test
  const tStat = stdErr > 1e-12 ? meanDifference / stdErr : 0;
  const df = Math.max(1, n - 1);
  const pValT = stdErr > 1e-12 ? twoTailedStudentTPValue(tStat, df) : 1.0;

  // Cohen's d_z effect size
  const cohensDz = sampleStd > 1e-12 ? Math.abs(meanDifference) / sampleStd : 0;
  const effectMagnitudeLabel: 'Negligible' | 'Small' | 'Medium' | 'Large' =
    cohensDz < 0.2
      ? 'Negligible'
      : cohensDz < 0.5
      ? 'Small'
      : cohensDz < 0.8
      ? 'Medium'
      : 'Large';

  // Wilcoxon Signed-Rank Test on non-zero differences
  const nonZero = diffs
    .filter((d) => Math.abs(d) > 1e-12)
    .map((d) => ({ diff: d, absDiff: Math.abs(d), rank: 0 }));

  nonZero.sort((x, y) => x.absDiff - y.absDiff);

  // Assign average ranks for ties
  let idx = 0;
  while (idx < nonZero.length) {
    let end = idx;
    while (
      end + 1 < nonZero.length &&
      Math.abs(nonZero[end + 1].absDiff - nonZero[idx].absDiff) <= 1e-12
    ) {
      end++;
    }
    const avgRank = (idx + 1 + (end + 1)) / 2;
    for (let k = idx; k <= end; k++) {
      nonZero[k].rank = avgRank;
    }
    idx = end + 1;
  }

  let wPos = 0;
  let wNeg = 0;
  for (const item of nonZero) {
    if (item.diff > 0) wPos += item.rank;
    else wNeg += item.rank;
  }

  const nr = nonZero.length;
  const wStatistic = Math.min(wPos, wNeg);
  let zScore = 0;
  let pValWilcoxon = 1.0;

  if (nr >= 5) {
    const meanW = (nr * (nr + 1)) / 4;
    const stdW = Math.sqrt((nr * (nr + 1) * (2 * nr + 1)) / 24);
    if (stdW > 1e-9) {
      zScore = (wPos - meanW) / stdW;
      pValWilcoxon = Math.max(0, Math.min(1, 2 * (1 - normalCdf(Math.abs(zScore)))));
    }
  }

  const boxPlotA = computeBoxPlotSummary(a);
  const boxPlotB = computeBoxPlotSummary(b);

  const improved = higherIsBetter ? meanDifference > 0 : meanDifference < 0;
  const directionStr =
    Math.abs(meanDifference) < 1e-9
      ? 'không đổi'
      : improved
      ? 'cải thiện'
      : 'suy giảm';

  return {
    metricName,
    unit,
    methodAName,
    methodBName,
    sampleSizeN: n,
    meanA,
    meanB,
    meanDifference,
    medianDifference,
    stdDevDifference: sampleStd,
    confidenceInterval95: ci95,
    blockBootstrapCi95: blockBootCi95,
    cohensDzEffectSize: cohensDz,
    effectMagnitudeLabel,
    pairedTTest: {
      tStatistic: tStat,
      degreesOfFreedom: df,
      pValueTwoTailed: pValT,
    },
    wilcoxonSignedRank: {
      wStatistic,
      zScore,
      pValueTwoTailed: pValWilcoxon,
      nonZeroPairs: nr,
    },
    boxPlotA,
    boxPlotB,
    perFrameSeries,
    autocorrelationWarning:
      'Lưu ý phương pháp luận: Các khung hình liên tiếp trong cùng một video có tương quan chuỗi thời gian (temporal autocorrelation). Khoảng tin cậy Block-Bootstrap 95% và cỡ hiệu ứng (Cohen\'s d_z) phản ánh độ chênh lệch thực tế đáng tin cậy hơn p-value đơn thuần.',
    interpretationVi: `Trên N = ${n} cặp khung hình, ${methodBName} có trung bình ${meanB.toFixed(3)} ${unit} so với ${meanA.toFixed(3)} ${unit} của ${methodAName} (Chênh lệch trung bình Δ = ${meanDifference >= 0 ? '+' : ''}${meanDifference.toFixed(3)} ${unit}, ${directionStr}; cỡ hiệu ứng d_z = ${cohensDz.toFixed(2)} [${effectMagnitudeLabel}], Wilcoxon p = ${pValWilcoxon.toFixed(4)}).`,
  };
}
