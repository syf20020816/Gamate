import {
  Layout,
  Card,
  Typography,
  Progress,
  Button,
  Space,
  Divider,
  Select,
  Switch,
  message,
} from "antd";
import { Database, Zap, MessageCircle, Camera, Mic } from "lucide-react";
import { motion } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { getGameById } from "../../services/configService";
import { useSkillLibraryStore } from "../../stores/skillLibraryStore";
import { useAIAssistantStore } from "../../stores/aiAssistantStore";
import { useState, useEffect } from "react";
import "./styles.scss";

const { Sider } = Layout;
const { Title, Text } = Typography;

interface RightPanelProps {
  onMenuChange?: (key: string) => void;
}

const RightPanel: React.FC<RightPanelProps> = ({ onMenuChange }) => {
  const { downloadedLibraries } = useSkillLibraryStore();
  const { setCurrentGame, sendMessage } = useAIAssistantStore();
  
  const [selectedGames, setSelectedGames] = useState<any[]>([]);
  const [availableGames, setAvailableGames] = useState<any[]>([]);
  const [aiSelectedGame, setAiSelectedGame] = useState<string>("");
  const [useScreenshot, setUseScreenshot] = useState(true); // 截图开关

  // ✅ 从后端加载用户选择的游戏
  useEffect(() => {
    const loadSelectedGames = async () => {
      try {
        const settings = await invoke<any>('get_app_settings');
        const selectedGameIds = settings.user?.selected_games || [];
        
        const games = await Promise.all(
          selectedGameIds.map((id: string) => getGameById(id))
        );
        const validGames = games.filter(Boolean);
        setSelectedGames(validGames);
      } catch (error) {
        console.error('加载游戏配置失败:', error);
      }
    };
    loadSelectedGames();
  }, []);

  // ✅ 过滤出有技能库的游戏
  useEffect(() => {
    const gamesWithSkills = [...new Set(downloadedLibraries.map((lib) => lib.gameId))];
    const available = selectedGames.filter((game) =>
      gamesWithSkills.includes(game.id)
    );
    setAvailableGames(available);
  }, [selectedGames, downloadedLibraries]);

  // 系统统计数据
  const systemStats = {
    totalGames: selectedGames.length,
    activeSkills: selectedGames.length * 50,
    recognitionRate: 89,
    uptime: "0h 0m",
  };

  // AI 模型名称(可以从配置中读取)
  const aiModelName = "Qwen 2.5 VL 7B";

  const handleStartAI = async () => {
    if (!aiSelectedGame) {
      message.warning("请先选择游戏");
      return;
    }

    // 设置当前游戏到AI助手store
    setCurrentGame(aiSelectedGame);

    // 跳转到AI陪玩助手页面
    if (onMenuChange) {
      onMenuChange("ai-assistant");
    }

    // 延迟一点让页面完成跳转
    setTimeout(async () => {
      try {
        let screenshot: string | undefined = undefined;
        const welcomeMessage = "嘿！来一起玩吧！现在游戏里什么情况？";

        console.log("🚀 [RightPanel] 启动 AI 对话");
        console.log("📷 [RightPanel] 截图启用状态:", useScreenshot);
        console.log("🎮 [RightPanel] 当前游戏:", aiSelectedGame);

        // 如果启用截图,先执行截图
        if (useScreenshot) {
          try {
            console.log("📸 [RightPanel] 开始截图...");
            message.loading({ content: "正在截图...", key: "screenshot" });
            
            // 调用截图命令
            const capturedScreenshot = await invoke<string>("capture_screenshot");
            screenshot = capturedScreenshot;
            
            message.success({ content: "截图完成", key: "screenshot", duration: 1 });
            console.log("✅ [RightPanel] 截图成功,长度:", screenshot?.length);
          } catch (error) {
            console.error("❌ [RightPanel] 截图失败:", error);
            message.warning({ 
              content: "截图失败,将以纯文本模式发送", 
              key: "screenshot",
              duration: 2 
            });
          }
        }

        // 添加用户消息
        sendMessage(welcomeMessage, screenshot);

        // 调用后端 RAG 生成 AI 回复
        console.log("🤖 [RightPanel] 准备调用 generate_ai_response");
        message.loading({ content: "AI 正在思考...", key: "ai-thinking" });

        const response = await invoke<{
          content: string;
          wiki_references?: Array<{
            title: string;
            content: string;
            score: number;
          }>;
        }>("generate_ai_response", {
          message: welcomeMessage,
          gameId: aiSelectedGame,
          screenshot,
        });

        console.log("✅ [RightPanel] AI 回复成功");
        message.success({ content: "AI 已回复", key: "ai-thinking", duration: 1 });
        
        // 添加 AI 回复
        const { receiveAIResponse } = useAIAssistantStore.getState();
        receiveAIResponse(response.content, response.wiki_references);

      } catch (error) {
        console.error("❌ [RightPanel] AI 回复失败:", error);
        message.error({ 
          content: `AI 回复失败: ${error}`, 
          key: "ai-thinking",
          duration: 3 
        });

        // Fallback: 显示错误信息
        const { receiveAIResponse } = useAIAssistantStore.getState();
        receiveAIResponse(
          `抱歉,AI 助手暂时无法回复。错误信息: ${error}\n\n请检查:\n1. 多模态模型是否已启用\n2. API Key 是否配置正确 (本地 Ollama 不需要)\n3. 网络连接是否正常\n4. 向量数据库是否已导入`,
          [],
        );
      }
    }, 300); // 延迟 300ms 让页面跳转完成
  };

  return (
    <Sider width={380} className="right-panel" theme="dark">
      <div className="panel-content">
        {/* 系统状态 */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="status-card" size="small">
            <Title level={5}>
              <Zap size={20} style={{ marginRight: 8 }} />
              系统状态
            </Title>
            <Space direction="vertical" size="middle" style={{ width: "100%" }}>
              <div className="stat-item">
                <Space
                  style={{ width: "100%", justifyContent: "space-between" }}
                >
                  <Text type="secondary">已配置游戏</Text>
                  <Text strong>{systemStats.totalGames}</Text>
                </Space>
              </div>
              <div className="stat-item">
                <Space
                  style={{ width: "100%", justifyContent: "space-between" }}
                >
                  <Text type="secondary">活跃技能数</Text>
                  <Text strong>{systemStats.activeSkills}</Text>
                </Space>
              </div>
              <div className="stat-item">
                <Space
                  style={{ width: "100%", justifyContent: "space-between" }}
                >
                  <Text type="secondary">识别准确率</Text>
                  <Text strong>{systemStats.recognitionRate}%</Text>
                </Space>
                <Progress
                  percent={systemStats.recognitionRate}
                  size="small"
                  strokeColor="#52c41a"
                  showInfo={false}
                />
              </div>
              <div className="stat-item">
                <Space
                  style={{ width: "100%", justifyContent: "space-between" }}
                >
                  <Text type="secondary">运行时长</Text>
                  <Text strong>{systemStats.uptime}</Text>
                </Space>
              </div>
            </Space>
          </Card>
        </motion.div>

        <Divider style={{ margin: "16px 0" }} />

        {/* AI 陪玩助手 */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card className="ai-assistant-card" size="small">
            <Title level={5}>
              <MessageCircle size={20} style={{ marginRight: 8 }} />
              AI 陪玩助手
            </Title>

            <Space direction="vertical" size="middle" style={{ width: "100%" }}>
              {/* AI 模型信息 */}
              <div className="ai-model-info">
                <Text type="secondary" style={{ fontSize: 12 }}>
                  当前模型
                </Text>
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    marginTop: "4px",
                  }}
                >
                  <Text strong>{aiModelName}</Text>
                </div>
              </div>

              {/* 游戏选择 */}
              <div className="game-selector">
                <Text type="secondary" style={{ fontSize: 12 }}>
                  选择游戏
                </Text>
                <Select
                  value={aiSelectedGame}
                  onChange={setAiSelectedGame}
                  style={{ width: "100%", marginTop: "4px" }}
                  placeholder="请选择游戏"
                  size="large"
                >
                  {availableGames.map((game) => (
                    <Select.Option key={game!.id} value={game!.id}>
                      {game!.name}
                    </Select.Option>
                  ))}
                </Select>
              </div>

              {/* 截图开关 */}
              <div className="screenshot-toggle">
                <Space style={{ width: "100%", justifyContent: "space-between" }}>
                  <Space>
                    <Camera size={16} />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      附加截图
                    </Text>
                  </Space>
                  <Switch
                    checked={useScreenshot}
                    onChange={setUseScreenshot}
                    checkedChildren="开"
                    unCheckedChildren="关"
                  />
                </Space>
                {useScreenshot && (
                  <Text type="secondary" style={{ fontSize: 11, display: "block", marginTop: 4 }}>
                    将在进入对话前自动截图
                  </Text>
                )}
              </div>

              {/* 开始对话按钮 */}
              <Button
                type="primary"
                size="large"
                block
                icon={<Mic size={20} />}
                disabled={!aiSelectedGame}
                onClick={handleStartAI}
              >
                开始对话
              </Button>
            </Space>
          </Card>
        </motion.div>

        <Divider style={{ margin: "16px 0" }} />

        {/* 技能库统计 */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <Card className="skill-card" size="small">
            <Title level={5}>
              <Database size={20} style={{ marginRight: 8 }} />
              技能库概况
            </Title>
            <Space direction="vertical" size="small" style={{ width: "100%" }}>
              <div className="skill-stat">
                <Text type="secondary">向量数据库</Text>
                <Progress percent={67} size="small" format={() => "3.2 GB"} />
              </div>
              <div className="skill-stat">
                <Text type="secondary">Wiki 条目</Text>
                <Progress
                  percent={85}
                  size="small"
                  strokeColor="#1890ff"
                  format={() => "8,542"}
                />
              </div>
              <div className="skill-stat">
                <Text type="secondary">缓存命中率</Text>
                <Progress
                  percent={92}
                  size="small"
                  strokeColor="#722ed1"
                  format={() => "92%"}
                />
              </div>
            </Space>
            <Button type="primary" ghost block style={{ marginTop: 12 }}>
              管理技能库
            </Button>
          </Card>
        </motion.div>
      </div>
    </Sider>
  );
};

export default RightPanel;
