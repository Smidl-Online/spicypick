import { create } from 'zustand';
import { api, ApiError, setTokens, clearTokens } from '../api/client';
import { analytics } from '../services/analytics';
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
    useExperimentStore.getState().reset();
    await offlineCache.clearUserData();
    await clearTokens();
    set({ user: null, isAuthenticated: false });
  },

  fetchProfile: async () => {
    try {
      const user = await api<User>('/api/users/me');
      set({ user, isAuthenticated: true });
      analytics.identify(user.id);
      await offlineCache.cacheUserProfile(user).catch(() => {});
    } catch (error) {
      // Auth errors (401/403) = token invalid or account gone → force logout
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        analytics.reset();
        set({ user: null, isAuthenticated: false });
        return;
      }
      // Network/other errors → try offline cache before logging out
      const cached = await offlineCache.getCachedUserProfile<User>().catch(() => null);
      if (cached) {
        set({ user: cached, isAuthenticated: true });
        analytics.identify(cached.id);
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
