import React from 'react';
import { MultiVideoAcceptanceStudio } from '../components/research/MultiVideoAcceptanceStudio';
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

export interface ResearchLabProps {
  session: DecodedVideoSession;
  onSessionLoaded: (newSession: DecodedVideoSession) => void;
  stabilizationParams: StabilizationParams;
  onChangeStabilizationParams: (p: StabilizationParams) => void;
  frameDiffParams: FrameDiffParams;
  onChangeFrameDiffParams: (p: FrameDiffParams) => void;
  mog2Params: Mog2Params;
  onChangeMog2Params: (p: Mog2Params) => void;
  sampleKnnParams: SampleKnnParams;
  onChangeSampleKnnParams: (p: SampleKnnParams) => void;
  morphologyConfig: MorphologyConfig;
  onChangeMorphologyConfig: (c: MorphologyConfig) => void;
  displayConfig: ForegroundDisplayConfig;
  experimentLogs: TraceableExperimentLogEntry[];
  onAppendExperimentLog: (entry: TraceableExperimentLogEntry) => void;
  sensitivitySweeps: ParameterSensitivitySweepResult[];
  onAppendSensitivitySweep: (sweep: ParameterSensitivitySweepResult) => void;
  playlist?: PlaylistVideoItem[];
  batchResults?: import('../components/research/MultiVideoAcceptanceStudio').VideoBatchResult[];
  onBatchResultsChange?: (results: import('../components/research/MultiVideoAcceptanceStudio').VideoBatchResult[]) => void;
  onToggleVideoSelection?: (id: string) => void;
  onAddMultipleFiles?: (files: FileList | File[]) => Promise<void>;
  onRemoveVideo?: (id: string) => void;
}

/**
 * Màn hình Nghiệm Thu & Ablation Study Đa Video (Multi-Video Acceptance & Voting Studio).
 * Chạy đồng thời các cấu hình D0-D6 trên các video nạp vào, tổng hợp số liệu thực tế,
 * phiếu bầu chọn phương án tối ưu và xuất báo cáo nghiệm thu.
 */
export const ResearchLab: React.FC<ResearchLabProps> = ({
  session,
  playlist,
  batchResults,
  onBatchResultsChange,
  onToggleVideoSelection,
  onAddMultipleFiles,
  onRemoveVideo,
}) => {
  return (
    <div className="space-y-4">
      <MultiVideoAcceptanceStudio
        currentSession={session}
        playlist={playlist}
        batchResults={batchResults}
        onBatchResultsChange={onBatchResultsChange}
        onToggleVideoSelection={onToggleVideoSelection}
        onAddMultipleFiles={onAddMultipleFiles}
        onRemoveVideo={onRemoveVideo}
      />
    </div>
  );
};
