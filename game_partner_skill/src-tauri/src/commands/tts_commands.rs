/// TTS 命令模块
///
/// 提供给前端调用的 TTS 相关 Tauri 命令
///
use crate::tts;
use anyhow::{Context, Result};

/// 播报文本 (Tauri 命令)
#[tauri::command]
pub async fn speak_text(text: String, interrupt: bool) -> Result<(), String> {
    speak_text_impl(text, interrupt)
        .await
        .map_err(|e| format!("播报失败: {}", e))
}

/// 停止播报 (Tauri 命令)
#[tauri::command]
pub async fn stop_speaking() -> Result<(), String> {
    stop_speaking_impl()
        .await
        .map_err(|e| format!("停止播报失败: {}", e))
}

/// 设置语速 (Tauri 命令)
#[tauri::command]
pub async fn set_tts_rate(rate: f32) -> Result<(), String> {
    set_tts_rate_impl(rate)
        .await
        .map_err(|e| format!("设置语速失败: {}", e))
}

/// 设置音量 (Tauri 命令)
#[tauri::command]
pub async fn set_tts_volume(volume: f32) -> Result<(), String> {
    set_tts_volume_impl(volume)
        .await
        .map_err(|e| format!("设置音量失败: {}", e))
}

/// 获取可用音色列表 (Tauri 命令)
#[tauri::command]
pub async fn get_tts_voices() -> Result<Vec<String>, String> {
    get_tts_voices_impl()
        .await
        .map_err(|e| format!("获取音色列表失败: {}", e))
}

/// 设置音色 (Tauri 命令)
#[tauri::command]
pub async fn set_tts_voice(voice_name: String) -> Result<(), String> {
    set_tts_voice_impl(voice_name)
        .await
        .map_err(|e| format!("设置音色失败: {}", e))
}

/// 根据角色类型自动应用推荐语音 (Tauri 命令)
#[tauri::command]
pub async fn apply_personality_voice(personality_type: String) -> Result<(), String> {
    apply_personality_voice_impl(personality_type)
        .await
        .map_err(|e| format!("应用角色语音失败: {}", e))
}

// ============================================================================
// 内部实现
// ============================================================================

async fn speak_text_impl(text: String, interrupt: bool) -> Result<()> {
    log::info!(
        "🔊 播报请求: {} (打断: {})",
        &text[..text.len().min(50)],
        interrupt
    );

    let engine = tts::get_tts_engine()?;
    engine.speak(text, interrupt)?;

    Ok(())
}

async fn stop_speaking_impl() -> Result<()> {
    log::info!("🛑 停止播报");

    let engine = tts::get_tts_engine()?;
    engine.stop()?;

    Ok(())
}

async fn set_tts_rate_impl(rate: f32) -> Result<()> {
    log::info!("🎚️ 设置语速: {}", rate);

    // 验证范围
    if !(0.1..=10.0).contains(&rate) {
        anyhow::bail!("语速必须在 0.1 - 10.0 之间");
    }

    let engine = tts::get_tts_engine()?;
    engine.set_rate(rate)?;

    Ok(())
}

async fn set_tts_volume_impl(volume: f32) -> Result<()> {
    log::info!("🔊 设置音量: {}", volume);

    // 验证范围
    if !(0.0..=1.0).contains(&volume) {
        anyhow::bail!("音量必须在 0.0 - 1.0 之间");
    }

    let engine = tts::get_tts_engine()?;
    engine.set_volume(volume)?;

    Ok(())
}

async fn get_tts_voices_impl() -> Result<Vec<String>> {
    log::info!("🎤 获取音色列表");

    let engine = tts::get_tts_engine()?;
    let voices = engine.get_voices()?;

    log::info!("   找到 {} 个音色", voices.len());

    Ok(voices)
}

async fn set_tts_voice_impl(voice_name: String) -> Result<()> {
    log::info!("🎤 设置音色: {}", voice_name);

    let engine = tts::get_tts_engine()?;
    engine.set_voice(&voice_name)?;

    Ok(())
}

async fn apply_personality_voice_impl(personality_type: String) -> Result<()> {
    use crate::personality;

    log::info!("🎭 应用角色语音: {}", personality_type);

    // 加载角色配置
    let personality_config = personality::load_personality(&personality_type)
        .with_context(|| format!("无法加载角色配置: {}", personality_type))?;

    // 获取推荐语音
    let preferred_voice = personality_config.character.preferred_voice.clone();
    let fallback_voice = personality_config.character.fallback_voice.clone();

    let voice_name = preferred_voice
        .or(fallback_voice.clone())
        .unwrap_or_else(|| {
            // 如果配置中没有指定,根据性别选择默认语音
            match personality_config.character.gender.as_str() {
                "male" => "Microsoft Kangkang - Chinese (Simplified, PRC)".to_string(),
                "female" => "Microsoft Huihui - Chinese (Simplified, PRC)".to_string(),
                _ => "Microsoft Kangkang - Chinese (Simplified, PRC)".to_string(),
            }
        });

    log::info!("   推荐语音: {}", voice_name);

    // 获取可用语音列表
    let engine = tts::get_tts_engine()?;
    let available_voices = engine.get_voices()?;

    // 检查推荐语音是否可用
    if available_voices.contains(&voice_name) {
        log::info!("   ✅ 应用推荐语音");
        engine.set_voice(&voice_name)?;
    } else {
        // 如果推荐语音不可用,尝试备用语音
        if let Some(fallback) = fallback_voice {
            if available_voices.contains(&fallback) {
                log::info!("   ⚠️ 推荐语音不可用,使用备用语音: {}", fallback);
                engine.set_voice(&fallback)?;
                return Ok(());
            }
        }

        // 如果都不可用,根据性别选择第一个匹配的语音
        log::warn!("   ⚠️ 推荐语音不可用,尝试根据性别匹配");
        let gender_keyword = match personality_config.character.gender.as_str() {
            "male" => vec!["Kangkang", "Jenny", "David"],
            "female" => vec!["Huihui", "Yaoyao", "Jenny"],
            _ => vec!["Kangkang", "Huihui"],
        };

        for keyword in gender_keyword {
            if let Some(voice) = available_voices.iter().find(|v| v.contains(keyword)) {
                log::info!("   ✅ 使用匹配语音: {}", voice);
                engine.set_voice(voice)?;
                return Ok(());
            }
        }

        log::warn!("   ⚠️ 未找到合适语音,保持当前设置");
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_speak() {
        let result = speak_text_impl("测试播报".to_string(), false).await;
        assert!(result.is_ok());

        // 等待播报完成
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
    }

    #[tokio::test]
    async fn test_rate() {
        let result = set_tts_rate_impl(1.5).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_volume() {
        let result = set_tts_volume_impl(0.8).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_apply_personality_voice() {
        let result = apply_personality_voice_impl("客服".to_string()).await;
        assert!(result.is_ok());
    }
}
