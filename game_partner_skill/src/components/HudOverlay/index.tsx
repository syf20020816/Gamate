// HUD 浮窗组件 - 游戏内显示的小型状态指示器
import React, { useState, useEffect } from "react";
import { Card, Select, Button, message as antdMessage } from "antd";
import { PlayCircleOutlined, PauseCircleOutlined } from "@ant-design/icons";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { getGameById } from "../../services/configService";
import "./HudOverlay.scss";

interface HudState {
  isListening: boolean;      // 是否正在监听
  aiStatus: string;          // AI 状态文字
  statusColor: string;       // 状态颜色
}

export const HudOverlay: React.FC = () => {
  const [state, setState] = useState<HudState>({
    isListening: false,
    aiStatus: "待机中",
    statusColor: "#666",
  });

  const [availableGames, setAvailableGames] = useState<any[]>([]);
  const [selectedGame, setSelectedGame] = useState<string>("");
  const [downloadedLibraries, setDownloadedLibraries] = useState<any[]>([]);

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
        
        console.log('✅ [HUD] 加载可用游戏:', validGames.map((g: any) => g?.name));
      } catch (error) {
        console.error('加载游戏配置失败:', error);
      }
    };
    
    if (downloadedLibraries.length > 0) {
      loadAvailableGames();
    }
  }, [downloadedLibraries]);

  useEffect(() => {
    // 监听语音识别事件
    const listeners: Array<() => void> = [];

    // 语音开始
    listen("speech_started", () => {
      setState(prev => ({
        ...prev,
        aiStatus: "正在聆听...",
        statusColor: "#1890ff", // 蓝色
      }));
    }).then(unlisten => listeners.push(unlisten));

    // 语音结束
    listen("speech_ended", () => {
      setState(prev => ({
        ...prev,
        aiStatus: "正在处理...",
        statusColor: "#faad14", // 橙色
      }));
    }).then(unlisten => listeners.push(unlisten));

    // 识别完成
    listen("aliyun_recognize_request", () => {
      setState(prev => ({
        ...prev,
        aiStatus: "正在截图...",
        statusColor: "#13c2c2", // 青色
      }));
    }).then(unlisten => listeners.push(unlisten));

    // AI 思考中
    listen("ai_thinking", () => {
      setState(prev => ({
        ...prev,
        aiStatus: "AI 思考中...",
        statusColor: "#722ed1", // 紫色
      }));
    }).then(unlisten => listeners.push(unlisten));

    // AI 回答
    listen("ai_response_ready", () => {
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
    }).then(unlisten => listeners.push(unlisten));

    // 监听状态变化
    listen<{ is_listening: boolean }>("listener_state_changed", (event) => {
      setState(prev => ({
        ...prev,
        isListening: event.payload.is_listening,
        aiStatus: event.payload.is_listening ? "待机中" : "已暂停",
        statusColor: event.payload.is_listening ? "#666" : "#999",
      }));
    }).then(unlisten => listeners.push(unlisten));

    return () => {
      listeners.forEach(unlisten => unlisten());
    };
  }, []);

  // 开始/停止对话
  const handleToggleConversation = async () => {
    if (!selectedGame) {
      antdMessage.warning("请先选择游戏");
      return;
    }

    try {
      if (state.isListening) {
        // 停止对话
        await invoke("stop_voice_listener");
        antdMessage.info("已停止语音监听");
      } else {
        // 开始对话
        await invoke("start_voice_listener", { gameId: selectedGame });
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
            value={selectedGame}
            onChange={setSelectedGame}
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
            icon={state.isListening ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
            onClick={handleToggleConversation}
            block
            danger={state.isListening}
            disabled={!selectedGame && !state.isListening}
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
