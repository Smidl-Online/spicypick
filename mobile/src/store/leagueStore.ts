import { create } from 'zustand';
import { api } from '../api/client';
import { offlineCache } from '../services/offlineCache';

type LeaderboardEntry = {
  rank: number;
  userId: string;
  username: string;
  avatarUrl: string | null;
  weeklyXp: number;
  isPromotionZone: boolean;
  isDemotionZone: boolean;
  isCurrentUser: boolean;
};

type League = {
  id: string;
  tier: string;
  weekStart: string;
  weekEnd: string;
};

type LeagueState = {
  league: League | null;
  userRank: number;
  userWeeklyXp: number;
  leaderboard: LeaderboardEntry[];
  isLoading: boolean;

  fetchCurrent: () => Promise<void>;
};

export const useLeagueStore = create<LeagueState>((set) => ({
  league: null,
  userRank: 0,
  userWeeklyXp: 0,
  leaderboard: [],
  isLoading: false,

  fetchCurrent: async () => {
    set({ isLoading: true });
    try {
      const data = await api<{
        league: League | null;
        userRank?: number;
        userWeeklyXp?: number;
        leaderboard?: LeaderboardEntry[];
      }>('/api/leagues/current');

      const state = {
        league: data.league,
        userRank: data.userRank || 0,
        userWeeklyXp: data.userWeeklyXp || 0,
        leaderboard: data.leaderboard || [],
        isLoading: false,
      };
      set(state);
      // Cache league data for offline fallback
      await offlineCache.cacheLeague(data).catch(() => {});
    } catch (err: any) {
      // Auth errors — don't serve stale cache, just stop loading
      const status = err?.status;
      if (status === 401 || status === 403) {
        set({ isLoading: false });
        return;
      }
      // Network/other errors — try offline cache before giving up
      const cached = await offlineCache.getCachedLeague<{
        league: League | null;
        userRank?: number;
        userWeeklyXp?: number;
        leaderboard?: LeaderboardEntry[];
      }>().catch(() => null);
      if (cached) {
        set({
          league: cached.league,
          userRank: cached.userRank || 0,
          userWeeklyXp: cached.userWeeklyXp || 0,
          leaderboard: cached.leaderboard || [],
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    }
  },
}));
