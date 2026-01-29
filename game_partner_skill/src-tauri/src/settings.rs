use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use anyhow::Result;
use std::env;

/// 应用设置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct AppSettings {
    /// 通用设置
    pub general: GeneralSettings,
    /// 技能库设置
    pub skill_library: SkillLibrarySettings,
    /// AI 模型设置
    pub ai_models: AIModelSettings,
}

/// 通用设置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct GeneralSettings {
    /// 语言设置 (en, zh-CN, zh-TW, ja, etc.)
    pub language: String,
    /// 主题 (light, dark, auto)
    pub theme: String,
}

/// 技能库设置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct SkillLibrarySettings {
    /// 技能库主存储目录
    pub storage_base_path: String,
    /// 保留的历史版本数量
    pub max_versions_to_keep: u32,
    /// 是否自动更新
    pub auto_update: bool,
    /// 更新检查间隔 (小时)
    pub update_check_interval: u32,
    /// 爬虫设置
    pub crawler: CrawlerSettings,
}

/// 爬虫设置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct CrawlerSettings {
    /// 请求延迟 (毫秒)
    pub request_delay_ms: u64,
    /// 最大并发数
    pub max_concurrent_requests: usize,
    /// 超时时间 (秒)
    pub timeout_seconds: u64,
}

/// AI 模型设置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct AIModelSettings {
    /// Embedding 模型配置
    pub embedding: ModelConfig,
    /// 多模态模型配置 (用于语音、图片识别)
    pub multimodal: ModelConfig,
}

/// 模型配置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct ModelConfig {
    /// 提供商 (local, openai, azure, custom)
    pub provider: String,
    /// API 地址
    pub api_base: String,
    /// API Key (可选)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    /// 模型名称
    pub model_name: String,
    /// 是否启用
    pub enabled: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            general: GeneralSettings {
                language: "zh-CN".to_string(),
                theme: "auto".to_string(),
            },
            skill_library: SkillLibrarySettings {
                storage_base_path: "./data/skills".to_string(),
                max_versions_to_keep: 3,
                auto_update: false,
                update_check_interval: 24,
                crawler: CrawlerSettings {
                    request_delay_ms: 1000,
                    max_concurrent_requests: 5,
                    timeout_seconds: 30,
                },
            },
            ai_models: AIModelSettings {
                embedding: ModelConfig {
                    provider: "local".to_string(),
                    api_base: "http://localhost:11434/v1".to_string(),
                    api_key: None,
                    model_name: "qwen3-embedding:4b".to_string(),
                    enabled: true,
                },
                multimodal: ModelConfig {
                    provider: "local".to_string(),
                    api_base: "http://localhost:11434/v1".to_string(),
                    api_key: None,
                    model_name: "qwen3-vl:latest".to_string(),
                    enabled: true,
                },
            },
        }
    }
}

impl AppSettings {
    /// 获取配置目录路径（可执行文件同级的 config 目录）
    pub fn config_dir() -> Result<PathBuf> {
        let exe_path = env::current_exe()
            .map_err(|e| anyhow::anyhow!("无法获取可执行文件路径: {}", e))?;
        
        let exe_dir = exe_path.parent()
            .ok_or_else(|| anyhow::anyhow!("无法获取可执行文件目录"))?;
        
        let config_dir = exe_dir.join("config");
        std::fs::create_dir_all(&config_dir)?;
        
        Ok(config_dir)
    }
    
    /// 获取配置文件路径
    fn config_path() -> Result<PathBuf> {
        let config_dir = Self::config_dir()?;
        Ok(config_dir.join("config.toml"))
    }

    /// 加载设置
    pub fn load() -> Result<Self> {
        let path = Self::config_path()?;
        
        if !path.exists() {
            log::info!("📝 配置文件不存在，创建默认配置: {:?}", path);
            let default_settings = Self::default();
            default_settings.save()?;
            return Ok(default_settings);
        }

        let content = std::fs::read_to_string(&path)?;
        let settings: Self = toml::from_str(&content)
            .map_err(|e| anyhow::anyhow!("解析配置文件失败: {}", e))?;
        
        log::info!("✅ 加载配置成功: {:?}", path);
        Ok(settings)
    }

    /// 保存设置
    pub fn save(&self) -> Result<()> {
        let path = Self::config_path()?;
        let content = toml::to_string_pretty(self)
            .map_err(|e| anyhow::anyhow!("序列化配置失败: {}", e))?;
        std::fs::write(&path, content)?;
        
        log::info!("✅ 保存配置成功: {:?}", path);
        Ok(())
    }
}
