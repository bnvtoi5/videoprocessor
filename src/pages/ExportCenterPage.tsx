import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Image,
  Download,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  BookOpen,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { DecodedVideoSession, PlaylistVideoItem } from '../types/video';
import {
  ForegroundDisplayConfig,
  FrameDiffParams,
  Mog2Params,
  MorphologyConfig,
  SampleKnnParams,
  StabilizationParams,
} from '../types/algorithm';
import {
  ParameterSensitivitySweepResult,
  TraceableExperimentLogEntry,
} from '../types/research';
import {
  AggregatedComboRow,
  VideoBatchResult,
} from '../components/research/MultiVideoAcceptanceStudio';
import { exportAcademicExcelData } from '../utils/academicExcelExport';
import {
  ACADEMIC_CHARTS,
  exportAllAcademicChartsZip,
  exportSingleAcademicChartPng,
} from '../utils/academicChartExport';
import { LabPageId } from '../components/layout/Sidebar';
import {
  buildAggregatedRowsFromVideos,
  getPrecomputedVideodataBatchResults,
} from '../data/precomputedVideodataLoader';

export interface ExportCenterPageProps {
  session: DecodedVideoSession;
  playlist?: PlaylistVideoItem[];
  batchResults?: VideoBatchResult[];
  onBatchResultsChange?: (results: VideoBatchResult[]) => void;
  onNavigate?: (page: LabPageId) => void;
  stabilizationParams: StabilizationParams;
  frameDiffParams: FrameDiffParams;
  mog2Params: Mog2Params;
  sampleKnnParams: SampleKnnParams;
  morphologyConfig: MorphologyConfig;
  displayConfig: ForegroundDisplayConfig;
  experimentLogs: TraceableExperimentLogEntry[];
  onAppendExperimentLog: (entry: TraceableExperimentLogEntry) => void;
  sensitivitySweeps: ParameterSensitivitySweepResult[];
}

