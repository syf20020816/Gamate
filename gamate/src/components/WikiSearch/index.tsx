import React, { useState } from "react";
import {
  Input,
  Card,
  Tag,
  Spin,
  Empty,
  Button,
  message,
  Space,
  Typography,
  Collapse,
} from "antd";
import { invoke } from "@tauri-apps/api/core";
import "./index.css";
import { DatabaseOutlined } from "@ant-design/icons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { convertWikiToMarkdown } from "../../utils/wikiFormatter";

const { Search } = Input;
const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;

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
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WikiSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<VectorDBStats | null>(null);
  const [vectorDbMode, setVectorDbMode] = useState<string>("local");

  // 加载向量数据库模式
  const loadVectorDbMode = async () => {
    try {
      const settings = await invoke<any>("get_app_settings");
      const mode = settings?.ai_models?.vector_db?.mode || "local";
      setVectorDbMode(mode);
    } catch (error) {
      console.error("加载向量数据库模式失败:", error);
    }
  };

  // 加载统计信息
  const loadStats = async () => {
    try {
      const data = await invoke<VectorDBStats>("get_vector_db_stats", {
        gameId,
      });
      setStats(data);
    } catch (error) {
      console.error("获取统计信息失败:", error);
    }
  };

  // 组件加载时获取统计信息和模式
  React.useEffect(() => {
    loadVectorDbMode();
    loadStats();
  }, [gameId]);

  // 搜索函数
  const handleSearch = async (value: string) => {
    if (!value.trim()) {
      message.warning("请输入搜索内容");
      return;
    }

    setLoading(true);
    setQuery(value);

    try {
      const searchResults = await invoke<WikiSearchResult[]>("search_wiki", {
        query: value,
        gameId,
        topK: 3, // 只获取前 3 个结果
      });

      // 调试: 检查转换效果
      if (searchResults.length > 0) {
        console.log(
          "原始 Wiki 内容 (前100字符):",
          searchResults[0].content.substring(0, 100),
        );
        console.log(
          "转换后 Markdown (前100字符):",
          convertWikiToMarkdown(searchResults[0].content).substring(0, 100),
        );
      }

      setResults(searchResults);

      if (searchResults.length === 0) {
        message.info("未找到相关结果");
      } else {
        message.success(`找到 ${searchResults.length} 条相关结果`);
      }
    } catch (error: any) {
      message.error(`搜索失败: ${error}`);
      console.error("搜索错误:", error);
    } finally {
      setLoading(false);
    }
  };

  // 根据相关度分数返回颜色
  const getScoreColor = (score: number): string => {
    if (score >= 0.8) return "#52c41a"; // 绿色 - 高度相关
    if (score >= 0.6) return "#1890ff"; // 蓝色 - 中度相关
    if (score >= 0.4) return "#faad14"; // 橙色 - 低度相关
    return "#d9d9d9"; // 灰色 - 弱相关
  };

  return (
    <div className="wiki-search-container">
      {/* 统计信息 */}
      {vectorDbMode === "ai_direct" ? (
        <>
          <Card size="small" style={{ marginBottom: 16 }}>
            <Space>
              <Text>
                <DatabaseOutlined
                  style={{ margin: "0 8px" }}
                ></DatabaseOutlined>
                检索模式:
              </Text>
              <Tag color="blue">AI 直接检索</Tag>
              <Text type="secondary">实时从 JSONL 文件读取</Text>
            </Space>
          </Card>
        </>
      ) : (
        stats && (
          <Card size="small" style={{ marginBottom: 16 }}>
            <Space>
              <Text>
                <DatabaseOutlined
                  style={{ margin: "0 8px" }}
                ></DatabaseOutlined>
                数据库状态:
              </Text>
              <Tag color="green">已加载</Tag>
              <Text type="secondary">共 {stats.pointsCount} 条数据</Text>
            </Space>
          </Card>
        )
      )}

      {/* 搜索栏 */}
      <Card className="search-card">
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <div>
            <Title level={3}>智能搜索</Title>
            <Paragraph type="secondary">
              {vectorDbMode === "ai_direct"
                ? "AI 直接检索使用关键词匹配，请使用与 Wiki 数据相同的语言进行搜索"
                : "输入问题或关键词，AI 会自动匹配最相关的 Wiki 内容"}
            </Paragraph>
          </div>

          <Search
            placeholder={
              vectorDbMode === "ai_direct"
                ? "使用英文关键词搜索，例如: banshee characteristics"
                : "例如: 女妖的特征是什么？"
            }
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
            <Space direction="vertical" size="large" style={{ width: "100%" }}>
              {/* 第一个结果 - 完整显示 Markdown */}
              {results[0] && (
                <Card
                  className="result-item-main"
                  style={{
                    borderLeft: `4px solid ${getScoreColor(results[0].score)}`,
                  }}
                >
                  <Space
                    direction="vertical"
                    style={{ width: "100%" }}
                    size="middle"
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Title level={4} style={{ margin: 0 }}>
                        {results[0].title}
                      </Title>
                      <Tag
                        color={getScoreColor(results[0].score)}
                        style={{ fontWeight: "bold", fontSize: "14px" }}
                      >
                        相关度: {(results[0].score * 100).toFixed(1)}%
                      </Tag>
                    </div>

                    {/* Markdown 渲染内容 */}
                    <div
                      className="markdown-content"
                      style={{
                        padding: "8px",
                        color: "#fff",
                      }}
                    >
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {convertWikiToMarkdown(results[0].content)}
                      </ReactMarkdown>
                    </div>
                  </Space>
                </Card>
              )}

              {/* 其他结果 - 折叠显示 */}
              {results.length > 1 && (
                <div>
                  <Text
                    type="secondary"
                    style={{ marginBottom: 8, display: "block" }}
                  >
                    其他相关结果:
                  </Text>
                  <Space
                    direction="vertical"
                    style={{ width: "100%" }}
                    size="small"
                  >
                    {results.slice(1).map((item, index) => (
                      <Collapse
                        key={item.id}
                        ghost
                        expandIconPosition="end"
                        style={{
                          borderLeft: `4px solid ${getScoreColor(item.score)}`,
                          borderRadius: "4px",
                        }}
                      >
                        <Panel
                          header={
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                paddingRight: "16px",
                              }}
                            >
                              <Text strong>
                                {index + 2}. {item.title}
                              </Text>
                              <Space>
                                <Tag color={getScoreColor(item.score)}>
                                  {(item.score * 100).toFixed(1)}%
                                </Tag>
                                <Button
                                  type="link"
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(item.url, "_blank");
                                  }}
                                >
                                  查看原文
                                </Button>
                              </Space>
                            </div>
                          }
                          key="content"
                        >
                          <div
                            className="markdown-content"
                            style={{
                              padding: "16px",
                              background: "#fafafa",
                              borderRadius: "8px",
                              maxHeight: "400px",
                              overflowY: "auto",
                            }}
                          >
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {convertWikiToMarkdown(item.content)}
                            </ReactMarkdown>
                          </div>
                        </Panel>
                      </Collapse>
                    ))}
                  </Space>
                </div>
              )}
            </Space>
          ) : !loading && query ? (
            <Empty description="未找到相关结果" style={{ marginTop: 32 }}>
              <Text type="secondary">尝试换个关键词或使用不同的描述方式</Text>
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
