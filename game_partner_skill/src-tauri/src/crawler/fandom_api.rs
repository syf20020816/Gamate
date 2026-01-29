use crate::crawler::types::*;
use crate::crawler::utils::*;
use reqwest::Client;
use serde::Deserialize;
use std::time::{SystemTime, UNIX_EPOCH};

/// Fandom MediaWiki API 响应
#[derive(Debug, Deserialize)]
struct ApiResponse {
    query: Option<QueryResponse>,
}

#[derive(Debug, Deserialize)]
struct QueryResponse {
    pages: std::collections::HashMap<String, PageData>,
}

#[derive(Debug, Deserialize)]
struct PageData {
    pageid: u64,
    title: String,
    revisions: Option<Vec<RevisionData>>,
    categories: Option<Vec<CategoryData>>,
}

#[derive(Debug, Deserialize)]
struct RevisionData {
    #[serde(rename = "*")]
    content: Option<String>,
    slots: Option<Slots>,
}

#[derive(Debug, Deserialize)]
struct Slots {
    main: Option<MainSlot>,
}

#[derive(Debug, Deserialize)]
struct MainSlot {
    #[serde(rename = "*")]
    content: String,
}

#[derive(Debug, Deserialize)]
struct CategoryData {
    title: String,
}

/// Fandom API 爬虫
pub struct FandomApiCrawler {
    config: CrawlerConfig,
    client: Client,
    entries: Vec<WikiEntry>,
}

impl FandomApiCrawler {
    pub fn new(config: CrawlerConfig) -> Self {
        let client = Client::builder()
            .user_agent("GamePartnerSkill/1.0 (https://github.com/your-repo)")
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .unwrap();

        Self {
            config,
            client,
            entries: Vec::new(),
        }
    }

    /// 开始爬取
    pub async fn crawl(&mut self) -> CrawlerResult2<CrawlerResult> {
        let start = std::time::Instant::now();
        let mut details = Vec::new();

        log::info!("🚀 开始使用 Fandom API 爬取: {}", self.config.source_url);

        // 从 URL 提取 wiki 基础地址
        // 例如: https://phasmophobia.fandom.com/wiki/ -> https://phasmophobia.fandom.com/api.php
        let api_url = self.config.source_url
            .replace("/wiki/", "/api.php");
        
        log::info!("📡 API URL: {}", api_url);
        log::info!("⚙️  最大页面数: {}", self.config.max_pages);

        // 1. 获取所有页面列表
        log::info!("📋 正在获取页面列表...");
        let page_titles = self.fetch_all_pages(&api_url).await?;
        log::info!("✅ 找到 {} 个页面", page_titles.len());
        
        if page_titles.is_empty() {
            log::error!("❌ 未找到任何页面！");
            log::error!("   请检查:");
            log::error!("   1. source_url: {}", self.config.source_url);
            log::error!("   2. api_url: {}", api_url);
            log::error!("   3. 网络连接是否正常");
            return Ok(CrawlerResult {
                total_entries: 0,
                total_bytes: 0,
                duration_secs: start.elapsed().as_secs(),
                error_count: 0,
                storage_path: self.config.storage_path.to_string_lossy().to_string(),
                details: vec!["错误: 未找到任何页面".to_string()],
            });
        }
        
        details.push(format!("总页面数: {}", page_titles.len()));

        // 2. 批量获取页面内容
        let max_pages = self.config.max_pages.min(page_titles.len());
        log::info!("📄 正在获取 {} 个页面的内容（共{}个）...", max_pages, page_titles.len());
        
        for (i, chunk) in page_titles[..max_pages].chunks(50).enumerate() {
            log::info!("   批次 {}: 获取 {} 个页面...", i + 1, chunk.len());
            self.fetch_pages_content(&api_url, chunk).await?;
            log::info!("   批次 {} 完成，当前共 {} 个条目", i + 1, self.entries.len());
            
            // 延迟避免限流
            tokio::time::sleep(std::time::Duration::from_millis(self.config.request_delay_ms)).await;
        }

        // 保存结果
        log::info!("💾 正在保存 {} 个条目到文件...", self.entries.len());
        let total_bytes = self.save_entries()?;
        let duration_secs = start.elapsed().as_secs();

        log::info!(
            "🎉 爬取完成: {} 条目, {} 字节, {} 秒",
            self.entries.len(),
            total_bytes,
            duration_secs
        );

        details.push(format!("成功条目数: {}", self.entries.len()));
        details.push(format!("总字节数: {}", total_bytes));
        details.push(format!("耗时: {} 秒", duration_secs));

        Ok(CrawlerResult {
            total_entries: self.entries.len(),
            total_bytes,
            duration_secs,
            error_count: 0,
            storage_path: self.config.storage_path.to_string_lossy().to_string(),
            details,
        })
    }

