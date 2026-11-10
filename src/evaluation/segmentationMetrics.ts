import { BackgroundFrameMetrics } from '../types/algorithm';

export interface ConfusionMatrixResult {
  tp: number;
  fp: number;
  fn: number;
  tn: number;
  precision: number;
  recall: number;
  f1: number;
  iou: number;
  fpr: number; // False Positive Rate = FP / (FP + TN)
  fnr: number; // False Negative Rate = FN / (FN + TP)
  pwcErrorPercent: number; // Pixel-wise Classification Error = 100 * (FP + FN) / TotalValid
}

/**
 * Computes pixel-level confusion matrix and segmentation metrics (IoU, Precision, Recall, F1, FPR, FNR, PWC)
 * with full CDnet-2014 Label Map compliance:
 * - 0: Background
 * - 50: Shadow (by default treated as Background so false shadow detection counts as FP, or excluded if shadowPolicy === 'ignore')
 * - 85: Outside ROI (strictly excluded from evaluation)
 * - 170: Unknown / Motion Boundary (strictly excluded from evaluation)
 * - 255: Foreground
 *
 * Also excludes any pixel where validityMask[i] === 0 (e.g. post-stabilization border loss).
 * Explicitly handles division-by-zero edge cases without returning NaN.
 */
export function evaluateBinaryMaskAgainstGroundTruth(
  predictedMask: Uint8Array,
  groundTruthMask: Uint8Array,
  validityMask?: Uint8Array,
  shadowPolicy: 'as_background' | 'ignore' = 'as_background'
): ConfusionMatrixResult {
  const n = Math.min(predictedMask.length, groundTruthMask.length);
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;

  for (let i = 0; i < n; i++) {
    if (validityMask && validityMask[i] === 0) {
      continue;
    }

    const gtVal = groundTruthMask[i];
    // Exclude CDnet Outside ROI (85) and Unknown (170)
    if (gtVal === 85 || gtVal === 170) {
      continue;
    }
    if (gtVal === 50 && shadowPolicy === 'ignore') {
      continue;
    }

    const predFg = predictedMask[i] >= 200;
    const gtFg = gtVal >= 200;

    if (predFg && gtFg) {
      tp++;
    } else if (predFg && !gtFg) {
      fp++;
    } else if (!predFg && gtFg) {
      fn++;
    } else {
      tn++;
    }
  }

  // Safe division handling: never return NaN
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 =
    precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const union = tp + fp + fn;
  const iou = union > 0 ? tp / union : 0;

  const fpr = fp + tn > 0 ? fp / (fp + tn) : 0;
  const fnr = fn + tp > 0 ? fn / (fn + tp) : 0;
  const totalValid = tp + tn + fp + fn;
  const pwcErrorPercent =
    totalValid > 0 ? (100 * (fp + fn)) / totalValid : 0;

  return {
    tp,
    fp,
    fn,
    tn,
    precision,
    recall,
    f1,
    iou,
    fpr,
    fnr,
    pwcErrorPercent,
  };
}

/**
 * Computes temporal mask flicker ratio between consecutive binary masks:
 *   Flicker = (number of pixels that flipped state between t-1 and t) / totalPixels
 */
export function computeMaskFlickerRatio(
  prevMask: Uint8Array,
  currMask: Uint8Array
): number {
  const n = Math.min(prevMask.length, currMask.length);
  if (n === 0) return 0;
  let changed = 0;
  for (let i = 0; i < n; i++) {
    const p = prevMask[i] >= 200 ? 1 : 0;
    const c = currMask[i] >= 200 ? 1 : 0;
    if (p !== c) changed++;
  }
  return changed / n;
}

/**
 * Computes per-frame segmentation metrics; sets precision/recall/f1/iou to null
 * when groundTruthMask is not available.
 */
export function computeFrameSegmentationMetrics(
  frameIndex: number,
  predictedMask: Uint8Array,
  groundTruthMask: Uint8Array | undefined,
  flickerRatio: number,
  processingTimeMs: number,
  componentCount: number,
  validityMask?: Uint8Array
): BackgroundFrameMetrics {
  const n = predictedMask.length;
  let fgCount = 0;
  for (let i = 0; i < n; i++) {
    if (predictedMask[i] >= 200) fgCount++;
  }
  const foregroundRatio = n > 0 ? fgCount / n : 0;

  if (!groundTruthMask || groundTruthMask.length !== predictedMask.length) {
    return {
      frameIndex,
      tp: 0,
      fp: 0,
      fn: 0,
      tn: 0,
      precision: null,
      recall: null,
      f1: null,
      iou: null,
      foregroundRatio,
      flickerRatio,
      processingTimeMs,
      componentCount,
    };
  }

  const cm = evaluateBinaryMaskAgainstGroundTruth(
    predictedMask,
    groundTruthMask,
    validityMask
  );

  return {
    frameIndex,
    tp: cm.tp,
    fp: cm.fp,
    fn: cm.fn,
    tn: cm.tn,
    precision: cm.precision,
    recall: cm.recall,
    f1: cm.f1,
    iou: cm.iou,
    foregroundRatio,
    flickerRatio,
    processingTimeMs,
    componentCount,
  };
}
