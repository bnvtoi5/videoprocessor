/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  getCachedOpenCv,
  loadOpenCv,
  OpenCvCapabilities,
} from './core/openCvLoader';
import {
  decodeUploadedVideoFile,
  DEFAULT_VIDEO_INPUT_CONFIG,
} from './core/videoDecoder';
import { generateSyntheticSession } from './demo/syntheticSceneGenerator';
import {
  DecodedVideoSession,
  SyntheticScenarioId,
  VideoInputConfig,
} from './types/video';
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
  StabilizationParams,
  StabilizationRunResult,
} from './types/algorithm';
import { BenchmarkExperimentRecord } from './types/benchmark';
import {
  ParameterSensitivitySweepResult,
  TraceableExperimentLogEntry,
} from './types/research';
import {
  DEFAULT_COMBINED_PIPELINE_CONFIG,
  DEFAULT_FOREGROUND_DISPLAY_CONFIG,
  DEFAULT_FRAME_DIFF_PARAMS,
  DEFAULT_MOG2_PARAMS,
  DEFAULT_MORPHOLOGY_CONFIG,
  DEFAULT_SAMPLE_KNN_PARAMS,
  DEFAULT_STABILIZATION_PARAMS,
} from './utils/defaultParams';
import { executeBenchmarkTask } from './core/workerBridge';
import { Sidebar, LabPageId } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { Dashboard } from './pages/Dashboard';
import { StabilizationLab } from './pages/StabilizationLab';
import { BackgroundLab } from './pages/BackgroundLab';
import { BenchmarkLab } from './pages/BenchmarkLab';
import { CombinedPipeline } from './pages/CombinedPipeline';
import { ResearchLab } from './pages/ResearchLab';
import { AlgorithmGuide } from './pages/AlgorithmGuide';