    /// 获取所有页面标题
    async fn fetch_all_pages(&self, api_url: &str) -> CrawlerResult2<Vec<String>> {
        let mut all_titles = Vec::new();
        let mut continue_token: Option<String> = None;

        log::info!("正在从 {} 获取页面列表...", api_url);

        loop {
            let mut params = vec![
                ("action", "query"),
                ("format", "json"),
                ("list", "allpages"),
                ("aplimit", "500"), // 每次获取500个
                ("apnamespace", "0"), // 只要主命名空间（文章）
            ];

            if let Some(ref token) = continue_token {
                params.push(("apcontinue", token));
            }

            let response = self.client
                .get(api_url)
                .query(&params)
                .send()
                .await?;

            let status = response.status();
            log::info!("API 响应状态: {}", status);

            if !status.is_success() {
                log::error!("API 返回错误状态: {}", status);
                return Err(CrawlerError::HttpError(
                    reqwest::Error::from(response.error_for_status().unwrap_err()),
                ));
            }

            let json: serde_json::Value = response.json().await?;
            
            // 调试：打印响应结构
            log::debug!("API 响应: {}", serde_json::to_string_pretty(&json).unwrap_or_default());

            // 提取页面标题
            if let Some(pages) = json["query"]["allpages"].as_array() {
                log::info!("本次获取 {} 个页面", pages.len());
                for page in pages {
                    if let Some(title) = page["title"].as_str() {
                        all_titles.push(title.to_string());
                    }
                }
            } else {
                log::warn!("未找到 query.allpages 字段");
                log::debug!("响应结构: {:?}", json);
            }

            // 检查是否有更多页面
            if let Some(continue_obj) = json["continue"].as_object() {
                if let Some(token) = continue_obj["apcontinue"].as_str() {
                    continue_token = Some(token.to_string());
                    log::info!("已获取 {} 个页面标题，继续...", all_titles.len());
                } else {
                    break;
                }
            } else {
                break;
            }
        }

        log::info!("总共获取 {} 个页面标题", all_titles.len());
        Ok(all_titles)
    }

