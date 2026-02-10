import { Card, Typography, Divider, Space } from "antd";
import { motion } from "framer-motion";
import "./styles.scss";

const { Title, Paragraph, Text } = Typography;

const UserAgreement: React.FC = () => {
  return (
    <div className="user-agreement">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card>
          <div style={{ maxWidth: 800, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <Title level={2}>用户服务协议</Title>
              <Text type="secondary">最后更新时间：2026年2月10日</Text>
            </div>

            <Space direction="vertical" size="large" style={{ width: "100%" }}>
              <section>
                <Title level={4}>1. 服务说明</Title>
                <Paragraph>
                  欢迎使用
                  Gamate（以下简称"本软件"）。本软件是一款基于人工智能技术的游戏陪玩助手，旨在为用户提供智能语音对话、游戏知识查询、直播模拟等功能。
                </Paragraph>
                <Paragraph>
                  本软件完全运行在用户本地设备上，不会收集、存储或传输任何用户个人信息和游戏数据到远程服务器（除非用户主动配置第三方
                  API 服务）。
                </Paragraph>
              </section>

              <Divider />

              <section>
                <Title level={4}>2. 使用许可</Title>
                <Paragraph>
                  2.1
                  本软件采用开源许可证发布，用户可以自由使用、复制、修改和分发本软件，但需遵守相应的开源协议条款。
                </Paragraph>
                <Paragraph>
                  2.2
                  用户在使用本软件时，应当遵守中华人民共和国相关法律法规，不得将本软件用于任何非法用途。
                </Paragraph>
                <Paragraph>
                  2.3
                  用户使用本软件所产生的内容（包括但不限于游戏数据、配置信息、技能库等）的所有权归用户所有。
                </Paragraph>
              </section>

              <Divider />

              <section>
                <Title level={4}>3. 第三方服务</Title>
                <Paragraph>
                  3.1 本软件可能集成第三方 API 服务（如阿里云语音服务、OpenAI
                  API
                  等），用户在使用这些服务时，应当遵守相应服务提供商的用户协议和隐私政策。
                </Paragraph>
                <Paragraph>
                  3.2 用户需自行申请并配置第三方 API
                  密钥，因使用第三方服务产生的费用由用户自行承担。
                </Paragraph>
                <Paragraph>
                  3.3 我们不对第三方服务的可用性、准确性或安全性承担任何责任。
                </Paragraph>
              </section>

              <Divider />

              <section>
                <Title level={4}>4. 知识产权</Title>
                <Paragraph>
                  4.1
                  本软件的源代码、界面设计、文档等内容的知识产权归开发者所有，受著作权法和国际著作权条约的保护。
                </Paragraph>
                <Paragraph>
                  4.2 本软件所抓取的游戏 Wiki
                  知识库内容版权归原网站和内容创作者所有，本软件仅提供技术手段供用户本地使用，不得用于商业用途。
                </Paragraph>
                <Paragraph>
                  4.3 用户在使用本软件时，应当尊重游戏开发商、Wiki
                  贡献者等相关方的知识产权。
                </Paragraph>
              </section>

              <Divider />

              <section>
                <Title level={4}>5. 免责声明</Title>
                <Paragraph>
                  5.1
                  本软件按"现状"提供，不提供任何明示或暗示的保证，包括但不限于适销性、特定用途适用性和非侵权性的保证。
                </Paragraph>
                <Paragraph>
                  5.2
                  开发者不对因使用或无法使用本软件而导致的任何直接、间接、偶然、特殊或后果性损害承担责任，包括但不限于利润损失、数据丢失、业务中断等。
                </Paragraph>
                <Paragraph>
                  5.3
                  用户应当自行承担使用本软件的风险，包括但不限于软件缺陷、数据丢失、系统崩溃等。
                </Paragraph>
                <Paragraph>
                  5.4 本软件的 AI
                  生成内容仅供参考，不构成专业建议。用户应当根据实际情况独立判断和决策。
                </Paragraph>
              </section>

              <Divider />

              <section>
                <Title level={4}>6. 隐私保护</Title>
                <Paragraph>
                  6.1
                  本软件高度重视用户隐私保护。所有用户数据（包括游戏配置、技能库、对话记录等）均存储在用户本地设备，不会上传到任何服务器。
                </Paragraph>
                <Paragraph>
                  6.2
                  本软件不会收集任何用户个人身份信息、设备信息或使用行为数据。
                </Paragraph>
                <Paragraph>
                  6.3 用户配置的第三方 API
                  密钥仅存储在本地配置文件中，不会被传输或共享给任何第三方（除非用户主动调用相应
                  API）。
                </Paragraph>
                <Paragraph>详细信息请参阅《隐私政策》。</Paragraph>
              </section>

              <Divider />

              <section>
                <Title level={4}>7. 协议变更</Title>
                <Paragraph>
                  7.1
                  我们保留随时修改本协议的权利。协议变更后，我们会在软件更新日志中说明变更内容。
                </Paragraph>
                <Paragraph>
                  7.2
                  用户继续使用本软件即表示接受修改后的协议。如不同意修改后的协议，用户应当停止使用本软件。
                </Paragraph>
              </section>

              <Divider />

              <section>
                <Title level={4}>8. 其他条款</Title>
                <Paragraph>
                  8.1 本协议的解释、效力及纠纷的解决，适用中华人民共和国法律。
                </Paragraph>
                <Paragraph>
                  8.2
                  若本协议的任何条款被认定为无效或不可执行，不影响其他条款的效力。
                </Paragraph>
                <Paragraph>
                  8.3
                  本软件为开源免费软件，开发者不提供任何形式的技术支持或售后服务，但欢迎用户通过
                  GitHub 提交问题和建议。
                </Paragraph>
              </section>

              <Divider />

              <section>
                <Title level={4}>9. 联系方式</Title>
                <Paragraph>
                  如您对本协议有任何疑问或建议，请通过以下方式联系我们：
                </Paragraph>
                <Paragraph>
                  <Text strong>GitHub：</Text>{" "}
                  <Text code>
                    https://github.com/yourusername/game_partner_skill
                  </Text>
                </Paragraph>
                <Paragraph type="secondary" style={{ marginTop: 32 }}>
                  感谢您使用 Gamate！
                </Paragraph>
              </section>
            </Space>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export default UserAgreement;
