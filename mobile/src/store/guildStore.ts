import { create } from 'zustand';
import { api } from '../api/client';

type GuildSummary = {
  id: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  weeklyXp: number;
  totalXp: number;
  memberCount: number;
  maxMembers: number;
  rank?: number;
};

type GuildMember = {
  rank: number;
  userId: string;
  username: string;
  avatarUrl: string | null;
  role: 'leader' | 'officer' | 'member';
  weeklyXp: number;
  isCurrentUser: boolean;
};

type GuildDetail = GuildSummary & {
  createdAt: string;
};

type MyGuildData = {
  guild: GuildDetail | null;
  userRole: 'leader' | 'officer' | 'member' | null;
  members: GuildMember[];
};

type GuildState = {
  // Leaderboard (browse)
  guilds: GuildSummary[];
  guildsPage: number;
  isLoadingGuilds: boolean;

  // My guild
  myGuild: GuildDetail | null;
  myRole: 'leader' | 'officer' | 'member' | null;
  myGuildMembers: GuildMember[];
  isLoadingMyGuild: boolean;

  // Guild detail
  guildDetail: GuildDetail | null;
  guildDetailMembers: GuildMember[];
  isLoadingDetail: boolean;

  // Actions
  isActing: boolean;
  error: string | null;

  fetchGuilds: (page?: number) => Promise<void>;
  fetchMyGuild: () => Promise<void>;
  fetchGuildDetail: (id: string) => Promise<void>;
  createGuild: (name: string, description?: string) => Promise<boolean>;
  joinGuild: (id: string) => Promise<boolean>;
  leaveGuild: (id: string) => Promise<boolean>;
  clearError: () => void;
};

export const useGuildStore = create<GuildState>((set, get) => ({
  guilds: [],
  guildsPage: 1,
  isLoadingGuilds: false,

  myGuild: null,
  myRole: null,
  myGuildMembers: [],
  isLoadingMyGuild: false,

  guildDetail: null,
  guildDetailMembers: [],
  isLoadingDetail: false,

  isActing: false,
  error: null,

  fetchGuilds: async (page = 1) => {
    set({ isLoadingGuilds: true });
    try {
      const data = await api<{ guilds: GuildSummary[]; page: number }>(`/api/guilds?page=${page}&limit=20`);
      set({
        guilds: data.guilds,
        guildsPage: data.page,
        isLoadingGuilds: false,
      });
    } catch {
      set({ isLoadingGuilds: false });
    }
  },

  fetchMyGuild: async () => {
    set({ isLoadingMyGuild: true });
    try {
      const data = await api<MyGuildData>('/api/guilds/mine');
      set({
        myGuild: data.guild,
        myRole: data.userRole ?? null,
        myGuildMembers: data.members ?? [],
        isLoadingMyGuild: false,
      });
    } catch {
      set({ isLoadingMyGuild: false });
    }
  },

  fetchGuildDetail: async (id: string) => {
    set({ isLoadingDetail: true });
    try {
      const data = await api<{ guild: GuildDetail; members: GuildMember[] }>(`/api/guilds/${id}`);
      set({
        guildDetail: data.guild,
        guildDetailMembers: data.members,
        isLoadingDetail: false,
      });
    } catch {
      set({ isLoadingDetail: false });
    }
  },

  createGuild: async (name: string, description?: string) => {
    set({ isActing: true, error: null });
    try {
      await api('/api/guilds', {
        method: 'POST',
        body: { name, description: description || undefined },
      });
      set({ isActing: false });
      await get().fetchMyGuild();
      return true;
    } catch (e: any) {
      set({ isActing: false, error: e?.message || 'Failed to create guild' });
      return false;
    }
  },

  joinGuild: async (id: string) => {
    set({ isActing: true, error: null });
    try {
      await api(`/api/guilds/${id}/join`, { method: 'POST' });
      set({ isActing: false });
      await get().fetchMyGuild();
      return true;
    } catch (e: any) {
      set({ isActing: false, error: e?.message || 'Failed to join guild' });
      return false;
    }
  },

  leaveGuild: async (id: string) => {
    set({ isActing: true, error: null });
    try {
      await api(`/api/guilds/${id}/leave`, { method: 'POST' });
      set({ isActing: false, myGuild: null, myRole: null, myGuildMembers: [] });
      return true;
    } catch (e: any) {
      set({ isActing: false, error: e?.message || 'Failed to leave guild' });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));
