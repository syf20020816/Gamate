import {
  Layout,
  Card,
  Typography,
  Button,
  Space,
  Divider,
  message,
  Tag,
} from "antd";
import { Database, Zap, Mic, PlayCircle, Activity } from "lucide-react";
import { motion } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { useState, useEffect } from "react";
import SteamUserCard from "../SteamUserCard";
import "./styles.scss";
import { VERSION } from "../../utils/version";

const { Sider } = Layout;
const { Title, Text } = Typography;

interface RightPanelProps {
  onMenuChange?: (key: string) => void;
}

const RightPanel: React.FC<RightPanelProps> = ({ onMenuChange }) => {
  const [selectedGames, setSelectedGames] = useState<any[]>([]);
  const [downloadedLibraries, setDownloadedLibraries] = useState<any[]>([]);
  const [isVectorDBReady, setIsVectorDBReady] = useState(false);
  const [isLLMReady, setIsLLMReady] = useState(false);

  // 从后端加载用户选择的游戏
  useEffect(() => {
    const loadSelectedGames = async () => {
      try {
        const settings = await invoke<any>('get_app_settings');
        const selectedGameIds = settings.user?.selected_games || [];
        setSelectedGames(selectedGameIds);
      } catch (error) {
        console.error('加载游戏配置失败:', error);
      }
    };
    loadSelectedGames();
  }, []);

  // 从后端扫描已下载的技能库（与 SkillDatabase 同步）
  useEffect(() => {
    const scanLibraries = async () => {
      try {
        const libraries = await invoke<any[]>("scan_downloaded_libraries");
        setDownloadedLibraries(libraries);
      } catch (error) {
        console.error('扫描技能库失败:', error);
      }
    };
    scanLibraries();
  }, []);

  // 检查系统状态
  useEffect(() => {
    const checkSystemStatus = async () => {
      try {
        // 检查向量库是否就绪
        const hasVectorDB = downloadedLibraries.length > 0;
        setIsVectorDBReady(hasVectorDB);

        // 检查 LLM 是否配置
        const settings = await invoke<any>('get_app_settings');
        const hasAPIKey = settings.ai_models?.multimodal?.api_key || 
                         settings.ai_models?.multimodal?.provider === 'local';
        setIsLLMReady(!!hasAPIKey);
      } catch (error) {
        console.error('检查系统状态失败:', error);
      }
    };

    checkSystemStatus();
    const interval = setInterval(checkSystemStatus, 5000); // 每5秒更新
    return () => clearInterval(interval);
  }, [downloadedLibraries]);

  // 1. 开始语音对话 - 打开 HUD 窗口
  const handleStartVoiceChat = async () => {
    try {
      // 检查是否有已配置的游戏
      if (selectedGames.length === 0) {
        message.warning("请先添加游戏");
        return;
      }

      // 检查是否有已下载的技能库
      if (downloadedLibraries.length === 0) {
        message.warning("请先下载游戏技能库");
        return;
      }

      message.loading({ content: "正在打开 HUD 窗口...", key: "hud" });
      
      // 调用后端命令打开 HUD 窗口
      await invoke("open_hud_window");
      
      message.success({ content: "HUD 窗口已打开，可以开始语音对话了", key: "hud", duration: 2 });
    } catch (error) {
      console.error("打开 HUD 窗口失败:", error);
      message.error({ content: `打开失败: ${error}`, key: "hud" });
    }
  };

  // 2. 开始模拟场景 - 跳转到 AI 助手页面的模拟场景 Tab
  const handleStartSimulation = () => {
    if (onMenuChange) {
      // 跳转到 AI 助手页面
      onMenuChange("ai-assistant");
      
      // 使用自定义事件通知 AIAssistant 组件切换到模拟场景 Tab
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("switch-to-simulation-tab"));
      }, 100);
      
      message.success("已切换到模拟场景");
    }
  };

  return (
    <Sider width={380} className="right-panel" theme="dark">
      <div className="panel-content">
        {/* Steam 用户卡片 */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <SteamUserCard onLoginClick={() => onMenuChange?.('steam-login')} />
        </motion.div>

        {/* 快捷操作区 (固定) */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card className="quick-actions-card" size="small">
            <Title level={5}>
              <Zap size={16} style={{ marginRight: 8 }} />
              快捷操作
            </Title>
            <Space direction="vertical" size="small" style={{ width: "100%" }}>
              {/* 开始语音对话 */}
              <Button 
                type="primary" 
                block 
                icon={<Mic size={16} />}
                onClick={handleStartVoiceChat}
                disabled={selectedGames.length === 0 || downloadedLibraries.length === 0}
                size="large"
              >
                开始语音对话
              </Button>

              {/* 开始模拟场景 */}
              <Button 
                block 
                icon={<PlayCircle size={16} />}
                onClick={handleStartSimulation}
                size="large"
              >
                开始模拟场景
              </Button>

              {/* 提示信息 */}
              {selectedGames.length === 0 && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  请先添加游戏
                </Text>
              )}
              {selectedGames.length > 0 && downloadedLibraries.length === 0 && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  请先下载技能库
                </Text>
              )}
            </Space>
          </Card>
        </motion.div>

        <Divider style={{ margin: "16px 0" }} />

        {/* 📊 系统状态区 (固定) */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card className="system-status-card" size="small">
            <Title level={5}>
              <Activity size={16} style={{ marginRight: 8 }} />
              系统状态
            </Title>
            <Space direction="vertical" size="small" style={{ width: "100%" }}>
              <div className="status-item">
                <Space style={{ width: "100%", justifyContent: "space-between" }}>
                  <Text type="secondary">已配置游戏</Text>
                  <Text strong>{selectedGames.length} 个</Text>
                </Space>
              </div>

              <div className="status-item">
                <Space style={{ width: "100%", justifyContent: "space-between" }}>
                  <Text type="secondary">已下载技能库</Text>
                  <Text strong>{downloadedLibraries.length} 个</Text>
                </Space>
              </div>

              <div className="status-item">
                <Space style={{ width: "100%", justifyContent: "space-between" }}>
                  <Text type="secondary">向量库</Text>
                  <Tag color={isVectorDBReady ? "green" : "red"}>
                    {isVectorDBReady ? "就绪" : "未就绪"}
                  </Tag>
                </Space>
              </div>

              <div className="status-item">
                <Space style={{ width: "100%", justifyContent: "space-between" }}>
                  <Text type="secondary">多模态 AI</Text>
                  <Tag color={isLLMReady ? "green" : "orange"}>
                    {isLLMReady ? "就绪" : "未配置"}
                  </Tag>
                </Space>
              </div>
            </Space>
          </Card>
        </motion.div>

        <Divider style={{ margin: "16px 0" }} />

        {/* 💾 技能库概况 */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card className="skill-card" size="small">
            <Title level={5}>
              <Database size={16} style={{ marginRight: 8 }} />
              技能库概况
            </Title>
            <Space direction="vertical" size="small" style={{ width: "100%" }}>
              {downloadedLibraries.length > 0 ? (
                <>
                  <div className="skill-stat">
                    <Space style={{ width: "100%", justifyContent: "space-between" }}>
                      <Text type="secondary">已下载游戏</Text>
                      <Text strong>
                        {new Set(downloadedLibraries.map((lib: any) => lib.gameId)).size} 个
                      </Text>
                    </Space>
                  </div>
                  <div className="skill-stat">
                    <Space style={{ width: "100%", justifyContent: "space-between" }}>
                      <Text type="secondary">技能库版本</Text>
                      <Text strong>{downloadedLibraries.length} 个</Text>
                    </Space>
                  </div>
                  <div className="skill-stat">
                    <Space style={{ width: "100%", justifyContent: "space-between" }}>
                      <Text type="secondary">活跃版本</Text>
                      <Text strong>
                        {downloadedLibraries.filter((lib: any) => lib.status === "active").length} 个
                      </Text>
                    </Space>
                  </div>
                  <div className="skill-stat">
                    <Space style={{ width: "100%", justifyContent: "space-between" }}>
                      <Text type="secondary">总存储大小</Text>
                      <Text strong>
                        {(() => {
                          const totalBytes = downloadedLibraries.reduce(
                            (sum: number, lib: any) => sum + (lib.storageSize || 0),
                            0
                          );
                          if (totalBytes === 0) return "0 B";
                          const k = 1024;
                          const sizes = ["B", "KB", "MB", "GB"];
                          const i = Math.floor(Math.log(totalBytes) / Math.log(k));
                          return `${(totalBytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
                        })()}
                      </Text>
                    </Space>
                  </div>
                </>
              ) : (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  暂无技能库数据
                </Text>
              )}
            </Space>
            <Button 
              type="primary" 
              ghost 
              block 
              style={{ marginTop: 12 }}
              onClick={() => onMenuChange?.("skill-database")}
            >
              管理技能库
            </Button>
          </Card>
        </motion.div>

        {/* 📄 底部链接 */}
        <div className="panel-footer" style={{ marginTop: 16 }}>
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            <Button 
              type="text" 
              size="small" 
              block
              style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}
              onClick={() => onMenuChange?.("user-agreement")}
            >
              用户服务协议
            </Button>
            <Button 
              type="text" 
              size="small" 
              block
              style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}
              onClick={() => onMenuChange?.("privacy-policy")}
            >
              隐私政策
            </Button>
            <Text 
              type="secondary" 
              style={{ 
                fontSize: 11, 
                textAlign: "center", 
                display: "block",
                marginTop: 8,
                opacity: 0.4 
              }}
            >
              Gamate {VERSION}
            </Text>
          </Space>
        </div>
      </div>
    </Sider>
  );
};

export default RightPanel;
