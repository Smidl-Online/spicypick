import { create } from 'zustand';
import { api, setTokens, clearTokens } from '../api/client';
import { analytics } from '../services/analytics';
import { logoutRevenueCat } from '../services/revenueCat';
import { offlineCache } from '../services/offlineCache';
import { useExperimentStore } from './experimentStore';

type User = {
  id: string;
  email: string;
  username: string;
  avatarUrl: string | null;
  xp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  streakFreezes: number;
  lastPlayedAt: string | null;
  isPremium: boolean;
  totalVotes: number;
  birthYear: number | null;
  country: string | null;
  gender: string | null;
};

type AuthState = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  updateProfile: (data: Partial<Pick<User, 'username' | 'avatarUrl'>>) => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: false,
  isAuthenticated: false,

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const data = await api<{ accessToken: string; refreshToken: string; user: User }>(
        '/api/auth/login',
        { method: 'POST', body: { email, password }, auth: false },
      );
      await setTokens(data.accessToken, data.refreshToken);
      set({ isAuthenticated: true });
      analytics.identify(data.user.id);
      await get().fetchProfile();
      analytics.track('user_logged_in', { method: 'email' });
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (email, username, password) => {
    set({ isLoading: true });
    try {
      const data = await api<{ accessToken: string; refreshToken: string; user: User }>(
        '/api/auth/register',
        { method: 'POST', body: { email, username, password }, auth: false },
      );
      await setTokens(data.accessToken, data.refreshToken);
      set({ isAuthenticated: true });
      analytics.identify(data.user.id);
      await get().fetchProfile();
      analytics.track('user_registered', { method: 'email' });
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    analytics.track('user_logged_out');
    analytics.reset();
    // Clear push token on server before clearing auth tokens
    await api('/api/users/me/push-token', { method: 'DELETE' }).catch(() => {});
    await logoutRevenueCat().catch(() => {});
    await clearTokens();
    await offlineCache.clearUserProfile().catch(() => {});
    await offlineCache.clearLeague().catch(() => {});
    useExperimentStore.getState().reset();
    set({ user: null, isAuthenticated: false });
  },

  fetchProfile: async () => {
    try {
      const user = await api<User>('/api/users/me');
      set({ user, isAuthenticated: true });
      // Re-identify on every profile fetch so app resume with existing session
      // correctly tags analytics events (not just login/register)
      analytics.identify(user.id);
      // Cache profile for offline fallback
      await offlineCache.cacheUserProfile(user).catch(() => {});
    } catch (err: any) {
      // Auth errors (401/403) — always log out, don't use stale cache
      const status = err?.status;
      if (status === 401 || status === 403) {
        await clearTokens().catch(() => {});
        await offlineCache.clearUserProfile().catch(() => {});
        analytics.reset();
        set({ user: null, isAuthenticated: false });
        return;
      }
      // Network/other errors — try offline cache fallback
      const cached = await offlineCache.getCachedUserProfile<User>().catch(() => null);
      if (cached) {
        set({ user: cached, isAuthenticated: true });
      } else {
        analytics.reset();
        set({ user: null, isAuthenticated: false });
      }
    }
  },

  updateProfile: async (data) => {
    await api('/api/users/me', { method: 'PATCH', body: data });
    await get().fetchProfile();
  },
}));