    /// 批量获取页面内容
    async fn fetch_pages_content(&mut self, api_url: &str, titles: &[String]) -> CrawlerResult2<()> {
        let titles_str = titles.join("|");
        
        log::info!("获取 {} 个页面的内容...", titles.len());

        // 修改：使用 revisions 而不是 extracts
        let params = vec![
            ("action", "query"),
            ("format", "json"),
            ("prop", "revisions|categories"),
            ("titles", &titles_str),
            ("rvprop", "content"), // 获取修订内容
            ("rvslots", "main"), // 获取主槽位
            ("cllimit", "50"), // 最多50个分类
            ("redirects", "1"), // 自动跟随重定向
        ];

        let response = self.client
            .get(api_url)
            .query(&params)
            .send()
            .await?;

        let status = response.status();
        log::info!("内容 API 响应状态: {}", status);

        if !status.is_success() {
            log::error!("内容 API 返回错误: {}", status);
            return Err(CrawlerError::HttpError(
                reqwest::Error::from(response.error_for_status().unwrap_err()),
            ));
        }

        // 先获取原始 JSON 来调试
        let json: serde_json::Value = response.json().await?;
        log::debug!("📝 原始 API 响应: {}", serde_json::to_string_pretty(&json).unwrap_or_default());
        
        // 尝试解析
        let api_response: ApiResponse = serde_json::from_value(json.clone())
            .map_err(|e| {
                log::error!("❌ 解析 API 响应失败: {}", e);
                log::error!("响应内容: {:?}", json);
                CrawlerError::Other(format!("解析失败: {}", e))
            })?;

        if let Some(query) = api_response.query {
            log::info!("收到 {} 个页面的数据", query.pages.len());
            
            let mut success_count = 0;
            let mut no_content_count = 0;
            
            for (page_id, page_data) in query.pages {
                log::debug!("处理页面: {} (ID: {})", page_data.title, page_id);
                
                // 从 revisions 中提取内容
                let content_opt = page_data.revisions
                    .and_then(|revisions| revisions.into_iter().next())
                    .and_then(|revision| {
                        // 优先使用 slots.main.content
                        if let Some(slots) = revision.slots {
                            if let Some(main) = slots.main {
                                return Some(main.content);
                            }
                        }
                        // 降级：使用旧格式的 content
                        revision.content
                    });
                
                if let Some(raw_content) = content_opt {
                    if raw_content.trim().is_empty() {
                        log::warn!("页面 {} 的内容为空", page_data.title);
                        no_content_count += 1;
                        continue;
                    }
                    
                    let categories = page_data.categories
                        .unwrap_or_default()
                        .iter()
                        .map(|c| c.title.replace("Category:", ""))
                        .collect();

                    // 清理 Wiki 标记语法
                    let content = clean_wiki_markup(&raw_content);
                    let hash = calculate_hash(&content);
                    let timestamp = SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap()
                        .as_secs();

                    let entry = WikiEntry {
                        id: format!("{}_{}", self.config.game_id, hash),
                        title: page_data.title.clone(),
                        content,
                        url: format!("{}{}", self.config.source_url, page_data.title.replace(" ", "_")),
                        timestamp,
                        hash,
                        categories,
                        metadata: WikiMetadata {
                            length: raw_content.len(),
                            last_modified: None,
                            author: None,
                            language: "en".to_string(),
                        },
                    };

                    self.entries.push(entry);
                    success_count += 1;
                    log::debug!("✅ 成功添加条目: {}", page_data.title);
                } else {
                    log::warn!("⚠️  页面 {} 没有内容（可能是重定向或特殊页面）", page_data.title);
                    no_content_count += 1;
                }
            }
            
            log::info!("📊 本批次: 成功 {} 个，无内容 {} 个", success_count, no_content_count);
        } else {
            log::warn!("API 响应中没有 query 字段");
        }

        log::info!("当前已添加 {} 个条目", self.entries.len());
        Ok(())
    }

    /// 保存条目到文件
    fn save_entries(&self) -> CrawlerResult2<usize> {
        std::fs::create_dir_all(&self.config.storage_path)?;

        let file_path = self.config.storage_path.join("wiki_raw.jsonl");
        let mut total_bytes = 0;

        let mut file_content = String::new();
        for entry in &self.entries {
            let json = serde_json::to_string(entry)
                .map_err(|e| CrawlerError::Other(e.to_string()))?;
            file_content.push_str(&json);
            file_content.push('\n');
            total_bytes += json.len() + 1;
        }

        std::fs::write(&file_path, file_content)?;

        // 保存元数据
        let metadata = serde_json::json!({
            "game_id": self.config.game_id,
            "source_url": self.config.source_url,
            "source_type": "FandomAPI",
            "timestamp": self.config.timestamp,
            "total_entries": self.entries.len(),
            "total_bytes": total_bytes,
        });

        let metadata_path = self.config.storage_path.join("metadata.json");
        std::fs::write(
            &metadata_path,
            serde_json::to_string_pretty(&metadata)
                .map_err(|e| CrawlerError::Other(e.to_string()))?,
        )?;

        Ok(total_bytes)
    }
}
