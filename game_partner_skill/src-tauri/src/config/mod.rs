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
    /// 从 TOML 文件加载配置
    pub fn from_toml_file<P: AsRef<Path>>(path: P) -> Result<Self, String> {
        let content = fs::read_to_string(path)
            .map_err(|e| format!("无法读取配置文件: {}", e))?;
        
        toml::from_str(&content)
            .map_err(|e| format!("解析配置文件失败: {}", e))
    }

    /// 从 JSON 文件加载配置
    pub fn from_json_file<P: AsRef<Path>>(path: P) -> Result<Self, String> {
        let content = fs::read_to_string(path)
            .map_err(|e| format!("无法读取配置文件: {}", e))?;
        
        serde_json::from_str(&content)
            .map_err(|e| format!("解析配置文件失败: {}", e))
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
