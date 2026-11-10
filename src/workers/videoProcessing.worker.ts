import { loadOpenCv } from '../core/openCvLoader';
import { runStabilizationPipeline } from '../algorithms/stabilization/stabilizationPipeline';
import { runBackgroundPipeline } from '../algorithms/background/foregroundExtraction';
import { runCombinedSpatiotemporalPipeline } from '../core/pipelineManager';
import { runFullBenchmarkSuite } from '../evaluation/benchmarkRunner';
import { GroundTruthMask } from '../types/video';

self.onmessage = async (event: MessageEvent) => {
  const { id, type, payload } = event.data;

  try {
    const { cv } = await loadOpenCv();

    if (type === 'RUN_STABILIZATION') {
      const { frames, method, params } = payload;
      const result = runStabilizationPipeline(
        cv,
        frames,
        method,
        params,
        (curr, total) => {
          self.postMessage({
            id,
            type: 'PROGRESS',
            progress: Math.round((curr / Math.max(1, total)) * 100),
            label: `Stabilizing (${method.toUpperCase()}) frame ${curr}/${total}`,
          });
        }
      );
      self.postMessage({ id, type: 'SUCCESS', result });
    } else if (type === 'RUN_BACKGROUND') {
      const {
        frames,
        method,
        frameDiffParams,
        mog2Params,
        sampleKnnParams,
        enableMorphology,
        morphologyConfig,
        displayConfig,
        groundTruthEntries,
      } = payload;
      const gtMap = new Map<number, GroundTruthMask>(groundTruthEntries || []);
      const result = runBackgroundPipeline(
        cv,
        frames,
        method,
        frameDiffParams,
        mog2Params,
        sampleKnnParams,
        enableMorphology,
        morphologyConfig,
        displayConfig,
        gtMap
      );
      self.postMessage({ id, type: 'SUCCESS', result });
    } else if (type === 'RUN_COMBINED') {
      const { session, groundTruthEntries, config } = payload;
      const hydratedSession = {
        ...session,
        groundTruthMasks: new Map<number, GroundTruthMask>(
          groundTruthEntries || []
        ),
      };
      const result = runCombinedSpatiotemporalPipeline(
        cv,
        hydratedSession,
        config,
        (stageName, percent) => {
          self.postMessage({
            id,
            type: 'PROGRESS',
            progress: percent,
            label: stageName,
          });
        }
      );
      self.postMessage({ id, type: 'SUCCESS', result });
    } else if (type === 'RUN_BENCHMARK') {
      const { session, groundTruthEntries, options } = payload;
      const hydratedSession = {
        ...session,
        groundTruthMasks: new Map<number, GroundTruthMask>(
          groundTruthEntries || []
        ),
      };
      const result = runFullBenchmarkSuite(cv, hydratedSession, {
        ...options,
        onProgress: (stepLabel: string, percent: number) => {
          self.postMessage({
            id,
            type: 'PROGRESS',
            progress: percent,
            label: stepLabel,
          });
        },
      });
      self.postMessage({ id, type: 'SUCCESS', result });
    }
  } catch (err) {
    self.postMessage({
      id,
      type: 'ERROR',
      error: err instanceof Error ? err.message : 'Worker processing failed',
    });
  }
};
