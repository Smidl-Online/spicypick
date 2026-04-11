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

function safeParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export const offlineCache = {
  async cacheTodayScenario(data: unknown) {
    await AsyncStorage.setItem(CACHE_KEYS.todayScenario, JSON.stringify(data));
  },

  async getCachedTodayScenario<T>(): Promise<T | null> {
    const raw = await AsyncStorage.getItem(CACHE_KEYS.todayScenario);
    return raw ? safeParse<T | null>(raw, null) : null;
  },

  async cacheUserProfile(data: unknown) {
    await AsyncStorage.setItem(CACHE_KEYS.userProfile, JSON.stringify(data));
  },

  async getCachedUserProfile<T>(): Promise<T | null> {
    const raw = await AsyncStorage.getItem(CACHE_KEYS.userProfile);
    return raw ? safeParse<T | null>(raw, null) : null;
  },

  async cacheLeague(data: unknown) {
    await AsyncStorage.setItem(CACHE_KEYS.league, JSON.stringify(data));
  },

  async getCachedLeague<T>(): Promise<T | null> {
    const raw = await AsyncStorage.getItem(CACHE_KEYS.league);
    return raw ? safeParse<T | null>(raw, null) : null;
  },

  async queueVote(scenarioId: string, verdict: string) {
    const pending = await this.getPendingVotes();
    pending.push({ scenarioId, verdict, timestamp: Date.now() });
    await AsyncStorage.setItem(CACHE_KEYS.pendingVotes, JSON.stringify(pending));
  },

  async getPendingVotes(): Promise<PendingVote[]> {
    const raw = await AsyncStorage.getItem(CACHE_KEYS.pendingVotes);
    return raw ? safeParse<PendingVote[]>(raw, []) : [];
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
