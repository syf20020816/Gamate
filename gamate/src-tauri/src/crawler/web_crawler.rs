use crate::crawler::types::*;
use crate::crawler::utils::*;
use reqwest::Client;
use scraper::{Html, Selector};
use std::collections::{HashSet, VecDeque};
use std::fs;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tokio::time::sleep;
use url::Url;

pub struct WebCrawler {
    config: CrawlerConfig,
    client: Client,
    visited_urls: HashSet<String>,
    entries: Vec<WikiEntry>,
}

impl WebCrawler {
    pub fn new(config: CrawlerConfig) -> Self {
        // 使用更真实的 User-Agent 来避免反爬虫
        let user_agent = if config.user_agent.contains("Mozilla") {
            config.user_agent.clone()
        } else {
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36".to_string()
        };

        // 构建更完整的 Headers 模拟真实浏览器
        let mut headers = reqwest::header::HeaderMap::new();
        headers.insert(
            reqwest::header::ACCEPT,
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"
                .parse()
                .unwrap(),
        );
        headers.insert(
            reqwest::header::ACCEPT_LANGUAGE,
            "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7".parse().unwrap(),
        );
        headers.insert(
            reqwest::header::ACCEPT_ENCODING,
            "gzip, deflate, br".parse().unwrap(),
        );
        headers.insert(reqwest::header::DNT, "1".parse().unwrap());
        headers.insert(reqwest::header::CONNECTION, "keep-alive".parse().unwrap());
        headers.insert(
            reqwest::header::UPGRADE_INSECURE_REQUESTS,
            "1".parse().unwrap(),
        );
        headers.insert("Sec-Fetch-Dest", "document".parse().unwrap());
        headers.insert("Sec-Fetch-Mode", "navigate".parse().unwrap());
        headers.insert("Sec-Fetch-Site", "none".parse().unwrap());
        headers.insert("Sec-Fetch-User", "?1".parse().unwrap());

        let client = Client::builder()
            .user_agent(user_agent)
            .default_headers(headers)
            .timeout(Duration::from_secs(30))
            .redirect(reqwest::redirect::Policy::limited(10))
            .build()
            .unwrap();

        Self {
            config,
            client,
            visited_urls: HashSet::new(),
            entries: Vec::new(),
        }
    }

    /// 开始爬取
    pub async fn crawl(&mut self) -> CrawlerResult2<CrawlerResult> {
        let start = Instant::now();
        let mut error_count = 0;
        let mut details = Vec::new();

        log::info!("开始爬取 Wiki: {}", self.config.source_url);
        details.push(format!("起始 URL: {}", self.config.source_url));

        // BFS 爬取
        let mut queue = VecDeque::new();
        queue.push_back((self.config.source_url.clone(), 0)); // (url, depth)

        while let Some((url, depth)) = queue.pop_front() {
            // 检查是否超过限制
            if self.entries.len() >= self.config.max_pages {
                log::warn!("达到最大页面数限制: {}", self.config.max_pages);
                details.push("达到最大页面数限制".to_string());
                break;
            }

            if depth > self.config.max_depth {
                continue;
            }

            // 跳过已访问的 URL
            let normalized_url = normalize_url(&url);
            if self.visited_urls.contains(&normalized_url) {
                continue;
            }

            self.visited_urls.insert(normalized_url.clone());

            // 爬取页面
            match self.crawl_page(&url).await {
                Ok((entry, links)) => {
                    log::info!("成功爬取: {} (深度: {})", entry.title, depth);
                    self.entries.push(entry);

                    // 将新链接加入队列
                    for link in links {
                        if !self.visited_urls.contains(&normalize_url(&link)) {
                            queue.push_back((link, depth + 1));
                        }
                    }
                }
                Err(e) => {
                    log::error!("爬取失败 {}: {}", url, e);
                    error_count += 1;
                }
            }

            // 延迟，避免过快请求
            sleep(Duration::from_millis(self.config.request_delay_ms)).await;
        }

        // 保存结果
        let total_bytes = self.save_entries()?;
        let duration_secs = start.elapsed().as_secs();

        log::info!(
            "爬取完成: {} 条目, {} 字节, {} 秒",
            self.entries.len(),
            total_bytes,
            duration_secs
        );

        details.push(format!("总条目数: {}", self.entries.len()));
        details.push(format!("总字节数: {}", total_bytes));
        details.push(format!("耗时: {} 秒", duration_secs));
        details.push(format!("错误数: {}", error_count));

        Ok(CrawlerResult {
            total_entries: self.entries.len(),
            total_bytes,
            duration_secs,
            error_count,
            storage_path: self.config.storage_path.to_string_lossy().to_string(),
            details,
        })
    }

    /// 爬取单个页面
    async fn crawl_page(&self, url: &str) -> CrawlerResult2<(WikiEntry, Vec<String>)> {
        // 发送 HTTP 请求，添加 Referer 模拟真实浏览行为
        let mut request = self.client.get(url);

        // 添加 Referer（如果不是首页）
        if url != self.config.source_url {
            request = request.header(reqwest::header::REFERER, self.config.source_url.clone());
        }

        let response = request.send().await?;

        if !response.status().is_success() {
            return Err(CrawlerError::HttpError(reqwest::Error::from(
                response.error_for_status().unwrap_err(),
            )));
        }

        let html = response.text().await?;
        let document = Html::parse_document(&html);

        // 提取标题
        let title = self.extract_title(&document, url);

        // 提取正文内容
        let content = self.extract_content(&document)?;

        // 提取分类
        let categories = self.extract_categories(&document);

        // 提取内部链接
        let links = self.extract_links(&document, url)?;

        // 计算哈希
        let hash = calculate_hash(&content);

        // 生成时间戳
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let entry = WikiEntry {
            id: format!("{}_{}", self.config.game_id, hash),
            title,
            content: clean_html_text(&content),
            url: url.to_string(),
            timestamp,
            hash,
            categories,
            metadata: WikiMetadata {
                length: content.len(),
                last_modified: None,
                author: None,
                language: "zh".to_string(),
            },
        };

        Ok((entry, links))
    }

