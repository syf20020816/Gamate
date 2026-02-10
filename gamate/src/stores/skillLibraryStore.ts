import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SkillLibraryConfig, DownloadedSkillLibrary } from '../types/skillLibrary';

interface SkillLibraryState {
  config: SkillLibraryConfig;
  downloadedLibraries: DownloadedSkillLibrary[];
  isLoading: boolean;
  error: string | null;

  // Config Actions
  updateConfig: (config: Partial<SkillLibraryConfig>) => void;
  setStoragePath: (path: string) => void;

  // Library Actions
  addDownloadedLibrary: (library: DownloadedSkillLibrary) => void;
  removeDownloadedLibrary: (id: string) => void;
  updateLibraryStatus: (id: string, status: 'active' | 'outdated' | 'error') => void;
  getLibrariesByGameId: (gameId: string) => DownloadedSkillLibrary[];
  setActiveVersion: (gameId: string, timestamp: number) => void;
}

const defaultConfig: SkillLibraryConfig = {
  storageBasePath: 'C:\\GamePartner\\Skills', // Windows 默认路径
  maxVersionsToKeep: 3,
  autoUpdate: false,
  updateCheckInterval: 24,
};

export const useSkillLibraryStore = create<SkillLibraryState>()(
  persist(
    (set, get) => ({
      config: defaultConfig,
      downloadedLibraries: [],
      isLoading: false,
      error: null,

      updateConfig: (config) =>
        set((state) => ({
          config: { ...state.config, ...config },
        })),

      setStoragePath: (path) =>
        set((state) => ({
          config: { ...state.config, storageBasePath: path },
        })),

      addDownloadedLibrary: (library) =>
        set((state) => ({
          downloadedLibraries: [...state.downloadedLibraries, library],
        })),

      removeDownloadedLibrary: (id) =>
        set((state) => ({
          downloadedLibraries: state.downloadedLibraries.filter((lib) => lib.id !== id),
        })),

      updateLibraryStatus: (id, status) =>
        set((state) => ({
          downloadedLibraries: state.downloadedLibraries.map((lib) =>
            lib.id === id ? { ...lib, status } : lib
          ),
        })),

      getLibrariesByGameId: (gameId) => {
        return get().downloadedLibraries.filter((lib) => lib.gameId === gameId);
      },

      setActiveVersion: (gameId, timestamp) =>
        set((state) => ({
          downloadedLibraries: state.downloadedLibraries.map((lib) => {
            if (lib.gameId === gameId) {
              return {
                ...lib,
                status: lib.timestamp === timestamp ? 'active' : 'outdated',
              };
            }
            return lib;
          }),
        })),
    }),
    {
      name: 'Gamate-library',
    }
  )
);
