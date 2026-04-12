import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEYS = {
  todayScenario: 'cache:todayScenario',
  pendingVotes: 'cache:pendingVotes',
  userProfile: 'cache:userProfile',
  league: 'cache:league',
};

type PendingVote = {
  scenarioId: string;
  verdict: string;
  timestamp: number;
};

export const offlineCache = {
  async cacheTodayScenario(data: unknown) {
    await AsyncStorage.setItem(CACHE_KEYS.todayScenario, JSON.stringify(data));
  },

  async getCachedTodayScenario<T>(): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEYS.todayScenario);
      return raw ? JSON.parse(raw) : null;
    } catch {
      await AsyncStorage.removeItem(CACHE_KEYS.todayScenario);
      return null;
    }
  },

  async cacheUserProfile(data: unknown) {
    await AsyncStorage.setItem(CACHE_KEYS.userProfile, JSON.stringify(data));
  },

  async getCachedUserProfile<T>(): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEYS.userProfile);
      return raw ? JSON.parse(raw) : null;
    } catch {
      await AsyncStorage.removeItem(CACHE_KEYS.userProfile);
      return null;
    }
  },

  async cacheLeague(data: unknown) {
    await AsyncStorage.setItem(CACHE_KEYS.league, JSON.stringify(data));
  },

  async getCachedLeague<T>(): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEYS.league);
      return raw ? JSON.parse(raw) : null;
    } catch {
      await AsyncStorage.removeItem(CACHE_KEYS.league);
      return null;
    }
  },

  async queueVote(scenarioId: string, verdict: string) {
    const pending = await this.getPendingVotes();
    pending.push({ scenarioId, verdict, timestamp: Date.now() });
    await AsyncStorage.setItem(CACHE_KEYS.pendingVotes, JSON.stringify(pending));
  },

  async getPendingVotes(): Promise<PendingVote[]> {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEYS.pendingVotes);
      return raw ? JSON.parse(raw) : [];
    } catch {
      await AsyncStorage.removeItem(CACHE_KEYS.pendingVotes);
      return [];
    }
  },

  async clearPendingVotes() {
    await AsyncStorage.removeItem(CACHE_KEYS.pendingVotes);
  },

  async removePendingVote(scenarioId: string) {
    const pending = await this.getPendingVotes();
    const filtered = pending.filter((v) => v.scenarioId !== scenarioId);
    await AsyncStorage.setItem(CACHE_KEYS.pendingVotes, JSON.stringify(filtered));
  },
};
