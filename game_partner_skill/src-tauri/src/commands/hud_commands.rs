/// HUD 浮窗窗口管理
/// 
/// 提供 HUD 浮窗的创建、关闭等命令

use tauri::{AppHandle, Manager, WebviewWindowBuilder, WebviewUrl};
use anyhow::Result;

/// 打开 HUD 浮窗
/// 
/// 创建一个小型、置顶、透明背景的窗口,用于显示 AI 状态
#[tauri::command]
pub async fn open_hud_window(app: AppHandle) -> Result<(), String> {
    log::info!("🎯 准备打开 HUD 浮窗...");

    // 检查窗口是否已存在
    if let Some(window) = app.get_webview_window("hud") {
        log::info!("HUD 窗口已存在,显示并聚焦");
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    // 创建新的 HUD 窗口
    let hud_window = WebviewWindowBuilder::new(
        &app,
        "hud",
        WebviewUrl::App("/hud".into())
    )
    .title("AI 助手 HUD")
    .position(20.0, 20.0)            // 初始位置 (右上角)
    .inner_size(320.0, 100.0)        // 窗口大小
    .min_inner_size(280.0, 80.0)     // 最小尺寸
    .max_inner_size(400.0, 150.0)    // 最大尺寸
    .resizable(false)                // 禁止调整大小
    .decorations(false)              // 无边框
    .transparent(true)               // 透明背景
    .always_on_top(true)             // 置顶
    .skip_taskbar(true)              // 不显示在任务栏
    .focused(false)                  // 不自动聚焦
    .build()
    .map_err(|e| format!("创建 HUD 窗口失败: {}", e))?;

    log::info!("✅ HUD 窗口创建成功");

    // 显示窗口
    hud_window.show().map_err(|e| e.to_string())?;

    Ok(())
}

/// 关闭 HUD 浮窗
#[tauri::command]
pub async fn close_hud_window(app: AppHandle) -> Result<(), String> {
    log::info!("🔽 准备关闭 HUD 浮窗...");

    if let Some(window) = app.get_webview_window("hud") {
        window.close().map_err(|e| e.to_string())?;
        log::info!("✅ HUD 窗口已关闭");
    } else {
        log::warn!("⚠️ HUD 窗口不存在");
    }

    Ok(())
}

/// 切换 HUD 浮窗可见性
#[tauri::command]
pub async fn toggle_hud_window(app: AppHandle) -> Result<bool, String> {
    log::info!("🔄 切换 HUD 浮窗可见性...");

    if let Some(window) = app.get_webview_window("hud") {
        let is_visible = window.is_visible().map_err(|e| e.to_string())?;
        
        if is_visible {
            window.hide().map_err(|e| e.to_string())?;
            log::info!("HUD 窗口已隐藏");
            Ok(false)
        } else {
            window.show().map_err(|e| e.to_string())?;
            log::info!("HUD 窗口已显示");
            Ok(true)
        }
    } else {
        // 如果不存在,创建新窗口
        open_hud_window(app).await?;
        Ok(true)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hud_commands_exist() {
        // 确保命令函数存在
        assert_eq!(std::any::type_name::<fn(AppHandle) -> _>(), 
                   std::any::type_name_of_val(&(open_hud_window as fn(AppHandle) -> _)));
    }
}
