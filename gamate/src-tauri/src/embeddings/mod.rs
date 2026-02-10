use anyhow::Result;
use serde::{Deserialize, Serialize};

/// Embedding 服务 - 使用 OpenAI API
pub struct EmbeddingService {
    api_key: String,
    api_base: String,
    model: String,
}

#[derive(Serialize)]
struct EmbeddingRequest {
    input: Vec<String>,
    model: String,
}

#[derive(Deserialize)]
struct EmbeddingResponse {
    data: Vec<EmbeddingData>,
}

#[derive(Deserialize)]
struct EmbeddingData {
    embedding: Vec<f32>,
}

impl EmbeddingService {
    /// 创建新的 Embedding 服务
    ///
    /// # 参数
    /// - `api_base`: API 基础地址
    /// - `api_key`: API 密钥 (可选,本地模型可传 None)
    /// - `model`: 模型名称
    pub async fn new(api_base: String, api_key: Option<String>, model: String) -> Result<Self> {
        log::info!("🤖 初始化 Embedding 服务...");

        let api_key = api_key.unwrap_or_else(|| "ollama".to_string());

        log::info!("✅ Embedding 服务配置完成");
        log::info!("   API Base: {}", api_base);
        log::info!(
            "   API Key: {}",
            if api_key.is_empty() {
                "(空)"
            } else {
                "(已设置)"
            }
        );
        log::info!("   模型: {}", model);

        Ok(Self {
            api_key,
            api_base,
            model,
        })
    }

    /// 生成单个文本的嵌入向量
    pub async fn embed_text(&self, text: &str) -> Result<Vec<f32>> {
        let vectors = self.embed_batch(vec![text]).await?;
        vectors
            .into_iter()
            .next()
            .ok_or_else(|| anyhow::anyhow!("生成 embedding 失败"))
    }

    /// 批量生成嵌入向量
    pub async fn embed_batch(&self, texts: Vec<&str>) -> Result<Vec<Vec<f32>>> {
        if texts.is_empty() {
            return Ok(vec![]);
        }

        log::info!("📝 批量生成 {} 个文本的 embedding...", texts.len());
        log::info!("📡 请求 URL: {}/embeddings", self.api_base);

        let client = reqwest::Client::new();
        let request = EmbeddingRequest {
            input: texts.iter().map(|&s| s.to_string()).collect(),
            model: self.model.clone(),
        };

        let mut req_builder = client
            .post(format!("{}/embeddings", self.api_base))
            .header("Content-Type", "application/json");

        // 只有在 API key 不为空且不是 dummy/ollama 时才添加 Authorization header
        if !self.api_key.is_empty()
            && self.api_key != "dummy"
            && self.api_key != "ollama"
            && !self.api_base.contains("localhost")
            && !self.api_base.contains("127.0.0.1")
        {
            req_builder = req_builder.header("Authorization", format!("Bearer {}", self.api_key));
            log::info!("🔑 使用 API Key 认证");
        } else {
            log::info!("🏠 使用本地服务,无需认证");
        }

        let response = req_builder.json(&request).send().await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await?;
            anyhow::bail!("Embedding API 请求失败 ({}): {}", status, error_text);
        }

        let embedding_response: EmbeddingResponse = response.json().await?;
        let embeddings: Vec<Vec<f32>> = embedding_response
            .data
            .into_iter()
            .map(|d| d.embedding)
            .collect();

        log::info!("✅ 批量 embedding 完成");

        Ok(embeddings)
    }

    /// 获取向量维度
    pub fn dimension(&self) -> usize {
        // 根据模型返回对应的维度
        match self.model.as_str() {
            "text-embedding-3-small" => 1536,
            "text-embedding-3-large" => 3072,
            "text-embedding-ada-002" => 1536,
            "nomic-embed-text" => 768, // Ollama nomic-embed-text 实际维度
            "mxbai-embed-large" => 1024, // Ollama mxbai 模型
            "qwen3-embedding:4b" => 2560, // Qwen3 embedding 模型
            "all-minilm" => 384,
            _ => {
                log::warn!("⚠️  未知模型 '{}', 使用默认维度 768", self.model);
                768
            }
        }
    }
}