export const ExportCenterPage: React.FC<ExportCenterPageProps> = ({
  playlist = [],
  batchResults = [],
  onBatchResultsChange,
  onNavigate,
}) => {
  const [feedback, setFeedback] = useState<{
    format: 'xlsx' | 'png' | 'zip';
    filename: string;
    timestamp: string;
  } | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // If user passed batch results from running experiments on their uploaded videos:
  // filter by selected playlist videos if any are selected, otherwise use all batchResults
  const selectedIds = new Set(
    playlist.filter((v) => v.selected).map((v) => v.id)
  );

  const activeBatchVideos =
    selectedIds.size > 0
      ? batchResults.filter((v) => selectedIds.has(v.videoId))
      : batchResults;

  const finalReportVideos =
    activeBatchVideos.length > 0 ? activeBatchVideos : batchResults;

  const aggregatedRows: AggregatedComboRow[] =
    finalReportVideos.length > 0
      ? buildAggregatedRowsFromVideos(finalReportVideos)
      : [];

  const videoCount = finalReportVideos.length;
  const videoNames = finalReportVideos.map((v) => v.videoTitle);

  const datasetBestSummary = {
    summaryText: `Đã tổng hợp thực nghiệm từ ${videoCount} video (${videoNames.join(', ')}) theo quy tắc bầu chọn 3 tiêu chí không trọng số (Motion, Temporal, Spatial).`,
    isDatasetTie: false,
  };

  const handleLoadSampleVideodata = () => {
    const samples = getPrecomputedVideodataBatchResults();
    if (onBatchResultsChange) {
      onBatchResultsChange(samples);
    }
  };

  const handleExportExcel = () => {
    if (finalReportVideos.length === 0 || aggregatedRows.length === 0) return;
    setIsExporting(true);
    try {
      const filename = exportAcademicExcelData(
        aggregatedRows,
        finalReportVideos,
        datasetBestSummary
      );
      setFeedback({
        format: 'xlsx',
        filename,
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportChartsZip = async () => {
    if (finalReportVideos.length === 0 || aggregatedRows.length === 0) return;
    setIsExporting(true);
    try {
      const filename = await exportAllAcademicChartsZip(
        aggregatedRows,
        videoCount
      );
      setFeedback({
        format: 'zip',
        filename,
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportSingleChart = async (chartIndex: number) => {
    if (finalReportVideos.length === 0 || aggregatedRows.length === 0) return;
    setIsExporting(true);
    try {
      const chartId = chartIndex + 1; // 1-indexed chart id
      const filename = await exportSingleAcademicChartPng(
        chartId,
        aggregatedRows,
        videoCount
      );
      setFeedback({
        format: 'png',
        filename,
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div data-testid="export-center-page" className="space-y-6">
      {/* Top Academic Export Header */}
      <div className="bg-white border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-blue-700 text-white font-mono text-xs font-bold tracking-wide uppercase">
                HỆ THỐNG XUẤT SỐ LIỆU & BIỂU ĐỒ DSP501
              </span>
              <span className="text-xs font-mono text-slate-500">
                (EXCEL DATA WORKBOOK · 300 DPI PNG CHARTS)
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Xuất Sổ Dữ Liệu Excel (3 Sheets) & Bộ Biểu Đồ Báo Cáo (PNG ≥ 300 DPI)
            </h1>
            <p className="text-xs text-slate-600 leading-relaxed">
              Cung cấp <strong>2 định dạng xuất dữ liệu khoa học</strong>: Bảng tính Excel (.xlsx) với đúng 3 sheets
              chuẩn xác (Tổng hợp D0–D6, Chi tiết từng video, Định nghĩa công thức toán học) và Bộ biểu đồ học thuật
              chuẩn 300 DPI (nền trắng tinh khiết, nét vẽ sắc nét, nhãn giá trị rõ ràng).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('experiment_lab')}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Đến Tab 1: Nghiệm Thu &amp; Chạy Thử Video</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Success Feedback Banner */}
        {feedback && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-300 flex items-center justify-between text-xs font-mono text-emerald-900 animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Xuất file thành công: <strong>{feedback.filename}</strong> (định dạng{' '}
                {feedback.format.toUpperCase()} lúc {feedback.timestamp})
              </span>
            </div>
            <span className="text-emerald-700 font-semibold text-[11px]">
              Đã tải về máy tính
            </span>
          </div>
        )}

        {/* Scope Pill */}
        <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-mono">Tập video đang chọn:</span>
            {videoCount > 0 ? (
              <>
                <span className="px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-800 font-semibold font-mono">
                  {videoCount} Video
                </span>
                <span className="text-slate-500 truncate max-w-xl">
                  ({videoNames.join(', ')})
                </span>
              </>
            ) : (
              <span className="text-amber-700 font-mono italic">
                Chưa có dữ liệu video thực nghiệm
              </span>
            )}
          </div>

          {videoCount === 0 && onBatchResultsChange && (
            <button
              type="button"
              onClick={handleLoadSampleVideodata}
              className="text-[11px] font-mono text-blue-700 hover:text-blue-900 underline flex items-center gap-1 cursor-pointer"
              title="Nạp dữ liệu mẫu 15 video trong videodata/ để xem trước các biểu đồ và bảng tính"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Nạp nhanh dữ liệu mẫu 15 video (videodata/) để xem trước</span>
            </button>
          )}
        </div>
      </div>

      {/* Empty State Banner if no videos tested yet */}
      {videoCount === 0 && (
        <div className="p-8 bg-amber-50 border border-amber-300 text-center space-y-3 shadow-xs">
          <AlertCircle className="w-10 h-10 text-amber-600 mx-auto" />
          <div className="text-sm font-bold text-amber-900">
            Chưa có số liệu thực nghiệm để xuất file
          </div>
          <p className="text-xs text-amber-800 max-w-lg mx-auto leading-relaxed">
            Hệ thống đã làm trống danh sách video để người dùng tự nhập video mới vào kiểm thử.
            Vui lòng chuyển qua <strong>Tab 1: Nghiệm Thu Đa Video &amp; Bầu Chọn</strong>, tải video từ máy tính của bạn và nhấn <strong>"Chạy Video Đã Chọn"</strong>. Số liệu tính toán sẽ tự động hiển thị tại đây để bạn tải Excel và Biểu đồ.
          </p>
          {onNavigate && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => onNavigate('experiment_lab')}
                className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <span>Chuyển Sang Tab 1 Để Tải Video &amp; Chạy Nghiệm Thu</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* 2 Core Export Formats Grid: Excel & 300 DPI Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* FORMAT 1: EXCEL (.XLSX) */}
        <div className="bg-white border-2 border-emerald-600 p-6 flex flex-col justify-between shadow-xs relative">
          <div className="absolute -top-3 left-4 px-2 py-0.5 bg-emerald-600 text-white font-mono text-[10px] font-bold tracking-wider uppercase">
            ĐỊNH DẠNG 1 · SỔ CÁI DỮ LIỆU SỐ HỌC
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Sổ Dữ Liệu Excel (.xlsx)
                </h2>
                <div className="text-[11px] font-mono text-slate-500">
                  Chuẩn xác 3 Sheets · OpenXML
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
              <p>
                Workbook Excel chuẩn khoa học với đúng <strong>3 Sheet</strong> được tổ chức rõ ràng:
              </p>
              <ul className="list-disc pl-4 space-y-1.5 text-slate-700 text-[11px]">
                <li>
                  <strong>Sheet 1 – Summary:</strong> Tổng hợp kết quả 7 cấu hình D0–D6 trên toàn bộ video, 8 chỉ số khoa học, số phiếu tiêu chí và Per-Video Best Configuration.
                </li>
                <li>
                  <strong>Sheet 2 – Per-Video Results:</strong> Bảng số liệu chi tiết 7 cấu hình của từng video, phân tách tiêu đề rõ ràng, tiện trích dẫn.
                </li>
                <li>
                  <strong>Sheet 3 – Metrics Definition:</strong> Bảng tra cứu tên chỉ số, ký hiệu, công thức toán học, đơn vị, ý nghĩa, chiều tối ưu và giới hạn diễn giải.
                </li>
                <li>
                  <em>Không chứa</em> sheet debug, biến nội bộ hay log hệ thống không cần thiết.
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <button
              type="button"
              disabled={isExporting || videoCount === 0}
              onClick={handleExportExcel}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Tải Sổ Dữ Liệu Excel (.xlsx)</span>
            </button>
            <div className="text-[11px] text-center font-mono text-slate-400 mt-2">
              {videoCount > 0
                ? `Table_12x_DSP501_Data_${videoCount}_Videos.xlsx`
                : 'Chưa có dữ liệu'}
            </div>
          </div>
        </div>

        {/* FORMAT 2: PNG CHARTS (>= 300 DPI) */}
        <div className="bg-white border-2 border-purple-600 p-6 flex flex-col justify-between shadow-xs relative">
          <div className="absolute -top-3 left-4 px-2 py-0.5 bg-purple-600 text-white font-mono text-[10px] font-bold tracking-wider uppercase">
            ĐỊNH DẠNG 2 · BỘ BIỂU ĐỒ HỌC THUẬT
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700">
                <Image className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Bộ Biểu Đồ PNG (≥ 300 DPI)
                </h2>
                <div className="text-[11px] font-mono text-slate-500">
                  6 Biểu Đồ Riêng Biệt · Nền Trắng Tinh Khiết
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
              <p>
                Bộ biểu đồ học thuật độ phân giải siêu cao (2400×1400 px), xuất trực tiếp phục vụ in ấn hoặc chèn vào tài liệu:
              </p>
              <ul className="list-disc pl-4 space-y-1.5 text-slate-700 text-[11px]">
                <li>
                  <strong>Tách riêng 6 biểu đồ:</strong> Không ghép các đại lượng khác đơn vị vào chung một trục tung.
                </li>
                <li>
                  <strong>Chuẩn ấn phẩm A4:</strong> Nền trắng tinh khiết, font Times New Roman, nhãn giá trị trực tiếp trên từng cột.
                </li>
                <li>
                  <strong>Đồng nhất D0–D6:</strong> Giữ nguyên thứ tự và màu nhận diện tiêu chuẩn khoa học.
                </li>
                <li>
                  <strong>Tải linh hoạt:</strong> Tải trọn bộ 6 biểu đồ trong 1 file ZIP hoặc bấm tải lẻ từng hình phía dưới.
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <button
              type="button"
              disabled={isExporting || videoCount === 0}
              onClick={handleExportChartsZip}
              className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Tải Trọn Bộ 6 Biểu Đồ (.ZIP)</span>
            </button>
            <div className="text-[11px] text-center font-mono text-slate-400 mt-2">
              {videoCount > 0
                ? `Table_12x_DSP501_Charts_300DPI_${videoCount}_Videos.zip`
                : 'Chưa có dữ liệu'}
            </div>
          </div>
        </div>
      </div>

      {/* Individual Chart Download Section */}
      <div className="bg-white border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-purple-700" />
            <h2 className="text-sm font-bold text-slate-900">
              Tải Lẻ Từng Biểu Đồ Học Thuật (Độ Phân Giải ≥ 300 DPI Cho Báo Cáo)
            </h2>
          </div>
          <span className="text-xs font-mono text-slate-500">
            Kích thước chuẩn: 2400 × 1400 px · Nền trắng
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ACADEMIC_CHARTS.map((chart, idx) => (
            <div
              key={chart.id}
              className="bg-slate-50 border border-slate-200 p-4 flex flex-col justify-between hover:border-purple-300 transition-colors"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 border border-purple-200">
                    Biểu đồ {idx + 1}/6
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {chart.unit}
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-800">
                  {chart.title}
                </div>
                <p className="text-[11px] text-slate-600 line-clamp-2">
                  {chart.subtitle}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  disabled={isExporting || videoCount === 0}
                  onClick={() => handleExportSingleChart(idx)}
                  className="w-full py-1.5 px-3 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-300 text-slate-800 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-purple-700" />
                  <span>Tải ảnh PNG 300 DPI</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5 Scientific Thematic Groups & Strict Mathematical Standards */}
      <div className="bg-white border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-900 border-b border-slate-200 pb-3">
          <BookOpen className="w-4 h-4 text-blue-700" />
          <span>5 Nhóm Tiêu Chí Khoa Học &amp; Chuẩn Hóa Toán Học (Chuẩn Hóa Học Thuật)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
          <div className="p-3 bg-blue-50/50 border border-blue-200 space-y-1">
            <div className="font-bold text-blue-900">1. Motion Stabilization</div>
            <div className="text-[11px] text-slate-600">
              Giảm rung <strong>Motion Reduction (%)</strong> và Rung dư <strong>Residual Jitter (px)</strong> đo bằng Evaluator độc lập (Shi-Tomasi + LK + RANSAC 2.5px).
            </div>
          </div>

          <div className="p-3 bg-indigo-50/50 border border-indigo-200 space-y-1">
            <div className="font-bold text-indigo-900">2. Temporal Mask Quality</div>
            <div className="text-[11px] text-slate-600">
              Hiện tượng nhấp nháy <strong>Temporal Mask Flicker (%)</strong> và độ ổn định thời gian <strong>Mask Stability Proxy (%)</strong>.
            </div>
          </div>

          <div className="p-3 bg-amber-50/50 border border-amber-200 space-y-1">
            <div className="font-bold text-amber-900">3. Spatial Characteristics</div>
            <div className="text-[11px] text-slate-600">
              Độ phân mảnh <strong>CC Before/After Morph</strong>, tỷ lệ diện tích <strong>Foreground Area (%)</strong> và <strong>Pixel XOR vs D0 (%)</strong>.
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 space-y-1">
            <div className="font-bold text-slate-900">4. Processing Performance</div>
            <div className="text-[11px] text-slate-600">
              Tốc độ tính toán thuần thuật toán DSP <strong>FPS (Mean)</strong> và độ trễ <strong>Mean Latency (ms/frame)</strong>.
            </div>
          </div>

          <div className="p-3 bg-emerald-50/50 border border-emerald-200 space-y-1">
            <div className="font-bold text-emerald-900">5. Per-Video Evaluation</div>
            <div className="text-[11px] text-slate-600">
              Đánh giá chi tiết từng video, số phiếu theo 3 tiêu chí không trọng số và xác định <strong>Per-Video Best Config</strong> (ghi rõ Tie khi hòa).
            </div>
          </div>
        </div>

        <div className="p-3.5 bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed space-y-1.5 font-mono">
          <div className="font-bold text-slate-800">
            Cam Kết Tính Toàn Vẹn Số Liệu Thực Nghiệm:
          </div>
          <div>
            • <strong>Cả 2 định dạng xuất</strong> (Excel, Charts) đọc từ cùng một tập dữ liệu thực nghiệm đã tính toán trong ứng dụng.
          </div>
          <div>
            • <strong>Giữ nguyên định dạng N/A:</strong> Do không có Ground Truth, F1 và IoU hiển thị N/A, tuyệt đối không thay bằng số 0 hoặc số giả.
          </div>
          <div>
            • <strong>Đơn vị và độ chính xác:</strong> Giữ nguyên chữ số thập phân chuẩn khoa học (Motion Reduction: 1 chữ số, Residual Jitter: 2 chữ số, Flicker &amp; Area: 2 chữ số, FPS: 1 chữ số).
          </div>
        </div>
      </div>
    </div>
  );
};
