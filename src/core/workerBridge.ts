import { DecodedVideoSession, RawFrameData } from '../types/video';
import {
  BackgroundMethodId,
  BackgroundRunResult,
  CombinedPipelineComparisonResult,
  CombinedPipelineConfig,
  ForegroundDisplayConfig,
  FrameDiffParams,
  Mog2Params,
  MorphologyConfig,
  SampleKnnParams,
  StabilizationMethodId,
  StabilizationParams,
  StabilizationRunResult,
} from '../types/algorithm';
import { BenchmarkExperimentRecord } from '../types/benchmark';
import { loadOpenCv } from './openCvLoader';
import { runStabilizationPipeline } from '../algorithms/stabilization/stabilizationPipeline';
import { runBackgroundPipeline } from '../algorithms/background/foregroundExtraction';
import { runCombinedSpatiotemporalPipeline } from './pipelineManager';
import {
  BenchmarkProtocolOptions,
  runFullBenchmarkSuite,
} from '../evaluation/benchmarkRunner';

/**
 * Executes computer vision tasks using the singleton OpenCV.js WASM runtime
 * with event-loop yielding so UI updates remain responsive and browser WASM memory
 * is never duplicated across multiple worker instances.
 */
const yieldToMain = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export async function executeStabilizationTask(
  frames: RawFrameData[],
  method: StabilizationMethodId,
  params: StabilizationParams,
  onProgress?: (percent: number, label: string) => void
): Promise<StabilizationRunResult> {
  await yieldToMain();
  const { cv } = await loadOpenCv();
  await yieldToMain();
  return runStabilizationPipeline(cv, frames, method, params, (c, t) => {
    onProgress?.(
      Math.round((c / Math.max(1, t)) * 100),
      `Stabilizing (${method.toUpperCase()})`
    );
  });
}

export async function executeBackgroundTask(
  session: DecodedVideoSession,
  method: BackgroundMethodId,
  frameDiffParams: FrameDiffParams,
  mog2Params: Mog2Params,
  sampleKnnParams: SampleKnnParams,
  enableMorphology: boolean,
  morphologyConfig: MorphologyConfig,
  displayConfig: ForegroundDisplayConfig,
  onProgress?: (percent: number, label: string) => void
): Promise<BackgroundRunResult> {
  await yieldToMain();
  const { cv } = await loadOpenCv();
  onProgress?.(35, `Running ${method.toUpperCase()}...`);
  await yieldToMain();
  const res = runBackgroundPipeline(
    cv,
    session.frames,
    method,
    frameDiffParams,
    mog2Params,
    sampleKnnParams,
    enableMorphology,
    morphologyConfig,
    displayConfig,
    session.groundTruthMasks
  );
  onProgress?.(100, 'Complete');
  return res;
}

export async function executeCombinedPipelineTask(
  session: DecodedVideoSession,
  config: CombinedPipelineConfig,
  onProgress?: (percent: number, label: string) => void
): Promise<CombinedPipelineComparisonResult> {
  await yieldToMain();
  const { cv } = await loadOpenCv();
  await yieldToMain();
  return runCombinedSpatiotemporalPipeline(cv, session, config, (lbl, pct) => {
    onProgress?.(pct, lbl);
  });
}

export async function executeBenchmarkTask(
  session: DecodedVideoSession,
  options: Omit<BenchmarkProtocolOptions, 'onProgress'>,
  onProgress?: (percent: number, label: string) => void
): Promise<BenchmarkExperimentRecord> {
  await yieldToMain();
  const { cv } = await loadOpenCv();
  await yieldToMain();
  return runFullBenchmarkSuite(cv, session, {
    ...options,
    onProgress: (lbl, pct) => onProgress?.(pct, lbl),
  });
}
