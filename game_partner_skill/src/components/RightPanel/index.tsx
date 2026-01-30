import {
  Layout,
  Card,
  Typography,
  Progress,
  Button,
  Space,
  Divider,
  Select,
} from "antd";
import { Database, Zap, MessageCircle, PlayCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useUserStore } from "../../stores/userStore";
import { getGameById } from "../../data/games";
import { useSkillLibraryStore } from "../../stores/skillLibraryStore";
import { useAIAssistantStore } from "../../stores/aiAssistantStore";
import { useState } from "react";
import "./styles.scss";

const { Sider } = Layout;
const { Title, Text } = Typography;

interface RightPanelProps {
  onMenuChange?: (key: string) => void;
}

const RightPanel: React.FC<RightPanelProps> = ({ onMenuChange }) => {
  const { user } = useUserStore();
  const { downloadedLibraries } = useSkillLibraryStore();
  const { setCurrentGame } = useAIAssistantStore();
  const selectedGames =
    user?.config.selectedGames.map((id) => getGameById(id)).filter(Boolean) ||
    [];

  const [aiSelectedGame, setAiSelectedGame] = useState<string>("");

  // 系统统计数据
  const systemStats = {
    totalGames: selectedGames.length,
    activeSkills: selectedGames.length * 50,
    recognitionRate: 89,
    uptime: "0h 0m",
  };

  // 获取已下载技能库的游戏列表
  const gamesWithSkills = [
    ...new Set(downloadedLibraries.map((lib) => lib.gameId)),
  ];
  const availableGames = selectedGames.filter((game) =>
    gamesWithSkills.includes(game!.id),
  );

  // AI 模型名称(可以从配置中读取)
  const aiModelName = "Qwen 2.5 VL 7B";

  const handleStartAI = () => {
    if (!aiSelectedGame) {
      return;
    }

    // 设置当前游戏到AI助手store
    setCurrentGame(aiSelectedGame);

    // 跳转到AI陪玩助手页面
    if (onMenuChange) {
      onMenuChange("ai-assistant");
    }
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

              {/* 开始对话按钮 */}
              <Button
                type="primary"
                size="large"
                block
                icon={<PlayCircle size={18} />}
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
