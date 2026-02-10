use crate::settings::ModelConfig;
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};

/// Ollama 聊天请求
#[derive(Debug, Serialize)]
struct OllamaChatRequest {
    model: String,
    messages: Vec<OllamaMessage>,
    stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    options: Option<OllamaOptions>,
}

/// Ollama 消息
#[derive(Debug, Serialize)]
struct OllamaMessage {
    role: String,
    content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    images: Option<Vec<String>>,
}

/// Ollama 选项
#[derive(Debug, Serialize)]
struct OllamaOptions {
    temperature: f32,
    num_predict: i32, // Ollama 使用 num_predict 而不是 max_tokens
    #[serde(skip_serializing_if = "Option::is_none")]
    stop: Option<Vec<String>>, // 停止词
}

/// Ollama 聊天响应
#[derive(Debug, Deserialize)]
struct OllamaChatResponse {
    message: OllamaResponseMessage,
    #[serde(default)]
    done: bool,
}

/// Ollama 响应消息
#[derive(Debug, Deserialize)]
struct OllamaResponseMessage {
    role: String,
    content: String,
    #[serde(default)]
    thinking: Option<String>, // qwen3-vl 返回的思考过程
}

/// Ollama 客户端 (原生 API)
pub struct OllamaClient {
    base_url: String,
    settings: ModelConfig,
    client: reqwest::Client,
}

impl OllamaClient {
    /// 创建新的 Ollama 客户端
    pub fn new(settings: ModelConfig) -> Result<Self> {
        // 移除 /v1 后缀（如果存在），因为 Ollama 原生 API 不使用 /v1
        let mut base_url = settings.api_base.trim_end_matches('/').to_string();
        if base_url.ends_with("/v1") {
            base_url = base_url.trim_end_matches("/v1").to_string();
            log::info!("🦙 检测到 /v1 后缀，已自动移除（Ollama 原生 API 不需要）");
        }

        log::info!("🦙 创建 Ollama 客户端");
        log::info!("   Base URL: {}", base_url);
        log::info!("   模型: {}", settings.model_name);

        Ok(Self {
            base_url,
            settings,
            client: reqwest::Client::new(),
        })
    }

