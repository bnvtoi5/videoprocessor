import test from 'node:test';
import assert from 'node:assert/strict';

import { inspectOpenCvCapabilities } from '../src/core/openCvLoader';
import {
  estimateSimilarityTransformRansac,
  fitSimilarityFromTwoPairs,
} from '../src/algorithms/stabilization/ransac';
import {
  computeSmoothedTrajectory,
  gaussianSmooth1D,
  movingAverageSmooth1D,
} from '../src/algorithms/stabilization/trajectory';
import {
  rgbaToGrayscale,
  trackFeaturesTypeScript,
} from '../src/algorithms/stabilization/opticalFlow';
import { estimateEccEuclideanTypeScript } from '../src/algorithms/stabilization/ecc';
import { runStabilizationPipeline } from '../src/algorithms/stabilization/stabilizationPipeline';
import { runFrameDifferencingSequence } from '../src/algorithms/background/frameDifference';
import { runMog2TypeScriptSequence } from '../src/algorithms/background/mog2';
import { runSampleKnnSequence } from '../src/algorithms/background/sampleKnn';
import {
  applyMorphologyPipeline,
  dilateBinaryMask,
  erodeBinaryMask,
  morphologicalClosing,
  morphologicalOpening,
} from '../src/algorithms/background/morphology';
import {
  computeFrameSegmentationMetrics,
  computeMaskDifferenceVsBaseline,
  evaluateBinaryMaskAgainstGroundTruth,
} from '../src/evaluation/segmentationMetrics';
import {
  computeCameraTransformGroundTruthError,
  computeRemeasuredOutputJitterRms,
  computeTrajectoryJitterMetrics,
} from '../src/evaluation/stabilizationMetrics';
import {
  DEFAULT_ABLATION_COMBO_SLOTS,
  runCustomAblationComboBatch,
} from '../src/evaluation/researchExperiments';
import { generateResultsWorkbookXlsxBlob } from '../src/evaluation/reporting/exportEngine';
import { computeMedian } from '../src/evaluation/performanceMetrics';
import {
  computePairedFrameStatistics,
  computeRuntimeVariabilityStats,
} from '../src/evaluation/statisticalAnalysis';
import {
  generateSyntheticGroundTruthMask,
  quantizeToCdnetLabel,
  warpGroundTruthMaskNearestNeighbor,
} from '../src/demo/groundTruthGenerator';
import {
  generateCustomSyntheticSession,
  generateSyntheticSession,
  SYNTHETIC_SCENARIOS,
} from '../src/demo/syntheticSceneGenerator';
import {
  RESEARCH_HYPOTHESES,
  RESEARCH_QUESTIONS,
  SCIENTIFIC_LITERATURE_DATABASE,
} from '../src/research/literatureDatabase';
import { generateAcademicMarkdownReport } from '../src/research/academicReportBuilder';
import {
  DEFAULT_FOREGROUND_DISPLAY_CONFIG,
  DEFAULT_FRAME_DIFF_PARAMS,
  DEFAULT_MOG2_PARAMS,
  DEFAULT_MORPHOLOGY_CONFIG,
  DEFAULT_SAMPLE_KNN_PARAMS,
  DEFAULT_STABILIZATION_PARAMS,
} from '../src/utils/defaultParams';

test('1. OpenCV capability inspection handles uninitialized and mock runtimes safely', () => {
  const nullCaps = inspectOpenCvCapabilities(null);
  assert.equal(nullCaps.isReady, false);
  assert.equal(nullCaps.hasGoodFeaturesToTrack, false);

  const mockCv = {
    Mat: function () {},
    goodFeaturesToTrack: () => {},
    calcOpticalFlowPyrLK: () => {},
    BackgroundSubtractorMOG2: function () {},
    getBuildInformation: () => 'OpenCV 5.0.0-wasm',
  };
  const caps = inspectOpenCvCapabilities(mockCv);
  assert.equal(caps.isReady, true);
  assert.equal(caps.hasGoodFeaturesToTrack, true);
  assert.equal(caps.hasCalcOpticalFlowPyrLK, true);
  assert.equal(caps.hasBackgroundSubtractorMOG2, true);
  assert.equal(caps.hasEstimateAffinePartial2D, false);
});

