import JSZip from 'jszip';
import {
  ParameterSensitivitySweepResult,
  PerFrameExportRecord,
  ResearchExperimentRow,
  TraceableExperimentLogEntry,
} from '../../types/research';

export interface AblationComparisonEntry {
  variantCode: string;
  variantLabel: string;
  baselineLabel: string;
  metricName: string;
  unit: string;
  category: 'Ground-Truth Metric' | 'Proxy Metric' | 'Runtime Metric';
  baselineValue: number | null;
  variantValue: number | null;
  absoluteDifference: number | null; // Variant - Baseline
  relativeDifferencePercent: number | null; // (Variant - Baseline) / |Baseline| * 100
  zeroDenominatorNote?: string;
}

export interface FivePointChartInterpretation {
  chartId: string;
  chartTitle: string;
  metricCategory: 'Ground-Truth Metric' | 'Proxy Metric' | 'Runtime Metric';
  whatIsCompared: string;
  bestPerformingVariant: string;
  magnitudeOfDifference: string;
  dspMechanismExplanation: string;
  limitationOrTradeOff: string;
}

export const METRIC_DEFINITIONS_TABLE: {
  metric: string;
  unit: string;
  category: 'Ground-Truth Metric' | 'Proxy Metric' | 'Runtime Metric';
  formula: string;
  interpretation: string;
}[] = [
  {
    metric: 'IoU (Intersection over Union / Jaccard Index)',
    unit: '%',
    category: 'Ground-Truth Metric',
    formula: 'TP / (TP + FP + FN) × 100%',
    interpretation:
      'Measures spatial overlap between predicted binary foreground mask and Ground Truth mask (excluding invalid border pixels). Higher is better. N/A when Ground Truth is absent.',
  },
  {
    metric: 'F1-Score (Dice Coefficient)',
    unit: '%',
    category: 'Ground-Truth Metric',
    formula: '2·TP / (2·TP + FP + FN) × 100%',
    interpretation:
      'Harmonic mean of Precision and Recall. Evaluates foreground segmentation balance. Higher is better. N/A when Ground Truth is absent.',
  },
  {
    metric: 'Precision & Recall',
    unit: '%',
    category: 'Ground-Truth Metric',
    formula: 'Precision = TP/(TP+FP), Recall = TP/(TP+FN)',
    interpretation:
      'Precision penalizes False Positives (camera jitter edges, cast shadows); Recall penalizes False Negatives (missed object interior).',
  },
  {
    metric: 'Transform Translation & Rotation RMSE',
    unit: 'px / deg',
    category: 'Ground-Truth Metric',
    formula: 'sqrt( (1/N) Σ ||Δp_est(t) - Δp_true(t)||² )',
    interpretation:
      'Root-mean-square error between estimated inter-frame camera motion and known synthetic camera ground truth. Lower is better. N/A on real-world uncalibrated videos.',
  },
  {
    metric: 'Input Camera Jitter RMS',
    unit: 'px',
    category: 'Proxy Metric',
    formula: 'RMS of 2nd-order finite difference d²P_raw/dt² on original frames',
    interpretation:
      'Quantifies high-frequency camera shake in the unstabilized input video before stabilization.',
  },
  {
    metric: 'Estimated Trajectory Smoothness Jitter RMS',
    unit: 'px',
    category: 'Proxy Metric',
    formula: 'RMS of 2nd-order finite difference d²P_smooth/dt² on smoothed trajectory',
    interpretation:
      'Measures smoothness of the planned mathematical camera trajectory after low-pass filtering (Gaussian or Moving-Average).',
  },
  {
    metric: 'Re-measured Residual Output Jitter RMS',
    unit: 'px',
    category: 'Proxy Metric',
    formula: 'Independent PyrLK+RANSAC re-estimation on warped output frames',
    interpretation:
      'Measures actual physical residual camera shake remaining in the warped output frames. Distinguishes true visual stabilization from mathematical trajectory smoothness.',
  },
  {
    metric: 'Jitter Reduction (%)',
    unit: '%',
    category: 'Proxy Metric',
    formula: '(InputJitterRMS - OutputResidualJitterRMS) / InputJitterRMS × 100%',
    interpretation:
      'Percentage of high-frequency camera jitter attenuated by the stabilization stage. Safely returns N/A when InputJitterRMS <= 1e-6.',
  },
  {
    metric: 'Foreground Ratio (FG Ratio)',
    unit: '%',
    category: 'Proxy Metric',
    formula: '(Count(Mask == 255) / TotalPixels) × 100%',
    interpretation:
      'Fraction of frame pixels classified as moving foreground. Useful on real videos to detect false-positive inflation when stabilization or shadow suppression is disabled.',
  },
  {
    metric: 'Temporal Mask Flicker',
    unit: '%',
    category: 'Proxy Metric',
    formula: '(Count(Mask_t != Mask_{t-1}) / TotalPixels) × 100%',
    interpretation:
      'Frame-to-frame binary mask instability. Lower flicker indicates higher temporal consistency.',
  },
  {
    metric: 'Raw vs Cleaned Connected Components / Frame',
    unit: 'blobs/frame',
    category: 'Proxy Metric',
    formula: '8-connected BFS labeling before and after morphology + area filter',
    interpretation:
      'Demonstrates how morphological opening/closing and minimum area filtering suppress isolated salt-and-pepper noise blobs.',
  },
  {
    metric: 'Mask Difference vs Baseline D0 (|M_variant - M_D0|)',
    unit: '%',
    category: 'Proxy Metric',
    formula: '(Count(M_variant != M_D0) / TotalPixels) × 100%',
    interpretation:
      'Quantifies direct pixel-level divergence caused by ablating or modifying a single DSP stage relative to the full D0 baseline.',
  },
  {
    metric: 'Border Loss (%)',
    unit: '%',
    category: 'Proxy Metric',
    formula: '(InvalidWarpedBorderPixels / TotalPixels) × 100%',
    interpretation:
      'Percentage of frame area lost to out-of-bounds geometric warping at image borders.',
  },
  {
    metric: 'Execution Time & Throughput',
    unit: 'ms/frame, FPS',
    category: 'Runtime Metric',
    formula: 'Mean/Median per-frame latency after warm-up; FPS = 1000 / ms_per_frame',
    interpretation:
      'Measures computational cost of each algorithm or pipeline stage in browser WebAssembly/TypeScript.',
  },
];

/**
 * Safely computes Absolute and Relative Difference between Variant and Baseline (D0),
 * handling null values and zero denominators explicitly.
 */
export function computeSafeDelta(
  variantVal: number | null | undefined,
  baselineVal: number | null | undefined
): {
  absDiff: number | null;
  relDiffPct: number | null;
  note?: string;
} {
  if (
    variantVal === null ||
    variantVal === undefined ||
    baselineVal === null ||
    baselineVal === undefined ||
    Number.isNaN(variantVal) ||
    Number.isNaN(baselineVal)
  ) {
    return { absDiff: null, relDiffPct: null, note: 'N/A — Metric unavailable' };
  }
  const absDiff = variantVal - baselineVal;
  if (Math.abs(baselineVal) <= 1e-9) {
    return {
      absDiff,
      relDiffPct: null,
      note: 'Zero baseline denominator — Relative % undefined',
    };
  }
  const relDiffPct = (absDiff / Math.abs(baselineVal)) * 100;
  return { absDiff, relDiffPct };
}

/**
 * Computes Jitter Reduction (%) safely handling zero input jitter.
 */
export function computeSafeJitterReductionPercent(
  inputJitterRms: number | null | undefined,
  outputResidualJitterRms: number | null | undefined
): number | null {
  if (
    inputJitterRms === null ||
    inputJitterRms === undefined ||
    outputResidualJitterRms === null ||
    outputResidualJitterRms === undefined ||
    inputJitterRms <= 1e-6
  ) {
    return null;
  }
  return ((inputJitterRms - outputResidualJitterRms) / inputJitterRms) * 100;
}

/**
 * Builds structured Ablation Comparison table (Absolute & Relative differences vs Baseline)
 * for any experiment run.
 */
