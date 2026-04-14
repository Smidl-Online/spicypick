import { create } from 'zustand';
import { api, ApiError } from '../api/client';
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
    } catch (err) {
      // Auth errors — clear league data to prevent cross-session leak
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        set({ league: null, userRank: 0, userWeeklyXp: 0, leaderboard: [], isLoading: false });
        return;
      }
      // Network errors (no HTTP response) — try offline cache
      if (!(err instanceof ApiError)) {
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
          return;
        }
      }
      set({ isLoading: false });
    }
  },
}));