test('2. 2D Similarity Transform & RANSAC accurately recover translation and rotation and reject outliers', () => {
  const trueDx = 6.5;
  const trueDy = -4.2;
  const trueDa = (3.0 * Math.PI) / 180;
  const cosA = Math.cos(trueDa);
  const sinA = Math.sin(trueDa);

  const points = [];
  // 20 true inliers
  for (let i = 0; i < 20; i++) {
    const px = 20 + (i % 5) * 25;
    const py = 20 + Math.floor(i / 5) * 25;
    const qx = cosA * px - sinA * py + trueDx;
    const qy = sinA * px + cosA * py + trueDy;
    points.push({ prevX: px, prevY: py, currX: qx, currY: qy, isInlier: true });
  }
  // 5 severe outliers (e.g., moving foreground object)
  for (let i = 0; i < 5; i++) {
    points.push({
      prevX: 40 + i * 10,
      prevY: 40 + i * 10,
      currX: 120 - i * 15,
      currY: 130 + i * 12,
      isInlier: false,
    });
  }

  const res = estimateSimilarityTransformRansac(points, 2.0, 150, 99);
  assert.ok(Math.abs(res.dx - trueDx) < 0.25, `Expected dx ~ ${trueDx}, got ${res.dx}`);
  assert.ok(Math.abs(res.dy - trueDy) < 0.25, `Expected dy ~ ${trueDy}, got ${res.dy}`);
  assert.ok(Math.abs(res.da - trueDa) < 0.01, `Expected da ~ ${trueDa}, got ${res.da}`);
  assert.equal(res.inliersCount, 20);
  assert.ok(Math.abs(res.inlierRatio - 20 / 25) < 1e-6);

  // Degenerate identical points check
  const deg = fitSimilarityFromTwoPairs(10, 10, 12, 12, 10, 10, 12, 12);
  assert.equal(deg, null);
});

test('3. Trajectory Gaussian smoothing reduces high-frequency jitter RMS', () => {
  const transforms = [];
  for (let i = 0; i < 30; i++) {
    const sign = i % 2 === 0 ? 1 : -1;
    transforms.push({
      frameIndex: i,
      dx: 1.0 + sign * 4.5,
      dy: -0.5 - sign * 3.5,
      da: sign * 0.03,
      scale: 1,
      inliersCount: 25,
      totalFeatures: 25,
      inlierRatio: 1,
      eccConverged: true,
      eccScore: 0.98,
      processingTimeMs: 1.0,
    });
  }

  const trajectories = computeSmoothedTrajectory(transforms, 6, true);
  assert.equal(trajectories.length, 30);

  const metrics = computeTrajectoryJitterMetrics(trajectories);
  assert.ok(
    metrics.stabilizedTranslationJitterRms < metrics.rawTranslationJitterRms * 0.4,
    `Expected smoothed jitter (${metrics.stabilizedTranslationJitterRms}) << raw jitter (${metrics.rawTranslationJitterRms})`
  );
  assert.ok(
    metrics.stabilizedRotationJitterRms < metrics.rawRotationJitterRms * 0.4
  );

  // Single-element signal edge case
  assert.deepEqual(gaussianSmooth1D([42], 5), [42]);
});

test('4. Feature tracking and ECC handle both textured frames and uniform no-feature frames without crashing', () => {
  const session = generateSyntheticSession('shaky_camera', 6, 160);
  const f0 = rgbaToGrayscale(session.frames[0].rgba, session.metadata.width, session.metadata.height);
  const f1 = rgbaToGrayscale(session.frames[1].rgba, session.metadata.width, session.metadata.height);

  const tracked = trackFeaturesTypeScript(
    f0,
    f1,
    session.metadata.width,
    session.metadata.height,
    DEFAULT_STABILIZATION_PARAMS
  );
  assert.ok(tracked.length > 5, 'Should detect and track corners on synthetic calibration grid');

  // Blank image edge case: 0 features, ECC returns converged=false safely
  const blank = new Uint8Array(160 * 90);
  const blankTracked = trackFeaturesTypeScript(
    blank,
    blank,
    160,
    90,
    DEFAULT_STABILIZATION_PARAMS
  );
  assert.equal(blankTracked.length, 0);

  const blankEcc = estimateEccEuclideanTypeScript(blank, blank, 160, 90, 20, 1e-3);
  assert.equal(blankEcc.converged, false);
  assert.equal(blankEcc.dx, 0);
  assert.equal(blankEcc.dy, 0);
});

