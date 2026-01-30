use crate::rag::{build_rag_context, build_prompt, AIResponse, WikiReference};
use anyhow::Result;

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
    let context = build_rag_context(&game_id, &message, screenshot).await?;

    // 2. 构建 Prompt
    let game_name = get_game_name(&game_id);
    let (system_prompt, user_prompt) = build_prompt(&game_name, &message, &context);

    log::info!("📝 Prompt 构建完成");
    log::debug!("系统 Prompt:\n{}", system_prompt);
    log::debug!("用户 Prompt:\n{}", user_prompt);

    // 3. 调用 LLM (目前是 Mock 实现,Day 16 会集成真实 API)
    let ai_content = mock_llm_call(&system_prompt, &user_prompt, &context).await?;

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

/// Mock LLM 调用 (临时实现)
/// Day 16 会替换为真实的 OpenAI API 调用
async fn mock_llm_call(
    _system_prompt: &str,
    user_prompt: &str,
    context: &crate::rag::RAGContext,
) -> Result<String> {
    log::info!("⚠️  使用 Mock LLM (临时实现)");

    // 模拟 AI 回复
    let mut response = String::new();

    if !context.wiki_entries.is_empty() {
        response.push_str("## 📚 知识库检索结果\n\n");
        response.push_str(&format!(
            "我在知识库中找到了 {} 条相关信息:\n\n",
            context.wiki_entries.len()
        ));

        for (i, entry) in context.wiki_entries.iter().enumerate() {
            response.push_str(&format!(
                "**{}. {}** (相关度: {:.1}%)\n\n{}\n\n",
                i + 1,
                entry.title,
                entry.score * 100.0,
                &entry.content[..entry.content.len().min(200)]
            ));
        }

        response.push_str("\n---\n\n");
        response.push_str("💡 **建议:**\n\n");
        response.push_str("根据以上知识库内容,你可以参考这些信息来解决问题。\n\n");
    } else {
        response.push_str("## ⚠️  知识库未找到相关信息\n\n");
        response.push_str("抱歉,我在知识库中没有找到相关信息。\n\n");
        response.push_str("请尝试:\n");
        response.push_str("1. 更换关键词重新提问\n");
        response.push_str("2. 在 Wiki 知识库页面导入更多数据\n");
        response.push_str("3. 提供游戏截图以获得更精准的建议\n");
    }

    if context.screenshot.is_some() {
        response.push_str("\n📸 **已分析截图** (需要真实 AI 视觉模型)\n");
    }

    response.push_str("\n---\n\n");
    response.push_str("🔧 **提示:** 当前使用的是 Mock AI 实现\n");
    response.push_str("请在 Day 16 集成真实的 GPT-4 Vision API 后,获得智能对话体验。\n\n");
    response.push_str(&format!("**您的问题:** {}\n", user_prompt));

    Ok(response)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_mock_llm() {
        let context = crate::rag::RAGContext {
            screenshot: None,
            game_state: serde_json::json!({}),
            wiki_entries: vec![],
        };

        let result = mock_llm_call("system", "user question", &context).await;
        assert!(result.is_ok());
        assert!(result.unwrap().contains("Mock"));
    }
}
