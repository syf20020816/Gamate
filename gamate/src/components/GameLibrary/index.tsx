import { useState, useEffect, useCallback, useRef } from "react";
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
  Empty,
  Pagination,
  Switch,
} from "antd";
import {
  Plus,
  Download,
  CheckCircle,
  Clock,
  AlertCircle,
  Search,
  Filter,
  RefreshCw,
} from "lucide-react";
import { motion } from "framer-motion";
import { useUserStore } from "../../stores/userStore";
import { GameType, GameTypeLabels, SkillStatus } from "../../types/game";
import type { Game, GameSkillConfig } from "../../types/game";
import {
  getGames,
  getSkillConfigsByGameId,
} from "../../services/configService";
import { getSkillLibraryConfig } from "../../services/settingsService";
import "./styles.scss";

const { Title, Text, Paragraph } = Typography;

const GameLibrary: React.FC = () => {
  const { addSelectedGame, removeSelectedGame } = useUserStore();
  const [searchText, setSearchText] = useState("");
  const [filterType, setFilterType] = useState<GameType | "all">("all");
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [skillModalVisible, setSkillModalVisible] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [games, setGames] = useState<Game[]>([]);
  const [skillConfigs, setSkillConfigs] = useState<GameSkillConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGameIds, setSelectedGameIds] = useState<string[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [storageBasePath, setStorageBasePath] = useState<string>("./data/skills");
  
  // Steam 相关状态
  const [useSteamLibrary, setUseSteamLibrary] = useState(false);
  const [steamUser, setSteamUser] = useState<any>(null);
  const [steamGames, setSteamGames] = useState<any[]>([]);
  
  // 分页相关状态
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize] = useState(10);
  const [totalGames, setTotalGames] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  
  // 缓存已加载的页面
  const gamesCache = useRef<Map<number, Game[]>>(new Map());
  const steamGamesCache = useRef<Map<number, any[]>>(new Map());

  // 从后端加载选中的游戏列表
  // 加载配置和选中的游戏
  useEffect(() => {
    const loadData = async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        
        // 加载技能库配置
        const config = await getSkillLibraryConfig();
        setStorageBasePath(config.storageBasePath);
        
        // 加载选中的游戏
        const settings = await invoke<any>("get_app_settings");
        const selected = settings?.user?.selected_games || [];
        setSelectedGameIds(selected);
      } catch (error) {
        console.error("加载配置失败:", error);
      }
    };
    loadData();
  }, []);

  // 检查 Steam 登录状态
  useEffect(() => {
    const checkSteamUser = async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const user = await invoke<any>("get_current_steam_user");
        if (user) {
          setSteamUser(user);
          setUseSteamLibrary(true);
          // 加载 Steam 游戏库
          await loadSteamLibrary();
        }
      } catch (error) {
        console.log("未登录 Steam");
      }
    };
    checkSteamUser();
  }, []);

  // 加载 Steam 游戏库（分页）
  const loadSteamLibrary = useCallback(async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const library = await invoke<any>("fetch_steam_library", {
        includeFreeGames: true, // 包含免费游戏
      });
      setSteamGames(library || []);
      setTotalGames(library?.length || 0);
    } catch (error) {
      console.error("加载 Steam 游戏库失败:", error);
      message.error("加载 Steam 游戏库失败");
    }
  }, []);

  // 从后端分页加载游戏列表（默认游戏库或 Steam）
  const loadGamesPage = useCallback(
    async (page: number) => {
      // 检查缓存
      const cacheKey = useSteamLibrary ? steamGamesCache : gamesCache;
      if (cacheKey.current.has(page)) {
        const cachedGames = cacheKey.current.get(page)!;
        setGames(cachedGames);
        return;
      }

      try {
        setLoading(true);

        if (useSteamLibrary && steamGames.length > 0) {
          // 使用 Steam 游戏库（前端分页）
          const start = page * pageSize;
          const end = Math.min(start + pageSize, steamGames.length);
          const pageGames = steamGames.slice(start, end);
          
          // 转换为统一的 Game 格式
          const convertedGames: Game[] = pageGames.map((game: any) => ({
            id: `steam_${game.appid}`,
            name: game.name,
            nameEn: game.name,
            category: GameType.Other, // Steam 游戏默认分类
            description: `总游玩时间: ${Math.floor((game.playtime_forever || 0) / 60)} 小时`,
            tags: ["Steam"],
            banner: `https://steamcdn-a.akamaihd.net/steam/apps/${game.appid}/header.jpg`,
            icon: game.img_icon_url || "",
            // Steam 游戏没有预定义的 skill_configs，在后端动态生成
          }));

          setGames(convertedGames);
          setHasNextPage(end < steamGames.length);
          steamGamesCache.current.set(page, convertedGames);
        } else {
          // 使用默认游戏库（全量加载后前端分页）
          if (page === 0 || !gamesCache.current.has(0)) {
            const allGames = await getGames();
            const start = page * pageSize;
            const end = Math.min(start + pageSize, allGames.length);
            const pageGames = allGames.slice(start, end);
            
            setGames(pageGames);
            setTotalGames(allGames.length);
            setHasNextPage(end < allGames.length);
            
            // 缓存全部游戏（分页）
            for (let i = 0; i < Math.ceil(allGames.length / pageSize); i++) {
              const s = i * pageSize;
              const e = Math.min(s + pageSize, allGames.length);
              gamesCache.current.set(i, allGames.slice(s, e));
            }
          } else {
            const cachedGames = gamesCache.current.get(page)!;
            setGames(cachedGames);
          }
        }
      } catch (error) {
        console.error("加载游戏列表失败:", error);
        message.error("加载游戏列表失败");
      } finally {
        setLoading(false);
      }
    },
    [useSteamLibrary, steamGames, pageSize]
  );

  // 初始加载第一页
  useEffect(() => {
    loadGamesPage(0);
  }, [loadGamesPage]);

  // 页码变化时加载对应页
  const handlePageChange = (page: number) => {
    setCurrentPage(page - 1); // Ant Design Pagination 从 1 开始
    loadGamesPage(page - 1);
  };

  // 当选择游戏时加载其技能配置
  useEffect(() => {
    const loadSkillConfigs = async () => {
      if (!selectedGame) {
        setSkillConfigs([]);
        return;
      }
      try {
        const configs = await getSkillConfigsByGameId(selectedGame.id);
        setSkillConfigs(configs);
      } catch (error) {
        console.error("加载技能配置失败:", error);
        message.error("加载技能配置失败");
      }
    };
    loadSkillConfigs();
  }, [selectedGame]);

  // 手动同步已下载的技能库
  const handleSyncLibraries = async () => {
    try {
      setSyncing(true);
      message.loading({ content: "正在检测已下载的技能库...", key: "sync" });

      const { invoke } = await import("@tauri-apps/api/core");
      const updatedGameIds = await invoke<string[]>("sync_libraries_to_config");

      setSelectedGameIds(updatedGameIds);

      if (updatedGameIds.length > selectedGameIds.length) {
        const newCount = updatedGameIds.length - selectedGameIds.length;
        message.success({
          content: `检测完成！发现 ${newCount} 个新游戏已添加到配置`,
          key: "sync",
        });
      } else {
        message.success({ content: "检测完成，配置已是最新", key: "sync" });
      }
    } catch (error) {
      console.error("同步失败:", error);
      message.error({ content: `同步失败: ${error}`, key: "sync" });
    } finally {
      setSyncing(false);
    }
  };

  // 切换游戏源（Steam / 默认库）
  const handleToggleGameSource = (checked: boolean) => {
    setUseSteamLibrary(checked);
    setCurrentPage(0);
    gamesCache.current.clear();
    steamGamesCache.current.clear();
    loadGamesPage(0);
  };

  const handleAddGame = async (game: Game) => {
    setSelectedGame(game);
    
    // 如果是 Steam 游戏,动态获取 wiki 配置
    if (game.id.startsWith('steam_')) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const appid = parseInt(game.id.replace('steam_', ''));
        
        // 从后端获取 SkillConfig
        const backendConfigs = await invoke<Array<{
          id: string;
          name: string;
          description: string;
          repo: string;
          version: string;
          source_type: string;
          max_pages?: number;
          max_depth?: number;
          request_delay_ms?: number;
        }>>('get_steam_game_wiki_configs', { 
          appid, 
          gameName: game.name 
        });
        
        // 转换为 GameSkillConfig 格式
        const convertedConfigs: GameSkillConfig[] = backendConfigs.map(skill => ({
          id: skill.id,
          gameId: game.id,
          repo: skill.repo,
          name: skill.name,
          description: skill.description,
          version: skill.version,
          source: skill.source_type as any,
          status: SkillStatus.NotDownloaded,
          statistics: {
            totalEntries: 0,
            vectorCount: 0,
            storageSize: 0,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));
        
        setSkillConfigs(convertedConfigs);
      } catch (error) {
        console.error('获取 Steam 游戏 Wiki 配置失败:', error);
        message.error('获取游戏 Wiki 配置失败');
        return;
      }
    }
    // 默认游戏使用现有的配置加载逻辑(在 useEffect 中已加载)
    
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
      const storagePath = `${storageBasePath}\\${selectedGame.id}\\${timestamp}`;

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

      // 注意: 下载的库信息现在存储在后端,不再使用前端 store

      // 保存到后端配置
      const { invoke: invoke2 } = await import("@tauri-apps/api/core");
      const settings = await invoke2<any>("get_app_settings");
      if (!settings.user.selected_games.includes(selectedGame.id)) {
        settings.user.selected_games.push(selectedGame.id);
        await invoke2("save_app_settings", { settings });
        setSelectedGameIds([...selectedGameIds, selectedGame.id]);
      }

      addSelectedGame(selectedGame.id); // 同步到 userStore (向后兼容)

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

  const handleRemoveGame = async (gameId: string) => {
    Modal.confirm({
      title: "确认移除",
      content: "确定要从游戏库中移除这个游戏吗？",
      okText: "确认",
      cancelText: "取消",
      onOk: async () => {
        try {
          const { invoke } = await import("@tauri-apps/api/core");
          const settings = await invoke<any>("get_app_settings");
          settings.user.selected_games = settings.user.selected_games.filter(
            (id: string) => id !== gameId,
          );
          await invoke("save_app_settings", { settings });
          setSelectedGameIds(settings.user.selected_games);
          removeSelectedGame(gameId); // 同步到 userStore
          message.success("已移除游戏");
        } catch (error) {
          console.error("移除游戏失败:", error);
          message.error("移除游戏失败");
        }
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
          <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
            <Title level={3}>游戏库</Title>
            <Paragraph type="secondary" style={{margin: 0}}>
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
        <Card
          styles={{
            root: {
              margin: "16px 0",
            },
            body: {
              display: "flex",
              gap: "16px",
              alignItems: "center",
              justifyContent: "space-between",
            }
          }}
        >
          <Space size="middle" style={{ flex: 1 }}>
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
            {steamUser && (
              <Space>
                <Text type="secondary">使用 Steam 游戏库</Text>
                <Switch
                  checked={useSteamLibrary}
                  onChange={handleToggleGameSource}
                  checkedChildren="Steam"
                  unCheckedChildren="默认"
                />
              </Space>
            )}
          </Space>
          <Tooltip title="检测已下载的技能库并同步到配置">
            <Button
              icon={<RefreshCw size={18} />}
              onClick={handleSyncLibraries}
              loading={syncing}
            >
              检测同步
            </Button>
          </Tooltip>
        </Card>

        {/* 游戏卡片列表 */}
        {loading ? (
          <Card loading>
            <Empty description="正在加载游戏列表..." />
          </Card>
        ) : (
          <>
            <Flex wrap="wrap" gap={16} align="flex-start" justify="space-between">
              {games.map((game, index) => {
                const isAdded = selectedGameIds.includes(game.id);

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
                              技能库可用
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
            
            {/* 分页组件 - 简单模式 */}
            {totalGames > pageSize && (
              <div style={{ marginTop: 24, textAlign: "center" }}>
                <Pagination
                  simple
                  current={currentPage + 1}
                  total={totalGames}
                  pageSize={pageSize}
                  onChange={handlePageChange}
                  showSizeChanger={false}
                />
              </div>
            )}
          </>
        )}
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
                    下载完成后将自动保存到: {storageBasePath}
                  </Text>
                </Space>
              </div>
            ) : (
              <Space
                direction="vertical"
                size="middle"
                style={{ width: "100%" }}
              >
                {skillConfigs.map((config) => {
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