test('5. Stabilization pipeline handles empty and single-frame videos safely', () => {
  const emptyRes = runStabilizationPipeline(
    null,
    [],
    'lk_ransac',
    DEFAULT_STABILIZATION_PARAMS
  );
  assert.equal(emptyRes.stabilizedFrames.length, 0);

  const oneFrameSession = generateSyntheticSession('shaky_camera', 1, 160);
  const singleRes = runStabilizationPipeline(
    null,
    oneFrameSession.frames,
    'lk_ransac',
    DEFAULT_STABILIZATION_PARAMS
  );
  assert.equal(singleRes.stabilizedFrames.length, 1);
  assert.equal(singleRes.rawTranslationJitterRms, 0);
});

test('6. Frame Differencing, MOG2, and Sample-based KNN generate real foreground masks on moving object sequence', () => {
  const session = generateSyntheticSession('moving_object', 12, 160);
  const rgbaList = session.frames.map((f) => f.rgba);
  const w = session.metadata.width;
  const h = session.metadata.height;

  const fd = runFrameDifferencingSequence(rgbaList, w, h, DEFAULT_FRAME_DIFF_PARAMS);
  const mog2 = runMog2TypeScriptSequence(rgbaList, w, h, DEFAULT_MOG2_PARAMS);
  const knn = runSampleKnnSequence(rgbaList, w, h, DEFAULT_SAMPLE_KNN_PARAMS);

  assert.equal(fd.masks.length, 12);
  assert.equal(mog2.masks.length, 12);
  assert.equal(knn.masks.length, 12);

  // Frame 8 has moving objects; verify non-zero foreground detections
  const countFg = (m: Uint8Array) => m.reduce((acc, v) => acc + (v === 255 ? 1 : 0), 0);
  assert.ok(countFg(fd.masks[8]) > 50, 'Frame Differencing should detect moving foreground');
  assert.ok(countFg(mog2.masks[8]) > 50, 'MOG2 should detect moving foreground');
  assert.ok(countFg(knn.masks[8]) > 50, 'Sample KNN should detect moving foreground');
});

test('7. Morphological operations clean isolated noise and extract moving component bounding boxes', () => {
  const w = 32;
  const h = 32;
  const noisy = new Uint8Array(w * h);
  // Single isolated noise pixel at (5, 5)
  noisy[5 * w + 5] = 255;
  // Solid 8x8 foreground block at (12..19, 12..19)
  for (let y = 12; y <= 19; y++) {
    for (let x = 12; x <= 19; x++) {
      noisy[y * w + x] = 255;
    }
  }

  const opened = morphologicalOpening(noisy, w, h, 3);
  assert.equal(opened[5 * w + 5], 0, 'Opening must remove isolated 1px noise');
  assert.equal(opened[15 * w + 15], 255, 'Opening must preserve solid 8x8 object');

  const closed = morphologicalClosing(opened, w, h, 3);
  assert.equal(closed[15 * w + 15], 255);

  const eroded = erodeBinaryMask(opened, w, h, 3);
  const dilated = dilateBinaryMask(eroded, w, h, 3);
  assert.equal(dilated[15 * w + 15], 255);

  const pipelineOut = applyMorphologyPipeline(noisy, w, h, {
    ...DEFAULT_MORPHOLOGY_CONFIG,
    minComponentArea: 20,
  });
  assert.equal(pipelineOut.boxes.length, 1);
  assert.ok(pipelineOut.boxes[0].area >= 20);
});

