// HUD 浮窗组件 - 游戏内显示的小型状态指示器
import React, { useState, useEffect } from "react";
import { Card } from "antd";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
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
      onDoubleClick={handleDoubleClick}
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

        {/* 提示文字 */}
        <div className="hud-hint">
          双击最小化 · 拖动调整位置
        </div>
      </Card>
    </div>
  );
};

export default HudOverlay;
