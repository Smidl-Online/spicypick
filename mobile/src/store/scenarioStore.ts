import { create } from 'zustand';
import { api } from '../api/client';
import { offlineCache } from '../services/offlineCache';
import { isOnline } from '../services/offlineSync';

type CommunityStats = {
  total: number;
  guilty: number;
  notGuilty: number;
  complicated: number;
  bothWrong: number;
};

type Scenario = {
  id: string;
  title: string;
  body: string;
  category: string;
  expertAnalysis?: string | null;
  publishDate: string;
};

type VoteResult = {
  xpEarned: number;
  totalXp: number;
  level: number;
  streak: number;
  majorityMatch: boolean;
  newAchievements: string[];
  communityStats: CommunityStats;
  expertAnalysis: string | null;
};

type ScenarioState = {
  todayScenario: Scenario | null;
  hasVoted: boolean;
  userVerdict: string | null;
  communityStats: CommunityStats | null;
  voteResult: VoteResult | null;
  isLoading: boolean;
  isOffline: boolean;
  error: string | null;

  fetchToday: () => Promise<void>;
  vote: (scenarioId: string, verdict: string) => Promise<VoteResult | null>;
  reset: () => void;
};

type TodayResponse = {
  scenario: Scenario | null;
  voted?: boolean;
  userVerdict?: string;
  communityStats?: CommunityStats;
};

export const useScenarioStore = create<ScenarioState>((set) => ({
  todayScenario: null,
  hasVoted: false,
  userVerdict: null,
  communityStats: null,
  voteResult: null,
  isLoading: false,
  isOffline: false,
  error: null,

  fetchToday: async () => {
    set({ isLoading: true, error: null });
    try {
      const online = await isOnline();
      if (!online) {
        const cached = await offlineCache.getCachedTodayScenario<TodayResponse>();
        if (cached) {
          set({
            todayScenario: cached.scenario,
            hasVoted: cached.voted || false,
            userVerdict: cached.userVerdict || null,
            communityStats: cached.communityStats || null,
            isLoading: false,
            isOffline: true,
          });
          return;
        }
        set({ error: 'No internet connection', isLoading: false, isOffline: true });
        return;
      }

      const data = await api<TodayResponse>('/api/scenarios/today');
      await offlineCache.cacheTodayScenario(data);

      set({
        todayScenario: data.scenario,
        hasVoted: data.voted || false,
        userVerdict: data.userVerdict || null,
        communityStats: data.communityStats || null,
        isLoading: false,
        isOffline: false,
      });
    } catch (err: any) {
      const cached = await offlineCache.getCachedTodayScenario<TodayResponse>();
      if (cached) {
        set({
          todayScenario: cached.scenario,
          hasVoted: cached.voted || false,
          userVerdict: cached.userVerdict || null,
          communityStats: cached.communityStats || null,
          isLoading: false,
          isOffline: true,
        });
        return;
      }
      set({ error: err.message, isLoading: false });
    }
  },

  vote: async (scenarioId, verdict) => {
    const online = await isOnline();
    if (!online) {
      await offlineCache.queueVote(scenarioId, verdict);
      set({ hasVoted: true, userVerdict: verdict, isOffline: true });
      return null;
    }

    const result = await api<VoteResult>(`/api/scenarios/${scenarioId}/vote`, {
      method: 'POST',
      body: { verdict },
    });
    set({
      hasVoted: true,
      userVerdict: verdict,
      communityStats: result.communityStats,
      voteResult: result,
      isOffline: false,
    });
    return result;
  },

  reset: () => set({
    todayScenario: null,
    hasVoted: false,
    userVerdict: null,
    communityStats: null,
    voteResult: null,
    isOffline: false,
  }),
}));
