/**
 * Steam 服务 - 封装所有 Steam 相关的 Tauri 命令
 */

import { invoke } from '@tauri-apps/api/core';
import type { SteamUser, OwnedGame } from '../types/steam';

/**
 * Steam 服务类
 */
export class SteamService {
  /**
   * 检查 Steam 功能是否可用
   */
  static async isAvailable(): Promise<boolean> {
    try {
      return await invoke<boolean>('is_steam_available');
    } catch (error) {
      console.error('检查 Steam 可用性失败:', error);
      return false;
    }
  }

  /**
   * 生成 Steam 登录 URL
   * @param returnUrl 回调 URL
   */
  static async generateLoginUrl(returnUrl: string): Promise<string> {
    return await invoke<string>('generate_steam_login_url', { returnUrl });
  }

  /**
   * 处理 Steam 登录回调
   * @param callbackUrl 完整的回调 URL（包含 Steam 返回的参数）
   */
  static async handleCallback(callbackUrl: string): Promise<SteamUser> {
    return await invoke<SteamUser>('handle_steam_callback', { callbackUrl });
  }

  /**
   * 获取当前登录的 Steam 用户
   */
  static async getCurrentUser(): Promise<SteamUser | null> {
    return await invoke<SteamUser | null>('get_current_steam_user');
  }

  /**
   * 从配置文件加载 Steam 用户（应用启动时调用）
   */
  static async loadUserFromConfig(): Promise<SteamUser | null> {
    return await invoke<SteamUser | null>('load_steam_user_from_config');
  }

  /**
   * 获取用户的 Steam 游戏库
   * @param includeFreeGames 是否包含免费游戏
   */
  static async fetchLibrary(includeFreeGames: boolean = false): Promise<OwnedGame[]> {
    return await invoke<OwnedGame[]>('fetch_steam_library', { 
      includeFreeGames 
    });
  }

  /**
   * 获取用户最近玩过的游戏
   * @param count 获取数量（默认 10）
   */
  static async fetchRecentlyPlayed(count: number = 10): Promise<OwnedGame[]> {
    return await invoke<OwnedGame[]>('fetch_recently_played_games', { count });
  }

  /**
   * 获取已缓存的游戏库（不发起 API 请求）
   */
  static async getCachedLibrary(): Promise<OwnedGame[]> {
    return await invoke<OwnedGame[]>('get_cached_steam_library');
  }

  /**
   * Steam 登出
   */
  static async logout(): Promise<void> {
    await invoke('steam_logout');
  }

  /**
   * 验证 Steam 登录（检查回调 URL 是否有效）
   * @param callbackUrl 回调 URL
   */
  static async verifyLogin(callbackUrl: string): Promise<string> {
    return await invoke<string>('verify_steam_login', { callbackUrl });
  }

  /**
   * Steam 登录 - 在当前窗口跳转
   * @returns Promise 在回调页面处理后 resolve
   */
  static async loginWithRedirect(): Promise<void> {
    // 保存当前路径，登录后返回
    const returnPath = window.location.pathname;
    sessionStorage.setItem('steam_return_path', returnPath);
    
    // 生成回调 URL
    const returnUrl = `${window.location.origin}/auth/steam/callback`;
    
    // 获取登录 URL
    const loginUrl = await this.generateLoginUrl(returnUrl);
    
    // 直接跳转到 Steam 登录页面
    window.location.href = loginUrl;
  }

  /**
   * 格式化游戏时间
   * @param minutes 游戏时间（分钟）
   */
  static formatPlaytime(minutes: number): string {
    if (minutes === 0) return '未游玩';
    
    const hours = Math.floor(minutes / 60);
    if (hours < 1) return `${minutes} 分钟`;
    if (hours < 100) return `${hours} 小时`;
    
    return `${hours.toLocaleString()} 小时`;
  }

  /**
   * 获取游戏图标 URL
   * @param appId 应用 ID
   * @param iconHash 图标哈希
   */
  static getGameIconUrl(appId: number, iconHash: string): string {
    if (!iconHash) return '';
    return `https://media.steampowered.com/steamcommunity/public/images/apps/${appId}/${iconHash}.jpg`;
  }

  /**
   * 获取游戏 Logo URL
   * @param appId 应用 ID
   * @param logoHash Logo 哈希
   */
  static getGameLogoUrl(appId: number, logoHash: string): string {
    if (!logoHash) return '';
    return `https://media.steampowered.com/steamcommunity/public/images/apps/${appId}/${logoHash}.jpg`;
  }

  /**
   * 获取游戏 Header 图片 URL
   * @param appId 应用 ID
   */
  static getGameHeaderUrl(appId: number): string {
    return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`;
  }

  /**
   * 获取 Steam 商店页面 URL
   * @param appId 应用 ID
   */
  static getStoreUrl(appId: number): string {
    return `https://store.steampowered.com/app/${appId}`;
  }
}

export default SteamService;
