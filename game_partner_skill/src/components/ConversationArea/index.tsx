// 共享的对话区域组件
// 用于语音对话和文字对话两个 Tab

import React, { useRef, useEffect } from "react";
import { Button, Empty, Tag, Collapse } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import { BookOpen, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { invoke } from "@tauri-apps/api/core";
import { message as antdMessage } from "antd";
import { Message } from "../../stores/aiAssistantStore";
import "./ConversationArea.scss";

const { Panel } = Collapse;

interface ConversationAreaProps {
  messages: Message[];
  isThinking: boolean;
  currentGame: string | null;
  onDeleteMessage: (id: string) => void;
}

// 清理 Markdown 标记，用于 TTS 播报
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

export const ConversationArea: React.FC<ConversationAreaProps> = ({
  messages,
  isThinking,
  currentGame,
  onDeleteMessage,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [speakingMessageId, setSpeakingMessageId] = React.useState<string | null>(null);

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 渲染单条消息
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
              icon={<span>{speakingMessageId === msg.id ? "�" : "�🔊"}</span>}
              onClick={async () => {
                try {
                  // 如果当前正在播报这条消息,则停止
                  if (speakingMessageId === msg.id) {
                    await invoke("stop_speaking");
                    setSpeakingMessageId(null);
                    antdMessage.info("已停止播报");
                    return;
                  }

                  const ttsSettings = await invoke<any>(
                    "get_app_settings",
                  ).then((settings: any) => settings.tts);

                  if (!ttsSettings?.enabled) {
                    antdMessage.warning("请先在设置中启用 TTS");
                    return;
                  }

                  // 清理 Markdown 标记 (会自动识别 [TTS_SIMPLE] 标记)
                  const cleanText = cleanMarkdownForTTS(msg.content);
                  console.log("🧹 [TTS 清理后的文本]", cleanText);

                  await invoke("set_tts_rate", {
                    rate: ttsSettings.rate || 1.0,
                  });
                  await invoke("set_tts_volume", {
                    volume: ttsSettings.volume || 0.8,
                  });
                  
                  // 设置当前播报的消息ID
                  setSpeakingMessageId(msg.id);
                  
                  await invoke("speak_text", {
                    text: cleanText,
                    interrupt: true,
                  });
                  
                  antdMessage.success("开始播报");
                  
                  // 播报完成后清除状态 (简单估算:每个字100ms)
                  const estimatedDuration = cleanText.length * 100;
                  setTimeout(() => {
                    setSpeakingMessageId(null);
                  }, estimatedDuration);
                  
                } catch (error) {
                  setSpeakingMessageId(null);
                  antdMessage.error(`播报失败: ${error}`);
                }
              }}
              title={speakingMessageId === msg.id ? "停止播报" : "播报此消息"}
            />
          )}
          <Button
            type="text"
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => onDeleteMessage(msg.id)}
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

  return (
    <div className="conversation-area">
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
  );
};
