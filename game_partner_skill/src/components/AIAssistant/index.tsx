/**
 * AI 助手组件示例
 * 演示如何使用 AI 控制截图策略
 */
import { useState } from 'react';
import { Card, Input, Button, Space, Typography, Tag } from 'antd';
import { Send } from 'lucide-react';
import { parseAIControl, AI_SYSTEM_PROMPT } from '../../types/ai';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

const AIAssistantDemo: React.FC = () => {
  const [userInput, setUserInput] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [lastControl, setLastControl] = useState<{ active: boolean; now: boolean } | null>(null);

  /**
   * 模拟 AI 响应 (实际项目中调用 OpenAI API)
   */
  const handleSend = async () => {
    if (!userInput.trim()) return;

    // 模拟 AI 响应
    const mockResponse = generateMockAIResponse(userInput);
    setAiResponse(mockResponse);

    // 解析控制指令
    const control = parseAIControl(mockResponse);
    setLastControl({ active: control.active, now: control.now });

    // 触发截图控制事件
    const event = new CustomEvent('ai-control', {
      detail: {
        active: control.active,
        now: control.now,
        suggested_interval: control.suggested_interval,
      },
    });
    window.dispatchEvent(event);
  };

  return (
    <Card title="AI 助手 (演示)" style={{ marginTop: 16}}>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            💡 系统提示词 (已配置):
          </Text>
          <Paragraph 
            style={{ 
              fontSize: 11, 
              background: '#f5f5f5', 
              padding: 8, 
              borderRadius: 4,
              maxHeight: 150,
              overflow: 'auto',
            }}
          >
            {AI_SYSTEM_PROMPT.substring(0, 200)}...
          </Paragraph>
        </div>

        <div>
          <Text strong>用户消息:</Text>
          <TextArea
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="试试输入: '这个 Boss 怎么打?' 或 '我在商店看装备'"
            rows={3}
            style={{ marginTop: 8 }}
          />
        </div>

        <Button type="primary" icon={<Send size={16} />} onClick={handleSend} block>
          发送给 AI
        </Button>

        {aiResponse && (
          <div>
            <Text strong>AI 响应:</Text>
            <Paragraph 
              style={{ 
                background: '#e6f7ff', 
                padding: 12, 
                borderRadius: 6,
                marginTop: 8,
                whiteSpace: 'pre-wrap',
              }}
            >
              {aiResponse}
            </Paragraph>

            {lastControl && (
              <Space>
                <Tag color={lastControl.active ? 'green' : 'blue'}>
                  {lastControl.active ? '活跃模式' : '闲置模式'}
                </Tag>
                <Tag color={lastControl.now ? 'orange' : 'default'}>
                  {lastControl.now ? '立即截图 ⚡' : '定时截图'}
                </Tag>
              </Space>
            )}
          </div>
        )}
      </Space>
    </Card>
  );
};

/**
 * 生成模拟 AI 响应 (仅用于演示)
 */
function generateMockAIResponse(userInput: string): string {
  const input = userInput.toLowerCase();

  // 战斗/闯关相关
  if (input.includes('boss') || input.includes('打') || input.includes('怪') || input.includes('难')) {
    return `这个敌人确实有一定难度,建议注意以下几点:
1. 观察它的攻击节奏
2. 及时躲避红色预警区域
3. 使用合适的技能组合

\`\`\`json
{
  "active": true,
  "now": true,
  "suggested_interval": 2
}
\`\`\``;
  }

  // 菜单/浏览相关
  if (input.includes('装备') || input.includes('商店') || input.includes('买') || input.includes('看')) {
    return `在商店选购装备时,建议优先考虑:
- 攻击力提升的武器
- 增加生存能力的护甲
- 性价比高的消耗品

\`\`\`json
{
  "active": false,
  "now": false
}
\`\`\``;
  }

  // 一般性问题
  return `收到你的消息,有什么需要帮助的吗?

\`\`\`json
{
  "active": false,
  "now": false
}
\`\`\``;
}

export default AIAssistantDemo;
