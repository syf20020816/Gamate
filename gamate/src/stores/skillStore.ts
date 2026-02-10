import { create } from "zustand";

interface SkillLibrary {
  id: string;
  name: string;
  gameType: string;
  count: number;
  lastUpdated: string;
}

interface SkillState {
  libraries: SkillLibrary[];
  addLibrary: (library: SkillLibrary) => void;
  removeLibrary: (id: string) => void;
  updateLibrary: (id: string, updates: Partial<SkillLibrary>) => void;
}

export const useSkillStore = create<SkillState>((set) => ({
  libraries: [],
  addLibrary: (library) =>
    set((state) => ({ libraries: [...state.libraries, library] })),
  removeLibrary: (id) =>
    set((state) => ({
      libraries: state.libraries.filter((lib) => lib.id !== id),
    })),
  updateLibrary: (id, updates) =>
    set((state) => ({
      libraries: state.libraries.map((lib) =>
        lib.id === id ? { ...lib, ...updates } : lib
      ),
    })),
}));
