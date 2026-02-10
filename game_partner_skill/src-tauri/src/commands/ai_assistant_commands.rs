use crate::settings::AppSettings;
use anyhow::Result;

/// AI 助手状态
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AIAssistantState {
    pub is_running: bool,
    pub current_game: Option<String>,
    pub screenshot_enabled: bool,
}

/// 启动 AI 助手
#[tauri::command]
pub async fn start_ai_assistant(game_id: String) -> Result<AIAssistantState, String> {
    start_ai_assistant_impl(game_id)
        .await
        .map_err(|e| format!("启动 AI 助手失败: {}", e))
}

/// 停止 AI 助手
#[tauri::command]
pub async fn stop_ai_assistant() -> Result<AIAssistantState, String> {
    stop_ai_assistant_impl()
        .await
        .map_err(|e| format!("停止 AI 助手失败: {}", e))
}

/// 获取 AI 助手状态
#[tauri::command]
pub async fn get_ai_assistant_state() -> Result<AIAssistantState, String> {
    get_ai_assistant_state_impl()
        .await
        .map_err(|e| format!("获取 AI 助手状态失败: {}", e))
}

/// 启动 AI 助手 (内部实现)
async fn start_ai_assistant_impl(game_id: String) -> Result<AIAssistantState> {
    log::info!("🤖 启动 AI 助手");
    log::info!("   游戏: {}", game_id);

    // 1. 加载设置
    let settings = AppSettings::load()?;
    let screenshot_config = &settings.screenshot;

    log::info!("📸 截图配置:");
    log::info!("   启用: {}", screenshot_config.enabled);
    log::info!(
        "   活跃间隔: {} 秒",
        screenshot_config.active_interval_seconds
    );
    log::info!(
        "   闲置间隔: {} 秒",
        screenshot_config.idle_interval_seconds
    );
    log::info!("   自动发送 AI: {}", screenshot_config.auto_send_to_ai);

    // 2. 验证截图是否启用
    if !screenshot_config.enabled {
        log::warn!("⚠️  截图功能未启用,请在设置中启用");
    }

    // 3. TODO: 启动定时截图任务
    // 这里需要与现有的截图模块集成
    // 可以通过发送事件或调用截图服务来启动

    // 4. 返回状态
    Ok(AIAssistantState {
        is_running: true,
        current_game: Some(game_id),
        screenshot_enabled: screenshot_config.enabled,
    })
}

/// 停止 AI 助手 (内部实现)
async fn stop_ai_assistant_impl() -> Result<AIAssistantState> {
    log::info!("🛑 停止 AI 助手");

    // TODO: 停止定时截图任务

    Ok(AIAssistantState {
        is_running: false,
        current_game: None,
        screenshot_enabled: false,
    })
}

/// 获取 AI 助手状态 (内部实现)
async fn get_ai_assistant_state_impl() -> Result<AIAssistantState> {
    // TODO: 从全局状态获取实际状态
    // 目前返回默认状态
    Ok(AIAssistantState {
        is_running: false,
        current_game: None,
        screenshot_enabled: false,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_ai_assistant_lifecycle() {
        // 测试启动
        let start_result = start_ai_assistant_impl("phasmophobia".to_string()).await;
        assert!(start_result.is_ok());
        let state = start_result.unwrap();
        assert!(state.is_running);
        assert_eq!(state.current_game, Some("phasmophobia".to_string()));

        // 测试停止
        let stop_result = stop_ai_assistant_impl().await;
        assert!(stop_result.is_ok());
        let state = stop_result.unwrap();
        assert!(!state.is_running);
    }
}
