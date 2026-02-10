import { useState, useRef, useEffect, useCallback } from "react";
import {
  Card,
  Button,
  Space,
  Typography,
  Select,
  message,
  Slider,
  Switch,
  Tag,
} from "antd";
import { Monitor, Play, Square, Download, RefreshCw, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import "./styles.scss";
import { InfoCircleOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;

interface CaptureArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DisplayInfo {
  id: number;
  name: string;
  width: number;
  height: number;
  is_primary: boolean;
}

interface WindowInfo {
  id: number;
  title: string;
  app_name: string;
  width: number;
  height: number;
  x: number;
  y: number;
}

interface Screenshot {
  data: string; // Base64 PNG
  width: number;
  height: number;
  timestamp: number;
  display_id: number | null;
  mode: string;
}

const ScreenCapture: React.FC = () => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureMode, setCaptureMode] = useState<
    "fullscreen" | "window" | "area"
  >("fullscreen");
  const [captureArea, setCaptureArea] = useState<CaptureArea | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // 截图策略配置
  const [captureInterval, setCaptureInterval] = useState(3); // 活跃期间隔 (1-15s)
  const [aiControlled, setAiControlled] = useState(true); // 是否启用 AI 控制
  const [isActiveMode, setIsActiveMode] = useState(false); // 当前是否活跃模式 (由 AI 判断)
  const [currentInterval, setCurrentInterval] = useState(15); // 当前实际使用的间隔

  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [selectedDisplay, setSelectedDisplay] = useState<number>(0);
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [selectedWindow, setSelectedWindow] = useState<number | null>(null);
  const [currentScreenshot, setCurrentScreenshot] = useState<string | null>(
    null,
  );
  const [captureTimer, setCaptureTimer] = useState<ReturnType<
    typeof setInterval
  > | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // 加载显示器列表
  useEffect(() => {
    loadDisplays();
    loadWindows();
  }, []);

  const loadDisplays = async () => {
    try {
      const displayList = await invoke<DisplayInfo[]>("list_displays");
      setDisplays(displayList);
      if (displayList.length > 0) {
        setSelectedDisplay(displayList[0].id);
      }
    } catch (error) {
      console.error("获取显示器列表失败:", error);
      message.error("获取显示器列表失败");
    }
  };

  const loadWindows = async () => {
    try {
      const windowList = await invoke<WindowInfo[]>("list_windows_command");
      setWindows(windowList);
      if (windowList.length > 0) {
        setSelectedWindow(windowList[0].id);
      }
    } catch (error) {
      console.error("获取窗口列表失败:", error);
      message.error("获取窗口列表失败");
    }
  };

  const captureScreenshot = async () => {
    try {
      let screenshot: Screenshot;

      if (captureMode === "fullscreen") {
        screenshot = await invoke<Screenshot>("capture_fullscreen", {
          displayId: selectedDisplay,
        });
      } else if (captureMode === "window" && selectedWindow !== null) {
        screenshot = await invoke<Screenshot>("capture_window_command", {
          windowId: selectedWindow,
        });
      } else if (captureMode === "area" && captureArea) {
        screenshot = await invoke<Screenshot>("capture_area", {
          area: {
            x: Math.round(captureArea.x),
            y: Math.round(captureArea.y),
            width: Math.round(Math.abs(captureArea.width)),
            height: Math.round(Math.abs(captureArea.height)),
          },
          displayId: selectedDisplay,
        });
      } else {
        return;
      }

      setCurrentScreenshot(screenshot.data);
    } catch (error) {
      console.error("截图失败:", error);
      message.error(`截图失败: ${error}`);
    }
  };

  const handleStartCapture = async () => {
    try {
      setIsCapturing(true);
      message.success("开始智能截屏识别");

      // 立即截取一次
      await captureScreenshot();

      // 初始使用 idle 模式 (15s),等待 AI 判断
      const initialInterval = 15;
      setCurrentInterval(initialInterval);

      // 设置定时截图
      const timer = setInterval(() => {
        captureScreenshot();
      }, initialInterval * 1000);

      setCaptureTimer(timer);
    } catch (error) {
      message.error("启动失败");
      setIsCapturing(false);
    }
  };

  /**
   * AI 控制截图策略
   * @param active 用户是否活跃 (战斗/闯关)
   * @param now 是否立即截图
   * @param suggestedInterval 建议的间隔
   */
  const updateCaptureStrategy = useCallback(
    (active: boolean, now: boolean, suggestedInterval?: number) => {
      // 更新活跃状态
      setIsActiveMode(active);

      // 计算新的间隔
      const newInterval = active
        ? suggestedInterval || captureInterval // 活跃期: AI 建议 或 用户设置
        : 15; // 非活跃期: 固定 15s

      if (newInterval !== currentInterval) {
        setCurrentInterval(newInterval);

        // 重启定时器
        if (captureTimer) {
          clearInterval(captureTimer);
          const timer = setInterval(() => {
            captureScreenshot();
          }, newInterval * 1000);
          setCaptureTimer(timer);
        }
      }

      // 立即截图
      if (now) {
        captureScreenshot();
      }
    },
    [captureInterval, currentInterval, captureTimer],
  );

  // 暴露给父组件的控制函数 (通过 ref 或全局事件)
  useEffect(() => {
    // 监听 AI 控制事件 (可以通过自定义事件或状态管理)
    const handleAIControl = (event: CustomEvent) => {
      const { active, now, suggested_interval } = event.detail;
      updateCaptureStrategy(active, now, suggested_interval);
    };

    window.addEventListener("ai-control" as any, handleAIControl);
    return () =>
      window.removeEventListener("ai-control" as any, handleAIControl);
  }, [updateCaptureStrategy]);

  const handleStopCapture = () => {
    if (captureTimer) {
      clearInterval(captureTimer);
      setCaptureTimer(null);
    }
    setIsCapturing(false);
    message.info("已停止截屏");
  };

  const handleRefresh = async () => {
    if (isCapturing) {
      await captureScreenshot();
    }
  };

  const handleSaveScreenshot = () => {
    if (!currentScreenshot) {
      message.warning("没有可保存的截图");
      return;
    }

    // 创建下载链接
    const link = document.createElement("a");
    link.href = currentScreenshot;
    link.download = `screenshot_${Date.now()}.png`;
    link.click();
    message.success("截图已保存至下载目录中");
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (captureMode !== "area") return;
    setIsDragging(true);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      setCaptureArea({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        width: 0,
        height: 0,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !captureArea) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      setCaptureArea({
        ...captureArea,
        width: e.clientX - rect.left - captureArea.x,
        height: e.clientY - rect.top - captureArea.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (captureArea && (captureArea.width !== 0 || captureArea.height !== 0)) {
      message.success(
        `已选择区域: ${Math.abs(captureArea.width)}x${Math.abs(captureArea.height)}`,
      );
    }
  };

  return (
    <div className="screen-capture">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="control-panel">
          <Space direction="vertical" style={{ width: "100%" }}>
            <div>
              <h3 style={{ fontSize: 22 }}>屏幕识别设置</h3>
              <div style={{ color: "#8f8f8f", marginTop: 8 }}>
                配置截屏模式和识别参数,实时捕获游戏画面
              </div>
            </div>

            {/* 捕获模式选择 */}
            <div className="control-item">
              <Text strong>捕获模式</Text>
              <Select
                value={captureMode}
                onChange={setCaptureMode}
                style={{ width: "100%", marginTop: 8 }}
                disabled={isCapturing}
                options={[
                  { label: "全屏捕获", value: "fullscreen" },
                  { label: "窗口捕获", value: "window" },
                  { label: "区域捕获", value: "area", disabled: true },
                ]}
              />
            </div>

            {/* 显示器选择 */}
            {captureMode === "fullscreen" && displays.length > 1 && (
              <div className="control-item">
                <Text strong>显示器</Text>
                <Select
                  value={selectedDisplay}
                  onChange={setSelectedDisplay}
                  style={{ width: "100%", marginTop: 8 }}
                  disabled={isCapturing}
                  options={displays.map((d) => ({
                    label: `${d.name} (${d.width}x${d.height})${d.is_primary ? " - 主屏" : ""}`,
                    value: d.id,
                  }))}
                />
              </div>
            )}

            {/* 窗口选择 */}
            {captureMode === "window" && (
              <div className="control-item">
                <Space
                  style={{ width: "100%", justifyContent: "space-between" }}
                >
                  <Text strong>选择窗口</Text>
                  <Button
                    size="small"
                    icon={<RefreshCw size={14} />}
                    onClick={loadWindows}
                    disabled={isCapturing}
                  >
                    刷新
                  </Button>
                </Space>
                <Select
                  value={selectedWindow}
                  onChange={setSelectedWindow}
                  style={{ width: "100%", marginTop: 8 }}
                  disabled={isCapturing}
                  placeholder="请选择窗口"
                  showSearch
                  optionFilterProp="label"
                  options={windows.map((w) => ({
                    label: `${w.title} - ${w.app_name} (${w.width}x${w.height})`,
                    value: w.id,
                  }))}
                />
              </div>
            )}

            {/* AI 智能截图策略 */}
            <div className="control-item">
              <Space
                style={{
                  width: "100%",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <Text strong>AI 智能控制</Text>
                <Switch
                  checked={aiControlled}
                  onChange={setAiControlled}
                  disabled={isCapturing}
                  checkedChildren="启用"
                  unCheckedChildren="关闭"
                />
              </Space>
              {aiControlled && (
                <div
                  style={{ padding: "8px 12px", borderRadius: 6, marginTop: 8 }}
                >
                  <Space direction="vertical" size={4}>
                    <Text type="secondary" style={{ fontSize: 14 }}>
                      <Zap size={12} style={{ marginRight: 4 }} />
                      AI 将根据对话内容自动调整截图频率:
                    </Text>
                    <Text
                      type="secondary"
                      style={{ fontSize: 14, marginLeft: 16 }}
                    >
                      • 活跃期 (战斗/闯关): 使用下方设置的间隔
                    </Text>
                    <Text
                      type="secondary"
                      style={{ fontSize: 14, marginLeft: 16 }}
                    >
                      • 闲置期 (菜单/浏览): 固定 15 秒间隔
                    </Text>
                    <Text
                      type="secondary"
                      style={{ fontSize: 14, marginLeft: 16 }}
                    >
                      • 询问游戏问题时: 立即截图
                    </Text>
                    {isCapturing && (
                      <Tag
                        color={isActiveMode ? "green" : "blue"}
                        style={{ marginTop: 4 }}
                      >
                        当前模式: {isActiveMode ? "活跃" : "闲置"} | 间隔:{" "}
                        {currentInterval}s
                      </Tag>
                    )}
                  </Space>
                </div>
              )}
            </div>

            {/* 截图间隔设置 */}
            <div className="control-item">
              <Space style={{ width: "100%", justifyContent: "space-between" }}>
                <Text strong>活跃期间隔</Text>
                <Text type="secondary">{captureInterval} 秒</Text>
              </Space>
              <Slider
                min={1}
                max={15}
                value={captureInterval}
                onChange={setCaptureInterval}
                marks={{ 1: "1s", 3: "3s", 5: "5s", 10: "10s", 15: "15s" }}
                style={{ marginTop: 8 }}
                disabled={isCapturing}
              />
              <Text
                type="secondary"
                style={{ fontSize: 12, marginTop: 4, display: "block" }}
              >
                <InfoCircleOutlined></InfoCircleOutlined>{" "}
                {aiControlled
                  ? "此间隔仅用于活跃期 (战斗/闯关),闲置期固定 15s"
                  : "固定间隔,不受 AI 控制。推荐 3-5 秒"}
              </Text>
            </div>

            {/* 操作按钮 */}
            <Space size="middle" style={{ width: "100%" }}>
              {!isCapturing ? (
                <Button
                  type="primary"
                  icon={<Play size={18} />}
                  onClick={handleStartCapture}
                  size="large"
                  block
                >
                  开始识别
                </Button>
              ) : (
                <Button
                  danger
                  icon={<Square size={18} />}
                  onClick={handleStopCapture}
                  size="large"
                  block
                >
                  停止识别
                </Button>
              )}
            </Space>

            {/* 区域选择功能已移除 */}
          </Space>
        </Card>

        {/* 预览画布 */}
        <Card className="preview-canvas" style={{ marginTop: 16 }}>
          <div className="canvas-header">
            <Title level={5}>实时预览</Title>
            <Space>
              <Button
                icon={<RefreshCw size={18} />}
                size="small"
                onClick={handleRefresh}
                disabled={!isCapturing}
              >
                刷新
              </Button>
              <Button
                icon={<Download size={18} />}
                size="small"
                onClick={handleSaveScreenshot}
                disabled={!currentScreenshot}
              >
                保存截图
              </Button>
            </Space>
          </div>
          <div
            ref={canvasRef}
            className="canvas-area"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {!currentScreenshot ? (
              <div className="placeholder">
                <Monitor size={64} />
                <Text type="secondary">点击"开始识别"查看实时画面</Text>
              </div>
            ) : (
              <>
                <img
                  src={currentScreenshot}
                  alt="Screen capture"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                  }}
                />
                {isCapturing && (
                  <div className="capturing-indicator">
                    <div className="pulse" />
                    <Text>
                      {aiControlled
                        ? `正在捕获 (${isActiveMode ? "活跃" : "闲置"} ${currentInterval}s)`
                        : `正在捕获画面 (每 ${captureInterval} 秒)`}
                    </Text>
                  </div>
                )}
              </>
            )}

            {/* 选区指示器 */}
            {captureArea && captureMode === "area" && (
              <div
                className="selection-box"
                style={{
                  left: captureArea.x,
                  top: captureArea.y,
                  width: Math.abs(captureArea.width),
                  height: Math.abs(captureArea.height),
                }}
              />
            )}
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export default ScreenCapture;
