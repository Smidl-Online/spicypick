import { create } from 'zustand';
import { api } from '../api/client';

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

      set({
        league: data.league,
        userRank: data.userRank || 0,
        userWeeklyXp: data.userWeeklyXp || 0,
        leaderboard: data.leaderboard || [],
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },
}));
