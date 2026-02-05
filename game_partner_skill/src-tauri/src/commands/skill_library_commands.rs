use crate::settings::AppSettings;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::collections::HashSet;

/// 已下载的技能库记录
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadedLibrary {
    pub id: String,
    pub game_id: String,
    pub game_name: String,
    pub skill_config_id: String,
    pub skill_config_name: String,
    pub version: String,
    pub timestamp: u64,
    pub storage_path: String,
    pub storage_size: u64,
    pub downloaded_at: String,
    pub statistics: LibraryStatistics,
    pub status: String, // "active" | "outdated" | "error"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryStatistics {
    pub total_entries: usize,
    pub vector_count: usize,
}

/// 扫描已下载的技能库
#[tauri::command]
pub async fn scan_downloaded_libraries() -> Result<Vec<DownloadedLibrary>, String> {
    scan_downloaded_libraries_impl()
        .await
        .map_err(|e| format!("扫描技能库失败: {}", e))
}

async fn scan_downloaded_libraries_impl() -> anyhow::Result<Vec<DownloadedLibrary>> {
    // 1. 加载应用配置
    let settings = AppSettings::load()?;
    let base_path = PathBuf::from(&settings.skill_library.storage_base_path);
    
    if !base_path.exists() {
        log::warn!("📂 技能库目录不存在: {:?}", base_path);
        return Ok(Vec::new());
    }

    let mut libraries = Vec::new();

    // 2. 遍历游戏目录
    for game_entry in fs::read_dir(&base_path)? {
        let game_entry = game_entry?;
        let game_id = game_entry.file_name().to_string_lossy().to_string();
        let game_path = game_entry.path();

        if !game_path.is_dir() {
            continue;
        }

        // 3. 遍历时间戳目录
        let mut timestamp_dirs: Vec<(u64, PathBuf)> = Vec::new();

        for timestamp_entry in fs::read_dir(&game_path)? {
            let timestamp_entry = timestamp_entry?;
            let timestamp_name = timestamp_entry.file_name().to_string_lossy().to_string();
            let timestamp_path = timestamp_entry.path();

            if !timestamp_path.is_dir() {
                continue;
            }

            // 解析时间戳
            if let Ok(timestamp) = timestamp_name.parse::<u64>() {
                timestamp_dirs.push((timestamp, timestamp_path));
            }
        }

        // 按时间戳降序排序
        timestamp_dirs.sort_by(|a, b| b.0.cmp(&a.0));

        // 4. 处理每个版本
        for (index, (timestamp, timestamp_path)) in timestamp_dirs.iter().enumerate() {
            // 检查 wiki_raw.jsonl 文件
            let jsonl_path = timestamp_path.join("wiki_raw.jsonl");
            
            if !jsonl_path.exists() {
                log::warn!("⚠️ 技能库目录缺少 wiki_raw.jsonl: {:?}", timestamp_path);
                continue;
            }

            // 读取文件统计
            let metadata = fs::metadata(&jsonl_path)?;
            let storage_size = metadata.len();
            
            // 检查文件大小是否超过 1KB
            if storage_size <= 1024 {
                log::warn!("⚠️ 技能库文件过小 ({} bytes): {:?}", storage_size, jsonl_path);
                continue;
            }

            // 统计条目数量
            let content = fs::read_to_string(&jsonl_path)?;
            let total_entries = content.lines().filter(|line| !line.trim().is_empty()).count();

            // 确定状态 (第一个为 active，其他为 outdated)
            let status = if index == 0 { "active" } else { "outdated" };

            // 生成库ID
            let library_id = format!("lib_{}_{}", timestamp, game_id);

            // 创建记录
            let library = DownloadedLibrary {
                id: library_id,
                game_id: game_id.clone(),
                game_name: get_game_name(&game_id),
                skill_config_id: format!("{}-skill-1", game_id), // 临时ID，可以从配置读取
                skill_config_name: format!("{} Wiki", get_game_name(&game_id)),
                version: "1.0.0".to_string(),
                timestamp: *timestamp,
                storage_path: timestamp_path.to_string_lossy().to_string(),
                storage_size,
                downloaded_at: format_timestamp(*timestamp),
                statistics: LibraryStatistics {
                    total_entries,
                    vector_count: total_entries, // 假设每条目都有向量
                },
                status: status.to_string(),
            };

            libraries.push(library);
        }
    }

    log::info!("✅ 扫描到 {} 个技能库", libraries.len());
    Ok(libraries)
}

/// 获取游戏名称 (临时实现，后续可以从 games.toml 读取)
fn get_game_name(game_id: &str) -> String {
    match game_id {
        "phasmophobia" => "恐鬼症".to_string(),
        "elden-ring" => "艾尔登法环".to_string(),
        "baldurs-gate-3" => "博德之门3".to_string(),
        _ => game_id.to_string(),
    }
}

/// 格式化时间戳
fn format_timestamp(timestamp: u64) -> String {
    use chrono::{DateTime, Utc, TimeZone};
    let dt = Utc.timestamp_opt(timestamp as i64, 0).unwrap();
    dt.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
}

/// 同步已下载的技能库到配置文件
/// 自动检测文件系统中的技能库，并更新 selected_games
#[tauri::command]
pub async fn sync_libraries_to_config() -> Result<Vec<String>, String> {
    sync_libraries_to_config_impl()
        .await
        .map_err(|e| format!("同步配置失败: {}", e))
}

async fn sync_libraries_to_config_impl() -> anyhow::Result<Vec<String>> {
    // 1. 扫描已下载的技能库
    let libraries = scan_downloaded_libraries_impl().await?;
    
    // 2. 提取唯一的游戏ID列表
    let mut game_ids: HashSet<String> = HashSet::new();
    for library in &libraries {
        game_ids.insert(library.game_id.clone());
    }
    
    let game_ids_vec: Vec<String> = game_ids.into_iter().collect();
    
    // 3. 加载当前配置
    let mut settings = AppSettings::load()?;
    
    // 4. 更新 selected_games (合并已存在的 + 新检测到的)
    let mut current_selected: HashSet<String> = settings.user.selected_games.iter().cloned().collect();
    
    for game_id in &game_ids_vec {
        current_selected.insert(game_id.clone());
    }
    
    settings.user.selected_games = current_selected.into_iter().collect();
    settings.user.selected_games.sort(); // 排序便于查看
    
    // 5. 保存配置
    settings.save()?;
    
    log::info!("✅ 已同步 {} 个游戏到配置文件", settings.user.selected_games.len());
    
    Ok(settings.user.selected_games)
}
