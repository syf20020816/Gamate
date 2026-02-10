import {
  Card,
  Row,
  Col,
  Typography,
  Space,
  Button,
  Tag,
  Steps,
  Alert,
} from "antd";
import {
  MessageCircle,
  Brain,
  Sparkles,
  CheckCircle,
  Circle,
  ArrowRight,
} from "lucide-react";
import { motion } from "framer-motion";
import { getGameById } from "../../services/configService";
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./styles.scss";

const { Title, Paragraph, Text } = Typography;

interface HomeProps {
  onNavigate?: (menu: string) => void;
}

const Home: React.FC<HomeProps> = ({ onNavigate }) => {
  const [selectedGames, setSelectedGames] = useState<any[]>([]);
  const [downloadedLibraries, setDownloadedLibraries] = useState<any[]>([]);
  const [hasSkillLibrary, setHasSkillLibrary] = useState(false);
  const [isVectorDBReady, setIsVectorDBReady] = useState(false);
  const [isLLMReady, setIsLLMReady] = useState(false);

  // 从后端加载用户选择的游戏
  useEffect(() => {
    const loadSelectedGames = async () => {
      try {
        const settings = await invoke<any>("get_app_settings");
        const selectedGameIds = settings.user?.selected_games || [];

        const games = await Promise.all(
          selectedGameIds.map((id: string) => getGameById(id)),
        );
        const validGames = games.filter(Boolean);
        setSelectedGames(validGames);
      } catch (error) {
        console.error("加载游戏配置失败:", error);
      }
    };
    loadSelectedGames();
  }, []);

  // 加载已下载的技能库
  useEffect(() => {
    const loadLibraries = async () => {
      try {
        const libraries = await invoke<any[]>("scan_downloaded_libraries");
        setDownloadedLibraries(libraries);
        setHasSkillLibrary(libraries.length > 0);
      } catch (error) {
        console.error("扫描技能库失败:", error);
      }
    };
    loadLibraries();
  }, []);

  // 检查系统状态（与 RightPanel 同步）
  useEffect(() => {
    const checkSystemStatus = async () => {
      try {
        // 检查向量库是否就绪
        const hasVectorDB = downloadedLibraries.length > 0;
        setIsVectorDBReady(hasVectorDB);

        // 检查 LLM 是否配置
        const settings = await invoke<any>("get_app_settings");
        const hasAPIKey =
          settings.ai_models?.multimodal?.api_key ||
          settings.ai_models?.multimodal?.provider === "local";
        setIsLLMReady(!!hasAPIKey);
      } catch (error) {
        console.error("检查系统状态失败:", error);
      }
    };

    checkSystemStatus();
  }, [downloadedLibraries]);

  // 计算当前步骤
  const getCurrentStep = () => {
    if (selectedGames.length === 0) return 0;
    if (!hasSkillLibrary) return 1;
    return 2;
  };

  // 获取下一步操作
  const getNextStepAction = () => {
    const step = getCurrentStep();
    switch (step) {
      case 0:
        return (
          <Button
            type="primary"
            block
            size="large"
            onClick={() => onNavigate?.("game-library")}
          >
            前往游戏库
          </Button>
        );
      case 1:
        return (
          <Button
            type="primary"
            block
            size="large"
            onClick={() => onNavigate?.("skill-database")}
          >
            前往技能库
          </Button>
        );
      case 2:
        return (
          <Button
            type="primary"
            block
            size="large"
            onClick={() => onNavigate?.("ai-assistant")}
          >
            开始 AI 对话
          </Button>
        );
      default:
        return null;
    }
  };

  const allStepsCompleted = getCurrentStep() >= 2;

  return (
    <div className="home-page">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* 欢迎区域 (Hero Section) */}
        <div className="hero-section">
          <Title
            level={1}
            style={{ display: "flex", alignItems: "center", gap: 12 }}
          >
            Gamate
          </Title>
          <Paragraph
            style={{
              marginBottom: 16,
            }}
          >
            AI 驱动的智能游戏陪玩助手
          </Paragraph>

          {/* 核心特性卡片 */}
          <Row gutter={16} style={{ marginBottom: 16, height: "max-content" }}>
            <Col span={8}>
              <Card size="small" style={{ textAlign: "center" }}>
                <MessageCircle
                  size={32}
                  style={{ color: "#1890ff", marginBottom: 12, height: "100%" }}
                />
                <Title level={5}>语音对话</Title>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  实时语音交互，如同真人陪玩
                </Text>
              </Card>
            </Col>
            <Col span={8}>
              <Card
                size="small"
                style={{ textAlign: "center", height: "100%" }}
              >
                <Brain
                  size={32}
                  style={{ color: "#52c41a", marginBottom: 12 }}
                />
                <Title level={5}>智能分析</Title>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  截图+RAG，精准游戏指导
                </Text>
              </Card>
            </Col>
            <Col span={8}>
              <Card
                size="small"
                style={{ textAlign: "center", height: "100%" }}
              >
                <Sparkles
                  size={32}
                  style={{ color: "#722ed1", marginBottom: 12 }}
                />
                <Title level={5}>直播模拟</Title>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  AI 虚拟观众，练习互动
                </Text>
              </Card>
            </Col>
          </Row>
        </div>

        {/* 主要内容区域 */}
        <Row gutter={16}>
          {/* 快速开始 */}
          <Col span={12}>
            <Card title="快速开始" style={{ height: "100%" }}>
              <Steps
                current={getCurrentStep()}
                direction="vertical"
                size="small"
                items={[
                  {
                    title: "添加游戏",
                    description: "从游戏库中选择你要玩的游戏",
                    status: selectedGames.length > 0 ? "finish" : "process",
                    icon:
                      selectedGames.length > 0 ? (
                        <CheckCircle size={16} color="#52c41a" />
                      ) : (
                        <Circle size={16} />
                      ),
                  },
                  {
                    title: "下载技能库",
                    description: "下载游戏 Wiki 知识库",
                    status: hasSkillLibrary
                      ? "finish"
                      : selectedGames.length > 0
                        ? "process"
                        : "wait",
                    icon: hasSkillLibrary ? (
                      <CheckCircle size={16} color="#52c41a" />
                    ) : (
                      <Circle size={16} />
                    ),
                  },
                  {
                    title: "开始对话",
                    description: "启动 AI 陪玩助手，开始游戏",
                    status: allStepsCompleted
                      ? "finish"
                      : hasSkillLibrary
                        ? "process"
                        : "wait",
                    icon: allStepsCompleted ? (
                      <CheckCircle size={16} color="#52c41a" />
                    ) : (
                      <Circle size={16} />
                    ),
                  },
                ]}
              />
              {!allStepsCompleted && (
                <div style={{ marginTop: 16 }}>{getNextStepAction()}</div>
              )}
              {allStepsCompleted && (
                <Alert
                  type="success"
                  message="一切就绪！"
                  description="你可以开始使用 AI 陪玩助手了"
                  style={{ marginTop: 16 }}
                  action={
                    <Button
                      type="primary"
                      onClick={() => onNavigate?.("ai-assistant")}
                    >
                      立即开始
                    </Button>
                  }
                />
              )}
            </Card>
          </Col>

          {/* 使用状态 */}
          <Col span={12}>
            <Card title="使用状态" style={{ height: "100%" }}>
              <Space
                direction="vertical"
                size="middle"
                style={{ width: "100%" }}
              >
                {/* 系统状态区 */}
                <div>
                  <Text
                    type="secondary"
                    style={{ fontSize: 13, display: "block", marginBottom: 8 }}
                  >
                    系统状态
                  </Text>
                  <Space
                    direction="vertical"
                    size="small"
                    style={{ width: "100%" }}
                  >
                    <div className="stat-item">
                      <Space
                        style={{
                          width: "100%",
                          justifyContent: "space-between",
                        }}
                      >
                        <Text type="secondary">已配置游戏</Text>
                        <Text strong>{selectedGames.length} 个</Text>
                      </Space>
                    </div>

                    <div className="stat-item">
                      <Space
                        style={{
                          width: "100%",
                          justifyContent: "space-between",
                        }}
                      >
                        <Text type="secondary">已下载技能库</Text>
                        <Text strong>{downloadedLibraries.length} 个</Text>
                      </Space>
                    </div>

                    <div className="stat-item">
                      <Space
                        style={{
                          width: "100%",
                          justifyContent: "space-between",
                        }}
                      >
                        <Text type="secondary">向量库</Text>
                        <Tag color={isVectorDBReady ? "green" : "red"}>
                          {isVectorDBReady ? "就绪" : "未就绪"}
                        </Tag>
                      </Space>
                    </div>

                    <div className="stat-item">
                      <Space
                        style={{
                          width: "100%",
                          justifyContent: "space-between",
                        }}
                      >
                        <Text type="secondary">多模态 AI</Text>
                        <Tag color={isLLMReady ? "green" : "orange"}>
                          {isLLMReady ? "就绪" : "未配置"}
                        </Tag>
                      </Space>
                    </div>
                  </Space>
                </div>

                {/* 技能库概况区 */}
                {downloadedLibraries.length > 0 && (
                  <div
                    style={{
                      paddingTop: 12,
                      borderTop: "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    <Text
                      type="secondary"
                      style={{
                        fontSize: 13,
                        display: "block",
                        marginBottom: 8,
                      }}
                    >
                      技能库概况
                    </Text>
                    <Space
                      direction="vertical"
                      size="small"
                      style={{ width: "100%" }}
                    >
                      <div className="stat-item">
                        <Space
                          style={{
                            width: "100%",
                            justifyContent: "space-between",
                          }}
                        >
                          <Text type="secondary">已下载游戏</Text>
                          <Text strong>
                            {
                              new Set(
                                downloadedLibraries.map(
                                  (lib: any) => lib.gameId,
                                ),
                              ).size
                            }{" "}
                            个
                          </Text>
                        </Space>
                      </div>

                      <div className="stat-item">
                        <Space
                          style={{
                            width: "100%",
                            justifyContent: "space-between",
                          }}
                        >
                          <Text type="secondary">技能库版本</Text>
                          <Text strong>{downloadedLibraries.length} 个</Text>
                        </Space>
                      </div>

                      <div className="stat-item">
                        <Space
                          style={{
                            width: "100%",
                            justifyContent: "space-between",
                          }}
                        >
                          <Text type="secondary">活跃版本</Text>
                          <Text strong>
                            {
                              downloadedLibraries.filter(
                                (lib: any) => lib.status === "active",
                              ).length
                            }{" "}
                            个
                          </Text>
                        </Space>
                      </div>

                      <div className="stat-item">
                        <Space
                          style={{
                            width: "100%",
                            justifyContent: "space-between",
                          }}
                        >
                          <Text type="secondary">总存储大小</Text>
                          <Text strong>
                            {(() => {
                              const totalBytes = downloadedLibraries.reduce(
                                (sum: number, lib: any) =>
                                  sum + (lib.storageSize || 0),
                                0,
                              );
                              if (totalBytes === 0) return "0 B";
                              const k = 1024;
                              const sizes = ["B", "KB", "MB", "GB"];
                              const i = Math.floor(
                                Math.log(totalBytes) / Math.log(k),
                              );
                              return `${(totalBytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
                            })()}
                          </Text>
                        </Space>
                      </div>
                    </Space>
                  </div>
                )}
              </Space>
            </Card>
          </Col>
        </Row>

        {/* 我的游戏 */}
        {selectedGames.length > 0 && (
          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col span={24}>
              <Card
                title="我的游戏"
                extra={
                  <Button
                    type="link"
                    icon={<ArrowRight size={16} />}
                    onClick={() => onNavigate?.("game-library")}
                  >
                    管理游戏
                  </Button>
                }
              >
                <Row gutter={16}>
                  {selectedGames.map((game) => (
                    <Col span={8} key={game!.id}>
                      <Card
                        hoverable
                        size="small"
                        styles={{
                          body: { padding: 16 },
                        }}
                      >
                        <div style={{ textAlign: "center" }}>
                          <Title level={5} style={{ marginBottom: 8 }}>
                            {game!.name}
                          </Title>
                          <Space direction="vertical" style={{ width: "100%" }}>
                            <Space>
                              <Tag>{game!.category}</Tag>
                              {downloadedLibraries.some(
                                (lib) => lib.gameId === game!.id,
                              ) && <Tag color="green">已就绪</Tag>}
                            </Space>
                            <Button
                              type="primary"
                              block
                              onClick={() => {
                                onNavigate?.("ai-assistant");
                                // 切换到该游戏
                                setTimeout(async () => {
                                  try {
                                    const { emit } =
                                      await import("@tauri-apps/api/event");
                                    await emit("game-changed", {
                                      gameId: game!.id,
                                    });
                                  } catch (error) {
                                    console.error("切换游戏失败:", error);
                                  }
                                }, 100);
                              }}
                            >
                              启动 AI 助手
                            </Button>
                          </Space>
                        </div>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </Card>
            </Col>
          </Row>
        )}
      </motion.div>
    </div>
  );
};

export default Home;
