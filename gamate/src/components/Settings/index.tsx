import React, { useState, useEffect } from "react";
import {
  Card,
  Form,
  Input,
  Select,
  Switch,
  Button,
  Space,
  Typography,
  Divider,
  message,
  InputNumber,
  Tabs,
  Alert,
  Slider,
  Modal,
} from "antd";
import {
  GlobalOutlined,
  RobotOutlined,
  DatabaseOutlined,
  SearchOutlined,
  PictureOutlined,
  UserOutlined,
  SoundOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { invoke } from "@tauri-apps/api/core";
import "./styles.scss";

const { Title, Text, Paragraph } = Typography;

interface AppSettings {
  general: {
    language: string;
    theme: string;
    hud_mode?: boolean; // HUD 浮窗模式
  };
  skillLibrary: {
    storageBasePath: string;
    maxVersionsToKeep: number;
    autoUpdate: boolean;
    updateCheckInterval: number;
    crawler: {
      requestDelayMs: number;
      maxConcurrentRequests: number;
      timeoutSeconds: number;
    };
  };
  aiModels: {
    embedding: ModelConfig;
    multimodal: ModelConfig;
    aiPersonality?: string; // AI 陪玩角色类型
    vectorDb: {
      mode: string;
      qdrantUrl?: string;
      localStoragePath?: string;
    };
  };
  screenshot?: {
    enabled: boolean;
    captureMode: string;
    targetWindowId?: number | null;
    targetWindowName?: string | null;
    activeIntervalSeconds: number;
    idleIntervalSeconds: number;
    quality: number;
    targetSizeKb: number;
    autoSendToAi: boolean;
  };
  tts?: {
    enabled: boolean;
    provider?: string; // 'windows' or 'aliyun'
    aliyunAccessKey?: string | null;
    aliyunAccessSecret?: string | null;
    aliyunAppKey?: string | null;
    voice?: string;
    rate: number;
    volume: number;
    autoSpeak: boolean; // AI 回复时自动播报
  };
}

interface ModelConfig {
  provider: string;
  apiBase: string;
  apiKey?: string | null;
  modelName: string;
  enabled: boolean;
  temperature?: number;
  maxTokens?: number;
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

const SettingsPanel: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [hudPreviewVisible, setHudPreviewVisible] = useState(false); // HUD 预览状态

  useEffect(() => {
    loadSettings();
    loadWindows();
    checkHudPreview();
  }, []);

  // 检查 HUD 预览窗口是否打开
  const checkHudPreview = async () => {
    try {
      const visible = await invoke<boolean>('is_hud_window_visible');
      setHudPreviewVisible(visible);
    } catch (error) {
      console.error('检查 HUD 可见性失败:', error);
    }
  };

  const loadWindows = async () => {
    try {
      const windowList = await invoke<WindowInfo[]>("list_windows_command");
      setWindows(windowList);
    } catch (error) {
      console.error("获取窗口列表失败:", error);
    }
  };

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await invoke<any>("get_app_settings");

      // 转换 snake_case 到 camelCase
      const transformedData: AppSettings = {
        general: data.general || { language: "zh-CN", theme: "auto" },
        skillLibrary: {
          storageBasePath:
            data.skill_library?.storage_base_path || "./data/skills",
          maxVersionsToKeep: data.skill_library?.max_versions_to_keep || 3,
          autoUpdate: data.skill_library?.auto_update || false,
          updateCheckInterval: data.skill_library?.update_check_interval || 24,
          crawler: {
            requestDelayMs:
              data.skill_library?.crawler?.request_delay_ms || 1000,
            maxConcurrentRequests:
              data.skill_library?.crawler?.max_concurrent_requests || 5,
            timeoutSeconds: data.skill_library?.crawler?.timeout_seconds || 30,
          },
        },
        aiModels: {
          embedding: {
            provider: data.ai_models?.embedding?.provider || "local",
            apiBase:
              data.ai_models?.embedding?.api_base ||
              "http://localhost:11434/v1",
            apiKey: data.ai_models?.embedding?.api_key || null,
            modelName:
              data.ai_models?.embedding?.model_name || "qwen3-embedding:4b",
            enabled: data.ai_models?.embedding?.enabled !== false,
            temperature: data.ai_models?.embedding?.temperature || 0.0,
            maxTokens: data.ai_models?.embedding?.max_tokens || 512,
          },
          multimodal: {
            provider: data.ai_models?.multimodal?.provider || "openai",
            apiBase:
              data.ai_models?.multimodal?.api_base ||
              "https://api.openai.com/v1",
            apiKey: data.ai_models?.multimodal?.api_key || null,
            modelName: data.ai_models?.multimodal?.model_name || "gpt-4o-mini",
            enabled: data.ai_models?.multimodal?.enabled !== false,
            temperature: data.ai_models?.multimodal?.temperature || 0.7,
            maxTokens: data.ai_models?.multimodal?.max_tokens || 1000,
          },
          aiPersonality: data.ai_models?.ai_personality || "sunnyou_male",
          vectorDb: {
            mode: data.ai_models?.vector_db?.mode || "local",
            qdrantUrl:
              data.ai_models?.vector_db?.qdrant_url || "http://localhost:6333",
            localStoragePath:
              data.ai_models?.vector_db?.local_storage_path ||
              "./data/vector_db",
          },
        },
        screenshot: {
          enabled: data.screenshot?.enabled || false,
          captureMode: data.screenshot?.capture_mode || "fullscreen",
          targetWindowId: data.screenshot?.target_window_id || null,
          targetWindowName: data.screenshot?.target_window_name || null,
          activeIntervalSeconds: data.screenshot?.active_interval_seconds || 5,
          idleIntervalSeconds: data.screenshot?.idle_interval_seconds || 15,
          quality: data.screenshot?.quality || 85,
          targetSizeKb: data.screenshot?.target_size_kb || 200,
          autoSendToAi: data.screenshot?.auto_send_to_ai !== false,
        },
        tts: {
          enabled: data.tts?.enabled || false,
          provider: data.tts?.provider || "windows",
          aliyunAccessKey: data.tts?.aliyun_access_key || null,
          aliyunAccessSecret: data.tts?.aliyun_access_secret || null,
          aliyunAppKey: data.tts?.aliyun_appkey || null,
          voice: data.tts?.voice || undefined,
          rate: data.tts?.rate || 1.0,
          volume: data.tts?.volume || 0.8,
          autoSpeak: data.tts?.auto_speak !== false,
        },
      };

      setSettings(transformedData);
      form.setFieldsValue(transformedData);
      message.success("设置加载成功");
    } catch (error: any) {
      message.error(`加载设置失败: ${error}`);
      console.error("加载设置错误:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      // 验证所有字段
      await form.validateFields();
      setSaving(true);

      // 获取完整表单值（包括未在当前标签页的字段）
      const values = form.getFieldsValue(true);

      console.log("📝 表单值:", values);

      // 确保所有必需字段都存在
      if (!values.general || !values.skillLibrary || !values.aiModels) {
        throw new Error("表单数据不完整，请刷新页面重新加载");
      }

      // 转换回 snake_case 给后端
      const backendData = {
        general: values.general,
        skill_library: {
          storage_base_path: values.skillLibrary.storageBasePath,
          max_versions_to_keep: values.skillLibrary.maxVersionsToKeep,
          auto_update: values.skillLibrary.autoUpdate,
          update_check_interval: values.skillLibrary.updateCheckInterval,
          crawler: {
            request_delay_ms: values.skillLibrary.crawler.requestDelayMs,
            max_concurrent_requests:
              values.skillLibrary.crawler.maxConcurrentRequests,
            timeout_seconds: values.skillLibrary.crawler.timeoutSeconds,
          },
        },
        ai_models: {
          embedding: {
            provider: values.aiModels.embedding.provider,
            api_base: values.aiModels.embedding.apiBase,
            api_key: values.aiModels.embedding.apiKey || null,
            model_name: values.aiModels.embedding.modelName,
            enabled: values.aiModels.embedding.enabled,
            temperature: values.aiModels.embedding.temperature || 0.0,
            max_tokens: values.aiModels.embedding.maxTokens || 512,
          },
          multimodal: {
            provider: values.aiModels.multimodal.provider,
            api_base: values.aiModels.multimodal.apiBase,
            api_key: values.aiModels.multimodal.apiKey || null,
            model_name: values.aiModels.multimodal.modelName,
            enabled: values.aiModels.multimodal.enabled,
            temperature: values.aiModels.multimodal.temperature || 0.7,
            max_tokens: values.aiModels.multimodal.maxTokens || 1000,
          },
          ai_personality: values.aiModels.aiPersonality || "sunnyou_male",
          vector_db: {
            mode: values.aiModels.vectorDb.mode,
            qdrant_url: values.aiModels.vectorDb.qdrantUrl || null,
            local_storage_path:
              values.aiModels.vectorDb.localStoragePath || null,
          },
        },
        screenshot: values.screenshot
          ? {
              enabled: values.screenshot.enabled,
              capture_mode: values.screenshot.captureMode,
              target_window_id: values.screenshot.targetWindowId || null,
              target_window_name: values.screenshot.targetWindowName || null,
              active_interval_seconds: values.screenshot.activeIntervalSeconds,
              idle_interval_seconds: values.screenshot.idleIntervalSeconds,
              quality: values.screenshot.quality,
              target_size_kb: values.screenshot.targetSizeKb,
              auto_send_to_ai: values.screenshot.autoSendToAi,
            }
          : undefined,
        tts: values.tts
          ? {
              enabled: values.tts.enabled,
              provider: values.tts.provider || "windows",
              aliyun_access_key: values.tts.aliyunAccessKey || null,
              aliyun_access_secret: values.tts.aliyunAccessSecret || null,
              aliyun_appkey: values.tts.aliyunAppKey || null,
              voice: values.tts.voice || null,
              rate: values.tts.rate || 1.0,
              volume: values.tts.volume || 0.8,
              auto_speak: values.tts.autoSpeak !== false,
            }
          : undefined,
      };

      console.log("📤 发送给后端:", backendData);

      await invoke("save_app_settings", { settings: backendData });
      setSettings(values);
      message.success("设置保存成功");
    } catch (error: any) {
      console.error("❌ 保存错误:", error);
      if (error.errorFields) {
        console.error("表单验证错误:", error.errorFields);
        message.error("请检查表单填写");
      } else {
        message.error(`保存失败: ${error}`);
        console.error("保存设置错误:", error);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      const defaultSettings = await invoke<AppSettings>("reset_app_settings");
      setSettings(defaultSettings);
      form.setFieldsValue(defaultSettings);
      message.success("已重置为默认设置");
    } catch (error: any) {
      message.error(`重置失败: ${error}`);
      console.error("重置设置错误:", error);
    }
  };

  if (loading) {
    return <div style={{ padding: 24, textAlign: "center" }}>加载中...</div>;
  }

  return (
    <div className="settings-page">
      <Card>
        <Space align="center" style={{ marginBottom: 16 }}>
          <Title level={3} style={{ margin: 0 }}>
            应用设置
          </Title>
        </Space>
        <Paragraph type="secondary">
          配置应用行为、AI 模型和技能库参数
        </Paragraph>

        <Form
          form={form}
          layout="vertical"
          initialValues={settings || undefined}
        >
          <Tabs defaultActiveKey="general">
            {/* 通用设置 */}
            <Tabs.TabPane
              tab={
                <Space>
                  <GlobalOutlined />
                  <span>通用设置</span>
                </Space>
              }
              key="general"
            >
              <Card type="inner" title="基本配置">
                <Form.Item
                  label="语言"
                  name={["general", "language"]}
                  tooltip="选择界面语言,也会影响 Wiki 下载时的语言版本"
                  rules={[{ required: true, message: "请选择语言" }]}
                >
                  <Select placeholder="选择语言">
                    <Select.Option value="zh-CN">简体中文</Select.Option>
                    <Select.Option value="zh-TW">繁體中文</Select.Option>
                    <Select.Option value="en">English</Select.Option>
                    <Select.Option value="ja">日本語</Select.Option>
                    <Select.Option value="ko">한국어</Select.Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  label="主题"
                  name={["general", "theme"]}
                  rules={[{ required: true, message: "请选择主题" }]}
                >
                  <Select placeholder="选择主题">
                    <Select.Option value="auto">跟随系统</Select.Option>
                    <Select.Option value="light">浅色模式</Select.Option>
                    <Select.Option value="dark">深色模式</Select.Option>
                  </Select>
                </Form.Item>

                <Divider />

                <Form.Item
                  label="HUD 浮窗模式"
                  name={["general", "hud_mode"]}
                  valuePropName="checked"
                  tooltip="启用后,应用最小化到托盘时,HUD浮窗会保持显示。关闭后,HUD浮窗会随主窗口一起隐藏"
                >
                  <Switch 
                    checkedChildren="开启" 
                    unCheckedChildren="关闭"
                  />
                </Form.Item>

                <Form.Item label="HUD 位置预览">
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14 }}>预览窗口:</span>
                    <Switch
                      checked={hudPreviewVisible}
                      onChange={async (checked) => {
                        try {
                          if (checked) {
                            await invoke("open_hud_window");
                            setHudPreviewVisible(true);
                            message.success("HUD 浮窗已打开,您可以拖动调整位置,位置会自动保存");
                          } else {
                            await invoke("close_hud_window");
                            setHudPreviewVisible(false);
                            message.info("HUD 浮窗已关闭");
                          }
                        } catch (error) {
                          message.error(`HUD 操作失败: ${error}`);
                          // 恢复状态
                          setHudPreviewVisible(!checked);
                        }
                      }}
                      checkedChildren="显示"
                      unCheckedChildren="关闭"
                    />
                  </div>
                </Form.Item>

                <Alert
                  message="HUD 模式说明"
                  description={
                    <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                      <li>
                        <strong>HUD 浮窗模式</strong>: 控制最小化时是否保持 HUD 显示
                      </li>
                      <li>
                        <strong>预览位置</strong>: 打开 HUD 浮窗进行位置调整,拖动后会自动保存位置
                      </li>
                      <li>
                        <strong>主窗口关闭</strong>: 点击关闭按钮会最小化到托盘,右键托盘图标可退出应用
                      </li>
                      <li>
                        <strong>双击托盘</strong>: 快速显示/隐藏主窗口
                      </li>
                    </ul>
                  }
                  type="info"
                  showIcon
                  style={{ marginTop: 8 }}
                />
              </Card>
            </Tabs.TabPane>

            {/* AI 模型设置 */}
            <Tabs.TabPane
              tab={
                <Space>
                  <RobotOutlined />
                  <span>AI 模型</span>
                </Space>
              }
              key="ai-models"
            >
              <Alert
                message="模型配置说明"
                description={
                  <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                    <li>
                      <strong>Embedding 模型</strong>: 用于 Wiki 搜索的语义匹配
                    </li>
                    <li>
                      <strong>多模态模型</strong>: 用于语音识别、图片分析等功能
                    </li>
                    <li>
                      <strong>本地模型</strong>: 需要先安装 Ollama 并下载模型
                    </li>
                    <li>
                      <strong>远程 API</strong>: 支持 OpenAI、Azure 等云服务
                    </li>
                  </ul>
                }
                type="info"
                showIcon
                style={{ marginBottom: 24 }}
              />

              {/* AI 陪玩角色配置 */}
              <Card
                type="inner"
                title={
                  <Space>
                    <UserOutlined />
                    <span>AI 陪玩角色</span>
                  </Space>
                }
                style={{ marginBottom: 16 }}
              >
                <Alert
                  message="选择你喜欢的 AI 陪玩风格"
                  description="不同角色有不同的说话风格和性格,但都会给出准确的游戏建议"
                  type="success"
                  showIcon
                  style={{ marginBottom: 16 }}
                />

                <Form.Item
                  label="角色类型"
                  name={["aiModels", "aiPersonality"]}
                  tooltip="选择 AI 陪玩的性格类型"
                  initialValue="sunnyou_male"
                >
                  <Select
                    size="large"
                    placeholder="选择角色"
                    onChange={async (value: string) => {
                      // 切换角色时自动应用推荐语音
                      try {
                        const { invoke } = await import("@tauri-apps/api/core");
                        await invoke("apply_personality_voice", {
                          personalityType: value,
                        });
                        message.success("已切换到角色语音");
                      } catch (error) {
                        console.error("应用角色语音失败:", error);
                        // 不显示错误提示,保持用户体验流畅
                      }
                    }}
                  >
                    <Select.Option value="sunnyou_male">
                      <Space>
                        <span>🎮</span>
                        <span>
                          <strong>损友-男</strong> (老陈)
                        </span>
                        <span style={{ fontSize: 12, color: "#999" }}>
                          - 幽默损友,嘴贱心善
                        </span>
                      </Space>
                    </Select.Option>
                    <Select.Option value="funny_female">
                      <Space>
                        <span>😂</span>
                        <span>
                          <strong>搞笑-女</strong> (小雨)
                        </span>
                        <span style={{ fontSize: 12, color: "#999" }}>
                          - 活泼搞笑,主播风格
                        </span>
                      </Space>
                    </Select.Option>
                    <Select.Option value="kobe">
                      <Space>
                        <span>🐍</span>
                        <span>
                          <strong>牢大</strong> (Kobe)
                        </span>
                        <span style={{ fontSize: 12, color: "#999" }}>
                          - 曼巴精神,励志霸气
                        </span>
                      </Space>
                    </Select.Option>
                    <Select.Option value="sweet_girl">
                      <Space>
                        <span>🍬</span>
                        <span>
                          <strong>甜妹</strong> (糖糖)
                        </span>
                        <span style={{ fontSize: 12, color: "#999" }}>
                          - 温柔可爱,治愈系
                        </span>
                      </Space>
                    </Select.Option>
                    <Select.Option value="trump">
                      <Space>
                        <span>🦅</span>
                        <span>
                          <strong>特朗普</strong> (建国)
                        </span>
                        <span style={{ fontSize: 12, color: "#999" }}>
                          - 自信霸气,商业思维
                        </span>
                      </Space>
                    </Select.Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  noStyle
                  shouldUpdate={(prevValues, currentValues) =>
                    prevValues.aiModels?.aiPersonality !==
                    currentValues.aiModels?.aiPersonality
                  }
                >
                  {({ getFieldValue }) => {
                    const personality = getFieldValue([
                      "aiModels",
                      "aiPersonality",
                    ]);
                    const personalityInfo: Record<
                      string,
                      { name: string; desc: string; example: string }
                    > = {
                      sunnyou_male: {
                        name: "老陈 (Chen)",
                        desc: "游戏老手损友,说话带梗,适度嘲讽,但关键时刻靠谱",
                        example:
                          "笑死,又是这个BOSS,多少萌新死在这儿了😂 来,笔记记好了...",
                      },
                      funny_female: {
                        name: "小雨 (Rain)",
                        desc: "活泼搞笑的女性主播,自黑达人,充满表演欲",
                        example:
                          "哇塞!太厉害了吧!我都惊呆了!你是不是偷偷练过!🎉",
                      },
                      kobe: {
                        name: "牢大 (Kobe)",
                        desc: "传奇球星风格,曼巴精神,专注细节,励志霸气",
                        example:
                          "Mamba Mentality! 细节决定成败。Let's make it happen! 💪",
                      },
                      sweet_girl: {
                        name: "糖糖 (Candy)",
                        desc: "温柔可爱的甜妹,超级温柔体贴,正能量满满",
                        example:
                          "呀~这里确实有点难呢...不过没关系哦,糖糖来帮你~ ♡",
                      },
                      trump: {
                        name: "建国 (Donald)",
                        desc: "自信霸气的商业大亨风格,夸张表达,简单直接",
                        example:
                          "Believe me, this is the best strategy! We're gonna win so much! 🦅",
                      },
                    };

                    const info =
                      personalityInfo[personality] ||
                      personalityInfo.sunnyou_male;

                    return (
                      <div
                        style={{
                          padding: 16,
                          borderRadius: 8,
                          marginTop: 16,
                        }}
                      >
                        <div style={{ marginBottom: 8 }}>
                          <Text strong>角色名:</Text> <Text>{info.name}</Text>
                        </div>
                        <div style={{ marginBottom: 8 }}>
                          <Text strong>性格:</Text>{" "}
                          <Text type="secondary">{info.desc}</Text>
                        </div>
                        <div>
                          <Text strong>示例:</Text>
                          <div
                            style={{
                              marginTop: 8,
                              padding: 12,
                              borderRadius: 4,
                              borderLeft: "3px solid #1890ff",
                            }}
                          >
                            <Text italic>"{info.example}"</Text>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                </Form.Item>
              </Card>

              {/* Embedding 模型 */}
              <Card
                type="inner"
                title={
                  <Space>
                    <SearchOutlined />
                    <span>Embedding 模型</span>
                  </Space>
                }
                style={{ marginBottom: 16 }}
              >
                <Form.Item
                  label="启用"
                  name={["aiModels", "embedding", "enabled"]}
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>

                <Form.Item
                  label="提供商"
                  name={["aiModels", "embedding", "provider"]}
                  rules={[{ required: true, message: "请选择提供商" }]}
                >
                  <Select
                    placeholder="选择提供商"
                    onChange={(value) => {
                      // 根据提供商自动设置 API 地址
                      const apiBaseMap: Record<string, string> = {
                        openai: "https://api.openai.com/v1",
                        local: "http://localhost:11434/v1",
                        azure: "https://your-resource.openai.azure.com",
                      };

                      if (apiBaseMap[value]) {
                        form.setFieldValue(
                          ["aiModels", "embedding", "apiBase"],
                          apiBaseMap[value],
                        );
                      }

                      // 如果是本地模型,清空 API Key
                      if (value === "local") {
                        form.setFieldValue(
                          ["aiModels", "embedding", "apiKey"],
                          null,
                        );
                      }
                    }}
                  >
                    <Select.Option value="local">
                      本地模型 (Ollama)
                    </Select.Option>
                    <Select.Option value="openai">OpenAI</Select.Option>
                    <Select.Option value="azure">Azure OpenAI</Select.Option>
                    <Select.Option value="custom">自定义</Select.Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  label="API 地址"
                  name={["aiModels", "embedding", "apiBase"]}
                  rules={[{ required: true, message: "请输入 API 地址" }]}
                  tooltip="选择提供商后会自动填充,可手动修改"
                >
                  <Input placeholder="会根据提供商自动设置" />
                </Form.Item>

                <Form.Item
                  label="API Key"
                  name={["aiModels", "embedding", "apiKey"]}
                  tooltip="本地模型不需要,远程 API 必填"
                >
                  <Input.Password placeholder="sk-..." />
                </Form.Item>

                <Form.Item
                  label="模型名称"
                  name={["aiModels", "embedding", "modelName"]}
                  rules={[{ required: true, message: "请输入模型名称" }]}
                  tooltip="推荐: qwen3-embedding:4b, nomic-embed-text, text-embedding-3-small"
                >
                  <Input placeholder="qwen3-embedding:4b" />
                </Form.Item>
              </Card>

              {/* 多模态模型 */}
              <Card
                type="inner"
                title={
                  <Space>
                    <PictureOutlined />
                    <span>多模态模型 (AI 对话)</span>
                  </Space>
                }
              >
                <Alert
                  message="多模态模型说明"
                  description={
                    <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                      <li>
                        <strong>用途</strong>: AI 陪玩助手的智能对话和截图分析
                      </li>
                      <li>
                        <strong>推荐配置</strong>: OpenAI GPT-4o-mini (性价比高)
                      </li>
                      <li>
                        <strong>本地模型</strong>: Ollama qwen3-vl (需要先安装)
                      </li>
                      <li>
                        <strong>API Key</strong>: 在{" "}
                        <a
                          href="https://platform.openai.com/api-keys"
                          target="_blank"
                          rel="noreferrer"
                        >
                          OpenAI 官网
                        </a>{" "}
                        获取
                      </li>
                    </ul>
                  }
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />

                <Form.Item
                  label="启用"
                  name={["aiModels", "multimodal", "enabled"]}
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>

                <Form.Item
                  label="提供商"
                  name={["aiModels", "multimodal", "provider"]}
                  rules={[{ required: true, message: "请选择提供商" }]}
                >
                  <Select
                    placeholder="选择提供商"
                    onChange={(value) => {
                      // 根据提供商自动设置 API 地址
                      const apiBaseMap: Record<string, string> = {
                        openai: "https://api.openai.com/v1",
                        local: "http://localhost:11434",
                        azure: "https://your-resource.openai.azure.com",
                      };

                      if (apiBaseMap[value]) {
                        form.setFieldValue(
                          ["aiModels", "multimodal", "apiBase"],
                          apiBaseMap[value],
                        );
                      }

                      // 如果是本地模型,清空 API Key
                      if (value === "local") {
                        form.setFieldValue(
                          ["aiModels", "multimodal", "apiKey"],
                          null,
                        );
                      }
                    }}
                  >
                    <Select.Option value="openai">OpenAI</Select.Option>
                    <Select.Option value="local">
                      本地模型 (Ollama)
                    </Select.Option>
                    <Select.Option value="azure">Azure OpenAI</Select.Option>
                    <Select.Option value="custom">自定义</Select.Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  label="API 地址"
                  name={["aiModels", "multimodal", "apiBase"]}
                  rules={[{ required: true, message: "请输入 API 地址" }]}
                  tooltip="选择提供商后会自动填充,可手动修改"
                >
                  <Input placeholder="会根据提供商自动设置" />
                </Form.Item>

                <Form.Item
                  label="API Key"
                  name={["aiModels", "multimodal", "apiKey"]}
                  tooltip="OpenAI 必填 (sk- 开头)，本地模型不需要"
                >
                  <Input.Password placeholder="sk-..." />
                </Form.Item>

                <Form.Item
                  label="模型名称"
                  name={["aiModels", "multimodal", "modelName"]}
                  rules={[{ required: true, message: "请输入模型名称" }]}
                  tooltip="推荐: gpt-4o-mini, gpt-4-turbo, qwen3-vl:latest"
                >
                  <Input placeholder="gpt-4o-mini" />
                </Form.Item>

                <Divider>高级参数</Divider>

                <Form.Item
                  label="温度 (Temperature)"
                  name={["aiModels", "multimodal", "temperature"]}
                  tooltip="控制回复的随机性,0-2 之间,越高越随机"
                >
                  <InputNumber
                    min={0}
                    max={2}
                    step={0.1}
                    style={{ width: "100%" }}
                  />
                </Form.Item>

                <Form.Item
                  label="最大 Token 数"
                  name={["aiModels", "multimodal", "maxTokens"]}
                  tooltip="控制回复的长度,建议 500-2000"
                >
                  <InputNumber min={100} max={4000} style={{ width: "100%" }} />
                </Form.Item>
              </Card>

              {/* 向量数据库配置 */}
              <Card
                type="inner"
                title={
                  <Space>
                    <DatabaseOutlined />
                    <span>向量数据库</span>
                  </Space>
                }
                style={{ marginTop: 16 }}
              >
                <Alert
                  message="数据库模式说明"
                  description={
                    <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                      <li>
                        <strong>本地文件型 (推荐)</strong>:
                        无需额外配置，数据存储在本地文件中
                      </li>
                      <li>
                        <strong>Qdrant 服务器</strong>: 需要
                        Docker，性能最佳，适合大规模数据
                      </li>
                      <li>
                        <strong>AI 直接检索</strong>:
                        无需数据库，适合小数据集，但速度较慢
                      </li>
                    </ul>
                  }
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />

                <Form.Item
                  label="数据库模式"
                  name={["aiModels", "vectorDb", "mode"]}
                  rules={[{ required: true, message: "请选择数据库模式" }]}
                  tooltip="推荐使用本地文件型，无需配置"
                >
                  <Select placeholder="选择数据库模式">
                    <Select.Option value="local">
                      🏠 本地文件型 (推荐)
                    </Select.Option>
                    <Select.Option value="qdrant">
                      🚀 Qdrant 服务器
                    </Select.Option>
                    <Select.Option value="ai_direct">
                      🤖 AI 直接检索
                    </Select.Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  noStyle
                  shouldUpdate={(prevValues, currentValues) =>
                    prevValues.aiModels?.vectorDb?.mode !==
                    currentValues.aiModels?.vectorDb?.mode
                  }
                >
                  {({ getFieldValue }) => {
                    const mode = getFieldValue([
                      "aiModels",
                      "vectorDb",
                      "mode",
                    ]);

                    if (mode === "qdrant") {
                      return (
                        <>
                          <Form.Item
                            label="Qdrant 地址"
                            name={["aiModels", "vectorDb", "qdrantUrl"]}
                            rules={[
                              {
                                required: true,
                                message: "请输入 Qdrant 服务器地址",
                              },
                            ]}
                            tooltip="需要先启动 Qdrant Docker 容器"
                          >
                            <Input placeholder="http://localhost:6333" />
                          </Form.Item>
                          <Form.Item>
                            <Button
                              type="dashed"
                              block
                              onClick={async () => {
                                try {
                                  message.loading({
                                    content: "正在测试连接...",
                                    key: "vdb-test",
                                  });
                                  const result = await invoke<any>(
                                    "test_vector_db_connection",
                                  );
                                  message.success({
                                    content: result.message,
                                    key: "vdb-test",
                                    duration: 5,
                                  });
                                } catch (error: any) {
                                  message.error({
                                    content: `连接失败: ${error}`,
                                    key: "vdb-test",
                                    duration: 5,
                                  });
                                }
                              }}
                            >
                              🔌 测试数据库连接
                            </Button>
                          </Form.Item>
                        </>
                      );
                    }

                    if (mode === "local") {
                      return (
                        <Form.Item
                          label="存储路径"
                          name={["aiModels", "vectorDb", "localStoragePath"]}
                          tooltip="向量数据存储目录"
                        >
                          <Input placeholder="./data/vector_db" />
                        </Form.Item>
                      );
                    }

                    return null;
                  }}
                </Form.Item>
              </Card>
            </Tabs.TabPane>

            {/* 技能库设置 */}
            <Tabs.TabPane
              tab={
                <Space>
                  <DatabaseOutlined />
                  <span>技能库</span>
                </Space>
              }
              key="skill-library"
            >
              <Card type="inner" title="存储配置" style={{ marginBottom: 16 }}>
                <Form.Item
                  label="主存储目录"
                  name={["skillLibrary", "storageBasePath"]}
                  rules={[{ required: true, message: "请输入存储目录" }]}
                  tooltip="技能库文件将存储在此目录下，按游戏分类"
                >
                  <Input placeholder="C:\GamePartner\Skills" />
                </Form.Item>

                <Form.Item
                  label="保留历史版本数"
                  name={["skillLibrary", "maxVersionsToKeep"]}
                  rules={[
                    {
                      required: true,
                      type: "number",
                      min: 1,
                      max: 10,
                      message: "请输入 1-10 之间的数字",
                    },
                  ]}
                  tooltip="超过此数量的旧版本将被自动清理"
                >
                  <InputNumber min={1} max={10} style={{ width: "100%" }} />
                </Form.Item>

                <Form.Item
                  label="自动更新"
                  name={["skillLibrary", "autoUpdate"]}
                  valuePropName="checked"
                  tooltip="是否自动检查并更新技能库"
                >
                  <Switch />
                </Form.Item>

                <Form.Item
                  label="更新检查间隔 (小时)"
                  name={["skillLibrary", "updateCheckInterval"]}
                  rules={[
                    {
                      required: true,
                      type: "number",
                      min: 1,
                      message: "请输入有效的间隔时间",
                    },
                  ]}
                >
                  <InputNumber min={1} style={{ width: "100%" }} />
                </Form.Item>
              </Card>

              <Card type="inner" title="爬虫配置">
                <Form.Item
                  label="请求延迟 (毫秒)"
                  name={["skillLibrary", "crawler", "requestDelayMs"]}
                  rules={[
                    {
                      required: true,
                      type: "number",
                      min: 100,
                      message: "请输入有效的延迟时间",
                    },
                  ]}
                  tooltip="每次请求之间的延迟,避免对服务器造成压力"
                >
                  <InputNumber min={100} step={100} style={{ width: "100%" }} />
                </Form.Item>

                <Form.Item
                  label="最大并发请求数"
                  name={["skillLibrary", "crawler", "maxConcurrentRequests"]}
                  rules={[
                    {
                      required: true,
                      type: "number",
                      min: 1,
                      max: 20,
                      message: "请输入 1-20 之间的数字",
                    },
                  ]}
                  tooltip="同时进行的最大请求数量"
                >
                  <InputNumber min={1} max={20} style={{ width: "100%" }} />
                </Form.Item>

                <Form.Item
                  label="超时时间 (秒)"
                  name={["skillLibrary", "crawler", "timeoutSeconds"]}
                  rules={[
                    {
                      required: true,
                      type: "number",
                      min: 5,
                      message: "请输入有效的超时时间",
                    },
                  ]}
                  tooltip="单个请求的最大等待时间"
                >
                  <InputNumber min={5} style={{ width: "100%" }} />
                </Form.Item>
              </Card>
            </Tabs.TabPane>

            {/* 截图设置 */}
            <Tabs.TabPane
              tab={
                <Space>
                  <PictureOutlined />
                  <span>智能截图</span>
                </Space>
              }
              key="screenshot"
            >
              <Alert
                message="智能截图配置"
                description={
                  <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                    <li>
                      <strong>活跃模式</strong>: AI 助手运行时的截图频率,推荐
                      5-10 秒
                    </li>
                    <li>
                      <strong>闲置模式</strong>: 用户无操作时的截图频率,推荐
                      15-30 秒
                    </li>
                    <li>
                      <strong>自动发送给 AI</strong>: 开启后截图会自动触发 AI
                      分析
                    </li>
                    <li>
                      <strong>图片质量</strong>: 建议 80-90,平衡质量与文件大小
                    </li>
                  </ul>
                }
                type="info"
                showIcon
                style={{ marginBottom: 24 }}
              />

              <Card type="inner" title="基本配置">
                <Form.Item
                  label="启用智能截图"
                  name={["screenshot", "enabled"]}
                  valuePropName="checked"
                  tooltip="启用后可以自动截取游戏画面, 即使不开启智能截图, AI也会在对话时自动截取屏幕截图"
                >
                  <Switch />
                </Form.Item>

                <Form.Item
                  label="截图模式"
                  name={["screenshot", "captureMode"]}
                  tooltip="选择全屏或窗口截图模式"
                >
                  <Select>
                    <Select.Option value="fullscreen">
                      全屏截图
                    </Select.Option>
                    <Select.Option value="window">窗口截图</Select.Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  noStyle
                  shouldUpdate={(prevValues, currentValues) =>
                    prevValues.screenshot?.captureMode !==
                    currentValues.screenshot?.captureMode
                  }
                >
                  {({ getFieldValue }) => {
                    const captureMode = getFieldValue([
                      "screenshot",
                      "captureMode",
                    ]);

                    if (captureMode === "window") {
                      return (
                        <>
                          <Form.Item
                            label="目标窗口"
                            tooltip="选择要截图的窗口"
                          >
                            <Space
                              direction="vertical"
                              style={{ width: "100%" }}
                              size="small"
                            >
                              <Space.Compact style={{ width: "100%" }}>
                                <Form.Item
                                  name={["screenshot", "targetWindowId"]}
                                  noStyle
                                >
                                  <Select
                                    placeholder="请选择窗口"
                                    showSearch
                                    optionFilterProp="label"
                                    style={{ maxWidth: "calc(100% - 84px)", marginRight: 8 }}
                                    options={windows.map((w) => ({
                                      label: `${w.title} - ${w.app_name} (${w.width}x${w.height})`,
                                      value: w.id,
                                    }))}
                                    onChange={(windowId) => {
                                      const selectedWindow = windows.find(
                                        (w) => w.id === windowId,
                                      );
                                      if (selectedWindow) {
                                        form.setFieldsValue({
                                          screenshot: {
                                            targetWindowId: selectedWindow.id,
                                            targetWindowName:
                                              selectedWindow.title ||
                                              selectedWindow.app_name,
                                          },
                                        });
                                      }
                                    }}
                                  />
                                  <Button
                                    icon={<ReloadOutlined />}
                                    onClick={loadWindows}
                                    title="刷新窗口列表"
                                  >
                                    刷新
                                  </Button>
                                </Form.Item>
                              </Space.Compact>
                              <Form.Item
                                name={["screenshot", "targetWindowName"]}
                                noStyle
                              >
                                <Input type="hidden" />
                              </Form.Item>
                            </Space>
                          </Form.Item>
                          <Alert
                            message="提示"
                            description="窗口截图模式下，AI 对话时会自动截取您选择的窗口，无需手动操作"
                            type="info"
                            showIcon
                            style={{ marginBottom: 16 }}
                          />
                        </>
                      );
                    }
                    return null;
                  }}
                </Form.Item>

                <Form.Item
                  label="活跃模式截图间隔 (秒)"
                  name={["screenshot", "activeIntervalSeconds"]}
                  tooltip="AI 助手运行时的截图频率"
                  rules={[
                    {
                      type: "number",
                      min: 1,
                      max: 60,
                      message: "间隔必须在 1-60 秒之间",
                    },
                  ]}
                >
                  <InputNumber
                    min={1}
                    max={60}
                    style={{ width: "100%" }}
                    addonAfter="秒"
                  />
                </Form.Item>

                <Form.Item
                  label="闲置模式截图间隔 (秒)"
                  name={["screenshot", "idleIntervalSeconds"]}
                  tooltip="用户无操作时的截图频率"
                  rules={[
                    {
                      type: "number",
                      min: 5,
                      max: 120,
                      message: "间隔必须在 5-120 秒之间",
                    },
                  ]}
                >
                  <InputNumber
                    min={5}
                    max={120}
                    style={{ width: "100%" }}
                    addonAfter="秒"
                  />
                </Form.Item>

                <Form.Item
                  label="截图质量"
                  name={["screenshot", "quality"]}
                  tooltip="JPEG 压缩质量,1-100"
                  rules={[
                    {
                      type: "number",
                      min: 1,
                      max: 100,
                      message: "质量必须在 1-100 之间",
                    },
                  ]}
                >
                  <InputNumber
                    min={1}
                    max={100}
                    style={{ width: "100%" }}
                    addonAfter="%"
                  />
                </Form.Item>

                <Form.Item
                  label="目标文件大小 (KB)"
                  name={["screenshot", "targetSizeKb"]}
                  tooltip="压缩后的目标文件大小"
                  rules={[
                    {
                      type: "number",
                      min: 50,
                      max: 1000,
                      message: "文件大小必须在 50-1000 KB 之间",
                    },
                  ]}
                >
                  <InputNumber
                    min={50}
                    max={1000}
                    style={{ width: "100%" }}
                    addonAfter="KB"
                  />
                </Form.Item>

                <Form.Item
                  label="自动发送给 AI 分析"
                  name={["screenshot", "autoSendToAi"]}
                  valuePropName="checked"
                  tooltip="开启后,每次截图都会自动触发 AI 分析"
                >
                  <Switch />
                </Form.Item>
              </Card>

              {/* 截图测试 */}
              <Card type="inner" title="测试截图" style={{ marginTop: 16 }}>
                <Form.Item
                  noStyle
                  shouldUpdate={(prevValues, currentValues) =>
                    prevValues.screenshot?.captureMode !==
                      currentValues.screenshot?.captureMode ||
                    prevValues.screenshot?.targetWindowId !==
                      currentValues.screenshot?.targetWindowId
                  }
                >
                  {({ getFieldValue }) => {
                    const captureMode = getFieldValue([
                      "screenshot",
                      "captureMode",
                    ]);
                    const targetWindowId = getFieldValue([
                      "screenshot",
                      "targetWindowId",
                    ]);

                    return (
                      <>
                        <Alert
                          message="测试当前配置"
                          description="点击下方按钮测试截图功能,查看实际效果"
                          type="info"
                          showIcon
                          style={{ marginBottom: 16 }}
                        />
                        <Button
                          type="primary"
                          block
                          icon={<PictureOutlined />}
                          onClick={async () => {
                            try {
                              message.loading({
                                content: "正在截图...",
                                key: "screenshot-test",
                              });

                              let screenshot: any;
                              if (captureMode === "fullscreen") {
                                screenshot = await invoke(
                                  "capture_fullscreen",
                                  {
                                    displayId: 0,
                                  },
                                );
                              } else if (captureMode === "window") {
                                if (!targetWindowId) {
                                  message.warning({
                                    content: "请先选择目标窗口",
                                    key: "screenshot-test",
                                  });
                                  return;
                                }
                                screenshot = await invoke(
                                  "capture_window_command",
                                  {
                                    windowId: targetWindowId,
                                  },
                                );
                              }

                              message.success({
                                content: `截图成功! 大小: ${screenshot.width}x${screenshot.height}`,
                                key: "screenshot-test",
                              });

                              // 显示截图预览 (可选 - 使用 Modal)
                              const modal = Modal.info({
                                title: "截图预览",
                                width: 800,
                                content: (
                                  <div
                                    style={{
                                      textAlign: "center",
                                      marginTop: 16,
                                    }}
                                  >
                                    <img
                                      src={screenshot.data}
                                      alt="Screenshot"
                                      style={{
                                        maxWidth: "100%",
                                        maxHeight: "500px",
                                        objectFit: "contain",
                                      }}
                                    />
                                    <div style={{ marginTop: 16 }}>
                                      <Text type="secondary">
                                        分辨率: {screenshot.width}x
                                        {screenshot.height} | 模式:{" "}
                                        {captureMode === "fullscreen"
                                          ? "全屏"
                                          : "窗口"}
                                      </Text>
                                    </div>
                                  </div>
                                ),
                                okText: "关闭",
                                onOk: () => modal.destroy(),
                              });
                            } catch (error: any) {
                              message.error({
                                content: `截图失败: ${error}`,
                                key: "screenshot-test",
                              });
                            }
                          }}
                        >
                          测试截图
                        </Button>
                      </>
                    );
                  }}
                </Form.Item>
              </Card>
            </Tabs.TabPane>

            {/* TTS 语音设置 */}
            <Tabs.TabPane
              tab={
                <Space>
                  <SoundOutlined />
                  <span>语音播报</span>
                </Space>
              }
              key="tts"
            >
              <Alert
                message="TTS 语音播报配置"
                description={
                  <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                    <li>
                      <strong>Windows</strong>: 使用 SAPI 5 语音引擎
                    </li>
                    <li>
                      <strong>自动播报</strong>: AI 回复时自动朗读内容
                    </li>
                    <li>
                      <strong>语速/音量</strong>: 可根据个人喜好调整
                    </li>
                    <li>
                      <strong>音色</strong>: 支持系统安装的所有TTS音色
                    </li>
                  </ul>
                }
                type="info"
                showIcon
                style={{ marginBottom: 24 }}
              />

              <Card type="inner" title="基础设置">
                <Form.Item
                  label="启用 TTS"
                  name={["tts", "enabled"]}
                  valuePropName="checked"
                  tooltip="开启后可以使用语音播报功能"
                >
                  <Switch />
                </Form.Item>

                <Form.Item
                  label="AI 回复自动播报"
                  name={["tts", "autoSpeak"]}
                  valuePropName="checked"
                  tooltip="AI 回复时自动朗读内容,无需手动点击"
                >
                  <Switch />
                </Form.Item>

                <Form.Item
                  label="语速"
                  name={["tts", "rate"]}
                  tooltip="调整播报语速,1.0 为正常速度"
                >
                  <Slider
                    min={0.5}
                    max={2.0}
                    step={0.1}
                    marks={{
                      0.5: "慢速",
                      1.0: "正常",
                      1.5: "快速",
                      2.0: "极快",
                    }}
                    tooltip={{ formatter: (value) => `${value}x` }}
                  />
                </Form.Item>

                <Form.Item
                  label="音量"
                  name={["tts", "volume"]}
                  tooltip="调整播报音量"
                >
                  <Slider
                    min={0.0}
                    max={1.0}
                    step={0.1}
                    marks={{
                      0.0: "静音",
                      0.5: "中等",
                      1.0: "最大",
                    }}
                    tooltip={{
                      formatter: (value) =>
                        `${((value || 0) * 100).toFixed(0)}%`,
                    }}
                  />
                </Form.Item>

                <Form.Item
                  label="提供商"
                  name={["tts", "provider"]}
                  tooltip="选择 TTS 提供商"
                >
                  <Select
                    onChange={(value: string) => {
                      // 如果选择本地或系统，可以清空阿里云 Access Key
                      if (value !== "aliyun") {
                        form.setFieldValue(["tts", "aliyunAccessKey"], null);
                        form.setFieldValue(["tts", "aliyunAccessSecret"], null);
                        form.setFieldValue(["tts", "aliyunAppKey"], null);
                      }
                    }}
                  >
                    <Select.Option value="windows">
                      系统 TTS (Windows)
                    </Select.Option>
                    <Select.Option value="aliyun">
                      阿里云-智能语音交互
                    </Select.Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  noStyle
                  shouldUpdate={(prevValues, currentValues) =>
                    prevValues.tts?.provider !== currentValues.tts?.provider
                  }
                >
                  {({ getFieldValue }) => {
                    const provider = getFieldValue(["tts", "provider"]);
                    if (provider === "aliyun") {
                      return (
                        <>
                          <Form.Item
                            label="阿里云 Access Key"
                            name={["tts", "aliyunAccessKey"]}
                            rules={[
                              {
                                required: true,
                                message: "请输入阿里云 Access Key",
                              },
                            ]}
                            tooltip="用于阿里云语音服务的 Access Key (仅示例，生产环境请使用安全存储)"
                          >
                            <Input.Password placeholder="AccessKeyId:AccessKeySecret" />
                          </Form.Item>
                          <Form.Item
                            label="阿里云 Access Secret"
                            name={["tts", "aliyunAccessSecret"]}
                            rules={[
                              {
                                required: true,
                                message: "请输入阿里云 Access Secret",
                              },
                            ]}
                            tooltip="用于阿里云语音服务的 Access Secret (仅示例，生产环境请使用安全存储)"
                          >
                            <Input.Password placeholder="AccessKeyId:AccessKeySecret" />
                          </Form.Item>
                          <Form.Item
                            label="阿里云 AppKey"
                            name={["tts", "aliyunAppKey"]}
                            rules={[
                              {
                                required: true,
                                message: "请输入阿里云 AppKey",
                              },
                            ]}
                            tooltip="智能语音交互中创建的项目 AppKey，用于实时 ASR"
                          >
                            <Input placeholder="项目 AppKey" />
                          </Form.Item>
                        </>
                      );
                    }
                    return null;
                  }}
                </Form.Item>

                <Form.Item
                  noStyle
                  shouldUpdate={(prevValues, currentValues) =>
                    prevValues.tts?.enabled !== currentValues.tts?.enabled
                  }
                >
                  {({ getFieldValue }) => {
                    const ttsEnabled = getFieldValue(["tts", "enabled"]);

                    return ttsEnabled ? (
                      <>
                        <Form.Item label="测试播报">
                          <Space>
                            <Button
                              onClick={async () => {
                                try {
                                  const { invoke } =
                                    await import("@tauri-apps/api/core");
                                  const rate =
                                    getFieldValue(["tts", "rate"]) || 1.0;
                                  const volume =
                                    getFieldValue(["tts", "volume"]) || 0.8;

                                  await invoke("set_tts_rate", { rate });
                                  await invoke("set_tts_volume", { volume });
                                  await invoke("speak_text", {
                                    text: "你好,这是语音播报测试。AI 陪玩助手已准备就绪!",
                                    interrupt: true,
                                  });
                                  message.success("播报测试已开始");
                                } catch (error: any) {
                                  message.error(`测试失败: ${error}`);
                                }
                              }}
                            >
                              🔊 测试播报
                            </Button>
                            <Button
                              onClick={async () => {
                                try {
                                  const { invoke } =
                                    await import("@tauri-apps/api/core");
                                  await invoke("stop_speaking");
                                  message.info("已停止播报");
                                } catch (error: any) {
                                  message.error(`停止失败: ${error}`);
                                }
                              }}
                            >
                              ⏹ 停止
                            </Button>
                          </Space>
                        </Form.Item>

                        <Alert
                          message="💡 提示"
                          description='保存设置后,语速和音量将在下次播报时生效。你也可以点击"测试播报"立即体验。'
                          type="success"
                          showIcon
                          style={{ marginTop: 16 }}
                        />
                      </>
                    ) : null;
                  }}
                </Form.Item>
              </Card>
            </Tabs.TabPane>
          </Tabs>

          <Divider />

          <Space>
            <Button
              type="primary"
              size="large"
              loading={saving}
              onClick={handleSave}
            >
              保存设置
            </Button>
            <Button size="large" onClick={loadSettings}>
              重新加载
            </Button>
            <Button size="large" danger onClick={handleReset}>
              恢复默认
            </Button>
          </Space>
        </Form>
      </Card>
    </div>
  );
};

export default SettingsPanel;
