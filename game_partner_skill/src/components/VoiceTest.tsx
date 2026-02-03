import React, { useState, useEffect } from "react";
import { Card, Button, List, Typography, Space, message, Tag } from "antd";
import { SoundOutlined, StopOutlined } from "@ant-design/icons";
import { invoke } from "@tauri-apps/api/core";

const { Title, Text } = Typography;

/**
 * 语音测试组件 - 用于测试和查看系统可用语音
 */
const VoiceTest: React.FC = () => {
  const [voices, setVoices] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentVoice, setCurrentVoice] = useState<string>("");

  // 加载可用语音列表
  const loadVoices = async () => {
    setLoading(true);
    try {
      const voiceList = (await invoke("get_tts_voices")) as string[];
      setVoices(voiceList);
      message.success(`找到 ${voiceList.length} 个可用语音`);
    } catch (error) {
      message.error(`加载语音失败: ${error}`);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // 测试指定语音
  const testVoice = async (voiceName: string) => {
    try {
      setCurrentVoice(voiceName);
      await invoke("set_tts_voice", { voiceName });
      await invoke("speak_text", {
        text: "你好,这是语音测试。Hello, this is a voice test.",
        interrupt: true,
      });
      message.success(`正在播放: ${voiceName}`);
    } catch (error) {
      message.error(`播放失败: ${error}`);
      console.error(error);
    }
  };

  // 停止播放
  const stopSpeaking = async () => {
    try {
      await invoke("stop_speaking");
      setCurrentVoice("");
      message.info("已停止播放");
    } catch (error) {
      message.error(`停止失败: ${error}`);
    }
  };

  // 组件加载时获取语音列表
  useEffect(() => {
    loadVoices();
  }, []);

  // 判断语音类型
  const getVoiceType = (voiceName: string) => {
    if (voiceName.includes("Chinese") || voiceName.includes("中文")) {
      if (
        voiceName.includes("Huihui") ||
        voiceName.includes("Yaoyao")
      ) {
        return { type: "中文女声", color: "pink" };
      } else if (voiceName.includes("Kangkang")) {
        return { type: "中文男声", color: "blue" };
      }
      return { type: "中文", color: "green" };
    } else if (voiceName.includes("English") || voiceName.includes("United")) {
      if (voiceName.includes("Jenny")) {
        return { type: "英文女声", color: "pink" };
      } else if (
        voiceName.includes("David") ||
        voiceName.includes("Mark")
      ) {
        return { type: "英文男声", color: "blue" };
      }
      return { type: "英文", color: "cyan" };
    }
    return { type: "其他", color: "default" };
  };

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Title level={3}>🎤 系统语音测试</Title>
        <Text type="secondary">
          查看和测试系统上所有可用的 TTS 语音,点击测试按钮可以试听
        </Text>

        <div style={{ marginTop: 24, marginBottom: 16 }}>
          <Space>
            <Button type="primary" onClick={loadVoices} loading={loading}>
              刷新语音列表
            </Button>
            <Button icon={<StopOutlined />} onClick={stopSpeaking}>
              停止播放
            </Button>
            <Text>共找到 {voices.length} 个语音</Text>
          </Space>
        </div>

        <List
          bordered
          dataSource={voices}
          renderItem={(voice) => {
            const voiceInfo = getVoiceType(voice);
            const isPlaying = currentVoice === voice;

            return (
              <List.Item
                style={{
                  backgroundColor: isPlaying ? "#e6f7ff" : undefined,
                }}
                actions={[
                  <Button
                    key="test"
                    type={isPlaying ? "primary" : "default"}
                    icon={<SoundOutlined />}
                    onClick={() => testVoice(voice)}
                    size="small"
                  >
                    {isPlaying ? "正在播放..." : "测试"}
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Tag color={voiceInfo.color}>{voiceInfo.type}</Tag>
                      <Text>{voice}</Text>
                    </Space>
                  }
                />
              </List.Item>
            );
          }}
        />
      </Card>

      <Card style={{ marginTop: 24 }}>
        <Title level={4}>💡 使用提示</Title>
        <ul>
          <li>
            <Text>
              <strong>中文女声推荐:</strong> Microsoft Huihui (温柔) 或 Yaoyao (活泼)
            </Text>
          </li>
          <li>
            <Text>
              <strong>中文男声推荐:</strong> Microsoft Kangkang (标准清晰)
            </Text>
          </li>
          <li>
            <Text>
              <strong>英文推荐:</strong> Microsoft Jenny (自然流畅,可读中英文)
            </Text>
          </li>
          <li>
            <Text type="secondary">
              这些是 Windows 10/11 默认自带的语音包,无需额外下载
            </Text>
          </li>
          <li>
            <Text type="secondary">
              如果某个语音无法播放,请在 Windows 设置中检查语音包是否已安装
            </Text>
          </li>
        </ul>
      </Card>
    </div>
  );
};

export default VoiceTest;
