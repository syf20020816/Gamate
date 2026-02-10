use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

/// 游戏配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameConfig {
    pub id: String,
    pub name: String,
    pub name_en: Option<String>,
    pub icon: String,
    pub banner: Option<String>,
    pub description: String,
    pub category: String,
    pub tags: Vec<String>,
    pub release_date: Option<String>,
    pub developer: Option<String>,
    pub publisher: Option<String>,
    pub skill_configs: Vec<SkillConfig>,
}

/// 技能库配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillConfig {
    pub id: String,
    pub name: String,
    pub description: String,
    pub repo: String,
    pub version: String,
    pub source_type: String,
    pub max_pages: Option<usize>,
    pub max_depth: Option<usize>,
    pub request_delay_ms: Option<u64>,
}

/// 根配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub games: Vec<GameConfig>,
}

impl Config {
    /// 从 TOML 文件加载配置，如果不存在则创建默认配置
    pub fn from_toml_file<P: AsRef<Path>>(path: P) -> Result<Self, String> {
        let path = path.as_ref();

        // 检查文件是否存在
        if !path.exists() {
            // 创建默认配置
            let default_config = Self::default();

            // 确保父目录存在
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).map_err(|e| format!("无法创建配置目录: {}", e))?;
            }

            // 保存默认配置
            let content = toml::to_string_pretty(&default_config)
                .map_err(|e| format!("序列化配置失败: {}", e))?;

            fs::write(path, content).map_err(|e| format!("无法写入配置文件: {}", e))?;
            return Ok(default_config);
        }

        // 读取现有配置
        let content = fs::read_to_string(path).map_err(|e| format!("无法读取配置文件: {}", e))?;

        toml::from_str(&content).map_err(|e| format!("解析配置文件失败: {}", e))
    }

    /// 从 JSON 文件加载配置
    pub fn from_json_file<P: AsRef<Path>>(path: P) -> Result<Self, String> {
        let content = fs::read_to_string(path).map_err(|e| format!("无法读取配置文件: {}", e))?;

        serde_json::from_str(&content).map_err(|e| format!("解析配置文件失败: {}", e))
    }

    /// 根据游戏 ID 查找游戏配置
    pub fn find_game(&self, game_id: &str) -> Option<&GameConfig> {
        self.games.iter().find(|g| g.id == game_id)
    }

    /// 根据技能配置 ID 查找技能配置
    pub fn find_skill_config(&self, skill_config_id: &str) -> Option<(&GameConfig, &SkillConfig)> {
        for game in &self.games {
            if let Some(skill) = game.skill_configs.iter().find(|s| s.id == skill_config_id) {
                return Some((game, skill));
            }
        }
        None
    }
}

impl Default for Config {
    fn default() -> Self {
        Self {
            games: vec![
                GameConfig {
                    id: "phasmophobia".to_string(),
                    name: "恐鬼症".to_string(),
                    name_en: Some("Phasmophobia".to_string()),
                    icon: "/games/phasmophobia.png".to_string(),
                    banner: Some("/games/phasmophobia.png".to_string()),
                    description: "恐鬼症是一款4人在线合作心理恐怖游戏。你和你的超自然现象调查小组将进入闹鬼的地点，收集尽可能多的超自然现象证据。".to_string(),
                    category: "horror".to_string(),
                    tags: vec!["合作".to_string(), "多人".to_string(), "恐怖".to_string(), "调查".to_string(), "VR支持".to_string()],
                    release_date: Some("2020-09-18".to_string()),
                    developer: Some("Kinetic Games".to_string()),
                    publisher: Some("Kinetic Games".to_string()),
                    skill_configs: vec![
                        SkillConfig {
                            id: "phasmophobia-skill-1".to_string(),
                            name: "Phasmophobia Wiki (Fandom)".to_string(),
                            description: "官方 Phasmophobia Wiki，包含所有鬼魂类型、证据、道具、地图等详细信息".to_string(),
                            repo: "https://phasmophobia.fandom.com/wiki/".to_string(),
                            version: "1.0.0".to_string(),
                            source_type: "FandomWiki".to_string(),
                            max_pages: Some(500),
                            max_depth: Some(5),
                            request_delay_ms: Some(500),
                        },
                    ],
                },
                GameConfig {
                    id: "elden-ring".to_string(),
                    name: "艾尔登法环".to_string(),
                    name_en: Some("Elden Ring".to_string()),
                    icon: "/games/elden-ring.png".to_string(),
                    banner: Some("/games/elden-ring-banner.jpg".to_string()),
                    description: "由宫崎英高与乔治·R·R·马丁共同创作的黑暗奇幻动作RPG游戏。".to_string(),
                    category: "action-rpg".to_string(),
                    tags: vec!["魂系".to_string(), "开放世界".to_string(), "高难度".to_string(), "动作".to_string()],
                    release_date: Some("2022-02-25".to_string()),
                    developer: Some("FromSoftware".to_string()),
                    publisher: Some("Bandai Namco".to_string()),
                    skill_configs: vec![
                        SkillConfig {
                            id: "elden-ring-skill-1".to_string(),
                            name: "Elden Ring Wiki (Fandom)".to_string(),
                            description: "艾尔登法环完整攻略Wiki，包含Boss、装备、魔法、地图等".to_string(),
                            repo: "https://eldenring.fandom.com/wiki/".to_string(),
                            version: "1.0.0".to_string(),
                            source_type: "FandomWiki".to_string(),
                            max_pages: Some(1000),
                            max_depth: Some(6),
                            request_delay_ms: Some(500),
                        },
                    ],
                },
                GameConfig {
                    id: "baldurs-gate-3".to_string(),
                    name: "博德之门3".to_string(),
                    name_en: Some("Baldur's Gate 3".to_string()),
                    icon: "/games/bg3.png".to_string(),
                    banner: Some("/games/bg3-banner.jpg".to_string()),
                    description: "基于龙与地下城规则的角色扮演游戏，由拉瑞安工作室开发。".to_string(),
                    category: "action-rpg".to_string(),
                    tags: vec!["RPG".to_string(), "回合制".to_string(), "剧情".to_string(), "多人".to_string()],
                    release_date: Some("2023-08-03".to_string()),
                    developer: Some("Larian Studios".to_string()),
                    publisher: Some("Larian Studios".to_string()),
                    skill_configs: vec![
                        SkillConfig {
                            id: "bg3-skill-1".to_string(),
                            name: "Baldur's Gate 3 Wiki".to_string(),
                            description: "博德之门3官方Wiki，包含职业、法术、任务、角色等".to_string(),
                            repo: "https://bg3.wiki/".to_string(),
                            version: "1.0.0".to_string(),
                            source_type: "CustomWeb".to_string(),
                            max_pages: Some(800),
                            max_depth: Some(5),
                            request_delay_ms: Some(600),
                        },
                    ],
                },
            ],
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_load_config() {
        let config_toml = r#"
[[games]]
id = "test-game"
name = "测试游戏"
icon = "/test.png"
description = "测试"
category = "test"
tags = ["test"]

  [[games.skill_configs]]
  id = "test-skill"
  name = "Test Skill"
  description = "Test"
  repo = "https://test.com"
  version = "1.0.0"
  source_type = "FandomWiki"
"#;

        let config: Config = toml::from_str(config_toml).unwrap();
        assert_eq!(config.games.len(), 1);
        assert_eq!(config.games[0].id, "test-game");
    }
}
