use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// AI 直接检索（不使用向量数据库）
pub struct AIDirectSearch {
    storage_path: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WikiEntry {
    pub title: String,
    pub content: String,
    pub url: String,
}

impl AIDirectSearch {
    pub fn new(storage_path: PathBuf) -> Self {
        Self { storage_path }
    }

    /// 加载 JSONL 文件
    pub fn load_wiki_entries(&self, game_id: &str) -> Result<Vec<WikiEntry>> {
        let jsonl_path = self.storage_path.join(format!("{}.jsonl", game_id));
        
        log::info!("🔍 AI 直接搜索: 尝试加载文件 {:?}", jsonl_path);
        
        if !jsonl_path.exists() {
            log::warn!("⚠️ JSONL 文件不存在: {:?}", jsonl_path);
            return Ok(Vec::new());
        }

        let content = std::fs::read_to_string(&jsonl_path)?;
        log::info!("📄 文件大小: {} 字节, 行数: {}", content.len(), content.lines().count());
        
        let entries: Vec<WikiEntry> = content
            .lines()
            .filter(|line| !line.trim().is_empty())
            .filter_map(|line| {
                match serde_json::from_str::<WikiEntry>(line) {
                    Ok(entry) => Some(entry),
                    Err(e) => {
                        log::debug!("解析 JSON 行失败: {}, 内容: {}", e, &line[..line.len().min(100)]);
                        None
                    }
                }
            })
            .collect();

        log::info!("✅ 成功加载 {} 条 Wiki 条目", entries.len());
        Ok(entries)
    }

    /// 使用 AI 进行检索（简化版：关键词匹配 + 文本相似度）
    /// 注意：这是一个简化实现，真正的 AI 检索需要调用 LLM
    pub fn search(&self, query: &str, game_id: &str, limit: usize) -> Result<Vec<SearchResult>> {
        let entries = self.load_wiki_entries(game_id)?;
        
        if entries.is_empty() {
            log::warn!("⚠️ 没有可搜索的条目");
            return Ok(Vec::new());
        }

        log::info!("🔍 开始搜索: query='{}', 条目数={}", query, entries.len());
        
        let query_lower = query.to_lowercase();
        let query_words: Vec<&str> = query_lower.split_whitespace().collect();
        
        log::debug!("查询词: {:?}", query_words);

        // 计算每个条目的相关性分数
        let mut scored_entries: Vec<(f32, WikiEntry)> = entries
            .into_iter()
            .map(|entry| {
                let score = calculate_relevance_score(&entry, &query_lower, &query_words);
                if score > 0.0 {
                    log::debug!("匹配: '{}' 分数={}", entry.title, score);
                }
                (score, entry)
            })
            .filter(|(score, _)| *score > 0.0)
            .collect();

        log::info!("✅ 找到 {} 个相关条目", scored_entries.len());

        // 按分数降序排序
        scored_entries.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));

        // 返回前 limit 个结果
        Ok(scored_entries
            .into_iter()
            .take(limit)
            .map(|(score, entry)| SearchResult {
                score,
                title: entry.title,
                content: entry.content,
                url: entry.url,
            })
            .collect())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub score: f32,
    pub title: String,
    pub content: String,
    pub url: String,
}

/// 计算文本相关性分数（简化算法）
/// 返回 0.0-1.0 之间的分数
fn calculate_relevance_score(entry: &WikiEntry, query_lower: &str, query_words: &[&str]) -> f32 {
    let title_lower = entry.title.to_lowercase();
    let content_lower = entry.content.to_lowercase();

    let mut score = 0.0;
    let mut max_possible_score = 0.0;

    // 1. 完全匹配查询字符串（最高权重）
    max_possible_score += 15.0;
    if title_lower.contains(query_lower) {
        score += 10.0;
    }
    if content_lower.contains(query_lower) {
        score += 5.0;
    }

    // 2. 标题包含查询词（高权重）
    for word in query_words {
        max_possible_score += 3.0;
        if title_lower.contains(word) {
            score += 3.0;
        }
    }

    // 3. 内容包含查询词（中权重）
    // 限制最多计数 10 次,避免分数过高
    for word in query_words {
        let count = content_lower.matches(word).count().min(10);
        max_possible_score += 5.0; // 每个词最多 5 分 (10次 * 0.5)
        score += count as f32 * 0.5;
    }

    // 归一化到 0.0-1.0
    if max_possible_score > 0.0 {
        let normalized_score = (score / max_possible_score).min(1.0);
        
        // 4. 标题越短，相关性越高（轻微加分，最多 +10%）
        if normalized_score > 0.0 {
            let title_len_penalty = (entry.title.len() as f32 / 100.0).min(1.0);
            let bonus = (1.0 - title_len_penalty) * 0.1;
            return (normalized_score + bonus).min(1.0);
        }
        normalized_score
    } else {
        0.0
    }
}
