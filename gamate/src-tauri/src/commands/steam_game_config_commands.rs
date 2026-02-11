/// Steam 游戏配置管理命令
/// 用于将 Steam 游戏保存到 games.toml

use crate::config::{Config, GameConfig};
use crate::steam_wiki_mapper;
use crate::settings::AppSettings;
use std::fs;

/// 将 Steam 游戏保存到 games.toml
#[tauri::command]
pub fn save_steam_games_to_config(
    steam_games: Vec<SteamGameData>,
) -> Result<(), String> {
    // 获取配置目录
    let config_dir = AppSettings::config_dir()
        .map_err(|e| format!("获取配置目录失败: {}", e))?;
    let games_config_path = config_dir.join("games.toml");

    // 加载现有配置
    let mut config = Config::from_toml_file(&games_config_path)?;

    // 转换 Steam 游戏为 GameConfig
    for steam_game in steam_games {
        let game_id = format!("steam_{}", steam_game.appid);
        
        // 检查是否已存在
        if config.games.iter().any(|g| g.id == game_id) {
            // 如果已存在,更新游戏信息但保留 skill_configs
            if let Some(existing_game) = config.games.iter_mut().find(|g| g.id == game_id) {
                existing_game.name = steam_game.name.clone();
                existing_game.name_en = Some(steam_game.name.clone());
                // 保持现有的 skill_configs 不变
                continue;
            }
        }

        // 获取 Wiki 配置
        let skill_configs = steam_wiki_mapper::get_predefined_wiki_config(
            steam_game.appid,
            &steam_game.name,
        );

        // 创建新的游戏配置
        let game_config = GameConfig {
            id: game_id,
            name: steam_game.name.clone(),
            name_en: Some(steam_game.name.clone()),
            icon: steam_game.img_icon_url.unwrap_or_default(),
            banner: None,
            description: format!("Steam 游戏 - {}", steam_game.name),
            category: "steam".to_string(),
            tags: vec!["Steam".to_string()],
            release_date: None,
            developer: None,
            publisher: None,
            skill_configs,
        };

        config.games.push(game_config);
    }

    // 保存更新后的配置
    save_config_to_toml(&games_config_path, &config)?;

    Ok(())
}

/// 保存配置到 TOML 文件
fn save_config_to_toml(path: &std::path::Path, config: &Config) -> Result<(), String> {
    let content = toml::to_string_pretty(config)
        .map_err(|e| format!("序列化配置失败: {}", e))?;

    fs::write(path, content)
        .map_err(|e| format!("写入配置文件失败: {}", e))?;

    Ok(())
}

/// Steam 游戏数据结构(从前端传来)
#[derive(Debug, serde::Deserialize)]
pub struct SteamGameData {
    pub appid: u32,
    pub name: String,
    pub img_icon_url: Option<String>,
}
