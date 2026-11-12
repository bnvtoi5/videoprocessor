import JSZip from 'jszip';
import { AggregatedComboRow } from '../components/research/MultiVideoAcceptanceStudio';

export interface AcademicChartConfig {
  id: number;
  title: string;
  subtitle: string;
  unit: string;
  filename: string;
}

export const ACADEMIC_CHARTS: AcademicChartConfig[] = [
  {
    id: 1,
    title: 'Figure 12.1. Motion Stabilization Reduction Ratio Across Ablation Setups (D0–D6)',
    subtitle: 'Tỷ Lệ Giảm Rung Động Camera Tần Số Cao (%) — Chuẩn Tham Chiếu D0 vs Các Biến Thể D1–D6',
    unit: 'Motion Reduction (%)',
    filename: 'Figure_12_1_Motion_Reduction_300DPI.png',
  },
  {
    id: 2,
    title: 'Figure 12.2. Independent Residual Output Jitter RMS Across Setups (D0–D6)',
    subtitle: 'Độ Lệch Chuẩn RMS Rung Dư Đo Độc Lập Trên Khung Hình Đầu Ra (Shi-Tomasi + LK + RANSAC)',
    unit: 'Residual Jitter (px)',
    filename: 'Figure_12_2_Residual_Jitter_300DPI.png',
  },
  {
    id: 3,
    title: 'Figure 12.3. Temporal Mask Quality: Flicker Rate (%) and Stability Proxy (%)',
    subtitle: 'Chỉ Số Ổn Định Mặt Nạ Thời Gian (Flicker Càng Thấp Càng Tốt, Stability Càng Cao Càng Tốt)',
    unit: 'Tỷ lệ phần trăm (%)',
    filename: 'Figure_12_3_Temporal_Mask_Quality_300DPI.png',
  },
  {
    id: 4,
    title: 'Figure 12.4. Connected Components per Frame: Before vs After Morphology (A_min = 28 px²)',
    subtitle: 'Mức Độ Phân Mảnh Không Gian (Spatial Fragmentation Proxy) Trước và Sau Lọc Hình Thái Học',
    unit: 'Số vùng liên thông (vùng/frame)',
    filename: 'Figure_12_4_Connected_Components_300DPI.png',
  },
  {
    id: 5,
    title: 'Figure 12.5. Foreground Area Ratio (%) and Pixel XOR Difference vs D0 (%)',
    subtitle: 'Tỷ Lệ Diện Tích Tiền Cảnh & Độ Lệch Sai Khác Điểm Ảnh So Với Chuẩn Baseline D0 (Hai Trục Độc Lập)',
    unit: 'Tỷ lệ phần trăm (%)',
    filename: 'Figure_12_5_Area_and_Pixel_XOR_300DPI.png',
  },
  {
    id: 6,
    title: 'Figure 12.6. Algorithmic Processing Performance: Frame Rate (FPS) and Latency (ms)',
    subtitle: 'Tốc Độ Xử Lý Thuần Túy DSP Trên Từng Khung Hình (Loại Bỏ Thời Gian I/O Decode và Render UI)',
    unit: 'Tốc độ (Frames/sec)',
    filename: 'Figure_12_6_Processing_FPS_300DPI.png',
  },
];

const COLORS = {
  blue: '#2563EB',
  blueLight: '#93C5FD',
  emerald: '#059669',
  emeraldLight: '#A7F3D0',
  indigo: '#4F46E5',
  amber: '#D97706',
  rose: '#DC2626',
  slate: '#64748B',
  purple: '#7C3AED',
  grid: '#E2E8F0',
  axis: '#334155',
  text: '#0F172A',
  mutedText: '#64748B',
};

/**
 * Renders an academic publication-grade chart onto a 300-DPI high resolution canvas (2400x1400)
 */
