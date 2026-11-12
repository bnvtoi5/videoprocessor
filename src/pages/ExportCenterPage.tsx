import React, { useState } from 'react';
import {
  FileText,
  FileSpreadsheet,
  Image,
  Download,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  BookOpen,
  ArrowRight,
  Sparkles,
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
import { exportAcademicWordReport } from '../utils/academicDocxExport';
import { exportAcademicExcelData } from '../utils/academicExcelExport';
import {
  ACADEMIC_CHARTS,
  exportAllAcademicChartsZip,
  exportSingleAcademicChartPng,
} from '../utils/academicChartExport';
import { LabPageId } from '../components/layout/Sidebar';

export interface ExportCenterPageProps {
  session: DecodedVideoSession;
  playlist?: PlaylistVideoItem[];
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

import {
  buildAggregatedRowsFromVideos,
  getPrecomputedVideodataBatchResults,
} from '../data/precomputedVideodataLoader';

export const ExportCenterPage: React.FC<ExportCenterPageProps> = ({
  playlist = [],
  onNavigate,
}) => {
  const [feedback, setFeedback] = useState<{
    format: 'docx' | 'xlsx' | 'png' | 'zip';
    filename: string;
    timestamp: string;
  } | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const allPrecomputedVideos = getPrecomputedVideodataBatchResults();
  const selectedIds = new Set(
    playlist.filter((v) => v.selected).map((v) => v.id)
  );
  const activeReportVideos =
    selectedIds.size > 0
      ? allPrecomputedVideos.filter((v) => selectedIds.has(v.videoId))
      : allPrecomputedVideos;
  const finalReportVideos =
    activeReportVideos.length > 0 ? activeReportVideos : allPrecomputedVideos;
  const aggregatedRows = buildAggregatedRowsFromVideos(finalReportVideos);

  const videoCount = finalReportVideos.length;
  const videoNames = finalReportVideos.map((v) => v.videoTitle);

  const datasetBestSummary = {
    summaryText: `Đã tổng hợp thực nghiệm từ ${videoCount} video trong videodata/ (${videoNames.join(', ')}) theo quy tắc bầu chọn 3 tiêu chí không trọng số (Motion, Temporal, Spatial).`,
    isDatasetTie: false,
  };

  const handleExportDocx = async () => {
    setIsExporting(true);
    try {
      const filename = await exportAcademicWordReport(
        aggregatedRows,
        finalReportVideos,
        datasetBestSummary
      );
      setFeedback({
        format: 'docx',
        filename,
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = () => {
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
                HỆ THỐNG XUẤT TÀI LIỆU BÁO CÁO DSP501
              </span>
              <span className="text-xs font-mono text-slate-500">
                (ACADEMIC EXPORT SUITE · TABLE 12.x · 15 VIDEO VIDEODATA)
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Xuất Báo Cáo Nghiệm Thu Khoa Học & Dữ Liệu Thực Nghiệm Ablation D0–D6
            </h1>
            <p className="text-xs text-slate-600 leading-relaxed">
              Hệ thống được đồng bộ 100% với 15 video trong thư mục <code>videodata/</code> và file báo cáo{' '}
              <strong>Bao_cao_Spatiotemporal_Video_Processing_Lab.docx</strong>: cung cấp{' '}
              <strong>3 định dạng xuất chính quy</strong> (Word Báo cáo Table 12.x, Excel 3 Sheets, Biểu đồ PNG 300 DPI)
              cùng nút tải trực tiếp bản báo cáo đầy đủ 19 mục & phụ lục đã cập nhật số liệu thực tế.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/Bao_cao_Spatiotemporal_Video_Processing_Lab.docx"
              download="Bao_cao_Spatiotemporal_Video_Processing_Lab.docx"
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải Báo Cáo Đầy Đủ Đã Cập Nhật (.docx)</span>
            </a>

            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('experiment_lab')}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5 text-blue-700" />
                <span>Xem Bảng Số Liệu Ở Tab 1</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
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

        {/* Selected Videos Scope Pill */}
        <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500 font-mono">Tập video đang xuất báo cáo:</span>
          <span className="px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-800 font-semibold font-mono">
            {videoCount} Video (videodata/)
          </span>
          <span className="text-slate-500 truncate max-w-xl">
            ({videoNames.join(', ')})
          </span>
        </div>
      </div>


      {/* 3 Core Academic Export Formats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* FORMAT A: WORD (.DOCX) */}
        <div className="bg-white border-2 border-blue-600 p-6 flex flex-col justify-between shadow-xs relative">
          <div className="absolute -top-3 left-4 px-2 py-0.5 bg-blue-600 text-white font-mono text-[10px] font-bold tracking-wider uppercase">
            ĐỊNH DẠNG 1 · BÁO CÁO HOÀN CHỈNH
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Báo Cáo Word (.docx)
                </h2>
                <div className="text-[11px] font-mono text-slate-500">
                  Microsoft Word · Table 12.x
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
              <p>
                Xuất tài liệu Word hoàn chỉnh, có cấu trúc học thuật sẵn sàng nộp hoặc chèn vào báo cáo DSP501:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-slate-700 text-[11px]">
                <li>
                  <strong>Bảng Table 12.x thực sự</strong> (Native Word Table có viền, nền, header lặp lại khi sang trang).
                </li>
                <li>
                  Font chữ <strong>Times New Roman</strong>, cỡ chữ 11-12pt chuẩn học thuật.
                </li>
                <li>
                  Mục tiêu thực nghiệm, phân tích chuyên môn và giải thích nguyên lý toán học.
                </li>
                <li>
                  Ghi rõ giới hạn đánh giá khi thiếu Ground Truth (F1/IoU = N/A).
                </li>
                <li>
                  <em>Không chứa</em> Validation Log, mã debug hay biến nội bộ.
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <button
              type="button"
              disabled={isExporting}
              onClick={handleExportDocx}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Tải Báo Cáo Word (.docx)</span>
            </button>
            <div className="text-[11px] text-center font-mono text-slate-400 mt-2">
              Table_12x_DSP501_Report_{videoCount}_Videos.docx
            </div>
          </div>
        </div>

        {/* FORMAT B: EXCEL (.XLSX) */}
        <div className="bg-white border-2 border-emerald-600 p-6 flex flex-col justify-between shadow-xs relative">
          <div className="absolute -top-3 left-4 px-2 py-0.5 bg-emerald-600 text-white font-mono text-[10px] font-bold tracking-wider uppercase">
            ĐỊNH DẠNG 2 · SỔ CÁI DỮ LIỆU
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Dữ Liệu Excel (.xlsx)
                </h2>
                <div className="text-[11px] font-mono text-slate-500">
                  Chuẩn xác 3 Sheets · OpenXML
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
              <p>
                Workbook Excel duy nhất phục vụ báo cáo khoa học với đúng <strong>3 Sheet</strong>:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-slate-700 text-[11px]">
                <li>
                  <strong>Sheet 1 – Summary:</strong> Tổng hợp 7 cấu hình D0–D6, 8 chỉ số khoa học, số phiếu tiêu chí và Per-Video Best Config.
                </li>
                <li>
                  <strong>Sheet 2 – Per-Video Results:</strong> Số liệu chi tiết từng video của 7 cấu hình, phân tách rõ ràng.
                </li>
                <li>
                  <strong>Sheet 3 – Metrics Definition:</strong> Tên chỉ số, ký hiệu, công thức toán học, đơn vị, ý nghĩa, chiều tối ưu và giới hạn.
                </li>
                <li>
                  <em>Không có</em> sheet debug, sheet thô thừa hay log nội bộ.
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <button
              type="button"
              disabled={isExporting}
              onClick={handleExportExcel}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Tải Sổ Dữ Liệu Excel (.xlsx)</span>
            </button>
            <div className="text-[11px] text-center font-mono text-slate-400 mt-2">
              Table_12x_DSP501_Data_{videoCount}_Videos.xlsx
            </div>
          </div>
        </div>

        {/* FORMAT C: PNG CHARTS (>= 300 DPI) */}
        <div className="bg-white border-2 border-purple-600 p-6 flex flex-col justify-between shadow-xs relative">
          <div className="absolute -top-3 left-4 px-2 py-0.5 bg-purple-600 text-white font-mono text-[10px] font-bold tracking-wider uppercase">
            ĐỊNH DẠNG 3 · BIỂU ĐỒ BÁO CÁO
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700">
                <Image className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Biểu Đồ PNG (≥ 300 DPI)
                </h2>
                <div className="text-[11px] font-mono text-slate-500">
                  6 Biểu Đồ Riêng Biệt · Nền Trắng
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
              <p>
                Bộ biểu đồ học thuật phân giải siêu cao (2400×1400 px), nét vẽ sắc sảo, thích hợp in ấn A4:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-slate-700 text-[11px]">
                <li>Tách riêng 6 biểu đồ, không gộp các đại lượng có đơn vị khác nhau vào cùng trục.</li>
                <li>Nền trắng tinh khiết, font Times New Roman, nhãn giá trị trực tiếp trên đầu cột.</li>
                <li>Thứ tự D0–D6 đồng nhất, highlight màu nhận diện tiêu chuẩn từng cấu hình.</li>
                <li>Gói trọn bộ trong 1 file ZIP hoặc tải lẻ từng biểu đồ phía dưới.</li>
              </ul>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <button
              type="button"
              disabled={isExporting}
              onClick={handleExportChartsZip}
              className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Tải Trọn Bộ 6 Biểu Đồ (.ZIP)</span>
            </button>
            <div className="text-[11px] text-center font-mono text-slate-400 mt-2">
              Table_12x_DSP501_Charts_300DPI_{videoCount}_Videos.zip
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
                  disabled={isExporting}
                  onClick={() => handleExportSingleChart(idx)}
                  className="w-full py-1.5 px-3 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
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
          <span>5 Nhóm Tiêu Chí Khoa Học & Chuẩn Hóa Toán Học (Loại Bỏ Hoàn Toàn Tên Gọi Nhóm ABCD)</span>
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
            • <strong>Cả 3 định dạng xuất</strong> (Word, Excel, Charts) đọc từ cùng một tập dữ liệu thực nghiệm đã tính toán trong ứng dụng.
          </div>
          <div>
            • <strong>Giữ nguyên định dạng N/A:</strong> Do không có Ground Truth, F1 và IoU hiển thị N/A, tuyệt đối không thay bằng số 0 hoặc số giả.
          </div>
          <div>
            • <strong>Đơn vị và độ chính xác:</strong> Giữ nguyên chữ số thập phân chuẩn khoa học (Motion Reduction: 1 chữ số, Residual Jitter: 2 chữ số, Flicker & Area: 2 chữ số, FPS: 1 chữ số).
          </div>
        </div>
      </div>
    </div>
  );
};
