/**
 * 游戏基本信息
 */
export interface Game {
  id: string;
  name: string;
  nameEn?: string;
  icon: string; // 图标 URL 或路径
  banner?: string; // 横幅图片
  description: string;
  category: GameType;
  tags: string[];
  releaseDate?: string;
  developer?: string;
  publisher?: string;
}

/**
 * 游戏类型枚举
 */
export enum GameType {
  ActionRPG = 'action-rpg',
  Strategy = 'strategy',
  Adventure = 'adventure',
  Shooter = 'shooter',
  MOBA = 'moba',
  Horror = 'horror',
  Simulation = 'simulation',
  Racing = 'racing',
  Sports = 'sports',
  Other = 'other',
}

/**
 * 游戏类型显示名称映射
 */
export const GameTypeLabels: Record<GameType, string> = {
  [GameType.ActionRPG]: '动作RPG',
  [GameType.Strategy]: '策略',
  [GameType.Adventure]: '冒险',
  [GameType.Shooter]: '射击',
  [GameType.MOBA]: 'MOBA',
  [GameType.Horror]: '恐怖',
  [GameType.Simulation]: '模拟',
  [GameType.Racing]: '竞速',
  [GameType.Sports]: '体育',
  [GameType.Other]: '其他',
};

/**
 * 游戏技能配置（Skill Config）
 */
export interface GameSkillConfig {
  id: string;
  gameId: string;
  repo: string; // Wiki 仓库地址或 URL
  name: string; // 技能库名称
  description: string;
  version: string;
  source: SkillSource;
  status: SkillStatus;
  statistics: SkillStatistics;
  createdAt: string;
  updatedAt: string;
}

/**
 * 技能来源类型
 * 注意：必须与后端 Rust 的 WikiSourceType 保持一致
 */
export enum SkillSource {
  FandomWiki = 'FandomWiki',      // 改为与后端一致
  GamepediaWiki = 'GamepediaWiki', // 改为与后端一致
  GitHub = 'GitHub',               // 改为与后端一致
  CustomWeb = 'CustomWeb',         // 改为与后端一致
  // 兼容旧值
  IGN = 'ign',
  Community = 'community',
}

/**
 * 技能库状态
 */
export enum SkillStatus {
  NotDownloaded = 'not-downloaded',
  Downloading = 'downloading',
  Processing = 'processing',
  Ready = 'ready',
  Error = 'error',
  Outdated = 'outdated',
}

/**
 * 技能库统计信息
 */
export interface SkillStatistics {
  totalEntries: number; // 总条目数
  vectorCount: number; // 向量数量
  storageSize: number; // 存储大小（字节）
  lastCrawled?: string; // 最后爬取时间
  accuracy?: number; // 识别准确率
}

/**
 * 用户游戏配置（将游戏添加到用户库）
 */
export interface UserGameConfig {
  id: string;
  userId: string;
  gameId: string;
  skillConfigId: string;
  isActive: boolean; // 是否启用
  customSettings?: {
    captureAreas?: CaptureArea[];
    keywords?: string[];
    templates?: string[];
  };
  statistics: {
    playTime: number; // 游戏时长（秒）
    recognitionCount: number; // 识别次数
    lastPlayed?: string;
  };
  addedAt: string;
}

/**
 * 截屏区域定义
 */
export interface CaptureArea {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'ui' | 'text' | 'custom';
}
