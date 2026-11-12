/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  Crosshair,
  GitMerge,
  Layers,
  PlaySquare,
  Sliders,
} from 'lucide-react';
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
  PlaylistVideoItem,
  SyntheticScenarioId,
  VideoInputConfig,
} from './types/video';
import { INITIAL_BENCHMARK_PLAYLIST } from './core/playlistDefaults';
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
import { GuidedPipelineStepper } from './components/video/GuidedPipelineStepper';
import { ResultAnalysisPage } from './pages/ResultAnalysisPage';
import { ExportCenterPage } from './pages/ExportCenterPage';

export type AlgorithmSubWorkspace = 'stabilization' | 'background' | 'combined';
export type VideoLabMode = 'overview' | 'guided_stepper';

export default function App() {
  const [activePage, setActivePage] = useState<LabPageId>('experiment_lab');
  const [videoLabMode, setVideoLabMode] = useState<VideoLabMode>('overview');
  const [algorithmSubTab, setAlgorithmSubTab] =
    useState<AlgorithmSubWorkspace>('stabilization');
  const [showLegacyBenchmarkInAnalysis, setShowLegacyBenchmarkInAnalysis] =
    useState<boolean>(false);

  const [capabilities, setCapabilities] = useState<OpenCvCapabilities>(
    () => getCachedOpenCv().capabilities
  );

  const [inputConfig, setInputConfig] = useState<VideoInputConfig>(
    DEFAULT_VIDEO_INPUT_CONFIG
  );

  // Initialize with Synthetic Scenario 1 so the workbench is immediately populated
  const [session, setSession] = useState<DecodedVideoSession>(() =>
    generateSyntheticSession('shaky_camera', 36, 320)
  );
  // Playlist of videos loaded into workbench (benchmarks + uploaded videos)
  const [playlist, setPlaylist] = useState<PlaylistVideoItem[]>(() => [
    ...INITIAL_BENCHMARK_PLAYLIST,
  ]);
  const [activeVideoId, setActiveVideoId] = useState<string>(
    INITIAL_BENCHMARK_PLAYLIST[0]?.id ?? ''
  );
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Branch A: Stabilization Lab state
  const [stabilizationParams, setStabilizationParams] =
    useState<StabilizationParams>(DEFAULT_STABILIZATION_PARAMS);
  const [lkResult, setLkResult] = useState<StabilizationRunResult | null>(null);
  const [eccResult, setEccResult] = useState<StabilizationRunResult | null>(
    null
  );

  // Branch B: Background Lab state
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

  // Branch C: Combined Pipeline state
  const [combinedConfig, setCombinedConfig] = useState<CombinedPipelineConfig>(
    DEFAULT_COMBINED_PIPELINE_CONFIG
  );
  const [combinedResult, setCombinedResult] =
    useState<CombinedPipelineComparisonResult | null>(null);

  // Benchmark state
  const [numTrialRuns, setNumTrialRuns] = useState<1 | 3>(1);
  const [currentBenchmark, setCurrentBenchmark] =
    useState<BenchmarkExperimentRecord | null>(null);
  const [experimentHistory, setExperimentHistory] = useState<
    BenchmarkExperimentRecord[]
  >([]);

  // Research & Academic Report Lab state
  const [acceptanceBatchResults, setAcceptanceBatchResults] = useState<
    import('./components/research/MultiVideoAcceptanceStudio').VideoBatchResult[]
  >([]);
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

  const handleSelectActiveVideo = async (id: string) => {
    const found = playlist.find((p) => p.id === id);
    if (!found) return;

    setActiveVideoId(id);
    resetCachedSessionResults();

    if (found.sourceType === 'upload' && found.session) {
      setSession(found.session);
    } else if (found.videoUrl) {
      try {
        setProcessingState({
          isRunning: true,
          label: `Đang giải mã video "${found.title}" từ videodata/...`,
          progress: 15,
        });
        const resp = await fetch(found.videoUrl);
        const blob = await resp.blob();
        const fileObj = new File([blob], found.fileName || found.title, {
          type: 'video/mp4',
        });
        const { session: decodedSession } = await decodeUploadedVideoFile(
          fileObj,
          inputConfig,
          (curr, total) => {
            setProcessingState({
              isRunning: true,
              label: `Đang giải mã "${found.title}" (${curr}/${total} frames)...`,
              progress: Math.round((curr / Math.max(1, total)) * 100),
            });
          }
        );
        found.session = decodedSession;
        setSession(decodedSession);
      } catch (err) {
        console.error('Lỗi giải mã video:', err);
      } finally {
        setProcessingState({ isRunning: false, label: '', progress: 0 });
      }
    } else {
      const scenarioId = found.scenarioId ?? 'shaky_camera';
      const synSession = generateSyntheticSession(scenarioId, 36, inputConfig.maxWidth);
      setSession(synSession);
    }
  };


  const handleToggleVideoSelection = (id: string) => {
    setPlaylist((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const handleRemoveVideo = (id: string) => {
    setPlaylist((prev) => {
      const remaining = prev.filter((item) => item.id !== id);
      if (activeVideoId === id && remaining.length > 0) {
        handleSelectActiveVideo(remaining[0].id);
      }
      return remaining;
    });
  };

  const handleAddMultipleFiles = async (files: FileList | File[]) => {
    setUploadError(null);
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setProcessingState({
      isRunning: true,
      label: `Đang nạp ${fileArray.length} file video...`,
      progress: 5,
    });

    const newItems: PlaylistVideoItem[] = [];

    try {
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        setProcessingState({
          isRunning: true,
          label: `Đang giải mã video ${i + 1}/${fileArray.length}: "${file.name}"...`,
          progress: Math.round(((i + 0.2) / fileArray.length) * 100),
        });

        const controller = new AbortController();
        const { session: decodedSession } = await decodeUploadedVideoFile(
          file,
          inputConfig,
          (curr, total) => {
            const filePct = curr / Math.max(1, total);
            const overall = Math.min(
              99,
              Math.round(((i + filePct) / fileArray.length) * 100)
            );
            setProcessingState({
              isRunning: true,
              label: `Đang giải mã "${file.name}" (frame ${curr}/${total})...`,
              progress: overall,
            });
          },
          controller.signal
        );

        const newId = `upload_${file.name}_${Date.now()}_${i}`;
        newItems.push({
          id: newId,
          title: `File Tải Lên: ${file.name}`,
          subtitle: `${decodedSession.metadata.processingWidth}×${decodedSession.metadata.processingHeight} · ${decodedSession.frames.length} frames`,
          sourceType: 'upload',
          session: decodedSession,
          selected: true,
        });

        // Set the first uploaded video active immediately
        if (i === 0) {
          handleSessionLoaded(decodedSession);
          setActiveVideoId(newId);
        }
      }

      setPlaylist((prev) => [...newItems, ...prev]);
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? err.message
          : 'Không thể giải mã các video đã chọn. Vui lòng thử file MP4 hoặc WebM khác.'
      );
    } finally {
      setProcessingState({
        isRunning: false,
        label: '',
        progress: 0,
      });
    }
  };

  const handleQuickUploadFile = async (file: File) => {
    await handleAddMultipleFiles([file]);
  };

  const handleLoadSyntheticScenario = (scenarioId: SyntheticScenarioId) => {
    setUploadError(null);
    resetCachedSessionResults();
    const newSyn = generateSyntheticSession(scenarioId, 36, inputConfig.maxWidth);
    setSession(newSyn);
  };

  const handleRunFullBenchmark = async (overrideSession?: DecodedVideoSession) => {
    const targetSession = overrideSession ?? session;
    if (targetSession.frames.length === 0 || processingState.isRunning) return;

    setProcessingState({
      isRunning: true,
      label: 'Running comparative evaluation across all algorithms...',
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
    targetModule: 'stabilization' | 'background' | 'benchmark' | LabPageId
  ) => {
    setUploadError(null);
    resetCachedSessionResults();
    const newSyn = generateSyntheticSession(scenarioId, 36, 320);
    setSession(newSyn);

    if (targetModule === 'stabilization') {
      setAlgorithmSubTab('stabilization');
      setActivePage('algorithm_lab');
    } else if (targetModule === 'background') {
      setAlgorithmSubTab('background');
      setActivePage('algorithm_lab');
    } else if (targetModule === 'benchmark') {
      setActivePage('result_analysis');
      await handleRunFullBenchmark(newSyn);
    } else {
      setActivePage(targetModule);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col">
      <Header
        capabilities={capabilities}
        session={session}
        processingState={processingState}
        experimentRunCount={experimentLogs.length}
        playlist={playlist}
        activeVideoId={activeVideoId}
        onSelectActiveVideo={handleSelectActiveVideo}
        onQuickUploadMultipleFiles={handleAddMultipleFiles}
        onNavigate={setActivePage}
      />

      {uploadError && (
        <div className="bg-rose-50 border-b border-rose-300 px-6 py-2.5 text-xs text-rose-900 flex items-center justify-between">
          <span>Video Decode Error: {uploadError}</span>
          <button
            type="button"
            onClick={() => setUploadError(null)}
            className="text-rose-700 hover:text-rose-950 font-semibold underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        <Sidebar activePage={activePage} onSelectPage={setActivePage} />

        <main className="flex-1 p-5 overflow-y-auto">
          <div className="max-w-[1480px] mx-auto space-y-5">
            {/* 1. VIDEO LAB */}
            {activePage === 'video_lab' && (
              <div className="space-y-5">
                {/* Sub-mode switcher: Video Dataset & Quick Launch vs Guided Step-by-Step Pipeline Presentation Mode */}
                <div className="bg-white border border-slate-200 p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      data-testid="video-lab-mode-overview"
                      onClick={() => setVideoLabMode('overview')}
                      className={`px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                        videoLabMode === 'overview'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                      }`}
                    >
                      <PlaySquare className="w-3.5 h-3.5" />
                      <span>1A. Video Input, Synthetic Ground-Truth & Quick Launch</span>
                    </button>
                    <button
                      type="button"
                      data-testid="video-lab-mode-stepper"
                      onClick={() => setVideoLabMode('guided_stepper')}
                      className={`px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                        videoLabMode === 'guided_stepper'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                      }`}
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>1B. Guided Step-by-Step Pipeline Presentation Mode (12 Stages)</span>
                    </button>
                  </div>

                  <span className="text-xs font-mono text-slate-600">
                    Active Sequence: <strong>{session.metadata.fileName}</strong> ({session.metadata.processingWidth}×{session.metadata.processingHeight}, {session.frames.length} frames)
                  </span>
                </div>

                {videoLabMode === 'overview' ? (
                  <Dashboard
                    capabilities={capabilities}
                    session={session}
                    inputConfig={inputConfig}
                    experimentHistory={experimentHistory}
                    playlist={playlist}
                    activeVideoId={activeVideoId}
                    onChangeInputConfig={setInputConfig}
                    onSessionLoaded={handleSessionLoaded}
                    onLoadSyntheticScenario={handleLoadSyntheticScenario}
                    onRunScenarioExperiment={handleRunScenarioExperiment}
                    onAddMultipleFiles={handleAddMultipleFiles}
                    onSelectActiveVideo={handleSelectActiveVideo}
                    onToggleVideoSelection={handleToggleVideoSelection}
                    onRemoveVideo={handleRemoveVideo}
                    onNavigate={setActivePage}
                  />
                ) : (
                  <GuidedPipelineStepper
                    session={session}
                    stabilizationParams={stabilizationParams}
                    selectedBgMethod={selectedBgMethod}
                    frameDiffParams={frameDiffParams}
                    mog2Params={mog2Params}
                    sampleKnnParams={sampleKnnParams}
                    morphologyConfig={morphologyConfig}
                    displayConfig={displayConfig}
                  />
                )}
              </div>
            )}

            {/* 2. ALGORITHM LAB */}
            {activePage === 'algorithm_lab' && (
              <div className="space-y-5">
                {/* 3 Sub-Workspace Selector Bar */}
                <div className="bg-white border border-slate-200 p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      data-testid="alg-tab-stabilization"
                      onClick={() => setAlgorithmSubTab('stabilization')}
                      className={`px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                        algorithmSubTab === 'stabilization'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                      }`}
                    >
                      <Crosshair className="w-3.5 h-3.5" />
                      <span>2A. Chống Rung Video (LK + RANSAC & ECC)</span>
                    </button>

                    <button
                      type="button"
                      data-testid="alg-tab-background"
                      onClick={() => setAlgorithmSubTab('background')}
                      className={`px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                        algorithmSubTab === 'background'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>2B. Tách Nền & Tiền Cảnh (FrameDiff, MOG2, KNN)</span>
                    </button>

                    <button
                      type="button"
                      data-testid="alg-tab-combined"
                      onClick={() => setAlgorithmSubTab('combined')}
                      className={`px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                        algorithmSubTab === 'combined'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                      }`}
                    >
                      <GitMerge className="w-3.5 h-3.5" />
                      <span>2C. So Sánh Luồng Kết Hợp (Flow A vs. Flow B)</span>
                    </button>
                  </div>
                </div>


                {algorithmSubTab === 'stabilization' && (
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

                {algorithmSubTab === 'background' && (
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

                {algorithmSubTab === 'combined' && (
                  <CombinedPipeline
                    session={session}
                    config={combinedConfig}
                    onChangeConfig={setCombinedConfig}
                    comparisonResult={combinedResult}
                    onUpdateResult={setCombinedResult}
                  />
                )}
              </div>
            )}

            {/* 3. EXPERIMENT LAB */}
            {activePage === 'experiment_lab' && (
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
                playlist={playlist}
                batchResults={acceptanceBatchResults}
                onBatchResultsChange={setAcceptanceBatchResults}
                onToggleVideoSelection={handleToggleVideoSelection}
                onAddMultipleFiles={handleAddMultipleFiles}
                onRemoveVideo={handleRemoveVideo}
              />
            )}

            {/* 4. RESULT ANALYSIS */}
            {activePage === 'result_analysis' && (
              <div className="space-y-5">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowLegacyBenchmarkInAnalysis((v) => !v)}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-mono font-semibold cursor-pointer"
                  >
                    {showLegacyBenchmarkInAnalysis
                      ? 'Hide Multi-Algorithm Benchmark Table'
                      : 'Show Multi-Algorithm Benchmark Table'}
                  </button>
                </div>

                <ResultAnalysisPage
                  session={session}
                  stabilizationParams={stabilizationParams}
                  frameDiffParams={frameDiffParams}
                  mog2Params={mog2Params}
                  sampleKnnParams={sampleKnnParams}
                  morphologyConfig={morphologyConfig}
                  displayConfig={displayConfig}
                  experimentLogs={experimentLogs}
                  onAppendExperimentLog={(entry) =>
                    setExperimentLogs((prev) => [...prev, entry])
                  }
                  sensitivitySweeps={sensitivitySweeps}
                  onNavigateExportCenter={() => setActivePage('export_center')}
                />

                {showLegacyBenchmarkInAnalysis && (
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
              </div>
            )}

            {/* 5. EXPORT CENTER */}
            {activePage === 'export_center' && (
              <ExportCenterPage
                session={session}
                playlist={playlist}
                batchResults={acceptanceBatchResults}
                onBatchResultsChange={setAcceptanceBatchResults}
                onNavigate={setActivePage}
                stabilizationParams={stabilizationParams}
                frameDiffParams={frameDiffParams}
                mog2Params={mog2Params}
                sampleKnnParams={sampleKnnParams}
                morphologyConfig={morphologyConfig}
                displayConfig={displayConfig}
                experimentLogs={experimentLogs}
                onAppendExperimentLog={(entry) =>
                  setExperimentLogs((prev) => [...prev, entry])
                }
                sensitivitySweeps={sensitivitySweeps}
              />
            )}

            {/* 6. METHODOLOGY & SOURCE CODE */}
            {activePage === 'methodology_code' && <AlgorithmGuide />}
          </div>
        </main>
      </div>
    </div>
  );
}
