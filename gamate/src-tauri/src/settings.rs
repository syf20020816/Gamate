use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::env;
use std::path::PathBuf;

/// 应用设置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct AppSettings {
    /// 通用设置
    pub general: GeneralSettings,
    /// 用户配置
    #[serde(default)]
    pub user: UserSettings,
    /// 技能库设置
    pub skill_library: SkillLibrarySettings,
    /// AI 模型设置
    pub ai_models: AIModelSettings,
    /// 截图设置
    #[serde(default)]
    pub screenshot: ScreenshotSettings,
    /// TTS 语音播报设置
    #[serde(default)]
    pub tts: TtsSettings,
    /// 模拟场景设置
    #[serde(default)]
    pub simulation: SimulationSettings,
}

/// 用户设置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct UserSettings {
    /// 用户选择的游戏列表
    #[serde(default)]
    pub selected_games: Vec<String>,
    /// Steam 用户信息
    #[serde(default)]
    pub steam: Option<SteamUserData>,
}

/// Steam 用户数据
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct SteamUserData {
    /// Steam ID
    pub steamid: String,
    /// 用户名
    pub personaname: String,
    /// 个人资料 URL
    pub profileurl: String,
    /// 头像 URL
    pub avatar: String,
    /// 最后登录时间（时间戳）
    #[serde(default)]
    pub last_login: Option<u64>,
}

impl Default for UserSettings {
    fn default() -> Self {
        Self {
            selected_games: Vec::new(),
            steam: None,
        }
    }
}

/// 通用设置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct GeneralSettings {
    /// 语言设置 (en, zh-CN, zh-TW, ja, etc.)
    pub language: String,
    /// 主题 (light, dark, auto)
    pub theme: String,
    /// HUD 浮窗模式 (默认开启)
    #[serde(default = "default_hud_mode")]
    pub hud_mode: bool,
    /// HUD 窗口位置 (语音对话 HUD)
    #[serde(default)]
    pub hud_position: Option<HudPosition>,
    /// 直播间 HUD 窗口位置
    #[serde(default)]
    pub livestream_hud_position: Option<HudPosition>,
}

/// HUD 窗口位置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HudPosition {
    pub x: f64,
    pub y: f64,
}

fn default_hud_mode() -> bool {
    true
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

/// 截图设置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct ScreenshotSettings {
    /// 是否启用智能截图
    pub enabled: bool,
    /// 截图模式 (fullscreen, window, area)
    pub capture_mode: String,
    /// 目标窗口 ID (仅当 capture_mode = window 时使用)
    #[serde(default)]
    pub target_window_id: Option<u32>,
    /// 目标窗口名称 (用于显示)
    #[serde(default)]
    pub target_window_name: Option<String>,
    /// 活跃模式截图间隔 (秒)
    pub active_interval_seconds: u64,
    /// 闲置模式截图间隔 (秒)
    pub idle_interval_seconds: u64,
    /// 是否自动发送给 AI 分析
    pub auto_send_to_ai: bool,
}

impl Default for ScreenshotSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            capture_mode: "fullscreen".to_string(),
            target_window_id: None,
            target_window_name: None,
            active_interval_seconds: 5,
            idle_interval_seconds: 15,
            auto_send_to_ai: true,
        }
    }
}

/// TTS 语音播报设置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct TtsSettings {
    /// 是否启用 TTS
    pub enabled: bool,
    /// TTS 提供商 (windows, aliyun)
    #[serde(default = "default_tts_provider")]
    pub provider: String,
    /// 阿里云 Access Key
    #[serde(default)]
    pub aliyun_access_key: Option<String>,
    /// 阿里云 Access Secret
    #[serde(default)]
    pub aliyun_access_secret: Option<String>,
    /// 阿里云 AppKey
    #[serde(default)]
    pub aliyun_appkey: Option<String>,
    /// 音色名称
    #[serde(default)]
    pub voice: Option<String>,
    /// 语速 (0.5 - 2.0, 默认 1.0)
    pub rate: f32,
    /// 音量 (0.0 - 1.0, 默认 0.8)
    pub volume: f32,
    /// AI 回复时自动播报
    pub auto_speak: bool,
}

