import {
  ParameterSensitivitySweepResult,
  TraceableExperimentLogEntry,
} from '../types/research';
import {
  RESEARCH_HYPOTHESES,
  RESEARCH_QUESTIONS,
  SCIENTIFIC_LITERATURE_DATABASE,
} from './literatureDatabase';

function fmtNum(val: number | null | undefined, digits = 2, suffix = ''): string {
  if (val === null || val === undefined || Number.isNaN(val)) {
    return 'N/A';
  }
  return `${val.toFixed(digits)}${suffix}`;
}

function fmtPct(val: number | null | undefined, digits = 2): string {
  if (val === null || val === undefined || Number.isNaN(val)) {
    return 'N/A';
  }
  return `${(val * 100).toFixed(digits)}%`;
}

/**
 * Generates a complete, traceable 18-Section Academic Research Report in Markdown format
 * using exclusively measured experimental logs, verified APA 7 citations, and readiness status.
 */
export function generateAcademicMarkdownReport(
  experimentLogs: TraceableExperimentLogEntry[],
  sensitivitySweeps: ParameterSensitivitySweepResult[]
): string {
  const nowIso = new Date().toISOString();
  const groupALog = experimentLogs.find((l) => l.group === 'Group A: Stabilization');
  const groupBLog = experimentLogs.find(
    (l) => l.group === 'Group B: Background Subtraction'
  );
  const groupCLog = experimentLogs.find(
    (l) => l.group === 'Group C: Processing Order'
  );
  const groupDLog = experimentLogs.find((l) => l.group === 'Group D: Ablation Study');

  const allMeasuredRows = experimentLogs.flatMap((l) => l.measuredRows);

  const lines: string[] = [
    '# SPATIOTEMPORAL VIDEO PROCESSING LAB — ACADEMIC RESEARCH REPORT',
    `**Topic:** Hệ thống xử lý video không gian–thời gian: Chống rung, tách lọc nền và vật thể, đánh giá sai biệt thuật toán`,
    `**Generated Timestamp:** ${nowIso}`,
    `**Runtime Environment:** Browser Client-Side React 19 + TypeScript + OpenCV.js WebAssembly`,
    `**Traceable Experiment Logs Recorded:** ${experimentLogs.length} experiment group(s), ${sensitivitySweeps.length} parameter sensitivity sweep(s)`,
    '',
    '---',
    '',
    '## 1. Abstract',
    'This report presents an empirical investigation of digital signal processing (DSP) stages within a spatiotemporal video processing pipeline combining 2D camera motion stabilization and foreground/background segmentation. Unwanted camera jitter violates the spatial stationarity assumption of pixel-wise background subtraction models, inducing high false-positive rates along textured background boundaries (Chapel & Bouwmans, 2021; Wang et al., 2014). Using a unified client-side OpenCV.js WebAssembly experimental laboratory, we evaluate Sparse Pyramidal Lucas-Kanade Optical Flow with RANSAC (Lucas & Kanade, 1981; Shi & Tomasi, 1994; Fischler & Bolles, 1981) against Enhanced Correlation Coefficient maximization (Evangelidis & Psarakis, 2008), alongside three background subtraction paradigms: Frame Differencing (Piccardi, 2004), Adaptive Gaussian Mixture Modeling MOG2 (Zivkovic, 2004), and Sample-based K-Nearest Neighbors (Zivkovic & van der Heijden, 2006; Barnich & Van Droogenbroeck, 2011). Controlled synthetic scenes with exact camera transformation matrices and CDnet-2014 compatible label maps (`0, 50, 85, 170, 255`), paired with user-uploaded video sequences, enable traceable verification across five research questions (RQ1–RQ5) and seven falsifiable hypotheses (H1–H7).',
    '',
    '## 2. Introduction',
    'Classical background subtraction algorithms model the temporal intensity distribution of each pixel under the assumption that the imaging sensor is stationary (Piccardi, 2004; Stauffer & Grimson, 1999). In real-world deployments—such as pole-mounted traffic cameras subject to wind vibration or handheld inspection devices—high-frequency camera jitter couples spatial intensity gradients into temporal pixel fluctuations (Wang et al., 2014; Dakkar et al., 2024). Rather than claiming a novel algorithm, this work establishes a reproducible, browser-native scientific testbed to isolate, ablate, and quantify the interaction between geometric motion compensation, temporal background modeling, morphological post-filtering, and processing order.',
    '',
    '## 3. Research Problem',
    'Uncompensated camera motion causes background subtraction models to misclassify high-contrast static background edges as moving foreground objects. Furthermore, each DSP stage—feature detection, outlier rejection (RANSAC), trajectory smoothing, geometric warping, background density estimation, shadow suppression, and morphological filtering—introduces non-trivial trade-offs between segmentation accuracy, border loss, and computational latency.',
    '',
    '## 4. Research Questions (RQ1–RQ5)',
    ...RESEARCH_QUESTIONS.map(
      (rq) =>
        `- **${rq.id} (${rq.title}):** ${rq.questionVi}\n  - *Independent Variables:* ${rq.independentVariables.join('; ')}\n  - *Dependent Variables:* ${rq.dependentVariables.join('; ')}\n  - *Supporting Literature:* ${rq.supportingLiteratureIds.join(', ')}`
    ),
    '',
    '## 5. Research Hypotheses (H1–H7)',
    ...RESEARCH_HYPOTHESES.map(
      (h) =>
        `- **${h.id} (Linked to ${h.linkedRq} — ${h.targetExperimentGroup}):** ${h.statementVi}\n  - *Null Hypothesis:* ${h.nullHypothesisVi}\n  - *Verification Criteria:* ${h.verificationCriteria}`
    ),
    '',
    '## 6. Literature Review',
    'Our theoretical and experimental framework builds upon 17 peer-reviewed publications across four domains:',
    ...SCIENTIFIC_LITERATURE_DATABASE.map(
      (lit) =>
        `${lit.indexNumber}. **${lit.inTextCitation}** [${lit.category} — *${lit.domain}*]: *${lit.title}*. DOI: \`${lit.doi}\`. Contribution: ${lit.proposedMethod} Limitation: ${lit.limitations}`
    ),
    '',
    '## 7. Theoretical Background',
    '- **Sparse Optical Flow & Similarity RANSAC:** Corner features satisfying $\\min(\\lambda_1, \\lambda_2) > \\tau$ (Shi & Tomasi, 1994) are tracked across Gaussian pyramids via Lucas-Kanade optical flow (Lucas & Kanade, 1981). A 4-DoF 2D similarity transform $(dx, dy, d\\theta, s)$ is estimated using RANSAC (Fischler & Bolles, 1981) to reject moving foreground outliers.',
    '- **Enhanced Correlation Coefficient (ECC):** Maximizes zero-mean normalized correlation between template and warped input intensities under a Euclidean motion model (Evangelidis & Psarakis, 2008).',
    '- **Trajectory Smoothing & Second-Order Jitter RMS:** Cumulative camera trajectories $C(t) = \\sum_{k=1}^{t} \\Delta T_k$ are low-pass filtered with a normalized Gaussian kernel of radius $R$ (Grundmann et al., 2011; Zhang et al., 2019). High-frequency roughness is quantified by $\\text{RMS}(\\Delta^2 C_t) = \\sqrt{\\frac{1}{N-2}\\sum_{t=2}^{N-1}(C_{t+1} - 2C_t + C_{t-1})^2}$.',
    '- **Adaptive Background Modeling & CDnet-2014 Protocol:** MOG2 updates per-pixel Gaussian mixtures with Dirichlet priors and shadow detection (Zivkovic, 2004), while Sample-based KNN classifies pixels via historical sample proximity (Zivkovic & van der Heijden, 2006; Barnich & Van Droogenbroeck, 2011). Evaluation follows CDnet-2014 labels (`0`: BG, `50`: Shadow, `85`: Outside ROI, `170`: Unknown, `255`: FG) where labels `85` and `170` and post-warp invalid borders are excluded (Wang et al., 2014).',
    '',
    '## 8. System Architecture',
    'The application executes 100% client-side in React + TypeScript + OpenCV.js WebAssembly without external server dependencies. Sequential frame decoding, explicit `cv.Mat.delete()` memory management inside `finally` blocks, and event-loop yielding prevent WebAssembly heap exhaustion.',
    '',
    '## 9. Methodology & Two-Level Statistical Protocol',
    '1. **Level 1 — Runtime Repetitions:** Deterministic image processing algorithms produce identical IoU/F1/Jitter on identical inputs. Therefore, 3 repeated trials (following a 3-frame JIT/WASM warm-up pass) are used specifically to measure runtime latency variability (Mean, Median, StdDev, Min/Max ms, and FPS).',
    '2. **Level 2 — Per-Frame Paired Statistical Analysis:** Quality and frame-level latency differences between competing methods are evaluated across paired frame observations $(A_t, B_t)$ for $t = 1 \\dots N$ using the Paired Student $t$-test, non-parametric Wilcoxon Signed-Rank Test, Cohen\'s $d_z$ effect size, and Block-Bootstrap 95% confidence intervals that account for temporal autocorrelation.',
    '',
    '## 10. Experimental Setup',
    experimentLogs.length > 0
      ? experimentLogs
          .map(
            (l) =>
              `- **${l.experimentId}** (${l.group}): Dataset = \`${l.datasetName}\`, Resolution = \`${l.videoMetadata.resolution}\`, Frames = \`${l.videoMetadata.frameCount}\`, FPS = \`${l.videoMetadata.fps}\`, Pixel GT = \`${l.videoMetadata.hasGroundTruth}\`, Camera Transform GT = \`${l.videoMetadata.hasCameraGroundTruth}\`.`
          )
          .join('\n')
      : '- No experimental logs have been executed in this session yet. Run Groups A, B, C, D, or E in the Research Lab to populate empirical measurements.',
    '',
    '## 11. Ablation Study (Experiment Group D)',
    groupDLog
      ? [
          `**Traceable Experiment ID:** \`${groupDLog.experimentId}\` on dataset \`${groupDLog.datasetName}\``,
          '',
          '| Variant | Bypass Mechanism | IoU | F1 | FPR | Jitter RMS (px) | Translation RMSE (px) | FPS | Latency (ms) |',
          '|---|---|---|---|---|---|---|---|---|',
          ...groupDLog.measuredRows.map(
            (r) =>
              `| ${r.algorithmLabel} | ${r.bypassNote ?? r.configSummary} | ${fmtPct(r.iou)} | ${fmtPct(r.f1)} | ${fmtPct(r.fpr)} | ${fmtNum(r.jitterRmsPx, 3)} | ${fmtNum(r.translationRmsePx, 3)} | ${r.fps.toFixed(1)} | ${r.meanLatencyMs.toFixed(2)} |`
          ),
          '',
          `**Empirical Conclusion:** ${groupDLog.conclusionVi}`,
        ].join('\n')
      : '*Experiment Group D (Ablation Study D0–D6) has not been executed yet in the current session.*',
    '',
    '## 12. Processing Order Analysis (Experiment Group C: C1, C2, C3 & C4 Theoretical Reference)',
    groupCLog
      ? [
          `**Traceable Experiment ID:** \`${groupCLog.experimentId}\` on dataset \`${groupCLog.datasetName}\``,
          '',
          '| Configuration | Status | IoU | F1 | FPR | PWC Error (%) | Mask Flicker (%) | Valid Area (%) | FPS |',
          '|---|---|---|---|---|---|---|---|---|',
          ...groupCLog.measuredRows.map(
            (r) =>
              `| ${r.algorithmLabel} | ${r.status} | ${fmtPct(r.iou)} | ${fmtPct(r.f1)} | ${fmtPct(r.fpr)} | ${fmtNum(r.pwcErrorPercent, 2, '%')} | ${fmtNum(r.maskFlickerPercent, 2, '%')} | ${fmtNum(r.validAreaPercent, 1, '%')} | ${r.fps.toFixed(1)} |`
          ),
          '| C4. Motion Estimation → Background Model Compensation → Foreground Extraction | Theoretical Reference | N/A | N/A | N/A | N/A | N/A | N/A | N/A |',
          '',
          `**Note on C4 (Theoretical Reference):** Configuration C4 warps the internal per-pixel Gaussian distribution parameters $(\\mu_{k,t-1}, \\sigma^2_{k,t-1}, w_{k,t-1})$ directly using the inter-frame homography/affine matrix before evaluating $I_t$ (Yang et al., 2019; Chapel & Bouwmans, 2021). Because OpenCV.js encapsulates the C++ \`cv::BackgroundSubtractorMOG2\` internal Gaussian weight buffers privately in WASM linear memory, C4 is documented as a theoretical reference model rather than a fabricated benchmark row.`,
          '',
          `**Empirical Conclusion:** ${groupCLog.conclusionVi}`,
        ].join('\n')
      : '*Experiment Group C (Processing Order C1/C2/C3) has not been executed yet in the current session.*',
    '',
    '## 13. Empirical Results Summary (All Executed Experiments)',
    allMeasuredRows.length > 0
      ? [
          '| Experiment ID | Dataset | Algorithm / Variant | IoU | F1 | Jitter RMS (px) | Trans RMSE (px) | FPS | Time (ms) | Status |',
          '|---|---|---|---|---|---|---|---|---|---|',
          ...allMeasuredRows.map(
            (r) =>
              `| \`${r.experimentId}\` | \`${r.datasetName}\` | ${r.algorithmLabel} | ${fmtPct(r.iou)} | ${fmtPct(r.f1)} | ${fmtNum(r.jitterRmsPx, 3)} | ${fmtNum(r.translationRmsePx, 3)} | ${r.fps.toFixed(1)} | ${r.meanLatencyMs.toFixed(2)} | ${r.status} |`
          ),
        ].join('\n')
      : '*No empirical rows recorded yet.*',
    '',
    ...(sensitivitySweeps.length > 0
      ? [
          '### Parameter Sensitivity Sweeps (Group E)',
          ...sensitivitySweeps.map((sw) =>
            [
              `#### Sweep \`${sw.sweepId}\`: ${sw.parameterNameVi} on \`${sw.datasetName}\``,
              '| Parameter Value | IoU (%) | F1 (%) | Jitter RMS (px) | Trans RMSE (px) | Flicker (%) | FPS | Latency (ms) |',
              '|---|---|---|---|---|---|---|---|',
              ...sw.points.map(
                (pt) =>
                  `| ${pt.paramLabel} | ${fmtNum(pt.iou, 2, '%')} | ${fmtNum(pt.f1, 2, '%')} | ${fmtNum(pt.jitterRmsPx, 3)} | ${fmtNum(pt.translationRmsePx, 3)} | ${fmtNum(pt.maskFlickerPercent, 2, '%')} | ${pt.fps.toFixed(1)} | ${pt.latencyMs.toFixed(2)} |`
              ),
              `**Finding:** ${sw.optimalValueNoteVi}`,
            ].join('\n')
          ),
        ]
      : []),
    '',
    '## 14. Discussion & Statistical Interpretation',
    experimentLogs.some((l) => l.pairedStats && l.pairedStats.length > 0)
      ? experimentLogs
          .flatMap((l) => l.pairedStats ?? [])
          .map(
            (st) =>
              `- **${st.metricName} (${st.methodAName} vs ${st.methodBName}, N=${st.sampleSizeN} frames):** ${st.interpretationVi} (95% Parametric CI: [${st.confidenceInterval95[0].toFixed(3)}, ${st.confidenceInterval95[1].toFixed(3)}], Block-Bootstrap 95% CI: [${st.blockBootstrapCi95[0].toFixed(3)}, ${st.blockBootstrapCi95[1].toFixed(3)}], Paired $t=${st.pairedTTest.tStatistic.toFixed(3)}, p=${st.pairedTTest.pValueTwoTailed.toFixed(4)}$).`
          )
          .join('\n')
      : 'Run Group A, B, or C to generate paired per-frame statistical tests (Paired t-test, Wilcoxon Signed-Rank, and Block-Bootstrap confidence intervals).',
    '',
    '## 15. Comparison with Previous Studies',
    '| Research Paper | Proposed Method | Experimental Dataset | Evaluation Metrics | Relevant Finding | Relationship to Our Results |',
    '|---|---|---|---|---|---|',
    ...SCIENTIFIC_LITERATURE_DATABASE.map(
      (lit) =>
        `| ${lit.inTextCitation} | ${lit.proposedMethod} | ${lit.experimentalDataset} | ${lit.reportedMetrics.join(', ')} | ${lit.mainFindings} | ${lit.relationshipToOurResults} |`
    ),
    '',
    '## 16. Limitations',
    '1. **2D Global Transform vs 3D Parallax:** Both LK+RANSAC and ECC estimate a single global 2D similarity/Euclidean transform per frame. As demonstrated in Scenario 10 and Liu et al. (2013), scenes with strong depth variation exhibit residual parallax after stabilization.',
    '2. **Real-Video Ground Truth Availability:** User-uploaded real-world videos lack pixel-accurate CDnet segmentation masks and motion-capture camera trajectories unless an external Ground Truth ZIP is provided; hence objective IoU and Transform RMSE are strictly reported as `N/A` on unannotated real videos.',
    '3. **Temporal Autocorrelation:** Consecutive frames within a single video sequence are temporally correlated; paired frame-level $p$-values reflect within-sequence consistency and are supplemented with Block-Bootstrap confidence intervals and effect sizes.',
    '',
    '## 17. Conclusion & Research Readiness Checklist',
    `- **RQ1 & H1/H2 (Stabilization):** ${groupALog ? `Tested (${groupALog.experimentId}) — ${groupALog.hypothesisVerdict}` : 'Untested in current session'}`,
    `- **RQ2 & H3 (Background Subtraction):** ${groupBLog ? `Tested (${groupBLog.experimentId}) — ${groupBLog.hypothesisVerdict}` : 'Untested in current session'}`,
    `- **RQ3 & H4/H6 (Processing Order C1/C2/C3):** ${groupCLog ? `Tested (${groupCLog.experimentId}) — ${groupCLog.hypothesisVerdict}` : 'Untested in current session'}`,
    `- **RQ4 & H5 (Ablation Study D0–D6):** ${groupDLog ? `Tested (${groupDLog.experimentId}) — ${groupDLog.hypothesisVerdict}` : 'Untested in current session'}`,
    `- **RQ5 & H7 (Parameter Sensitivity & Quality–Speed):** ${sensitivitySweeps.length > 0 ? `Tested (${sensitivitySweeps.length} sweep(s))` : 'Untested in current session'}`,
    '',
    '## 18. References (APA 7)',
    ...SCIENTIFIC_LITERATURE_DATABASE.map((lit) => `- ${lit.apa7Citation}`),
    '',
  ];

  return lines.join('\n');
}

