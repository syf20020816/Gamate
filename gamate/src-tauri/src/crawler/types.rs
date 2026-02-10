use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use thiserror::Error;

/// Wiki 源类型
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum WikiSourceType {
    /// Fandom Wiki (如 https://phasmophobia.fandom.com/wiki/)
    FandomWiki,
    /// Gamepedia Wiki
    GamepediaWiki,
    /// GitHub 仓库 (如 https://github.com/user/repo)
    GitHub,
    /// 自定义网页 Wiki
    CustomWeb,
}

/// Wiki 内容项
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WikiEntry {
    /// 唯一 ID
    pub id: String,
    /// 标题
    pub title: String,
    /// 正文内容（已清洗）
    pub content: String,
    /// 原始 URL
    pub url: String,
    /// 抓取时间戳
    pub timestamp: u64,
    /// 内容哈希（用于去重）
    pub hash: String,
    /// 分类/标签
    pub categories: Vec<String>,
    /// 元数据
    pub metadata: WikiMetadata,
}

/// Wiki 元数据
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WikiMetadata {
    /// 文章长度
    pub length: usize,
    /// 最后修改时间
    pub last_modified: Option<String>,
    /// 作者
    pub author: Option<String>,
    /// 语言
    pub language: String,
}

/// 爬虫配置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CrawlerConfig {
    /// 游戏 ID
    pub game_id: String,
    /// Wiki 源类型
    pub source_type: WikiSourceType,
    /// 起始 URL 或 GitHub 仓库地址
    pub source_url: String,
    /// 存储路径
    pub storage_path: PathBuf,
    /// 时间戳
    pub timestamp: u64,
    /// 最大抓取页面数（防止无限爬取）
    pub max_pages: usize,
    /// 爬取深度限制
    pub max_depth: usize,
    /// 请求延迟（毫秒）
    pub request_delay_ms: u64,
    /// User-Agent
    pub user_agent: String,
    /// 是否包含图片
    pub include_images: bool,
    /// GitHub Token (可选)
    pub github_token: Option<String>,
}

impl Default for CrawlerConfig {
    fn default() -> Self {
        Self {
            game_id: String::new(),
            source_type: WikiSourceType::FandomWiki,
            source_url: String::new(),
            storage_path: PathBuf::new(),
            timestamp: 0,
            max_pages: 1000,
            max_depth: 5,
            request_delay_ms: 500,
            user_agent: "GamePartnerSkill/1.0".to_string(),
            include_images: false,
            github_token: None,
        }
    }
}

/// 爬虫结果
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CrawlerResult {
    /// 成功抓取的条目数
    pub total_entries: usize,
    /// 总字节数
    pub total_bytes: usize,
    /// 耗时（秒）
    pub duration_secs: u64,
    /// 错误数
    pub error_count: usize,
    /// 存储路径
    pub storage_path: String,
    /// 详细信息
    pub details: Vec<String>,
}

/// 爬虫错误
#[derive(Error, Debug)]
pub enum CrawlerError {
    #[error("HTTP request failed: {0}")]
    HttpError(#[from] reqwest::Error),

    #[error("HTML parsing failed: {0}")]
    ParseError(String),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Invalid URL: {0}")]
    InvalidUrl(String),

    #[error("GitHub API error: {0}")]
    GitHubError(String),

    #[error("Rate limit exceeded")]
    RateLimitExceeded,

    #[error("Unsupported source type")]
    UnsupportedSourceType,

    #[error("Other error: {0}")]
    Other(String),
}

pub type CrawlerResult2<T> = Result<T, CrawlerError>;
