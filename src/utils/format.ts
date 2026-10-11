// Small display helpers shared across components.

/** Download size/speed info shown in the UI while a model is being fetched */
export interface DownloadStatsLike {
  loadedMB: number;
  totalMB: number;
  speedMBps: number;
}

/** Remaining time for the current download, derived from size/speed stats */
export const downloadEta = (stats: DownloadStatsLike | null): string | null => {
  if (!stats || stats.speedMBps <= 0 || stats.totalMB <= stats.loadedMB) {
    return null;
  }
  const remainingSec = Math.max(0, (stats.totalMB - stats.loadedMB) / stats.speedMBps);
  const min = Math.floor(remainingSec / 60);
  const sec = Math.round(remainingSec % 60);
  return min > 0 ? `${min} min ${sec} s` : `${sec} s`;
};
