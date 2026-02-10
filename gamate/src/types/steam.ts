/**
 * Steam 用户类型定义
 */

/**
 * Steam 用户信息
 */
export interface SteamUser {
  /** Steam ID (64位) */
  steamid: string;
  /** 社区状态 (1=离线, 3=在线, etc) */
  communityvisibilitystate: number;
  /** 资料状态 (1=已设置) */
  profilestate: number;
  /** 显示名称 */
  personaname: string;
  /** 资料 URL */
  profileurl: string;
  /** 小头像 (32x32) */
  avatar: string;
  /** 中等头像 (64x64) */
  avatarmedium: string;
  /** 大头像 (184x184) */
  avatarfull: string;
  /** 最后离线时间戳 */
  lastlogoff?: number;
  /** 个人状态 (0=离线, 1=在线, 2=忙碌, etc) */
  personastate: number;
  /** 真实姓名 (如果公开) */
  realname?: string;
  /** 主群组 ID */
  primaryclanid?: string;
  /** 账号创建时间 */
  timecreated?: number;
  /** 国家代码 */
  loccountrycode?: string;
  /** 游戏 ID (如果正在游戏中) */
  gameid?: string;
  /** 游戏额外信息 */
  gameextrainfo?: string;
}

/**
 * Steam 游戏信息
 */
export interface OwnedGame {
  /** 应用 ID */
  appid: number;
  /** 游戏名称 */
  name: string;
  /** 总游戏时间（分钟） */
  playtime_forever: number;
  /** 最近2周游戏时间（分钟） */
  playtime_2weeks?: number;
  /** 图标 URL (32x32) */
  img_icon_url: string;
  /** Logo URL */
  img_logo_url: string;
  /** 是否有社区可见统计 */
  has_community_visible_stats?: boolean;
}

/**
 * Steam 游戏库响应
 */
export interface SteamLibraryResponse {
  /** 游戏列表 */
  games: OwnedGame[];
  /** 游戏总数 */
  game_count: number;
}

/**
 * Steam 登录状态
 */
export interface SteamLoginState {
  /** 是否已登录 */
  isLoggedIn: boolean;
  /** 当前用户 */
  user: SteamUser | null;
  /** 游戏库 */
  library: OwnedGame[];
  /** 是否正在加载 */
  isLoading: boolean;
  /** 错误信息 */
  error: string | null;
}

/**
 * Steam 配置数据（存储在 config.toml 中）
 */
export interface SteamUserData {
  /** Steam ID */
  steamid: string;
  /** 显示名称 */
  personaname: string;
  /** 资料 URL */
  profileurl: string;
  /** 头像 URL */
  avatar: string;
  /** 最后登录时间（Unix 时间戳） */
  last_login?: number;
}
