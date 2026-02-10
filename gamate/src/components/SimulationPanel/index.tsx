import React, { useEffect } from "react";
import {
  Card,
  Select,
  InputNumber,
  Input,
  Radio,
  Switch,
  Button,
  Space,
  message,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { invoke } from "@tauri-apps/api/core";
import { useSimulationStore } from "../../stores/simulationStore";
import { AIPersonality, FrequencyLevel } from "../../types/simulation";
import "./SimulationPanel.scss";

const { TextArea } = Input;

// AI 性格选项
const PERSONALITY_OPTIONS: { value: AIPersonality; label: string }[] = [
  { value: "sunnyou_male", label: "损友男" },
  { value: "funny_female", label: "搞笑女" },
  { value: "kobe", label: "Kobe" },
  { value: "sweet_girl", label: "甜妹" },
  { value: "trump", label: "特朗普" },
];

// 频率选项
const FREQUENCY_OPTIONS: { value: FrequencyLevel; label: string }[] = [
  { value: "high", label: "高" },
  { value: "medium", label: "中" },
  { value: "low", label: "低" },
];

export const SimulationPanel: React.FC = () => {
  const {
    config,
    setLivestreamConfig,
    addEmployee,
    updateEmployee,
    removeEmployee,
    startSimulation,
    stopSimulation,
    loadConfig,
  } = useSimulationStore();

  const livestream = config.livestream!;

  // 加载保存的配置
  useEffect(() => {
    const loadSavedConfig = async () => {
      try {
        const savedConfig = await invoke<any>("load_simulation_config");
        loadConfig(savedConfig);
      } catch (error) {
        console.error("加载模拟场景配置失败:", error);
      }
    };
    loadSavedConfig();
  }, [loadConfig]);

  // 手动保存配置
  const handleSaveConfig = async () => {
    try {
      await invoke("save_simulation_config", {
        config: {
          livestream: {
            onlineUsers: livestream.onlineUsers,
            roomName: livestream.roomName,
            roomDescription: livestream.roomDescription,
            danmakuFrequency: livestream.danmakuFrequency,
            giftFrequency: livestream.giftFrequency,
            allowMic: livestream.allowMic,
          },
          employees: config.employees.map((emp) => ({
            id: emp.id,
            personality: emp.personality,
            interactionFrequency: emp.interactionFrequency,
            nickname: emp.nickname,
          })),
        },
      });

      // 发送事件通知其他窗口配置已更新
      try {
        const { emit } = await import("@tauri-apps/api/event");
        await emit("simulation-config-updated", {});
      } catch (error) {
        console.error("发送配置更新事件失败:", error);
      }

      message.success("配置已保存");
    } catch (error) {
      message.error(`保存配置失败: ${error}`);
    }
  };

  // 添加默认员工
  const handleAddEmployee = () => {
    if (config.employees.length >= 5) {
      message.warning("最多添加 5 个 AI 员工");
      return;
    }

    addEmployee({
      personality: "sunnyou_male",
      interactionFrequency: "medium",
      nickname: `AI员工${config.employees.length + 1}`,
    });
  };

  // 启动/停止模拟
  const handleToggleSimulation = async () => {
    if (config.isRunning) {
      // 停止模拟
      try {
        await invoke("close_livestream_hud_window");
        stopSimulation();
        message.info("已停止模拟场景");
      } catch (error) {
        message.error(`停止模拟失败: ${error}`);
      }
    } else {
      // 启动模拟
      if (config.employees.length === 0) {
        message.warning("请至少添加一个 AI 员工");
        return;
      }

      try {
        await invoke("open_livestream_hud_window");
        startSimulation();
        message.success("模拟场景已启动，直播间 HUD 已打开");
      } catch (error) {
        message.error(`启动模拟失败: ${error}`);
      }
    }
  };

  return (
    <div className="simulation-panel">
      {/* 场景类型选择 */}
      <Card title="场景设置" size="small" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: "100%" }}>
          <div>
            <span style={{ marginRight: 8 }}>场景类型:</span>
            <Select value={config.sceneType} disabled style={{ width: 200 }}>
              <Select.Option value="livestream">直播间场景</Select.Option>
            </Select>
          </div>
        </Space>
      </Card>

      {/* 直播间配置 */}
      <Card title="直播间配置" size="small" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <div>
            <span
              style={{ marginRight: 8, minWidth: 80, display: "inline-block" }}
            >
              在线人数:
            </span>
            <InputNumber
              min={1}
              max={10000}
              value={livestream.onlineUsers}
              onChange={(value) =>
                setLivestreamConfig({ onlineUsers: value || 1000 })
              }
              style={{ width: 150 }}
            />
          </div>

          <div>
            <span
              style={{ marginRight: 8, minWidth: 80, display: "inline-block" }}
            >
              直播间名称:
            </span>
            <Input
              value={livestream.roomName}
              onChange={(e) =>
                setLivestreamConfig({ roomName: e.target.value })
              }
              placeholder="输入直播间名称"
              style={{ width: 300 }}
            />
          </div>

          <div>
            <span
              style={{
                marginRight: 8,
                minWidth: 80,
                display: "inline-block",
                verticalAlign: "top",
              }}
            >
              直播间描述:
            </span>
            <TextArea
              value={livestream.roomDescription}
              onChange={(e) =>
                setLivestreamConfig({ roomDescription: e.target.value })
              }
              placeholder="输入直播间描述"
              rows={3}
              style={{ width: 300 }}
            />
          </div>

          <div>
            <span
              style={{ marginRight: 8, minWidth: 80, display: "inline-block" }}
            >
              弹幕频率:
            </span>
            <Radio.Group
              value={livestream.danmakuFrequency}
              onChange={(e) =>
                setLivestreamConfig({ danmakuFrequency: e.target.value })
              }
            >
              {FREQUENCY_OPTIONS.map((opt) => (
                <Radio key={opt.value} value={opt.value}>
                  {opt.label}
                </Radio>
              ))}
            </Radio.Group>
          </div>

          <div>
            <span
              style={{ marginRight: 8, minWidth: 80, display: "inline-block" }}
            >
              礼物频率:
            </span>
            <Radio.Group
              value={livestream.giftFrequency}
              onChange={(e) =>
                setLivestreamConfig({ giftFrequency: e.target.value })
              }
            >
              {FREQUENCY_OPTIONS.map((opt) => (
                <Radio key={opt.value} value={opt.value}>
                  {opt.label}
                </Radio>
              ))}
            </Radio.Group>
          </div>

          <div>
            <span
              style={{ marginRight: 8, minWidth: 80, display: "inline-block" }}
            >
              是否可上麦:
            </span>
            <Switch
              checked={livestream.allowMic}
              onChange={(checked) => setLivestreamConfig({ allowMic: checked })}
              checkedChildren="开启"
              unCheckedChildren="关闭"
            />
          </div>
        </Space>
      </Card>

      {/* AI 员工配置 */}
      <Card
        title="AI 员工配置"
        size="small"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAddEmployee}
            size="small"
            disabled={config.employees.length >= 5}
          >
            添加员工
          </Button>
        }
        style={{ marginBottom: 16 }}
      >
        <Space
          direction="vertical"
          style={{ width: "100%", overflowY: "auto", height: 200 }}
          size="middle"
        >
          {config.employees.length === 0 && (
            <div
              style={{ textAlign: "center", color: "#999", padding: "20px 0" }}
            >
              暂无 AI 员工，点击右上角"添加员工"按钮
            </div>
          )}

          {config.employees.map((employee, index) => (
            <Card
              key={employee.id}
              type="inner"
              title={`员工 #${index + 1}`}
              extra={
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => removeEmployee(employee.id)}
                  size="small"
                >
                  删除
                </Button>
              }
            >
              <Space direction="vertical" style={{ width: "100%" }}>
                <div>
                  <span
                    style={{
                      marginRight: 8,
                      minWidth: 80,
                      display: "inline-block",
                    }}
                  >
                    AI 性格:
                  </span>
                  <Select
                    value={employee.personality}
                    onChange={(value) =>
                      updateEmployee(employee.id, { personality: value })
                    }
                    style={{ width: 150 }}
                  >
                    {PERSONALITY_OPTIONS.map((opt) => (
                      <Select.Option key={opt.value} value={opt.value}>
                        {opt.label}
                      </Select.Option>
                    ))}
                  </Select>
                </div>

                <div>
                  <span
                    style={{
                      marginRight: 8,
                      minWidth: 80,
                      display: "inline-block",
                    }}
                  >
                    互动频率:
                  </span>
                  <Radio.Group
                    value={employee.interactionFrequency}
                    onChange={(e) =>
                      updateEmployee(employee.id, {
                        interactionFrequency: e.target.value,
                      })
                    }
                  >
                    {FREQUENCY_OPTIONS.map((opt) => (
                      <Radio key={opt.value} value={opt.value}>
                        {opt.label}
                      </Radio>
                    ))}
                  </Radio.Group>
                </div>

                <div>
                  <span
                    style={{
                      marginRight: 8,
                      minWidth: 80,
                      display: "inline-block",
                    }}
                  >
                    AI 昵称:
                  </span>
                  <Input
                    value={employee.nickname}
                    onChange={(e) =>
                      updateEmployee(employee.id, { nickname: e.target.value })
                    }
                    placeholder="输入昵称"
                    style={{ width: 200 }}
                  />
                </div>
              </Space>
            </Card>
          ))}
        </Space>
      </Card>

      {/* 控制按钮 */}
      <div style={{ textAlign: "center", marginTop: 24 }}>
        <Space size="middle">
          <Button type="primary" size="large" onClick={handleSaveConfig}>
            保存配置
          </Button>
          <Button
            type={config.isRunning ? "default" : "primary"}
            size="large"
            icon={
              config.isRunning ? (
                <PauseCircleOutlined />
              ) : (
                <PlayCircleOutlined />
              )
            }
            onClick={handleToggleSimulation}
            danger={config.isRunning}
          >
            {config.isRunning ? "停止模拟" : "启动模拟场景"}
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default SimulationPanel;
