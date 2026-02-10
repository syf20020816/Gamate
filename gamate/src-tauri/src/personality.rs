/// AI 陪玩角色配置加载模块
///
/// 负责加载不同角色的提示词配置文件 (prompts_*.toml)
///
use anyhow::{Context, Result};
use serde::Deserialize;
use std::fs;
use std::path::PathBuf;

/// 角色配置结构 (对应 prompts_*.toml 文件)
#[derive(Debug, Clone, Deserialize)]
pub struct PersonalityConfig {
    pub character: CharacterInfo,
    pub system: SystemPrompts,
    #[serde(default)]
    pub scenarios: Option<ScenarioPrompts>,
    #[serde(default)]
    pub templates: Option<TemplateConfig>,
    #[serde(default)]
    pub metadata: Option<ConfigMetadata>,
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

/// 场景化提示词 (可选)
#[derive(Debug, Clone, Deserialize, Default)]
pub struct ScenarioPrompts {
    #[serde(default)]
    pub game_start: Option<String>,
    #[serde(default)]
    pub player_stuck: Option<String>,
    #[serde(default)]
    pub asking_guide: Option<String>,
    #[serde(default)]
    pub player_mistake: Option<String>,
    #[serde(default)]
    pub player_success: Option<String>,
    #[serde(default)]
    pub tense_moment: Option<String>,
    #[serde(default)]
    pub casual_chat: Option<String>,
}

/// 模板配置 (可选)
#[derive(Debug, Clone, Deserialize, Default)]
pub struct TemplateConfig {
    #[serde(default)]
    pub standard: Option<String>,
}

/// 配置元数据 (可选)
#[derive(Debug, Clone, Deserialize, Default)]
pub struct ConfigMetadata {
    #[serde(default)]
    pub version: Option<String>,
    #[serde(default)]
    pub last_updated: Option<String>,
    #[serde(default)]
    pub author: Option<String>,
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

    log::info!(
        "✅ 角色配置加载成功: {} ({})",
        config.character.name_cn,
        config.character.name_en
    );

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

## ⚡ 重要对话规则

### 1. 简练回复原则 (默认模式)
- **默认回复长度**: 30-60字
- **最长不超过**: 80字
- **风格**: 像真人陪玩一样,简短、有力、直击要点
- **示例**:
  ✅ "看到那个宝箱了吗?先别开,周围有怪。等我信号!"
  ❌ "根据当前的游戏情况分析,我建议您在开启宝箱之前,首先对周围环境进行详细观察..."

### 2. 详细回复触发词
**仅当用户使用以下关键词时,才给出详细回答** (限制200字内):
- 明确请求: "请解释"、"详细说明"、"分析一下"、"为什么"、"怎么回事"
- 学习需求: "教我"、"怎么做"、"攻略"、"原理"
- 深入讨论: "具体"、"细节"、"全面"

**详细模式示例**:
用户: "请解释一下为什么要这么打"
AI: "好的,详细说说:
1. 这个BOSS有护盾机制,硬刚会被反伤
2. 先用技能A打破护盾,有3秒破绽期
3. 趁破绽期上B技能输出,能打满伤害
记住这个节奏就行,试几次就熟了! 💪"

### 3. 回复格式要求
- ✅ 使用简短句子
- ✅ 适当使用 emoji (1-2个)
- ✅ 分点列举时不超过3点
- ✅ 避免复杂的术语堆砌
- ❌ 禁止使用"根据XXX"、"综上所述"等书面语
- ❌ 禁止长段落 (每段不超过2行)

### 4. 对话节奏控制
- **快速提示**: 10-20字 (紧急情况)
  "快躲!BOSS要放大招了!"
- **常规回复**: 30-60字 (普通对话)
  "这波可以,先清小怪,然后集火BOSS。注意躲技能就行! 🎯"
- **详细解答**: 100-200字 (仅触发词)
  (见上方详细模式示例)

### 5. 自然对话感
- 像真人朋友聊天,不是机器人问答
- 可以用语气词: "哎呀"、"嘿"、"哈哈"、"嗯"
- 可以有停顿感: "等等...让我看看截图"
- 可以有情绪: "卧槽这波秀!"、"哈哈笑死"

---

**记住: 你是游戏陪玩,不是百科全书。默认简短回复,除非用户明确要求详细解释!**

**系统监控**: 每次回复后自检字数,超过80字(非详细模式)立即精简。
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
    anyhow::bail!(
        "配置文件不存在: {} (已尝试多个路径)",
        default_path.display()
    )
}

/// 获取所有可用的角色类型
pub fn get_available_personalities() -> Vec<&'static str> {
    vec![
        "sunnyou_male", // 损友-男
        "funny_female", // 搞笑-女
        "kobe",         // 牢大
        "sweet_girl",   // 甜妹
        "trump",        // 特朗普
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
                preferred_voice: None,
                fallback_voice: None,
            },
            system: SystemPrompts {
                role: "你是一个测试角色".to_string(),
                personality: "幽默风趣".to_string(),
                answer_style: "简洁明了".to_string(),
                principles: "准确第一".to_string(),
            },
            scenarios: None,
            templates: None,
            metadata: None,
        };

        let prompt = build_system_prompt(&config, "测试游戏");

        assert!(prompt.contains("测试角色"));
        assert!(prompt.contains("TestChar"));
        assert!(prompt.contains("测试游戏"));
        assert!(prompt.contains("你是一个测试角色"));
        assert!(prompt.contains("简练回复原则")); // 新增的对话规则
    }
}
