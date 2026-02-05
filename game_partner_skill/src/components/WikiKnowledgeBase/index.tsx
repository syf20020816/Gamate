import React, { useState, useEffect } from "react";
import {
  Card,
  Button,
  message,
  Space,
  Typography,
  Alert,
  Progress,
  Select,
} from "antd";
import { invoke } from "@tauri-apps/api/core";
import "./index.css";
import WikiSearch from "../WikiSearch";

const { Text } = Typography;

interface Game {
  id: string;
  name: string;
  description?: string;
}

const WikiKnowledgeBase: React.FC = () => {
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<string>("");
  const [hasData, setHasData] = useState(false);
  const [availableGames, setAvailableGames] = useState<Game[]>([]);
  const [gamesWithSkills, setGamesWithSkills] = useState<string[]>([]); // 已下载技能库的游戏ID列表
  const [loading, setLoading] = useState(true);
  const [vectorDbMode, setVectorDbMode] = useState<string>("local"); // 向量数据库模式

  // 加载游戏配置和已导入状态
  useEffect(() => {
    loadVectorDbMode();
    loadGamesConfig();
    loadDownloadedLibraries(); // ✅ 从后端扫描
  }, []);

  // ✅ 从后端扫描已下载的技能库
  const loadDownloadedLibraries = async () => {
    try {
      const libraries = await invoke<any[]>('scan_downloaded_libraries');
      const gameIds = [...new Set(libraries.map((lib: any) => lib.gameId))];
      setGamesWithSkills(gameIds);
      
      // 如果还没选择游戏,自动选择第一个有技能库的游戏
      if (!selectedGame && gameIds.length > 0) {
        setSelectedGame(gameIds[0]);
      }
    } catch (error) {
      console.error('扫描技能库失败:', error);
    }
  };

  // 当选择游戏时检查是否已导入
  useEffect(() => {
    if (selectedGame) {
      checkGameImportStatus(selectedGame);
    }
  }, [selectedGame, vectorDbMode]);

  const loadVectorDbMode = async () => {
    try {
      const settings = await invoke<any>("get_app_settings");
      const mode = settings?.ai_models?.vector_db?.mode || "local";
      setVectorDbMode(mode);
    } catch (error) {
      console.error("加载向量数据库模式失败:", error);
    }
  };

  const loadGamesConfig = async () => {
    try {
      const config = await invoke<{ games: Game[] }>("get_games_config");
      setAvailableGames(config.games);
    } catch (error) {
      console.error("加载游戏配置失败:", error);
      message.error("加载游戏列表失败");
    } finally {
      setLoading(false);
    }
  };

  const checkGameImportStatus = async (gameId: string) => {
    try {
      const exists = await invoke<boolean>("check_game_vector_db", { gameId });
      setHasData(exists);
    } catch (error) {
      console.error("检查导入状态失败:", error);
      setHasData(false);
    }
  };

  // 自动导入最新的 Wiki 数据
  const handleImport = async () => {
    if (!selectedGame) {
      message.warning("请先选择游戏");
      return;
    }

    try {
      setImporting(true);
      setImportProgress(0);
      setImportResult(null);

      // 模拟进度更新
      const progressInterval = setInterval(() => {
        setImportProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 500);

      // 调用自动导入命令
      const result = await invoke<string>("auto_import_latest_wiki", {
        gameId: selectedGame,
      });

      clearInterval(progressInterval);
      setImportProgress(100);
      setImportResult(result);
      setHasData(true);
      message.success("导入成功!");
    } catch (error: any) {
      message.error(`导入失败: ${error}`);
      console.error("导入错误:", error);
      setImportResult(null);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="wiki-knowledge-container">
      {/* 游戏选择器 */}
      <Card className="game-selector-section" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <div>
            <Text strong style={{ marginRight: 8 }}>
              选择游戏:
            </Text>
            <Text type="secondary" style={{ fontSize: "12px" }}>
              (仅显示已下载技能库的游戏)
            </Text>
          </div>

          <Select
            value={selectedGame}
            onChange={setSelectedGame}
            style={{ width: "100%" }}
            placeholder="请选择游戏"
            loading={loading}
          >
            {availableGames
              .filter((game) => gamesWithSkills.includes(game.id))
              .map((game) => (
                <Select.Option key={game.id} value={game.id}>
                  {game.name}
                  {/* {importedGames.includes(game.id) && " ✅"} */}
                </Select.Option>
              ))}
          </Select>

          {gamesWithSkills.length === 0 && !loading && (
            <Alert
              message="暂无可用游戏"
              description='请先在"技能库"页面下载游戏 Wiki 数据'
              type="info"
              showIcon
            />
          )}

          {/* AI 直接模式 - 显示导入状态 */}
          {vectorDbMode === "ai_direct" && selectedGame && !hasData && (
            <>
              <Alert
                message="AI 直接检索模式 - 未导入"
                description="点击下方按钮,准备 JSONL 文件以供实时检索"
                type="warning"
                showIcon
              />
              <Button
                type="primary"
                size="large"
                block
                loading={importing}
                onClick={handleImport}
              >
                {importing ? "准备中..." : "准备数据"}
              </Button>
            </>
          )}

          {vectorDbMode === "ai_direct" && selectedGame && hasData && (
            <Alert
              message="AI 直接检索已就绪"
              description="JSONL 文件已准备好,可以直接搜索, AI 直接检索使用关键词匹配，搜索语言需要与 Wiki 数据语言一致。"
              type="success"
              showIcon
              action={
                <Button size="small" loading={importing} onClick={handleImport}>
                  重新准备
                </Button>
              }
            />
          )}

          {/* Local/Qdrant 模式需要先导入 */}
          {vectorDbMode !== "ai_direct" && selectedGame && !hasData && (
            <>
              <Alert
                message="该游戏还未导入向量数据库"
                description="点击下方按钮,自动导入最新下载的 Wiki 数据到向量数据库"
                type="warning"
                showIcon
              />
              <Button
                type="primary"
                size="large"
                block
                loading={importing}
                onClick={handleImport}
              >
                {importing ? "导入中..." : "导入数据"}
              </Button>
            </>
          )}

          {vectorDbMode !== "ai_direct" && selectedGame && hasData && (
            <Alert
              message="向量数据库已就绪"
              description="可以开始搜索,或重新导入以更新数据"
              type="success"
              showIcon
              action={
                <Button size="small" loading={importing} onClick={handleImport}>
                  重新导入
                </Button>
              }
            />
          )}

          {importing && (
            <div style={{ marginTop: 8 }}>
              <Progress percent={importProgress} status="active" />
              <Text type="secondary" style={{ fontSize: "12px" }}>
                正在生成向量并导入数据库...
              </Text>
            </div>
          )}

          {importResult && (
            <Alert
              message="导入完成"
              description={importResult}
              type="success"
              showIcon
              closable
              onClose={() => setImportResult(null)}
            />
          )}
        </Space>
      </Card>

      {/* 搜索界面 */}
      {hasData && selectedGame && <WikiSearch gameId={selectedGame} />}
    </div>
  );
};

export default WikiKnowledgeBase;