fn default_tts_provider() -> String {
    "windows".to_string()
}

impl Default for TtsSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            provider: default_tts_provider(),
            aliyun_access_key: None,
            aliyun_access_secret: None,
            aliyun_appkey: None,
            voice: None,
            rate: 1.0,
            volume: 0.8,
            auto_speak: true,
        }
    }
}
/// AI 模型设置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct AIModelSettings {
    /// Embedding 模型配置
    pub embedding: ModelConfig,
    /// 多模态模型配置 (用于语音、图片识别)
    pub multimodal: ModelConfig,
    /// AI 陪玩角色类型 (sunnyou_male, funny_female, kobe, sweet_girl, trump)
    #[serde(default = "default_ai_personality")]
    pub ai_personality: String,
    /// 向量数据库配置
    #[serde(default)]
    pub vector_db: VectorDBSettings,
}

fn default_ai_personality() -> String {
    "sunnyou_male".to_string()
}

/// 向量数据库设置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct VectorDBSettings {
    /// 数据库模式 (local, qdrant, ai_direct)
    pub mode: String,
    /// Qdrant URL (仅在 mode=qdrant 时使用)
    #[serde(default)]
    pub qdrant_url: Option<String>,
    /// 本地存储路径 (仅在 mode=local 时使用)
    #[serde(default)]
    pub local_storage_path: Option<String>,
}

impl Default for VectorDBSettings {
    fn default() -> Self {
        Self {
            mode: "local".to_string(),
            qdrant_url: Some("http://localhost:6333".to_string()),
            local_storage_path: Some("./data/vector_db".to_string()),
        }
    }
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
    /// 温度参数 (0.0-2.0) - 用于 LLM 生成
    #[serde(default = "default_temperature")]
    pub temperature: f32,
    /// 最大 Token 数 - 用于 LLM 生成
    #[serde(default = "default_max_tokens")]
    pub max_tokens: u32,
}

fn default_temperature() -> f32 {
    0.7
}

fn default_max_tokens() -> u32 {
    1000
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            general: GeneralSettings {
                language: "zh-CN".to_string(),
                theme: "auto".to_string(),
                hud_mode: default_hud_mode(),
                hud_position: None,
                livestream_hud_position: None,
            },
            user: UserSettings::default(),
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
                    temperature: 0.0,
                    max_tokens: 512,
                },
                multimodal: ModelConfig {
                    provider: "openai".to_string(),
                    api_base: "https://api.openai.com/v1".to_string(),
                    api_key: None,
                    model_name: "gpt-4o-mini".to_string(),
                    enabled: true,
                    temperature: 0.7,
                    max_tokens: 1000,
                },
                ai_personality: default_ai_personality(),
                vector_db: VectorDBSettings {
                    mode: "local".to_string(),
                    qdrant_url: None,
                    local_storage_path: Some("./data/vector_db".to_string()),
                },
            },
            screenshot: ScreenshotSettings::default(),
            tts: TtsSettings::default(),
            simulation: SimulationSettings::default(),
        }
    }
}

impl AppSettings {
    /// 获取配置目录路径（可执行文件同级的 config 目录）
    pub fn config_dir() -> Result<PathBuf> {
        let exe_path =
            env::current_exe().map_err(|e| anyhow::anyhow!("无法获取可执行文件路径: {}", e))?;

        let exe_dir = exe_path
            .parent()
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
        let mut settings: Self =
            toml::from_str(&content).map_err(|e| anyhow::anyhow!("解析配置文件失败: {}", e))?;

        log::info!("✅ 加载配置成功: {:?}", path);

        // 🔍 加载后自动同步已下载的技能库
        if let Err(e) = settings.sync_downloaded_libraries() {
            log::warn!("⚠️ 自动同步技能库失败: {}", e);
        }

        Ok(settings)
    }