export function buildAblationComparisonEntries(
  log: TraceableExperimentLogEntry
): AblationComparisonEntry[] {
  if (!log.measuredRows || log.measuredRows.length === 0) return [];
  const baseline =
    log.measuredRows.find((r) => r.status === 'Baseline') ?? log.measuredRows[0];

  const metricsSpec: {
    name: string;
    unit: string;
    category: 'Ground-Truth Metric' | 'Proxy Metric' | 'Runtime Metric';
    getter: (r: ResearchExperimentRow) => number | null | undefined;
  }[] = [
    {
      name: 'IoU',
      unit: '%',
      category: 'Ground-Truth Metric',
      getter: (r) => (r.iou !== null ? r.iou * 100 : null),
    },
    {
      name: 'F1-Score',
      unit: '%',
      category: 'Ground-Truth Metric',
      getter: (r) => (r.f1 !== null ? r.f1 * 100 : null),
    },
    {
      name: 'Precision',
      unit: '%',
      category: 'Ground-Truth Metric',
      getter: (r) => (r.precision !== null ? r.precision * 100 : null),
    },
    {
      name: 'Recall',
      unit: '%',
      category: 'Ground-Truth Metric',
      getter: (r) => (r.recall !== null ? r.recall * 100 : null),
    },
    {
      name: 'Translation RMSE',
      unit: 'px',
      category: 'Ground-Truth Metric',
      getter: (r) => r.translationRmsePx,
    },
    {
      name: 'Re-measured Residual Jitter RMS',
      unit: 'px',
      category: 'Proxy Metric',
      getter: (r) => r.remeasuredJitterRmsPx ?? r.jitterRmsPx,
    },
    {
      name: 'Estimated Trajectory Smoothness Jitter RMS',
      unit: 'px',
      category: 'Proxy Metric',
      getter: (r) => r.jitterRmsPx,
    },
    {
      name: 'Foreground Ratio',
      unit: '%',
      category: 'Proxy Metric',
      getter: (r) => r.fgRatioPercent ?? null,
    },
    {
      name: 'Temporal Mask Flicker',
      unit: '%',
      category: 'Proxy Metric',
      getter: (r) => r.maskFlickerPercent,
    },
    {
      name: 'Raw Connected Components / Frame',
      unit: 'blobs',
      category: 'Proxy Metric',
      getter: (r) => r.meanRawComponentsPerFrame ?? null,
    },
    {
      name: 'Cleaned Connected Components / Frame',
      unit: 'blobs',
      category: 'Proxy Metric',
      getter: (r) => r.meanComponentsPerFrame ?? null,
    },
    {
      name: 'Border Loss',
      unit: '%',
      category: 'Proxy Metric',
      getter: (r) => r.borderLossPercent,
    },
    {
      name: 'Mask Difference vs Baseline D0',
      unit: '%',
      category: 'Proxy Metric',
      getter: (r) => r.diffPixelsVsBaselinePercent ?? 0,
    },
    {
      name: 'Mean Latency per Frame',
      unit: 'ms',
      category: 'Runtime Metric',
      getter: (r) => r.meanLatencyMs,
    },
    {
      name: 'Throughput (FPS)',
      unit: 'FPS',
      category: 'Runtime Metric',
      getter: (r) => r.fps,
    },
  ];

  const entries: AblationComparisonEntry[] = [];
  for (const row of log.measuredRows) {
    const code = row.algorithmLabel.split('.')[0]?.trim() || row.experimentId;
    for (const m of metricsSpec) {
      const bVal = m.getter(baseline) ?? null;
      const vVal = m.getter(row) ?? null;
      const delta = computeSafeDelta(vVal, bVal);
      entries.push({
        variantCode: code,
        variantLabel: row.algorithmLabel,
        baselineLabel: baseline.algorithmLabel,
        metricName: m.name,
        unit: m.unit,
        category: m.category,
        baselineValue: bVal,
        variantValue: vVal,
        absoluteDifference: delta.absDiff,
        relativeDifferencePercent: delta.relDiffPct,
        zeroDenominatorNote: delta.note,
      });
    }
  }
  return entries;
}

/**
 * Generates 5-point evidence-grounded interpretations for an experiment run (Section 6.3).
 */
export function buildEvidenceGroundedInterpretations(
  log: TraceableExperimentLogEntry
): FivePointChartInterpretation[] {
  const rows = log.measuredRows;
  if (!rows || rows.length === 0) return [];
  const baseline = rows.find((r) => r.status === 'Baseline') ?? rows[0];
  const results: FivePointChartInterpretation[] = [];

  // 1. Stabilization / Residual Jitter Interpretation
  const withJitter = rows.filter(
    (r) => (r.remeasuredJitterRmsPx ?? r.jitterRmsPx) !== null
  );
  if (withJitter.length > 0) {
    const bestJitterRow = [...withJitter].sort(
      (a, b) =>
        (a.remeasuredJitterRmsPx ?? a.jitterRmsPx ?? 999) -
        (b.remeasuredJitterRmsPx ?? b.jitterRmsPx ?? 999)
    )[0];
    const baseJ = baseline.remeasuredJitterRmsPx ?? baseline.jitterRmsPx ?? 0;
    const bestJ =
      bestJitterRow.remeasuredJitterRmsPx ?? bestJitterRow.jitterRmsPx ?? 0;
    const deltaJ = computeSafeDelta(bestJ, baseJ);

    results.push({
      chartId: `${log.experimentId}-jitter`,
      chartTitle: 'Camera Jitter Attenuation & Residual Motion Analysis',
      metricCategory: 'Proxy Metric',
      whatIsCompared: `Comparing Input Camera Jitter RMS, Estimated Trajectory Smoothness, and Re-measured Output Residual Jitter across ${rows.length} configurations on "${log.datasetName}" (${log.videoMetadata.frameCount} frames).`,
      bestPerformingVariant: `${bestJitterRow.algorithmLabel} achieves the lowest re-measured residual output jitter at ${bestJ.toFixed(3)} px.`,
      magnitudeOfDifference: `Relative to ${baseline.algorithmLabel} (${baseJ.toFixed(3)} px), ${bestJitterRow.algorithmLabel} changes residual jitter by ${
        deltaJ.absDiff !== null ? `${deltaJ.absDiff >= 0 ? '+' : ''}${deltaJ.absDiff.toFixed(3)} px` : 'N/A'
      } (${
        deltaJ.relDiffPct !== null ? `${deltaJ.relDiffPct.toFixed(1)}%` : '0.0%'
      }).`,
      dspMechanismExplanation:
        'Pyramidal Lucas–Kanade tracks sparse Shi–Tomasi corners while 2D Similarity RANSAC rejects foreground outliers before low-pass trajectory smoothing (Gaussian vs Boxcar Moving-Average) attenuates high-frequency camera shake prior to inverse affine warping.',
      limitationOrTradeOff:
        'Geometric warping introduces invalid border pixels (Border Loss %) proportional to camera displacement amplitude and adds per-frame motion estimation latency.',
    });
  }

  // 2. Foreground Segmentation / Proxy Stability Interpretation
  const hasGt = rows.some((r) => r.iou !== null);
  if (hasGt) {
    const withIou = rows.filter((r) => r.iou !== null);
    const bestIouRow = [...withIou].sort((a, b) => (b.iou ?? 0) - (a.iou ?? 0))[0];
    const baseIou = (baseline.iou ?? 0) * 100;
    const bestIou = (bestIouRow.iou ?? 0) * 100;
    const deltaIou = computeSafeDelta(bestIou, baseIou);

    results.push({
      chartId: `${log.experimentId}-segmentation-gt`,
      chartTitle: 'Ground-Truth Foreground Segmentation Accuracy (IoU & F1)',
      metricCategory: 'Ground-Truth Metric',
      whatIsCompared: `Pixel-level segmentation IoU, F1-Score, Precision, and Recall across ${withIou.length} variants evaluated against Ground Truth masks on "${log.datasetName}".`,
      bestPerformingVariant: `${bestIouRow.algorithmLabel} achieves the highest mean IoU of ${bestIou.toFixed(2)}% (F1 = ${((bestIouRow.f1 ?? 0) * 100).toFixed(2)}%).`,
      magnitudeOfDifference: `Compared with ${baseline.algorithmLabel} (IoU = ${baseIou.toFixed(2)}%), the absolute difference is ${
        deltaIou.absDiff !== null ? `${deltaIou.absDiff >= 0 ? '+' : ''}${deltaIou.absDiff.toFixed(2)}%` : '0.00%'
      } (relative change: ${
        deltaIou.relDiffPct !== null ? `${deltaIou.relDiffPct.toFixed(1)}%` : '0.0%'
      }).`,
      dspMechanismExplanation:
        'Stabilizing camera motion prior to temporal background modeling aligns background pixel histories, preventing high-gradient background edges from triggering false foreground classifications. Morphological opening/closing then eliminates isolated noise and fills internal object holes.',
      limitationOrTradeOff:
        'Over-aggressive morphological filtering or high variance thresholds can erode thin object extremities and reduce Recall on small targets.',
    });
  } else {
    const withFlicker = rows.filter((r) => r.maskFlickerPercent !== null);
    if (withFlicker.length > 0) {
      const bestFlickerRow = [...withFlicker].sort(
        (a, b) => (a.maskFlickerPercent ?? 999) - (b.maskFlickerPercent ?? 999)
      )[0];
      const baseFl = baseline.maskFlickerPercent ?? 0;
      const bestFl = bestFlickerRow.maskFlickerPercent ?? 0;
      const deltaFl = computeSafeDelta(bestFl, baseFl);

      results.push({
        chartId: `${log.experimentId}-segmentation-proxy`,
        chartTitle: 'Unlabeled Video Foreground Stability (Flicker & Component Count)',
        metricCategory: 'Proxy Metric',
        whatIsCompared: `Temporal Mask Flicker (%), Foreground Ratio (%), and Connected Component Count across ${withFlicker.length} configurations on unlabeled video "${log.datasetName}" (Ground Truth Unavailable).`,
        bestPerformingVariant: `${bestFlickerRow.algorithmLabel} achieves the lowest temporal mask flicker of ${bestFl.toFixed(2)}% with ${(bestFlickerRow.meanComponentsPerFrame ?? 0).toFixed(1)} cleaned components/frame.`,
        magnitudeOfDifference: `Relative to ${baseline.algorithmLabel} (Flicker = ${baseFl.toFixed(2)}%, Components = ${(baseline.meanComponentsPerFrame ?? 0).toFixed(1)}), flicker changes by ${
          deltaFl.absDiff !== null ? `${deltaFl.absDiff.toFixed(2)}%` : '0.00%'
        }.`,
        dspMechanismExplanation:
          'When Ground Truth is unavailable, Temporal Mask Flicker and pre/post-morphology Connected Component counts quantify spatio-temporal mask coherence and noise suppression without fabricating IoU scores.',
        limitationOrTradeOff:
          'Proxy metrics measure temporal stability and blob compactness rather than semantic accuracy; a completely blank mask has zero flicker, so FG Ratio (%) and visual overlays must always be inspected together.',
      });
    }
  }

  // 3. Runtime Throughput Trade-off Interpretation
  const fastestRow = [...rows].sort((a, b) => a.meanLatencyMs - b.meanLatencyMs)[0];
  const slowestRow = [...rows].sort((a, b) => b.meanLatencyMs - a.meanLatencyMs)[0];
  results.push({
    chartId: `${log.experimentId}-runtime`,
    chartTitle: 'Computational Latency (ms/frame) & Throughput (FPS)',
    metricCategory: 'Runtime Metric',
    whatIsCompared: `Per-frame execution time (ms/frame) and frame rate (FPS) across ${rows.length} configurations at resolution ${log.videoMetadata.resolution}.`,
    bestPerformingVariant: `${fastestRow.algorithmLabel} executes fastest at ${fastestRow.meanLatencyMs.toFixed(2)} ms/frame (${fastestRow.fps.toFixed(1)} FPS).`,
    magnitudeOfDifference: `The heaviest configuration (${slowestRow.algorithmLabel}) requires ${slowestRow.meanLatencyMs.toFixed(2)} ms/frame (${slowestRow.fps.toFixed(1)} FPS), a difference of +${(slowestRow.meanLatencyMs - fastestRow.meanLatencyMs).toFixed(2)} ms/frame.`,
    dspMechanismExplanation:
      'Sparse pyramidal Lucas–Kanade scales with tracked corner count O(K), whereas dense iterative ECC alignment and multi-sample per-pixel background maintenance scale with total pixel count O(W×H).',
    limitationOrTradeOff:
      'Browser WebAssembly execution shares memory bandwidth with Canvas rendering; higher accuracy algorithms require balancing resolution and iteration limits for real-time throughput.',
  });

  return results;
}

