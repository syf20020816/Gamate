import { useState, useEffect } from "react";
import {
  Card,
  Typography,
  Row,
  Col,
  Space,
  Tag,
  Button,
  Progress,
  Modal,
  Input,
  Form,
  Select,
  Tooltip,
  Badge,
  Divider,
  message,
  Empty,
} from "antd";
import {
  Database,
  RefreshCw,
  Settings,
  FolderOpen,
  Trash2,
  CheckCircle,
  Calendar,
  HardDrive,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { motion } from "framer-motion";
import { useSkillLibraryStore } from "../../stores/skillLibraryStore";
import { getGameById } from "../../data/games";
import type { DownloadedSkillLibrary } from "../../types/skillLibrary";
import "./styles.scss";

const { Title, Text, Paragraph } = Typography;

const SkillDatabase: React.FC = () => {
  const { config, downloadedLibraries, updateConfig, removeDownloadedLibrary, setActiveVersion } =
    useSkillLibraryStore();
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [validating, setValidating] = useState(false);

  // 启动时验证所有已下载的库
  useEffect(() => {
    const validateLibraries = async () => {
      if (downloadedLibraries.length === 0) return;
      
      setValidating(true);
      let invalidCount = 0;

      for (const library of downloadedLibraries) {
        try {
          const isValid = await invoke<boolean>('validate_skill_library', {
            storagePath: library.storagePath,
          });

          if (!isValid) {
            console.warn(`无效的技能库（文件不存在）: ${library.gameName} - ${library.storagePath}`);
            // 自动清理无效记录
            removeDownloadedLibrary(library.id);
            invalidCount++;
          }
        } catch (error) {
          console.error('验证失败:', error);
        }
      }

      setValidating(false);

      if (invalidCount > 0) {
        message.warning(`已自动清理 ${invalidCount} 个无效的技能库记录`);
      }
    };

    validateLibraries();
  }, []); // 只在组件挂载时执行一次

  // 手动验证并清理无效记录
  const handleValidateLibraries = async () => {
    if (downloadedLibraries.length === 0) {
      message.info('暂无技能库记录');
      return;
    }

    setValidating(true);
    message.loading({ content: '正在验证技能库...', key: 'validate' });
    
    let invalidCount = 0;

    for (const library of downloadedLibraries) {
      try {
        const isValid = await invoke<boolean>('validate_skill_library', {
          storagePath: library.storagePath,
        });

        if (!isValid) {
          console.warn(`清理无效记录: ${library.gameName} - ${library.storagePath}`);
          removeDownloadedLibrary(library.id);
          invalidCount++;
        }
      } catch (error) {
        console.error('验证失败:', error);
      }
    }

    setValidating(false);

    if (invalidCount > 0) {
      message.success({ content: `已清理 ${invalidCount} 个无效记录`, key: 'validate' });
    } else {
      message.success({ content: '所有技能库都有效', key: 'validate' });
    }
  };

  // 格式化文件大小
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  // 格式化时间戳
  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // 处理配置保存
  const handleConfigSave = () => {
    form.validateFields().then((values) => {
      updateConfig(values);
      message.success("配置已保存");
      setConfigModalVisible(false);
    });
  };

  // 处理更新技能库
  const handleUpdateLibrary = async (library: DownloadedSkillLibrary) => {
    Modal.confirm({
      title: "更新技能库",
      content: `确定要更新 ${library.gameName} 的技能库吗？将下载最新版本。`,
      okText: "确认更新",
      cancelText: "取消",
      onOk: async () => {
        try {
          message.loading({ content: "正在更新技能库...", key: "update" });
          const newTimestamp = Math.floor(Date.now() / 1000);
          
          await invoke('update_skill_library', { 
            gameId: library.gameId,
            skillConfigId: library.skillConfigId,
            timestamp: newTimestamp 
          });
          
          message.success({ content: "技能库更新成功", key: "update" });
          
          // TODO: 刷新技能库列表
        } catch (error) {
          console.error('更新失败:', error);
          message.error({ content: `更新失败: ${error}`, key: "update" });
        }
      },
    });
  };

  // 处理删除技能库
  const handleDeleteLibrary = async (library: DownloadedSkillLibrary) => {
    Modal.confirm({
      title: "删除技能库",
      content: `确定要删除 ${library.gameName} (${formatTimestamp(library.timestamp)}) 吗？`,
      okText: "确认删除",
      okType: "danger",
      cancelText: "取消",
      onOk: async () => {
        try {
          message.loading({ content: "正在删除...", key: "delete" });
          
          // 调用 Tauri 后端删除文件（即使文件不存在也会成功）
          await invoke('delete_skill_library', { storagePath: library.storagePath });
          
          // 从 store 中移除记录（确保即使后端失败也能清理）
          removeDownloadedLibrary(library.id);
          
          message.success({ content: "已删除技能库", key: "delete" });
        } catch (error) {
          console.error('删除失败:', error);
          // 即使删除文件失败，仍然移除记录
          removeDownloadedLibrary(library.id);
          message.warning({ content: `文件删除失败，但已清理记录: ${error}`, key: "delete" });
        }
      },
    });
  };

  // 处理切换活跃版本
  const handleSetActive = (library: DownloadedSkillLibrary) => {
    setActiveVersion(library.gameId, library.timestamp);
    message.success(`已切换到版本: ${formatTimestamp(library.timestamp)}`);
  };

  // 打开存储目录
  const handleOpenFolder = async (path: string) => {
    try {
      await invoke('open_folder', { path });
      message.success(`已打开目录`);
    } catch (error) {
      console.error('打开目录失败:', error);
      message.error(`打开目录失败: ${error}`);
    }
  };

  // 选择文件夹
  const handleSelectFolder = async () => {
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: "选择存储目录",
      });
      
      if (selectedPath && typeof selectedPath === 'string') {
        form.setFieldValue('storageBasePath', selectedPath);
        message.success('已选择目录');
      }
    } catch (error) {
      console.error('选择目录失败:', error);
      message.error(`选择目录失败: ${error}`);
    }
  };

  // 按游戏分组
  const groupedLibraries = downloadedLibraries.reduce((acc, lib) => {
    if (!acc[lib.gameId]) {
      acc[lib.gameId] = [];
    }
    acc[lib.gameId].push(lib);
    return acc;
  }, {} as Record<string, DownloadedSkillLibrary[]>);

  // 对每个游戏的版本按时间戳降序排序
  Object.keys(groupedLibraries).forEach((gameId) => {
    groupedLibraries[gameId].sort((a, b) => b.timestamp - a.timestamp);
  });

  const totalSize = downloadedLibraries.reduce((sum, lib) => sum + lib.storageSize, 0);
  const activeLibraries = downloadedLibraries.filter((lib) => lib.status === "active");

  return (
    <div className="skill-database">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* 头部 */}
        <div className="database-header">
          <div>
            <Title level={3}>技能库管理</Title>
            <Paragraph type="secondary">
              管理已下载的游戏技能库，支持多版本保存和快速切换
            </Paragraph>
          </div>
          <Space>
            <Tooltip title="验证并清理无效记录">
              <Button
                icon={<RefreshCw size={18} />}
                onClick={handleValidateLibraries}
                loading={validating}
              >
                验证
              </Button>
            </Tooltip>
            <Tooltip title="配置技能库">
              <Button
                icon={<Settings size={18} />}
                onClick={() => {
                  form.setFieldsValue(config);
                  setConfigModalVisible(true);
                }}
              >
                配置
              </Button>
            </Tooltip>
            <Tooltip title="打开存储目录">
              <Button
                icon={<FolderOpen size={18} />}
                onClick={() => handleOpenFolder(config.storageBasePath)}
              >
                打开目录
              </Button>
            </Tooltip>
          </Space>
        </div>

        {/* 统计卡片 */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Space direction="vertical" size={0}>
                <Text type="secondary">已下载游戏</Text>
                <Title level={3} style={{ margin: 0 }}>
                  {Object.keys(groupedLibraries).length}
                </Title>
              </Space>
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Space direction="vertical" size={0}>
                <Text type="secondary">技能库版本</Text>
                <Title level={3} style={{ margin: 0 }}>
                  {downloadedLibraries.length}
                </Title>
              </Space>
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Space direction="vertical" size={0}>
                <Text type="secondary">活跃版本</Text>
                <Title level={3} style={{ margin: 0 }}>
                  {activeLibraries.length}
                </Title>
              </Space>
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Space direction="vertical" size={0}>
                <Text type="secondary">总存储大小</Text>
                <Title level={3} style={{ margin: 0 }}>
                  {formatSize(totalSize)}
                </Title>
              </Space>
            </Card>
          </Col>
        </Row>

        {/* 技能库列表 */}
        {Object.keys(groupedLibraries).length === 0 ? (
          <Card>
            <Empty
              image={<Database size={64} style={{ opacity: 0.3 }} />}
              description={
                <Space direction="vertical">
                  <Text type="secondary">还没有下载任何技能库</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    前往游戏库添加游戏后，系统会自动下载对应的技能库
                  </Text>
                </Space>
              }
            />
          </Card>
        ) : (
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            {Object.entries(groupedLibraries).map(([gameId, libraries]) => {
              const game = getGameById(gameId);

              return (
                <Card
                  key={gameId}
                  className="game-skill-card"
                  title={
                    <Space>
                      <Database size={20} />
                      <span>{game?.name || gameId}</span>
                      <Tag color="blue">{libraries.length} 个版本</Tag>
                    </Space>
                  }
                >
                  <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                    {libraries.map((library, index) => (
                      <motion.div
                        key={library.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Card
                          size="small"
                          className={`version-card ${library.status === "active" ? "active" : ""}`}
                        >
                          <Row gutter={16} align="middle">
                            <Col flex="auto">
                              <Space direction="vertical" size={4} style={{ width: "100%" }}>
                                <Space>
                                  {library.status === "active" && (
                                    <Badge status="success" text="活跃版本" />
                                  )}
                                  {library.status === "outdated" && (
                                    <Badge status="default" text="历史版本" />
                                  )}
                                  {library.status === "error" && (
                                    <Badge status="error" text="错误" />
                                  )}
                                  <Text strong>{library.skillConfigName}</Text>
                                  <Tag>{library.version}</Tag>
                                </Space>

                                <Space size="large" wrap>
                                  <Tooltip title="下载时间">
                                    <Space size={4}>
                                      <Calendar size={14} />
                                      <Text type="secondary" style={{ fontSize: 12 }}>
                                        {formatTimestamp(library.timestamp)}
                                      </Text>
                                    </Space>
                                  </Tooltip>

                                  <Tooltip title="存储大小">
                                    <Space size={4}>
                                      <HardDrive size={14} />
                                      <Text type="secondary" style={{ fontSize: 12 }}>
                                        {formatSize(library.storageSize)}
                                      </Text>
                                    </Space>
                                  </Tooltip>

                                  <Tooltip title="条目数">
                                    <Space size={4}>
                                      <Database size={14} />
                                      <Text type="secondary" style={{ fontSize: 12 }}>
                                        {library.statistics.totalEntries.toLocaleString()} 条目
                                      </Text>
                                    </Space>
                                  </Tooltip>

                                  <Tooltip title="存储路径">
                                    <Space size={4}>
                                      <FolderOpen size={14} />
                                      <Text
                                        type="secondary"
                                        style={{ fontSize: 12, maxWidth: 200 }}
                                        ellipsis={{ tooltip: library.storagePath }}
                                      >
                                        {library.storagePath}
                                      </Text>
                                    </Space>
                                  </Tooltip>
                                </Space>
                              </Space>
                            </Col>

                            <Col>
                              <Space>
                                {library.status !== "active" && (
                                  <Tooltip title="设为活跃版本">
                                    <Button
                                      size="small"
                                      icon={<CheckCircle size={16} />}
                                      onClick={() => handleSetActive(library)}
                                    >
                                      激活
                                    </Button>
                                  </Tooltip>
                                )}

                                {library.status === "active" && (
                                  <Tooltip title="更新到最新版本">
                                    <Button
                                      size="small"
                                      type="primary"
                                      icon={<RefreshCw size={16} />}
                                      onClick={() => handleUpdateLibrary(library)}
                                    >
                                      更新
                                    </Button>
                                  </Tooltip>
                                )}

                                <Tooltip title="打开存储目录">
                                  <Button
                                    size="small"
                                    icon={<FolderOpen size={16} />}
                                    onClick={() => handleOpenFolder(library.storagePath)}
                                  />
                                </Tooltip>

                                <Tooltip title="删除此版本">
                                  <Button
                                    size="small"
                                    danger
                                    icon={<Trash2 size={16} />}
                                    onClick={() => handleDeleteLibrary(library)}
                                    disabled={library.status === "active" && libraries.length === 1}
                                  />
                                </Tooltip>
                              </Space>
                            </Col>
                          </Row>
                        </Card>
                      </motion.div>
                    ))}
                  </Space>
                </Card>
              );
            })}
          </Space>
        )}
      </motion.div>

      {/* 配置弹窗 */}
      <Modal
        title={
          <Space>
            <Settings size={20} />
            <span>技能库配置</span>
          </Space>
        }
        open={configModalVisible}
        onOk={handleConfigSave}
        onCancel={() => setConfigModalVisible(false)}
        okText="保存"
        cancelText="取消"
        width={600}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 24 }}>
          <Form.Item
            label="主存储目录"
            name="storageBasePath"
            rules={[{ required: true, message: "请输入存储目录" }]}
            extra="技能库文件将存储在此目录下，按游戏分类"
          >
            <Input
              placeholder="C:\GamePartner\Skills"
              suffix={
                <Tooltip title="选择目录">
                  <Button
                    size="small"
                    icon={<FolderOpen size={14} />}
                    type="text"
                    onClick={handleSelectFolder}
                  />
                </Tooltip>
              }
            />
          </Form.Item>

          <Form.Item
            label="保留历史版本数"
            name="maxVersionsToKeep"
            rules={[{ required: true, message: "请输入保留版本数" }]}
            extra="超过此数量的旧版本将被自动清理"
          >
            <Select>
              <Select.Option value={1}>仅保留最新版本</Select.Option>
              <Select.Option value={2}>保留 2 个版本</Select.Option>
              <Select.Option value={3}>保留 3 个版本</Select.Option>
              <Select.Option value={5}>保留 5 个版本</Select.Option>
              <Select.Option value={10}>保留 10 个版本</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="自动更新"
            name="autoUpdate"
            valuePropName="checked"
            extra="启用后将自动检查并下载技能库更新"
          >
            <Select>
              <Select.Option value={false}>关闭</Select.Option>
              <Select.Option value={true}>开启</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="更新检查间隔"
            name="updateCheckInterval"
            rules={[{ required: true, message: "请选择检查间隔" }]}
          >
            <Select disabled={!form.getFieldValue("autoUpdate")}>
              <Select.Option value={6}>每 6 小时</Select.Option>
              <Select.Option value={12}>每 12 小时</Select.Option>
              <Select.Option value={24}>每 24 小时</Select.Option>
              <Select.Option value={168}>每周</Select.Option>
            </Select>
          </Form.Item>
        </Form>

        <Divider />

        <Space direction="vertical" size="small" style={{ width: "100%" }}>
          <Text strong>存储空间概览</Text>
          <Progress
            percent={Math.min((totalSize / (5 * 1024 * 1024 * 1024)) * 100, 100)}
            format={() => `${formatSize(totalSize)} / 5 GB`}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            建议定期清理不需要的历史版本以节省空间
          </Text>
        </Space>
      </Modal>
    </div>
  );
};

export default SkillDatabase;