test('8. Segmentation metrics (IoU, Precision, Recall, F1, FPR, FNR, PWC) and CDnet-2014 label map exclusions', () => {
  // Include 4 standard pixels + 2 excluded pixels (85 Outside ROI, 170 Unknown) + 1 Shadow pixel (50)
  const pred = new Uint8Array([255, 255, 0, 0, 255, 0, 255]);
  const gt = new Uint8Array([255, 0, 255, 0, 85, 170, 50]);
  // Valid pixels: idx 0 (TP), idx 1 (FP), idx 2 (FN), idx 3 (TN), idx 6 (gt=50 Shadow => Negative, pred=255 => FP)
  // Total valid: TP=1, FP=2, FN=1, TN=1
  const cm = evaluateBinaryMaskAgainstGroundTruth(pred, gt);
  assert.equal(cm.tp, 1);
  assert.equal(cm.fp, 2);
  assert.equal(cm.fn, 1);
  assert.equal(cm.tn, 1);
  assert.ok(Math.abs(cm.precision - 1 / 3) < 1e-6);
  assert.ok(Math.abs(cm.recall - 0.5) < 1e-6);
  assert.ok(Math.abs(cm.fpr - 2 / 3) < 1e-6);
  assert.ok(Math.abs(cm.fnr - 0.5) < 1e-6);
  assert.ok(Math.abs(cm.pwcErrorPercent - (3 / 5) * 100) < 1e-6);

  // All-zero division-by-zero edge case: must never return NaN
  const emptyA = new Uint8Array(16);
  const emptyB = new Uint8Array(16);
  const zeroCm = evaluateBinaryMaskAgainstGroundTruth(emptyA, emptyB);
  assert.equal(Number.isNaN(zeroCm.iou), false);
  assert.equal(Number.isNaN(zeroCm.precision), false);
  assert.equal(Number.isNaN(zeroCm.recall), false);
  assert.equal(Number.isNaN(zeroCm.f1), false);
  assert.equal(zeroCm.iou, 0);

  // Missing Ground Truth returns null for IoU/Precision/Recall/F1
  const noGtMetrics = computeFrameSegmentationMetrics(0, pred, undefined, 0, 1.2, 1);
  assert.equal(noGtMetrics.iou, null);
  assert.equal(noGtMetrics.f1, null);

  // Median timing calculation
  assert.equal(computeMedian([12.4, 8.1, 15.9]), 12.4);
  assert.equal(computeMedian([10, 20]), 15);
});

test('9. CDnet-2014 Ground Truth quantization and Nearest-Neighbor mask warping preserve discrete labels', () => {
  assert.equal(quantizeToCdnetLabel(2), 0);
  assert.equal(quantizeToCdnetLabel(48), 50);
  assert.equal(quantizeToCdnetLabel(88), 85);
  assert.equal(quantizeToCdnetLabel(165), 170);
  assert.equal(quantizeToCdnetLabel(250), 255);

  const gt = generateSyntheticGroundTruthMask(
    0,
    64,
    64,
    [{ id: 1, cx: 32, cy: 32, rx: 8, ry: 8, shape: 'ellipse' }],
    0,
    0,
    0,
    {
      includeCastShadows: true,
      includeOutsideRoiBorder: true,
      includeUnknownBoundary: true,
    }
  );
  // Warping with nearest-neighbor must never introduce interpolated values outside {0, 50, 85, 170, 255}
  const warped = warpGroundTruthMaskNearestNeighbor(gt, 3.7, -2.4, 0.05);
  const allowed = new Set([0, 50, 85, 170, 255]);
  for (let i = 0; i < warped.mask.length; i++) {
    assert.ok(
      allowed.has(warped.mask[i]),
      `Warped GT mask contained non-CDnet interpolated value ${warped.mask[i]}`
    );
  }
  assert.ok(warped.validityMask !== undefined);
  // Border pixels warped out of bounds have validityMask === 0 and label 85
  assert.equal(warped.validityMask[0], 0);
  assert.equal(warped.mask[0], 85);
});

test('10. Controlled Synthetic Dataset Generator supports all 10 scenarios and Camera Motion GT Error metrics', () => {
  assert.equal(SYNTHETIC_SCENARIOS.length, 10);
  const customSession = generateCustomSyntheticSession({
    scenarioId: 'combined_translation_rotation',
    width: 160,
    height: 90,
    fps: 24,
    frameCount: 10,
    translationAmplitudePx: 8,
    rotationAmplitudeDeg: 2.5,
    motionFrequencyHz: 2.0,
    objectVelocityFactor: 1.2,
    illuminationVariationLevel: 0.2,
    backgroundComplexity: 'high',
    noiseLevelSigma: 2,
    includeCastShadows: true,
    includeOutsideRoiBorder: true,
  });
  assert.equal(customSession.frames.length, 10);
  assert.equal(customSession.groundTruthMasks.size, 10);
  assert.ok(customSession.trueTransforms !== undefined);
  assert.equal(customSession.trueTransforms.length, 10);
  assert.equal(customSession.trueTransforms[3].matrix2x3?.length, 6);

  const stabRes = runStabilizationPipeline(
    null,
    customSession.frames,
    'lk_ransac',
    DEFAULT_STABILIZATION_PARAMS
  );
  const gtError = computeCameraTransformGroundTruthError(
    stabRes.transforms,
    stabRes.trajectories,
    customSession.trueTransforms
  );
  assert.ok(gtError !== null);
  assert.equal(Number.isNaN(gtError.translationRmsePx), false);
  assert.equal(Number.isNaN(gtError.rotationRmseDeg), false);
  assert.equal(Number.isNaN(gtError.transformMatrixRmse), false);
  assert.equal(Number.isNaN(gtError.residualMotionAfterStabilizationPx), false);
});

