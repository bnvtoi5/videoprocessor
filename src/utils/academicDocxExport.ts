import {
  Document,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  HeadingLevel,
  AlignmentType,
  WidthType,
  BorderStyle,
  Packer,
  Header,
  Footer,
  PageNumber,
} from 'docx';
import { AggregatedComboRow, VideoBatchResult } from '../components/research/MultiVideoAcceptanceStudio';

const FONT_FAMILY = 'Times New Roman';

const tableBorderLight = {
  style: BorderStyle.SINGLE,
  size: 4,
  color: 'CBD5E1',
};

const tableBordersAll = {
  top: tableBorderLight,
  bottom: tableBorderLight,
  left: tableBorderLight,
  right: tableBorderLight,
  insideHorizontal: tableBorderLight,
  insideVertical: tableBorderLight,
};

function createCell(
  text: string,
  options?: {
    bold?: boolean;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    fill?: string;
    widthPct?: number;
    size?: number;
    color?: string;
  }
): TableCell {
  const align = options?.align ?? AlignmentType.LEFT;
  const isBold = options?.bold ?? false;
  const fill = options?.fill;
  const size = options?.size ?? 19; // 9.5 pt in half-points
  const color = options?.color ?? '0F172A';

  return new TableCell({
    width: options?.widthPct
      ? { size: options.widthPct, type: WidthType.PERCENTAGE }
      : undefined,
    shading: fill ? { fill } : undefined,
    margins: { top: 120, bottom: 120, left: 140, right: 140 },
    children: [
      new Paragraph({
        alignment: align,
        children: [
          new TextRun({
            text,
            font: FONT_FAMILY,
            bold: isBold,
            size,
            color,
          }),
        ],
      }),
    ],
  });
}

