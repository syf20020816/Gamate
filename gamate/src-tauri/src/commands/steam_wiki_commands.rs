/// 为 Steam 游戏生成 Wiki 技能配置的命令

use crate::config::SkillConfig;
use crate::steam_wiki_mapper;

/// 为 Steam 游戏获取 Wiki 技能配置
#[tauri::command]
pub fn get_steam_game_wiki_configs(
    appid: u32,
    game_name: String,
) -> Result<Vec<SkillConfig>, String> {
    Ok(steam_wiki_mapper::get_predefined_wiki_config(appid, &game_name))
}