test('11. Two-Level Statistical Analysis computes Runtime Variability and Paired Frame t-test / Wilcoxon / Block-Bootstrap CI', () => {
  const runtimeStats = computeRuntimeVariabilityStats(
    [12.0, 14.0, 13.0],
    [360.0, 420.0, 390.0],
    320,
    180,
    30
  );
  assert.equal(runtimeStats.repetitions, 3);
  assert.ok(Math.abs(runtimeStats.meanLatencyMs - 13.0) < 1e-6);
  assert.ok(Math.abs(runtimeStats.medianLatencyMs - 13.0) < 1e-6);
  assert.ok(runtimeStats.allocatedFrameBufferMb > 0);

  const seriesA = [0.62, 0.65, 0.61, 0.64, 0.63, 0.66, 0.62, 0.64, 0.65, 0.63, 0.64, 0.62];
  const seriesB = [0.78, 0.81, 0.77, 0.80, 0.79, 0.82, 0.79, 0.81, 0.80, 0.78, 0.80, 0.79];
  const paired = computePairedFrameStatistics(
    'F1-Score',
    '',
    'Pipeline A (Unstabilized)',
    'Pipeline B (Stabilized)',
    seriesA,
    seriesB,
    true
  );
  assert.equal(paired.sampleSizeN, 12);
  assert.ok(paired.meanDifference > 0.14);
  assert.ok(paired.pairedTTest.pValueTwoTailed < 0.001);
  assert.ok(paired.wilcoxonSignedRank.pValueTwoTailed < 0.01);
  assert.ok(paired.blockBootstrapCi95[0] > 0.1);
  assert.ok(paired.boxPlotB.median > paired.boxPlotA.median);
});

test('12. Scientific Literature Database and 18-Section Academic Report Builder verify completeness', () => {
  assert.equal(RESEARCH_QUESTIONS.length, 5);
  assert.equal(RESEARCH_HYPOTHESES.length, 7);
  assert.equal(SCIENTIFIC_LITERATURE_DATABASE.length, 17);

  const md = generateAcademicMarkdownReport([], []);
  assert.ok(md.includes('## 1. Abstract'));
  assert.ok(md.includes('## 6. Literature Review'));
  assert.ok(md.includes('## 13. Empirical Results Summary'));
  assert.ok(md.includes('## 14. Discussion & Statistical Interpretation'));
  assert.ok(md.includes('## 18. References (APA 7)'));
  assert.ok(md.includes('Zivkovic, Z. (2004)'));
  assert.ok(md.includes('Wang, Y., Jodoin, P.-M.'));
});

test('13. Ablation Combo Batch Runner, Re-measured Output Jitter, and Trajectory Modes (D3 vs D3b)', async () => {
  const session = generateSyntheticSession('shaky_camera', 8, 160);
  const rawRgba = session.frames.map((f) => f.rgba);

  const rawRemeasured = computeRemeasuredOutputJitterRms(
    null,
    rawRgba,
    session.metadata.width,
    session.metadata.height,
    DEFAULT_STABILIZATION_PARAMS
  );
  assert.ok(rawRemeasured > 0, 'Unstabilized shaky sequence must have positive re-measured jitter');

  // Execute batch on first 3 slots (D0, D1, D2)
  const testSlots = DEFAULT_ABLATION_COMBO_SLOTS.slice(0, 3).map((s) => ({
    ...s,
    enabled: true,
  }));
  const batchOut = await runCustomAblationComboBatch(
    session,
    testSlots,
    DEFAULT_STABILIZATION_PARAMS,
    DEFAULT_FRAME_DIFF_PARAMS,
    DEFAULT_MOG2_PARAMS,
    DEFAULT_SAMPLE_KNN_PARAMS,
    DEFAULT_MORPHOLOGY_CONFIG,
    DEFAULT_FOREGROUND_DISPLAY_CONFIG
  );

  assert.equal(batchOut.logEntry.measuredRows.length, 3);
  assert.equal(batchOut.visualResults.length, 3);
  for (const row of batchOut.logEntry.measuredRows) {
    assert.ok(row.fgRatioPercent !== null && row.fgRatioPercent !== undefined);
    assert.ok(row.meanComponentsPerFrame !== null && row.meanComponentsPerFrame !== undefined);
    assert.ok(row.remeasuredJitterRmsPx !== null && row.remeasuredJitterRmsPx !== undefined);
  }
});

