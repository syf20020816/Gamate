use crate::config::Config;
use tauri::State;

/// 获取游戏配置
#[tauri::command]
pub async fn get_games_config(config: State<'_, Config>) -> Result<Config, String> {
    Ok(config.inner().clone())
}