    /// 调用 Ollama 模型 (纯文本)
    pub async fn chat(&self, system_prompt: &str, user_prompt: &str) -> Result<String> {
        log::info!("🦙 调用 Ollama API: {}", self.settings.model_name);

        let messages = vec![
            OllamaMessage {
                role: "system".to_string(),
                content: system_prompt.to_string(),
                images: None,
            },
            OllamaMessage {
                role: "user".to_string(),
                content: user_prompt.to_string(),
                images: None,
            },
        ];

        let request = OllamaChatRequest {
            model: self.settings.model_name.clone(),
            messages,
            stream: false,
            options: Some(OllamaOptions {
                temperature: self.settings.temperature,
                num_predict: self.settings.max_tokens as i32,
                stop: None,
            }),
        };

        let url = format!("{}/api/chat", self.base_url);
        log::debug!("📤 请求 URL: {}", url);

        let response = self
            .client
            .post(&url)
            .json(&request)
            .send()
            .await
            .map_err(|e| anyhow!("Ollama 请求失败: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(anyhow!("Ollama API 返回错误 {}: {}", status, error_text));
        }

        let ollama_response: OllamaChatResponse = response
            .json()
            .await
            .map_err(|e| anyhow!("解析 Ollama 响应失败: {}", e))?;

        log::info!("✅ Ollama 响应成功");

        // 提取内容: content 是真正的答案
        let content = ollama_response.message.content;

        // 记录 thinking 信息（如果存在）
        if let Some(ref thinking) = ollama_response.message.thinking {
            log::debug!("🧠 模型返回了 thinking 字段: {} bytes", thinking.len());
        }

        if content.is_empty() {
            log::warn!("⚠️  Ollama 返回了空 content");
            return Err(anyhow!("AI 响应为空，请重试"));
        }

        log::info!("📝 响应长度: {} bytes", content.len());

        Ok(content)
    }

    /// 调用 Ollama Vision 模型 (带图片)
    pub async fn chat_with_vision(
        &self,
        system_prompt: &str,
        user_prompt: &str,
        image_base64: &str,
    ) -> Result<String> {
        log::info!("👁️  调用 Ollama Vision API: {}", self.settings.model_name);

        // 去掉 data URL 前缀（如果存在）
        let clean_base64 = if image_base64.contains("base64,") {
            image_base64.split("base64,").nth(1).unwrap_or(image_base64)
        } else {
            image_base64
        };

        log::debug!(
            "📤 Base64 数据长度: {} bytes (原始: {})",
            clean_base64.len(),
            image_base64.len()
        );

        let messages = vec![
            OllamaMessage {
                role: "system".to_string(),
                content: system_prompt.to_string(),
                images: None,
            },
            OllamaMessage {
                role: "user".to_string(),
                content: user_prompt.to_string(),
                images: Some(vec![clean_base64.to_string()]),
            },
        ];

        let request = OllamaChatRequest {
            model: self.settings.model_name.clone(),
            messages,
            stream: false,
            options: Some(OllamaOptions {
                temperature: self.settings.temperature,
                num_predict: self.settings.max_tokens as i32,
                stop: None,
            }),
        };

        let url = format!("{}/api/chat", self.base_url);
        log::debug!("📤 请求 URL: {}", url);

        let response = self
            .client
            .post(&url)
            .json(&request)
            .timeout(std::time::Duration::from_secs(120))
            .send()
            .await
            .map_err(|e| anyhow!("Ollama Vision 请求失败: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            log::error!("❌ Ollama Vision API 错误 {}: {}", status, error_text);
            return Err(anyhow!(
                "Ollama Vision API 返回错误 {}: {}",
                status,
                error_text
            ));
        }

        // 先获取原始文本，用于调试
        let response_text = response
            .text()
            .await
            .map_err(|e| anyhow!("读取 Ollama Vision 响应失败: {}", e))?;

        log::info!("📥 原始响应长度: {} bytes", response_text.len());
        // 安全截取前 300 个字符 (处理多字节字符)
        let preview_len = response_text.len().min(300);
        let mut safe_preview_len = preview_len;
        while safe_preview_len > 0 && !response_text.is_char_boundary(safe_preview_len) {
            safe_preview_len -= 1;
        }
        log::info!("📥 原始响应预览: {}", &response_text[..safe_preview_len]);

        // 解析 JSON
        let ollama_response: OllamaChatResponse =
            serde_json::from_str(&response_text).map_err(|e| {
                anyhow!(
                    "解析 Ollama Vision 响应失败: {} | 响应: {}",
                    e,
                    &response_text[..response_text.len().min(200)]
                )
            })?;

        log::info!("✅ Ollama Vision 响应成功");

        // 提取内容: content 是真正的答案
        let content = ollama_response.message.content;

        // 记录 thinking 信息（如果存在）用于调试
        if let Some(ref thinking) = ollama_response.message.thinking {
            log::debug!("🧠 模型返回了 thinking 字段: {} bytes", thinking.len());
            // 只预览前 100 个字符
            let preview_len = thinking.len().min(100);
            let mut safe_len = preview_len;
            while safe_len > 0 && !thinking.is_char_boundary(safe_len) {
                safe_len -= 1;
            }
            log::debug!("🧠 thinking 预览: {}...", &thinking[..safe_len]);
        }

        log::info!("📥 提取的 content 长度: {} bytes", content.len());
        if content.len() > 0 {
            // 安全截取前 200 个字符
            let preview_len = content.len().min(200);
            let mut safe_len = preview_len;
            while safe_len > 0 && !content.is_char_boundary(safe_len) {
                safe_len -= 1;
            }
            log::info!("📥 content 前{}字符: {}", safe_len, &content[..safe_len]);
        }

        if content.is_empty() {
            log::error!("⚠️  Ollama Vision 返回了空 content!");
            return Err(anyhow!("AI 视觉响应为空，请重试"));
        }

        Ok(content)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::Engine;
    use std::fs;
    use std::path::Path; // 导入 base64 Engine trait

    #[tokio::test]
    #[ignore] // 需要本地 Ollama 服务运行
    async fn test_ollama_chat() {
        let settings = ModelConfig {
            provider: "local".to_string(),
            api_base: "http://localhost:11434".to_string(),
            api_key: None,
            model_name: "qwen3-vl:latest".to_string(),
            enabled: true,
            temperature: 0.7,
            max_tokens: 100,
        };

        let client = OllamaClient::new(settings).unwrap();
        let response = client.chat("你是游戏助手", "你好").await;

        assert!(response.is_ok());
        println!("响应: {}", response.unwrap());
    }

    #[tokio::test]
    async fn test_ollama_vision_with_real_image() {
        // 初始化日志
        let _ = env_logger::builder()
            .filter_level(log::LevelFilter::Debug)
            .is_test(true)
            .try_init();

        println!("\n🧪 开始测试 Ollama Vision API");
        println!("{}", "=".repeat(60));

        // 1. 读取图片文件
        let image_path = Path::new(r"C:\Users\Administrator\Downloads\1.png");
        println!("\n📁 读取图片: {}", image_path.display());

        let image_data = fs::read(image_path).expect("无法读取图片文件,请确保路径正确");
        println!("✅ 图片读取成功: {} bytes", image_data.len());

        // 2. 转换为 Base64
        let base64_image = base64::engine::general_purpose::STANDARD.encode(&image_data);
        println!("✅ Base64 编码成功: {} chars", base64_image.len());

        // 3. 创建 Ollama 客户端
        let settings = ModelConfig {
            provider: "local".to_string(),
            api_base: "http://localhost:11434".to_string(),
            api_key: None,
            model_name: "qwen3-vl:latest".to_string(),
            enabled: true,
            temperature: 0.7,
            max_tokens: 2000,
        };

        let client = OllamaClient::new(settings).unwrap();
        println!("\n✅ Ollama 客户端创建成功");

        // 4. 调用 Vision API
        println!("\n🔮 调用 Vision API...");
        println!("   System: 你是游戏助手");
        println!("   User: 这是什么游戏?请详细描述");

        let result = client
            .chat_with_vision("你是游戏助手", "这是什么游戏?请详细描述", &base64_image)
            .await;

        // 5. 检查结果
        println!("\n📊 测试结果:");
        println!("{}", "=".repeat(60));

        match result {
            Ok(response) => {
                println!("✅ 成功!");
                println!("\n📝 AI 回复:");
                println!("{}", "-".repeat(60));
                println!("{}", response);
                println!("{}", "-".repeat(60));
                println!("\n📏 回复长度: {} 字符", response.len());

                // 验证回复不为空
                assert!(!response.is_empty(), "响应内容不应该为空");
                assert!(response.len() > 10, "响应内容太短,可能有问题");

                println!("\n✅ AI 成功识别了图片内容!");
            }
            Err(e) => {
                println!("❌ 失败!");
                println!("错误: {}", e);
                panic!("Vision API 调用失败: {}", e);
            }
        }

        println!("\n✅ 测试完成!");
    }
}
