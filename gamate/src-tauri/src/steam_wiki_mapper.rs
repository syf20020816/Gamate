/// Steam 游戏 Wiki 映射器
/// 
/// 为 Steam 游戏生成对应的 Wiki 技能配置

use crate::config::SkillConfig;
use std::collections::HashMap;

/// 热门游戏的 Wiki 配置映射表
pub fn get_predefined_wiki_config(appid: u32, game_name: &str) -> Vec<SkillConfig> {
    // 先检查是否有预定义的配置
    if let Some(configs) = get_known_game_wikis(appid) {
        return configs;
    }

    // 否则生成通用配置
    generate_generic_wiki_config(appid, game_name)
}

/// 已知游戏的 Wiki 配置（手动维护的热门游戏）
fn get_known_game_wikis(appid: u32) -> Option<Vec<SkillConfig>> {
    let known_wikis: HashMap<u32, Vec<SkillConfig>> = [
        // Phasmophobia
        (739630, vec![
            SkillConfig {
                id: format!("steam_{}_skill_1", 739630),
                name: "Phasmophobia Wiki (Fandom)".to_string(),
                description: "官方 Phasmophobia Wiki，包含所有鬼魂类型、证据、道具等".to_string(),
                repo: "https://phasmophobia.fandom.com/wiki/".to_string(),
                version: "1.0.0".to_string(),
                source_type: "FandomWiki".to_string(),
                max_pages: Some(500),
                max_depth: Some(5),
                request_delay_ms: Some(500),
            },
        ]),
        // Elden Ring
        (1245620, vec![
            SkillConfig {
                id: format!("steam_{}_skill_1", 1245620),
                name: "Elden Ring Wiki (Fandom)".to_string(),
                description: "艾尔登法环完整攻略Wiki".to_string(),
                repo: "https://eldenring.fandom.com/wiki/".to_string(),
                version: "1.0.0".to_string(),
                source_type: "FandomWiki".to_string(),
                max_pages: Some(1000),
                max_depth: Some(6),
                request_delay_ms: Some(500),
            },
        ]),
        // Baldur's Gate 3
        (1086940, vec![
            SkillConfig {
                id: format!("steam_{}_skill_1", 1086940),
                name: "Baldur's Gate 3 Wiki".to_string(),
                description: "博德之门3官方Wiki".to_string(),
                repo: "https://bg3.wiki/".to_string(),
                version: "1.0.0".to_string(),
                source_type: "CustomWeb".to_string(),
                max_pages: Some(800),
                max_depth: Some(5),
                request_delay_ms: Some(600),
            },
        ]),
        // CS2
        (730, vec![
            SkillConfig {
                id: format!("steam_{}_skill_1", 730),
                name: "Counter-Strike Wiki".to_string(),
                description: "CS2 游戏百科，包含武器、地图、战术等".to_string(),
                repo: "https://counterstrike.fandom.com/wiki/".to_string(),
                version: "1.0.0".to_string(),
                source_type: "FandomWiki".to_string(),
                max_pages: Some(600),
                max_depth: Some(5),
                request_delay_ms: Some(500),
            },
        ]),
        // Dota 2
        (570, vec![
            SkillConfig {
                id: format!("steam_{}_skill_1", 570),
                name: "Dota 2 Wiki".to_string(),
                description: "Dota 2 游戏百科，包含英雄、物品、机制等".to_string(),
                repo: "https://dota2.fandom.com/wiki/".to_string(),
                version: "1.0.0".to_string(),
                source_type: "FandomWiki".to_string(),
                max_pages: Some(1000),
                max_depth: Some(6),
                request_delay_ms: Some(500),
            },
        ]),
        // Terraria
        (105600, vec![
            SkillConfig {
                id: format!("steam_{}_skill_1", 105600),
                name: "Terraria Wiki".to_string(),
                description: "泰拉瑞亚官方Wiki".to_string(),
                repo: "https://terraria.fandom.com/wiki/".to_string(),
                version: "1.0.0".to_string(),
                source_type: "FandomWiki".to_string(),
                max_pages: Some(1200),
                max_depth: Some(6),
                request_delay_ms: Some(500),
            },
        ]),
        // Minecraft (Java Edition)
        (1086940, vec![
            SkillConfig {
                id: format!("steam_{}_skill_1", 1086940),
                name: "Minecraft Wiki".to_string(),
                description: "Minecraft 官方Wiki".to_string(),
                repo: "https://minecraft.fandom.com/wiki/".to_string(),
                version: "1.0.0".to_string(),
                source_type: "FandomWiki".to_string(),
                max_pages: Some(1500),
                max_depth: Some(7),
                request_delay_ms: Some(500),
            },
        ]),
    ].into_iter().collect();

    known_wikis.get(&appid).cloned()
}

/// 为未知游戏生成通用 Wiki 配置
fn generate_generic_wiki_config(appid: u32, game_name: &str) -> Vec<SkillConfig> {
    // 清理游戏名称，生成可能的 Fandom Wiki URL
    let clean_name = clean_game_name(game_name);
    
    vec![
        SkillConfig {
            id: format!("steam_{}_skill_auto", appid),
            name: format!("{} Wiki (自动生成)", game_name),
            description: format!("基于游戏名称自动生成的 Wiki 配置。如果此游戏有 Fandom Wiki，可能可以使用。"),
            repo: format!("https://{}.fandom.com/wiki/", clean_name),
            version: "1.0.0".to_string(),
            source_type: "FandomWiki".to_string(),
            max_pages: Some(500),
            max_depth: Some(5),
            request_delay_ms: Some(600),
        },
    ]
}

/// 清理游戏名称，生成适合 URL 的格式
fn clean_game_name(name: &str) -> String {
    name.to_lowercase()
        .replace("®", "")
        .replace("™", "")
        .replace(":", "")
        .replace(" - ", "-")
        .replace(" ", "-")
        .replace("'", "")
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-')
        .collect::<String>()
        .trim_matches('-')
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clean_game_name() {
        assert_eq!(clean_game_name("Counter-Strike: Global Offensive"), "counter-strike-global-offensive");
        assert_eq!(clean_game_name("The Elder Scrolls V: Skyrim"), "the-elder-scrolls-v-skyrim");
        assert_eq!(clean_game_name("Tom Clancy's Rainbow Six® Siege"), "tom-clancys-rainbow-six-siege");
    }

    #[test]
    fn test_known_game_wiki() {
        let configs = get_known_game_wikis(739630);
        assert!(configs.is_some());
        assert_eq!(configs.unwrap()[0].name, "Phasmophobia Wiki (Fandom)");
    }

    #[test]
    fn test_generic_wiki_generation() {
        let configs = generate_generic_wiki_config(999999, "Test Game");
        assert_eq!(configs.len(), 1);
        assert!(configs[0].repo.contains("test-game"));
    }
}
