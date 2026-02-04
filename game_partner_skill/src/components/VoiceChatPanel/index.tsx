// Voice Chat Panel Component
// 持续监听模式的语音聊话界面

import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Mic, MicOff, Volume2 } from "lucide-react";
import { Button, Modal, Progress } from "antd";
import { useAIAssistantStore } from "../../stores/aiAssistantStore";
import { ConversationArea } from "../ConversationArea";
import "./index.scss";

interface VadConfig {
  volume_threshold?: number;
  silence_duration_secs?: number;
  min_speech_duration_secs?: number;
  max_speech_duration_secs?: number;
}

interface ListenerState {
  vad_state: "Idle" | "Speaking" | "Processing";
  is_listening: boolean;
  recording_duration: number;
  buffer_size: number;
  last_transcription: string | null;
}

export const VoiceChatPanel: React.FC = () => {
  const [isListening, setIsListening] = useState(false);
  const [listenerState, setListenerState] = useState<ListenerState | null>(
    null,
  );

  // 使用共享的对话Store
  const {
    messages,
    isThinking,
    currentGame,
    deleteMessage,
  } = useAIAssistantStore();

  // 麦克风测试状态
  const [isTesting, setIsTesting] = useState(false);
  const [testVolume, setTestVolume] = useState(0);
  const [testDuration, setTestDuration] = useState(0);
  const [testSamples, setTestSamples] = useState(0);
  
  // 使用 ref 防止重复注册监听器
  const listenersRegistered = React.useRef(false);

  // 加载监听器状态
  const loadState = async () => {
    try {
      const state = await invoke<ListenerState>("get_listener_state");
      setListenerState(state);
      setIsListening(state.is_listening);
    } catch (error) {
      console.error("获取监听器状态失败:", error);
    }
  };

  // 开始监听
  const handleStartListening = async () => {
    try {
      const vadConfig: VadConfig = {
        volume_threshold: 0.02,
        silence_duration_secs: 1.5,
        min_speech_duration_secs: 0.3,
        max_speech_duration_secs: 30.0,
      };

      await invoke("start_continuous_listening", { vadConfig });
      setIsListening(true);
      console.log("🎙️ 开始持续监听");
    } catch (error) {
      console.error("启动监听失败:", error);
      alert(`启动失败: ${error}`);
    }
  };

  // 停止监听
  const handleStopListening = async () => {
    try {
      console.log("⏹️⏹️⏹️ [前端] 用户点击停止对话按钮 !!!");
      console.log("⏹️ [前端] 调用 stop_continuous_listening 命令...");

      const result = await invoke("stop_continuous_listening");

      console.log("✅ [前端] stop_continuous_listening 命令返回:", result);
      setIsListening(false);
      console.log("⏹️ 已停止监听");
    } catch (error) {
      console.error("❌ [前端] 停止监听失败:", error);
      alert(`停止失败: ${error}`);
    }
  };

  // 开始测试麦克风
  const handleStartTest = async () => {
    try {
      setIsTesting(true);
      setTestVolume(0);
      setTestDuration(0);
      setTestSamples(0);

      await invoke("start_microphone_test");
      console.log("🎤 开始麦克风测试");
    } catch (error) {
      console.error("启动麦克风测试失败:", error);
      alert(`启动测试失败: ${error}`);
      setIsTesting(false);
    }
  };

  // 停止测试麦克风
  const handleStopTest = async () => {
    try {
      const result = await invoke<{
        duration_secs: number;
        total_samples: number;
        average_volume: number;
        max_volume: number;
      }>("stop_microphone_test");

      setIsTesting(false);

      // 安全检查返回值
      if (!result || typeof result.duration_secs === "undefined") {
        // alert("测试已停止，但未获取到有效数据");
        const modal = Modal.warning({
          title: "测试结果",
          content: "测试已停止，但未获取到有效数据",
          onCancel: () => {
            modal.destroy();
          },
          onOk: () => {
            modal.destroy();
          },
        });

        return;
      }

      const modal = Modal.success({
        title: "麦克风测试结果",
        content: (
          <>
            <p>测试时长: {(result.duration_secs || 0).toFixed(1)}s</p>
            <p>采集样本: {result.total_samples.toLocaleString()} 个</p>
            <p>平均音量: {((result.average_volume || 0) * 100).toFixed(1)}</p>
            <p>最大音量: {((result.max_volume || 0) * 100).toFixed(1)}</p>
          </>
        ),
        onCancel: () => {
          modal.destroy();
        },
        onOk: () => {
          modal.destroy();
        },
      });
    } catch (error) {
      console.error("停止麦克风测试失败:", error);
      setIsTesting(false);
      const modal = Modal.error({
        title: "停止测试失败",
        content: `停止测试失败: ${error}`,
        onCancel: () => {
          modal.destroy();
        },
        onOk: () => {
          modal.destroy();
        },
      });
    }
  };

  // 监听事件
  useEffect(() => {
    // 防止重复注册（React Strict Mode 会执行两次 useEffect）
    if (listenersRegistered.current) {
      console.log("⚠️ [跳过] 监听器已注册，避免重复");
      return;
    }
    
    console.log("🔧 [初始化] 注册事件监听器...");
    listenersRegistered.current = true;
    
    const unlistenList: (() => void)[] = [];

    // 语音转文字事件 - 不再需要,因为会触发自定义事件
    listen<string>("voice_transcribed", (event) => {
      console.log("📝 [语音转文字]", event.payload);
      // 已移除 setTranscriptions,由 AIAssistant 统一处理
    }).then((unlisten) => {
      console.log("✅ [已注册] voice_transcribed 监听器");
      unlistenList.push(unlisten);
    });

    // 开始说话事件
    listen("speech_started", () => {
      console.log("🎤 [开始说话]");
    }).then((unlisten) => {
      console.log("✅ [已注册] speech_started 监听器");
      unlistenList.push(unlisten);
    });

    // 停止说话事件
    listen<number>("speech_ended", (event) => {
      console.log("🔇 [停止说话] 时长:", event.payload.toFixed(2), "秒");
    }).then((unlisten) => {
      console.log("✅ [已注册] speech_ended 监听器");
      unlistenList.push(unlisten);
    });

    // 错误事件
    listen<string>("voice_error", (event) => {
      console.error("❌ [语音错误]", event.payload);
      alert(`语音错误: ${event.payload}`);
    }).then((unlisten) => unlistenList.push(unlisten));

    // 麦克风测试音量更新事件
    listen<{
      volume: number;
      duration_secs: number;
      samples: number;
    }>("microphone_test_update", (event) => {
      setTestVolume(event.payload.volume);
      setTestDuration(event.payload.duration_secs);
      setTestSamples(event.payload.samples);
    }).then((unlisten) => unlistenList.push(unlisten));

    // 麦克风测试结束事件 (10秒自动结束)
    listen("microphone_test_finished", () => {
      setIsTesting(false);
    }).then((unlisten) => {
      console.log("✅ [已注册] microphone_test_finished 监听器");
      unlistenList.push(unlisten);
    });

    // 阿里云识别请求事件 (后端触发) - 使用 once 防止重复处理
    const recognizeRequestHandled = new Set<string>();
    
    listen<{
      pcm_data: number[];
      sample_rate: number;
      duration_secs: number;
    }>("aliyun_recognize_request", async (event) => {
      // 生成唯一ID防止重复处理
      const eventId = `${event.payload.pcm_data.length}_${event.payload.sample_rate}_${event.payload.duration_secs}`;
      
      if (recognizeRequestHandled.has(eventId)) {
        console.log("⚠️ [跳过重复] 识别请求已处理:", eventId);
        return;
      }
      recognizeRequestHandled.add(eventId);
      
      console.log("🎯🎯🎯 [收到阿里云识别请求!!!]");
      console.log(
        "🎯 [收到阿里云识别请求]",
        `${event.payload.pcm_data.length} 字节, ${event.payload.sample_rate}Hz, ${event.payload.duration_secs.toFixed(1)}s`,
      );

      try {
        // 从设置中获取阿里云配置
        const settings = await invoke<any>("get_app_settings");
        const aliyunAccessKey = settings.tts?.aliyun_access_key;
        const aliyunAccessSecret = settings.tts?.aliyun_access_secret;
        const aliyunAppKey = settings.tts?.aliyun_appkey;

        if (!aliyunAccessKey || !aliyunAccessSecret || !aliyunAppKey) {
          console.error("❌ 阿里云配置不完整");
          alert("请先在设置中配置阿里云 Access Key 和 AppKey");
          recognizeRequestHandled.delete(eventId); // 失败时清除标记
          return;
        }

        console.log("🚀 [开始调用阿里云识别]");

        // 调用阿里云一句话识别
        const result = await invoke<string>("aliyun_one_sentence_recognize", {
          app: null, // AppHandle 会自动注入
          appkey: aliyunAppKey,
          accessKey: aliyunAccessKey,
          accessSecret: aliyunAccessSecret,
          pcmData: event.payload.pcm_data,
          region: "cn-shanghai",
        });

        console.log("✅ [识别结果]", result);

        // 不再添加到本地列表,由自定义事件触发 AIAssistant 统一处理
        if (result && result.trim()) {
          // 🎯 触发自定义事件: 语音识别完成 (传递识别文字)
          console.log("📢 [触发事件] voice_recognition_completed:", result);
          window.dispatchEvent(new CustomEvent("voice_recognition_completed", {
            detail: { text: result }
          }));
        }
        
        // 成功后清除标记(允许下次相同长度的音频)
        setTimeout(() => recognizeRequestHandled.delete(eventId), 5000);
      } catch (error) {
        console.error("❌ [阿里云识别失败]", error);
        alert(`语音识别失败: ${error}`);
        recognizeRequestHandled.delete(eventId); // 失败时清除标记
      }
    }).then((unlisten) => {
      console.log("✅✅✅ [已注册] aliyun_recognize_request 监听器 !!!");
      unlistenList.push(unlisten);
    });

    // 阿里云 ASR 文本事件
    listen<string>("aliyun_asr_event", (event) => {
      console.log("🌐 [阿里云 ASR 原始事件]", event.payload);
      try {
        const data = JSON.parse(event.payload);
        // 处理不同类型的 ASR 事件
        if (data.header) {
          const msgName = data.header.name;
          console.log("📡 [ASR 事件类型]", msgName);

          if (msgName === "TranscriptionStarted") {
            // 会话开始
            console.log("🚀 [会话开始]", data.payload);
          } else if (msgName === "TranscriptionResultChanged") {
            // 中间识别结果
            const text = data.payload?.result;
            if (text) {
              console.log("📝 [中间结果]", text);
            }
          } else if (msgName === "RecognitionResultChanged") {
            // 一句话识别的中间结果
            const text = data.payload?.result;
            if (text) {
              console.log("📝 [一句话识别中间结果]", text);
            }
          } else if (msgName === "RecognitionCompleted") {
            // 一句话识别完成 - 不要在这里添加结果，因为已经在 aliyun_recognize_request 中添加了
            const text = data.payload?.result;
            if (text) {
              console.log(
                "✅ [一句话识别完成]",
                text,
                "（不添加到列表，避免重复）",
              );
            }
          } else if (msgName === "SentenceEnd") {
            // 句子结束(最终识别结果) - 仅用于流式识别
            const text = data.payload?.result;
            if (text) {
              console.log("✅ [流式识别最终结果]", text);
              // 注意: 一句话识别不会触发这个事件，只在流式识别时才会添加
              // setTranscriptions((prev) => [...prev, text]);
            }
          } else if (msgName === "SentenceBegin") {
            console.log("🎤 [句子开始]", data.payload);
          } else if (msgName === "TranscriptionCompleted") {
            console.log("🏁 [会话完成]");
          } else {
            // 其他事件(如错误)
            console.log(`📡 [${msgName}]`, data);
          }
        }
      } catch (error) {
        console.error("解析阿里云 ASR 事件失败:", error);
      }
    }).then((unlisten) => unlistenList.push(unlisten));

    // 阿里云 ASR 二进制事件 (base64)
    listen<string>("aliyun_asr_event_bin", (event) => {
      console.log(
        "📦 [阿里云 ASR 二进制数据]",
        event.payload.substring(0, 50) + "...",
      );
    }).then((unlisten) => unlistenList.push(unlisten));

    // 定时更新状态
    const interval = setInterval(loadState, 500);

    return () => {
      console.log("🧹 [清理] 取消注册事件监听器");
      unlistenList.forEach((unlisten) => unlisten());
      clearInterval(interval);
      listenersRegistered.current = false; // 重置标志，允许下次重新注册
    };
  }, []);

  // 初始加载状态
  useEffect(() => {
    loadState();
  }, []);

  // 获取状态显示文本
  const getStateText = () => {
    if (!listenerState) return "未初始化";
    if (!listenerState.is_listening) return "等待你说话";

    switch (listenerState.vad_state) {
      case "Idle":
        return "等待你说话";
      case "Speaking":
        return `正在说话... (${listenerState.recording_duration.toFixed(1)}s)`;
      case "Processing":
        return "AI 思考中...";
      default:
        return "未知状态";
    }
  };

  return (
    <div className="voice-chat-panel">
      {/* 头部控制区 */}
      <div className="header-section">
        <div className="header-title-row">
          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {" "}
            <Mic size={20} /> 语音对话
          </h3>
          {!isTesting ? (
            <Button onClick={handleStartTest}>测试麦克风</Button>
          ) : (
            <Button danger onClick={handleStopTest}>
              停止测试
            </Button>
          )}
        </div>
        {/* 麦克风测试进度 */}
        {isTesting && (
          <div className="microphone-test-panel">
            <div className="volume-label">
              <span>实时音量</span>
              <span className="test-duration">
                {testDuration.toFixed(1)}s / 10.0s
              </span>
            </div>

            <Progress
              percent={testVolume * 100}
              format={(percent) => `${(percent || 0).toFixed(1)}`}
            />
            <div className="test-stats">
              <div className="stat-item">
                <span className="stat-label">采集样本:</span>
                <span className="stat-value">
                  {testSamples.toLocaleString()}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">状态:</span>
                <span
                  className="stat-value"
                  style={{
                    color:
                      testVolume > 0.01
                        ? "green"
                        : testVolume > 0.001
                          ? "orange"
                          : "red",
                  }}
                >
                  {testVolume > 0.01
                    ? "检测到声音"
                    : testVolume > 0.001
                      ? "声音较弱"
                      : "无声音"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 主控制按钮 */}
        <div className="control-buttons">
          {!isListening ? (
            <button className="start-button" onClick={handleStartListening}>
              <Mic size={20} />
              <span>开始对话</span>
            </button>
          ) : (
            <button className="stop-button" onClick={handleStopListening}>
              <MicOff size={20} />
              <span>停止对话</span>
            </button>
          )}
        </div>

        {/* 状态显示 */}
        <div className="status-display">
          <div className="status-row">
            <div
              className={`status-indicator ${isListening ? "active" : "inactive"}`}
            />
            <span
              className={`status-text ${
                !listenerState?.is_listening
                  ? "disabled"
                  : listenerState.vad_state === "Speaking"
                    ? "speaking"
                    : listenerState.vad_state === "Processing"
                      ? "processing"
                      : "idle"
              }`}
            >
              {getStateText()}
            </span>
          </div>

          {/* 音量指示器 */}
          {listenerState?.is_listening &&
            listenerState.vad_state === "Speaking" && (
              <div className="volume-indicator">
                <div className="volume-row">
                  <Volume2 className="volume-icon" />
                  <div className="volume-bar-container">
                    <div
                      className="volume-bar"
                      style={{
                        width: `${Math.min(100, (listenerState.recording_duration / 30) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="volume-text">
                    {listenerState.recording_duration.toFixed(1)}s
                  </span>
                </div>
              </div>
            )}
        </div>
      </div>

      {/* 对话显示区 - 使用共享组件 */}
      <div className="conversation-section">
        <ConversationArea
          messages={messages}
          isThinking={isThinking}
          currentGame={currentGame}
          onDeleteMessage={deleteMessage}
        />
      </div>

      {/* 底部提示 */}
      <div className="footer-section">
        <div className="status-legend">
          <div className="legend-item">
            <div className="legend-dot green" />
            <span>待机</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot red" />
            <span>说话中</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot blue" />
            <span>处理中</span>
          </div>
        </div>
        <p className="hint-text">
          💡 提示: 说话结束后系统会自动检测静音并开始识别
        </p>
      </div>
    </div>
  );
};
