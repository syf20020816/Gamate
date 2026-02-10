use crate::crawler::{
    CrawlerConfig, CrawlerResult, FandomApiCrawler, GitHubCrawler, WebCrawler, WikiSourceType,
};
use std::path::PathBuf;

/// 下载 Wiki 命令参数
#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadWikiParams {
    pub game_id: String,
    pub skill_config_id: String,
    pub repo: String,
    pub source_type: String,
    pub timestamp: u64,
    pub storage_path: String,
    pub github_token: Option<String>,
}

/// 下载 Wiki
#[tauri::command]
pub async fn download_wiki(params: DownloadWikiParams) -> Result<CrawlerResult, String> {
    log::info!("开始下载 Wiki: {}", params.game_id);

    // 解析源类型
    let source_type = match params.source_type.as_str() {
        "FandomWiki" => WikiSourceType::FandomWiki,
        "GamepediaWiki" => WikiSourceType::GamepediaWiki,
        "GitHub" => WikiSourceType::GitHub,
        "CustomWeb" => WikiSourceType::CustomWeb,
        _ => return Err("不支持的 Wiki 源类型".to_string()),
    };

    // 构建配置
    let config = CrawlerConfig {
        game_id: params.game_id.clone(),
        source_type: source_type.clone(),
        source_url: params.repo.clone(),
        storage_path: PathBuf::from(&params.storage_path),
        timestamp: params.timestamp,
        max_pages: 500, // 限制最大页面数
        max_depth: 5,
        request_delay_ms: 500,
        user_agent: "GamePartnerSkill/1.0 (Educational Purpose)".to_string(),
        include_images: false,
        github_token: params.github_token.clone(),
    };

    // 根据源类型选择爬虫
    let result = match source_type {
        WikiSourceType::GitHub => {
            let mut crawler =
                GitHubCrawler::new(config).map_err(|e| format!("创建 GitHub 爬虫失败: {}", e))?;
            crawler.crawl().await
        }
        WikiSourceType::FandomWiki | WikiSourceType::GamepediaWiki => {
            // 使用 Fandom API 而不是 HTML 爬虫
            log::info!("使用 Fandom MediaWiki API");
            let mut crawler = FandomApiCrawler::new(config);
            crawler.crawl().await
        }
        WikiSourceType::CustomWeb => {
            let mut crawler = WebCrawler::new(config);
            crawler.crawl().await
        }
    };

    result.map_err(|e| format!("爬取失败: {}", e))
}

/// 更新技能库
#[tauri::command]
pub async fn update_skill_library(
    game_id: String,
    repo: String,
    source_type: String,
    storage_path: String,
    github_token: Option<String>,
) -> Result<CrawlerResult, String> {
    // 生成新时间戳
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    // 构建新的存储路径
    let new_storage_path = format!("{}\\{}", storage_path, timestamp);

    // 调用下载命令
    download_wiki(DownloadWikiParams {
        game_id,
        skill_config_id: format!("update_{}", timestamp),
        repo,
        source_type,
        timestamp,
        storage_path: new_storage_path,
        github_token,
    })
    .await
}

/// 打开文件夹
#[tauri::command]
pub async fn open_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("无法打开文件夹: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("无法打开文件夹: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("无法打开文件夹: {}", e))?;
    }

    Ok(())
}

/// 删除技能库
#[tauri::command]
pub async fn delete_skill_library(storage_path: String) -> Result<(), String> {
    // 检查路径是否存在
    if std::path::Path::new(&storage_path).exists() {
        std::fs::remove_dir_all(&storage_path).map_err(|e| format!("删除文件失败: {}", e))?;
        log::info!("✅ 已删除技能库文件: {}", storage_path);
    } else {
        log::warn!("⚠️  技能库路径不存在（可能已被手动删除）: {}", storage_path);
    }

    Ok(())
}

/// 验证技能库路径是否有效（文件是否存在）
#[tauri::command]
pub async fn validate_skill_library(storage_path: String) -> Result<bool, String> {
    let path = std::path::Path::new(&storage_path);

    // 检查目录是否存在
    if !path.exists() {
        log::warn!("路径不存在: {}", storage_path);
        return Ok(false);
    }

    // 检查关键文件是否存在
    let wiki_file = path.join("wiki_raw.jsonl");
    let metadata_file = path.join("metadata.json");

    if !wiki_file.exists() {
        log::warn!("wiki_raw.jsonl 不存在: {}", storage_path);
        return Ok(false);
    }

    if !metadata_file.exists() {
        log::warn!("metadata.json 不存在: {}", storage_path);
        return Ok(false);
    }

    Ok(true)
}

/// 获取文件夹大小
#[tauri::command]
pub async fn get_folder_size(path: String) -> Result<u64, String> {
    use walkdir::WalkDir;

    let mut total_size = 0u64;

    for entry in WalkDir::new(&path).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            if let Ok(metadata) = entry.metadata() {
                total_size += metadata.len();
            }
        }
    }

    Ok(total_size)
}
