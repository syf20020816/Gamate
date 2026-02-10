/**
 * 游戏配置服务
 * 从后端加载配置，替代硬编码数据
 */

import { invoke } from '@tauri-apps/api/core';
import { Game, GameSkillConfig, SkillSource, SkillStatus } from '../types/game';

interface GameConfigResponse {
  games: Array<{
    id: string;
    name: string;
    name_en?: string;
    icon: string;
    banner?: string;
    description: string;
    category: string;
    tags: string[];
    release_date?: string;
    developer?: string;
    publisher?: string;
    skill_configs: Array<{
      id: string;
      name: string;
      description: string;
      repo: string;
      version: string;
      source_type: string;
      max_pages?: number;
      max_depth?: number;
      request_delay_ms?: number;
    }>;
  }>;
}

/**
 * 从后端加载游戏配置
 */
export async function loadGamesConfig(): Promise<{
  games: Game[];
  skillConfigs: GameSkillConfig[];
}> {
  try {
    const config = await invoke<GameConfigResponse>('get_games_config');

    const games: Game[] = config.games.map((g) => ({
      id: g.id,
      name: g.name,
      nameEn: g.name_en,
      icon: g.icon,
      banner: g.banner,
      description: g.description,
      category: g.category as any,
      tags: g.tags,
      releaseDate: g.release_date,
      developer: g.developer,
      publisher: g.publisher,
    }));

    const skillConfigs: GameSkillConfig[] = [];
    for (const game of config.games) {
      for (const skill of game.skill_configs) {
        skillConfigs.push({
          id: skill.id,
          gameId: game.id,
          repo: skill.repo,
          name: skill.name,
          description: skill.description,
          version: skill.version,
          source: skill.source_type as SkillSource,
          status: SkillStatus.NotDownloaded,
          statistics: {
            totalEntries: 0,
            vectorCount: 0,
            storageSize: 0,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    return { games, skillConfigs };
  } catch (error) {
    console.error('加载游戏配置失败:', error);
    // 降级到默认配置
    return { games: [], skillConfigs: [] };
  }
}

/**
 * 从配置获取游戏列表
 */
export async function getGames(): Promise<Game[]> {
  const { games } = await loadGamesConfig();
  return games;
}

/**
 * 从配置获取技能配置列表
 */
export async function getSkillConfigs(): Promise<GameSkillConfig[]> {
  const { skillConfigs } = await loadGamesConfig();
  return skillConfigs;
}

/**
 * 根据游戏 ID 获取技能配置
 */
export async function getSkillConfigsByGameId(gameId: string): Promise<GameSkillConfig[]> {
  const { skillConfigs } = await loadGamesConfig();
  return skillConfigs.filter((sc) => sc.gameId === gameId);
}

/**
 * 根据 ID 获取游戏
 */
export async function getGameById(gameId: string): Promise<Game | undefined> {
  const { games } = await loadGamesConfig();
  return games.find((g) => g.id === gameId);
}
