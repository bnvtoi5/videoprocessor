import { BenchmarkExperimentRecord } from '../types/benchmark';

/**
 * Formats a clean academic filename incorporating video name, algorithm/type, and timestamp.
 */
export function buildExportFileName(
  videoFileName: string,
  algorithmTag: string,
  resultType: string,
  extension: string
): string {
  const base = videoFileName
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 32);
  const cleanAlg = algorithmTag.replace(/[^a-zA-Z0-9_-]/g, '-');
  const cleanType = resultType.replace(/[^a-zA-Z0-9_-]/g, '_');
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(
    2,
    '0'
  )}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(
    2,
    '0'
  )}${String(now.getMinutes()).padStart(2, '0')}`;
  return `${base || 'video'}_${cleanAlg}_${cleanType}_${stamp}.${extension}`;
}

export function generateBenchmarkCsv(record: BenchmarkExperimentRecord): string {
  const headers = [
    'Experiment_ID',
    'Timestamp',
    'Video_File',
    'Resolution',
    'Frames',
    'Algorithm',
    'Category',
    'Engine',
    'Trials',
    'Median_Frame_Time_ms',
    'Total_Pipeline_Time_ms',
    'FPS',
    'Translation_Jitter_RMS_px',
    'Rotation_Jitter_RMS_deg',
    'Inlier_Ratio_Percent',
    'ECC_Convergence_Percent',
    'IoU',
    'Precision',
    'Recall',
    'F1_Score',
    'Foreground_Ratio_Percent',
    'Mask_Flicker_Percent',
    'Border_Loss_Percent',
    'Status',
  ];

  const fmt = (v: number | null, digits = 4): string =>
    v === null || Number.isNaN(v) ? 'N/A' : v.toFixed(digits);

  const lines = [headers.join(',')];
  for (const r of record.rows) {
    const rowVals = [
      record.experimentId,
      record.timestamp,
      `"${record.videoFileName.replace(/"/g, '""')}"`,
      record.resolution,
      String(record.frameCount),
      `"${r.algorithmName}"`,
      `"${r.category}"`,
      `"${r.engineNote}"`,
      String(r.runsCompleted),
      fmt(r.algorithmProcessingTimeMs, 3),
      fmt(r.totalPipelineTimeMs, 2),
      fmt(r.fps, 2),
      fmt(r.jitterRmsPx, 4),
      fmt(r.rotationJitterRmsDeg, 4),
      fmt(r.inlierRatioPercent, 2),
      fmt(r.eccSuccessRatePercent, 2),
      r.iou === null ? 'N/A - Ground Truth Unavailable' : fmt(r.iou, 4),
      r.precision === null ? 'N/A - Ground Truth Unavailable' : fmt(r.precision, 4),
      r.recall === null ? 'N/A - Ground Truth Unavailable' : fmt(r.recall, 4),
      r.f1 === null ? 'N/A - Ground Truth Unavailable' : fmt(r.f1, 4),
      fmt(r.foregroundRatioPercent, 2),
      fmt(r.maskFlickerPercent, 2),
      fmt(r.borderLossPercent, 2),
      r.status,
    ];
    lines.push(rowVals.join(','));
  }

  return lines.join('\n');
}

export function generateBenchmarkJson(record: BenchmarkExperimentRecord): string {
  return JSON.stringify(record, null, 2);
}

