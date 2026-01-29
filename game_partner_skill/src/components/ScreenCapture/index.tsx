import { useState, useRef, useEffect, useCallback } from "react";
import { Card, Button, Space, Typography, Divider, Select, message, Slider, Switch, Tag } from "antd";
import { Monitor, Play, Square, Scissors, Download, RefreshCw, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import type { CaptureStrategy } from "../../types/ai";
import "./styles.scss";

const { Title, Text, Paragraph } = Typography;

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
  const [captureMode, setCaptureMode] = useState<"fullscreen" | "window" | "area">("fullscreen");
  const [captureArea, setCaptureArea] = useState<CaptureArea | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [captureInterval, setCaptureInterval] = useState(3); // 改为间隔秒数,默认 3 秒
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [selectedDisplay, setSelectedDisplay] = useState<number>(0);
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [selectedWindow, setSelectedWindow] = useState<number | null>(null);
  const [currentScreenshot, setCurrentScreenshot] = useState<string | null>(null);
  const [captureTimer, setCaptureTimer] = useState<ReturnType<typeof setInterval> | null>(null);
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
      message.success("开始截屏识别");

      // 立即截取一次
      await captureScreenshot();

      // 设置定时截图 (改为按秒间隔)
      const timer = setInterval(() => {
        captureScreenshot();
      }, captureInterval * 1000); // 转换为毫秒

      setCaptureTimer(timer);
    } catch (error) {
      message.error("启动失败");
      setIsCapturing(false);
    }
  };

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

  const handleSelectArea = async () => {
    try {
      message.info("提示: 拖拽选择区域后松开鼠标确认，右键取消", 2);
      
      // 调用 Tauri 命令打开全屏选择窗口
      const area = await invoke<CaptureArea>("show_area_selector_window");
      
      setCaptureArea(area);
      message.success(`已选择区域: ${area.width}x${area.height}`);
      
    } catch (error: any) {
      if (error && !error.toString().includes("取消")) {
        message.error("区域选择失败");
        console.error(error);
      }
    }
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
      message.success(`已选择区域: ${Math.abs(captureArea.width)}x${Math.abs(captureArea.height)}`);
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
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <div>
              <Title level={4}>
                <Monitor size={24} style={{ marginRight: 8 }} />
                屏幕识别设置
              </Title>
              <Paragraph type="secondary">
                配置截屏模式和识别参数,实时捕获游戏画面
              </Paragraph>
            </div>

            <Divider />

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
                <Space style={{ width: "100%", justifyContent: "space-between" }}>
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

            {/* 截图间隔设置 */}
            <div className="control-item">
              <Space style={{ width: "100%", justifyContent: "space-between" }}>
                <Text strong>截图间隔</Text>
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
              <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: "block" }}>
                💡 提示: 间隔越短,CPU 占用越高。推荐 3-5 秒用于 AI 分析
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

            {captureMode === "area" && (
              <Button
                icon={<Scissors size={18} />}
                onClick={handleSelectArea}
                block
              >
                选择截屏区域
              </Button>
            )}
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
                    objectFit: "contain" 
                  }} 
                />
                {isCapturing && (
                  <div className="capturing-indicator">
                    <div className="pulse" />
                    <Text>正在捕获画面 (每 {captureInterval} 秒)</Text>
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
