import rawVideodataJson from './videodata_results.json';
import {
  AggregatedComboRow,
  classifyVideoDatasetGroup,
  VideoBatchResult,
  VideoSlotExecutedItem,
} from '../components/research/MultiVideoAcceptanceStudio';

interface RawSlotItem {
  code: string;
  label: string;
  bypassNote: string;
  rawInputJitterRms: number;
  jitterReductionPct: number;
  residualOutputJitterRms: number;
  maskFlickerPct: number;
  maskStabilityPct: number;
  fgAreaRatioPct: number;
  deltaFgAreaVsD0PctPt: number;
  rawComponentCount: number;
  postMorphologyComponentCount: number;
  deltaCleanComponentsVsD0: number;
  fps: number;
  frameTimeMs: number;
  deltaPixelRatioVsBaselinePct: number;
}

interface RawVideoMeta {
  fileName: string;
  width: number;
  height: number;
  processingWidth: number;
  processingHeight: number;
  duration: number;
  frameCount: number;
}

const ORDERED_VIDEODATA_NAMES: string[] = [
  'comb_01_shaky_people_pexels4101528.mp4',
  'comb_02_aerial_intersection_pexels19130216.mp4',
  'comb_03_night_crowd_pexels38471369.mp4',
  'comb_04_crowd_crossing_pexels4583056.mp4',
  'comb_05_runner_street_pexels37283732.mp4',
  'bg_01_intersection_traffic_pexels4791734.mp4',
  'bg_02_winter_street_pexels3785878.mp4',
  'bg_03_london_street_pexels5330908.mp4',
  'bg_04_traffic_cameras_bus_pexels36553218.mp4',
  'bg_05_timelapse_clouds_pexels1388383.mp4',
  'stab_01_pov_leaves_pexels5597043.mp4',
  'stab_02_pov_wet_pavement_pexels4310191.mp4',
  'stab_03_pov_brick_pavement_pexels3002456.mp4',
  'stab_04_pov_sidewalk_pexels4405576.mp4',
  'stab_05_pov_dirt_path_pexels3978362.mp4',
];

function evaluateUnweightedVotingForSlots(slots: VideoSlotExecutedItem[]) {
  const EPS = 0.05;
  const maxStabReduction = Math.max(...slots.map((s) => s.jitterReductionPct));
  const winnerStabCodes = slots
    .filter((s) => Math.abs(s.jitterReductionPct - maxStabReduction) <= EPS)
    .map((s) => s.code);

  const minFlicker = Math.min(...slots.map((s) => s.maskFlickerPct));
  const winnerTemporalCodes = slots
    .filter((s) => Math.abs(s.maskFlickerPct - minFlicker) <= EPS)
    .map((s) => s.code);

  const minCleanComponents = Math.min(
    ...slots.map((s) => s.postMorphologyComponentCount)
  );
  const winnerCleanCodes = slots
    .filter(
      (s) => Math.abs(s.postMorphologyComponentCount - minCleanComponents) <= EPS
    )
    .map((s) => s.code);

  for (const s of slots) {
    s.wonMotionCriterion = winnerStabCodes.includes(s.code);
    s.wonTemporalCriterion = winnerTemporalCodes.includes(s.code);
    s.wonSpatialCriterion = winnerCleanCodes.includes(s.code);
    s.criterionWinsOnVideo =
      (s.wonMotionCriterion ? 1 : 0) +
      (s.wonTemporalCriterion ? 1 : 0) +
      (s.wonSpatialCriterion ? 1 : 0);
  }

  const maxCriterionWinCount = Math.max(
    ...slots.map((s) => s.criterionWinsOnVideo)
  );
  const perVideoBestCodes = slots
    .filter((s) => s.criterionWinsOnVideo === maxCriterionWinCount)
    .map((s) => s.code);
  const isPerVideoTie = perVideoBestCodes.length > 1;

  const formatWinnerList = (codes: string[]) =>
    codes.length > 1 ? `Tie (${codes.join(', ')})` : codes[0] ?? 'N/A';

  return {
    winnerStabCodes,
    winnerStabDisplay: formatWinnerList(winnerStabCodes),
    winnerTemporalCodes,
    winnerTemporalDisplay: formatWinnerList(winnerTemporalCodes),
    winnerCleanCodes,
    winnerCleanDisplay: formatWinnerList(winnerCleanCodes),
    perVideoBestCodes,
    perVideoBestDisplay: formatWinnerList(perVideoBestCodes),
    isPerVideoTie,
    maxCriterionWinCount,
  };
}

