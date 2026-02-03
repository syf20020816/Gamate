use anyhow::{Result, anyhow};
use async_openai::{
    config::OpenAIConfig,
    types::{
        ChatCompletionRequestMessage, ChatCompletionRequestSystemMessageArgs,
        ChatCompletionRequestUserMessageArgs, CreateChatCompletionRequestArgs,
        ChatCompletionRequestUserMessageContent, ImageDetail,
    },
    Client,
};
use crate::settings::ModelConfig;

/// OpenAI 客户端
pub struct OpenAIClient {
    client: Client<OpenAIConfig>,
    settings: ModelConfig,
}

impl OpenAIClient {
    /// 创建新的 OpenAI 客户端
    pub fn new(settings: ModelConfig) -> Result<Self> {
        // 创建配置
        let mut config = OpenAIConfig::new()
            .with_api_base(&settings.api_base);

        // 只有在提供了 API Key 时才设置 (本地 Ollama 不需要)
        if let Some(api_key) = &settings.api_key {
            config = config.with_api_key(api_key);
        } else {
            // 本地模型使用占位符 API Key (Ollama 会忽略)
            config = config.with_api_key("ollama");
        }

        let client = Client::with_config(config);

        Ok(Self { client, settings })
    }

    /// 调用 GPT 模型 (纯文本)
    pub async fn chat(&self, system_prompt: &str, user_prompt: &str) -> Result<String> {
        log::info!("🤖 调用 OpenAI API: {}", self.settings.model_name);

        let messages = vec![
            ChatCompletionRequestMessage::System(
                ChatCompletionRequestSystemMessageArgs::default()
                    .content(system_prompt)
                    .build()?
            ),
            ChatCompletionRequestMessage::User(
                ChatCompletionRequestUserMessageArgs::default()
                    .content(user_prompt)
                    .build()?
            ),
        ];

        let request = CreateChatCompletionRequestArgs::default()
            .model(&self.settings.model_name)
            .messages(messages)
            .temperature(self.settings.temperature)
            .max_tokens(self.settings.max_tokens)
            .build()?;

        let response = self.client
            .chat()
            .create(request)
            .await
            .map_err(|e| anyhow!("OpenAI API 调用失败: {}", e))?;

        let content = response
            .choices
            .first()
            .and_then(|choice| choice.message.content.clone())
            .ok_or_else(|| anyhow!("OpenAI 返回空内容"))?;

        log::info!("✅ OpenAI 响应成功 ({} tokens)", 
            response.usage.map(|u| u.total_tokens).unwrap_or(0));

        Ok(content)
    }

    /// 调用 GPT Vision 模型 (带图片)
    pub async fn chat_with_vision(
        &self,
        system_prompt: &str,
        user_prompt: &str,
        image_base64: &str,
    ) -> Result<String> {
        log::info!("👁️  调用 OpenAI Vision API: {}", self.settings.model_name);

        // 构建图片 URL (data URL 格式)
        let image_url = format!("data:image/jpeg;base64,{}", image_base64);

        let messages = vec![
            ChatCompletionRequestMessage::System(
                ChatCompletionRequestSystemMessageArgs::default()
                    .content(system_prompt)
                    .build()?
            ),
            ChatCompletionRequestMessage::User(
                ChatCompletionRequestUserMessageArgs::default()
                    .content(ChatCompletionRequestUserMessageContent::Array(vec![
                        // 文本内容
                        async_openai::types::ChatCompletionRequestMessageContentPart::Text(
                            async_openai::types::ChatCompletionRequestMessageContentPartText {
                                text: user_prompt.to_string(),
                            }
                        ),
                        // 图片内容
                        async_openai::types::ChatCompletionRequestMessageContentPart::ImageUrl(
                            async_openai::types::ChatCompletionRequestMessageContentPartImage {
                                image_url: async_openai::types::ImageUrl {
                                    url: image_url,
                                    detail: Some(ImageDetail::Auto),
                                }
                            }
                        ),
                    ]))
                    .build()?
            ),
        ];

        let request = CreateChatCompletionRequestArgs::default()
            .model(&self.settings.model_name)
            .messages(messages)
            .temperature(self.settings.temperature)
            .max_tokens(self.settings.max_tokens)
            .build()?;

        let response = self.client
            .chat()
            .create(request)
            .await
            .map_err(|e| anyhow!("OpenAI Vision API 调用失败: {}", e))?;

        let content = response
            .choices
            .first()
            .and_then(|choice| choice.message.content.clone())
            .ok_or_else(|| anyhow!("OpenAI Vision 返回空内容"))?;

        log::info!("✅ OpenAI Vision 响应成功 ({} tokens)", 
            response.usage.map(|u| u.total_tokens).unwrap_or(0));

        Ok(content)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore] // 需要真实 API Key 才能运行
    async fn test_openai_chat() {
        let settings = ModelConfig {
            provider: "openai".to_string(),
            api_base: "https://api.openai.com/v1".to_string(),
            api_key: Some("sk-...".to_string()), // 替换为真实 API Key
            model_name: "gpt-4o-mini".to_string(),
            enabled: true,
            temperature: 0.7,
            max_tokens: 500,
        };

        let client = OpenAIClient::new(settings).unwrap();
        let response = client.chat(
            "你是一个游戏助手。",
            "简单介绍一下恐鬼症游戏。"
        ).await;

        assert!(response.is_ok());
        println!("响应: {}", response.unwrap());
    }
}
