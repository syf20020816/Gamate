use crate::screenshot::*;
use std::sync::Mutex;
use tauri::State;

/// 全局截图器状态
pub struct ScreenshotState {
    capturer: Mutex<Option<ScreenCapturer>>,
}

impl ScreenshotState {
    pub fn new() -> Self {
        Self {
            capturer: Mutex::new(None),
        }
    }

    pub fn get_or_init(&self) -> Result<ScreenCapturer> {
        let mut capturer = self.capturer.lock().unwrap();

        if capturer.is_none() {
            *capturer = Some(ScreenCapturer::new()?);
        }

        Ok(capturer.as_ref().unwrap().clone_capturer())
    }

    pub fn refresh(&self) -> Result<ScreenCapturer> {
        let mut capturer = self.capturer.lock().unwrap();
        let new_capturer = ScreenCapturer::new()?;
        *capturer = Some(new_capturer.clone_capturer());
        Ok(new_capturer)
    }
}

impl Default for ScreenshotState {
    fn default() -> Self {
        Self::new()
    }
}

// 为 ScreenCapturer 添加克隆支持
impl ScreenCapturer {
    fn clone_capturer(&self) -> ScreenCapturer {
        ScreenCapturer::new().expect("无法创建截图器")
    }
}

/// 列出所有显示器
#[tauri::command]
pub async fn list_displays(
    state: State<'_, ScreenshotState>,
) -> std::result::Result<Vec<DisplayInfo>, String> {
    let capturer = state
        .get_or_init()
        .map_err(|e| format!("初始化失败: {}", e))?;

    Ok(capturer.list_displays())
}

/// 全屏截图
#[tauri::command]
pub async fn capture_fullscreen(
    display_id: Option<usize>,
    state: State<'_, ScreenshotState>,
) -> std::result::Result<Screenshot, String> {
    let capturer = state
        .get_or_init()
        .map_err(|e| format!("初始化失败: {}", e))?;

    capturer
        .capture_fullscreen(display_id)
        .map_err(|e| format!("截图失败: {}", e.to_string()))
}

/// 区域截图
#[tauri::command]
pub async fn capture_area(
    area: CaptureArea,
    display_id: Option<usize>,
    state: State<'_, ScreenshotState>,
) -> std::result::Result<Screenshot, String> {
    let capturer = state
        .get_or_init()
        .map_err(|e| format!("初始化失败: {}", e))?;

    capturer
        .capture_area(area, display_id)
        .map_err(|e| format!("截图失败: {}", e.to_string()))
}

/// 刷新显示器列表
#[tauri::command]
pub async fn refresh_displays(
    state: State<'_, ScreenshotState>,
) -> std::result::Result<Vec<DisplayInfo>, String> {
    let capturer = state.refresh().map_err(|e| format!("刷新失败: {}", e))?;

    Ok(capturer.list_displays())
}

/// 列出所有窗口
#[tauri::command]
pub async fn list_windows_command(
) -> std::result::Result<Vec<crate::screenshot::WindowInfo>, String> {
    log::info!("📋 获取窗口列表");
    crate::screenshot::list_windows().map_err(|e| e.to_string())
}

/// 捕获指定窗口
#[tauri::command]
pub async fn capture_window_command(window_id: u32) -> std::result::Result<Screenshot, String> {
    log::info!("🪟 捕获窗口 ID: {}", window_id);
    crate::screenshot::capture_window(window_id).map_err(|e| e.to_string())
}

/// 快速截图 (根据配置自动选择截图方式,返回 Base64 字符串)
#[tauri::command]
pub async fn capture_screenshot(
    state: State<'_, ScreenshotState>,
) -> std::result::Result<String, String> {
    log::info!("📸 执行快速截图");

    // 加载配置
    let settings =
        crate::settings::AppSettings::load().map_err(|e| format!("加载配置失败: {}", e))?;

    let screenshot_config = &settings.screenshot;
    log::info!("📋 截图模式: {}", screenshot_config.capture_mode);

    let screenshot = match screenshot_config.capture_mode.as_str() {
        "window" => {
            // 窗口截图
            if let Some(window_id) = screenshot_config.target_window_id {
                log::info!(
                    "🪟 捕获窗口: {} (ID: {})",
                    screenshot_config
                        .target_window_name
                        .as_deref()
                        .unwrap_or("未知"),
                    window_id
                );
                crate::screenshot::capture_window(window_id)
                    .map_err(|e| format!("窗口截图失败: {}", e))?
            } else {
                log::warn!("⚠️  窗口模式但未设置窗口 ID,回退到全屏截图");
                let capturer = state
                    .get_or_init()
                    .map_err(|e| format!("初始化失败: {}", e))?;
                capturer
                    .capture_fullscreen(None)
                    .map_err(|e| format!("全屏截图失败: {}", e))?
            }
        }
        "fullscreen" | _ => {
            // 全屏截图 (默认)
            log::info!("🖥️  全屏截图");
            let capturer = state
                .get_or_init()
                .map_err(|e| format!("初始化失败: {}", e))?;
            capturer
                .capture_fullscreen(None)
                .map_err(|e| format!("全屏截图失败: {}", e))?
        }
    };

    log::info!("✅ 截图完成: {}x{}", screenshot.width, screenshot.height);

    // 返回 Base64 字符串
    Ok(screenshot.data)
}