    /// 提取标题
    fn extract_title(&self, document: &Html, url: &str) -> String {
        // 尝试多种选择器
        let selectors = [
            "h1.page-header__title",
            "h1.firstHeading",
            "h1#firstHeading",
            "h1",
            "title",
        ];

        for selector_str in &selectors {
            if let Ok(selector) = Selector::parse(selector_str) {
                if let Some(element) = document.select(&selector).next() {
                    let title = element.text().collect::<String>();
                    if !title.is_empty() {
                        return clean_html_text(&title);
                    }
                }
            }
        }

        // 后备方案：从 URL 提取
        url.split('/').last().unwrap_or("Unknown").to_string()
    }

    /// 提取正文内容
    fn extract_content(&self, document: &Html) -> CrawlerResult2<String> {
        // Fandom Wiki 内容选择器
        let content_selectors = match self.config.source_type {
            WikiSourceType::FandomWiki => vec![
                "div.mw-parser-output",
                "div#mw-content-text",
                "div.page-content",
                "main",
                "article",
            ],
            WikiSourceType::GamepediaWiki => {
                vec!["div.mw-parser-output", "div#bodyContent", "main"]
            }
            _ => vec!["main", "article", "div.content"],
        };

        for selector_str in content_selectors {
            if let Ok(selector) = Selector::parse(selector_str) {
                if let Some(element) = document.select(&selector).next() {
                    let mut content = String::new();

                    // 提取段落
                    if let Ok(p_selector) = Selector::parse("p, h2, h3, ul, ol, table") {
                        for elem in element.select(&p_selector) {
                            let text = elem.text().collect::<String>();
                            if !text.trim().is_empty() {
                                content.push_str(&text);
                                content.push('\n');
                            }
                        }
                    }

                    if !content.is_empty() {
                        return Ok(content);
                    }
                }
            }
        }

        Err(CrawlerError::ParseError("无法提取页面内容".to_string()))
    }

    /// 提取分类
    fn extract_categories(&self, document: &Html) -> Vec<String> {
        let mut categories = Vec::new();

        if let Ok(selector) = Selector::parse("div.page-header__categories a, .category a") {
            for element in document.select(&selector) {
                let category = element.text().collect::<String>();
                categories.push(clean_html_text(&category));
            }
        }

        categories
    }

    /// 提取内部链接
    fn extract_links(&self, document: &Html, _current_url: &str) -> CrawlerResult2<Vec<String>> {
        let mut links = Vec::new();
        let base_url = Url::parse(&self.config.source_url)
            .map_err(|e| CrawlerError::InvalidUrl(e.to_string()))?;

        if let Ok(selector) = Selector::parse("a[href]") {
            for element in document.select(&selector) {
                if let Some(href) = element.value().attr("href") {
                    // 解析相对 URL
                    if let Ok(absolute_url) = base_url.join(href) {
                        let url_str = absolute_url.to_string();

                        // 过滤规则
                        if self.is_valid_wiki_link(&url_str) {
                            links.push(url_str);
                        }
                    }
                }
            }
        }

        Ok(links)
    }

    /// 判断是否为有效的 Wiki 链接
    fn is_valid_wiki_link(&self, url: &str) -> bool {
        // 排除特殊页面
        let exclude_patterns = [
            "/Special:",
            "/File:",
            "/Category:",
            "/Template:",
            "/Help:",
            "/User:",
            "action=edit",
            "action=history",
            ".jpg",
            ".png",
            ".gif",
            ".pdf",
        ];

        for pattern in &exclude_patterns {
            if url.contains(pattern) {
                return false;
            }
        }

        // 必须是内部链接
        is_internal_link(&self.config.source_url, url)
    }

    /// 保存条目到文件
    fn save_entries(&self) -> CrawlerResult2<usize> {
        // 确保目录存在
        fs::create_dir_all(&self.config.storage_path)?;

        // 保存为 JSON Lines 格式（每行一个 JSON 对象）
        let file_path = self.config.storage_path.join("wiki_raw.jsonl");
        let mut total_bytes = 0;

        let mut file_content = String::new();
        for entry in &self.entries {
            let json =
                serde_json::to_string(entry).map_err(|e| CrawlerError::Other(e.to_string()))?;
            file_content.push_str(&json);
            file_content.push('\n');
            total_bytes += json.len() + 1;
        }

        fs::write(&file_path, file_content)?;

        // 保存元数据
        let metadata = serde_json::json!({
            "game_id": self.config.game_id,
            "source_url": self.config.source_url,
            "source_type": self.config.source_type,
            "timestamp": self.config.timestamp,
            "total_entries": self.entries.len(),
            "total_bytes": total_bytes,
        });

        let metadata_path = self.config.storage_path.join("metadata.json");
        fs::write(
            &metadata_path,
            serde_json::to_string_pretty(&metadata)
                .map_err(|e| CrawlerError::Other(e.to_string()))?,
        )?;

        Ok(total_bytes)
    }
}
