// HUD 浮窗组件 - 游戏内显示的小型状态指示器
import React, { useState, useEffect } from "react";
import { Card, Select, Button, message as antdMessage } from "antd";
import { PlayCircleOutlined, PauseCircleOutlined } from "@ant-design/icons";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { getGameById } from "../../services/configService";
import { useAIAssistantStore } from "../../stores/aiAssistantStore";
import "./HudOverlay.scss";
import { Mic, MicOff } from "lucide-react";

interface HudState {
  isListening: boolean;      // 是否正在监听
  aiStatus: string;          // AI 状态文字
  statusColor: string;       // 状态颜色
}

interface ListenerState {
  vad_state: "Idle" | "Speaking" | "Processing";
  is_listening: boolean;
  recording_duration: number;
  buffer_size: number;
  last_transcription: string | null;
}

export const HudOverlay: React.FC = () => {
  const [state, setState] = useState<HudState>({
    isListening: false,
    aiStatus: "待机中",
    statusColor: "#666",
  });

  const [listenerState, setListenerState] = useState<ListenerState | null>(null);
  const [availableGames, setAvailableGames] = useState<any[]>([]);
  const [downloadedLibraries, setDownloadedLibraries] = useState<any[]>([]);
  
  // 🔥 使用共享的 zustand store
  const { currentGame, setCurrentGame: setStoreGame } = useAIAssistantStore();
  
  // 包装 setCurrentGame,同时通过事件通知主窗口
  const setCurrentGame = async (gameId: string) => {
    // 1. 更新本地 store
    setStoreGame(gameId);
    
    // 2. 发送事件到主窗口
    try {
      const { emit } = await import("@tauri-apps/api/event");
      await emit("game-changed", { gameId });
    } catch (error) {
      console.error("❌ 发送事件失败:", error);
    }
  };
  
  const handleGameChange = (gameId: string) => {
    setCurrentGame(gameId);
  };

  // 加载监听器状态
  const loadState = async () => {
    try {
      const backendState = await invoke<ListenerState>("get_listener_state");
      setListenerState(backendState);
      
      // 同步 isListening 状态
      setState(prev => ({
        ...prev,
        isListening: backendState.is_listening,
      }));
    } catch (error) {
      console.error("获取监听器状态失败:", error);
    }
  };

  // ✅ 从后端加载已下载的技能库
  useEffect(() => {
    const loadLibraries = async () => {
      try {
        const libraries = await invoke<any[]>('scan_downloaded_libraries');
        setDownloadedLibraries(libraries);
      } catch (error) {
        console.error('扫描技能库失败:', error);
      }
    };
    loadLibraries();
  }, []);

  // ✅ 从后端加载用户选择的游戏并过滤出有技能库的
  useEffect(() => {
    const loadAvailableGames = async () => {
      try {
        const settings = await invoke<any>('get_app_settings');
        const selectedGameIds = settings.user?.selected_games || [];
        
        // 获取有技能库的游戏 ID
        const gamesWithSkills = [...new Set(downloadedLibraries.map((lib) => lib.gameId))];
        
        // 过滤出既被选择又有技能库的游戏
        const filteredIds = selectedGameIds.filter((id: string) => gamesWithSkills.includes(id));
        
        const games = await Promise.all(
          filteredIds.map((id: string) => getGameById(id))
        );
        const validGames = games.filter(Boolean);
        
        setAvailableGames(validGames);
      } catch (error) {
        console.error('加载游戏配置失败:', error);
      }
    };
    
    if (downloadedLibraries.length > 0) {
      loadAvailableGames();
    }
  }, [downloadedLibraries]);

  useEffect(() => {
    // 初始加载状态
    loadState();
    
    // 定时更新状态(500ms轮询)
    const interval = setInterval(loadState, 500);
    
    // 存储所有的 unlisten 函数
    const unlistenFunctions: Array<() => void> = [];
    
    // 🔥 设置所有事件监听器
    const setupListeners = async () => {
      try {
        // 监听来自主窗口的游戏切换事件
        const unlistenGameChange = await listen<{ gameId: string }>("game-changed", (event) => {
          setStoreGame(event.payload.gameId);
        });
        unlistenFunctions.push(unlistenGameChange);

        // 语音开始
        const unlistenSpeechStarted = await listen("speech_started", () => {
          setState(prev => ({
            ...prev,
            aiStatus: "正在聆听...",
            statusColor: "#1890ff", // 蓝色
          }));
        });
        unlistenFunctions.push(unlistenSpeechStarted);

        // 语音结束
        const unlistenSpeechEnded = await listen("speech_ended", () => {
          setState(prev => ({
            ...prev,
            aiStatus: "识别中...",
            statusColor: "#faad14", // 橙色
          }));
        });
        unlistenFunctions.push(unlistenSpeechEnded);

        // 识别完成 (语音转文字完成)
        const unlistenRecognizeRequest = await listen("aliyun_recognize_request", () => {
          // 不改变状态,因为马上就要截图了
        });
        unlistenFunctions.push(unlistenRecognizeRequest);
        
        // 开始截图
        const unlistenScreenshotStarted = await listen("screenshot_started", () => {
          setState(prev => ({
            ...prev,
            aiStatus: "正在截图...",
            statusColor: "#13c2c2", // 青色
          }));
        });
        unlistenFunctions.push(unlistenScreenshotStarted);

        // AI 思考中
        const unlistenAiThinking = await listen("ai_thinking", () => {
          setState(prev => ({
            ...prev,
            aiStatus: "AI 思考中...",
            statusColor: "#722ed1", // 紫色
          }));
        });
        unlistenFunctions.push(unlistenAiThinking);

        // AI 回答
        const unlistenAiResponse = await listen("ai_response_ready", () => {
          setState(prev => ({
            ...prev,
            aiStatus: "正在回答...",
            statusColor: "#52c41a", // 绿色
          }));

          // 3秒后回到待机
          setTimeout(() => {
            setState(prev => ({
              ...prev,
              aiStatus: "待机中",
              statusColor: "#666",
            }));
          }, 3000);
        });
        unlistenFunctions.push(unlistenAiResponse);
      } catch (error) {
        console.error("❌ [HUD] 设置事件监听器失败:", error);
      }
    };
    
    setupListeners();
    
    return () => {
      // 清理所有监听器
      unlistenFunctions.forEach(unlisten => unlisten());
      clearInterval(interval);
    };
  }, [setStoreGame]);

  // 开始/停止对话
  const handleToggleConversation = async () => {
    try {
      if (state.isListening) {
        // 停止对话
        await invoke("stop_continuous_listening");
        antdMessage.info("已停止语音监听");
      } else {
        // 开始对话 - 使用与 VoiceChatPanel 相同的 VAD 配置
        const vadConfig = {
          volume_threshold: 0.02,
          silence_duration_secs: 1.5,
          min_speech_duration_secs: 0.3,
          max_speech_duration_secs: 30.0,
        };
        await invoke("start_continuous_listening", { vadConfig });
        antdMessage.success("语音监听已启动");
      }
    } catch (error) {
      console.error("切换对话状态失败:", error);
      antdMessage.error(`操作失败: ${error}`);
    }
  };

  // 双击最小化
  const handleDoubleClick = async () => {
    try {
      const hudWindow = getCurrentWindow();
      await hudWindow.minimize();
    } catch (error) {
      console.error("最小化失败:", error);
    }
  };

  return (
    <div 
      className="hud-overlay-container"
    >
      <Card className="hud-card" bordered={false}>
        <div className="hud-content">
          {/* 状态指示灯 */}
          <div className="status-indicator">
            <div 
              className={`status-light ${state.isListening ? "active" : "inactive"}`}
              title={state.isListening ? "监听中" : "已暂停"}
            />
          </div>

          {/* 状态文字 */}
          <div className="status-text-container">
            <div 
              className="status-text"
              style={{ color: state.statusColor }}
            >
              {state.aiStatus}
            </div>
          </div>
        </div>

        {/* 游戏选择 */}
        <div className="hud-game-selector" style={{ marginTop: 8 }}>
          <Select
            value={currentGame || undefined}
            onChange={handleGameChange}
            placeholder="选择游戏"
            style={{ width: "100%" }}
            disabled={state.isListening}
          >
            {availableGames.map((game: any) => (
              <Select.Option key={game.id} value={game.id}>
                {game.name}
              </Select.Option>
            ))}
          </Select>
        </div>

        {/* 开始/停止按钮 */}
        <div className="hud-controls" style={{ marginTop: 8 }}>
          <Button
            type={state.isListening ? "default" : "primary"}
            icon={state.isListening ? <MicOff size={18}></MicOff> : <Mic size={18}></Mic>}
            onClick={handleToggleConversation}
            block
            danger={state.isListening}
          >
            {state.isListening ? "停止对话" : "开始对话"}
          </Button>
        </div>

        {/* 提示文字 */}
        <div className="hud-hint" onDoubleClick={handleDoubleClick}>
          双击此处最小化 · 拖动调整位置
        </div>
      </Card>
    </div>
  );
};

export default HudOverlay;
