/**
 * AI 响应格式定义
 */

/**
 * 截图策略配置
 */
export interface CaptureStrategy {
  /** 用户设置的活跃期间隔 (1-15s) */
  activeInterval: number;
  
  /** 非活跃期固定间隔 (15s) */
  idleInterval: number;
  
  /** 当前是否处于活跃状态 (由 AI 判断) */
  isActive: boolean;
  
  /** 是否需要立即截图 (由 AI 触发) */
  needImmediateCapture: boolean;
}