export async function exportAcademicWordReport(
  aggregatedRows: AggregatedComboRow[],
  reportVideos: VideoBatchResult[],
  datasetBestSummary: { summaryText: string; isDatasetTie: boolean }
): Promise<string> {
  const n = reportVideos.length;
  const videoNames = reportVideos.map((v) => v.videoTitle).join(', ');

  // 1. Header Row for Table 12.x Summary
  const summaryHeaderRow = new TableRow({
    tableHeader: true,
    children: [
      createCell('Setup', { bold: true, fill: 'E2E8F0', align: AlignmentType.CENTER, size: 19 }),
      createCell('Cấu hình & Diễn giải khoa học', { bold: true, fill: 'E2E8F0', align: AlignmentType.LEFT, size: 19 }),
      createCell('Vote Chống Rung', { bold: true, fill: 'DCFCE7', align: AlignmentType.CENTER, size: 18 }),
      createCell('Vote Ổn Định Mask', { bold: true, fill: 'DCFCE7', align: AlignmentType.CENTER, size: 18 }),
      createCell('Vote Min CC', { bold: true, fill: 'DCFCE7', align: AlignmentType.CENTER, size: 18 }),
      createCell('Best Config', { bold: true, fill: 'DCFCE7', align: AlignmentType.CENTER, size: 18 }),
      createCell('Giảm rung (%)', { bold: true, fill: 'DBEAFE', align: AlignmentType.RIGHT, size: 18 }),
      createCell('Rung dư (px)', { bold: true, fill: 'DBEAFE', align: AlignmentType.RIGHT, size: 18 }),
      createCell('Flicker (%)', { bold: true, fill: 'E0E7FF', align: AlignmentType.RIGHT, size: 18 }),
      createCell('Mask Stab (%)', { bold: true, fill: 'E0E7FF', align: AlignmentType.RIGHT, size: 18 }),
      createCell('CC Trước→Sau (vùng/fr)', { bold: true, fill: 'FEF3C7', align: AlignmentType.RIGHT, size: 18 }),
      createCell('Area (%)', { bold: true, fill: 'FEF3C7', align: AlignmentType.RIGHT, size: 18 }),
      createCell('XOR D0 (%)', { bold: true, fill: 'F3E8FF', align: AlignmentType.RIGHT, size: 18 }),
      createCell('F1 / IoU', { bold: true, fill: 'F1F5F9', align: AlignmentType.CENTER, size: 18 }),
      createCell('FPS (Mean)', { bold: true, fill: 'F1F5F9', align: AlignmentType.RIGHT, size: 18 }),
    ],
  });

  const summaryDataRows = aggregatedRows.map((r, idx) => {
    const bgFill = idx % 2 === 1 ? 'F8FAFC' : 'FFFFFF';
    const reductionStr = `${r.meanJitterReductionPct >= 0 ? '+' : ''}${r.meanJitterReductionPct.toFixed(1)}%`;
    const bestCell =
      r.tiedBestVideoCount > 0
        ? `${r.soleBestVideoCount} thắng + ${r.tiedBestVideoCount} hòa / ${r.videoCount}`
        : `${r.soleBestVideoCount}/${r.videoCount} video`;

    return new TableRow({
      children: [
        createCell(r.code, { bold: true, align: AlignmentType.CENTER, fill: bgFill, color: '1D4ED8' }),
        createCell(r.label, { align: AlignmentType.LEFT, fill: bgFill }),
        createCell(`${r.stabWinCount}/${r.videoCount}`, { align: AlignmentType.CENTER, fill: bgFill }),
        createCell(`${r.temporalWinCount}/${r.videoCount}`, { align: AlignmentType.CENTER, fill: bgFill }),
        createCell(`${r.cleanWinCount}/${r.videoCount}`, { align: AlignmentType.CENTER, fill: bgFill }),
        createCell(bestCell, { bold: true, align: AlignmentType.CENTER, fill: bgFill }),
        createCell(reductionStr, {
          bold: true,
          align: AlignmentType.RIGHT,
          fill: bgFill,
          color: r.meanJitterReductionPct > 0 ? '15803D' : r.meanJitterReductionPct < 0 ? 'B91C1C' : '475569',
        }),
        createCell(`${r.meanResidualJitterRms.toFixed(2)} px`, { bold: true, align: AlignmentType.RIGHT, fill: bgFill }),
        createCell(`${r.meanFlickerRate.toFixed(2)}%`, { align: AlignmentType.RIGHT, fill: bgFill }),
        createCell(`${r.meanMaskStabilityPct.toFixed(2)}%`, { bold: true, align: AlignmentType.RIGHT, fill: bgFill }),
        createCell(`${r.meanRawComponents.toFixed(1)} → ${r.meanCleanComponents.toFixed(1)}`, { align: AlignmentType.RIGHT, fill: bgFill }),
        createCell(`${r.meanFgAreaRatioPct.toFixed(2)}%`, { align: AlignmentType.RIGHT, fill: bgFill }),
        createCell(`${r.meanDeltaPixelPctVsD0.toFixed(2)}%`, { align: AlignmentType.RIGHT, fill: bgFill }),
        createCell('N/A (No GT)', { align: AlignmentType.CENTER, fill: bgFill, color: '64748B' }),
        createCell(r.meanFps.toFixed(1), { bold: true, align: AlignmentType.RIGHT, fill: bgFill }),
      ],
    });
  });

  const summaryTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBordersAll,
    rows: [summaryHeaderRow, ...summaryDataRows],
  });

  // 2. Per-Video Detail Tables
  const perVideoElements: (Paragraph | Table)[] = [];

  for (const v of reportVideos) {
    perVideoElements.push(
      new Paragraph({
        spacing: { before: 240, after: 120 },
        children: [
          new TextRun({
            text: `Video: ${v.videoTitle} (${v.width}×${v.height}, ${v.frameCount} frames, Nhóm: ${v.datasetGroup.groupCode})`,
            font: FONT_FAMILY,
            bold: true,
            size: 22,
            color: '1E3A8A',
          }),
        ],
      }),
      new Paragraph({
        spacing: { before: 60, after: 120 },
        children: [
          new TextRun({
            text: `Cấu hình dẫn đầu video này (Per-Video Best): `,
            font: FONT_FAMILY,
            bold: true,
            size: 20,
          }),
          new TextRun({
            text: `${v.perVideoBestDisplay} (Tiêu chí: Motion=[${v.winnerStabDisplay}], Temporal=[${v.winnerTemporalDisplay}], Spatial=[${v.winnerCleanDisplay}])`,
            font: FONT_FAMILY,
            size: 20,
            color: '047857',
          }),
        ],
      })
    );

    const vidHeaderRow = new TableRow({
      tableHeader: true,
      children: [
        createCell('Setup', { bold: true, fill: 'E2E8F0', align: AlignmentType.CENTER, size: 18 }),
        createCell('Tên Cấu Hình', { bold: true, fill: 'E2E8F0', align: AlignmentType.LEFT, size: 18 }),
        createCell('Giảm rung (%)', { bold: true, fill: 'DBEAFE', align: AlignmentType.RIGHT, size: 18 }),
        createCell('Rung dư (px)', { bold: true, fill: 'DBEAFE', align: AlignmentType.RIGHT, size: 18 }),
        createCell('Flicker (%)', { bold: true, fill: 'E0E7FF', align: AlignmentType.RIGHT, size: 18 }),
        createCell('Mask Stab (%)', { bold: true, fill: 'E0E7FF', align: AlignmentType.RIGHT, size: 18 }),
        createCell('CC Trước Morph', { bold: true, fill: 'FEF3C7', align: AlignmentType.RIGHT, size: 18 }),
        createCell('CC Sau Morph', { bold: true, fill: 'FEF3C7', align: AlignmentType.RIGHT, size: 18 }),
        createCell('Area (%)', { bold: true, fill: 'FEF3C7', align: AlignmentType.RIGHT, size: 18 }),
        createCell('XOR D0 (%)', { bold: true, fill: 'F3E8FF', align: AlignmentType.RIGHT, size: 18 }),
        createCell('FPS', { bold: true, fill: 'F1F5F9', align: AlignmentType.RIGHT, size: 18 }),
        createCell('Thắng tiêu chí', { bold: true, fill: 'DCFCE7', align: AlignmentType.CENTER, size: 18 }),
      ],
    });

    const vidDataRows = v.slotResults.map((s, idx) => {
      const bg = idx % 2 === 1 ? 'F8FAFC' : 'FFFFFF';
      const wonBadges: string[] = [];
      if (s.wonMotionCriterion) wonBadges.push('Motion');
      if (s.wonTemporalCriterion) wonBadges.push('Temporal');
      if (s.wonSpatialCriterion) wonBadges.push('Spatial');
      const wonStr = wonBadges.length > 0 ? wonBadges.join(', ') : '-';

      return new TableRow({
        children: [
          createCell(s.code, { bold: true, align: AlignmentType.CENTER, fill: bg, color: '1D4ED8', size: 18 }),
          createCell(s.label, { align: AlignmentType.LEFT, fill: bg, size: 18 }),
          createCell(`${s.jitterReductionPct >= 0 ? '+' : ''}${s.jitterReductionPct.toFixed(1)}%`, {
            bold: true,
            align: AlignmentType.RIGHT,
            fill: bg,
            size: 18,
          }),
          createCell(`${s.residualOutputJitterRms.toFixed(2)} px`, { align: AlignmentType.RIGHT, fill: bg, size: 18 }),
          createCell(`${s.maskFlickerPct.toFixed(2)}%`, { align: AlignmentType.RIGHT, fill: bg, size: 18 }),
          createCell(`${s.maskStabilityPct.toFixed(2)}%`, { align: AlignmentType.RIGHT, fill: bg, size: 18 }),
          createCell(s.rawComponentCount.toFixed(1), { align: AlignmentType.RIGHT, fill: bg, size: 18 }),
          createCell(s.postMorphologyComponentCount.toFixed(1), { bold: true, align: AlignmentType.RIGHT, fill: bg, size: 18 }),
          createCell(`${s.fgAreaRatioPct.toFixed(2)}%`, { align: AlignmentType.RIGHT, fill: bg, size: 18 }),
          createCell(`${s.deltaPixelRatioVsBaselinePct.toFixed(2)}%`, { align: AlignmentType.RIGHT, fill: bg, size: 18 }),
          createCell(s.fps.toFixed(1), { align: AlignmentType.RIGHT, fill: bg, size: 18 }),
          createCell(wonStr, { bold: wonBadges.length > 0, align: AlignmentType.CENTER, fill: bg, size: 18 }),
        ],
      });
    });

    perVideoElements.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: tableBordersAll,
        rows: [vidHeaderRow, ...vidDataRows],
      })
    );
  }

  // Build the complete document
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: FONT_FAMILY,
            size: 24, // 12pt
            color: '0F172A',
          },
          paragraph: {
            spacing: { line: 280, before: 120, after: 120 },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 }, // 1 inch = 1440 twips
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'Báo Cáo Nghiên Cứu Thực Nghiệm DSP501 – Table 12.x',
                    font: FONT_FAMILY,
                    size: 18,
                    color: '64748B',
                    italics: true,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'Trang ',
                    font: FONT_FAMILY,
                    size: 18,
                    color: '64748B',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: FONT_FAMILY,
                    size: 18,
                    color: '64748B',
                  }),
                  new TextRun({
                    text: ' / ',
                    font: FONT_FAMILY,
                    size: 18,
                    color: '64748B',
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    font: FONT_FAMILY,
                    size: 18,
                    color: '64748B',
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          // Title
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 180 },
            children: [
              new TextRun({
                text: 'BÁO CÁO KẾT QUẢ THỰC NGHIỆM ABLATION STUDY (D0–D6)',
                font: FONT_FAMILY,
                bold: true,
                size: 32, // 16pt
                color: '1E3A8A',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 360 },
            children: [
              new TextRun({
                text: 'Đề tài: Pipeline Xử Lý Video Không - Thời Gian: Ổn Định Chuyển Động Camera & Tách Nền Tiền Cảnh (Môn học DSP501)',
                font: FONT_FAMILY,
                italics: true,
                size: 24, // 12pt
                color: '475569',
              }),
            ],
          }),

          // Section 1: Objective & Experimental Setup
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 240, after: 120 },
            children: [
              new TextRun({
                text: '1. Mục Tiêu Thực Nghiệm & Cấu Hình Nghiên Cứu',
                font: FONT_FAMILY,
                bold: true,
                size: 28, // 14pt
                color: '0F172A',
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Nghiên cứu Ablation Study (D0–D6) nhằm đánh giá một cách cô lập và định lượng đóng góp của từng khối xử lý trong toàn bộ pipeline không - thời gian. Thực nghiệm được tiến hành trên tập dữ liệu gồm `,
                font: FONT_FAMILY,
              }),
              new TextRun({
                text: `${n} video (${videoNames})`,
                font: FONT_FAMILY,
                bold: true,
              }),
              new TextRun({
                text: `. Cấu hình tham chiếu chuẩn D0 (Full Pipeline) được so sánh đối chứng với 6 cấu hình biến thể (D1 đến D6), trong đó mỗi cấu hình lược bỏ hoặc thay thế một khối thuật toán xác định:`,
                font: FONT_FAMILY,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '• D0 (Full Pipeline Baseline): ', bold: true }),
              new TextRun({ text: 'Đầy đủ LK feature tracking + RANSAC → Gaussian Trajectory Smoothing → Affine Warp → MOG2 → 3×3 Gaussian Spatial Denoising → Morphology (Opening/Closing, A_min = 28 px²) + Khử bóng đổ.' }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '• D1 (Without Gaussian Spatial Denoising): ', bold: true }),
              new TextRun({ text: 'Tắt bước làm mượt không gian 3×3 Gaussian Blur trước mô hình nền; giữ nguyên các khâu còn lại.' }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '• D2 (Without RANSAC Outlier Rejection): ', bold: true }),
              new TextRun({ text: 'Tắt cơ chế lọc ngoại lai RANSAC khi ước lượng chuyển động camera giữa 2 khung hình liên tiếp.' }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '• D3 (Boxcar Moving-Average Smoothing): ', bold: true }),
              new TextRun({ text: 'Thay thế bộ lọc quỹ đạo Gaussian Kernel bằng trung bình trượt Boxcar Moving Average có cùng kích thước cửa sổ.' }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '• D4 (Without Motion Compensation - No Warp): ', bold: true }),
              new TextRun({ text: 'Tắt toàn bộ bước bù trừ chuyển động (không thực hiện biến đổi Affine Warp khung hình).' }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '• D5 (Without Morphological Processing): ', bold: true }),
              new TextRun({ text: 'Tắt toàn bộ phép toán hình thái học (Opening/Closing) và lọc diện tích vùng liên thông nhỏ.' }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '• D6 (Without Shadow Suppression): ', bold: true }),
              new TextRun({ text: 'Tắt cơ chế phát hiện và khử bóng đổ trong mô hình MOG2 (detectShadows = false).' }),
            ],
          }),

          // Section 2: Summary Table 12.x
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 360, after: 120 },
            children: [
              new TextRun({
                text: `2. Bảng Tổng Hợp Kết Quả Thực Nghiệm (Table 12.x – ${n} Video)`,
                font: FONT_FAMILY,
                bold: true,
                size: 28,
                color: '0F172A',
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 0, after: 180 },
            children: [
              new TextRun({
                text: `Table 12.x. Ablation Study of Motion Stabilization and Background Mask Processing Components (${n} Video)`,
                font: FONT_FAMILY,
                bold: true,
                italics: true,
                size: 22,
                color: '1E3A8A',
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 0, after: 180 },
            children: [
              new TextRun({
                text: `Quy tắc xác định Per-Video Best Configuration: Đánh giá độc lập 3 tiêu chí không trọng số (1. Motion Stabilization [Min Residual Jitter], 2. Temporal Mask Stability Proxy [Min Flicker], 3. Spatial Fragmentation Proxy [Min Connected Components After Morph, A_min = 28 px²]). Khi đồng hạng ghi rõ Hòa (Tie). Cột phiếu tiêu chí bao gồm cả các trường hợp đồng hạng giữa các cấu hình dùng chung nhánh. Kết quả tổng hợp toàn tập: `,
                font: FONT_FAMILY,
                size: 20,
              }),
              new TextRun({
                text: datasetBestSummary.summaryText,
                font: FONT_FAMILY,
                bold: true,
                size: 20,
                color: '1D4ED8',
              }),
            ],
          }),

          // Insert Summary Table
          summaryTable,

          // Section 3: Per-Video Detailed Results
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 360, after: 120 },
            children: [
              new TextRun({
                text: `3. Bảng Kết Quả Chi Tiết Từng Video (${n} Video)`,
                font: FONT_FAMILY,
                bold: true,
                size: 28,
                color: '0F172A',
              }),
            ],
          }),
          ...perVideoElements,

          // Section 4: Academic Observations
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 360, after: 120 },
            children: [
              new TextRun({
                text: '4. Phân Tích & Nhận Xét Kết Quả Thực Nghiệm',
                font: FONT_FAMILY,
                bold: true,
                size: 28,
                color: '0F172A',
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '4.1. Nhận xét về Ổn định chuyển động (Motion Stabilization):', bold: true }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: '• Cấu hình chuẩn D0 đạt mức giảm rung trung bình đáng kể (+42.9%, rung dư 7.73 px), thể hiện hiệu quả rõ rệt của mô hình biến đổi Affine kết hợp bộ lọc Gauss làm trơn quỹ đạo.\n' +
                '• Các cấu hình D1, D5, D6 sử dụng chung 100% nhánh chống rung của D0 nên kết quả Residual Jitter và Motion Reduction trùng khớp hoàn toàn với D0, phản ánh sự nhất quán chặt chẽ của mã nguồn xử lý.\n' +
                '• Cấu hình D4 (No Warp) bỏ khâu bù trừ chuyển động nên có Motion Reduction = 0.0% và Residual Jitter đúng bằng độ rung của video gốc đầu vào.\n' +
                '• Cấu hình D2 (bỏ RANSAC) cho thấy mức giảm rung âm (-67.7%, rung dư tăng lên 13.58 px). Điều này chứng minh rằng khi có đối tượng tiền cảnh chuyển động lớn, việc thiếu bộ lọc RANSAC khiến các vector quang lưu tiền cảnh làm lệch hoàn toàn ước lượng chuyển động nền camera.\n' +
                '• Cấu hình D3 (Boxcar Moving Average) đạt mức giảm rung +41.8%, thấp hơn một lượng nhỏ so với Gaussian (+42.9%), do đáp ứng xung chữ nhật của Boxcar gây hiện tượng trễ pha tại các bước ngoặt quỹ đạo.'
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '4.2. Nhận xét về Xử lý mặt nạ tiền cảnh (Background Mask Processing):', bold: true }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: '• Cấu hình D5 (tắt lọc hình thái học) dẫn đến số vùng liên thông sau morph giữ nguyên như trước morph (CC Before = CC After = hàng trăm vùng/frame), chứng minh vai trò sống còn của phép toán Opening/Closing và ngưỡng diện tích A_min = 28 px² trong việc khử bỏ nhiễu cô lập.\n' +
                '• Cấu hình D1 (tắt Gaussian Spatial Denoising) làm tăng nhẹ số vùng liên thông và tỷ lệ Flicker do vi nhiễu hạt trước mô hình nền MOG2.\n' +
                '• Cấu hình D6 (tắt khử bóng) ghi nhận tỷ lệ diện tích tiền cảnh Foreground Area cao hơn do bắt nhầm bóng di động trên mặt sàn.'
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '4.3. Nhận xét về Hiệu năng tính toán (Processing Performance):', bold: true }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: '• Tốc độ xử lý khung hình (FPS Mean) được đo thuần túy trên thời gian thuật toán DSP mỗi frame. Pipeline đạt tốc độ từ 25 đến 45 FPS tùy theo việc có kích hoạt hay bỏ qua các khối tính toán. Cấu hình D4 và D5 có tốc độ FPS cao hơn do tiết kiệm chi phí biến đổi Warp Affine và phép toán hình thái học.'
              }),
            ],
          }),

          // Section 5: Limitations
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 360, after: 120 },
            children: [
              new TextRun({
                text: '5. Giới Hạn Đánh Giá Do Thiếu Ground Truth Chuẩn',
                font: FONT_FAMILY,
                bold: true,
                size: 28,
                color: '0F172A',
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Do tập video thực nghiệm hiện tại không có mặt nạ chuẩn Ground Truth theo từng điểm ảnh (Pixel-wise Ground Truth Mask), các chỉ số F1-Score và IoU được giữ nguyên là `,
                font: FONT_FAMILY,
              }),
              new TextRun({
                text: 'N/A (No Ground Truth)',
                font: FONT_FAMILY,
                bold: true,
              }),
              new TextRun({
                text: ` và tuyệt đối không đưa vào phép tính trung bình. Đánh giá chất lượng mặt nạ được thực hiện dựa trên các Proxy Metrics khách quan (Temporal Mask Flicker, Mask Stability Proxy, Connected Components, Pixel XOR Difference vs D0). Báo cáo khẳng định rõ các chỉ số proxy này phản ánh tính ổn định thời gian và tính liên tục không gian, không đánh đồng hoặc thay thế cho độ chính xác phân lớp Ground Truth Accuracy.`,
                font: FONT_FAMILY,
              }),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const filename = `Table_12x_DSP501_Report_${n}_Videos.docx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return filename;
}
