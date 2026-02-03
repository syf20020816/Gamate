use anyhow::Result;
use serde::{Deserialize, Serialize};
use crate::commands::vector_commands::search_wiki_impl;

/// RAG 上下文结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RAGContext {
    pub screenshot: Option<String>,
    pub game_state: serde_json::Value,
    pub wiki_entries: Vec<WikiReference>,
}

/// Wiki 引用
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WikiReference {
    pub title: String,
    pub content: String,
    pub score: f32,
    pub url: Option<String>,
}

/// AI 响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIResponse {
    pub content: String,
    pub wiki_references: Option<Vec<WikiReference>>,
}

/// 构建 RAG 上下文
pub async fn build_rag_context(
    game_id: &str,
    query: &str,
    screenshot: Option<String>,
) -> Result<RAGContext> {
    log::info!("🔍 构建 RAG 上下文");
    log::info!("   游戏: {}", game_id);
    log::info!("   查询: {}", query);

    // 1. 提取查询关键词
    let extracted_query = extract_query_keywords(query);
    log::info!("   提取关键词: {}", extracted_query);

    // 2. 向量检索 Wiki
    let search_results = search_wiki_impl(extracted_query.clone(), game_id.to_string(), Some(3))
        .await
        .unwrap_or_else(|e| {
            log::warn!("向量检索失败: {}", e);
            vec![]
        });

    // 3. 转换为 WikiReference
    let wiki_entries: Vec<WikiReference> = search_results
        .into_iter()
        .map(|result| WikiReference {
            title: result.title,
            content: result.content,
            score: result.score,
            url: Some(result.url),
        })
        .collect();

    log::info!("✅ 检索到 {} 条 Wiki 条目", wiki_entries.len());

    // 4. 构建上下文
    let context = RAGContext {
        screenshot,
        game_state: serde_json::json!({}), // TODO: 后续可以从截图中提取游戏状态
        wiki_entries,
    };

    Ok(context)
}

/// 提取查询关键词
/// 将用户消息转换为适合向量检索的查询
pub fn extract_query_keywords(user_message: &str) -> String {
    // 简单的关键词提取逻辑
    // TODO: 后续可以使用更复杂的 NLP 方法

    let message = user_message.to_lowercase();

    // 移除常见的问句词
    let stop_words = [
        "怎么", "如何", "什么", "哪些", "为什么", "吗", "呢", "啊",
        "这个", "那个", "的", "是", "在", "有", "能", "会", "要",
    ];

    let mut keywords: Vec<&str> = message
        .split_whitespace()
        .filter(|word| !stop_words.contains(word))
        .collect();

    // 如果没有关键词,返回原文
    if keywords.is_empty() {
        return user_message.to_string();
    }

    // 添加常见的游戏相关扩展词
    if message.contains("boss") || message.contains("怪物") || message.contains("敌人") {
        keywords.push("攻略");
        keywords.push("技巧");
    }

    if message.contains("武器") || message.contains("装备") {
        keywords.push("属性");
        keywords.push("获取");
    }

    keywords.join(" ")
}

/// 构建 Prompt
pub fn build_prompt(
    game_name: &str,
    user_message: &str,
    context: &RAGContext,
) -> (String, String) {
    // 加载角色配置
    let settings = crate::settings::AppSettings::load()
        .unwrap_or_else(|e| {
            log::warn!("⚠️  加载设置失败: {}, 使用默认配置", e);
            crate::settings::AppSettings::default()
        });
    
    let personality_type = &settings.ai_models.ai_personality;
    
    // 加载 personality 配置并构建系统提示词
    let system_prompt = match crate::personality::load_personality(personality_type) {
        Ok(config) => {
            log::info!("✅ 使用角色: {} ({})", config.character.name_cn, config.character.name_en);
            crate::personality::build_system_prompt(&config, game_name)
        }
        Err(e) => {
            log::warn!("⚠️  加载角色配置失败: {}, 使用默认提示词", e);
            // 回退到默认提示词
            format!(
                r#"你是一个专业的《{}》游戏陪玩 AI 助手。你的任务是:

1. 根据用户的问题,结合提供的游戏 Wiki 知识库,给出准确、有帮助的建议
2. 如果用户提供了游戏截图,分析截图中的游戏状态
3. 回复要简洁明了,重点突出,使用 Markdown 格式
4. 如果 Wiki 中没有相关信息,诚实告知,不要编造内容
5. 保持友好、鼓励的语气,像一个有经验的游戏伙伴

注意事项:
- 优先使用 Wiki 知识库中的信息
- 如果截图提供了额外信息,结合截图给出更精准的建议
- 回复控制在 200 字以内,除非需要详细解释
"#,
                game_name
            )
        }
    };

    // 用户 Prompt
    let mut user_prompt = String::new();

    // 添加 Wiki 上下文
    if !context.wiki_entries.is_empty() {
        user_prompt.push_str("**参考知识库:**\n\n");
        for (i, entry) in context.wiki_entries.iter().enumerate() {
            user_prompt.push_str(&format!(
                "{}. **{}** (相关度: {:.1}%)\n{}\n\n",
                i + 1,
                entry.title,
                entry.score * 100.0,
                &entry.content[..entry.content.len().min(300)]
            ));
        }
    } else {
        user_prompt.push_str("**知识库:** 暂无相关信息\n\n");
    }

    // 添加截图信息
    if context.screenshot.is_some() {
        user_prompt.push_str("**游戏截图:** 已提供 (请分析截图内容)\n\n");
    }

    // 添加用户问题
    user_prompt.push_str(&format!("**用户问题:** {}\n\n", user_message));
    user_prompt.push_str("请根据以上信息,给出你的建议:");

    (system_prompt, user_prompt)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_keywords() {
        let query1 = "这个Boss怎么打?";
        let result1 = extract_query_keywords(query1);
        assert!(result1.contains("boss") || result1.contains("Boss"));

        let query2 = "火焰武器在哪里获取";
        let result2 = extract_query_keywords(query2);
        assert!(result2.contains("火焰") || result2.contains("武器"));
    }

    #[test]
    fn test_build_prompt() {
        let context = RAGContext {
            screenshot: None,
            game_state: serde_json::json!({}),
            wiki_entries: vec![WikiReference {
                title: "测试条目".to_string(),
                content: "测试内容".to_string(),
                score: 0.95,
                url: None,
            }],
        };

        let (system_prompt, user_prompt) = build_prompt("测试游戏", "测试问题", &context);

        assert!(system_prompt.contains("测试游戏"));
        assert!(user_prompt.contains("测试问题"));
        assert!(user_prompt.contains("测试条目"));
    }
}
