use crate::crawler::types::*;
use crate::crawler::utils::*;
use octocrab::models::repos::Content;
use octocrab::Octocrab;
use std::fs;
use std::time::{Instant, SystemTime, UNIX_EPOCH};

pub struct GitHubCrawler {
    config: CrawlerConfig,
    client: Octocrab,
    entries: Vec<WikiEntry>,
}

impl GitHubCrawler {
    pub fn new(config: CrawlerConfig) -> CrawlerResult2<Self> {
        let mut builder = Octocrab::builder();

        if let Some(token) = &config.github_token {
            builder = builder.personal_token(token.clone());
        }

        let client = builder
            .build()
            .map_err(|e| CrawlerError::GitHubError(e.to_string()))?;

        Ok(Self {
            config,
            client,
            entries: Vec::new(),
        })
    }

    /// 开始爬取 GitHub Wiki/仓库
    pub async fn crawl(&mut self) -> CrawlerResult2<CrawlerResult> {
        let start = Instant::now();
        let mut details = Vec::new();

        log::info!("开始爬取 GitHub 仓库: {}", self.config.source_url);
        details.push(format!("GitHub URL: {}", self.config.source_url));

        // 解析 GitHub URL
        let (owner, repo) = self.parse_github_url(&self.config.source_url)?;
        details.push(format!("仓库: {}/{}", owner, repo));

        // 检查是否有 Wiki
        let has_wiki = self.check_wiki_exists(&owner, &repo).await?;

        if has_wiki {
            // 爬取 Wiki 页面
            log::info!("检测到 Wiki，开始爬取...");
            details.push("检测到 Wiki".to_string());
            self.crawl_wiki(&owner, &repo).await?;
        } else {
            // 爬取 README 和文档文件
            log::info!("未检测到 Wiki，爬取 README 和文档...");
            details.push("爬取 README 和文档文件".to_string());
            self.crawl_docs(&owner, &repo).await?;
        }

        // 保存结果
        let total_bytes = self.save_entries()?;
        let duration_secs = start.elapsed().as_secs();

        log::info!(
            "GitHub 爬取完成: {} 条目, {} 字节, {} 秒",
            self.entries.len(),
            total_bytes,
            duration_secs
        );

        details.push(format!("总条目数: {}", self.entries.len()));
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

    /// 解析 GitHub URL
    fn parse_github_url(&self, url: &str) -> CrawlerResult2<(String, String)> {
        // 支持格式: https://github.com/owner/repo
        let parts: Vec<&str> = url.trim_end_matches('/').split('/').collect();

        if parts.len() < 5 || parts[2] != "github.com" {
            return Err(CrawlerError::InvalidUrl(
                "无效的 GitHub URL 格式".to_string(),
            ));
        }

        Ok((parts[3].to_string(), parts[4].to_string()))
    }

    /// 检查仓库是否有 Wiki
    async fn check_wiki_exists(&self, owner: &str, repo: &str) -> CrawlerResult2<bool> {
        let repository = self
            .client
            .repos(owner, repo)
            .get()
            .await
            .map_err(|e| CrawlerError::GitHubError(e.to_string()))?;

        Ok(repository.has_wiki.unwrap_or(false))
    }

    /// 爬取 Wiki 页面
    async fn crawl_wiki(&mut self, owner: &str, repo: &str) -> CrawlerResult2<()> {
        // GitHub Wiki 通过 Git 克隆获取
        // 这里简化处理：使用 API 获取 Wiki 页面列表
        // 注意：GitHub API 不直接提供 Wiki 内容，需要通过 Git 克隆

        log::warn!("GitHub Wiki 爬取需要 Git 克隆，当前简化为爬取文档文件");
        self.crawl_docs(owner, repo).await
    }

    /// 爬取文档文件（README, docs/, wiki/ 等）
    async fn crawl_docs(&mut self, owner: &str, repo: &str) -> CrawlerResult2<()> {
        // 1. 爬取 README
        self.crawl_readme(owner, repo).await?;

        // 2. 爬取 docs 目录
        if let Ok(_) = self.crawl_directory(owner, repo, "docs").await {
            log::info!("成功爬取 docs 目录");
        }

        // 3. 爬取 wiki 目录（有些项目用这个）
        if let Ok(_) = self.crawl_directory(owner, repo, "wiki").await {
            log::info!("成功爬取 wiki 目录");
        }

        // 4. 爬取根目录的 .md 文件
        if let Ok(_) = self.crawl_markdown_files(owner, repo, "").await {
            log::info!("成功爬取根目录 Markdown 文件");
        }

        Ok(())
    }

    /// 爬取 README
    async fn crawl_readme(&mut self, owner: &str, repo: &str) -> CrawlerResult2<()> {
        let readme = self
            .client
            .repos(owner, repo)
            .get_readme()
            .send()
            .await
            .map_err(|e| CrawlerError::GitHubError(e.to_string()))?;

        if let Some(content) = readme.content {
            let decoded = self.decode_base64(&content)?;
            let entry = self.create_entry(
                "README",
                &decoded,
                &readme.html_url.unwrap_or_default(),
                vec!["README".to_string()],
            );
            self.entries.push(entry);
            log::info!("成功爬取 README");
        }

        Ok(())
    }

    /// 爬取指定目录
    fn crawl_directory<'a>(
        &'a mut self,
        owner: &'a str,
        repo: &'a str,
        path: &'a str,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = CrawlerResult2<()>> + Send + 'a>> {
        Box::pin(async move {
            let contents = self
                .client
                .repos(owner, repo)
                .get_content()
                .path(path)
                .send()
                .await
                .map_err(|e| CrawlerError::GitHubError(e.to_string()))?;

            for item in contents.items {
                if item.r#type == "file" && item.name.ends_with(".md") {
                    self.crawl_file(owner, repo, &item).await?;
                } else if item.r#type == "dir" && !item.path.is_empty() {
                    // 递归爬取子目录
                    self.crawl_directory(owner, repo, &item.path).await?;
                }
            }

            Ok(())
        })
    }

    /// 爬取单个文件
    async fn crawl_file(&mut self, owner: &str, repo: &str, item: &Content) -> CrawlerResult2<()> {
        if !item.path.is_empty() {
            let file = self
                .client
                .repos(owner, repo)
                .get_content()
                .path(&item.path)
                .send()
                .await
                .map_err(|e| CrawlerError::GitHubError(e.to_string()))?;

            if let Some(content) = file.items.first().and_then(|f| f.content.as_ref()) {
                let decoded = self.decode_base64(content)?;
                let entry = self.create_entry(
                    &item.name,
                    &decoded,
                    &item.html_url.clone().unwrap_or_default(),
                    vec!["Documentation".to_string()],
                );
                self.entries.push(entry);
                log::info!("成功爬取文件: {}", item.name);
            }
        }

        Ok(())
    }

    /// 爬取目录中的所有 Markdown 文件
    async fn crawl_markdown_files(
        &mut self,
        owner: &str,
        repo: &str,
        path: &str,
    ) -> CrawlerResult2<()> {
        let contents = self
            .client
            .repos(owner, repo)
            .get_content()
            .path(path)
            .send()
            .await
            .map_err(|e| CrawlerError::GitHubError(e.to_string()))?;

        for item in contents.items {
            if item.r#type == "file" && item.name.ends_with(".md") && item.name != "README.md" {
                self.crawl_file(owner, repo, &item).await?;
            }
        }

        Ok(())
    }

    /// Base64 解码
    fn decode_base64(&self, content: &str) -> CrawlerResult2<String> {
        use base64::{engine::general_purpose, Engine as _};
        let cleaned = content.replace('\n', "").replace('\r', "");
        let bytes = general_purpose::STANDARD
            .decode(cleaned.as_bytes())
            .map_err(|e| CrawlerError::Other(format!("Base64 解码失败: {}", e)))?;

        String::from_utf8(bytes).map_err(|e| CrawlerError::Other(format!("UTF-8 解码失败: {}", e)))
    }

    /// 创建 Wiki 条目
    fn create_entry(
        &self,
        title: &str,
        content: &str,
        url: &str,
        categories: Vec<String>,
    ) -> WikiEntry {
        let hash = calculate_hash(content);
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        WikiEntry {
            id: format!("{}_{}", self.config.game_id, hash),
            title: title.to_string(),
            content: clean_html_text(content),
            url: url.to_string(),
            timestamp,
            hash,
            categories,
            metadata: WikiMetadata {
                length: content.len(),
                last_modified: None,
                author: None,
                language: "en".to_string(),
            },
        }
    }

    /// 保存条目到文件
    fn save_entries(&self) -> CrawlerResult2<usize> {
        fs::create_dir_all(&self.config.storage_path)?;

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

        let metadata = serde_json::json!({
            "game_id": self.config.game_id,
            "source_url": self.config.source_url,
            "source_type": "GitHub",
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
