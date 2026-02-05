use crate::rag::{build_rag_context, build_prompt, AIResponse, WikiReference};
use crate::settings::AppSettings;
use crate::llm::{OpenAIClient, OllamaClient};
use anyhow::Result;
use base64::{Engine as _, engine::general_purpose};

/// 生成 AI 回复 (Tauri 命令)
#[tauri::command]
pub async fn generate_ai_response(
    message: String,
    game_id: String,
    screenshot: Option<String>,
) -> Result<AIResponse, String> {
    generate_ai_response_impl(message, game_id, screenshot)
        .await
        .map_err(|e| format!("AI 回复生成失败: {}", e))
}

/// 生成 AI 回复 (内部实现)
async fn generate_ai_response_impl(
    message: String,
    game_id: String,
    screenshot: Option<String>,
) -> Result<AIResponse> {
    log::info!("🤖 开始生成 AI 回复");
    log::info!("   用户消息: {}", message);
    log::info!("   游戏 ID: {}", game_id);

    // 1. 构建 RAG 上下文
    let context = build_rag_context(&game_id, &message, screenshot.clone()).await?;

    // 2. 构建 Prompt
    let game_name = get_game_name(&game_id);
    let (system_prompt, user_prompt) = build_prompt(&game_name, &message, &context);

    log::info!("📝 Prompt 构建完成");
    log::debug!("系统 Prompt:\n{}", system_prompt);
    log::debug!("用户 Prompt:\n{}", user_prompt);

    // 3. 调用 LLM
    let ai_content = call_llm(&system_prompt, &user_prompt, &screenshot).await?;

    // 4. 返回结果
    let wiki_references: Vec<WikiReference> = context
        .wiki_entries
        .into_iter()
        .map(|entry| WikiReference {
            title: entry.title,
            content: entry.content,
            score: entry.score,
            url: entry.url,
        })
        .collect();

    Ok(AIResponse {
        content: ai_content,
        wiki_references: Some(wiki_references),
    })
}

/// 获取游戏名称
fn get_game_name(game_id: &str) -> String {
    match game_id {
        "phasmophobia" => "恐鬼症",
        "elden-ring" => "艾尔登法环",
        "dark-souls-3" => "黑暗之魂3",
        _ => "未知游戏",
    }
    .to_string()
}

/// 净化 base64 图片字符串
/// 
/// 功能:
/// 1. 去除 data:image/...;base64, 前缀 (如果有)
/// 2. 移除换行符和空白字符
/// 3. 校验 base64 格式是否有效
/// 
/// 返回: 纯净的 base64 字符串
fn sanitize_base64_image(s: &str) -> Result<String> {
    let mut cleaned = s.trim().to_string();
    
    // 1. 去除 data URL 前缀
    if let Some(comma_idx) = cleaned.find(',') {
        // 先复制前缀用于日志,避免借用冲突
        let prefix = cleaned[..comma_idx].to_string();
        if prefix.starts_with("data:") && prefix.contains("base64") {
            cleaned = cleaned[comma_idx + 1..].to_string();
            log::info!("🧹 检测到 data URL 前缀,已移除: {}", prefix);
        }
    }
    
    // 2. 移除所有换行符和空白字符
    cleaned.retain(|c| !c.is_whitespace());
    
    // 3. 校验 base64 格式
    match general_purpose::STANDARD.decode(&cleaned) {
        Ok(decoded) => {
            log::info!("✅ base64 图片校验成功 (解码后大小: {} bytes)", decoded.len());
            Ok(cleaned)
        }
        Err(e) => {
            log::error!("❌ base64 图片格式无效: {}", e);
            log::error!("   原始字符串长度: {}", s.len());
            log::error!("   清理后字符串长度: {}", cleaned.len());
            log::error!("   前 50 字符: {}", &cleaned.chars().take(50).collect::<String>());
            Err(anyhow::anyhow!("无效的 base64 图片格式: {}", e))
        }
    }
}