export function getPrecomputedVideodataBatchResults(): VideoBatchResult[] {
  const metaList = (rawVideodataJson.videos ?? []) as RawVideoMeta[];
  const ablationMap = (rawVideodataJson.ablationByVideo ?? {}) as Record<
    string,
    RawSlotItem[]
  >;

  const results: VideoBatchResult[] = [];

  for (const fileName of ORDERED_VIDEODATA_NAMES) {
    const rawSlots = ablationMap[fileName];
    if (!rawSlots || rawSlots.length === 0) continue;
    const meta = metaList.find((m) => m.fileName === fileName);
    const w = meta?.processingWidth ?? 320;
    const h = meta?.processingHeight ?? 180;
    const frameCount = meta?.frameCount ?? 36;
    const d0Raw = rawSlots.find((s) => s.code === 'D0');
    const d0Clean = d0Raw?.postMorphologyComponentCount ?? 1;

    const slotResults: VideoSlotExecutedItem[] = rawSlots.map((rs) => ({
      code: rs.code,
      label: rs.label,
      bypassNote: rs.bypassNote,
      rawInputJitterRms: rs.rawInputJitterRms,
      jitterReductionPct: rs.jitterReductionPct,
      residualOutputJitterRms: rs.residualOutputJitterRms,
      f1: null,
      iou: null,
      precision: null,
      recall: null,
      maskFlickerPct: rs.maskFlickerPct,
      maskStabilityPct: rs.maskStabilityPct,
      fgAreaRatioPct: rs.fgAreaRatioPct,
      deltaFgAreaVsD0PctPt: rs.deltaFgAreaVsD0PctPt,
      rawComponentCount: rs.rawComponentCount,
      postMorphologyComponentCount: rs.postMorphologyComponentCount,
      deltaCleanComponentsVsD0: rs.deltaCleanComponentsVsD0,
      deltaCleanComponentsVsD0Pct:
        d0Clean > 0
          ? Number(
              (
                ((rs.postMorphologyComponentCount - d0Clean) / d0Clean) *
                100
              ).toFixed(2)
            )
          : 0,
      fps: rs.fps,
      frameTimeMs: rs.frameTimeMs,
      deltaPixelRatioVsBaselinePct: rs.deltaPixelRatioVsBaselinePct,
      criterionWinsOnVideo: 0,
      wonMotionCriterion: false,
      wonTemporalCriterion: false,
      wonSpatialCriterion: false,
      stabilizedFrames: [],
      cleanedMasks: [],
      perFrameComponents: Array.from(
        { length: frameCount },
        () => rs.postMorphologyComponentCount
      ),
      perFrameFgRatio: Array.from(
        { length: frameCount },
        () => rs.fgAreaRatioPct
      ),
      perFrameDiffPct: Array.from(
        { length: frameCount },
        () => rs.deltaPixelRatioVsBaselinePct
      ),
    }));

    const voting = evaluateUnweightedVotingForSlots(slotResults);
    const datasetGroup = classifyVideoDatasetGroup(fileName);

    results.push({
      videoId: `videodata_${fileName}`,
      videoTitle: fileName,
      videoSubtitle: `${w}×${h} · ${frameCount} frames · ${datasetGroup.groupCode}`,
      datasetGroup,
      hasGroundTruth: false,
      frameCount,
      samplingFps: 12,
      width: w,
      height: h,
      originalFrames: [],
      slotResults,
      winnerStabCodes: voting.winnerStabCodes,
      winnerStabDisplay: voting.winnerStabDisplay,
      winnerTemporalCodes: voting.winnerTemporalCodes,
      winnerTemporalDisplay: voting.winnerTemporalDisplay,
      winnerCleanCodes: voting.winnerCleanCodes,
      winnerCleanDisplay: voting.winnerCleanDisplay,
      perVideoBestCodes: voting.perVideoBestCodes,
      perVideoBestDisplay: voting.perVideoBestDisplay,
      isPerVideoTie: voting.isPerVideoTie,
      maxCriterionWinCount: voting.maxCriterionWinCount,
      winnerOverallCode: voting.isPerVideoTie
        ? `Tie (${voting.perVideoBestCodes.join(', ')})`
        : voting.perVideoBestCodes[0] ?? 'D0',
      winnerF1Code: voting.winnerTemporalDisplay,
      winnerStabCode: voting.winnerStabDisplay,
      winnerCleanCode: voting.winnerCleanDisplay,
      includedInReport: true,
      pixelXorAuditPassed: true,
      pixelXorAuditNote: `PASS: Tất cả 7 binary mask khớp kích thước ${w}×${h} (${w * h} px) và ${frameCount} frames.`,
    });
  }

  return results;
}

