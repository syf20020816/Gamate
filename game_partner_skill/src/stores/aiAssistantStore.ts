import { create } from 'zustand';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  screenshot?: string; // Base64 encoded screenshot
  wikiReferences?: WikiReference[];
}

export interface WikiReference {
  title: string;
  content: string;
  score: number;
  url?: string;
}

export interface AIAssistantState {
  // 消息历史
  messages: Message[];
  
  // 当前状态
  currentGame: string | null;
  isThinking: boolean;
  latestScreenshot: string | null;
  
  // 上下文信息
  gameState: Record<string, any>;
  lastWikiSearch: WikiReference[];
  
  // 动作
  sendMessage: (content: string, screenshot?: string) => void;
  receiveAIResponse: (content: string, wikiRefs?: WikiReference[]) => void;
  updateContext: (screenshot?: string, gameState?: Record<string, any>) => void;
  setCurrentGame: (gameId: string | null) => void;
  setThinking: (thinking: boolean) => void;
  clearMessages: () => void;
  deleteMessage: (messageId: string) => void;
}

export const useAIAssistantStore = create<AIAssistantState>((set) => ({
  // 初始状态
  messages: [],
  currentGame: null,
  isThinking: false,
  latestScreenshot: null,
  gameState: {},
  lastWikiSearch: [],

  // 发送用户消息
  sendMessage: (content: string, screenshot?: string) => {
    const newMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
      screenshot,
    };

    set((state) => ({
      messages: [...state.messages, newMessage],
      isThinking: true,
    }));
  },

  // 接收 AI 回复
  receiveAIResponse: (content: string, wikiRefs?: WikiReference[]) => {
    const newMessage: Message = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content,
      timestamp: Date.now(),
      wikiReferences: wikiRefs,
    };

    set((state) => ({
      messages: [...state.messages, newMessage],
      isThinking: false,
      lastWikiSearch: wikiRefs || [],
    }));
  },

  // 更新上下文
  updateContext: (screenshot?: string, gameState?: Record<string, any>) => {
    set((state) => ({
      latestScreenshot: screenshot ?? state.latestScreenshot,
      gameState: gameState ?? state.gameState,
    }));
  },

  // 设置当前游戏
  setCurrentGame: (gameId: string | null) => {
    set({ currentGame: gameId, messages: [] });
  },

  // 设置思考状态
  setThinking: (thinking: boolean) => {
    set({ isThinking: thinking });
  },

  // 清空消息
  clearMessages: () => {
    set({ messages: [] });
  },

  // 删除消息
  deleteMessage: (messageId: string) => {
    set((state) => ({
      messages: state.messages.filter((msg) => msg.id !== messageId),
    }));
  },
}));
