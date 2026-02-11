import React, { useState, useEffect, useRef, useCallback } from "react";
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
import { DEFAULT_GAME } from "../../types/game";

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
  const [isSmartCaptureRunning, setIsSmartCaptureRunning] = useState(false);
  const eventListenerRef = useRef<UnlistenFn | null>(null);
  const smartCaptureListenerRef = useRef<UnlistenFn | null>(null);
  
  //  截图缺失计数器（连续2次双截图都缺失才报错）
  const screenshotErrorCountRef = useRef(0);
  const isProcessingRecognitionRef = useRef(false); // 防止重复处理
  
  //  防止 React.StrictMode 导致事件监听器重复注册
  const eventListenerSetupRef = useRef(false);
  
  //  防止重复处理同一个事件（通过 timestamp 去重）
  const processedEventTimestampsRef = useRef<Set<number>>(new Set());

  const livestream = config.livestream!;

  // 直接从后端加载配置（因为这是独立窗口，无法共享 store）
  useEffect(() => {
    const loadSimulationConfig = async () => {
      try {
        const savedConfig = await invoke<any>("load_simulation_config");
        loadConfig(savedConfig);
      } catch (error) {
        console.error("加载模拟场景配置失败:", error);
      }
    };

    loadSimulationConfig();

    // 监听配置更新事件
    const setupConfigListener = async () => {
      const unlisten = await listen("simulation-config-updated", () => {
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
        // 添加默认游戏
        const validGames = games.filter(Boolean);
        validGames.push(DEFAULT_GAME);
        setAvailableGames(validGames);
      } catch (error) {
        console.error("加载游戏列表失败:", error);
      }
    };
    loadGames();
  }, []);

  // 监听模拟事件
  useEffect(() => {
    // 防止 React.StrictMode 重复注册（只在第一次时注册）
    if (eventListenerSetupRef.current) {
      return;
    }
    
    eventListenerSetupRef.current = true;
    
    const setupEventListener = async () => {
      const unlisten = await listen<SimulationEvent>(
        "simulation_event",
        (event) => {
          handleSimulationEvent(event.payload);
        },
      );
      eventListenerRef.current = unlisten;
    };

    setupEventListener();

    return () => {
      if (eventListenerRef.current) {
        eventListenerRef.current();
        eventListenerRef.current = null;
      }
      eventListenerSetupRef.current = false;
    };
  }, []); // 保持空依赖数组，只在组件挂载时注册一次

  // 监听智能截图事件
  useEffect(() => {
    const setupSmartCaptureListener = async () => {
      // 临时存储截图数据
      let currentScreenshotBefore: string | null = null;
      let currentScreenshotAfter: string | null = null;

      // 监听智能截图事件
      const unlistenCapture = await listen("smart_capture_event", (event: any) => {
        const data = event.payload;

        switch (data.type) {
          case "SpeechStarted":
            // message.info("检测到语音，已截图", 1);
            
            // 保存第一张截图
            currentScreenshotBefore = data.screenshot_start?.data || null;
            break;

          case "SpeechEndedWithScreenshot":
            // 保存第二张截图
            currentScreenshotAfter = data.screenshot_end?.data || null;
            break;

          case "RecognitionFailed":
            console.error("❌ 识别失败:", data.error);
            message.error(`识别失败: ${data.error}`, 2);
            // 清空截图
            currentScreenshotBefore = null;
            currentScreenshotAfter = null;
            break;

          case "Error":
            console.error("❌ 智能截图错误:", data.message);
            message.error(data.message, 2);
            // 清空截图
            currentScreenshotBefore = null;
            currentScreenshotAfter = null;
            break;
        }
      });

      // 监听阿里云识别请求（需要调用 ASR）
      const unlistenRecognize = await listen("livestream_recognize_request", async (event: any) => {
        // 防止重复处理同一个识别请求
        if (isProcessingRecognitionRef.current) {
          return;
        }
        
        isProcessingRecognitionRef.current = true;
        
        const { pcm_data } = event.payload;

        try {
          // 从配置中获取阿里云凭证
          const settings = await invoke<any>("get_app_settings");
          const ttsConfig = settings.tts;

          if (!ttsConfig.aliyun_access_key || !ttsConfig.aliyun_access_secret || !ttsConfig.aliyun_appkey) {
            console.error("阿里云凭证未配置");
            message.error("请先在设置中配置阿里云凭证", 3);
            return;
          }

          // 调用阿里云一句话识别
          const result = await invoke<string>("aliyun_one_sentence_recognize", {
            app: undefined, // AppHandle 会自动传递
            appkey: ttsConfig.aliyun_appkey,
            accessKey: ttsConfig.aliyun_access_key,
            accessSecret: ttsConfig.aliyun_access_secret,
            pcmData: pcm_data,
            region: "cn-shanghai",
          });

          message.success(`识别: ${result}`, 3);

          // 容错处理：即使截图缺失也进行 AI 分析
          const hasBeforeScreenshot = !!currentScreenshotBefore;
          const hasAfterScreenshot = !!currentScreenshotAfter;
          const bothMissing = !hasBeforeScreenshot && !hasAfterScreenshot;
          
          // 记录截图缺失情况
          if (bothMissing) {
            screenshotErrorCountRef.current += 1;
            
            // 连续2次双截图都缺失，停止直播
            if (screenshotErrorCountRef.current >= 2) {
              message.error("截图系统异常（连续2次双截图缺失），已自动停止直播", 5);
              
              try {
                await invoke("stop_livestream_simulation");
                await invoke("stop_smart_capture");
                setIsLivestreaming(false);
                setIsSmartCaptureRunning(false);
              } catch (e) {
                console.error("停止直播失败:", e);
              }
              
              isProcessingRecognitionRef.current = false;
              return;
            }
          } else {
            // 有截图就重置错误计数
            screenshotErrorCountRef.current = 0;
          }
          
          // 使用空字符串代替缺失的截图
          const beforeScreenshot = currentScreenshotBefore || "";
          const afterScreenshot = currentScreenshotAfter || "";
          
          try {
            await invoke("trigger_ai_analysis", {
              request: {
                speech_text: result,
                screenshot_before: beforeScreenshot,
                screenshot_after: afterScreenshot,
              },
            });
          } catch (error) {
            console.error("AI 分析调用失败:", error);
            // 如果是因为直播已停止，不显示错误
            const errorMsg = String(error);
            if (!errorMsg.includes("已忽略此请求")) {
              message.error(`AI 分析失败: ${error}`, 3);
            }
          }

          // 清空截图
          currentScreenshotBefore = null;
          currentScreenshotAfter = null;
        } catch (error) {
          console.error("❌ 识别失败:", error);
          message.error(`识别失败: ${error}`, 3);
          
          // 清空截图
          currentScreenshotBefore = null;
          currentScreenshotAfter = null;
        } finally {
          // 释放处理锁
          isProcessingRecognitionRef.current = false;
        }
      });

      smartCaptureListenerRef.current = () => {
        unlistenCapture();
        unlistenRecognize();
      };
    };

    setupSmartCaptureListener();

    return () => {
      if (smartCaptureListenerRef.current) {
        smartCaptureListenerRef.current();
      }
    };
  }, []);

  // 处理模拟事件（使用 useCallback 稳定函数引用）
  const handleSimulationEvent = useCallback((event: SimulationEvent) => {
    // 通过 timestamp 去重，防止同一个事件被处理多次
    if (processedEventTimestampsRef.current.has(event.timestamp)) {
      return;
    }
    
    processedEventTimestampsRef.current.add(event.timestamp);
    
    // 保持最近 100 个 timestamp，避免内存泄漏
    if (processedEventTimestampsRef.current.size > 100) {
      const oldestTimestamps = Array.from(processedEventTimestampsRef.current).slice(0, 50);
      oldestTimestamps.forEach(ts => processedEventTimestampsRef.current.delete(ts));
    }

    const eventType = event.event_type;

    switch (eventType.type) {
      case "danmaku":
        addMessage({
          role: "assistant",
          content: eventType.message,
          aiPersonality: eventType.personality,
          nickname: eventType.nickname,
        });
        break;

      case "gift":
        addMessage({
          role: "system",
          content: `${eventType.nickname} 送出 ${eventType.gift_name} x${eventType.count}`,
        });
        message.success(
          `🎁 ${eventType.nickname} 送出 ${eventType.gift_name} x${eventType.count}`,
          2,
        );
        break;

      case "greeting":
        addMessage({
          role: "assistant",
          content: eventType.message,
          aiPersonality: "sunnyou_male",
          nickname: eventType.nickname,
        });
        break;
    }
  }, [addMessage]);

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

        // 停止智能截图
        if (isSmartCaptureRunning) {
          try {
            await invoke("stop_smart_capture");
            setIsSmartCaptureRunning(false);
            console.log("✅ 智能截图已停止");
          } catch (error) {
            console.error("❌ 停止智能截图失败:", error);
          }
        }
      } else {
        // 开始直播
        await invoke("start_livestream_simulation");
        setIsLivestreaming(true);
        message.success("直播已开始！AI 员工开始活跃...");

        // 启动智能截图+语音识别
        try {
          // 获取当前窗口列表，尝试找到游戏窗口
          let targetWindowId: number | undefined;
          try {
            const windows = await invoke<any[]>("list_windows_command");
            
            // 尝试找到包含游戏名称的窗口
            const gameWindow = windows.find((w) => 
              w.title && (
                w.title.toLowerCase().includes("game") ||
                w.title.toLowerCase().includes(currentGame) ||
                w.title.toLowerCase().includes("phasmophobia")
              )
            );
            if (gameWindow) {
              targetWindowId = gameWindow.id;
            }
          } catch (e) {
            console.warn("无法获取窗口列表:", e);
          }

          const smartCaptureConfig = {
            capture_mode: targetWindowId ? "window" : "fullscreen",
            target_window_id: targetWindowId,
            enable_dual_screenshot: true,
            vad_config: {
              volume_threshold: 0.035,
              silence_duration_secs: 2.5,
              min_speech_duration_secs: 0.5,
              max_speech_duration_secs: 60.0,
            },
          };

          await invoke("start_smart_capture", { config: smartCaptureConfig });
          
          setIsSmartCaptureRunning(true);
          // message.success("智能截图已启动，开始监听语音...", 2);
        } catch (error) {
          console.error("启动智能截图失败:", error);
          message.error(`智能截图启动失败: ${error}`, 3);
        }
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
      <div className="main-content_hud">
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
