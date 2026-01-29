import { create } from "zustand";

interface GameState {
  currentGame: string | null;
  isCapturing: boolean;
  captureMode: "fullscreen" | "window" | "area";
  fps: number;
  setCurrentGame: (game: string | null) => void;
  setIsCapturing: (capturing: boolean) => void;
  setCaptureMode: (mode: "fullscreen" | "window" | "area") => void;
  setFps: (fps: number) => void;
}

export const useGameStore = create<GameState>((set) => ({
  currentGame: null,
  isCapturing: false,
  captureMode: "fullscreen",
  fps: 30,
  setCurrentGame: (game) => set({ currentGame: game }),
  setIsCapturing: (capturing) => set({ isCapturing: capturing }),
  setCaptureMode: (mode) => set({ captureMode: mode }),
  setFps: (fps) => set({ fps }),
}));
