import React, { useState, useEffect, useRef } from "react";
import {
  Card,
  Input,
  Button,
  Empty,
  message as antdMessage,
  Tag,
  Collapse,
  Select,
  Tabs,
} from "antd";
import { SendOutlined, DeleteOutlined, ClearOutlined } from "@ant-design/icons";
import {
  Image as ImageIcon,
  BookOpen,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useAIAssistantStore, Message } from "../../stores/aiAssistantStore";
import { useUserStore } from "../../stores/userStore";
import { useSkillLibraryStore } from "../../stores/skillLibraryStore";
import { getGameById } from "../../data/games";
import { VoiceChatPanel } from "../VoiceChatPanel";
import "./index.css";

const { TextArea } = Input;
const { Panel } = Collapse;

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
    .replace(/\*\*(.+?)\*\*/g, '$1')      // 移除加粗 **text**
    .replace(/\*(.+?)\*/g, '$1')          // 移除斜体 *text*
    .replace(/`(.+?)`/g, '$1')            // 移除代码标记 `code`
    .replace(/~~(.+?)~~/g, '$1')          // 移除删除线 ~~text~~
    .replace(/#{1,6}\s+/g, '')            // 移除标题标记 # ## ###
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')   // 移除链接 [text](url) -> text
    .replace(/!\[.+?\]\(.+?\)/g, '')      // 移除图片
    .replace(/^\s*[-*+]\s+/gm, '')        // 移除列表标记
    .replace(/^\s*\d+\.\s+/gm, '')        // 移除数字列表
    .replace(/\n{3,}/g, '\n\n')           // 多个换行合并
    .replace(/```[\s\S]*?```/g, '')       // 移除代码块
    .replace(/`/g, '')                    // 移除单个反引号
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

  const { user } = useUserStore();
  const { downloadedLibraries } = useSkillLibraryStore();

  const [inputValue, setInputValue] = useState("");
  const [useScreenshot, setUseScreenshot] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const voiceListenerRegistered = useRef(false); // 防止重复注册语音识别监听器

  // 可用的游戏列表
  const gamesWithSkills = [
    ...new Set(downloadedLibraries.map((lib) => lib.gameId)),
  ];
  const selectedGames =
    user?.config.selectedGames.map((id) => getGameById(id)).filter(Boolean) ||
    [];
  const availableGames = selectedGames.filter((game) =>
    gamesWithSkills.includes(game!.id),
  );

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 监听截图事件
  useEffect(() => {
    const unlisten = listen("screenshot_captured", (event: any) => {
      const screenshot = event.payload as string;
      updateContext(screenshot);
      console.log("📸 收到新截图,已更新上下文");
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // 监听语音识别完成事件 (从 VoiceChatPanel 触发)
  useEffect(() => {
    // 防止重复注册（React Strict Mode 会执行两次）
    if (voiceListenerRegistered.current) {
      console.log("⚠️ [跳过] 语音监听器已注册，避免重复");
      return;
    }
    
    console.log("🔧 [初始化] 注册语音识别完成监听器...");
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
        console.log("⚠️ [跳过重复] 该识别结果已处理:", textKey);
        return;
      }
      processedRecognitions.add(textKey);
      
      // 5秒后清除标记(允许重复提问)
      setTimeout(() => processedRecognitions.delete(textKey), 5000);

      console.log("🎤 [语音识别完成]", recognizedText);

      // 检查是否选择了游戏
      if (!currentGame) {
        antdMessage.warning("请先选择游戏");
        return;
      }

      let screenshot: string | undefined = undefined;

      try {
        // 1. 自动截图
        console.log("📸 [语音对话] 开始自动截图...");
        antdMessage.loading({ content: "正在截图...", key: "voice_screenshot" });

        screenshot = await invoke<string>("capture_screenshot");

        antdMessage.success({
          content: "截图完成",
          key: "voice_screenshot",
          duration: 1,
        });
        console.log("✅ [语音对话] 截图成功");
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
        console.log("🤖 [语音对话] 准备调用 generate_ai_response");

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

        console.log("✅ [语音对话] AI 回复成功:", response);

        // 4. 添加 AI 回复到对话历史
        receiveAIResponse(response.content, response.wiki_references);

        // 5. TTS 播报 AI 回复 (清理 Markdown 标记)
        try {
          const ttsSettings = await invoke<{
            enabled: boolean;
            auto_speak: boolean;
            rate: number;
            volume: number;
          }>("get_app_settings").then((settings: any) => settings.tts);

          console.log("🔊 [语音对话] TTS 配置:", ttsSettings);

          if (ttsSettings?.enabled && ttsSettings?.auto_speak) {
            console.log("🎤 [语音对话] 开始播报 AI 回复...");

            // 清理 Markdown 标记 (支持 [TTS_SIMPLE] 简化标记)
            const cleanText = cleanMarkdownForTTS(response.content);

            console.log("🧹 [清理后的文本]", cleanText);

            await invoke("set_tts_rate", { rate: ttsSettings.rate || 1.0 });
            await invoke("set_tts_volume", { volume: ttsSettings.volume || 0.8 });
            await invoke("speak_text", {
              text: cleanText,  // 使用清理后的文本
              interrupt: true,
            });

            console.log("✅ [语音对话] TTS 播报已开始");
          }
        } catch (ttsError) {
          console.warn("⚠️ [语音对话] TTS 播报失败:", ttsError);
        }
      } catch (error) {
        console.error("❌ [语音对话] AI 回复失败:", error);

        receiveAIResponse(
          `抱歉,AI 助手暂时无法回复。错误信息: ${error}\n\n请检查:\n1. 多模态模型是否已启用\n2. API Key 是否配置正确 (本地 Ollama 不需要)\n3. 网络连接是否正常\n4. 向量数据库是否已导入`,
          [],
        );

        antdMessage.error("AI 回复失败,请查看详细错误信息");
      }
    };

    // 监听自定义事件
    window.addEventListener("voice_recognition_completed", handleVoiceRecognitionCompleted);

    return () => {
      console.log("🧹 [清理] 取消语音识别监听器");
      window.removeEventListener("voice_recognition_completed", handleVoiceRecognitionCompleted);
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
        console.log("🎤 已应用角色语音:", personalityType);
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

    console.log("🚀 开始发送消息:", userMessage);
    console.log("📷 截图启用状态:", useScreenshot);
    console.log("🎮 当前游戏:", currentGame);

    // 如果启用截图,先执行截图
    if (useScreenshot) {
      try {
        console.log("📸 开始截图...");
        antdMessage.loading({ content: "正在截图...", key: "screenshot" });

        // 调用截图命令
        const capturedScreenshot = await invoke<string>("capture_screenshot");
        screenshot = capturedScreenshot;

        antdMessage.success({
          content: "截图完成",
          key: "screenshot",
          duration: 1,
        });
        console.log("✅ 截图成功,长度:", screenshot?.length);
      } catch (error) {
        console.error("❌ 截图失败:", error);
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
      console.log("🤖 准备调用 generate_ai_response");
      console.log("   参数:", {
        message: userMessage,
        gameId: currentGame,
        hasScreenshot: !!screenshot,
      });

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

      console.log("✅ AI 回复成功:", response);

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

        console.log("🔊 TTS 配置:", ttsSettings);

        // 如果启用了 TTS 且自动播报
        if (ttsSettings?.enabled && ttsSettings?.auto_speak) {
          console.log("🎤 开始播报 AI 回复...");

          // 清理 Markdown 标记 (支持 [TTS_SIMPLE] 简化标记)
          const cleanText = cleanMarkdownForTTS(response.content);
          console.log("🧹 [清理后的文本]", cleanText);

          // 设置语速和音量
          await invoke("set_tts_rate", { rate: ttsSettings.rate || 1.0 });
          await invoke("set_tts_volume", { volume: ttsSettings.volume || 0.8 });

          // 播报 AI 回复内容
          await invoke("speak_text", {
            text: cleanText,  // 使用清理后的文本
            interrupt: true, // 打断之前的播报
          });

          console.log("✅ TTS 播报已开始");
        }
      } catch (ttsError) {
        console.warn("⚠️  TTS 播报失败:", ttsError);
        // TTS 失败不影响主流程
      }
    } catch (error) {
      console.error("❌ AI 回复失败:", error);

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

  // 渲染消息
  const renderMessage = (msg: Message) => {
    const isUser = msg.role === "user";

    return (
      <motion.div
        key={msg.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className={`message-item ${isUser ? "user-message" : "ai-message"}`}
        style={{ backgroundColor: "#1e1e1e" }}
      >
        <div className="message-header">
          <span className="message-role">{isUser ? "玩家" : "AI 助手"}</span>
          <span className="message-time">
            {new Date(msg.timestamp).toLocaleTimeString()}
          </span>
          {/* AI 消息显示播报按钮 */}
          {!isUser && (
            <Button
              type="text"
              size="small"
              icon={<span>🔊</span>}
              onClick={async () => {
                try {
                  const ttsSettings = await invoke<any>(
                    "get_app_settings",
                  ).then((settings: any) => settings.tts);

                  if (!ttsSettings?.enabled) {
                    antdMessage.warning("请先在设置中启用 TTS");
                    return;
                  }

                  await invoke("set_tts_rate", {
                    rate: ttsSettings.rate || 1.0,
                  });
                  await invoke("set_tts_volume", {
                    volume: ttsSettings.volume || 0.8,
                  });
                  await invoke("speak_text", {
                    text: msg.content,
                    interrupt: true,
                  });
                  antdMessage.success("开始播报");
                } catch (error) {
                  antdMessage.error(`播报失败: ${error}`);
                }
              }}
              title="播报此消息"
            />
          )}
          <Button
            type="text"
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => deleteMessage(msg.id)}
            style={{ marginLeft: "auto" }}
          />
        </div>

        <div className="message-content">
          {isUser ? (
            <div>{msg.content}</div>
          ) : (
            <div className="markdown-content">
              {/* 检查是否包含 thinking 内容 */}
              {msg.content.includes("Thinking...") &&
              msg.content.includes("...done thinking.") ? (
                <>
                  {/* 提取 thinking 部分 */}
                  {(() => {
                    const thinkingStart = msg.content.indexOf("Thinking...");
                    const thinkingEnd =
                      msg.content.indexOf("...done thinking.") +
                      "...done thinking.".length;
                    const thinkingContent = msg.content.substring(
                      thinkingStart,
                      thinkingEnd,
                    );
                    const actualResponse = msg.content
                      .substring(thinkingEnd)
                      .trim();

                    return (
                      <>
                        {/* Thinking 过程（可折叠） */}
                        <Collapse ghost style={{ marginBottom: 12 }}>
                          <Panel
                            header={
                              <span style={{ color: "#888", fontSize: "13px" }}>
                                <span style={{ marginRight: 8 }}>🧠</span>
                                AI 思考过程
                              </span>
                            }
                            key="thinking"
                          >
                            <div
                              style={{
                                background: "#f5f5f5",
                                padding: "12px",
                                borderRadius: "4px",
                                fontSize: "13px",
                                color: "#666",
                                whiteSpace: "pre-wrap",
                                fontFamily: "monospace",
                              }}
                            >
                              {thinkingContent}
                            </div>
                          </Panel>
                        </Collapse>

                        {/* 实际回复 */}
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {actualResponse || msg.content}
                        </ReactMarkdown>
                      </>
                    );
                  })()}
                </>
              ) : (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.content}
                </ReactMarkdown>
              )}
            </div>
          )}
        </div>

        {/* 显示截图 */}
        {msg.screenshot && (
          <div className="message-screenshot">
            <img src={msg.screenshot} alt="游戏截图" />
          </div>
        )}

        {/* 显示 Wiki 引用 */}
        {msg.wikiReferences && msg.wikiReferences.length > 0 && (
          <Collapse ghost className="wiki-references">
            <Panel
              header={
                <span>
                  <BookOpen size={14} style={{ marginRight: 8 }} />
                  参考资料 ({msg.wikiReferences.length})
                </span>
              }
              key="wiki"
            >
              {msg.wikiReferences.map((ref, index) => (
                <div key={index} className="wiki-ref-item">
                  <div className="wiki-ref-header">
                    <strong>{ref.title}</strong>
                    <Tag color="blue">{(ref.score * 100).toFixed(1)}%</Tag>
                  </div>
                  <div className="wiki-ref-content">
                    {ref.content.substring(0, 200)}...
                  </div>
                </div>
              ))}
            </Panel>
          </Collapse>
        )}
      </motion.div>
    );
  };

  const [tabKey, setTabKey] = useState("audio");

  return (
    <div className="ai-assistant-page">
      <div className="conversation-header">
        
        <h3 style={{fontSize: 22}}>AI 陪玩对话</h3>
        <Select
          value={currentGame}
          onChange={setCurrentGame}
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
        {/* {!isAIRunning ? (
          <Button
            type="primary"
            size="small"
            onClick={handleStartAI}
            disabled={!currentGame}
          >
            开始对话
          </Button>
        ) : (
          <Button type="default" size="small" danger onClick={handleStopAI}>
            停止对话
          </Button>
        )} */}
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
          {/* 主对话区 */}
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
              {/* 侧边栏: 参考资料和语音聊天 */}
              <div className="sidebar-area">
                {/* 参考资料 */}
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

              <div className="messages-area-container">
                <div className="messages-container">
                  <AnimatePresence>
                    {messages.length === 0 ? (
                      <Empty
                        description={
                          currentGame
                            ? "开始对话吧!问我任何关于游戏的问题~"
                            : "请先选择游戏"
                        }
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                      />
                    ) : (
                      messages.map(renderMessage)
                    )}
                  </AnimatePresence>

                  {/* AI 思考中 */}
                  {isThinking && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="thinking-indicator"
                    >
                      <Loader2 size={16} className="spin-icon" />
                      <span>AI 思考中...</span>
                    </motion.div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

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
      </Tabs>
    </div>
  );
};

export default AIAssistant;
