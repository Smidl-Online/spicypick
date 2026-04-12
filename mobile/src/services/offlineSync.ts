import NetInfo from '@react-native-community/netinfo';
import { offlineCache } from './offlineCache';
import { api } from '../api/client';

let syncInProgress = false;

export async function syncPendingVotes(): Promise<number> {
  if (syncInProgress) return 0;
  syncInProgress = true;

  try {
    const pending = await offlineCache.getPendingVotes();
    if (pending.length === 0) return 0;

    let synced = 0;
    for (const vote of pending) {
      try {
        await api(`/api/scenarios/${vote.scenarioId}/vote`, {
          method: 'POST',
          body: { verdict: vote.verdict },
        });
        await offlineCache.removePendingVote(vote.scenarioId);
        synced++;
      } catch (err: any) {
        // If 409 (already voted), remove from queue
        if (err.status === 409 || err.status === 400) {
          await offlineCache.removePendingVote(vote.scenarioId);
        }
        // Otherwise keep in queue for next sync
      }
    }
    return synced;
  } finally {
    syncInProgress = false;
  }
}

export function startNetworkListener(onReconnect: () => void) {
  let wasOffline = false;
  let initialSyncDone = false;

  // Sync any pending votes on cold start (user may have voted offline, closed app, reopened while online)
  syncPendingVotes().then((synced) => {
    initialSyncDone = true;
    if (synced > 0) onReconnect();
  });

  return NetInfo.addEventListener((state) => {
    if (state.isConnected && wasOffline) {
      wasOffline = false;
      syncPendingVotes().then((synced) => {
        if (synced > 0) onReconnect();
      });
    }
    if (!state.isConnected) {
      wasOffline = true;
    }
  });
}

export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected === true;
}