function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return 'N/A';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildSummaryCsvString(log: TraceableExperimentLogEntry): string {
  const headers = [
    'Experiment_ID',
    'Group',
    'Dataset',
    'Algorithm_Variant',
    'Status',
    'Bypass_Or_Config_Note',
    'IoU_Percent',
    'F1_Percent',
    'Precision_Percent',
    'Recall_Percent',
    'FPR_Percent',
    'FNR_Percent',
    'PWC_Error_Percent',
    'Translation_RMSE_Px',
    'Rotation_RMSE_Deg',
    'Input_Jitter_RMS_Px',
    'Estimated_Trajectory_Jitter_RMS_Px',
    'Remeasured_Output_Jitter_RMS_Px',
    'Jitter_Reduction_Percent',
    'Inlier_Ratio_Percent',
    'ECC_Convergence_Percent',
    'FG_Ratio_Percent',
    'Raw_Components_Per_Frame',
    'Cleaned_Components_Per_Frame',
    'Mask_Flicker_Percent',
    'Border_Loss_Percent',
    'Mask_Diff_Vs_Baseline_Percent',
    'Mean_Latency_Ms',
    'Median_Latency_Ms',
    'StdDev_Latency_Ms',
    'FPS',
  ];

  const lines = [headers.join(',')];
  for (const r of log.measuredRows) {
    const jitterRed = computeSafeJitterReductionPercent(
      r.rawInputJitterRmsPx,
      r.remeasuredJitterRmsPx ?? r.jitterRmsPx
    );
    const rowVals = [
      r.experimentId,
      r.group,
      r.datasetName,
      r.algorithmLabel,
      r.status,
      r.bypassNote ?? r.configSummary,
      r.iou !== null ? (r.iou * 100).toFixed(3) : 'N/A — Ground Truth Unavailable',
      r.f1 !== null ? (r.f1 * 100).toFixed(3) : 'N/A — Ground Truth Unavailable',
      r.precision !== null ? (r.precision * 100).toFixed(3) : 'N/A',
      r.recall !== null ? (r.recall * 100).toFixed(3) : 'N/A',
      r.fpr !== null ? (r.fpr * 100).toFixed(3) : 'N/A',
      r.fnr !== null ? (r.fnr * 100).toFixed(3) : 'N/A',
      r.pwcErrorPercent !== null ? r.pwcErrorPercent.toFixed(3) : 'N/A',
      r.translationRmsePx !== null ? r.translationRmsePx.toFixed(4) : 'N/A',
      r.rotationRmseDeg !== null ? r.rotationRmseDeg.toFixed(4) : 'N/A',
      r.rawInputJitterRmsPx !== null && r.rawInputJitterRmsPx !== undefined
        ? r.rawInputJitterRmsPx.toFixed(4)
        : 'N/A',
      r.jitterRmsPx !== null ? r.jitterRmsPx.toFixed(4) : 'N/A',
      r.remeasuredJitterRmsPx !== null && r.remeasuredJitterRmsPx !== undefined
        ? r.remeasuredJitterRmsPx.toFixed(4)
        : 'N/A',
      jitterRed !== null ? jitterRed.toFixed(2) : 'N/A',
      r.inlierRatioPercent !== null ? (r.inlierRatioPercent * 100).toFixed(2) : 'N/A',
      r.eccConvergencePercent !== null ? (r.eccConvergencePercent * 100).toFixed(2) : 'N/A',
      r.fgRatioPercent !== null && r.fgRatioPercent !== undefined
        ? r.fgRatioPercent.toFixed(3)
        : 'N/A',
      r.meanRawComponentsPerFrame !== null && r.meanRawComponentsPerFrame !== undefined
        ? r.meanRawComponentsPerFrame.toFixed(2)
        : 'N/A',
      r.meanComponentsPerFrame !== null && r.meanComponentsPerFrame !== undefined
        ? r.meanComponentsPerFrame.toFixed(2)
        : 'N/A',
      r.maskFlickerPercent !== null ? r.maskFlickerPercent.toFixed(3) : 'N/A',
      r.borderLossPercent !== null ? r.borderLossPercent.toFixed(2) : 'N/A',
      r.diffPixelsVsBaselinePercent !== null && r.diffPixelsVsBaselinePercent !== undefined
        ? r.diffPixelsVsBaselinePercent.toFixed(3)
        : '0.000',
      r.meanLatencyMs.toFixed(3),
      r.medianLatencyMs.toFixed(3),
      r.stdDevLatencyMs.toFixed(3),
      r.fps.toFixed(2),
    ];
    lines.push(rowVals.map(escapeCsvCell).join(','));
  }
  return lines.join('\n');
}