export function renderAcademicChartToCanvas(
  chartId: number,
  rows: AggregatedComboRow[],
  videoCount: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 2400;
  canvas.height = 1400;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cfg = ACADEMIC_CHARTS.find((c) => c.id === chartId) ?? ACADEMIC_CHARTS[0];

  // Header
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 44px "Times New Roman", serif';
  ctx.textAlign = 'left';
  ctx.fillText(cfg.title, 140, 100);

  ctx.fillStyle = COLORS.mutedText;
  ctx.font = 'italic 28px "Times New Roman", serif';
  ctx.fillText(cfg.subtitle, 140, 150);

  // Footer metadata
  ctx.fillStyle = '#94A3B8';
  ctx.font = '24px "Times New Roman", serif';
  ctx.textAlign = 'right';
  ctx.fillText(
    `Báo cáo DSP501 | Dữ liệu thực nghiệm N = ${videoCount} video | Độ phân giải xuất bản 300 DPI`,
    canvas.width - 140,
    canvas.height - 50
  );

  // Layout boundaries
  const plotLeft = 180;
  const plotRight = canvas.width - 140;
  const plotTop = 220;
  const plotBottom = canvas.height - 180;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBottom - plotTop;

  // Render chart according to type
  if (chartId === 1) {
    // Chart 1: Motion Reduction (%)
    renderSingleBarChart(ctx, rows, {
      plotLeft,
      plotRight,
      plotTop,
      plotBottom,
      plotWidth,
      plotHeight,
      unit: '%',
      getValue: (r) => r.meanJitterReductionPct,
      formatVal: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`,
      getBarColor: (v) => (v > 0.5 ? COLORS.emerald : v < -0.5 ? COLORS.rose : COLORS.slate),
      zeroLineVisible: true,
    });
  } else if (chartId === 2) {
    // Chart 2: Residual Jitter (px)
    renderSingleBarChart(ctx, rows, {
      plotLeft,
      plotRight,
      plotTop,
      plotBottom,
      plotWidth,
      plotHeight,
      unit: 'px',
      getValue: (r) => r.meanResidualJitterRms,
      formatVal: (v) => `${v.toFixed(2)} px`,
      getBarColor: () => COLORS.blue,
      minYZero: true,
    });
  } else if (chartId === 3) {
    // Chart 3: Grouped Bar - Flicker (%) vs Mask Stability (%)
    renderGroupedBarChart(ctx, rows, {
      plotLeft,
      plotRight,
      plotTop,
      plotBottom,
      plotWidth,
      plotHeight,
      unit: '%',
      series: [
        {
          name: 'Temporal Flicker (%) [Càng thấp càng tốt]',
          color: COLORS.rose,
          getValue: (r) => r.meanFlickerRate,
          formatVal: (v) => `${v.toFixed(2)}%`,
        },
        {
          name: 'Mask Stability Proxy (%) [Càng cao càng tốt]',
          color: COLORS.indigo,
          getValue: (r) => r.meanMaskStabilityPct,
          formatVal: (v) => `${v.toFixed(2)}%`,
        },
      ],
    });
  } else if (chartId === 4) {
    // Chart 4: Grouped Bar - CC Before vs After Morphology
    renderGroupedBarChart(ctx, rows, {
      plotLeft,
      plotRight,
      plotTop,
      plotBottom,
      plotWidth,
      plotHeight,
      unit: 'vùng/frame',
      series: [
        {
          name: 'CC Trước Morphology (Trước lọc nhiễu)',
          color: COLORS.amber,
          getValue: (r) => r.meanRawComponents,
          formatVal: (v) => `${v.toFixed(1)}`,
        },
        {
          name: 'CC Sau Morphology & Lọc diện tích (A_min = 28 px²)',
          color: COLORS.emerald,
          getValue: (r) => r.meanCleanComponents,
          formatVal: (v) => `${v.toFixed(1)}`,
        },
      ],
    });
  } else if (chartId === 5) {
    // Chart 5: Side-by-side Subplots - Foreground Area (%) and Pixel XOR vs D0 (%)
    renderTwoPanelSubplots(ctx, rows, {
      plotLeft,
      plotRight,
      plotTop,
      plotBottom,
      plotWidth,
      plotHeight,
    });
  } else if (chartId === 6) {
    // Chart 6: Processing Speed (FPS) & Latency
    renderPerformanceChart(ctx, rows, {
      plotLeft,
      plotRight,
      plotTop,
      plotBottom,
      plotWidth,
      plotHeight,
    });
  }

  return canvas;
}

function renderSingleBarChart(
  ctx: CanvasRenderingContext2D,
  rows: AggregatedComboRow[],
  opts: {
    plotLeft: number;
    plotRight: number;
    plotTop: number;
    plotBottom: number;
    plotWidth: number;
    plotHeight: number;
    unit: string;
    getValue: (r: AggregatedComboRow) => number;
    formatVal: (v: number) => string;
    getBarColor: (v: number) => string;
    zeroLineVisible?: boolean;
    minYZero?: boolean;
  }
) {
  const values = rows.map(opts.getValue);
  let minVal = Math.min(...values);
  let maxVal = Math.max(...values);

  if (opts.minYZero) {
    minVal = 0;
  }
  if (minVal > 0) minVal = 0;
  if (maxVal < 0) maxVal = 0;

  // Add margin
  const range = maxVal - minVal || 1;
  const yMin = minVal < 0 ? minVal - range * 0.15 : 0;
  const yMax = maxVal + range * 0.18;

  const getY = (val: number) =>
    opts.plotBottom - ((val - yMin) / (yMax - yMin)) * opts.plotHeight;

  const yZero = getY(0);

  // Draw Grid lines
  const gridSteps = 6;
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1.5;
  ctx.font = '22px "Times New Roman", serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.mutedText;

  for (let i = 0; i <= gridSteps; i++) {
    const val = yMin + (i / gridSteps) * (yMax - yMin);
    const y = getY(val);
    ctx.beginPath();
    ctx.moveTo(opts.plotLeft, y);
    ctx.lineTo(opts.plotRight, y);
    ctx.stroke();

    ctx.fillText(`${val.toFixed(1)} ${opts.unit}`, opts.plotLeft - 20, y + 8);
  }

  // Zero axis line
  ctx.strokeStyle = COLORS.axis;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(opts.plotLeft, yZero);
  ctx.lineTo(opts.plotRight, yZero);
  ctx.stroke();

  // Y-axis line
  ctx.beginPath();
  ctx.moveTo(opts.plotLeft, opts.plotTop);
  ctx.lineTo(opts.plotLeft, opts.plotBottom);
  ctx.stroke();

  // Draw Bars
  const barCount = rows.length;
  const colWidth = opts.plotWidth / barCount;
  const barWidth = colWidth * 0.52;

  rows.forEach((r, idx) => {
    const val = opts.getValue(r);
    const barX = opts.plotLeft + idx * colWidth + (colWidth - barWidth) / 2;
    const barY = getY(val);
    const height = Math.abs(barY - yZero);
    const topY = Math.min(barY, yZero);

    ctx.fillStyle = opts.getBarColor(val);
    ctx.fillRect(barX, topY, barWidth, height);
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(barX, topY, barWidth, height);

    // Value text
    ctx.font = 'bold 26px "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.text;
    const textY = val >= 0 ? topY - 14 : topY + height + 32;
    ctx.fillText(opts.formatVal(val), barX + barWidth / 2, textY);

    // X-axis setup label
    ctx.font = 'bold 28px "Times New Roman", serif';
    ctx.fillStyle = COLORS.text;
    ctx.fillText(r.code, barX + barWidth / 2, opts.plotBottom + 45);

    // Short setup name
    ctx.font = '20px "Times New Roman", serif';
    ctx.fillStyle = COLORS.mutedText;
    const shortLabel = getShortSetupLabel(r.code);
    ctx.fillText(shortLabel, barX + barWidth / 2, opts.plotBottom + 78);
  });
}

function renderGroupedBarChart(
  ctx: CanvasRenderingContext2D,
  rows: AggregatedComboRow[],
  opts: {
    plotLeft: number;
    plotRight: number;
    plotTop: number;
    plotBottom: number;
    plotWidth: number;
    plotHeight: number;
    unit: string;
    series: {
      name: string;
      color: string;
      getValue: (r: AggregatedComboRow) => number;
      formatVal: (v: number) => string;
    }[];
  }
) {
  let maxVal = 0;
  for (const s of opts.series) {
    for (const r of rows) {
      const v = s.getValue(r);
      if (v > maxVal) maxVal = v;
    }
  }
  const yMax = maxVal * 1.25 || 10;
  const getY = (val: number) => opts.plotBottom - (val / yMax) * opts.plotHeight;

  // Grid
  const gridSteps = 5;
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1.5;
  ctx.font = '22px "Times New Roman", serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.mutedText;

  for (let i = 0; i <= gridSteps; i++) {
    const val = (i / gridSteps) * yMax;
    const y = getY(val);
    ctx.beginPath();
    ctx.moveTo(opts.plotLeft, y);
    ctx.lineTo(opts.plotRight, y);
    ctx.stroke();

    ctx.fillText(`${val.toFixed(1)} ${opts.unit}`, opts.plotLeft - 20, y + 8);
  }

  // Axes
  ctx.strokeStyle = COLORS.axis;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(opts.plotLeft, opts.plotTop);
  ctx.lineTo(opts.plotLeft, opts.plotBottom);
  ctx.lineTo(opts.plotRight, opts.plotBottom);
  ctx.stroke();

  // Legend
  let legendX = opts.plotLeft + 30;
  const legendY = opts.plotTop - 35;
  opts.series.forEach((s) => {
    ctx.fillStyle = s.color;
    ctx.fillRect(legendX, legendY - 18, 30, 20);
    ctx.strokeStyle = '#1E293B';
    ctx.strokeRect(legendX, legendY - 18, 30, 20);

    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 24px "Times New Roman", serif';
    ctx.textAlign = 'left';
    ctx.fillText(s.name, legendX + 40, legendY);

    legendX += ctx.measureText(s.name).width + 90;
  });

  // Bars
  const colCount = rows.length;
  const colWidth = opts.plotWidth / colCount;
  const seriesCount = opts.series.length;
  const totalBarWidth = colWidth * 0.72;
  const singleBarWidth = totalBarWidth / seriesCount;

  rows.forEach((r, colIdx) => {
    const colStartX = opts.plotLeft + colIdx * colWidth + (colWidth - totalBarWidth) / 2;

    opts.series.forEach((s, sIdx) => {
      const val = s.getValue(r);
      const barX = colStartX + sIdx * singleBarWidth;
      const barY = getY(val);
      const height = opts.plotBottom - barY;

      ctx.fillStyle = s.color;
      ctx.fillRect(barX, barY, singleBarWidth - 4, height);
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(barX, barY, singleBarWidth - 4, height);

      // Value text
      ctx.font = 'bold 22px "Times New Roman", serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.text;
      ctx.fillText(s.formatVal(val), barX + (singleBarWidth - 4) / 2, barY - 10);
    });

    // Setup code
    ctx.font = 'bold 28px "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.text;
    ctx.fillText(r.code, colStartX + totalBarWidth / 2, opts.plotBottom + 45);

    ctx.font = '20px "Times New Roman", serif';
    ctx.fillStyle = COLORS.mutedText;
    ctx.fillText(getShortSetupLabel(r.code), colStartX + totalBarWidth / 2, opts.plotBottom + 78);
  });
}

function renderTwoPanelSubplots(
  ctx: CanvasRenderingContext2D,
  rows: AggregatedComboRow[],
  opts: {
    plotLeft: number;
    plotRight: number;
    plotTop: number;
    plotBottom: number;
    plotWidth: number;
    plotHeight: number;
  }
) {
  const gap = 120;
  const subWidth = (opts.plotWidth - gap) / 2;

  // Subplot A: Foreground Area (%)
  const pA = {
    left: opts.plotLeft,
    right: opts.plotLeft + subWidth,
    top: opts.plotTop + 40,
    bottom: opts.plotBottom,
    width: subWidth,
    height: opts.plotHeight - 40,
  };

  // Subplot B: Pixel XOR vs D0 (%)
  const pB = {
    left: opts.plotLeft + subWidth + gap,
    right: opts.plotRight,
    top: opts.plotTop + 40,
    bottom: opts.plotBottom,
    width: subWidth,
    height: opts.plotHeight - 40,
  };

  // Titles for subplots
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 28px "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.fillText('Panel 5A. Foreground Area Ratio (%)', pA.left + pA.width / 2, opts.plotTop);
  ctx.fillText('Panel 5B. Pixel XOR Difference vs D0 (%)', pB.left + pB.width / 2, opts.plotTop);

  // Render Subplot A
  renderSingleSubplot(ctx, rows, pA, {
    getValue: (r) => r.meanFgAreaRatioPct,
    formatVal: (v) => `${v.toFixed(2)}%`,
    color: COLORS.amber,
    unit: '%',
  });

  // Render Subplot B
  renderSingleSubplot(ctx, rows, pB, {
    getValue: (r) => r.meanDeltaPixelPctVsD0,
    formatVal: (v) => `${v.toFixed(2)}%`,
    color: COLORS.purple,
    unit: '%',
  });
}

function renderSingleSubplot(
  ctx: CanvasRenderingContext2D,
  rows: AggregatedComboRow[],
  panel: { left: number; right: number; top: number; bottom: number; width: number; height: number },
  cfg: {
    getValue: (r: AggregatedComboRow) => number;
    formatVal: (v: number) => string;
    color: string;
    unit: string;
  }
) {
  const maxVal = Math.max(...rows.map(cfg.getValue)) * 1.25 || 10;
  const getY = (val: number) => panel.bottom - (val / maxVal) * panel.height;

  // Grid
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1.5;
  ctx.font = '20px "Times New Roman", serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.mutedText;

  for (let i = 0; i <= 4; i++) {
    const val = (i / 4) * maxVal;
    const y = getY(val);
    ctx.beginPath();
    ctx.moveTo(panel.left, y);
    ctx.lineTo(panel.right, y);
    ctx.stroke();

    ctx.fillText(`${val.toFixed(1)} ${cfg.unit}`, panel.left - 15, y + 6);
  }

  // Axes
  ctx.strokeStyle = COLORS.axis;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(panel.left, panel.top);
  ctx.lineTo(panel.left, panel.bottom);
  ctx.lineTo(panel.right, panel.bottom);
  ctx.stroke();

  // Bars
  const colCount = rows.length;
  const colWidth = panel.width / colCount;
  const barWidth = colWidth * 0.58;

  rows.forEach((r, idx) => {
    const val = cfg.getValue(r);
    const barX = panel.left + idx * colWidth + (colWidth - barWidth) / 2;
    const barY = getY(val);
    const height = panel.bottom - barY;

    ctx.fillStyle = cfg.color;
    ctx.fillRect(barX, barY, barWidth, height);
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(barX, barY, barWidth, height);

    ctx.font = 'bold 20px "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.text;
    ctx.fillText(cfg.formatVal(val), barX + barWidth / 2, barY - 8);

    ctx.font = 'bold 24px "Times New Roman", serif';
    ctx.fillText(r.code, barX + barWidth / 2, panel.bottom + 36);
  });
}

function renderPerformanceChart(
  ctx: CanvasRenderingContext2D,
  rows: AggregatedComboRow[],
  opts: {
    plotLeft: number;
    plotRight: number;
    plotTop: number;
    plotBottom: number;
    plotWidth: number;
    plotHeight: number;
  }
) {
  const maxFps = Math.max(...rows.map((r) => r.meanFps)) * 1.3 || 60;
  const getY = (val: number) => opts.plotBottom - (val / maxFps) * opts.plotHeight;

  // Grid
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1.5;
  ctx.font = '22px "Times New Roman", serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.mutedText;

  for (let i = 0; i <= 5; i++) {
    const val = (i / 5) * maxFps;
    const y = getY(val);
    ctx.beginPath();
    ctx.moveTo(opts.plotLeft, y);
    ctx.lineTo(opts.plotRight, y);
    ctx.stroke();

    ctx.fillText(`${val.toFixed(0)} FPS`, opts.plotLeft - 20, y + 8);
  }

  // Axes
  ctx.strokeStyle = COLORS.axis;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(opts.plotLeft, opts.plotTop);
  ctx.lineTo(opts.plotLeft, opts.plotBottom);
  ctx.lineTo(opts.plotRight, opts.plotBottom);
  ctx.stroke();

  // Bars
  const colCount = rows.length;
  const colWidth = opts.plotWidth / colCount;
  const barWidth = colWidth * 0.52;

  rows.forEach((r, idx) => {
    const fps = r.meanFps;
    const latencyMs = fps > 0 ? 1000 / fps : 0;
    const barX = opts.plotLeft + idx * colWidth + (colWidth - barWidth) / 2;
    const barY = getY(fps);
    const height = opts.plotBottom - barY;

    ctx.fillStyle = COLORS.blue;
    ctx.fillRect(barX, barY, barWidth, height);
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(barX, barY, barWidth, height);

    // Value text
    ctx.font = 'bold 26px "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.text;
    ctx.fillText(`${fps.toFixed(1)} FPS`, barX + barWidth / 2, barY - 24);

    ctx.font = '20px "Times New Roman", serif';
    ctx.fillStyle = COLORS.mutedText;
    ctx.fillText(`(${latencyMs.toFixed(1)} ms)`, barX + barWidth / 2, barY - 4);

    // X-axis setup label
    ctx.font = 'bold 28px "Times New Roman", serif';
    ctx.fillStyle = COLORS.text;
    ctx.fillText(r.code, barX + barWidth / 2, opts.plotBottom + 45);

    ctx.font = '20px "Times New Roman", serif';
    ctx.fillStyle = COLORS.mutedText;
    ctx.fillText(getShortSetupLabel(r.code), barX + barWidth / 2, opts.plotBottom + 78);
  });
}

function getShortSetupLabel(code: string): string {
  switch (code) {
    case 'D0':
      return 'Full Baseline';
    case 'D1':
      return 'No Denoise';
    case 'D2':
      return 'No RANSAC';
    case 'D3':
      return 'Boxcar Smooth';
    case 'D4':
      return 'No Warp';
    case 'D5':
      return 'No Morph';
    case 'D6':
      return 'No Shadow';
    default:
      return code;
  }
}

/**
 * Downloads a single academic chart as PNG
 */
export async function exportSingleAcademicChartPng(
  chartId: number,
  rows: AggregatedComboRow[],
  videoCount: number
): Promise<string> {
  const canvas = renderAcademicChartToCanvas(chartId, rows, videoCount);
  const cfg = ACADEMIC_CHARTS.find((c) => c.id === chartId) ?? ACADEMIC_CHARTS[0];

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve('');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = cfg.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      resolve(cfg.filename);
    }, 'image/png');
  });
}

/**
 * Exports all 6 academic charts bundled into a single ZIP file
 */
export async function exportAllAcademicChartsZip(
  rows: AggregatedComboRow[],
  videoCount: number
): Promise<string> {
  const zip = new JSZip();

  for (const cfg of ACADEMIC_CHARTS) {
    const canvas = renderAcademicChartToCanvas(cfg.id, rows, videoCount);
    const dataUrl = canvas.toDataURL('image/png');
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    zip.file(cfg.filename, base64Data, { base64: true });
  }

  const zipFilename = `Table_12x_DSP501_Charts_300DPI_${videoCount}_Videos.zip`;
  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = zipFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return zipFilename;
}
