/// 智能截图命令接口

use tauri::{AppHandle, State};
use std::sync::Mutex;
use crate::livestream::{SmartCaptureManager, SmartCaptureConfig};

/// 全局智能截图管理器状态
pub struct SmartCaptureState {
    manager: Mutex<Option<SmartCaptureManager>>,
}

impl SmartCaptureState {
    pub fn new() -> Self {
        Self {
            manager: Mutex::new(None),
        }
    }
}

impl Default for SmartCaptureState {
    fn default() -> Self {
        Self::new()
    }
}

/// 开始智能截图+语音识别
#[tauri::command]
pub async fn start_smart_capture(
    app: AppHandle,
    state: State<'_, SmartCaptureState>,
    config: Option<SmartCaptureConfig>,
) -> Result<String, String> {
    log::info!("🎬 收到启动智能截图命令");

    let config = config.unwrap_or_default();
    
    log::info!("📋 配置: 截图模式={}, 双截图={}", 
              config.capture_mode, 
              config.enable_dual_screenshot);

    // 创建管理器
    let mut manager = SmartCaptureManager::new(app.clone(), config);

    // 启动
    manager.start().await.map_err(|e| {
        log::error!("❌ 启动智能截图失败: {}", e);
        e.to_string()
    })?;

    // 保存到全局状态
    {
        let mut state_guard = state.manager.lock().unwrap();
        *state_guard = Some(manager);
    }

    log::info!("✅ 智能截图系统已启动");
    Ok("智能截图已启动".to_string())
}

/// 停止智能截图+语音识别
#[tauri::command]
pub async fn stop_smart_capture(
    state: State<'_, SmartCaptureState>,
) -> Result<String, String> {
    log::info!("⏹️ 收到停止智能截图命令");

    let mut state_guard = state.manager.lock().unwrap();
    
    if let Some(manager) = state_guard.as_mut() {
        manager.stop().map_err(|e| {
            log::error!("❌ 停止智能截图失败: {}", e);
            e.to_string()
        })?;
        
        *state_guard = None;
        
        log::info!("✅ 智能截图系统已停止");
        Ok("智能截图已停止".to_string())
    } else {
        log::warn!("⚠️ 智能截图未运行");
        Err("智能截图未运行".to_string())
    }
}

/// 获取智能截图状态
#[tauri::command]
pub async fn get_smart_capture_status(
    state: State<'_, SmartCaptureState>,
) -> Result<bool, String> {
    let state_guard = state.manager.lock().unwrap();
    
    if let Some(manager) = state_guard.as_ref() {
        Ok(manager.is_running())
    } else {
        Ok(false)
    }
}
