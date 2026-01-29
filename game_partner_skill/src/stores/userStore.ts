import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, UserProfile, UserConfig, UserPreferences, GameCategory } from '../types/user';

interface UserState {
  user: User | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setUser: (user: User) => void;
  updateProfile: (profile: Partial<UserProfile>) => void;
  updateConfig: (config: Partial<UserConfig>) => void;
  updatePreferences: (preferences: Partial<UserPreferences>) => void;
  addGameCategory: (category: GameCategory) => void;
  removeGameCategory: (categoryId: string) => void;
  addGameToCategory: (categoryId: string, gameId: string) => void;
  removeGameFromCategory: (categoryId: string, gameId: string) => void;
  addSelectedGame: (gameId: string) => void;
  removeSelectedGame: (gameId: string) => void;
  logout: () => void;
  initializeDefaultUser: () => void;
}

const defaultPreferences: UserPreferences = {
  theme: 'dark',
  language: 'zh-CN',
  notifications: {
    enabled: true,
    sound: true,
  },
  capture: {
    defaultMode: 'fullscreen',
    fps: 30,
    autoStart: false,
  },
  ai: {
    llmProvider: 'openai',
    temperature: 0.7,
  },
  tts: {
    enabled: true,
    voice: 'zh-CN-XiaoxiaoNeural',
    speed: 1.0,
    volume: 0.8,
  },
};

const createDefaultUser = (): User => {
  const userId = `user_${Date.now()}`;
  return {
    profile: {
      id: userId,
      username: '游戏玩家',
      token: `token_${Math.random().toString(36).substring(2)}`,
      isPremium: false,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    },
    config: {
      userId,
      selectedGames: [],
      gameCategories: [
        {
          id: 'cat-horror',
          name: '恐怖游戏',
          color: '#f5222d',
          gameIds: [],
          createdAt: new Date().toISOString(),
        },
        {
          id: 'cat-rpg',
          name: '角色扮演',
          color: '#1890ff',
          gameIds: [],
          createdAt: new Date().toISOString(),
        },
        {
          id: 'cat-action',
          name: '动作冒险',
          color: '#52c41a',
          gameIds: [],
          createdAt: new Date().toISOString(),
        },
      ],
      preferences: defaultPreferences,
    },
  };
};

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: false,
      error: null,

      setUser: (user) => set({ user }),

      updateProfile: (profile) =>
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                profile: { ...state.user.profile, ...profile },
              }
            : null,
        })),

      updateConfig: (config) =>
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                config: { ...state.user.config, ...config },
              }
            : null,
        })),

      updatePreferences: (preferences) =>
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                config: {
                  ...state.user.config,
                  preferences: {
                    ...state.user.config.preferences,
                    ...preferences,
                  },
                },
              }
            : null,
        })),

      addGameCategory: (category) =>
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                config: {
                  ...state.user.config,
                  gameCategories: [...state.user.config.gameCategories, category],
                },
              }
            : null,
        })),

      removeGameCategory: (categoryId) =>
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                config: {
                  ...state.user.config,
                  gameCategories: state.user.config.gameCategories.filter(
                    (cat) => cat.id !== categoryId
                  ),
                },
              }
            : null,
        })),

      addGameToCategory: (categoryId, gameId) =>
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                config: {
                  ...state.user.config,
                  gameCategories: state.user.config.gameCategories.map((cat) =>
                    cat.id === categoryId
                      ? { ...cat, gameIds: [...cat.gameIds, gameId] }
                      : cat
                  ),
                },
              }
            : null,
        })),

      removeGameFromCategory: (categoryId, gameId) =>
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                config: {
                  ...state.user.config,
                  gameCategories: state.user.config.gameCategories.map((cat) =>
                    cat.id === categoryId
                      ? { ...cat, gameIds: cat.gameIds.filter((id) => id !== gameId) }
                      : cat
                  ),
                },
              }
            : null,
        })),

      addSelectedGame: (gameId) =>
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                config: {
                  ...state.user.config,
                  selectedGames: [...state.user.config.selectedGames, gameId],
                },
              }
            : null,
        })),

      removeSelectedGame: (gameId) =>
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                config: {
                  ...state.user.config,
                  selectedGames: state.user.config.selectedGames.filter(
                    (id) => id !== gameId
                  ),
                },
              }
            : null,
        })),

      logout: () => set({ user: null }),

      initializeDefaultUser: () => set({ user: createDefaultUser() }),
    }),
    {
      name: 'game-partner-user',
    }
  )
);
