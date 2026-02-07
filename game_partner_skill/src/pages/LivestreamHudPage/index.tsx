import React, { useState, useEffect } from "react";
import { Card, Select, Button, Badge, Tag, message } from "antd";
import {
  UserOutlined,
  PhoneOutlined,
  MessageOutlined,
} from "@ant-design/icons";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useSimulationStore } from "../../stores/simulationStore";
import { useAIAssistantStore } from "../../stores/aiAssistantStore";
import { getGameById } from "../../services/configService";
import { ConversationArea } from "../../components/ConversationArea";
import "./index.scss";

export const LivestreamHudPage: React.FC = () => {
  const { config } = useSimulationStore();
  const { messages, currentGame, isThinking, setCurrentGame, deleteMessage } =
    useAIAssistantStore();

  const [availableGames, setAvailableGames] = useState<any[]>([]);
  const [onMicEmployees, setOnMicEmployees] = useState<Set<string>>(new Set());
  const [isStarted, setIsStarted] = useState(false);

  const livestream = config.livestream!;

  // 加载可用游戏列表
  useEffect(() => {
    const loadGames = async () => {
      try {
        const libraries = await invoke<any[]>("scan_downloaded_libraries");
        const settings = await invoke<any>("get_app_settings");
        const selectedGameIds = settings.user?.selected_games || [];

        const gamesWithSkills = [
          ...new Set(libraries.map((lib) => lib.gameId)),
        ];
        const filteredIds = selectedGameIds.filter((id: string) =>
          gamesWithSkills.includes(id),
        );

        const games = await Promise.all(
          filteredIds.map((id: string) => getGameById(id)),
        );
        setAvailableGames(games.filter(Boolean));
      } catch (error) {
        console.error("加载游戏列表失败:", error);
      }
    };
    loadGames();
  }, []);

  // 监听游戏切换事件
  useEffect(() => {
    const setupListener = async () => {
      const unlisten = await listen<{ gameId: string }>(
        "game-changed",
        (event) => {
          setCurrentGame(event.payload.gameId);
        },
      );
      return unlisten;
    };

    let unlistenFn: (() => void) | null = null;
    setupListener().then((fn) => {
      unlistenFn = fn;
    });

    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, [setCurrentGame]);

  // 处理游戏切换
  const handleGameChange = async (gameId: string) => {
    setCurrentGame(gameId);
    try {
      const { emit } = await import("@tauri-apps/api/event");
      await emit("game-changed", { gameId });
    } catch (error) {
      console.error("发送游戏切换事件失败:", error);
    }
  };

  // 切换上麦状态
  const toggleMic = (employeeId: string) => {
    setOnMicEmployees((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(employeeId)) {
        newSet.delete(employeeId);
        message.info("已下麦");
      } else {
        newSet.add(employeeId);
        message.success("已上麦");
      }
      return newSet;
    });
  };

  // 开始对话
  const handleStartConversation = () => {
    if (!currentGame) {
      message.warning("请先选择游戏");
      return;
    }
    setIsStarted(true);
    message.success("开始对话");
  };

  return (
    <div className="livestream-hud-page">
      {/* 头部信息 */}
      <Card className="header-card" size="small">
        <div className="header-row">
          <div className="livestream-info">
            <h2>{livestream.roomName}</h2>
            <Tag color="blue" icon={<UserOutlined />}>
              {livestream.onlineUsers} 在线
            </Tag>
          </div>
        </div>
        <p className="livestream-desc">{livestream.roomDescription}</p>

        {/* 游戏选择 */}
        <div className="game-select-row">
          {/* <span style={{ marginRight: 8 }}>选择游戏:</span> */}
          <Select
            value={currentGame}
            onChange={handleGameChange}
            placeholder="选择游戏"
            style={{ width: "100%" }}
          >
            {availableGames.map((game) => (
              <Select.Option key={game!.id} value={game!.id}>
                {game!.name}
              </Select.Option>
            ))}
          </Select>
        </div>
      </Card>

      {/* 主内容区 */}
      <div className="main-content">
        {/* 左侧: 弹幕对话窗 */}
        <Card className="chat-card" title="弹幕对话" size="small">
          <ConversationArea
            messages={messages}
            isThinking={isThinking}
            currentGame={currentGame}
            onDeleteMessage={deleteMessage}
          />
        </Card>

        {/* 右侧: AI 员工列表 */}
        <Card className="employees-card" title="员工列表" size="small">
          <div className="employees-list">
            {config.employees.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  color: "#999",
                  padding: "20px 0",
                }}
              >
                暂无 AI 员工
              </div>
            )}

            {config.employees.map((employee) => {
              const isOnMic = onMicEmployees.has(employee.id);
              return (
                <div
                  key={employee.id}
                  className={`employee-item ${isOnMic ? "on-mic" : ""}`}
                >
                  <div className="employee-info">
                    <Badge
                      status={isOnMic ? "success" : "default"}
                      text={
                        <span
                          style={{ color: isOnMic ? "#52c41a" : undefined }}
                        >
                          {employee.nickname}
                        </span>
                      }
                    />
                    <Tag>
                      {employee.personality === "sunnyou_male"
                        ? "损友男"
                        : employee.personality === "funny_female"
                          ? "搞笑女"
                          : employee.personality === "kobe"
                            ? "Kobe"
                            : employee.personality === "sweet_girl"
                              ? "甜妹"
                              : "特朗普"}
                    </Tag>
                  </div>
                  <Button
                    size="small"
                    type={isOnMic ? "primary" : "default"}
                    icon={<PhoneOutlined />}
                    onClick={() => toggleMic(employee.id)}
                  >
                    {isOnMic ? "下麦" : "上麦"}
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* 底部控制 */}
      <div className="footer-controls">
        <Button
          block
          type="primary"
          size="large"
          disabled={!currentGame || isStarted}
          onClick={handleStartConversation}
        >
          {isStarted ? "对话进行中..." : "开始对话"}
        </Button>
      </div>
    </div>
  );
};

export default LivestreamHudPage;
