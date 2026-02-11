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
 * 截图策略配置
 */
export interface SkillStatistics {
  totalEntries: number; // 总条目数
  vectorCount: number; // 向量数量
  storageSize: number; // 存储大小（字节）
  lastCrawled?: string; // 最后爬取时间
  accuracy?: number; // 识别准确率
}

/**
 * 当用户完全不打算下载任何游戏配置时，也想要用AI助手的情况
 * 这个游戏配置将作为默认值
 * 注意：必须与后端 Rust 的 DEFAULT_GAME 保持一致
 */
export const DEFAULT_GAME: Game = {
  id: "all",
  name: "所有游戏",
  icon: "",
  description: "所有游戏的通用配置",
  category: GameType.Other,
  tags: [],
};