    /// 同步已下载的技能库到 selected_games
    fn sync_downloaded_libraries(&mut self) -> Result<()> {
        use std::collections::HashSet;

        let base_path = PathBuf::from(&self.skill_library.storage_base_path);

        if !base_path.exists() {
            log::info!("📂 技能库目录不存在，跳过自动同步");
            return Ok(());
        }

        let mut detected_games: HashSet<String> = HashSet::new();

        // 遍历游戏目录
        // 目录结构: E:\projects\gps_test\phasmophobia\1769626506\wiki_raw.jsonl
        if let Ok(entries) = std::fs::read_dir(&base_path) {
            for entry in entries.flatten() {
                let game_id = entry.file_name().to_string_lossy().to_string();
                let game_path = entry.path();

                if !game_path.is_dir() {
                    continue;
                }

                // 检查是否有时间戳子目录且包含 wiki_raw.jsonl (大小 > 1KB)
                if let Ok(sub_entries) = std::fs::read_dir(&game_path) {
                    for sub_entry in sub_entries.flatten() {
                        let sub_path = sub_entry.path();
                        if !sub_path.is_dir() {
                            continue;
                        }

                        let jsonl_path = sub_path.join("wiki_raw.jsonl");
                        if jsonl_path.exists() {
                            // 检查文件大小是否超过 1KB
                            if let Ok(metadata) = std::fs::metadata(&jsonl_path) {
                                if metadata.len() > 1024 {
                                    log::info!(
                                        "✅ 检测到有效技能库: {} ({})",
                                        game_id,
                                        jsonl_path.display()
                                    );
                                    detected_games.insert(game_id.clone());
                                    break;
                                } else {
                                    log::warn!(
                                        "⚠️ 技能库文件过小 ({} bytes): {}",
                                        metadata.len(),
                                        jsonl_path.display()
                                    );
                                }
                            }
                        }
                    }
                }
            }
        }

        if detected_games.is_empty() {
            log::info!("📦 未检测到已下载的技能库");
            return Ok(());
        }

        // 合并到 selected_games
        let mut current_selected: HashSet<String> =
            self.user.selected_games.iter().cloned().collect();
        let before_count = current_selected.len();

        for game_id in detected_games {
            current_selected.insert(game_id);
        }

        self.user.selected_games = current_selected.into_iter().collect();
        self.user.selected_games.sort();

        let after_count = self.user.selected_games.len();

        if after_count > before_count {
            log::info!(
                "✅ 自动同步: 检测到 {} 个新游戏，已添加到配置",
                after_count - before_count
            );
            self.save()?;
        }

        Ok(())
    }

    /// 保存设置
    pub fn save(&self) -> Result<()> {
        let path = Self::config_path()?;
        let content =
            toml::to_string_pretty(self).map_err(|e| anyhow::anyhow!("序列化配置失败: {}", e))?;
        std::fs::write(&path, content)?;

        log::info!("✅ 保存配置成功: {:?}", path);
        Ok(())
    }
}

/// 模拟场景设置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct SimulationSettings {
    /// 直播间配置
    #[serde(default)]
    pub livestream: LivestreamConfig,
    /// AI 员工列表
    #[serde(default)]
    pub employees: Vec<AIEmployeeConfig>,
}

impl Default for SimulationSettings {
    fn default() -> Self {
        Self {
            livestream: LivestreamConfig::default(),
            employees: Vec::new(),
        }
    }
}

/// 直播间配置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct LivestreamConfig {
    /// 在线人数
    pub online_users: u32,
    /// 直播间名称
    pub room_name: String,
    /// 直播间描述
    pub room_description: String,
    /// 弹幕频率 (high, medium, low)
    pub danmaku_frequency: String,
    /// 礼物频率 (high, medium, low)
    pub gift_frequency: String,
    /// 是否可上麦
    pub allow_mic: bool,
}

impl Default for LivestreamConfig {
    fn default() -> Self {
        Self {
            online_users: 1000,
            room_name: "游戏陪玩直播间".to_string(),
            room_description: "欢迎来到直播间！一起开心玩游戏~".to_string(),
            danmaku_frequency: "medium".to_string(),
            gift_frequency: "medium".to_string(),
            allow_mic: true,
        }
    }
}

/// AI 员工配置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct AIEmployeeConfig {
    /// 员工 ID
    pub id: String,
    /// AI 性格 (sunnyou_male, funny_female, kobe, sweet_girl, trump)
    pub personality: String,
    /// 互动频率 (high, medium, low)
    pub interaction_frequency: String,
    /// AI 昵称
    pub nickname: String,
}
