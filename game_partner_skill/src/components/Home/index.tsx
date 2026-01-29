import {
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  Space,
  Button,
  Tag,
  Avatar,
  List,
} from "antd";
import { Activity, Zap, Clock, Gamepad2, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useUserStore } from "../../stores/userStore";
import { getGameById } from "../../data/games";
import "./styles.scss";

const { Title, Paragraph, Text } = Typography;

interface HomeProps {
  onNavigate?: (menu: string) => void;
}

const Home: React.FC<HomeProps> = ({ onNavigate }) => {
  const { user } = useUserStore();
  const selectedGames =
    user?.config.selectedGames.map((id) => getGameById(id)).filter(Boolean) ||
    [];
  const valueStyle: React.CSSProperties = {
    fontSize: 18,
    fontWeight: "bold",
    height: "36px",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: "4px",
  };
  const prefixStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    <div className="home-page">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="welcome-section">
          <Title level={2}>欢迎回来, {user?.profile.username}!</Title>
          <Paragraph type="secondary">
            智能游戏伴侣,让每一次游戏都不再孤单
          </Paragraph>
          {user?.profile.isPremium && (
            <Tag color="gold" style={{ marginTop: 8 }}>
              Premium 用户
            </Tag>
          )}
        </div>

        <Row gutter={[8, 8]} style={{ marginTop: 32 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="已配置游戏"
                value={selectedGames.length}
                prefix={<Gamepad2 size={20} />}
                styles={{
                  content: { color: "#3f8600", ...valueStyle },
                  prefix: prefixStyle,
                }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="识别次数"
                value={0}
                prefix={<Activity size={20} />}
                styles={{
                  content: { color: "#1890ff", ...valueStyle },
                  prefix: prefixStyle,
                }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="提示生成"
                value={0}
                prefix={<Zap size={20} />}
                styles={{
                  content: { color: "#722ed1", ...valueStyle },
                  prefix: prefixStyle,
                }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="运行时长"
                value="0h 0m"
                prefix={<Clock size={20} />}
                styles={{
                  content: { color: "#fff", ...valueStyle },
                  prefix: prefixStyle,
                }}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col span={24}>
            <Card
              title="我的游戏"
              extra={
                <Button
                  type="link"
                  icon={<ArrowRight size={16} />}
                  onClick={() => onNavigate?.("game-library")}
                >
                  管理游戏
                </Button>
              }
            >
              {selectedGames.length > 0 ? (
                <List
                  dataSource={selectedGames}
                  renderItem={(game) => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={
                          <Avatar
                            size={48}
                            style={{
                              background:
                                "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                            }}
                          >
                            {game!.name[0]}
                          </Avatar>
                        }
                        title={game!.name}
                        description={
                          <Space>
                            <Tag>{game!.category}</Tag>
                            {game!.tags.slice(0, 2).map((tag) => (
                              <Tag key={tag} color="blue">
                                {tag}
                              </Tag>
                            ))}
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                  <Gamepad2
                    size={48}
                    style={{ color: "rgba(255,255,255,0.2)", marginBottom: 16 }}
                  />
                  <Paragraph type="secondary">还没有添加游戏</Paragraph>
                  <Button
                    type="primary"
                    onClick={() => onNavigate?.("game-library")}
                  >
                    前往游戏库
                  </Button>
                </div>
              )}
            </Card>
          </Col>

          <Col span={12} style={{ marginTop: 16 }}>
            <Card title="快速开始">
              <Space
                direction="vertical"
                size="middle"
                style={{ width: "100%" }}
              >
                <Button
                  block
                  size="large"
                  type="primary"
                  icon={<Gamepad2 size={18} />}
                  onClick={() => onNavigate?.("game-library")}
                >
                  添加游戏
                </Button>
                <Button
                  block
                  size="large"
                  icon={<Activity size={18} />}
                  onClick={() => onNavigate?.("screen-capture")}
                  disabled={selectedGames.length === 0}
                >
                  开始识别
                </Button>
                <Button
                  block
                  size="large"
                  icon={<Zap size={18} />}
                  onClick={() => onNavigate?.("skill-database")}
                >
                  管理技能库
                </Button>
              </Space>
            </Card>
          </Col>
          <Col span={12} style={{ marginTop: 16 }}>
            <Card title="游戏分类">
              <Space
                direction="vertical"
                size="small"
                style={{ width: "100%" }}
              >
                {user?.config.gameCategories.map((cat) => (
                  <div
                    key={cat.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      background: "rgba(255,255,255,0.02)",
                      borderRadius: 6,
                    }}
                  >
                    <Text>{cat.name}</Text>
                    <Tag color={cat.color}>{cat.gameIds.length}</Tag>
                  </div>
                ))}
              </Space>
            </Card>
          </Col>
        </Row>
      </motion.div>
    </div>
  );
};

export default Home;
