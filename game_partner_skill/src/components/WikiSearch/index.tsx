import React, { useState } from 'react';
import { Input, Card, List, Tag, Spin, Empty, Button, message, Space, Typography } from 'antd';
import { invoke } from '@tauri-apps/api/core';
import './index.css';

const { Search } = Input;
const { Title, Text, Paragraph } = Typography;

interface WikiSearchResult {
  score: number;
  id: string;
  title: string;
  content: string;
  url: string;
  categories: string[];
}

interface VectorDBStats {
  exists: boolean;
  vectorsCount: number;
  pointsCount: number;
  gameId: string;
}

interface WikiSearchProps {
  gameId: string;
}

const WikiSearch: React.FC<WikiSearchProps> = ({ gameId }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WikiSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<VectorDBStats | null>(null);

  // 加载统计信息
  const loadStats = async () => {
    try {
      const data = await invoke<VectorDBStats>('get_vector_db_stats', {
        gameId
      });
      setStats(data);
    } catch (error) {
      console.error('获取统计信息失败:', error);
    }
  };

  // 组件加载时获取统计信息
  React.useEffect(() => {
    loadStats();
  }, [gameId]);

  // 搜索函数
  const handleSearch = async (value: string) => {
    if (!value.trim()) {
      message.warning('请输入搜索内容');
      return;
    }

    setLoading(true);
    setQuery(value);

    try {
      const searchResults = await invoke<WikiSearchResult[]>('search_wiki', {
        query: value,
        gameId,
        topK: 10
      });

      setResults(searchResults);
      
      if (searchResults.length === 0) {
        message.info('未找到相关结果');
      } else {
        message.success(`找到 ${searchResults.length} 条相关结果`);
      }
    } catch (error: any) {
      message.error(`搜索失败: ${error}`);
      console.error('搜索错误:', error);
    } finally {
      setLoading(false);
    }
  };

  // 根据相关度分数返回颜色
  const getScoreColor = (score: number): string => {
    if (score >= 0.8) return '#52c41a'; // 绿色 - 高度相关
    if (score >= 0.6) return '#1890ff'; // 蓝色 - 中度相关
    if (score >= 0.4) return '#faad14'; // 橙色 - 低度相关
    return '#d9d9d9'; // 灰色 - 弱相关
  };

  return (
    <div className="wiki-search-container">
      {/* 统计信息 */}
      {stats && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Space>
            <Text>📊 数据库状态:</Text>
            <Tag color="green">已加载</Tag>
            <Text type="secondary">共 {stats.pointsCount} 条数据</Text>
          </Space>
        </Card>
      )}

      {/* 搜索栏 */}
      <Card className="search-card">
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Title level={3}>智能搜索</Title>
            <Paragraph type="secondary">
              输入问题或关键词，AI 会自动匹配最相关的 Wiki 内容
            </Paragraph>
          </div>

          <Search
            placeholder="例如: 女妖的特征是什么？"
            enterButton="搜索"
            size="large"
            loading={loading}
            onSearch={handleSearch}
            allowClear
          />

          {query && (
            <Text type="secondary">
              搜索词: <Text strong>{query}</Text>
            </Text>
          )}
        </Space>
      </Card>

      {/* 搜索结果 */}
      <div className="search-results" style={{ marginTop: 16 }}>
        <Spin spinning={loading}>
          {results.length > 0 ? (
            <List
              dataSource={results}
              renderItem={(item, index) => (
                <Card
                  key={item.id}
                  className="result-item"
                  style={{
                    marginBottom: 16,
                    borderLeft: `4px solid ${getScoreColor(item.score)}`
                  }}
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Title level={5} style={{ margin: 0 }}>
                        {index + 1}. {item.title}
                      </Title>
                      <Space>
                        <Tag
                          color={getScoreColor(item.score)}
                          style={{ fontWeight: 'bold' }}
                        >
                          相关度: {(item.score * 100).toFixed(1)}%
                        </Tag>
                        {item.categories.map(cat => (
                          <Tag key={cat}>{cat}</Tag>
                        ))}
                      </Space>
                    </div>

                    <Paragraph ellipsis={{ rows: 3, expandable: true, symbol: '展开' }}>
                      {item.content}
                    </Paragraph>

                    <Button
                      type="link"
                      size="small"
                      onClick={() => window.open(item.url, '_blank')}
                    >
                      查看原文 →
                    </Button>
                  </Space>
                </Card>
              )}
            />
          ) : !loading && query ? (
            <Empty
              description="未找到相关结果"
              style={{ marginTop: 32 }}
            >
              <Text type="secondary">
                尝试换个关键词或使用不同的描述方式
              </Text>
            </Empty>
          ) : null}
        </Spin>
      </div>

      {/* 使用提示
      {!query && !loading && (
        <Card style={{ marginTop: 16, background: '#fafafa' }}>
          <Title level={5}>💡 搜索技巧</Title>
          <ul>
            <li>支持自然语言提问，例如: "怎样识别女妖？"</li>
            <li>可以使用关键词搜索，例如: "女妖 特征"</li>
            <li>结果按相关度排序，颜色越深表示越相关</li>
            <li>点击"查看原文"可以访问完整 Wiki 页面</li>
          </ul>
        </Card>
      )} */}
    </div>
  );
};

export default WikiSearch;
