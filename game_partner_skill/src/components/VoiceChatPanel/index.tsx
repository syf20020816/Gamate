// Voice Chat Panel Component
// 持续监听模式的语音聊话界面

import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Mic, MicOff, Volume2 } from "lucide-react";
import { Button } from "antd";
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
  const [transcriptions, setTranscriptions] = useState<string[]>([]);
  
  // 麦克风测试状态
  const [isTesting, setIsTesting] = useState(false);
  const [testVolume, setTestVolume] = useState(0);
  const [testDuration, setTestDuration] = useState(0);
  const [testSamples, setTestSamples] = useState(0);

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
      await invoke("stop_continuous_listening");
      setIsListening(false);
      console.log("⏹️ 已停止监听");
    } catch (error) {
      console.error("停止监听失败:", error);
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
      
      alert(
        `麦克风测试完成!\n` +
        `测试时长: ${result.duration_secs.toFixed(1)}s\n` +
        `采集样本: ${result.total_samples} 个\n` +
        `平均音量: ${result.average_volume.toFixed(4)}\n` +
        `最大音量: ${result.max_volume.toFixed(4)}\n\n` +
        `${result.max_volume < 0.001 ? '⚠️ 音量过低,请检查麦克风设置或权限' : '✅ 麦克风工作正常'}`
      );
    } catch (error) {
      console.error("停止麦克风测试失败:", error);
      alert(`停止测试失败: ${error}`);
      setIsTesting(false);
    }
  };

  // 监听事件
  useEffect(() => {
    const unlistenList: (() => void)[] = [];

    // 语音转文字事件
    listen<string>("voice_transcribed", (event) => {
      console.log("📝 语音转文字:", event.payload);
      setTranscriptions((prev) => [...prev, event.payload]);
    }).then((unlisten) => unlistenList.push(unlisten));

    // 开始说话事件
    listen("speech_started", () => {
      console.log("🎤 开始说话");
    }).then((unlisten) => unlistenList.push(unlisten));

    // 停止说话事件
    listen<number>("speech_ended", (event) => {
      console.log("🔇 停止说话, 时长:", event.payload);
    }).then((unlisten) => unlistenList.push(unlisten));

    // 错误事件
    listen<string>("voice_error", (event) => {
      console.error("❌ 语音错误:", event.payload);
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

    // 定时更新状态
    const interval = setInterval(loadState, 500);

    return () => {
      unlistenList.forEach((unlisten) => unlisten());
      clearInterval(interval);
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
          <h3>🎙️ 语音对话</h3>
          {!isTesting ? (
            <Button size="small" onClick={handleStartTest}>
              测试麦克风
            </Button>
          ) : (
            <Button size="small" danger onClick={handleStopTest}>
              停止测试
            </Button>
          )}
        </div>
        
        {/* 麦克风测试进度 */}
        {isTesting && (
          <div className="microphone-test-panel">
            <div className="test-header">
              <span className="test-title">📊 麦克风测试中...</span>
              <span className="test-duration">{testDuration.toFixed(1)}s / 10.0s</span>
            </div>
            
            <div className="test-volume-display">
              <div className="volume-label">实时音量</div>
              <div className="volume-bar-large">
                <div 
                  className="volume-bar-fill"
                  style={{ width: `${Math.min(100, testVolume * 1000)}%` }}
                />
              </div>
              <div className="volume-value">{testVolume.toFixed(4)}</div>
            </div>
            
            <div className="test-stats">
              <div className="stat-item">
                <span className="stat-label">采集样本:</span>
                <span className="stat-value">{testSamples.toLocaleString()}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">状态:</span>
                <span className="stat-value">
                  {testVolume > 0.01 ? '🟢 检测到声音' : 
                   testVolume > 0.001 ? '🟡 声音较弱' : 
                   '🔴 无声音'}
                </span>
              </div>
            </div>
            
            <div className="test-hint">
              💡 对着麦克风说话,观察音量变化。音量应该在 0.01 ~ 0.5 之间
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

      {/* 识别结果显示区 */}
      <div className="results-section">
        <h4 className="results-title">识别记录</h4>

        {transcriptions.length === 0 ? (
          <div className="empty-state">
            <Mic className="empty-icon" />
            <p>点击"开始对话"开始语音输入</p>
            <p className="hint">说话后会自动识别并转换为文字</p>
          </div>
        ) : (
          <div className="results-list">
            {transcriptions.map((text, index) => (
              <div key={index} className="result-item">
                <div className="result-content">
                  <div className="result-number">{index + 1}</div>
                  <div className="result-text-container">
                    <p className="result-text">{text}</p>
                    <p className="result-time">
                      {new Date().toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 最近一次识别 */}
        {listenerState?.last_transcription && (
          <div className="last-transcription">
            <p className="last-transcription-label">最近识别:</p>
            <p className="last-transcription-text">
              {listenerState.last_transcription}
            </p>
          </div>
        )}
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
