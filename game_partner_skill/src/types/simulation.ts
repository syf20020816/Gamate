/** 场景类型 */
export type SceneType = 'livestream' | 'pvp_match' | 'coop_team';

/** 频率等级 */
export type FrequencyLevel = 'high' | 'medium' | 'low';

/** AI 性格类型 (复用现有) */
export type AIPersonality = 
  | 'sunnyou_male'   // 损友男
  | 'funny_female'   // 搞笑女
  | 'kobe'           // Kobe
  | 'sweet_girl'     // 甜妹
  | 'trump';         // 特朗普

/** 直播间配置 */
export interface LivestreamConfig {
  /** 在线人数 */
  onlineUsers: number;
  
  /** 直播间名称 */
  roomName: string;
  
  /** 直播间描述 */
  roomDescription: string;
  
  /** 弹幕频率 */
  danmakuFrequency: FrequencyLevel;
  
  /** 礼物频率 */
  giftFrequency: FrequencyLevel;
  
  /** 是否可上麦 */
  allowMic: boolean;
}

/** AI 员工配置 */
export interface AIEmployee {
  /** 唯一 ID */
  id: string;
  
  /** AI 性格 */
  personality: AIPersonality;
  
  /** 互动频率 */
  interactionFrequency: FrequencyLevel;
  
  /** AI 昵称 */
  nickname: string;
}

/** 模拟场景配置 */
export interface SimulationConfig {
  /** 场景类型 */
  sceneType: SceneType;
  
  /** 直播间配置 (当 sceneType = 'livestream' 时) */
  livestream?: LivestreamConfig;
  
  /** AI 员工列表 */
  employees: AIEmployee[];
  
  /** 是否正在运行 */
  isRunning: boolean;
}
