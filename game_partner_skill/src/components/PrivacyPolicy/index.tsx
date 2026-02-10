import { Card, Typography, Divider, Space, Alert } from "antd";
import { motion } from "framer-motion";
import "./styles.scss";

const { Title, Paragraph, Text } = Typography;

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="privacy-policy">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card>
          <div style={{ maxWidth: 800, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <Title level={2}>隐私政策</Title>
              <Text type="secondary">最后更新时间：2026年2月10日</Text>
            </div>

            <Alert
              message="核心承诺"
              description="Gamate 是一款完全本地化的应用程序，我们不会收集、存储或传输任何用户个人信息到远程服务器。您的所有数据都安全地存储在您的设备上。"
              type="info"
              showIcon
              style={{ marginBottom: 32 }}
            />

            <Space direction="vertical" size="large" style={{ width: "100%" }}>
              <section>
                <Title level={4}>
                  1. 数据收集说明
                </Title>
                <Paragraph>
                  <Text strong>我们不收集任何数据。</Text>
                </Paragraph>
                <Paragraph>
                  Gamate 是一款完全本地运行的桌面应用程序，基于 Tauri
                  框架开发。本软件：
                </Paragraph>
                <ul>
                  <li>不会向任何服务器发送用户个人信息</li>
                  <li>不会收集设备信息（如设备 ID、操作系统版本等）</li>
                  <li>不会追踪用户使用行为或使用统计</li>
                  <li>不会收集用户的游戏数据或对话记录</li>
                  <li>不包含任何形式的分析、追踪或广告代码</li>
                </ul>
              </section>

              <Divider />

              <section>
                <Title level={4}>
                  2. 本地数据存储
                </Title>
                <Paragraph>
                  本软件会在您的设备上存储以下数据，这些数据仅用于软件功能实现，不会离开您的设备：
                </Paragraph>

                <Title level={5}>2.1 配置文件</Title>
                <ul>
                  <li>
                    <Text code>config/config.toml</Text> -
                    应用程序设置（不包含敏感信息）
                  </li>
                  <li>
                    <Text code>config/games.toml</Text> - 游戏库配置
                  </li>
                  <li>
                    <Text code>config/prompts_*.toml</Text> - AI 人格配置文件
                  </li>
                </ul>

                <Title level={5}>2.2 用户数据</Title>
                <ul>
                  <li>选择的游戏列表</li>
                  <li>下载的技能库文件（游戏 Wiki 知识库）</li>
                  <li>AI 对话历史记录（仅本地存储）</li>
                  <li>用户偏好设置（如语音参数、界面主题等）</li>
                </ul>

                <Title level={5}>2.3 第三方 API 密钥</Title>
                <Paragraph>
                  如果您配置了第三方服务（如阿里云语音、OpenAI API），相应的 API
                  密钥将以加密形式存储在本地配置文件中。
                  <Text strong style={{ color: "#ff4d4f" }}>
                    {" "}
                    我们强烈建议您妥善保管配置文件，不要与他人共享。
                  </Text>
                </Paragraph>

                <Alert
                  type="warning"
                  message="数据位置"
                  description={
                    <div>
                      <Paragraph style={{ marginBottom: 8 }}>
                        所有数据存储在以下目录：
                      </Paragraph>
                      <Text code>
                        Windows:
                        C:\Users\[用户名]\AppData\Roaming\com.gamate.app\
                      </Text>
                      <br />
                      <Text code>
                        macOS: ~/Library/Application Support/com.gamate.app/
                      </Text>
                      <br />
                      <Text code>Linux: ~/.config/com.gamate.app/</Text>
                    </div>
                  }
                  style={{ marginTop: 16 }}
                />
              </section>

              <Divider />

              <section>
                <Title level={4}>
                  3. 第三方服务
                </Title>
                <Paragraph>
                  本软件可能需要您主动配置以下第三方服务，这些服务的隐私政策由服务提供商独立管理：
                </Paragraph>

                <Title level={5}>3.1 阿里云语音服务（可选）</Title>
                <Paragraph>
                  用于实时语音识别（ASR）和语音合成（TTS）功能。当您使用语音对话功能时，语音数据会被发送到阿里云服务器进行处理。
                </Paragraph>
                <Paragraph>
                  隐私政策：<Text code>https://www.aliyun.com/privacy</Text>
                </Paragraph>

                <Title level={5}>3.2 OpenAI API / 其他 LLM 服务（可选）</Title>
                <Paragraph>
                  用于生成 AI 对话内容和游戏指导。当您与 AI
                  助手对话时，对话文本和截图可能会被发送到您配置的 LLM
                  服务提供商。
                </Paragraph>
                <Paragraph>
                  OpenAI 隐私政策：<Text code>https://openai.com/privacy</Text>
                </Paragraph>

                <Title level={5}>3.3 游戏 Wiki 网站（可选）</Title>
                <Paragraph>
                  本软件支持从游戏 Wiki 网站（如
                  Fandom）抓取游戏知识库。抓取过程会向目标网站发送 HTTP
                  请求，但不包含任何用户个人信息。
                </Paragraph>

                <Alert
                  type="info"
                  message="重要提示"
                  description="您可以选择不配置任何第三方服务，仅使用本地功能。配置第三方服务时，请仔细阅读相应服务提供商的隐私政策。"
                  style={{ marginTop: 16 }}
                />
              </section>

              <Divider />

              <section>
                <Title level={4}>4. 数据安全</Title>
                <Paragraph>
                  虽然我们不收集任何数据，但我们仍然采取以下措施保护您的本地数据：
                </Paragraph>
                <ul>
                  <li>使用 Tauri 框架的安全沙箱机制，防止未授权访问</li>
                  <li>敏感配置（如 API 密钥）在内存中处理，减少泄露风险</li>
                  <li>不使用任何第三方分析或追踪库</li>
                  <li>开源代码，接受社区审查和监督</li>
                </ul>
                <Paragraph>
                  <Text strong>您的责任：</Text>
                  请妥善保管您的设备和配置文件，避免未授权访问。定期备份重要数据。
                </Paragraph>
              </section>

              <Divider />

              <section>
                <Title level={4}>5. 儿童隐私</Title>
                <Paragraph>
                  本软件不专门面向 13
                  岁以下儿童设计。如果您是未成年人，请在家长或监护人的指导下使用本软件。
                </Paragraph>
              </section>

              <Divider />

              <section>
                <Title level={4}>6. 您的权利</Title>
                <Paragraph>
                  由于所有数据都存储在您的本地设备上，您拥有完全的控制权：
                </Paragraph>
                <ul>
                  <li>
                    <Text strong>访问权：</Text>您可以随时查看配置文件和数据目录
                  </li>
                  <li>
                    <Text strong>删除权：</Text>
                    您可以手动删除任何本地数据或完全卸载软件
                  </li>
                  <li>
                    <Text strong>导出权：</Text>您可以复制或导出任何本地数据
                  </li>
                  <li>
                    <Text strong>修改权：</Text>
                    您可以直接编辑配置文件（需要一定技术知识）
                  </li>
                </ul>
              </section>

              <Divider />

              <section>
                <Title level={4}>7. 开源透明</Title>
                <Paragraph>
                  Gamate 是一款开源软件，源代码托管在 GitHub 上。您可以：
                </Paragraph>
                <ul>
                  <li>审查完整的源代码，验证我们的隐私承诺</li>
                  <li>自行编译和运行软件，确保没有隐藏的数据收集</li>
                  <li>向社区报告任何潜在的隐私问题</li>
                  <li>参与开发，改进软件的隐私保护机制</li>
                </ul>
                <Paragraph>
                  GitHub 仓库：
                  <Text code>
                    https://github.com/yourusername/game_partner_skill
                  </Text>
                </Paragraph>
              </section>

              <Divider />

              <section>
                <Title level={4}>8. 政策变更</Title>
                <Paragraph>
                  我们保留随时更新本隐私政策的权利。任何变更将在软件更新日志中说明。如果变更会实质性影响您的权利，我们会在软件中显著提示。
                </Paragraph>
                <Paragraph>
                  继续使用软件即表示您接受更新后的隐私政策。
                </Paragraph>
              </section>

              <Divider />

              <section>
                <Title level={4}>9. 联系我们</Title>
                <Paragraph>
                  如果您对本隐私政策有任何疑问或建议，请通过以下方式联系我们：
                </Paragraph>
                <Paragraph>
                  <Text strong>GitHub Issues：</Text>{" "}
                  <Text code>
                    https://github.com/yourusername/game_partner_skill/issues
                  </Text>
                </Paragraph>
                <Paragraph type="secondary" style={{ marginTop: 32 }}>
                  感谢您信任
                  Gamate！我们将始终坚持"数据本地化、隐私第一"的原则。
                </Paragraph>
              </section>
            </Space>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export default PrivacyPolicy;
