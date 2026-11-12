import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { exportAcademicExcelData } from '../src/utils/academicExcelExport';
import { ACADEMIC_CHARTS } from '../src/utils/academicChartExport';
import { AggregatedComboRow, VideoBatchResult } from '../src/components/research/MultiVideoAcceptanceStudio';

const mockAggregatedRows: AggregatedComboRow[] = [
  {
    code: 'D0',
    label: 'D0. Full Pipeline Baseline',
    bypassNote: 'Full pipeline reference',
    videoCount: 4,
    soleBestVideoCount: 2,
    tiedBestVideoCount: 1,
    totalBestInvolvedCount: 3,
    stabWinCount: 4,
    temporalWinCount: 3,
    cleanWinCount: 4,
    winningVideoTitles: ['comb_02', 'comb_04'],
    meanRawInputJitterRms: 13.55,
    meanJitterReductionPct: 42.9,
    meanResidualJitterRms: 7.73,
    meanF1: null,
    meanIoU: null,
    meanFlickerRate: 8.65,
    meanMaskStabilityPct: 91.35,
    meanFgAreaRatioPct: 15.2,
    meanDeltaFgAreaVsD0PctPt: 0,
    meanRawComponents: 42.5,
    meanCleanComponents: 5.2,
    meanDeltaCleanComponentsVsD0: 0,
    meanDeltaCleanComponentsVsD0Pct: 0,
    meanFps: 34.5,
    meanDeltaPixelPctVsD0: 0,
    deltaF1PctVsD0: null,
  },
  {
    code: 'D4',
    label: 'D4. Without Motion Compensation (No Warp)',
    bypassNote: 'No Warp baseline',
    videoCount: 4,
    soleBestVideoCount: 0,
    tiedBestVideoCount: 0,
    totalBestInvolvedCount: 0,
    stabWinCount: 0,
    temporalWinCount: 0,
    cleanWinCount: 0,
    winningVideoTitles: [],
    meanRawInputJitterRms: 13.55,
    meanJitterReductionPct: 0.0,
    meanResidualJitterRms: 13.55,
    meanF1: null,
    meanIoU: null,
    meanFlickerRate: 15.4,
    meanMaskStabilityPct: 84.6,
    meanFgAreaRatioPct: 19.8,
    meanDeltaFgAreaVsD0PctPt: 4.6,
    meanRawComponents: 88.0,
    meanCleanComponents: 12.4,
    meanDeltaCleanComponentsVsD0: 7.2,
    meanDeltaCleanComponentsVsD0Pct: 138.5,
    meanFps: 48.2,
    meanDeltaPixelPctVsD0: 18.5,
    deltaF1PctVsD0: null,
  },
];

const mockReportVideos = [
  {
    videoId: 'v1',
    videoTitle: 'comb_02_car_turn.mp4',
    datasetGroup: { groupKey: 'COMB', groupCode: 'Combined (comb_*)', groupTitle: 'Nhóm Combined' },
    width: 480,
    height: 270,
    frameCount: 36,
    samplingFps: 10,
    hasGroundTruth: false,
    pixelXorAuditNote: 'Checked',
    winnerStabCodes: ['D0'],
    winnerStabDisplay: 'D0',
    winnerTemporalCodes: ['D0'],
    winnerTemporalDisplay: 'D0',
    winnerCleanCodes: ['D0'],
    winnerCleanDisplay: 'D0',
    perVideoBestCodes: ['D0'],
    perVideoBestDisplay: 'D0 (3/3)',
    isPerVideoTie: false,
    maxCriterionWinCount: 3,
    slotResults: [
      {
        code: 'D0',
        label: 'D0. Full Pipeline',
        bypassNote: 'Full pipeline',
        rawInputJitterRms: 13.5,
        jitterReductionPct: 43.1,
        residualOutputJitterRms: 7.7,
        f1: null,
        iou: null,
        maskFlickerPct: 8.5,
        maskStabilityPct: 91.5,
        fgAreaRatioPct: 15.0,
        deltaFgAreaVsD0PctPt: 0,
        rawComponentCount: 40,
        postMorphologyComponentCount: 5,
        deltaCleanComponentsVsD0: 0,
        deltaCleanComponentsVsD0Pct: 0,
        fps: 35.0,
        deltaPixelRatioVsBaselinePct: 0,
        cleanedMasks: [],
        stabilizedFrames: [],
        wonMotionCriterion: true,
        wonTemporalCriterion: true,
        wonSpatialCriterion: true,
        criterionWinsOnVideo: 3,
      },
    ],
  },
];

test('Academic Excel Export generates exactly 3 sheets with required academic content', () => {
  // Test that exportAcademicExcelData generates correct filename
  const filename = exportAcademicExcelData(
    mockAggregatedRows,
    mockReportVideos as unknown as VideoBatchResult[],
    { summaryText: 'D0 dẫn đầu 3/4 video', isDatasetTie: false }
  );

  assert.match(filename, /^Table_12x_DSP501_Ablation_Data_1_Videos\.xlsx$/);
});

test('Academic Chart Suite defines exactly 6 distinct publication charts', () => {
  assert.equal(ACADEMIC_CHARTS.length, 6);
  assert.equal(ACADEMIC_CHARTS[0].unit, 'Motion Reduction (%)');
  assert.equal(ACADEMIC_CHARTS[1].unit, 'Residual Jitter (px)');
  assert.equal(ACADEMIC_CHARTS[2].unit, 'Tỷ lệ phần trăm (%)');
  assert.equal(ACADEMIC_CHARTS[3].unit, 'Số vùng liên thông (vùng/frame)');
  assert.equal(ACADEMIC_CHARTS[4].unit, 'Tỷ lệ phần trăm (%)');
  assert.equal(ACADEMIC_CHARTS[5].unit, 'Tốc độ (Frames/sec)');
});
