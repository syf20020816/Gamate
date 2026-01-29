import { Layout, Card, Typography, Tag, Progress, Button, Space, Divider, Badge, Avatar } from "antd";
import { Gamepad2, Database, Zap, TrendingUp, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useUserStore } from "../../stores/userStore";
import { getGameById } from "../../data/games";
import "./styles.scss";

const { Sider } = Layout;
const { Title, Text, Paragraph } = Typography;

const RightPanel: React.FC = () => {
  const { user } = useUserStore();
  const selectedGames = user?.config.selectedGames.map(id => getGameById(id)).filter(Boolean) || [];

  // 模拟数据
  const gameCategories = user?.config.gameCategories || [];

  const systemStats = {
    totalGames: selectedGames.length,
    activeSkills: selectedGames.length * 50, // 模拟：每个游戏平均50个技能
    recognitionRate: 89,
    uptime: "0h 0m",
  };

  const recentActivities = selectedGames.slice(0, 3).map((game, index) => ({
    game: game!.name,
    action: index === 0 ? "已添加到游戏库" : "技能库就绪",
    time: `${index + 1}分钟前`,
    status: "success" as "success" | "error",
  }));

  return (
    <Sider width={380} className="right-panel" theme="dark">
      <div className="panel-content">
        {/* 系统状态 */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="status-card" size="small">
            <Title level={5}>
              <Zap size={20} style={{ marginRight: 8 }} />
              系统状态
            </Title>
            <Space direction="vertical" size="middle" style={{ width: "100%" }}>
              <div className="stat-item">
                <Space style={{ width: "100%", justifyContent: "space-between" }}>
                  <Text type="secondary">已配置游戏</Text>
                  <Text strong>{systemStats.totalGames}</Text>
                </Space>
              </div>
              <div className="stat-item">
                <Space style={{ width: "100%", justifyContent: "space-between" }}>
                  <Text type="secondary">活跃技能数</Text>
                  <Text strong>{systemStats.activeSkills}</Text>
                </Space>
              </div>
              <div className="stat-item">
                <Space style={{ width: "100%", justifyContent: "space-between" }}>
                  <Text type="secondary">识别准确率</Text>
                  <Text strong>{systemStats.recognitionRate}%</Text>
                </Space>
                <Progress
                  percent={systemStats.recognitionRate}
                  size="small"
                  strokeColor="#52c41a"
                  showInfo={false}
                />
              </div>
              <div className="stat-item">
                <Space style={{ width: "100%", justifyContent: "space-between" }}>
                  <Text type="secondary">运行时长</Text>
                  <Text strong>{systemStats.uptime}</Text>
                </Space>
              </div>
            </Space>
          </Card>
        </motion.div>

        <Divider style={{ margin: "16px 0" }} />

        {/* 游戏分类 */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card className="category-card" size="small">
            <Title level={5}>
              <Gamepad2 size={20} style={{ marginRight: 8 }} />
              游戏分类
            </Title>
            <Paragraph type="secondary" style={{ fontSize: 12 }}>
              配置你的游戏类型,系统将自动加载对应技能库
            </Paragraph>
            <Space direction="vertical" size="small" style={{ width: "100%" }}>
              {gameCategories.map((category, index) => (
                <motion.div
                  key={category.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="category-item"
                >
                  <Space style={{ width: "100%", justifyContent: "space-between" }}>
                    <Space>
                      <Badge
                        status={category.gameIds.length > 0 ? "success" : "default"}
                        text={category.name}
                      />
                    </Space>
                    <Tag color={category.gameIds.length > 0 ? category.color : "default"}>
                      {category.gameIds.length} 个游戏
                    </Tag>
                  </Space>
                </motion.div>
              ))}
            </Space>
            <Button type="dashed" block style={{ marginTop: 12 }}>
              添加新分类
            </Button>
          </Card>
        </motion.div>

        <Divider style={{ margin: "16px 0" }} />

        {/* 最近活动 */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card className="activity-card" size="small">
            <Title level={5}>
              <TrendingUp size={20} style={{ marginRight: 8 }} />
              最近活动
            </Title>
            <Space direction="vertical" size="middle" style={{ width: "100%" }}>
              {recentActivities.length > 0 ? (
                recentActivities.map((activity, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="activity-item"
                  >
                    <Space direction="vertical" size={2} style={{ width: "100%" }}>
                      <Space style={{ width: "100%", justifyContent: "space-between" }}>
                        <Space>
                          <Avatar
                            size="small"
                            style={{
                              backgroundColor:
                                activity.status === "success" ? "#52c41a" : "#f5222d",
                            }}
                          >
                            {activity.game[0]}
                          </Avatar>
                          <Text strong style={{ fontSize: 13 }}>
                            {activity.game}
                          </Text>
                        </Space>
                        {activity.status === "error" && (
                          <AlertCircle size={16} color="#f5222d" />
                        )}
                      </Space>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {activity.action}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {activity.time}
                      </Text>
                    </Space>
                  </motion.div>
                ))
              ) : (
                <Text type="secondary" style={{ textAlign: 'center', display: 'block', padding: '20px 0' }}>
                  暂无活动记录
                </Text>
              )}
            </Space>
          </Card>
        </motion.div>

        <Divider style={{ margin: "16px 0" }} />

        {/* 技能库统计 */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <Card className="skill-card" size="small">
            <Title level={5}>
              <Database size={20} style={{ marginRight: 8 }} />
              技能库概况
            </Title>
            <Space direction="vertical" size="small" style={{ width: "100%" }}>
              <div className="skill-stat">
                <Text type="secondary">向量数据库</Text>
                <Progress
                  percent={67}
                  size="small"
                  format={() => "3.2 GB"}
                />
              </div>
              <div className="skill-stat">
                <Text type="secondary">Wiki 条目</Text>
                <Progress
                  percent={85}
                  size="small"
                  strokeColor="#1890ff"
                  format={() => "8,542"}
                />
              </div>
              <div className="skill-stat">
                <Text type="secondary">缓存命中率</Text>
                <Progress
                  percent={92}
                  size="small"
                  strokeColor="#722ed1"
                  format={() => "92%"}
                />
              </div>
            </Space>
            <Button type="primary" ghost block style={{ marginTop: 12 }}>
              管理技能库
            </Button>
          </Card>
        </motion.div>
      </div>
    </Sider>
  );
};

export default RightPanel;
