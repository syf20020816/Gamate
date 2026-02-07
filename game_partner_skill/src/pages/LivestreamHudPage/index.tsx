import React, { useState, useEffect, useRef } from "react";
import { Card, Select, Button, Badge, Tag, message, Tooltip } from "antd";
import {
  UserOutlined,
  PhoneOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
} from "@ant-design/icons";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { useSimulationStore } from "../../stores/simulationStore";
import { useAIAssistantStore } from "../../stores/aiAssistantStore";
import { getGameById } from "../../services/configService";
import { ConversationArea } from "../../components/ConversationArea";
import "./index.scss";

// 匹配后端的事件类型定义（注意：Rust serde 使用 snake_case）
type EventType =
  | {
      type: "danmaku";
      employee_id: string;
      nickname: string;
      message: string;
      personality: string;
    }
  | {
      type: "gift";
      employee_id: string;
      nickname: string;
      gift_name: string;
      count: number;
    }
  | {
      type: "greeting";
      employee_id: string;
      nickname: string;
      message: string;
    };

interface SimulationEvent {
  event_type: EventType; // 🔥 注意这里是 snake_case
  timestamp: number;
}

export const LivestreamHudPage: React.FC = () => {
  const { config, loadConfig } = useSimulationStore();
  const {
    messages,
    currentGame,
    isThinking,
    setCurrentGame,
    deleteMessage,
    addMessage,
  } = useAIAssistantStore();

  const [availableGames, setAvailableGames] = useState<any[]>([]);
  const [onMicEmployees, setOnMicEmployees] = useState<Set<string>>(new Set());
  const [isLivestreaming, setIsLivestreaming] = useState(false);
  const eventListenerRef = useRef<UnlistenFn | null>(null);

  const livestream = config.livestream!;

  // 🔥 直接从后端加载配置（因为这是独立窗口，无法共享 store）
  useEffect(() => {
    const loadSimulationConfig = async () => {
      try {
        console.log("===== LivestreamHudPage 加载配置 =====");
        const savedConfig = await invoke<any>("load_simulation_config");
        console.log("后端返回配置:", JSON.stringify(savedConfig, null, 2));
        console.log("员工数量:", savedConfig.employees?.length);

        loadConfig(savedConfig);

        console.log("✅ 配置已加载到 store");
        console.log("======================================");
      } catch (error) {
        console.error("❌ 加载模拟场景配置失败:", error);
      }
    };

    // 初始加载
    loadSimulationConfig();

    // 🔥 监听配置更新事件
    const setupConfigListener = async () => {
      const unlisten = await listen("simulation-config-updated", () => {
        console.log("📢 收到配置更新事件，重新加载配置...");
        loadSimulationConfig();
      });
      return unlisten;
    };

    let unlistenFn: (() => void) | null = null;
    setupConfigListener().then((fn) => {
      unlistenFn = fn;
    });

    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, [loadConfig]);

  // 调试: 打印配置信息
  useEffect(() => {
    console.log("===== 直播间配置调试 =====");
    console.log("完整配置:", JSON.stringify(config, null, 2));
    console.log("员工数组:", config.employees);
    console.log("员工数量:", config.employees.length);
    if (config.employees.length > 0) {
      console.log("第一个员工:", config.employees[0]);
    }
    console.log("==========================");
  }, [config]);

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

  // 监听模拟事件
  useEffect(() => {
    const setupEventListener = async () => {
      const unlisten = await listen<SimulationEvent>(
        "simulation_event",
        (event) => {
          console.log("===== 收到原始事件 =====");
          console.log("完整 event 对象:", JSON.stringify(event, null, 2));
          console.log("event.payload:", JSON.stringify(event.payload, null, 2));
          console.log("======================");
          handleSimulationEvent(event.payload);
        },
      );
      eventListenerRef.current = unlisten;
    };

    setupEventListener();

    return () => {
      if (eventListenerRef.current) {
        eventListenerRef.current();
      }
    };
  }, []);

  // 处理模拟事件
  const handleSimulationEvent = (event: SimulationEvent) => {
    console.log("===== 处理模拟事件 =====");
    console.log("event 对象:", event);
    console.log("event.event_type:", event.event_type);

    const eventType = event.event_type;
    console.log("eventType:", eventType);
    console.log("eventType.type:", eventType.type);

    switch (eventType.type) {
      case "danmaku": // 🔥 注意这里是小写
        console.log("处理弹幕事件:", {
          nickname: eventType.nickname,
          message: eventType.message,
          personality: eventType.personality,
        });
        // 添加弹幕消息到对话区
        addMessage({
          role: "assistant",
          content: eventType.message,
          aiPersonality: eventType.personality,
          nickname: eventType.nickname,
        });
        console.log("弹幕消息已添加");
        break;

      case "gift": // 🔥 注意这里是小写
        console.log("处理礼物事件:", {
          nickname: eventType.nickname,
          giftName: eventType.gift_name, // 🔥 注意这里是 snake_case
          count: eventType.count,
        });
        // 添加礼物消息到对话区
        addMessage({
          role: "system",
          content: `${eventType.nickname} 送出 ${eventType.gift_name} x${eventType.count}`,
        });
        message.success(
          `🎁 ${eventType.nickname} 送出 ${eventType.gift_name} x${eventType.count}`,
          2,
        );
        console.log("礼物消息已添加");
        break;

      case "greeting": // 🔥 注意这里是小写
        console.log("处理打招呼事件:", {
          nickname: eventType.nickname,
          message: eventType.message,
        });
        // 添加打招呼消息
        addMessage({
          role: "assistant",
          content: eventType.message,
          aiPersonality: "sunnyou_male",
          nickname: eventType.nickname,
        });
        console.log("打招呼消息已添加");
        break;
    }
    console.log("========================");
  };

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

  // 开始/停止直播
  const handleToggleLivestream = async () => {
    if (!currentGame) {
      message.warning("请先选择游戏");
      return;
    }

    try {
      if (isLivestreaming) {
        // 停止直播
        await invoke("stop_livestream_simulation");
        setIsLivestreaming(false);
        message.info("直播已停止");
      } else {
        // 开始直播
        await invoke("start_livestream_simulation");
        setIsLivestreaming(true);
        message.success("直播已开始！AI 员工开始活跃...");
      }
    } catch (error) {
      console.error("切换直播状态失败:", error);
      message.error(`操作失败: ${error}`);
    }
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
            itemStyle={{
              margin: 0,
              maxWidth: "100%",
            }}
            messages={messages}
            isThinking={isThinking}
            currentGame={currentGame}
            onDeleteMessage={deleteMessage}
          />
        </Card>

        {/* 右侧: AI 员工列表 */}
        <Card
          className="employees-card"
          title="员工列表"
          size="small"
          styles={{ body: { padding: 0 } }}
        >
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
                        <div
                          style={{
                            color: isOnMic ? "#52c41a" : undefined,
                          }}
                        ></div>
                      }
                    />
                    <Tooltip title={employee.nickname}>
                      <div
                        style={{
                          width: "60px",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          overflow: "clip",
                          minWidth: 52,
                          maxWidth: 52,
                        }}
                      >
                        {employee.nickname}
                      </div>
                    </Tooltip>

                    {/* <Tag>
                      {employee.personality === "sunnyou_male"
                        ? "损友男"
                        : employee.personality === "funny_female"
                          ? "搞笑女"
                          : employee.personality === "kobe"
                            ? "Kobe"
                            : employee.personality === "sweet_girl"
                              ? "甜妹"
                              : "特朗普"}
                    </Tag> */}
                  </div>
                  <Tooltip title={isOnMic ? "下麦" : "上麦"}>
                    <Button
                      size="small"
                      type={isOnMic ? "primary" : "default"}
                      icon={<PhoneOutlined />}
                      onClick={() => toggleMic(employee.id)}
                    ></Button>
                  </Tooltip>
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
          type={isLivestreaming ? "default" : "primary"}
          size="large"
          danger={isLivestreaming}
          disabled={!currentGame}
          icon={
            isLivestreaming ? <PauseCircleOutlined /> : <PlayCircleOutlined />
          }
          onClick={handleToggleLivestream}
        >
          {isLivestreaming ? "停止直播" : "开始直播"}
        </Button>
      </div>
    </div>
  );
};

export default LivestreamHudPage;