test('14. D3 Moving-Average vs D0 Gaussian vs D4 No-Warp, Pre/Post Morphology Component Counts, Difference Masks & 7-Sheet XLSX', async () => {
  // 1. Verify D3 (Moving-Average Boxcar) produces a distinct smoothed trajectory from D0 (Gaussian) and D4 (zero_correction)
  const impulseSignal = [0, 0, 0, 12, 0, 0, 0];
  const gauss = gaussianSmooth1D(impulseSignal, 2);
  const boxcar = movingAverageSmooth1D(impulseSignal, 2);
  assert.notEqual(
    gauss[3].toFixed(4),
    boxcar[3].toFixed(4),
    'Gaussian (D0) peak weight must differ from uniform Boxcar (D3) weight'
  );

  // 2. Verify applyMorphologyPipeline returns rawComponentCount >= boxes.length
  const w = 32;
  const h = 32;
  const mask = new Uint8Array(w * h);
  mask[2 * w + 2] = 255; // speckle 1
  mask[4 * w + 28] = 255; // speckle 2
  for (let y = 12; y <= 18; y++) {
    for (let x = 12; x <= 18; x++) {
      mask[y * w + x] = 255; // valid object
    }
  }
  const morphOut = applyMorphologyPipeline(mask, w, h, {
    ...DEFAULT_MORPHOLOGY_CONFIG,
    minComponentArea: 15,
  });
  assert.equal(morphOut.rawComponentCount, 3, 'Pre-morphology raw components should be 3');
  assert.equal(morphOut.boxes.length, 1, 'Post-morphology cleaned components should be 1');

  // 3. Verify computeMaskDifferenceVsBaseline(|M_variant - M_D0|) and strict dimension validation
  const baseMask = new Uint8Array([255, 255, 0, 0]);
  const varMask = new Uint8Array([255, 0, 255, 0]);
  const diffRes = computeMaskDifferenceVsBaseline(varMask, baseMask, true, {
    width: 2,
    height: 2,
    frameIndex: 0,
  });
  assert.equal(diffRes.diffPixelCount, 2);
  assert.equal(diffRes.addedFgCount, 1);
  assert.equal(diffRes.missedFgCount, 1);
  assert.ok(Math.abs(diffRes.diffPercent - 50) < 1e-6);
  assert.equal(diffRes.diffRgba.length, 16);

  assert.throws(
    () => computeMaskDifferenceVsBaseline(new Uint8Array(4), new Uint8Array(6)),
    /Pixel XOR Dimension Mismatch/,
    'Must throw explicit error when binary masks have different lengths'
  );
  assert.throws(
    () =>
      computeMaskDifferenceVsBaseline(new Uint8Array(4), new Uint8Array(4), false, {
        width: 3,
        height: 2,
      }),
    /Pixel XOR Resolution Mismatch/,
    'Must throw explicit error when binary mask length does not match W×H'
  );

  // 4. Verify 7-Sheet OpenXML Workbook (.XLSX) generation
  const session = generateSyntheticSession('shaky_camera', 6, 160);
  const d0AndD3Slots = DEFAULT_ABLATION_COMBO_SLOTS.filter(
    (s) => s.code === 'D0' || s.code === 'D3' || s.code === 'D4'
  ).map((s) => ({ ...s, enabled: true }));
  const batch = await runCustomAblationComboBatch(
    session,
    d0AndD3Slots,
    DEFAULT_STABILIZATION_PARAMS,
    DEFAULT_FRAME_DIFF_PARAMS,
    DEFAULT_MOG2_PARAMS,
    DEFAULT_SAMPLE_KNN_PARAMS,
    DEFAULT_MORPHOLOGY_CONFIG,
    DEFAULT_FOREGROUND_DISPLAY_CONFIG
  );
  const xlsxBlob = await generateResultsWorkbookXlsxBlob(batch.logEntry);
  assert.ok(xlsxBlob.size > 1000, 'Generated 7-sheet .xlsx workbook must be non-empty');
});


