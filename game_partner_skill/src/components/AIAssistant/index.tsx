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
} from "antd";
import { SendOutlined, DeleteOutlined, ClearOutlined } from "@ant-design/icons";
import {
  MessageCircle,
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
import "./index.css";

const { TextArea } = Input;
const { Panel } = Collapse;

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
    const screenshot =
      useScreenshot && latestScreenshot ? latestScreenshot : undefined;

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
    } catch (error) {
      console.error("AI 回复失败:", error);

      // Fallback: 显示错误信息
      receiveAIResponse(
        `抱歉,AI 助手暂时无法回复。错误信息: ${error}\n\n请检查:\n1. API Key 是否配置正确\n2. 网络连接是否正常\n3. 向量数据库是否已导入`,
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
      >
        <div className="message-header">
          <span className="message-role">
            {isUser ? "🎮 玩家" : "🤖 AI 助手"}
          </span>
          <span className="message-time">
            {new Date(msg.timestamp).toLocaleTimeString()}
          </span>
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
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {msg.content}
              </ReactMarkdown>
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

  return (
    <div className="ai-assistant-page">
      {/* 主对话区 */}
      <div className="main-conversation-area">
        <Card
          styles={{
            body: {
              display: "flex",
              flexDirection: "row",
              padding: 0,
            }
          }}
          title={
            <div className="conversation-header">
              <MessageCircle size={20} />
              <span>AI 陪玩对话</span>
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
          }
          className="conversation-card"
        >
          {/* 侧边栏: 最近检索 */}
          <div className="sidebar-area">
            <Card
              title={
                <span>
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
                        <Tag color="blue">{(ref.score * 100).toFixed(0)}%</Tag>
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
    </div>
  );
};

export default AIAssistant;