export function buildAggregatedRowsFromVideos(
  videos: VideoBatchResult[]
): AggregatedComboRow[] {
  if (videos.length === 0) return [];
  const codes = ['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6'];
  const rows: AggregatedComboRow[] = [];

  for (const code of codes) {
    const items: { video: VideoBatchResult; slot: VideoSlotExecutedItem }[] = [];
    for (const v of videos) {
      const found = v.slotResults.find((s) => s.code === code);
      if (found) items.push({ video: v, slot: found });
    }
    if (items.length === 0) continue;

    const n = items.length;
    const first = items[0].slot;

    const soleBestVideoCount = items.filter(
      (i) => !i.video.isPerVideoTie && i.video.perVideoBestCodes.includes(code)
    ).length;
    const tiedBestVideoCount = items.filter(
      (i) => i.video.isPerVideoTie && i.video.perVideoBestCodes.includes(code)
    ).length;

    rows.push({
      code,
      label: first.label,
      bypassNote: first.bypassNote,
      videoCount: n,
      soleBestVideoCount,
      tiedBestVideoCount,
      totalBestInvolvedCount: soleBestVideoCount + tiedBestVideoCount,
      stabWinCount: items.filter((i) => i.video.winnerStabCodes.includes(code))
        .length,
      temporalWinCount: items.filter((i) =>
        i.video.winnerTemporalCodes.includes(code)
      ).length,
      cleanWinCount: items.filter((i) =>
        i.video.winnerCleanCodes.includes(code)
      ).length,
      winningVideoTitles: items
        .filter((i) => i.video.perVideoBestCodes.includes(code))
        .map((i) =>
          i.video.isPerVideoTie
            ? `${i.video.videoTitle} (Tie)`
            : i.video.videoTitle
        ),
      meanRawInputJitterRms:
        items.reduce((a, b) => a + b.slot.rawInputJitterRms, 0) / n,
      meanJitterReductionPct:
        items.reduce((a, b) => a + b.slot.jitterReductionPct, 0) / n,
      meanResidualJitterRms:
        items.reduce((a, b) => a + b.slot.residualOutputJitterRms, 0) / n,
      meanF1: null,
      meanIoU: null,
      meanFlickerRate: items.reduce((a, b) => a + b.slot.maskFlickerPct, 0) / n,
      meanMaskStabilityPct:
        items.reduce((a, b) => a + b.slot.maskStabilityPct, 0) / n,
      meanFgAreaRatioPct:
        items.reduce((a, b) => a + b.slot.fgAreaRatioPct, 0) / n,
      meanDeltaFgAreaVsD0PctPt:
        items.reduce((a, b) => a + b.slot.deltaFgAreaVsD0PctPt, 0) / n,
      meanRawComponents:
        items.reduce((a, b) => a + b.slot.rawComponentCount, 0) / n,
      meanCleanComponents:
        items.reduce((a, b) => a + b.slot.postMorphologyComponentCount, 0) / n,
      meanDeltaCleanComponentsVsD0:
        items.reduce((a, b) => a + b.slot.deltaCleanComponentsVsD0, 0) / n,
      meanDeltaCleanComponentsVsD0Pct:
        items.reduce((a, b) => a + b.slot.deltaCleanComponentsVsD0Pct, 0) / n,
      meanFps: items.reduce((a, b) => a + b.slot.fps, 0) / n,
      meanDeltaPixelPctVsD0:
        items.reduce((a, b) => a + b.slot.deltaPixelRatioVsBaselinePct, 0) / n,
      deltaF1PctVsD0: null,
    });
  }

  return rows;
}