export function generateExperimentReportHtml(
  record: BenchmarkExperimentRecord
): string {
  const fmt = (v: number | null, digits = 3, naText = 'N/A'): string =>
    v === null || Number.isNaN(v) ? naText : v.toFixed(digits);

  const gtText = record.hasGroundTruth
    ? 'Verified Ground Truth Masks Loaded'
    : 'N/A – Ground Truth Unavailable (Proxy & Runtime Metrics Only)';

  const rowsHtml = record.rows
    .map(
      (r) => `
      <tr>
        <td><strong>${r.algorithmName}</strong><br/><span class="muted">${r.engineNote}</span></td>
        <td>${r.category}</td>
        <td class="num">${fmt(r.algorithmProcessingTimeMs, 2)} ms</td>
        <td class="num">${fmt(r.fps, 1)}</td>
        <td class="num">${fmt(r.jitterRmsPx, 3)}</td>
        <td class="num">${fmt(r.iou, 4, 'N/A – GT Unavailable')}</td>
        <td class="num">${fmt(r.precision, 4, 'N/A')}</td>
        <td class="num">${fmt(r.recall, 4, 'N/A')}</td>
        <td class="num">${fmt(r.f1, 4, 'N/A – GT Unavailable')}</td>
        <td class="num">${fmt(r.borderLossPercent, 2)}%</td>
        <td>${r.status}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>SpatioTemporal Video Processing Lab — Experiment Report ${record.experimentId}</title>
  <style>
    body { font-family: "IBM Plex Sans", -apple-system, sans-serif; background: #0B0E17; color: #F1F5F9; margin: 32px; line-height: 1.6; }
    h1, h2, h3 { color: #FFFFFF; margin-top: 24px; }
    .header { border-bottom: 1px solid #1E293B; padding-bottom: 16px; margin-bottom: 24px; }
    .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; background: #111827; border: 1px solid #1E293B; padding: 16px; margin-bottom: 24px; }
    .meta-item { font-size: 13px; }
    .meta-label { color: #94A3B8; display: block; font-size: 11px; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
    th, td { border: 1px solid #1E293B; padding: 10px 12px; text-align: left; }
    th { background: #111827; color: #38BDF8; font-weight: 600; }
    td.num { font-family: "JetBrains Mono", monospace; text-align: right; }
    .muted { color: #94A3B8; font-size: 11px; }
    pre { background: #111827; border: 1px solid #1E293B; padding: 12px; overflow-x: auto; font-family: "JetBrains Mono", monospace; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>SPATIOTEMPORAL VIDEO PROCESSING LAB — EXPERIMENTAL REPORT</h1>
    <p class="muted">Topic: Spatiotemporal Video Processing System — Video Stabilization, Background/Foreground Separation, and Algorithmic Discrepancy Evaluation</p>
  </div>

  <div class="meta-grid">
    <div class="meta-item"><span class="meta-label">Experiment ID</span><strong>${record.experimentId}</strong></div>
    <div class="meta-item"><span class="meta-label">Timestamp</span><strong>${record.timestamp}</strong></div>
    <div class="meta-item"><span class="meta-label">Input Video</span><strong>${record.videoFileName}</strong></div>
    <div class="meta-item"><span class="meta-label">Processing Resolution</span><strong>${record.resolution}</strong></div>
    <div class="meta-item"><span class="meta-label">Evaluated Frames / Sampling FPS</span><strong>${record.frameCount} frames @ ${record.samplingFps} FPS (${record.numTrialRuns} trial median)</strong></div>
    <div class="meta-item"><span class="meta-label">Ground Truth Status</span><strong>${gtText}</strong></div>
  </div>

  <h2>1. Quantitative Benchmark Comparison Table</h2>
  <table>
    <thead>
      <tr>
        <th>Algorithm & Engine</th>
        <th>Category</th>
        <th>Median Time/Frame</th>
        <th>FPS</th>
        <th>Jitter RMS (px)</th>
        <th>IoU</th>
        <th>Precision</th>
        <th>Recall</th>
        <th>F1-Score</th>
        <th>Border Loss</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <h2>2. Methodological Notes</h2>
  <ul>
    <li><strong>Stabilization Jitter RMS:</strong> Computed from second-order finite differences of cumulative camera trajectory. For real-world videos, this serves as a proxy metric for trajectory smoothness rather than motion-capture camera ground truth.</li>
    <li><strong>Segmentation Metrics:</strong> Computed strictly against pixel-aligned Ground Truth masks: IoU = TP / (TP + FP + FN), Precision = TP / (TP + FP), Recall = TP / (TP + FN), F1 = 2·P·R / (P + R).</li>
    <li><strong>Algorithm Runtime:</strong> Measured strictly across frame processing steps (excluding browser HTML5 video decoding and MediaRecorder export).</li>
  </ul>

  <h2>3. Experimental Parameter Snapshot</h2>
  <pre>${JSON.stringify(record.configSnapshot, null, 2)}</pre>
</body>
</html>`;
}

export function triggerBrowserDownload(
  content: string | Blob,
  fileName: string,
  mimeType: string
): void {
  const blob =
    content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
