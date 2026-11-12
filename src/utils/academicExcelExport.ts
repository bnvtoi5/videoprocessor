import * as XLSX from 'xlsx';
import { AggregatedComboRow, VideoBatchResult } from '../components/research/MultiVideoAcceptanceStudio';

export function exportAcademicExcelData(
  aggregatedRows: AggregatedComboRow[],
  reportVideos: VideoBatchResult[],
  datasetBestSummary: { summaryText: string; isDatasetTie: boolean }
): string {
  const n = reportVideos.length;
  const wb = XLSX.utils.book_new();

  // ==========================================
  // SHEET 1: Summary
  // ==========================================
  const summaryAoa: (string | number)[][] = [
    ['BÁO CÁO THỰC NGHIỆM DSP501 – TABLE 12.x ABLATION STUDY (D0–D6)'],
    [`Tập dữ liệu: ${n} Video (${reportVideos.map((v) => v.videoTitle).join(', ')})`],
    [`Quy tắc Per-Video Best Config: 3 tiêu chí độc lập không trọng số. Kết luận toàn tập: ${datasetBestSummary.summaryText}`],
    [], // Blank line
    [
      'Setup',
      'Cấu Hình',
      'Vai Trò Khoa Học',
      'Per-Video Best Config',
      'Vote Chống Rung (Motion)',
      'Vote Ổn Định Mask (Temporal)',
      'Vote Min CC (Spatial)',
      'Motion Reduction (%)',
      'Residual Jitter (px)',
      'Temporal Flicker (%)',
      'Mask Stability Proxy (%)',
      'CC Before Morph (vùng/frame)',
      'CC After Morph (vùng/frame)',
      'Delta CC vs D0 (vùng/frame)',
      'Foreground Area (%)',
      'Pixel XOR vs D0 (%)',
      'F1 / IoU',
      'FPS (Mean)',
      'Mean Latency (ms/frame)',
    ],
  ];

  for (const r of aggregatedRows) {
    const bestCell =
      r.tiedBestVideoCount > 0
        ? `${r.soleBestVideoCount} thắng + ${r.tiedBestVideoCount} hòa / ${r.videoCount}`
        : `${r.soleBestVideoCount}/${r.videoCount} video`;
    const latencyMs = r.meanFps > 0 ? Number((1000 / r.meanFps).toFixed(2)) : 0;

    summaryAoa.push([
      r.code,
      r.label,
      r.bypassNote,
      bestCell,
      `${r.stabWinCount}/${r.videoCount}`,
      `${r.temporalWinCount}/${r.videoCount}`,
      `${r.cleanWinCount}/${r.videoCount}`,
      Number(r.meanJitterReductionPct.toFixed(2)),
      Number(r.meanResidualJitterRms.toFixed(2)),
      Number(r.meanFlickerRate.toFixed(2)),
      Number(r.meanMaskStabilityPct.toFixed(2)),
      Number(r.meanRawComponents.toFixed(2)),
      Number(r.meanCleanComponents.toFixed(2)),
      Number(r.meanDeltaCleanComponentsVsD0.toFixed(2)),
      Number(r.meanFgAreaRatioPct.toFixed(2)),
      Number(r.meanDeltaPixelPctVsD0.toFixed(2)),
      'N/A (No Ground Truth)',
      Number(r.meanFps.toFixed(1)),
      latencyMs,
    ]);
  }

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryAoa);
  wsSummary['!cols'] = [
    { wch: 8 },  // Setup
    { wch: 28 }, // Cau hinh
    { wch: 38 }, // Vai tro
    { wch: 24 }, // Best config
    { wch: 20 }, // Vote motion
    { wch: 22 }, // Vote temporal
    { wch: 18 }, // Vote min CC
    { wch: 18 }, // Motion reduction
    { wch: 18 }, // Residual jitter
    { wch: 18 }, // Flicker
    { wch: 20 }, // Mask stability
    { wch: 24 }, // CC before
    { wch: 24 }, // CC after
    { wch: 22 }, // Delta CC
    { wch: 18 }, // FG area
    { wch: 18 }, // Pixel XOR
    { wch: 18 }, // F1 / IoU
    { wch: 14 }, // FPS
    { wch: 20 }, // Latency
  ];

  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // ==========================================
  // SHEET 2: Per-Video Results
  // ==========================================
  const perVideoAoa: (string | number)[][] = [
    ['SỐ LIỆU THỰC NGHIỆM CHI TIẾT TỪNG VIDEO (TABLE 12.x ABLATION SUITE D0–D6)'],
    [`Tổng số video được đánh giá: ${n} video`],
    [],
  ];

  for (const [idx, v] of reportVideos.entries()) {
    perVideoAoa.push([
      `VIDEO #${idx + 1}: ${v.videoTitle} | NHÓM: ${v.datasetGroup.groupCode} | ĐỘ PHÂN GIẢI: ${v.width}x${v.height} | SỐ FRAME: ${v.frameCount} | KẾT QUẢ DẪN ĐẦU: ${v.perVideoBestDisplay}`,
    ]);
    perVideoAoa.push([
      'Setup',
      'Tên Cấu Hình',
      'Giảm Rung (%)',
      'Rung Dư (px)',
      'Temporal Flicker (%)',
      'Mask Stability Proxy (%)',
      'CC Trước Morph',
      'CC Sau Morph',
      'Delta CC vs D0',
      'Foreground Area (%)',
      'Pixel XOR vs D0 (%)',
      'F1 / IoU',
      'FPS',
      'Latency (ms/frame)',
      'Thắng Motion',
      'Thắng Temporal',
      'Thắng Spatial',
      'Số Tiêu Chí Dẫn Đầu',
      'Per-Video Best Config',
    ]);

    for (const s of v.slotResults) {
      const lat = s.fps > 0 ? Number((1000 / s.fps).toFixed(2)) : 0;
      perVideoAoa.push([
        s.code,
        s.label,
        Number(s.jitterReductionPct.toFixed(2)),
        Number(s.residualOutputJitterRms.toFixed(2)),
        Number(s.maskFlickerPct.toFixed(2)),
        Number(s.maskStabilityPct.toFixed(2)),
        Number(s.rawComponentCount.toFixed(2)),
        Number(s.postMorphologyComponentCount.toFixed(2)),
        Number(s.deltaCleanComponentsVsD0.toFixed(2)),
        Number(s.fgAreaRatioPct.toFixed(2)),
        Number(s.deltaPixelRatioVsBaselinePct.toFixed(2)),
        'N/A (No Ground Truth)',
        Number(s.fps.toFixed(1)),
        lat,
        s.wonMotionCriterion ? 'YES' : 'NO',
        s.wonTemporalCriterion ? 'YES' : 'NO',
        s.wonSpatialCriterion ? 'YES' : 'NO',
        `${s.criterionWinsOnVideo}/3`,
        v.perVideoBestDisplay,
      ]);
    }
    perVideoAoa.push([]); // Empty row separating videos
  }

  const wsPerVideo = XLSX.utils.aoa_to_sheet(perVideoAoa);
  wsPerVideo['!cols'] = [
    { wch: 8 },  // Setup
    { wch: 28 }, // Label
    { wch: 14 }, // Reduction
    { wch: 14 }, // Residual
    { wch: 18 }, // Flicker
    { wch: 20 }, // Mask stab
    { wch: 16 }, // CC raw
    { wch: 16 }, // CC clean
    { wch: 16 }, // Delta CC
    { wch: 16 }, // FG area
    { wch: 16 }, // Pixel XOR
    { wch: 18 }, // F1/IoU
    { wch: 12 }, // FPS
    { wch: 16 }, // Latency
    { wch: 14 }, // Won Motion
    { wch: 14 }, // Won Temporal
    { wch: 14 }, // Won Spatial
    { wch: 18 }, // Score
    { wch: 30 }, // Best config
  ];
  XLSX.utils.book_append_sheet(wb, wsPerVideo, 'Per-Video Results');

  // ==========================================
  // SHEET 3: Metrics Definition
  // ==========================================
  const metricsAoa: (string | number)[][] = [
    ['ĐỊNH NGHĨA TOÁN HỌC & Ý NGHĨA KHOA HỌC 8 CHỈ SỐ THỰC NGHIỆM TABLE 12.x'],
    [],
    [
      'Tên Chỉ Số',
      'Ký Hiệu',
      'Công Thức Toán Học',
      'Đơn Vị',
      'Ý Nghĩa Khoa Học',
      'Hướng Đánh Giá Tối Ưu',
      'Giới Hạn Diễn Giải',
    ],
    [
      'Motion Reduction',
      'ΔJ (%)',
      '((J_input − J_residual) / J_input) × 100%',
      '%',
      'Tỷ lệ phần trăm giảm độ rung lắc camera tần số cao so với video gốc đầu vào.',
      'Max (Càng cao càng tốt)',
      'Giá trị dương thể hiện giảm rung; D4 No Warp bằng 0.0%; D2 âm do ngoại lai kéo lệch Affine.',
    ],
    [
      'Residual Jitter',
      'J_res (px)',
      'sqrt( (1 / (2(T−1))) × Σ [ (Δx_out − Δx_smooth)² + (Δy_out − Δy_smooth)² ] )',
      'px',
      'Độ rung lắc camera tần số cao còn sót lại sau ổn định, đo trực tiếp trên chuỗi frame xuất xưởng.',
      'Min (Càng thấp càng tốt)',
      'Được đo độc lập bằng Shi-Tomasi + LK + 2.5px RANSAC Similarity. D0=D1=D5=D6 do dùng chung nhánh.',
    ],
    [
      'Temporal Mask Flicker',
      'F_mask (%)',
      '(1 / (T−1)) × Σ [ Σ |M_t(x,y) − M_{t-1}(x,y)| / (255 × W × H) ] × 100%',
      '%',
      'Tỷ lệ pixel đổi trạng thái liên tục giữa hai khung hình liên tiếp t-1 và t.',
      'Min (Càng thấp càng tốt)',
      'Đo độ giật nhấp nháy thời gian của mặt nạ nhị phân.',
    ],
    [
      'Mask Stability Proxy',
      'S_mask (%)',
      '100% − Temporal Mask Flicker (%)',
      '%',
      'Độ ổn định thời gian của mặt nạ tiền cảnh.',
      'Max (Càng cao càng tốt)',
      'Là chỉ số đại diện thời gian (Proxy Metric), không đánh đồng với Ground Truth Accuracy.',
    ],
    [
      'Connected Components',
      'CC (vùng/frame)',
      '(1 / T) × Σ N_components(M_t)',
      'vùng/frame',
      'Số vùng liên thông 8 hướng trung bình trước và sau Morphology + lọc diện tích A_min = 28 px².',
      'Min (Sau Morph)',
      'Thước đo độ phân mảnh không gian (Spatial Fragmentation Proxy), không đánh đồng với Segmentation Accuracy.',
    ],
    [
      'Foreground Area Ratio',
      'R_fg (%)',
      '(1 / T) × Σ [ Count(M_t = 255) / (W × H) ] × 100%',
      '%',
      'Tỷ lệ diện tích pixel tiền cảnh phát hiện được trên toàn khung hình.',
      'Tham chiếu',
      'Phản ánh kích thước vùng chuyển động; D6 tăng diện tích do bắt nhầm bóng di động.',
    ],
    [
      'Pixel XOR vs D0',
      'Δ_XOR (%)',
      '(1 / T) × Σ_{t=0}^{T-1} [ Count(M_t(Di) ≠ M_t(D0)) / (W × H) ] × 100%',
      '%',
      'Tỷ lệ sai khác từng điểm ảnh giữa mặt nạ cấu hình Di và Baseline D0 trên toàn bộ T khung hình.',
      'Phân tích biến thể',
      'Không gọi là Segmentation Error vì D0 là baseline chuẩn tham chiếu, không phải Ground Truth.',
    ],
    [
      'Processing Performance',
      'FPS (Mean)',
      '1000 / Mean_Latency_ms',
      'FPS',
      'Tốc độ xử lý khung hình trung bình của pipeline.',
      'Max (Càng cao càng tốt)',
      'Thời gian đo thuần túy thuật toán DSP mỗi frame; loại trừ thời gian I/O decode và render UI.',
    ],
  ];

  const wsMetrics = XLSX.utils.aoa_to_sheet(metricsAoa);
  wsMetrics['!cols'] = [
    { wch: 22 }, // Ten
    { wch: 14 }, // Ky hieu
    { wch: 45 }, // Cong thuc
    { wch: 14 }, // Don vi
    { wch: 45 }, // Y nghia
    { wch: 24 }, // Huong danh gia
    { wch: 45 }, // Gioi han
  ];
  XLSX.utils.book_append_sheet(wb, wsMetrics, 'Metrics Definition');

  const filename = `Table_12x_DSP501_Ablation_Data_${n}_Videos.xlsx`;
  XLSX.writeFile(wb, filename);

  return filename;
}
