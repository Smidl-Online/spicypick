import { create } from 'zustand';
import { api, ApiError } from '../api/client';

export type Pack = {
  id: string;
  name: string;
  scenarioCount: number;
  categories: string[];
};

export type PackScenario = {
  id: string;
  title: string;
  category: string;
  publishDate: string;
  totalVotes: number;
};

type PacksState = {
  packs: Pack[];
  isLoadingPacks: boolean;

  packScenarios: PackScenario[];
  isLoadingScenarios: boolean;
  scenariosPage: number;
  hasMoreScenarios: boolean;

  selectedCategory: string | null;
  isPremiumRequired: boolean;
  error: string | null;

  fetchPacks: () => Promise<void>;
  fetchPackScenarios: (packId: string, category?: string | null, page?: number) => Promise<void>;
  loadMoreScenarios: (packId: string) => Promise<void>;
  setSelectedCategory: (category: string | null) => void;
  clearPackScenarios: () => void;
};

export const usePacksStore = create<PacksState>((set, get) => ({
  packs: [],
  isLoadingPacks: false,

  packScenarios: [],
  isLoadingScenarios: false,
  scenariosPage: 1,
  hasMoreScenarios: true,

  selectedCategory: null,
  isPremiumRequired: false,
  error: null,

  fetchPacks: async () => {
    set({ isLoadingPacks: true, error: null });
    try {
      const data = await api<{ packs: Pack[] }>('/api/scenarios/packs');
      set({ packs: data.packs });
    } catch (err: any) {
      set({ error: err.message || 'Failed to load packs' });
    } finally {
      set({ isLoadingPacks: false });
    }
  },

  fetchPackScenarios: async (packId: string, category?: string | null, page = 1) => {
    set({ isLoadingScenarios: true, error: null, isPremiumRequired: false });
    try {
      let url = `/api/scenarios/packs/${encodeURIComponent(packId)}?page=${page}&limit=20`;
      if (category) {
        url += `&category=${encodeURIComponent(category)}`;
      }
      const data = await api<{ scenarios: PackScenario[]; page: number; limit: number }>(url);
      if (page === 1) {
        set({ packScenarios: data.scenarios, scenariosPage: 1, hasMoreScenarios: data.scenarios.length >= 20 });
      } else {
        set((state) => ({
          packScenarios: [...state.packScenarios, ...data.scenarios],
          scenariosPage: page,
          hasMoreScenarios: data.scenarios.length >= 20,
        }));
      }
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 403) {
        set({ isPremiumRequired: true });
      } else {
        set({ error: err.message || 'Failed to load scenarios' });
      }
    } finally {
      set({ isLoadingScenarios: false });
    }
  },

  loadMoreScenarios: async (packId: string) => {
    const { scenariosPage, hasMoreScenarios, isLoadingScenarios, selectedCategory } = get();
    if (!hasMoreScenarios || isLoadingScenarios) return;
    await get().fetchPackScenarios(packId, selectedCategory, scenariosPage + 1);
  },

  setSelectedCategory: (category: string | null) => {
    set({ selectedCategory: category });
  },

  clearPackScenarios: () => {
    set({ packScenarios: [], scenariosPage: 1, hasMoreScenarios: true, isPremiumRequired: false, error: null, selectedCategory: null });
  },
}));
