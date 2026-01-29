import { useState } from "react";
import {
  Card,
  Typography,
  Button,
  Tag,
  Space,
  Modal,
  Badge,
  Tooltip,
  Input,
  Select,
  message,
  Progress,
  Flex,
} from "antd";
import {
  Plus,
  Download,
  CheckCircle,
  Clock,
  AlertCircle,
  Search,
  Filter,
} from "lucide-react";
import { motion } from "framer-motion";
import { GAMES, getSkillConfigsByGameId } from "../../data/games";
import { useUserStore } from "../../stores/userStore";
import { useSkillLibraryStore } from "../../stores/skillLibraryStore";
import { GameType, GameTypeLabels, SkillStatus } from "../../types/game";
import type { Game, GameSkillConfig } from "../../types/game";
import type { DownloadedSkillLibrary } from "../../types/skillLibrary";
import "./styles.scss";

const { Title, Text, Paragraph } = Typography;

const GameLibrary: React.FC = () => {
  const { user, addSelectedGame, removeSelectedGame } = useUserStore();
  const { config, addDownloadedLibrary } = useSkillLibraryStore();
  const [searchText, setSearchText] = useState("");
  const [filterType, setFilterType] = useState<GameType | "all">("all");
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [skillModalVisible, setSkillModalVisible] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);

  const selectedGameIds = user?.config.selectedGames || [];

  // 过滤游戏
  const filteredGames = GAMES.filter((game) => {
    const matchSearch =
      game.name.toLowerCase().includes(searchText.toLowerCase()) ||
      game.nameEn?.toLowerCase().includes(searchText.toLowerCase());
    const matchType = filterType === "all" || game.category === filterType;
    return matchSearch && matchType;
  });

  const handleAddGame = (game: Game) => {
    setSelectedGame(game);
    setSkillModalVisible(true);
  };

  const handleConfirmAddGame = async (skillConfig: GameSkillConfig) => {
    if (!selectedGame) return;

    setIsDownloading(true);
    setDownloadProgress(0);

    let progressInterval: ReturnType<typeof setInterval> | null = null;

    try {
      // 生成时间戳（秒级）
      const timestamp = Math.floor(Date.now() / 1000);
      const storagePath = `${config.storageBasePath}\\${selectedGame.id}\\${timestamp}`;

      // 模拟下载进度
      progressInterval = setInterval(() => {
        setDownloadProgress((prev) => {
          if (prev >= 90) {
            return 90;
          }
          return prev + 10;
        });
      }, 300);

      // 调用 Tauri 后端下载 Wiki
      const { invoke } = await import("@tauri-apps/api/core");

      const result = await invoke<any>("download_wiki", {
        params: {
          gameId: selectedGame.id,
          skillConfigId: skillConfig.id,
          repo: skillConfig.repo,
          sourceType: skillConfig.source,
          timestamp,
          storagePath,
          githubToken: null,
        },
      });

      if (progressInterval) clearInterval(progressInterval);
      setDownloadProgress(100);

      // 检查下载结果
      if (!result || result.totalEntries === 0) {
        throw new Error("下载失败：未获取到任何内容");
      }

      // 创建技能库记录
      const library: DownloadedSkillLibrary = {
        id: `lib_${timestamp}_${selectedGame.id}`,
        gameId: selectedGame.id,
        gameName: selectedGame.name,
        skillConfigId: skillConfig.id,
        skillConfigName: skillConfig.name,
        version: skillConfig.version,
        timestamp,
        storagePath,
        storageSize: result.totalBytes || 0,
        downloadedAt: new Date().toISOString(),
        statistics: {
          totalEntries: result.totalEntries || 0,
          vectorCount: result.totalEntries || 0,
        },
        status: "active",
      };

      addDownloadedLibrary(library);
      addSelectedGame(selectedGame.id);

      message.success(
        `${selectedGame.name} 技能库下载完成！共 ${result.totalEntries} 条目`,
      );

      setTimeout(() => {
        setSkillModalVisible(false);
        setSelectedGame(null);
        setIsDownloading(false);
        setDownloadProgress(0);
      }, 500);
    } catch (error) {
      if (progressInterval) clearInterval(progressInterval);
      console.error("下载失败:", error);
      message.error(`下载失败: ${error}`);
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  const handleRemoveGame = (gameId: string) => {
    Modal.confirm({
      title: "确认移除",
      content: "确定要从游戏库中移除这个游戏吗？",
      okText: "确认",
      cancelText: "取消",
      onOk: () => {
        removeSelectedGame(gameId);
        message.success("已移除游戏");
      },
    });
  };

  const getStatusBadge = (status: SkillStatus) => {
    const badges = {
      [SkillStatus.NotDownloaded]: {
        status: "default",
        text: "未下载",
        icon: <Clock size={14} />,
      },
      [SkillStatus.Downloading]: {
        status: "processing",
        text: "下载中",
        icon: <Download size={14} />,
      },
      [SkillStatus.Processing]: {
        status: "processing",
        text: "处理中",
        icon: <Clock size={14} />,
      },
      [SkillStatus.Ready]: {
        status: "success",
        text: "就绪",
        icon: <CheckCircle size={14} />,
      },
      [SkillStatus.Error]: {
        status: "error",
        text: "错误",
        icon: <AlertCircle size={14} />,
      },
      [SkillStatus.Outdated]: {
        status: "warning",
        text: "需更新",
        icon: <AlertCircle size={14} />,
      },
    };
    return badges[status];
  };

  return (
    <div className="game-library">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="library-header">
          <div>
            <Title level={3}>游戏库</Title>
            <Paragraph type="secondary">
              选择你要玩的游戏，系统将自动下载对应的Wiki技能库
            </Paragraph>
          </div>
          <Space>
            <Badge count={selectedGameIds.length} showZero>
              <Button type="primary" icon={<CheckCircle size={18} />}>
                我的游戏
              </Button>
            </Badge>
          </Space>
        </div>

        {/* 搜索和过滤 */}
        <Card className="filter-card">
          <Space size="middle" style={{ width: "100%" }}>
            <Input
              placeholder="搜索游戏名称..."
              prefix={<Search size={16} />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 300 }}
              allowClear
            />
            <Select
              value={filterType}
              onChange={setFilterType}
              style={{ width: 150 }}
              suffixIcon={<Filter size={16} />}
            >
              <Select.Option value="all">全部类型</Select.Option>
              {Object.entries(GameTypeLabels).map(([key, label]) => (
                <Select.Option key={key} value={key}>
                  {label}
                </Select.Option>
              ))}
            </Select>
          </Space>
        </Card>

        {/* 游戏卡片列表 */}
        <Flex wrap="wrap" gap={16} align="flex-start" justify="space-between">
          {filteredGames.map((game, index) => {
            const isAdded = selectedGameIds.includes(game.id);
            const skillConfigs = getSkillConfigsByGameId(game.id);

            return (
              <div key={game.id} style={{ width: "46%", minWidth: 240 }}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card
                    hoverable
                    className={`game-card ${isAdded ? "game-card-added" : ""}`}
                    cover={
                      <div className="game-banner">
                        <div className="game-banner-placeholder">
                          <img
                            src={game.banner}
                            alt={game.icon || game.name[0]}
                          />
                        </div>
                        {isAdded && (
                          <div className="added-overlay">
                            <CheckCircle size={48} />
                          </div>
                        )}
                      </div>
                    }
                  >
                    <Card.Meta
                      title={
                        <Space
                          style={{
                            width: "100%",
                            justifyContent: "space-between",
                          }}
                        >
                          <span>{game.name}</span>
                          <Tag color="blue">
                            {GameTypeLabels[game.category]}
                          </Tag>
                        </Space>
                      }
                      description={
                        <div className="game-description">
                          <Paragraph
                            ellipsis={{ rows: 2 }}
                            type="secondary"
                            style={{ marginBottom: 8 }}
                          >
                            {game.description}
                          </Paragraph>
                          <Space size={4} wrap>
                            {game.tags.slice(0, 3).map((tag) => (
                              <Tag key={tag} style={{ margin: 0 }}>
                                {tag}
                              </Tag>
                            ))}
                          </Space>
                        </div>
                      }
                    />

                    <div className="game-footer">
                      <Space size="small">
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {skillConfigs.length} 个技能库
                        </Text>
                      </Space>
                      {!isAdded ? (
                        <Button
                          type="primary"
                          icon={<Plus size={16} />}
                          onClick={() => handleAddGame(game)}
                        >
                          添加
                        </Button>
                      ) : (
                        <Button
                          danger
                          onClick={() => handleRemoveGame(game.id)}
                        >
                          移除
                        </Button>
                      )}
                    </div>
                  </Card>
                </motion.div>
              </div>
            );
          })}
        </Flex>
      </motion.div>

      {/* 技能库选择弹窗 */}
      <Modal
        title={`选择 ${selectedGame?.name} 的技能库`}
        open={skillModalVisible}
        onCancel={() => !isDownloading && setSkillModalVisible(false)}
        footer={null}
        width={600}
        closable={!isDownloading}
        maskClosable={!isDownloading}
      >
        {selectedGame && (
          <>
            {isDownloading ? (
              <div style={{ padding: "40px 20px", textAlign: "center" }}>
                <Space
                  direction="vertical"
                  size="large"
                  style={{ width: "100%" }}
                >
                  <Download size={48} color="#1890ff" />
                  <div>
                    <Title level={4}>正在下载技能库...</Title>
                    <Paragraph type="secondary">
                      正在从 Wiki 抓取数据并生成向量库
                    </Paragraph>
                  </div>
                  <Progress percent={downloadProgress} status="active" />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    下载完成后将自动保存到: {config.storageBasePath}
                  </Text>
                </Space>
              </div>
            ) : (
              <Space
                direction="vertical"
                size="middle"
                style={{ width: "100%" }}
              >
                {getSkillConfigsByGameId(selectedGame.id).map((config) => {
                  const badge = getStatusBadge(config.status);
                  return (
                    <Card
                      key={config.id}
                      hoverable
                      onClick={() => handleConfirmAddGame(config)}
                      className="skill-config-card"
                    >
                      <Space direction="vertical" style={{ width: "100%" }}>
                        <Space
                          style={{
                            width: "100%",
                            justifyContent: "space-between",
                          }}
                        >
                          <Text strong>{config.name}</Text>
                          <Badge
                            status={badge.status as any}
                            text={
                              <Space size={4}>
                                {badge.icon}
                                {badge.text}
                              </Space>
                            }
                          />
                        </Space>
                        <Paragraph
                          type="secondary"
                          style={{ margin: 0, fontSize: 12 }}
                        >
                          {config.description}
                        </Paragraph>
                        <Space size="large">
                          <Tooltip title="Wiki 来源">
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              📚 {config.source}
                            </Text>
                          </Tooltip>
                          <Tooltip title="版本">
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              🔖 v{config.version}
                            </Text>
                          </Tooltip>
                        </Space>
                      </Space>
                    </Card>
                  );
                })}
              </Space>
            )}
          </>
        )}
      </Modal>
    </div>
  );
};

export default GameLibrary;