export function buildPerFrameCsvString(records: PerFrameExportRecord[] | undefined): string {
  const headers = [
    'Experiment_ID',
    'Group',
    'Variant_Code',
    'Algorithm_Label',
    'Dataset',
    'Frame_Index',
    'dx_px',
    'dy_px',
    'da_deg',
    'corrDx_px',
    'corrDy_px',
    'Inliers_Count',
    'Total_Features',
    'Inlier_Ratio_Percent',
    'ECC_Converged',
    'Valid_Area_Percent',
    'Border_Loss_Percent',
    'FG_Ratio_Percent',
    'Flicker_Percent',
    'Raw_Component_Count',
    'Cleaned_Component_Count',
    'TP',
    'FP',
    'FN',
    'TN',
    'IoU_Percent',
    'F1_Percent',
    'Precision_Percent',
    'Recall_Percent',
    'Diff_Vs_Baseline_Percent',
    'Processing_Time_Ms',
  ];
  const lines = [headers.join(',')];
  if (!records || records.length === 0) return lines.join('\n');

  for (const rec of records) {
    const row = [
      rec.experimentId,
      rec.group,
      rec.variantCode,
      rec.algorithmLabel,
      rec.datasetName,
      rec.frameIndex,
      rec.dxPx !== null && rec.dxPx !== undefined ? rec.dxPx.toFixed(4) : 'N/A',
      rec.dyPx !== null && rec.dyPx !== undefined ? rec.dyPx.toFixed(4) : 'N/A',
      rec.daDeg !== null && rec.daDeg !== undefined ? rec.daDeg.toFixed(4) : 'N/A',
      rec.corrDxPx !== null && rec.corrDxPx !== undefined ? rec.corrDxPx.toFixed(4) : 'N/A',
      rec.corrDyPx !== null && rec.corrDyPx !== undefined ? rec.corrDyPx.toFixed(4) : 'N/A',
      rec.inliersCount ?? 'N/A',
      rec.totalFeatures ?? 'N/A',
      rec.inlierRatioPercent !== null && rec.inlierRatioPercent !== undefined
        ? rec.inlierRatioPercent.toFixed(2)
        : 'N/A',
      rec.eccConverged ?? 'N/A',
      rec.validAreaPercent !== null && rec.validAreaPercent !== undefined
        ? rec.validAreaPercent.toFixed(2)
        : 'N/A',
      rec.borderLossPercent !== null && rec.borderLossPercent !== undefined
        ? rec.borderLossPercent.toFixed(2)
        : 'N/A',
      rec.fgRatioPercent !== null && rec.fgRatioPercent !== undefined
        ? rec.fgRatioPercent.toFixed(3)
        : 'N/A',
      rec.flickerPercent !== null && rec.flickerPercent !== undefined
        ? rec.flickerPercent.toFixed(3)
        : 'N/A',
      rec.rawComponentCount ?? 'N/A',
      rec.cleanedComponentCount ?? 'N/A',
      rec.tp ?? 'N/A',
      rec.fp ?? 'N/A',
      rec.fn ?? 'N/A',
      rec.tn ?? 'N/A',
      rec.iouPercent !== null && rec.iouPercent !== undefined
        ? rec.iouPercent.toFixed(3)
        : 'N/A',
      rec.f1Percent !== null && rec.f1Percent !== undefined
        ? rec.f1Percent.toFixed(3)
        : 'N/A',
      rec.precisionPercent !== null && rec.precisionPercent !== undefined
        ? rec.precisionPercent.toFixed(3)
        : 'N/A',
      rec.recallPercent !== null && rec.recallPercent !== undefined
        ? rec.recallPercent.toFixed(3)
        : 'N/A',
      rec.diffVsBaselinePercent !== null && rec.diffVsBaselinePercent !== undefined
        ? rec.diffVsBaselinePercent.toFixed(3)
        : '0.000',
      rec.processingTimeMs.toFixed(3),
    ];
    lines.push(row.map(escapeCsvCell).join(','));
  }
  return lines.join('\n');
}

