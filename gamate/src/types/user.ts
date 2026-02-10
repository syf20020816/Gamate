/**
 * 用户信息类型定义
 */
export interface UserProfile {
  id: string;
  username: string;
  email?: string;
  avatar?: string;
  token: string; // 用户令牌，用于区分付费/免费用户
  isPremium: boolean; // 是否为付费用户
  createdAt: string;
  lastLoginAt: string;
}

/**
 * 用户配置类型定义
 */
export interface UserConfig {
  userId: string;
  selectedGames: string[]; // 已选择的游戏 ID 列表
  gameCategories: GameCategory[]; // 用户的游戏分类
  preferences: UserPreferences;
}

/**
 * 游戏分类
 */
export interface GameCategory {
  id: string;
  name: string;
  color: string;
  icon?: string;
  gameIds: string[]; // 该分类下的游戏 ID
  createdAt: string;
}

/**
 * 用户偏好设置
 */
export interface UserPreferences {
  theme: 'dark' | 'light';
  language: 'zh-CN' | 'en-US';
  notifications: {
    enabled: boolean;
    sound: boolean;
  };
  capture: {
    defaultMode: 'fullscreen' | 'window' | 'area';
    fps: number;
    autoStart: boolean;
  };
  ai: {
    llmProvider: 'openai' | 'local' | 'groq';
    apiKey?: string;
    modelName?: string;
    temperature: number;
  };
  tts: {
    enabled: boolean;
    voice: string;
    speed: number;
    volume: number;
  };
}

/**
 * 完整用户数据
 */
export interface User {
  profile: UserProfile;
  config: UserConfig;
}
