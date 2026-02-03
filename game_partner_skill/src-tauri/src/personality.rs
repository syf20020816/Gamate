/// AI 陪玩角色配置加载模块
/// 
/// 负责加载不同角色的提示词配置文件 (prompts_*.toml)
/// 
use anyhow::{Context, Result};
use serde::Deserialize;
use std::fs;
use std::path::PathBuf;

/// 角色配置结构
#[derive(Debug, Clone, Deserialize)]
pub struct PersonalityConfig {
    pub character: CharacterInfo,
    pub system: SystemPrompts,
}

/// 角色信息
#[derive(Debug, Clone, Deserialize)]
pub struct CharacterInfo {
    pub name_cn: String,
    pub name_en: String,
    pub description: String,
    #[serde(default)]
    pub gender: String,
    #[serde(rename = "type")]
    pub personality_type: String,
    /// 推荐的 TTS 语音名称
    #[serde(default)]
    pub preferred_voice: Option<String>,
    /// 备用 TTS 语音名称
    #[serde(default)]
    pub fallback_voice: Option<String>,
}

/// 系统提示词
#[derive(Debug, Clone, Deserialize)]
pub struct SystemPrompts {
    pub role: String,
    pub personality: String,
    pub answer_style: String,
    #[serde(default)]
    pub principles: String,
}

/// 加载指定类型的角色配置
/// 
/// # 参数
/// - `personality_type`: 角色类型 ("sunnyou_male", "funny_female", 等)
/// 
/// # 返回
/// - Ok(PersonalityConfig): 成功加载的配置
/// - Err: 加载失败
pub fn load_personality(personality_type: &str) -> Result<PersonalityConfig> {
    // 构建配置文件路径
    let config_filename = format!("prompts_{}.toml", personality_type);
    let config_path = get_config_path(&config_filename)?;

    log::info!("📂 加载角色配置: {}", config_path.display());

    // 读取文件内容
    let content = fs::read_to_string(&config_path)
        .with_context(|| format!("无法读取配置文件: {}", config_path.display()))?;

    // 解析 TOML
    let config: PersonalityConfig = toml::from_str(&content)
        .with_context(|| format!("解析配置文件失败: {}", config_path.display()))?;

    log::info!("✅ 角色配置加载成功: {} ({})", config.character.name_cn, config.character.name_en);

    Ok(config)
}

/// 构建系统提示词 (用于 LLM)
/// 
/// # 参数
/// - `config`: 角色配置
/// - `game_name`: 游戏名称
/// 
/// # 返回
/// 格式化后的系统提示词字符串
pub fn build_system_prompt(config: &PersonalityConfig, game_name: &str) -> String {
    format!(
        r#"# 🎮 游戏陪玩助手 - {} ({})

## 当前游戏
你正在帮助玩家玩《{}》。

## 你的角色
{}

## 性格特点
{}

## 回答风格
{}

## 核心原则
{}

---

**重要提醒:**
1. 根据用户的问题和提供的游戏 Wiki 知识库,给出准确、有帮助的建议
2. 如果用户提供了游戏截图,分析截图中的游戏状态
3. 回复要简洁明了,重点突出,使用 Markdown 格式
4. 如果 Wiki 中没有相关信息,诚实告知,不要编造内容
5. 保持你的角色设定,但确保游戏信息的准确性
"#,
        config.character.name_cn,
        config.character.name_en,
        game_name,
        config.system.role,
        config.system.personality,
        config.system.answer_style,
        config.system.principles,
    )
}

/// 获取配置文件路径
fn get_config_path(filename: &str) -> Result<PathBuf> {
    // 尝试多个可能的路径
    let possible_paths = vec![
        // 开发环境: 从项目根目录
        PathBuf::from(format!("config/{}", filename)),
        // 开发环境: 相对于当前目录
        PathBuf::from(format!("../config/{}", filename)),
        PathBuf::from(format!("../../config/{}", filename)),
        // 生产环境: 相对于可执行文件
        std::env::current_exe()
            .ok()
            .and_then(|exe| exe.parent().map(|p| p.join("config").join(filename)))
            .unwrap_or_default(),
    ];

    // 尝试每个路径
    for path in possible_paths {
        if path.exists() {
            log::debug!("   找到配置文件: {}", path.display());
            return Ok(path);
        }
    }

    // 如果都找不到,返回默认路径并报错
    let default_path = PathBuf::from(format!("config/{}", filename));
    anyhow::bail!("配置文件不存在: {} (已尝试多个路径)", default_path.display())
}

/// 获取所有可用的角色类型
pub fn get_available_personalities() -> Vec<&'static str> {
    vec![
        "sunnyou_male",    // 损友-男
        "funny_female",    // 搞笑-女
        "kobe",           // 牢大
        "sweet_girl",     // 甜妹
        "trump",          // 特朗普
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_load_sunnyou_male() {
        let result = load_personality("sunnyou_male");
        if let Ok(config) = result {
            assert_eq!(config.character.name_cn, "老陈");
            assert_eq!(config.character.name_en, "Chen");
            assert!(config.system.role.contains("老陈"));
        } else {
            println!("警告: 无法加载配置文件 (可能在测试环境中)");
        }
    }

    #[test]
    fn test_build_system_prompt() {
        let config = PersonalityConfig {
            character: CharacterInfo {
                name_cn: "测试角色".to_string(),
                name_en: "TestChar".to_string(),
                description: "测试描述".to_string(),
                gender: "male".to_string(),
                personality_type: "test".to_string(),
            },
            system: SystemPrompts {
                role: "你是一个测试角色".to_string(),
                personality: "幽默风趣".to_string(),
                answer_style: "简洁明了".to_string(),
                principles: "准确第一".to_string(),
            },
        };

        let prompt = build_system_prompt(&config, "测试游戏");
        
        assert!(prompt.contains("测试角色"));
        assert!(prompt.contains("TestChar"));
        assert!(prompt.contains("测试游戏"));
        assert!(prompt.contains("你是一个测试角色"));
    }
}
