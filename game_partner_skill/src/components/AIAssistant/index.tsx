import React, { useState, useEffect, useRef } from "react";
import {
  Card,
  Input,
  Button,
  Empty,
  message as antdMessage,
  Tag,
  Select,
  Tabs,
} from "antd";
import { SendOutlined, ClearOutlined } from "@ant-design/icons";
import { Image as ImageIcon, BookOpen } from "lucide-react";
import { motion } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useAIAssistantStore } from "../../stores/aiAssistantStore";
import { getGameById } from "../../services/configService";
import { VoiceChatPanel } from "../VoiceChatPanel";
import { ConversationArea } from "../ConversationArea";
import { SimulationPanel } from "../SimulationPanel";
import "./index.css";

const { TextArea } = Input;

// 清理 Markdown 标记，用于 TTS 播报 (与 ConversationArea 中的函数一致)
const cleanMarkdownForTTS = (text: string): string => {
  // 检查是否包含简化播报标记
  const ttsSimpleMatch = text.match(/\[TTS_SIMPLE\](.*?)\[\/TTS_SIMPLE\]/s);
  if (ttsSimpleMatch) {
    // 如果有简化标记,只播报标记内的内容
    return ttsSimpleMatch[1].trim();
  }

  // 否则进行常规 Markdown 清理
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1") // 移除加粗 **text**
    .replace(/\*(.+?)\*/g, "$1") // 移除斜体 *text*
    .replace(/`(.+?)`/g, "$1") // 移除代码标记 `code`
    .replace(/~~(.+?)~~/g, "$1") // 移除删除线 ~~text~~
    .replace(/#{1,6}\s+/g, "") // 移除标题标记 # ## ###
    .replace(/\[(.+?)\]\(.+?\)/g, "$1") // 移除链接 [text](url) -> text
    .replace(/!\[.+?\]\(.+?\)/g, "") // 移除图片
    .replace(/^\s*[-*+]\s+/gm, "") // 移除列表标记
    .replace(/^\s*\d+\.\s+/gm, "") // 移除数字列表
    .replace(/\n{3,}/g, "\n\n") // 多个换行合并
    .replace(/```[\s\S]*?```/g, "") // 移除代码块
    .replace(/`/g, "") // 移除单个反引号
    .trim();
};

const AIAssistant: React.FC = () => {
  const {
    messages,
    currentGame,
    isThinking,
    latestScreenshot,
    lastWikiSearch,
    sendMessage,
    receiveAIResponse,
    updateContext,
    setCurrentGame,
    clearMessages,
    deleteMessage,
  } = useAIAssistantStore();

  const [downloadedLibraries, setDownloadedLibraries] = useState<any[]>([]);
  const [availableGames, setAvailableGames] = useState<any[]>([]);

  const [inputValue, setInputValue] = useState("");
  const [useScreenshot, setUseScreenshot] = useState(true);
  const voiceListenerRegistered = useRef(false); // 防止重复注册语音识别监听器

  // 监听从 RightPanel 发来的切换到模拟场景 Tab 的事件
  useEffect(() => {
    const handleSwitchToSimulation = () => {
      setTabKey("simulation");
    };

    window.addEventListener("switch-to-simulation-tab", handleSwitchToSimulation);

    return () => {
      window.removeEventListener("switch-to-simulation-tab", handleSwitchToSimulation);
    };
  }, []);

  // 监听来自 HUD 的游戏切换事件
  useEffect(() => {
    const setupGameChangeListener = async () => {
      try {
        const { listen: listenEvent } = await import("@tauri-apps/api/event");
        const unlisten = await listenEvent<{ gameId: string }>(
          "game-changed",
          (event) => {
            setCurrentGame(event.payload.gameId);
          },
        );

        return unlisten;
      } catch (error) {
        console.error("[AIAssistant] 监听器注册失败:", error);
        throw error;
      }
    };

    let unlistenFn: (() => void) | null = null;
    setupGameChangeListener()
      .then((fn) => {
        unlistenFn = fn;
      })
      .catch((err) => {
        console.error("[AIAssistant] 监听器设置失败:", err);
      });

    return () => {
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, [setCurrentGame]);

  // 从后端扫描已下载的技能库
  useEffect(() => {
    const loadLibraries = async () => {
      try {
        const libraries = await invoke<any[]>("scan_downloaded_libraries");
        setDownloadedLibraries(libraries);
      } catch (error) {
        console.error("扫描技能库失败:", error);
      }
    };
    loadLibraries();
  }, []);

  // 从后端加载用户选择的游戏并过滤出有技能库的
  useEffect(() => {
    const loadAvailableGames = async () => {
      try {
        const settings = await invoke<any>("get_app_settings");
        const selectedGameIds = settings.user?.selected_games || [];

        // 获取有技能库的游戏 ID
        const gamesWithSkills = [
          ...new Set(downloadedLibraries.map((lib) => lib.gameId)),
        ];

        // 过滤出既被选择又有技能库的游戏
        const filteredIds = selectedGameIds.filter((id: string) =>
          gamesWithSkills.includes(id),
        );

        // 使用 Promise.all 等待所有异步调用完成
        const games = await Promise.all(
          filteredIds.map((id: string) => getGameById(id)),
        );
        const validGames = games.filter(Boolean);
        setAvailableGames(validGames);
      } catch (error) {
        console.error("加载游戏配置失败:", error);
      }
    };

    if (downloadedLibraries.length > 0) {
      loadAvailableGames();
    }
  }, [downloadedLibraries]);

  // 监听截图事件
  useEffect(() => {
    const unlisten = listen("screenshot_captured", (event: any) => {
      const screenshot = event.payload as string;
      updateContext(screenshot);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // 监听语音识别完成事件 (从 VoiceChatPanel 触发)
  useEffect(() => {
    // 防止重复注册（React Strict Mode 会执行两次）
    if (voiceListenerRegistered.current) {
      return;
    }
    voiceListenerRegistered.current = true;

    // 防止同一次识别被处理多次
    const processedRecognitions = new Set<string>();

    const handleVoiceRecognitionCompleted = async (event: any) => {
      const recognizedText = event.detail?.text;
      if (!recognizedText || !recognizedText.trim()) {
        console.warn("⚠️ 语音识别文字为空，跳过处理");
        return;
      }

      // 生成唯一标识防止重复处理
      const textKey = recognizedText.trim();

      if (processedRecognitions.has(textKey)) {
        return;
      }
      processedRecognitions.add(textKey);

      // 5秒后清除标记(允许重复提问)
      setTimeout(() => processedRecognitions.delete(textKey), 5000);

      // 检查是否选择了游戏
      if (!currentGame) {
        antdMessage.warning("请先选择游戏");
        return;
      }

      let screenshot: string | undefined = undefined;

      try {
        // 1. 自动截图
        antdMessage.loading({
          content: "正在截图...",
          key: "voice_screenshot",
        });

        // 通知 HUD: 正在截图
        try {
          const { emit } = await import("@tauri-apps/api/event");
          await emit("screenshot_started", {});
        } catch (e) {
          console.warn("发送 screenshot_started 事件失败:", e);
        }

        screenshot = await invoke<string>("capture_screenshot");

        antdMessage.success({
          content: "截图完成",
          key: "voice_screenshot",
          duration: 1,
        });
      } catch (error) {
        console.error("❌ [语音对话] 截图失败:", error);
        antdMessage.warning({
          content: "截图失败,将以纯文本模式发送",
          key: "voice_screenshot",
          duration: 2,
        });
      }

      // 2. 添加用户消息 (语音识别的文字)
      sendMessage(recognizedText, screenshot);

      try {
        // [语音对话] 准备调用 generate_ai_response
        // 通知 HUD: AI 思考中
        try {
          const { emit } = await import("@tauri-apps/api/event");
          await emit("ai_thinking", {});
        } catch (e) {
          console.warn("发送 ai_thinking 事件失败:", e);
        }

        // 3. 调用 AI 生成回复
        const response = await invoke<{
          content: string;
          wiki_references?: Array<{
            title: string;
            content: string;
            score: number;
          }>;
        }>("generate_ai_response", {
          message: recognizedText,
          gameId: currentGame,
          screenshot,
        });
        // 4. 添加 AI 回复到对话历史
        receiveAIResponse(response.content, response.wiki_references);

        // 通知 HUD: AI 回答准备好了
        try {
          const { emit } = await import("@tauri-apps/api/event");
          await emit("ai_response_ready", {});
        } catch (e) {
          console.warn("发送 ai_response_ready 事件失败:", e);
        }

        // 5. TTS 播报 AI 回复 (清理 Markdown 标记)
        try {
          const ttsSettings = await invoke<{
            enabled: boolean;
            auto_speak: boolean;
            rate: number;
            volume: number;
          }>("get_app_settings").then((settings: any) => settings.tts);

          if (ttsSettings?.enabled && ttsSettings?.auto_speak) {
            // 清理 Markdown 标记 (支持 [TTS_SIMPLE] 简化标记)
            const cleanText = cleanMarkdownForTTS(response.content);
            await invoke("set_tts_rate", { rate: ttsSettings.rate || 1.0 });
            await invoke("set_tts_volume", {
              volume: ttsSettings.volume || 0.8,
            });
            await invoke("speak_text", {
              text: cleanText, // 使用清理后的文本
              interrupt: true,
            });
          }
        } catch (ttsError) {
          console.warn("[语音对话] TTS 播报失败:", ttsError);
        }
      } catch (error) {
        console.error("[语音对话] AI 回复失败:", error);

        receiveAIResponse(
          `抱歉,AI 助手暂时无法回复。错误信息: ${error}\n\n请检查:\n1. 多模态模型是否已启用\n2. API Key 是否配置正确 (本地 Ollama 不需要)\n3. 网络连接是否正常\n4. 向量数据库是否已导入`,
          [],
        );

        antdMessage.error("AI 回复失败,请查看详细错误信息");
      }
    };

    // 监听自定义事件
    window.addEventListener(
      "voice_recognition_completed",
      handleVoiceRecognitionCompleted,
    );

    return () => {
      window.removeEventListener(
        "voice_recognition_completed",
        handleVoiceRecognitionCompleted,
      );
      voiceListenerRegistered.current = false; // 重置标志
    };
  }, [currentGame, sendMessage, receiveAIResponse]); // 添加依赖

  // 组件加载时应用当前角色语音
  useEffect(() => {
    const applyCurrentPersonalityVoice = async () => {
      try {
        const settings = await invoke("get_app_settings");
        const personalityType =
          (settings as any)?.ai_models?.ai_personality || "sunnyou_male";
        await invoke("apply_personality_voice", {
          personalityType,
        });
      } catch (error) {
        console.error("应用角色语音失败:", error);
      }
    };

    applyCurrentPersonalityVoice();
  }, []); // 仅在组件挂载时执行一次

  // 发送消息
  const handleSend = async () => {
    if (!inputValue.trim()) {
      antdMessage.warning("请输入消息");
      return;
    }

    if (!currentGame) {
      antdMessage.warning("请先选择游戏");
      return;
    }

    const userMessage = inputValue.trim();
    let screenshot: string | undefined = undefined;
    // 如果启用截图,先执行截图
    if (useScreenshot) {
      try {
        antdMessage.loading({ content: "正在截图...", key: "screenshot" });

        // 调用截图命令
        const capturedScreenshot = await invoke<string>("capture_screenshot");
        screenshot = capturedScreenshot;

        antdMessage.success({
          content: "截图完成",
          key: "screenshot",
          duration: 1,
        });
      } catch (error) {
        console.error("截图失败:", error);
        antdMessage.warning({
          content: "截图失败,将以纯文本模式发送",
          key: "screenshot",
          duration: 2,
        });
      }
    }

    // 添加用户消息
    sendMessage(userMessage, screenshot);
    setInputValue("");

    try {
      // 调用后端 RAG 生成 AI 回复
      const response = await invoke<{
        content: string;
        wiki_references?: Array<{
          title: string;
          content: string;
          score: number;
        }>;
      }>("generate_ai_response", {
        message: userMessage,
        gameId: currentGame,
        screenshot,
      });
      // 添加 AI 回复
      receiveAIResponse(response.content, response.wiki_references);

      // TTS 播报 AI 回复
      try {
        // 获取 TTS 配置
        const ttsSettings = await invoke<{
          enabled: boolean;
          auto_speak: boolean;
          rate: number;
          volume: number;
        }>("get_app_settings").then((settings: any) => settings.tts);

        // 如果启用了 TTS 且自动播报
        if (ttsSettings?.enabled && ttsSettings?.auto_speak) {
          // 清理 Markdown 标记 (支持 [TTS_SIMPLE] 简化标记)
          const cleanText = cleanMarkdownForTTS(response.content);
          // 设置语速和音量
          await invoke("set_tts_rate", { rate: ttsSettings.rate || 1.0 });
          await invoke("set_tts_volume", { volume: ttsSettings.volume || 0.8 });

          // 播报 AI 回复内容
          await invoke("speak_text", {
            text: cleanText, // 使用清理后的文本
            interrupt: true, // 打断之前的播报
          });
        }
      } catch (ttsError) {
        console.warn("TTS 播报失败:", ttsError);
        // TTS 失败不影响主流程
      }
    } catch (error) {
      console.error("AI 回复失败:", error);

      // Fallback: 显示错误信息
      receiveAIResponse(
        `抱歉,AI 助手暂时无法回复。错误信息: ${error}\n\n请检查:\n1. 多模态模型是否已启用\n2. API Key 是否配置正确 (本地 Ollama 不需要)\n3. 网络连接是否正常\n4. 向量数据库是否已导入`,
        [],
      );

      antdMessage.error("AI 回复失败,请查看详细错误信息");
    }
  };

  // 清空对话
  const handleClear = () => {
    clearMessages();
    antdMessage.success("已清空对话历史");
  };

  const [tabKey, setTabKey] = useState("audio");

  // 包装 setCurrentGame,同时通知 HUD 窗口
  const handleGameChange = async (gameId: string | null) => {
    setCurrentGame(gameId);

    // 通知 HUD 窗口
    try {
      const { emit } = await import("@tauri-apps/api/event");
      await emit("game-changed", { gameId });
    } catch (error) {
      console.error("发送游戏切换事件失败:", error);
    }
  };

  return (
    <div className="ai-assistant-page">
      <div className="conversation-header">
        <h3 style={{ fontSize: 22 }}>AI 陪玩对话</h3>
        <Select
          value={currentGame}
          onChange={handleGameChange}
          placeholder="选择游戏"
          style={{ width: 200, marginLeft: "auto" }}
          size="middle"
        >
          {availableGames.map((game) => (
            <Select.Option key={game!.id} value={game!.id}>
              {game!.name}
            </Select.Option>
          ))}
        </Select>
      </div>
      <Tabs
        activeKey={tabKey}
        onChange={setTabKey}
        styles={{
          root: { height: "100%", width: "100%" },
          content: { height: "100%" },
        }}
      >
        <Tabs.TabPane tab="语音对话" key="audio">
          {/* 语音聊天面板 */}
          <div style={{ height: "calc(100% - 40px)" }}>
            <VoiceChatPanel />
          </div>
        </Tabs.TabPane>
        <Tabs.TabPane tab="文本对话" key="word">
          {/* 主对话区 - 使用统一的 ConversationArea 组件 */}
          <div
            className="main-conversation-area"
            style={{ height: "calc(100vh - 132px)" }}
          >
            <Card
              styles={{
                body: {
                  display: "flex",
                  flexDirection: "row",
                  padding: 0,
                  height: "100%",
                },
              }}
              className="conversation-card"
            >
              {/* 侧边栏: 参考资料 */}
              <div className="sidebar-area">
                <Card
                  title={
                    <span style={{ display: "flex", alignItems: "center" }}>
                      <BookOpen size={16} style={{ marginRight: 8 }} />
                      参考资料
                    </span>
                  }
                  size="small"
                  className="wiki-sidebar-card"
                >
                  {lastWikiSearch.length > 0 ? (
                    <div className="wiki-sidebar-results">
                      {lastWikiSearch.map((ref, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="wiki-sidebar-item"
                        >
                          <div className="wiki-sidebar-header">
                            <strong>{ref.title}</strong>
                            <Tag color="blue">
                              {(ref.score * 100).toFixed(0)}%
                            </Tag>
                          </div>
                          <div className="wiki-sidebar-content">
                            {ref.content.substring(0, 150)}...
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <Empty
                      description="开始对话后,相关的 Wiki 资料会显示在这里"
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      style={{ padding: "40px 20px" }}
                    />
                  )}
                </Card>
              </div>

              {/* 使用统一的对话区域组件 */}
              <div className="messages-area-container">
                <ConversationArea
                  messages={messages}
                  isThinking={isThinking}
                  currentGame={currentGame}
                  onDeleteMessage={deleteMessage}
                />

                {/* 输入框 */}
                <div className="input-area">
                  <div className="input-controls">
                    <Button
                      type={useScreenshot ? "primary" : "default"}
                      size="small"
                      icon={<ImageIcon size={14} />}
                      onClick={() => setUseScreenshot(!useScreenshot)}
                      disabled={!latestScreenshot}
                    >
                      {useScreenshot ? "已附加截图" : "未附加截图"}
                    </Button>
                    <Button
                      type="text"
                      size="small"
                      icon={<ClearOutlined />}
                      onClick={handleClear}
                      disabled={messages.length === 0}
                    >
                      清空
                    </Button>
                  </div>
                  <TextArea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onPressEnter={(e) => {
                      if (!e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="输入消息... (Shift+Enter 换行, Enter 发送)"
                    autoSize={{ minRows: 2, maxRows: 4 }}
                    disabled={!currentGame || isThinking}
                  />
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={handleSend}
                    loading={isThinking}
                    disabled={!currentGame || !inputValue.trim()}
                  >
                    发送
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </Tabs.TabPane>
        <Tabs.TabPane tab="模拟场景" key="simulation">
          {/* 模拟场景面板 */}
          <div style={{ height: "calc(100% - 40px)", overflow: "auto" }}>
            <SimulationPanel />
          </div>
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
};

export default AIAssistant;
