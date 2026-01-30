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
} from "antd";
import {
  SettingOutlined,
  GlobalOutlined,
  RobotOutlined,
  DatabaseOutlined,
  SearchOutlined,
  PictureOutlined,
} from "@ant-design/icons";
import { invoke } from "@tauri-apps/api/core";
import "./styles.scss";

const { Title, Text, Paragraph } = Typography;

interface AppSettings {
  general: {
    language: string;
    theme: string;
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
    vectorDb: {
      mode: string;
      qdrantUrl?: string;
      localStoragePath?: string;
    };
  };
}

interface ModelConfig {
  provider: string;
  apiBase: string;
  apiKey?: string | null;
  modelName: string;
  enabled: boolean;
}

const SettingsPanel: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

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
          },
          multimodal: {
            provider: data.ai_models?.multimodal?.provider || "local",
            apiBase:
              data.ai_models?.multimodal?.api_base ||
              "http://localhost:11434/v1",
            apiKey: data.ai_models?.multimodal?.api_key || null,
            modelName:
              data.ai_models?.multimodal?.model_name || "qwen3-vl:latest",
            enabled: data.ai_models?.multimodal?.enabled !== false,
          },
          vectorDb: {
            mode: data.ai_models?.vector_db?.mode || "local",
            qdrantUrl:
              data.ai_models?.vector_db?.qdrant_url || "http://localhost:6333",
            localStoragePath:
              data.ai_models?.vector_db?.local_storage_path ||
              "./data/vector_db",
          },
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
          },
          multimodal: {
            provider: values.aiModels.multimodal.provider,
            api_base: values.aiModels.multimodal.apiBase,
            api_key: values.aiModels.multimodal.apiKey || null,
            model_name: values.aiModels.multimodal.modelName,
            enabled: values.aiModels.multimodal.enabled,
          },
          vector_db: {
            mode: values.aiModels.vectorDb.mode,
            qdrant_url: values.aiModels.vectorDb.qdrantUrl || null,
            local_storage_path:
              values.aiModels.vectorDb.localStoragePath || null,
          },
        },
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
          <SettingOutlined style={{ fontSize: 24 }} />
          <Title level={2} style={{ margin: 0 }}>
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
                  <Select placeholder="选择提供商">
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
                  tooltip="本地 Ollama 默认: http://localhost:11434/v1"
                >
                  <Input placeholder="http://localhost:11434/v1" />
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
                    <span>多模态模型</span>
                  </Space>
                }
              >
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
                  <Select placeholder="选择提供商">
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
                  name={["aiModels", "multimodal", "apiBase"]}
                  rules={[{ required: true, message: "请输入 API 地址" }]}
                >
                  <Input placeholder="http://localhost:11434/v1" />
                </Form.Item>

                <Form.Item
                  label="API Key"
                  name={["aiModels", "multimodal", "apiKey"]}
                >
                  <Input.Password placeholder="sk-..." />
                </Form.Item>

                <Form.Item
                  label="模型名称"
                  name={["aiModels", "multimodal", "modelName"]}
                  rules={[{ required: true, message: "请输入模型名称" }]}
                  tooltip="推荐: qwen3-vl:latest, llava:latest, gpt-4-vision-preview"
                >
                  <Input placeholder="qwen3-vl:latest" />
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