export function buildAblationComparisonCsvString(
  entries: AblationComparisonEntry[]
): string {
  const headers = [
    'Variant_Code',
    'Variant_Label',
    'Baseline_Label',
    'Metric_Name',
    'Unit',
    'Category',
    'Baseline_Value',
    'Variant_Value',
    'Absolute_Difference_Variant_Minus_Baseline',
    'Relative_Difference_Percent',
    'Note',
  ];
  const lines = [headers.join(',')];
  for (const e of entries) {
    lines.push(
      [
        e.variantCode,
        e.variantLabel,
        e.baselineLabel,
        e.metricName,
        e.unit,
        e.category,
        e.baselineValue !== null ? e.baselineValue.toFixed(4) : 'N/A',
        e.variantValue !== null ? e.variantValue.toFixed(4) : 'N/A',
        e.absoluteDifference !== null ? e.absoluteDifference.toFixed(4) : 'N/A',
        e.relativeDifferencePercent !== null
          ? `${e.relativeDifferencePercent.toFixed(2)}%`
          : 'N/A',
        e.zeroDenominatorNote ?? '',
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  }
  return lines.join('\n');
}

export function buildStatisticalSummaryCsvString(
  log: TraceableExperimentLogEntry
): string {
  const headers = [
    'Experiment_ID',
    'Metric_Name',
    'Unit',
    'Method_A',
    'Method_B',
    'Sample_Size_N_Frames',
    'Mean_A',
    'Mean_B',
    'Mean_Difference_B_Minus_A',
    'Median_Difference',
    'StdDev_Difference',
    'Min_A',
    'Max_A',
    'Min_B',
    'Max_B',
    'Parametric_CI95_Lower',
    'Parametric_CI95_Upper',
    'Block_Bootstrap_CI95_Lower',
    'Block_Bootstrap_CI95_Upper',
    'Paired_t_Stat',
    'Paired_t_pValue',
    'Wilcoxon_W',
    'Wilcoxon_pValue',
    'Cohens_dz',
    'Effect_Magnitude',
    'Bootstrap_Note',
  ];
  const lines = [headers.join(',')];
  for (const st of log.pairedStats ?? []) {
    lines.push(
      [
        log.experimentId,
        st.metricName,
        st.unit,
        st.methodAName,
        st.methodBName,
        st.sampleSizeN,
        st.meanA.toFixed(4),
        st.meanB.toFixed(4),
        st.meanDifference.toFixed(4),
        st.medianDifference.toFixed(4),
        st.stdDevDifference.toFixed(4),
        st.boxPlotA.min.toFixed(4),
        st.boxPlotA.max.toFixed(4),
        st.boxPlotB.min.toFixed(4),
        st.boxPlotB.max.toFixed(4),
        st.confidenceInterval95[0].toFixed(4),
        st.confidenceInterval95[1].toFixed(4),
        st.blockBootstrapCi95[0].toFixed(4),
        st.blockBootstrapCi95[1].toFixed(4),
        st.pairedTTest.tStatistic.toFixed(4),
        st.pairedTTest.pValueTwoTailed.toFixed(5),
        st.wilcoxonSignedRank.wStatistic.toFixed(2),
        st.wilcoxonSignedRank.pValueTwoTailed.toFixed(5),
        st.cohensDzEffectSize.toFixed(4),
        st.effectMagnitudeLabel,
        'Moving-block bootstrap (B=1000 resamples, 95% confidence level, deterministic seed=42, block_size=N^(1/3))',
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  }
  return lines.join('\n');
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function colIndexToLetter(colIdx0: number): string {
  let n = colIdx0;
  let letter = '';
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

function buildWorksheetXml(rows: (string | number | null | undefined)[][]): string {
  const maxCols = rows.reduce((m, r) => Math.max(m, r.length), 1);
  let colsXml = '<cols>';
  for (let c = 1; c <= maxCols; c++) {
    colsXml += `<col min="${c}" max="${c}" width="22" customWidth="1"/>`;
  }
  colsXml += '</cols>';

  let sheetDataXml = '<sheetData>';
  for (let rIdx = 0; rIdx < rows.length; rIdx++) {
    const row = rows[rIdx];
    const rowNum = rIdx + 1;
    const isHeader = rIdx === 0;
    sheetDataXml += `<row r="${rowNum}">`;
    for (let cIdx = 0; cIdx < row.length; cIdx++) {
      const cellRef = `${colIndexToLetter(cIdx)}${rowNum}`;
      const val = row[cIdx];
      const styleAttr = isHeader ? ' s="1"' : '';
      if (typeof val === 'number' && Number.isFinite(val)) {
        sheetDataXml += `<c r="${cellRef}" t="n"${styleAttr}><v>${val}</v></c>`;
      } else {
        const text =
          val === null || val === undefined ? 'N/A' : String(val);
        sheetDataXml += `<c r="${cellRef}" t="inlineStr"${styleAttr}><is><t>${escapeXml(
          text
        )}</t></is></c>`;
      }
    }
    sheetDataXml += '</row>';
  }
  sheetDataXml += '</sheetData>';

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  ${colsXml}
  ${sheetDataXml}
</worksheet>`;
}

/**
 * Generates a standards-compliant OpenXML multi-worksheet Excel (.xlsx) binary Blob
 * containing all 7 mandatory worksheets required in Section 7.4:
 * 1. Experiment Summary
 * 2. Per Video Results
 * 3. Per Frame Results
 * 4. Ablation Comparison
 * 5. Statistical Analysis
 * 6. Configuration
 * 7. Metric Definitions
 */
export async function generateResultsWorkbookXlsxBlob(
  log: TraceableExperimentLogEntry,
  sensitivitySweeps?: ParameterSensitivitySweepResult[]
): Promise<Blob> {
  const zip = new JSZip();

  const ablationEntries = buildAblationComparisonEntries(log);

  // Sheet 1: Experiment Summary
  const sheet1Rows: (string | number | null)[][] = [
    [
      'Experiment ID',
      'Timestamp',
      'Experiment Group',
      'Research Question',
      'Hypothesis',
      'Dataset Name',
      'Resolution',
      'Total Frames',
      'Sampling FPS',
      'Ground Truth Mask Available',
      'Camera Ground Truth Available',
      'Verdict',
      'Conclusion Summary',
    ],
    [
      log.experimentId,
      log.timestamp,
      log.group,
      log.rqId,
      log.hypothesisId,
      log.datasetName,
      log.videoMetadata.resolution,
      log.videoMetadata.frameCount,
      log.videoMetadata.fps,
      log.videoMetadata.hasGroundTruth ? 'Yes' : 'No (N/A — Ground Truth Unavailable)',
      log.videoMetadata.hasCameraGroundTruth ? 'Yes' : 'No',
      log.hypothesisVerdict,
      log.conclusionVi,
    ],
  ];

  // Sheet 2: Per Video Results (All Variants)
  const sheet2Rows: (string | number | null)[][] = [
    [
      'Variant ID',
      'Group',
      'Dataset',
      'Algorithm / Variant Label',
      'Status',
      'Configuration / Bypass Note',
      'IoU (%)',
      'F1-Score (%)',
      'Precision (%)',
      'Recall (%)',
      'FPR (%)',
      'FNR (%)',
      'PWC Error (%)',
      'Translation RMSE (px)',
      'Rotation RMSE (deg)',
      'Input Jitter RMS (px)',
      'Estimated Trajectory Smoothness Jitter (px)',
      'Re-measured Output Jitter RMS (px)',
      'Jitter Reduction (%)',
      'RANSAC Inlier Ratio (%)',
      'ECC Convergence Rate (%)',
      'Foreground Ratio (%)',
      'Raw Components / Frame',
      'Cleaned Components / Frame',
      'Temporal Mask Flicker (%)',
      'Border Loss (%)',
      'Mask Diff vs Baseline (%)',
      'Mean Latency (ms/frame)',
      'Median Latency (ms/frame)',
      'FPS',
    ],
  ];

  for (const r of log.measuredRows) {
    const jitterRed = computeSafeJitterReductionPercent(
      r.rawInputJitterRmsPx,
      r.remeasuredJitterRmsPx ?? r.jitterRmsPx
    );
    sheet2Rows.push([
      r.experimentId,
      r.group,
      r.datasetName,
      r.algorithmLabel,
      r.status,
      r.bypassNote ?? r.configSummary,
      r.iou !== null ? Number((r.iou * 100).toFixed(3)) : 'N/A — Ground Truth Unavailable',
      r.f1 !== null ? Number((r.f1 * 100).toFixed(3)) : 'N/A — Ground Truth Unavailable',
      r.precision !== null ? Number((r.precision * 100).toFixed(3)) : 'N/A',
      r.recall !== null ? Number((r.recall * 100).toFixed(3)) : 'N/A',
      r.fpr !== null ? Number((r.fpr * 100).toFixed(3)) : 'N/A',
      r.fnr !== null ? Number((r.fnr * 100).toFixed(3)) : 'N/A',
      r.pwcErrorPercent !== null ? Number(r.pwcErrorPercent.toFixed(3)) : 'N/A',
      r.translationRmsePx !== null ? Number(r.translationRmsePx.toFixed(4)) : 'N/A',
      r.rotationRmseDeg !== null ? Number(r.rotationRmseDeg.toFixed(4)) : 'N/A',
      r.rawInputJitterRmsPx !== null && r.rawInputJitterRmsPx !== undefined
        ? Number(r.rawInputJitterRmsPx.toFixed(4))
        : 'N/A',
      r.jitterRmsPx !== null ? Number(r.jitterRmsPx.toFixed(4)) : 'N/A',
      r.remeasuredJitterRmsPx !== null && r.remeasuredJitterRmsPx !== undefined
        ? Number(r.remeasuredJitterRmsPx.toFixed(4))
        : 'N/A',
      jitterRed !== null ? Number(jitterRed.toFixed(2)) : 'N/A',
      r.inlierRatioPercent !== null ? Number((r.inlierRatioPercent * 100).toFixed(2)) : 'N/A',
      r.eccConvergencePercent !== null ? Number((r.eccConvergencePercent * 100).toFixed(2)) : 'N/A',
      r.fgRatioPercent !== null && r.fgRatioPercent !== undefined
        ? Number(r.fgRatioPercent.toFixed(3))
        : 'N/A',
      r.meanRawComponentsPerFrame !== null && r.meanRawComponentsPerFrame !== undefined
        ? Number(r.meanRawComponentsPerFrame.toFixed(2))
        : 'N/A',
      r.meanComponentsPerFrame !== null && r.meanComponentsPerFrame !== undefined
        ? Number(r.meanComponentsPerFrame.toFixed(2))
        : 'N/A',
      r.maskFlickerPercent !== null ? Number(r.maskFlickerPercent.toFixed(3)) : 'N/A',
      r.borderLossPercent !== null ? Number(r.borderLossPercent.toFixed(2)) : 'N/A',
      r.diffPixelsVsBaselinePercent !== null && r.diffPixelsVsBaselinePercent !== undefined
        ? Number(r.diffPixelsVsBaselinePercent.toFixed(3))
        : 0,
      Number(r.meanLatencyMs.toFixed(3)),
      Number(r.medianLatencyMs.toFixed(3)),
      Number(r.fps.toFixed(2)),
    ]);
  }

  // Sheet 3: Per Frame Results
  const sheet3Rows: (string | number | null)[][] = [
    [
      'Experiment ID',
      'Variant Code',
      'Algorithm Label',
      'Dataset',
      'Frame Index',
      'dx (px)',
      'dy (px)',
      'da (deg)',
      'corrDx (px)',
      'corrDy (px)',
      'Inliers Count',
      'Total Features',
      'Inlier Ratio (%)',
      'Valid Area (%)',
      'Border Loss (%)',
      'FG Ratio (%)',
      'Mask Flicker (%)',
      'Raw Components',
      'Cleaned Components',
      'IoU (%)',
      'F1 (%)',
      'Diff vs Baseline (%)',
      'Processing Time (ms)',
    ],
  ];
  for (const rec of log.perFrameRecords ?? []) {
    sheet3Rows.push([
      rec.experimentId,
      rec.variantCode,
      rec.algorithmLabel,
      rec.datasetName,
      rec.frameIndex,
      rec.dxPx !== null && rec.dxPx !== undefined ? Number(rec.dxPx.toFixed(4)) : 'N/A',
      rec.dyPx !== null && rec.dyPx !== undefined ? Number(rec.dyPx.toFixed(4)) : 'N/A',
      rec.daDeg !== null && rec.daDeg !== undefined ? Number(rec.daDeg.toFixed(4)) : 'N/A',
      rec.corrDxPx !== null && rec.corrDxPx !== undefined ? Number(rec.corrDxPx.toFixed(4)) : 'N/A',
      rec.corrDyPx !== null && rec.corrDyPx !== undefined ? Number(rec.corrDyPx.toFixed(4)) : 'N/A',
      rec.inliersCount ?? 'N/A',
      rec.totalFeatures ?? 'N/A',
      rec.inlierRatioPercent !== null && rec.inlierRatioPercent !== undefined
        ? Number(rec.inlierRatioPercent.toFixed(2))
        : 'N/A',
      rec.validAreaPercent !== null && rec.validAreaPercent !== undefined
        ? Number(rec.validAreaPercent.toFixed(2))
        : 'N/A',
      rec.borderLossPercent !== null && rec.borderLossPercent !== undefined
        ? Number(rec.borderLossPercent.toFixed(2))
        : 'N/A',
      rec.fgRatioPercent !== null && rec.fgRatioPercent !== undefined
        ? Number(rec.fgRatioPercent.toFixed(3))
        : 'N/A',
      rec.flickerPercent !== null && rec.flickerPercent !== undefined
        ? Number(rec.flickerPercent.toFixed(3))
        : 'N/A',
      rec.rawComponentCount ?? 'N/A',
      rec.cleanedComponentCount ?? 'N/A',
      rec.iouPercent !== null && rec.iouPercent !== undefined
        ? Number(rec.iouPercent.toFixed(3))
        : 'N/A',
      rec.f1Percent !== null && rec.f1Percent !== undefined
        ? Number(rec.f1Percent.toFixed(3))
        : 'N/A',
      rec.diffVsBaselinePercent !== null && rec.diffVsBaselinePercent !== undefined
        ? Number(rec.diffVsBaselinePercent.toFixed(3))
        : 0,
      Number(rec.processingTimeMs.toFixed(3)),
    ]);
  }

  // Sheet 4: Ablation Comparison
  const sheet4Rows: (string | number | null)[][] = [
    [
      'Variant Code',
      'Variant Label',
      'Baseline Label',
      'Metric Name',
      'Unit',
      'Category',
      'Baseline Value',
      'Variant Value',
      'Absolute Difference (Variant - Baseline)',
      'Relative Difference (%)',
      'Note',
    ],
  ];
  for (const e of ablationEntries) {
    sheet4Rows.push([
      e.variantCode,
      e.variantLabel,
      e.baselineLabel,
      e.metricName,
      e.unit,
      e.category,
      e.baselineValue !== null ? Number(e.baselineValue.toFixed(4)) : 'N/A',
      e.variantValue !== null ? Number(e.variantValue.toFixed(4)) : 'N/A',
      e.absoluteDifference !== null ? Number(e.absoluteDifference.toFixed(4)) : 'N/A',
      e.relativeDifferencePercent !== null
        ? Number(e.relativeDifferencePercent.toFixed(2))
        : 'N/A',
      e.zeroDenominatorNote ?? '',
    ]);
  }

  // Sheet 5: Statistical Analysis
  const sheet5Rows: (string | number | null)[][] = [
    [
      'Metric Name',
      'Unit',
      'Method A',
      'Method B',
      'Sample Size (Valid Frames)',
      'Mean A',
      'Mean B',
      'Mean Difference (B - A)',
      'Median Difference',
      'StdDev Difference',
      'Min A',
      'Max A',
      'Min B',
      'Max B',
      'Parametric 95% CI Lower',
      'Parametric 95% CI Upper',
      'Block Bootstrap 95% CI Lower',
      'Block Bootstrap 95% CI Upper',
      'Paired t-Statistic',
      'Paired t p-Value',
      'Wilcoxon W',
      'Wilcoxon p-Value',
      'Cohens dz',
      'Effect Magnitude',
      'Resampling Specification',
    ],
  ];
  for (const st of log.pairedStats ?? []) {
    sheet5Rows.push([
      st.metricName,
      st.unit,
      st.methodAName,
      st.methodBName,
      st.sampleSizeN,
      Number(st.meanA.toFixed(4)),
      Number(st.meanB.toFixed(4)),
      Number(st.meanDifference.toFixed(4)),
      Number(st.medianDifference.toFixed(4)),
      Number(st.stdDevDifference.toFixed(4)),
      Number(st.boxPlotA.min.toFixed(4)),
      Number(st.boxPlotA.max.toFixed(4)),
      Number(st.boxPlotB.min.toFixed(4)),
      Number(st.boxPlotB.max.toFixed(4)),
      Number(st.confidenceInterval95[0].toFixed(4)),
      Number(st.confidenceInterval95[1].toFixed(4)),
      Number(st.blockBootstrapCi95[0].toFixed(4)),
      Number(st.blockBootstrapCi95[1].toFixed(4)),
      Number(st.pairedTTest.tStatistic.toFixed(4)),
      Number(st.pairedTTest.pValueTwoTailed.toFixed(5)),
      Number(st.wilcoxonSignedRank.wStatistic.toFixed(2)),
      Number(st.wilcoxonSignedRank.pValueTwoTailed.toFixed(5)),
      Number(st.cohensDzEffectSize.toFixed(4)),
      st.effectMagnitudeLabel,
      'Resampling unit: temporal frame block; Bootstrap samples B=1000; Confidence level=95%; Deterministic seed=42',
    ]);
  }
  if ((log.pairedStats ?? []).length === 0 && sensitivitySweeps && sensitivitySweeps.length > 0) {
    for (const sw of sensitivitySweeps) {
      for (const pt of sw.points) {
        sheet5Rows.push([
          `Sensitivity Sweep: ${sw.parameterNameVi}`,
          pt.paramLabel,
          sw.datasetName,
          `Value = ${pt.paramValue}`,
          log.videoMetadata.frameCount,
          pt.iou ?? 'N/A',
          pt.remeasuredJitterRmsPx ?? pt.jitterRmsPx ?? 'N/A',
          pt.maskFlickerPercent ?? 'N/A',
          pt.fps,
          pt.latencyMs,
          'N/A',
          'N/A',
          'N/A',
          'N/A',
          'N/A',
          'N/A',
          'N/A',
          'N/A',
          'N/A',
          'N/A',
          'N/A',
          'N/A',
          'N/A',
          'Parameter Sweep',
          sw.optimalValueNoteVi,
        ]);
      }
    }
  }

  // Sheet 6: Configuration
  const cfg = log.reproducibleConfigJson;
  const sheet6Rows: (string | number | null)[][] = [
    ['Parameter Group', 'Parameter Name', 'Configured Value'],
    ['Metadata', 'Experiment ID', log.experimentId],
    ['Metadata', 'Dataset Name', log.datasetName],
    ['Metadata', 'Resolution', log.videoMetadata.resolution],
    ['Metadata', 'Frame Count', log.videoMetadata.frameCount],
    ['Metadata', 'Sampling FPS', log.videoMetadata.fps],
    ['Stabilization', 'Method', cfg.stabilizationMethod],
    ['Stabilization', 'Max Corners (Shi-Tomasi)', cfg.stabilizationParams.maxCorners],
    ['Stabilization', 'Quality Level', cfg.stabilizationParams.qualityLevel],
    ['Stabilization', 'Min Distance (px)', cfg.stabilizationParams.minDistance],
    ['Stabilization', 'RANSAC Threshold (px)', cfg.stabilizationParams.ransacThreshold],
    ['Stabilization', 'Smoothing Radius R (frames)', cfg.stabilizationParams.smoothingRadius],
    [
      'Stabilization',
      'Trajectory Mode',
      cfg.stabilizationParams.trajectoryMode ?? 'gaussian_smooth',
    ],
    ['Stabilization', 'Crop Ratio', cfg.stabilizationParams.cropRatio],
    ['Stabilization', 'ECC Max Iterations', cfg.stabilizationParams.eccIterations],
    ['Background', 'Method', cfg.backgroundMethod],
    ['Background (Frame Diff)', 'Threshold', cfg.frameDiffParams.threshold],
    ['Background (Frame Diff)', 'Reference Mode', cfg.frameDiffParams.referenceMode],
    ['Background (MOG2)', 'History', cfg.mog2Params.history],
    ['Background (MOG2)', 'Variance Threshold', cfg.mog2Params.varThreshold],
    ['Background (MOG2)', 'Learning Rate', cfg.mog2Params.learningRate],
    ['Background (MOG2)', 'Detect Shadows', String(cfg.mog2Params.detectShadows)],
    ['Background (Sample KNN)', 'Samples N', cfg.sampleKnnParams.numSamples],
    ['Background (Sample KNN)', 'K Neighbors', cfg.sampleKnnParams.kNeighbors],
    ['Background (Sample KNN)', 'Distance Threshold R', cfg.sampleKnnParams.distanceThreshold],
    ['Morphology', 'Gaussian Blur Enabled', String(cfg.morphologyConfig.enableGaussianBlur)],
    ['Morphology', 'Gaussian Kernel Size', cfg.morphologyConfig.gaussianKernelSize],
    ['Morphology', 'Opening Enabled', String(cfg.morphologyConfig.enableOpening)],
    ['Morphology', 'Opening Kernel Size', cfg.morphologyConfig.openingKernelSize],
    ['Morphology', 'Closing Enabled', String(cfg.morphologyConfig.enableClosing)],
    ['Morphology', 'Closing Kernel Size', cfg.morphologyConfig.closingKernelSize],
    ['Morphology', 'Min Component Area (px²)', cfg.morphologyConfig.minComponentArea],
  ];

  // Sheet 7: Metric Definitions
  const sheet7Rows: (string | number | null)[][] = [
    ['Metric Name', 'Unit', 'Category', 'Mathematical Formula', 'DSP Interpretation'],
    ...METRIC_DEFINITIONS_TABLE.map((m) => [
      m.metric,
      m.unit,
      m.category,
      m.formula,
      m.interpretation,
    ]),
  ];

  const sheets = [
    { name: 'Experiment Summary', rows: sheet1Rows },
    { name: 'Per Video Results', rows: sheet2Rows },
    { name: 'Per Frame Results', rows: sheet3Rows },
    { name: 'Ablation Comparison', rows: sheet4Rows },
    { name: 'Statistical Analysis', rows: sheet5Rows },
    { name: 'Configuration', rows: sheet6Rows },
    { name: 'Metric Definitions', rows: sheet7Rows },
  ];

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${sheets
    .map(
      (_, i) =>
        `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join('\n  ')}
</Types>`
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
  );

  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${sheets
      .map(
        (s, i) =>
          `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`
      )
      .join('\n    ')}
  </sheets>
</workbook>`
  );

  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheets
    .map(
      (_, i) =>
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
    )
    .join('\n  ')}
  <Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
  );

  zip.file(
    'xl/styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="10"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1E293B"/></patternFill></fill>
  </fills>
  <borders count="1">
    <border><left/><right/><top/><bottom/><diagonal/></border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
  </cellXfs>
</styleSheet>`
  );

  for (let i = 0; i < sheets.length; i++) {
    zip.file(`xl/worksheets/sheet${i + 1}.xml`, buildWorksheetXml(sheets[i].rows));
  }

  return await zip.generateAsync({
    type: 'blob',
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Generates a clean, publication-grade SVG chart from an experiment log entry.
 */
export function generateExperimentChartSvg(
  log: TraceableExperimentLogEntry,
  chartType: 'primary_metrics' | 'jitter_comparison' | 'runtime_comparison'
): string {
  const width = 920;
  const height = 460;
  const padLeft = 75;
  const padRight = 40;
  const padTop = 75;
  const padBottom = 95;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const rows = log.measuredRows;
  const hasGt = rows.some((r) => r.iou !== null);

  let title = '';
  let yAxisLabel = '';
  let seriesAName = '';
  let seriesBName = '';
  let valuesA: number[] = [];
  let valuesB: number[] = [];
  let colorA = '#2563EB';
  let colorB = '#0D9488';

  if (chartType === 'jitter_comparison') {
    title = `${log.group} — Camera Jitter RMS: Estimated Smoothness vs Re-measured Residual (px)`;
    yAxisLabel = 'Jitter RMS (px)';
    seriesAName = 'Estimated Trajectory Smoothness Jitter (px)';
    seriesBName = 'Re-measured Output Residual Jitter (px)';
    valuesA = rows.map((r) => r.jitterRmsPx ?? 0);
    valuesB = rows.map((r) => r.remeasuredJitterRmsPx ?? r.jitterRmsPx ?? 0);
    colorA = '#0284C7';
    colorB = '#D97706';
  } else if (chartType === 'runtime_comparison') {
    title = `${log.group} — Computational Latency (ms/frame) & Throughput (FPS)`;
    yAxisLabel = 'Value (ms/frame or FPS)';
    seriesAName = 'Mean Latency (ms/frame)';
    seriesBName = 'Throughput (FPS)';
    valuesA = rows.map((r) => r.meanLatencyMs);
    valuesB = rows.map((r) => r.fps);
    colorA = '#DC2626';
    colorB = '#16A34A';
  } else {
    if (hasGt) {
      title = `${log.group} — Ground-Truth Segmentation IoU (%) & F1-Score (%)`;
      yAxisLabel = 'Percentage (%)';
      seriesAName = 'IoU (%)';
      seriesBName = 'F1-Score (%)';
      valuesA = rows.map((r) => (r.iou ?? 0) * 100);
      valuesB = rows.map((r) => (r.f1 ?? 0) * 100);
    } else {
      title = `${log.group} — Foreground Ratio (%) & Temporal Mask Flicker (%)`;
      yAxisLabel = 'Percentage (%)';
      seriesAName = 'Foreground Ratio (%)';
      seriesBName = 'Temporal Mask Flicker (%)';
      valuesA = rows.map((r) => r.fgRatioPercent ?? 0);
      valuesB = rows.map((r) => r.maskFlickerPercent ?? 0);
    }
  }

  const maxVal = Math.max(1, ...valuesA, ...valuesB) * 1.15;
  const n = Math.max(1, rows.length);
  const groupW = plotW / n;
  const barW = Math.min(34, Math.max(12, groupW * 0.32));

  let gridLines = '';
  for (let i = 0; i <= 5; i++) {
    const val = (maxVal * i) / 5;
    const y = padTop + plotH - (plotH * i) / 5;
    gridLines += `<line x1="${padLeft}" y1="${y.toFixed(1)}" x2="${
      width - padRight
    }" y2="${y.toFixed(1)}" stroke="#E2E8F0" stroke-width="1"/>`;
    gridLines += `<text x="${padLeft - 10}" y="${(y + 4).toFixed(
      1
    )}" text-anchor="end" font-family="monospace" font-size="11" fill="#475569">${val.toFixed(
      2
    )}</text>`;
  }

  let barsXml = '';
  for (let i = 0; i < rows.length; i++) {
    const cx = padLeft + groupW * (i + 0.5);
    const vA = valuesA[i] ?? 0;
    const vB = valuesB[i] ?? 0;
    const hA = (vA / maxVal) * plotH;
    const hB = (vB / maxVal) * plotH;
    const yA = padTop + plotH - hA;
    const yB = padTop + plotH - hB;
    const shortLabel =
      rows[i].algorithmLabel.length > 22
        ? rows[i].algorithmLabel.slice(0, 20) + '…'
        : rows[i].algorithmLabel;

    barsXml += `<rect x="${(cx - barW - 2).toFixed(1)}" y="${yA.toFixed(
      1
    )}" width="${barW}" height="${Math.max(1, hA).toFixed(
      1
    )}" fill="${colorA}" rx="2"/>`;
    barsXml += `<text x="${(cx - barW / 2 - 2).toFixed(1)}" y="${(
      yA - 5
    ).toFixed(
      1
    )}" text-anchor="middle" font-family="monospace" font-size="10" fill="#0F172A">${vA.toFixed(
      2
    )}</text>`;

    barsXml += `<rect x="${(cx + 2).toFixed(1)}" y="${yB.toFixed(
      1
    )}" width="${barW}" height="${Math.max(1, hB).toFixed(
      1
    )}" fill="${colorB}" rx="2"/>`;
    barsXml += `<text x="${(cx + barW / 2 + 2).toFixed(1)}" y="${(
      yB - 5
    ).toFixed(
      1
    )}" text-anchor="middle" font-family="monospace" font-size="10" fill="#0F172A">${vB.toFixed(
      2
    )}</text>`;

    barsXml += `<text x="${cx.toFixed(1)}" y="${
      padTop + plotH + 22
    }" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="600" fill="#1E293B">${escapeXml(
      shortLabel
    )}</text>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://schemas.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#FFFFFF"/>
  <text x="${padLeft}" y="28" font-family="sans-serif" font-size="15" font-weight="700" fill="#0F172A">${escapeXml(
    title
  )}</text>
  <text x="${padLeft}" y="48" font-family="monospace" font-size="11" fill="#475569">Run ID: ${escapeXml(
    log.experimentId
  )} | Dataset: ${escapeXml(log.datasetName)} (N = ${
    log.videoMetadata.frameCount
  } frames, ${escapeXml(log.videoMetadata.resolution)})</text>
  <rect x="${width - 390}" y="16" width="12" height="12" fill="${colorA}" rx="2"/>
  <text x="${width - 372}" y="26" font-family="sans-serif" font-size="11" fill="#334155">${escapeXml(
    seriesAName
  )}</text>
  <rect x="${width - 390}" y="34" width="12" height="12" fill="${colorB}" rx="2"/>
  <text x="${width - 372}" y="44" font-family="sans-serif" font-size="11" fill="#334155">${escapeXml(
    seriesBName
  )}</text>
  ${gridLines}
  <line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${
    padTop + plotH
  }" stroke="#94A3B8" stroke-width="1.5"/>
  <line x1="${padLeft}" y1="${padTop + plotH}" x2="${
    width - padRight
  }" y2="${padTop + plotH}" stroke="#94A3B8" stroke-width="1.5"/>
  <text x="20" y="${
    padTop + plotH / 2
  }" transform="rotate(-90 20 ${
    padTop + plotH / 2
  })" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="600" fill="#334155">${escapeXml(
    yAxisLabel
  )}</text>
  ${barsXml}
</svg>`;
}

export async function svgStringToPngBlob(
  svgString: string,
  width = 1840,
  height = 920
): Promise<Blob | null> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return null;
  }
  return new Promise((resolve) => {
    try {
      const svgBlob = new Blob([svgString], {
        type: 'image/svg+xml;charset=utf-8',
      });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve(null);
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        canvas.toBlob((pngBlob) => resolve(pngBlob), 'image/png', 1.0);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    } catch {
      resolve(null);
    }
  });
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array | null {
  try {
    const parts = dataUrl.split(',');
    if (parts.length < 2) return null;
    const binStr = atob(parts[1]);
    const bytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) {
      bytes[i] = binStr.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

/**
 * Populates a JSZip folder with the complete Section 7.3 structure for a single experiment run:
 * DSP_Experiment_Results/<Run_ID>/
 *   manifest.json
 *   raw_data/per_frame_metrics.csv
 *   raw_data/per_video_summary.csv
 *   summary/group_summary.csv
 *   summary/statistical_summary.csv
 *   summary/ablation_comparison.csv
 *   tables/results_workbook.xlsx
 *   charts/*.svg & *.png
 *   visual_evidence/sample_frames/*.png
 *   visual_evidence/difference_masks/*.png
 *   analysis/automatic_analysis.json
 */
async function populateRunFolderInZip(
  rootZip: JSZip,
  log: TraceableExperimentLogEntry,
  sensitivitySweeps?: ParameterSensitivitySweepResult[]
): Promise<void> {
  const basePath = `DSP_Experiment_Results/${log.experimentId}`;
  const ablationEntries = buildAblationComparisonEntries(log);
  const interpretations = buildEvidenceGroundedInterpretations(log);

  const manifest = {
    runId: log.experimentId,
    timestamp: log.timestamp,
    experimentGroup: log.group,
    researchQuestion: log.rqId,
    hypothesis: log.hypothesisId,
    datasetName: log.datasetName,
    videoMetadata: log.videoMetadata,
    variantCount: log.measuredRows.length,
    perFrameRecordCount: log.perFrameRecords?.length ?? 0,
    representativeFrameCount: log.representativeFrames?.length ?? 0,
    configuration: log.reproducibleConfigJson,
  };

  rootZip.file(`${basePath}/manifest.json`, JSON.stringify(manifest, null, 2));
  rootZip.file(
    `${basePath}/raw_data/per_frame_metrics.csv`,
    buildPerFrameCsvString(log.perFrameRecords)
  );
  rootZip.file(
    `${basePath}/raw_data/per_video_summary.csv`,
    buildSummaryCsvString(log)
  );
  rootZip.file(
    `${basePath}/summary/group_summary.csv`,
    buildSummaryCsvString(log)
  );
  rootZip.file(
    `${basePath}/summary/statistical_summary.csv`,
    buildStatisticalSummaryCsvString(log)
  );
  rootZip.file(
    `${basePath}/summary/ablation_comparison.csv`,
    buildAblationComparisonCsvString(ablationEntries)
  );

  const xlsxBlob = await generateResultsWorkbookXlsxBlob(log, sensitivitySweeps);
  rootZip.file(`${basePath}/tables/results_workbook.xlsx`, xlsxBlob);

  // Charts (SVG & PNG)
  const chartSpecs: {
    fileStem: string;
    type: 'primary_metrics' | 'jitter_comparison' | 'runtime_comparison';
  }[] = [
    { fileStem: 'primary_evaluation_chart', type: 'primary_metrics' },
    { fileStem: 'stabilization_jitter_comparison', type: 'jitter_comparison' },
    { fileStem: 'computational_runtime_comparison', type: 'runtime_comparison' },
  ];

  for (const cs of chartSpecs) {
    const svg = generateExperimentChartSvg(log, cs.type);
    rootZip.file(`${basePath}/charts/${cs.fileStem}.svg`, svg);
    const pngBlob = await svgStringToPngBlob(svg);
    if (pngBlob) {
      rootZip.file(`${basePath}/charts/${cs.fileStem}.png`, pngBlob);
    }
  }

  // Visual Evidence (Sample Frames & Difference Masks)
  for (const rf of log.representativeFrames ?? []) {
    const safeCode = rf.variantCode.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fIdx = rf.frameIndex;
    if (rf.originalPngDataUrl) {
      const b = dataUrlToUint8Array(rf.originalPngDataUrl);
      if (b)
        rootZip.file(
          `${basePath}/visual_evidence/sample_frames/${safeCode}_frame${fIdx}_original.png`,
          b
        );
    }
    if (rf.stabilizedPngDataUrl) {
      const b = dataUrlToUint8Array(rf.stabilizedPngDataUrl);
      if (b)
        rootZip.file(
          `${basePath}/visual_evidence/sample_frames/${safeCode}_frame${fIdx}_stabilized.png`,
          b
        );
    }
    if (rf.rawMaskPngDataUrl) {
      const b = dataUrlToUint8Array(rf.rawMaskPngDataUrl);
      if (b)
        rootZip.file(
          `${basePath}/visual_evidence/sample_frames/${safeCode}_frame${fIdx}_raw_mask.png`,
          b
        );
    }
    if (rf.cleanedMaskPngDataUrl) {
      const b = dataUrlToUint8Array(rf.cleanedMaskPngDataUrl);
      if (b)
        rootZip.file(
          `${basePath}/visual_evidence/sample_frames/${safeCode}_frame${fIdx}_cleaned_mask.png`,
          b
        );
    }
    if (rf.overlayPngDataUrl) {
      const b = dataUrlToUint8Array(rf.overlayPngDataUrl);
      if (b)
        rootZip.file(
          `${basePath}/visual_evidence/sample_frames/${safeCode}_frame${fIdx}_overlay.png`,
          b
        );
    }
    if (rf.diffMaskVsBaselinePngDataUrl) {
      const b = dataUrlToUint8Array(rf.diffMaskVsBaselinePngDataUrl);
      if (b)
        rootZip.file(
          `${basePath}/visual_evidence/difference_masks/${safeCode}_frame${fIdx}_diff_vs_baseline.png`,
          b
        );
    }
  }

  // Automatic Analysis JSON
  rootZip.file(
    `${basePath}/analysis/automatic_analysis.json`,
    JSON.stringify(
      {
        experimentId: log.experimentId,
        group: log.group,
        datasetName: log.datasetName,
        verdict: log.hypothesisVerdict,
        conclusionVi: log.conclusionVi,
        fivePointChartInterpretations: interpretations,
        ablationComparisonSummary: ablationEntries,
        pairedStatisticalTests: log.pairedStats ?? [],
      },
      null,
      2
    )
  );
}

export function triggerBrowserDownload(blob: Blob, filename: string): void {
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadSingleRunCompleteZip(
  log: TraceableExperimentLogEntry,
  sensitivitySweeps?: ParameterSensitivitySweepResult[]
): Promise<void> {
  const zip = new JSZip();
  await populateRunFolderInZip(zip, log, sensitivitySweeps);
  const blob = await zip.generateAsync({ type: 'blob' });
  triggerBrowserDownload(blob, `DSP_Experiment_Results_${log.experimentId}.zip`);
}

export async function downloadAllRunsBatchZip(
  logs: TraceableExperimentLogEntry[],
  sensitivitySweeps?: ParameterSensitivitySweepResult[]
): Promise<void> {
  const zip = new JSZip();
  for (const log of logs) {
    await populateRunFolderInZip(zip, log, sensitivitySweeps);
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  triggerBrowserDownload(
    blob,
    `DSP_Experiment_Results_Batch_${logs.length}_Runs.zip`
  );
}
