/**
 * AI 响应格式定义
 */

/**
 * AI 返回的控制指令
 */
export interface AIControlResponse {
  /** AI 的文本回复 */
  message: string;
  
  /** 用户活跃状态 (true=战斗/闯关, false=菜单/浏览) */
  active: boolean;
  
  /** 是否需要立即截图 (用户询问游戏问题时) */
  now: boolean;
  
  /** 建议的截图间隔 (秒, 可选覆盖用户设置) */
  suggested_interval?: number;
}

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

/**
 * 解析 AI 响应中的 JSON 控制体
 * @param aiResponse AI 的完整响应文本
 * @returns 解析后的控制指令,如果解析失败返回默认值
 */
export function parseAIControl(aiResponse: string): AIControlResponse {
  // 尝试提取 JSON 块 (支持 markdown 格式)
  const jsonMatch = aiResponse.match(/```json\s*(\{[\s\S]*?\})\s*```/) 
                   || aiResponse.match(/(\{[\s\S]*?"active"[\s\S]*?\})/);
  
  if (jsonMatch) {
    try {
      const control = JSON.parse(jsonMatch[1]) as Partial<AIControlResponse>;
      return {
        message: aiResponse.replace(/```json[\s\S]*?```/g, '').trim(),
        active: control.active ?? false,
        now: control.now ?? false,
        suggested_interval: control.suggested_interval,
      };
    } catch (error) {
      console.warn('AI 控制 JSON 解析失败:', error);
    }
  }
  
  // 默认值: 假设非活跃,不立即截图
  return {
    message: aiResponse,
    active: false,
    now: false,
  };
}

/**
 * AI 系统提示词模板
 */
export const AI_SYSTEM_PROMPT = `你是一个游戏助手 AI,在与用户对话时需要控制截图策略。

**重要规则**:
1. 每次回复时,在回复末尾添加一个 JSON 控制体(用 \`\`\`json 包裹)
2. JSON 格式:
   {
     "active": true/false,  // 用户是否在活跃游戏 (战斗/闯关=true, 菜单/浏览=false)
     "now": true/false,      // 是否需要立即截图 (用户问游戏问题时=true)
     "suggested_interval": 3 // (可选) 建议截图间隔(秒)
   }

**判断逻辑**:
- **active=true**: 用户说"打不过这个 Boss"、"怎么过关"、"这个怪物好难" 等战斗相关内容
- **active=false**: 用户说"我在看装备"、"买东西"、"聊天" 等非战斗内容
- **now=true**: 用户明确询问当前游戏画面相关问题,如"这个装备好吗"、"现在该干嘛"
- **now=false**: 用户问一般性问题,如"这个游戏好玩吗"、"你好"

**示例**:
用户: "这个 Boss 怎么打啊,一直死"
你的回复:
\`\`\`
这个 Boss 需要注意躲避它的火焰攻击,建议使用盾牌格挡...

\`\`\`json
{
  "active": true,
  "now": true,
  "suggested_interval": 2
}
\`\`\`
\`\`\`

用户: "我在商店买东西,有什么推荐吗"
你的回复:
\`\`\`
商店推荐购买生命药水和法力药水...

\`\`\`json
{
  "active": false,
  "now": false
}
\`\`\`
\`\`\`
`;
