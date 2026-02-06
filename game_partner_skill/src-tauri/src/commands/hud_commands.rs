/// HUD 浮窗窗口管理
/// 
/// 提供 HUD 浮窗的创建、关闭等命令

use tauri::{AppHandle, Manager, WebviewWindowBuilder, WebviewUrl};
use anyhow::Result;
use crate::settings::AppSettings;

/// 打开 HUD 浮窗
/// 
/// 创建一个小型、置顶、透明背景的窗口,用于显示 AI 状态
#[tauri::command]
pub async fn open_hud_window(app: AppHandle) -> Result<(), String> {

    // 检查窗口是否已存在
    if let Some(window) = app.get_webview_window("hud") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        
        // 🔧 自动打开 DevTools 方便调试 (已注释)
        // #[cfg(debug_assertions)]
        // {
        //     window.open_devtools();
        // }
        
        return Ok(());
    }

    // 读取保存的位置
    let settings = AppSettings::load().map_err(|e| e.to_string())?;
    let (pos_x, pos_y) = if let Some(pos) = settings.general.hud_position {
        (pos.x, pos.y)
    } else {
        (20.0, 20.0)  // 默认位置
    };

    // 创建新的 HUD 窗口
    let hud_window = WebviewWindowBuilder::new(
        &app,
        "hud",
        WebviewUrl::App("/hud".into())
    )
    .title("AI 助手 HUD")
    .position(pos_x, pos_y)          // 使用保存的位置
    .inner_size(320.0, 180.0)        // 窗口大小
    .min_inner_size(280.0, 180.0)     // 最小尺寸
    .max_inner_size(400.0, 180.0)    // 最大尺寸
    .resizable(false)                // 禁止调整大小
    .decorations(false)              // 无边框
    .transparent(true)               // 透明背景
    .always_on_top(true)             // 置顶
    .skip_taskbar(true)              // 不显示在任务栏
    .focused(false)                  // 不自动聚焦
    .build()
    .map_err(|e| format!("创建 HUD 窗口失败: {}", e))?;

    // 监听窗口移动事件,自动保存位置
    let app_clone = app.clone();
    hud_window.on_window_event(move |event| {
        if let tauri::WindowEvent::Moved(position) = event {
            // 先提取位置值,避免借用检查问题
            let x = position.x as f64;
            let y = position.y as f64;
            let app_for_save = app_clone.clone();
            
            tauri::async_runtime::spawn(async move {
                if let Err(e) = save_hud_position(app_for_save, x, y).await {
                    log::error!("保存 HUD 位置失败: {}", e);
                }
            });
        }
    });

    // 显示窗口
    hud_window.show().map_err(|e| e.to_string())?;
    
    // 🔧 自动打开 DevTools 方便调试 (已注释)
    // #[cfg(debug_assertions)]
    // {
    //     hud_window.open_devtools();
    // }

    Ok(())
}

/// 关闭 HUD 浮窗
#[tauri::command]
pub async fn close_hud_window(app: AppHandle) -> Result<(), String> {

    if let Some(window) = app.get_webview_window("hud") {
        window.close().map_err(|e| e.to_string())?;
       
    } else {
        println!("⚠️ HUD 窗口不存在");
    }

    Ok(())
}

/// 切换 HUD 浮窗可见性
#[tauri::command]
pub async fn toggle_hud_window(app: AppHandle) -> Result<bool, String> {
    

    if let Some(window) = app.get_webview_window("hud") {
        let is_visible = window.is_visible().map_err(|e| e.to_string())?;
        
        if is_visible {
            window.hide().map_err(|e| e.to_string())?;
            
            Ok(false)
        } else {
            window.show().map_err(|e| e.to_string())?;
           
            Ok(true)
        }
    } else {
        // 如果不存在,创建新窗口
        open_hud_window(app).await?;
        Ok(true)
    }
}

/// 保存 HUD 窗口位置到配置文件
async fn save_hud_position(app: AppHandle, x: f64, y: f64) -> Result<(), String> {
    use crate::settings::HudPosition;
    let mut settings = AppSettings::load().map_err(|e| e.to_string())?;
    settings.general.hud_position = Some(HudPosition { x, y });
    settings.save().map_err(|e| e.to_string())?;
    Ok(())
}

/// 检查 HUD 窗口是否可见
#[tauri::command]
pub async fn is_hud_window_visible(app: AppHandle) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("hud") {
        window.is_visible().map_err(|e| e.to_string())
    } else {
        Ok(false)
    }
}

/// 打开 HUD 窗口的 DevTools
#[tauri::command]
pub async fn open_hud_devtools(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("hud") {
        window.open_devtools();
        Ok(())
    } else {
        Err("HUD 窗口不存在".to_string())
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
