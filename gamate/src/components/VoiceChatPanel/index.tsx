// Voice Chat Panel Component
// 持续监听模式的语音聊话界面

import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Mic, MicOff, Volume2 } from "lucide-react";
import { Button, Modal, Progress, Switch, message } from "antd";
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
  
  // HUD 可见性状态
  const [hudVisible, setHudVisible] = useState(false);

  // 使用共享的对话Store
  const { messages, isThinking, currentGame, deleteMessage } =
    useAIAssistantStore();

  // 麦克风测试状态
  const [isTesting, setIsTesting] = useState(false);
  const [testVolume, setTestVolume] = useState(0);
  const [testDuration, setTestDuration] = useState(0);
  const [testSamples, setTestSamples] = useState(0);

  // 使用 ref 防止重复注册监听器
  const listenersRegistered = React.useRef(false);
  
  // 检查 HUD 窗口可见性
  useEffect(() => {
    const checkHudVisibility = async () => {
      try {
        const visible = await invoke<boolean>('is_hud_window_visible');
        setHudVisible(visible);
      } catch (error) {
        console.error('检查 HUD 可见性失败:', error);
      }
    };
    checkHudVisibility();
  }, []);
  
  // 切换 HUD 窗口
  const handleToggleHud = async (checked: boolean) => {
    try {
      if (checked) {
        await invoke("open_hud_window");
        setHudVisible(true);
        message.success("HUD 浮窗已打开");
      } else {
        await invoke("close_hud_window");
        setHudVisible(false);
        message.info("HUD 浮窗已关闭");
      }
    } catch (error) {
      message.error(`HUD 操作失败: ${error}`);
      setHudVisible(!checked);
    }
  };

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

    console.log("🔧 [初始化] 注册语音事件监听器");
    listenersRegistered.current = true;

    const unlistenList: (() => void)[] = [];

    // 语音转文字事件
    listen<string>("voice_transcribed", (event) => {
      console.log("📝 [语音转文字]", event.payload);
    }).then((unlisten) => unlistenList.push(unlisten));

    // 开始说话事件
    listen("speech_started", () => {
      console.log("🎤 [开始说话]");
    }).then((unlisten) => unlistenList.push(unlisten));

    // 停止说话事件
    listen<number>("speech_ended", (event) => {
      console.log("🔇 [停止说话] 时长:", event.payload.toFixed(2), "秒");
    }).then((unlisten) => unlistenList.push(unlisten));

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
    }).then((unlisten) => unlistenList.push(unlisten));

    // 阿里云识别请求事件 (后端触发)
    const recognizeRequestHandled = new Set<string>();
    const processingRequests = new Set<string>();

    listen<{
      pcm_data: number[];
      sample_rate: number;
      duration_secs: number;
    }>("aliyun_recognize_request", async (event) => {
      const eventId = `${event.payload.pcm_data.length}_${event.payload.sample_rate}_${event.payload.duration_secs}`;

      // 检查是否正在处理或已处理
      if (processingRequests.has(eventId)) {
        return; // 跳过重复请求
      }

      if (recognizeRequestHandled.has(eventId)) {
        return; // 跳过已处理
      }

      // 标记为正在处理
      processingRequests.add(eventId);
      recognizeRequestHandled.add(eventId);

      console.log(
        "🎯 [收到识别请求]",
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
          processingRequests.delete(eventId);
          recognizeRequestHandled.delete(eventId);
          return;
        }

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

        // 触发自定义事件,传递给 AIAssistant 处理
        if (result && result.trim()) {
          console.log("📢 [触发语音识别完成事件]");
          window.dispatchEvent(
            new CustomEvent("voice_recognition_completed", {
              detail: { text: result },
            }),
          );
        }

        // 处理完成后移除正在处理标记
        processingRequests.delete(eventId);

        // 5秒后清除已处理标记(允许下次相同长度的音频)
        setTimeout(() => recognizeRequestHandled.delete(eventId), 5000);
      } catch (error) {
        console.error(" ❌ [阿里云识别失败]", error);
        processingRequests.delete(eventId);
        recognizeRequestHandled.delete(eventId);
      }
    }).then((unlisten) => unlistenList.push(unlisten));

    // 阿里云 ASR 文本事件
    const processedAsrEvents = new Set<string>();

    listen<string>("aliyun_asr_event", (event) => {
      try {
        const data = JSON.parse(event.payload);

        const eventKey = `${data.header?.task_id}_${data.header?.message_id}_${data.header?.name}`;

        if (processedAsrEvents.has(eventKey)) {
          return;
        }
        processedAsrEvents.add(eventKey);

        if (processedAsrEvents.size > 100) {
          const iter = processedAsrEvents.values();
          const firstKey = iter.next().value;
          if (firstKey) {
            processedAsrEvents.delete(firstKey);
          }
        }

        // 只记录关键事件,忽略中间结果
        if (data.header) {
          const msgName = data.header.name;

          if (msgName === "RecognitionCompleted") {
            // 一句话识别完成 - 最终结果
            const text = data.payload?.result;
            if (text) {
              console.log("✅ [识别完成]", text);
            }
          } else if (msgName === "TaskFailed") {
            // 任务失败
            console.error("❌ [识别失败]", data.header.status_text);
          } else if (msgName === "SentenceEnd") {
            // 流式识别最终结果
            const text = data.payload?.result;
            if (text) {
              console.log("✅ [流式识别完成]", text);
            }
          }
          // 其他中间事件（RecognitionResultChanged等）不再记录日志
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
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14 }}>HUD 浮窗:</span>
              <Switch
                checked={hudVisible}
                onChange={handleToggleHud}
                checkedChildren="显示"
                unCheckedChildren="关闭"
              />
            </div>
            {!isTesting ? (
              <Button onClick={handleStartTest}>测试麦克风</Button>
            ) : (
              <Button danger onClick={handleStopTest}>
                停止测试
              </Button>
            )}
          </div>
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
            <Button
              icon={<Mic size={20} />}
              onClick={handleStartListening}
              disabled={!currentGame}
              type="primary"
              style={{ border: "none", cursor: currentGame ? "pointer" : "not-allowed" }}
            >
              开始对话
            </Button>
          ) : (
            <Button
              className="stop-button"
              onClick={handleStopListening}
              danger
              icon={<MicOff size={20} />}
              variant="filled"
            >
              停止对话
            </Button>
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
      {/* <div className="footer-section">
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
          提示: 说话结束后系统会自动检测静音并开始识别
        </p>
      </div> */}
    </div>
  );
};