/**
 * Exports the 18-Section Academic Report as a downloadable Markdown (.md) file.
 */
export function downloadAcademicReportMarkdown(
  experimentLogs: TraceableExperimentLogEntry[],
  sensitivitySweeps: ParameterSensitivitySweepResult[]
): void {
  const md = generateAcademicMarkdownReport(experimentLogs, sensitivitySweeps);
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `spatiotemporal_academic_report_${Date.now().toString(36)}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exports the 18-Section Academic Report as a styled, self-contained HTML document.
 */
export function downloadAcademicReportHtml(
  experimentLogs: TraceableExperimentLogEntry[],
  sensitivitySweeps: ParameterSensitivitySweepResult[]
): void {
  const md = generateAcademicMarkdownReport(experimentLogs, sensitivitySweeps);
  const escaped = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <title>SpatioTemporal Video Processing Lab — 18-Section Academic Report</title>
  <style>
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #0b0e17;
      color: #f1f5f9;
      margin: 0;
      padding: 36px;
      line-height: 1.65;
    }
    .container {
      max-width: 1120px;
      margin: 0 auto;
      background: #111827;
      border: 1px solid #1e293b;
      padding: 36px;
    }
    h1 { color: #06b6d4; font-size: 22px; margin-top: 0; }
    pre {
      white-space: pre-wrap;
      word-wrap: break-word;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12.5px;
      background: #0b0e17;
      border: 1px solid #1e293b;
      padding: 24px;
      color: #e2e8f0;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>SPATIOTEMPORAL VIDEO PROCESSING LAB — ACADEMIC RESEARCH REPORT (18 SECTIONS)</h1>
    <pre>${escaped}</pre>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `spatiotemporal_academic_report_${Date.now().toString(36)}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exports all traceable experiment logs & configurations as reproducible JSON.
 */
export function downloadExperimentLogsJson(
  experimentLogs: TraceableExperimentLogEntry[],
  sensitivitySweeps: ParameterSensitivitySweepResult[]
): void {
  const payload = {
    exportedAt: new Date().toISOString(),
    application: 'SpatioTemporal Video Processing Lab',
    experimentLogs,
    sensitivitySweeps,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `spatiotemporal_experiment_traceability_${Date.now().toString(36)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
