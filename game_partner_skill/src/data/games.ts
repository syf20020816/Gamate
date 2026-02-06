/**
 * ⚠️ 已废弃：这些是硬编码的假数据
 * 
 * 现在所有游戏数据都应该从后端 `games.toml` 加载
 * 请使用 `src/services/configService.ts` 中的函数:
 * - getGames(): Promise<Game[]>
 * - getGameById(id: string): Promise<Game | undefined>
 * - getSkillConfigs(): Promise<GameSkillConfig[]>
 * - getSkillConfigsByGameId(gameId: string): Promise<GameSkillConfig[]>
 * 
 * 这个文件仅保留作为数据结构参考，不应该在代码中导入使用。
 */

// 类型导入保留用于文档注释
// import { Game, GameType, GameSkillConfig, SkillSource, SkillStatus } from "../types/game";

/*
// ============================================================
// 以下是已废弃的硬编码数据，仅供参考
// ============================================================

/**
 * 预定义游戏列表 (已废弃)
 * /
export const GAMES: Game[] = [
  {
    id: "phasmophobia",
    name: "恐鬼症",
    nameEn: "Phasmophobia",
    icon: "/games/phasmophobia.png",
    banner: "/games/phasmophobia.png",
    description:
      "恐鬼症是一款4人在线合作心理恐怖游戏。你和你的超自然现象调查小组将进入闹鬼的地点，收集尽可能多的超自然现象证据。",
    category: GameType.Horror,
    tags: ["合作", "多人", "恐怖", "调查", "VR支持"],
    releaseDate: "2020-09-18",
    developer: "Kinetic Games",
    publisher: "Kinetic Games",
  },
  {
    id: "elden-ring",
    name: "艾尔登法环",
    nameEn: "Elden Ring",
    icon: "/games/elden-ring.png",
    banner: "/games/elden-ring-banner.jpg",
    description: "由宫崎英高与乔治·R·R·马丁共同创作的黑暗奇幻动作RPG游戏。",
    category: GameType.ActionRPG,
    tags: ["魂系", "开放世界", "高难度", "动作"],
    releaseDate: "2022-02-25",
    developer: "FromSoftware",
    publisher: "Bandai Namco",
  },
  {
    id: "baldurs-gate-3",
    name: "博德之门3",
    nameEn: "Baldur's Gate 3",
    icon: "/games/bg3.png",
    banner: "/games/bg3-banner.jpg",
    description: "基于龙与地下城规则的角色扮演游戏，由拉瑞安工作室开发。",
    category: GameType.ActionRPG,
    tags: ["RPG", "回合制", "剧情", "多人"],
    releaseDate: "2023-08-03",
    developer: "Larian Studios",
    publisher: "Larian Studios",
  },
];

/**
 * 预定义游戏技能配置 (已废弃)
 * /
export const GAME_SKILL_CONFIGS: GameSkillConfig[] = [
  {
    id: "phasmophobia-skill-1",
    gameId: "phasmophobia",
    repo: "https://phasmophobia.fandom.com/wiki/",
    name: "Phasmophobia Wiki (Fandom)",
    description:
      "官方 Phasmophobia Wiki，包含所有鬼魂类型、证据、道具、地图等详细信息",
    version: "1.0.0",
    source: SkillSource.FandomWiki,
    status: SkillStatus.NotDownloaded,
    statistics: {
      totalEntries: 0,
      vectorCount: 0,
      storageSize: 0,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "elden-ring-skill-1",
    gameId: "elden-ring",
    repo: "https://eldenring.fandom.com/wiki/",
    name: "Elden Ring Wiki (Fandom)",
    description: "艾尔登法环完整攻略Wiki，包含Boss、装备、魔法、地图等",
    version: "1.0.0",
    source: SkillSource.FandomWiki,
    status: SkillStatus.NotDownloaded,
    statistics: {
      totalEntries: 0,
      vectorCount: 0,
      storageSize: 0,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  {
    id: "bg3-skill-1",
    gameId: "baldurs-gate-3",
    repo: "https://bg3.wiki/",
    name: "Baldur's Gate 3 Wiki",
    description: "博德之门3官方Wiki，包含职业、法术、任务、角色等",
    version: "1.0.0",
    source: SkillSource.CustomWeb,
    status: SkillStatus.NotDownloaded,
    statistics: {
      totalEntries: 0,
      vectorCount: 0,
      storageSize: 0,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

/**
 * 根据游戏ID获取游戏信息 (已废弃)
 * 请使用: import { getGameById } from '../../services/configService'
 * /
export const getGameById = (id: string): Game | undefined => {
  return GAMES.find((game) => game.id === id);
};

/**
 * 根据游戏ID获取技能配置列表 (已废弃)
 * 请使用: import { getSkillConfigsByGameId } from '../../services/configService'
 * /
export const getSkillConfigsByGameId = (gameId: string): GameSkillConfig[] => {
  return GAME_SKILL_CONFIGS.filter((config) => config.gameId === gameId);
};

/**
 * 根据游戏类型获取游戏列表 (已废弃)
 * /
export const getGamesByType = (type: GameType): Game[] => {
  return GAMES.filter((game) => game.category === type);
};

*/
