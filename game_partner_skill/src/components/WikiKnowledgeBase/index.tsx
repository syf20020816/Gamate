import React, { useState, useEffect } from 'react';
import { Card, Button, message, Space, Typography, Divider, Alert, Progress, Select } from 'antd';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import './index.css';
import WikiSearch from '../WikiSearch';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

interface Game {
  id: string;
  name: string;
  description?: string;
}

const WikiKnowledgeBase: React.FC = () => {
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<string>('');
  const [hasData, setHasData] = useState(false);
  const [availableGames, setAvailableGames] = useState<Game[]>([]);
  const [importedGames, setImportedGames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // 加载游戏配置和已导入状态
  useEffect(() => {
    loadGamesConfig();
    loadImportedGames();
  }, []);

  // 当选择游戏时检查是否已导入
  useEffect(() => {
    if (selectedGame) {
      checkGameImportStatus(selectedGame);
    }
  }, [selectedGame]);

  const loadGamesConfig = async () => {
    try {
      const config = await invoke<{ games: Game[] }>('get_games_config');
      setAvailableGames(config.games);
      // 默认选择第一个游戏
      if (config.games.length > 0) {
        setSelectedGame(config.games[0].id);
      }
    } catch (error) {
      console.error('加载游戏配置失败:', error);
      message.error('加载游戏列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadImportedGames = async () => {
    try {
      const games = await invoke<string[]>('list_imported_games');
      setImportedGames(games);
    } catch (error) {
      console.error('获取已导入游戏失败:', error);
    }
  };

  const checkGameImportStatus = async (gameId: string) => {
    try {
      const exists = await invoke<boolean>('check_game_vector_db', { gameId });
      setHasData(exists);
    } catch (error) {
      console.error('检查导入状态失败:', error);
      setHasData(false);
    }
  };

  // 选择并导入文件
  const handleImport = async () => {
    if (!selectedGame) {
      message.warning('请先选择游戏');
      return;
    }

    try {
      // 打开文件选择对话框
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'JSONL',
          extensions: ['jsonl']
        }]
      });

      if (!selected) {
        return;
      }

      const filePath = typeof selected === 'string' ? selected : selected[0];
      
      setImporting(true);
      setImportProgress(0);
      setImportResult(null);

      // 模拟进度更新
      const progressInterval = setInterval(() => {
        setImportProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 500);

      // 调用后端导入命令
      const result = await invoke<string>('import_wiki_to_vector_db', {
        jsonlPath: filePath,
        gameId: selectedGame
      });

      clearInterval(progressInterval);
      setImportProgress(100);
      setImportResult(result);
      setHasData(true);
      // 刷新已导入游戏列表
      await loadImportedGames();
      message.success('导入成功!');
    } catch (error: any) {
      message.error(`导入失败: ${error}`);
      console.error('导入错误:', error);
      setImportResult(null);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="wiki-knowledge-container">
      {/* 游戏选择器 */}
      <Card className="game-selector-section" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text strong>选择游戏:</Text>
          <Select
            value={selectedGame}
            onChange={setSelectedGame}
            style={{ width: '100%' }}
            placeholder="请选择游戏"
            loading={loading}
          >
            {availableGames.map(game => (
              <Select.Option key={game.id} value={game.id}>
                {game.name}
                {importedGames.includes(game.id) && ' ✓ (已导入)'}
              </Select.Option>
            ))}
          </Select>
          {selectedGame && !hasData && (
            <Alert
              message="该游戏还未导入 Wiki 数据"
              description="请点击下方导入按钮,选择对应的 JSONL 文件"
              type="warning"
              showIcon
            />
          )}
          {selectedGame && hasData && (
            <Alert
              message="该游戏已导入 Wiki 数据"
              description="可以直接开始搜索,或重新导入以更新数据"
              type="success"
              showIcon
            />
          )}
        </Space>
      </Card>

      {/* 导入区域 */}
      {!hasData && selectedGame && (
        <Card className="import-section">
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <Title level={3}>📦 导入 Wiki 知识库</Title>
              <Paragraph type="secondary">
                为 {availableGames.find(g => g.id === selectedGame)?.name} 导入 Wiki 数据。
                请选择爬虫生成的 JSONL 文件。
              </Paragraph>
            </div>

            <Alert
              message="准备工作"
              description={
                <div>
                  <p>1. 确保 Qdrant 服务已启动 (默认端口: 6333)</p>
                  <p>2. 确保 Ollama 服务已启动 (默认端口: 11434)</p>
                  <p>3. 准备好对应游戏的 wiki_raw.jsonl 文件</p>
                </div>
              }
              type="info"
              showIcon
            />

            <div>
              <Button
                type="primary"
                size="large"
                loading={importing}
                onClick={handleImport}
              >
                {importing ? '正在导入...' : '选择 JSONL 文件并导入'}
              </Button>

              {importing && (
                <div style={{ marginTop: 16 }}>
                  <Progress percent={importProgress} status="active" />
                  <Text type="secondary">正在生成向量并导入数据库...</Text>
                </div>
              )}

              {importResult && (
                <Alert
                  message="导入完成"
                  description={importResult}
                  type="success"
                  showIcon
                  style={{ marginTop: 16 }}
                  action={
                    <Button size="small" onClick={() => setHasData(true)}>
                      开始使用
                    </Button>
                  }
                />
              )}
            </div>

            <Divider />

            <div>
              <Title level={4}>💡 使用说明</Title>
              <Paragraph>
                <ul>
                  <li>支持自然语言搜索，无需精确关键词匹配</li>
                  <li>使用 AI 向量相似度算法，智能匹配最相关内容</li>
                  <li>每次搜索返回 Top-10 最相关结果</li>
                  <li>支持查看原文链接和分类标签</li>
                </ul>
              </Paragraph>
            </div>
          </Space>
        </Card>
      )}

      {/* 搜索界面 */}
      {hasData && selectedGame && <WikiSearch gameId={selectedGame} />}
    </div>
  );
};

export default WikiKnowledgeBase;