/// 调用 LLM (根据配置选择不同的实现)
async fn call_llm(
    system_prompt: &str,
    user_prompt: &str,
    screenshot: &Option<String>,
) -> Result<String> {
    // 加载设置
    let settings = AppSettings::load()?;
    let multimodal_config = settings.ai_models.multimodal;

    // 检查是否启用
    if !multimodal_config.enabled {
        log::warn!("⚠️  多模态模型未启用,使用 Mock 实现");
        return mock_llm_fallback(user_prompt);
    }

    // 检查 API Key (仅对非本地模型)
    if multimodal_config.provider != "local" && multimodal_config.api_key.is_none() {
        log::warn!("⚠️  未配置 API Key (提供商: {}),使用 Mock 实现", multimodal_config.provider);
        return mock_llm_fallback(user_prompt);
    }

    // 根据 provider 选择合适的客户端
    let is_local = multimodal_config.provider == "local";
    
    log::info!("🤖 使用 {} 客户端", if is_local { "Ollama" } else { "OpenAI" });

    // 净化 base64 图片 (如果有截图)
    let clean_screenshot = if let Some(ref img) = screenshot {
        match sanitize_base64_image(img) {
            Ok(clean) => Some(clean),
            Err(e) => {
                log::error!("❌ 图片格式校验失败: {}", e);
                return Err(anyhow::anyhow!("图片格式无效,请重新截图"));
            }
        }
    } else {
        None
    };

    // 调用 API (带重试)
    for attempt in 1..=3 {
        log::info!("🔄 尝试调用 LLM API (第 {}/3 次)", attempt);

        let result = if is_local {
            // 使用 Ollama 原生客户端
            let client = match OllamaClient::new(multimodal_config.clone()) {
                Ok(c) => c,
                Err(e) => {
                    log::error!("❌ 创建 Ollama 客户端失败: {}", e);
                    if attempt < 3 {
                        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
                        continue;
                    }
                    log::warn!("   回退到 Mock 实现");
                    return mock_llm_fallback(user_prompt);
                }
            };

            if let Some(ref img) = clean_screenshot {
                client.chat_with_vision(system_prompt, user_prompt, img).await
            } else {
                client.chat(system_prompt, user_prompt).await
            }
        } else {
            // 使用 OpenAI 客户端
            let client = match OpenAIClient::new(multimodal_config.clone()) {
                Ok(c) => c,
                Err(e) => {
                    log::error!("❌ 创建 OpenAI 客户端失败: {}", e);
                    if attempt < 3 {
                        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
                        continue;
                    }
                    log::warn!("   回退到 Mock 实现");
                    return mock_llm_fallback(user_prompt);
                }
            };

            if let Some(ref img) = clean_screenshot {
                client.chat_with_vision(system_prompt, user_prompt, img).await
            } else {
                client.chat(system_prompt, user_prompt).await
            }
        };

        match result {
            Ok(content) => {
                log::info!("✅ LLM API 调用成功");
                return Ok(content);
            }
            Err(e) => {
                log::warn!("⚠️  第 {} 次调用失败: {}", attempt, e);
                if attempt < 3 {
                    // 指数退避
                    let delay_ms = 1000 * (2_u64.pow(attempt - 1));
                    log::info!("   等待 {}ms 后重试...", delay_ms);
                    tokio::time::sleep(tokio::time::Duration::from_millis(delay_ms)).await;
                } else {
                    log::error!("❌ LLM API 调用失败 (已重试 3 次): {}", e);
                    log::warn!("   回退到 Mock 实现");
                    return mock_llm_fallback(user_prompt);
                }
            }
        }
    }

    // 理论上不会到达这里
    mock_llm_fallback(user_prompt)
}

/// Mock LLM 回退实现
fn mock_llm_fallback(user_prompt: &str) -> Result<String> {
    log::info!("⚠️  使用 Mock LLM 回退实现");

    let mut response = String::new();
    
    // 添加语音播报专用标记 (前端会识别并简化播报内容)
    response.push_str("[TTS_SIMPLE]对话失败，请检查 API 配置。[/TTS_SIMPLE]\n\n");
    
    // 详细信息用于屏幕显示
    response.push_str("## ⚠️  AI API 未配置或调用失败\n\n");
    response.push_str("当前使用的是 Mock AI 实现,无法提供智能对话。\n\n");
    response.push_str("**如何启用真实 AI:**\n\n");
    response.push_str("1. 在设置页面配置 OpenAI API Key 或 Ollama 模型\n");
    response.push_str("2. 选择合适的模型 (推荐: gpt-4o-mini 或 llava)\n");
    response.push_str("3. 保存设置后重新发送消息\n\n");
    response.push_str("---\n\n");
    response.push_str(&format!("**您的问题:** {}\n", user_prompt));

    Ok(response)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_mock_fallback() {
        let result = mock_llm_fallback("测试问题");
        assert!(result.is_ok());
        let content = result.unwrap();
        assert!(content.contains("Mock AI"));
    }
}
