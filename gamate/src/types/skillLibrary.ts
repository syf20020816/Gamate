/**
 * 技能库配置类型
 */
export interface SkillLibraryConfig {
  storageBasePath: string; // 技能库主存储目录
  maxVersionsToKeep: number; // 保留的历史版本数量
  autoUpdate: boolean; // 是否自动更新
  updateCheckInterval: number; // 更新检查间隔（小时）
}

/**
 * 已下载的技能库实例
 */
export interface DownloadedSkillLibrary {
  id: string;
  gameId: string;
  gameName: string;
  skillConfigId: string;
  skillConfigName: string;
  version: string;
  timestamp: number; // Unix 时间戳（秒）
  storagePath: string; // 存储路径
  storageSize: number; // 存储大小（字节）
  downloadedAt: string; // 下载时间 ISO 格式
  statistics: {
    totalEntries: number;
    vectorCount: number;
    lastUsed?: string;
  };
  status: 'active' | 'outdated' | 'error';
}