export default function App() {
  const [activePage, setActivePage] = useState<LabPageId>('dashboard');
  const [capabilities, setCapabilities] = useState<OpenCvCapabilities>(
    () => getCachedOpenCv().capabilities
  );

  const [inputConfig, setInputConfig] = useState<VideoInputConfig>(
    DEFAULT_VIDEO_INPUT_CONFIG
  );

  // Initialize with Synthetic Scenario 1 so the app is never empty, while letting user upload immediately
  const [session, setSession] = useState<DecodedVideoSession>(() =>
    generateSyntheticSession('shaky_camera', 36, 320)
  );
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Module A: Stabilization Lab state
  const [stabilizationParams, setStabilizationParams] =
    useState<StabilizationParams>(DEFAULT_STABILIZATION_PARAMS);
  const [lkResult, setLkResult] = useState<StabilizationRunResult | null>(null);
  const [eccResult, setEccResult] = useState<StabilizationRunResult | null>(
    null
  );

  // Module B: Background Lab state
  const [selectedBgMethod, setSelectedBgMethod] =
    useState<BackgroundMethodId>('mog2');
  const [frameDiffParams, setFrameDiffParams] = useState<FrameDiffParams>(
    DEFAULT_FRAME_DIFF_PARAMS
  );
  const [mog2Params, setMog2Params] =
    useState<Mog2Params>(DEFAULT_MOG2_PARAMS);
  const [sampleKnnParams, setSampleKnnParams] = useState<SampleKnnParams>(
    DEFAULT_SAMPLE_KNN_PARAMS
  );
  const [enableMorphology, setEnableMorphology] = useState<boolean>(true);
  const [morphologyConfig, setMorphologyConfig] = useState<MorphologyConfig>(
    DEFAULT_MORPHOLOGY_CONFIG
  );
  const [displayConfig, setDisplayConfig] = useState<ForegroundDisplayConfig>(
    DEFAULT_FOREGROUND_DISPLAY_CONFIG
  );
  const [bgResultsByMethod, setBgResultsByMethod] = useState<
    Record<BackgroundMethodId, BackgroundRunResult | null>
  >({
    frame_diff: null,
    mog2: null,
    sample_knn: null,
  });

  // Module C: Combined Pipeline state
  const [combinedConfig, setCombinedConfig] = useState<CombinedPipelineConfig>(
    DEFAULT_COMBINED_PIPELINE_CONFIG
  );
  const [combinedResult, setCombinedResult] =
    useState<CombinedPipelineComparisonResult | null>(null);

  // Module D: Benchmark Lab state
  const [numTrialRuns, setNumTrialRuns] = useState<1 | 3>(1);
  const [currentBenchmark, setCurrentBenchmark] =
    useState<BenchmarkExperimentRecord | null>(null);
  const [experimentHistory, setExperimentHistory] = useState<
    BenchmarkExperimentRecord[]
  >([]);

  // Module E: Research & Academic Report Lab state
  const [experimentLogs, setExperimentLogs] = useState<
    TraceableExperimentLogEntry[]
  >([]);
  const [sensitivitySweeps, setSensitivitySweeps] = useState<
    ParameterSensitivitySweepResult[]
  >([]);

  const [processingState, setProcessingState] = useState<{
    isRunning: boolean;
    label: string;
    progress: number;
  }>({
    isRunning: false,
    label: '',
    progress: 0,
  });

  // Load OpenCV.js WebAssembly asynchronously on mount
  useEffect(() => {
    let mounted = true;
    loadOpenCv().then(({ capabilities: caps }) => {
      if (mounted) {
        setCapabilities(caps);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const resetCachedSessionResults = () => {
    setLkResult(null);
    setEccResult(null);
    setBgResultsByMethod({
      frame_diff: null,
      mog2: null,
      sample_knn: null,
    });
    setCombinedResult(null);
    setCurrentBenchmark(null);
  };

  const handleSessionLoaded = (newSession: DecodedVideoSession) => {
    setUploadError(null);
    resetCachedSessionResults();
    setSession(newSession);
  };

  const handleQuickUploadFile = async (file: File) => {
    setUploadError(null);
    setProcessingState({
      isRunning: true,
      label: `Đang đọc video "${file.name}"...`,
      progress: 10,
    });

    try {
      const controller = new AbortController();
      const { session: decodedSession } = await decodeUploadedVideoFile(
        file,
        inputConfig,
        (curr, total) => {
          const pct = Math.min(99, Math.round((curr / Math.max(1, total)) * 100));
          setProcessingState({
            isRunning: true,
            label: `Đang giải mã khung hình ${curr} / ${total}...`,
            progress: pct,
          });
        },
        controller.signal
      );
      handleSessionLoaded(decodedSession);
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? err.message
          : 'Không thể giải mã file video này. Vui lòng thử file MP4 hoặc WebM khác.'
      );
    } finally {
      setProcessingState({
        isRunning: false,
        label: '',
        progress: 0,
      });
    }
  };

  const handleLoadSyntheticScenario = (scenarioId: SyntheticScenarioId) => {
    setUploadError(null);
    resetCachedSessionResults();
    const newSyn = generateSyntheticSession(scenarioId, 36, 320);
    setSession(newSyn);
  };

  const handleRunFullBenchmark = async (overrideSession?: DecodedVideoSession) => {
    const targetSession = overrideSession ?? session;
    if (targetSession.frames.length === 0 || processingState.isRunning) return;

    setProcessingState({
      isRunning: true,
      label: 'Đang chạy đánh giá & so sánh toàn bộ thuật toán...',
      progress: 5,
    });

    try {
      const record = await executeBenchmarkTask(
        targetSession,
        {
          numTrialRuns,
          stabilizationParams,
          frameDiffParams,
          mog2Params,
          sampleKnnParams,
          morphologyConfig,
          displayConfig,
        },
        (pct, lbl) => {
          setProcessingState({
            isRunning: true,
            label: lbl,
            progress: pct,
          });
        }
      );

      setCurrentBenchmark(record);
      setExperimentHistory((prev) => [record, ...prev.slice(0, 9)]);
    } finally {
      setProcessingState({
        isRunning: false,
        label: '',
        progress: 0,
      });
    }
  };

  const handleRunScenarioExperiment = async (
    scenarioId: SyntheticScenarioId,
    targetModule: LabPageId
  ) => {
    setUploadError(null);
    resetCachedSessionResults();
    const newSyn = generateSyntheticSession(scenarioId, 36, 320);
    setSession(newSyn);
    setActivePage(targetModule);
    if (targetModule === 'benchmark') {
      await handleRunFullBenchmark(newSyn);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0E17] text-[#F1F5F9] flex flex-col">
      <Header
        capabilities={capabilities}
        session={session}
        processingState={processingState}
        onQuickUploadFile={handleQuickUploadFile}
      />

      {uploadError && (
        <div className="bg-rose-950/80 border-b border-rose-700 px-6 py-2.5 text-xs text-rose-200 flex items-center justify-between">
          <span>Lỗi đọc video: {uploadError}</span>
          <button
            type="button"
            onClick={() => setUploadError(null)}
            className="text-rose-300 hover:text-white underline cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        <Sidebar activePage={activePage} onSelectPage={setActivePage} />

        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-[1440px] mx-auto">
            {activePage === 'dashboard' && (
              <Dashboard
                capabilities={capabilities}
                session={session}
                inputConfig={inputConfig}
                experimentHistory={experimentHistory}
                onChangeInputConfig={setInputConfig}
                onSessionLoaded={handleSessionLoaded}
                onLoadSyntheticScenario={handleLoadSyntheticScenario}
                onRunScenarioExperiment={handleRunScenarioExperiment}
                onNavigate={setActivePage}
              />
            )}

            {activePage === 'stabilization' && (
              <StabilizationLab
                session={session}
                params={stabilizationParams}
                onChangeParams={setStabilizationParams}
                lkResult={lkResult}
                eccResult={eccResult}
                onUpdateResults={(lk, ecc) => {
                  setLkResult(lk);
                  setEccResult(ecc);
                }}
              />
            )}

            {activePage === 'background' && (
              <BackgroundLab
                session={session}
                selectedMethod={selectedBgMethod}
                onSelectMethod={setSelectedBgMethod}
                frameDiffParams={frameDiffParams}
                onChangeFrameDiffParams={setFrameDiffParams}
                mog2Params={mog2Params}
                onChangeMog2Params={setMog2Params}
                sampleKnnParams={sampleKnnParams}
                onChangeSampleKnnParams={setSampleKnnParams}
                enableMorphology={enableMorphology}
                onChangeEnableMorphology={setEnableMorphology}
                morphologyConfig={morphologyConfig}
                onChangeMorphologyConfig={setMorphologyConfig}
                displayConfig={displayConfig}
                onChangeDisplayConfig={setDisplayConfig}
                resultsByMethod={bgResultsByMethod}
                onUpdateMethodResult={(m, res) =>
                  setBgResultsByMethod((prev) => ({ ...prev, [m]: res }))
                }
              />
            )}

            {activePage === 'combined' && (
              <CombinedPipeline
                session={session}
                config={combinedConfig}
                onChangeConfig={setCombinedConfig}
                comparisonResult={combinedResult}
                onUpdateResult={setCombinedResult}
              />
            )}

            {activePage === 'benchmark' && (
              <BenchmarkLab
                session={session}
                currentRecord={currentBenchmark}
                isRunning={processingState.isRunning}
                progressLabel={processingState.label}
                numTrialRuns={numTrialRuns}
                onChangeNumTrialRuns={setNumTrialRuns}
                onRunBenchmark={() => handleRunFullBenchmark()}
              />
            )}

            {activePage === 'research' && (
              <ResearchLab
                session={session}
                onSessionLoaded={handleSessionLoaded}
                stabilizationParams={stabilizationParams}
                onChangeStabilizationParams={setStabilizationParams}
                frameDiffParams={frameDiffParams}
                onChangeFrameDiffParams={setFrameDiffParams}
                mog2Params={mog2Params}
                onChangeMog2Params={setMog2Params}
                sampleKnnParams={sampleKnnParams}
                onChangeSampleKnnParams={setSampleKnnParams}
                morphologyConfig={morphologyConfig}
                onChangeMorphologyConfig={setMorphologyConfig}
                displayConfig={displayConfig}
                experimentLogs={experimentLogs}
                onAppendExperimentLog={(entry) =>
                  setExperimentLogs((prev) => [...prev, entry])
                }
                sensitivitySweeps={sensitivitySweeps}
                onAppendSensitivitySweep={(sweep) =>
                  setSensitivitySweeps((prev) => [...prev, sweep])
                }
              />
            )}

            {activePage === 'guide' && <AlgorithmGuide />}
          </div>
        </main>
      </div>
    </div>
  );
}
