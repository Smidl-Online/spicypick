import { create } from 'zustand';
import { api } from '../api/client';

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
  error: string | null;

  fetchToday: () => Promise<void>;
  vote: (scenarioId: string, verdict: string) => Promise<VoteResult>;
  reset: () => void;
};

export const useScenarioStore = create<ScenarioState>((set) => ({
  todayScenario: null,
  hasVoted: false,
  userVerdict: null,
  communityStats: null,
  voteResult: null,
  isLoading: false,
  error: null,

  fetchToday: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await api<{
        scenario: Scenario | null;
        voted?: boolean;
        userVerdict?: string;
        communityStats?: CommunityStats;
      }>('/api/scenarios/today');

      set({
        todayScenario: data.scenario,
        hasVoted: data.voted || false,
        userVerdict: data.userVerdict || null,
        communityStats: data.communityStats || null,
        isLoading: false,
      });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  vote: async (scenarioId, verdict) => {
    const result = await api<VoteResult>(`/api/scenarios/${scenarioId}/vote`, {
      method: 'POST',
      body: { verdict },
    });
    set({
      hasVoted: true,
      userVerdict: verdict,
      communityStats: result.communityStats,
      voteResult: result,
    });
    return result;
  },

  reset: () => set({
    todayScenario: null,
    hasVoted: false,
    userVerdict: null,
    communityStats: null,
    voteResult: null,
  }),
}));
