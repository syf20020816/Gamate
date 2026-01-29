use super::types::*;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use std::sync::Mutex;

/// 区域选择器状态
pub struct AreaSelectorState {
    selected_area: Mutex<Option<CaptureArea>>,
    is_cancelled: Mutex<bool>,
}

impl AreaSelectorState {
    pub fn new() -> Self {
        Self {
            selected_area: Mutex::new(None),
            is_cancelled: Mutex::new(false),
        }
    }

    pub fn set_area(&self, area: CaptureArea) {
        let mut selected = self.selected_area.lock().unwrap();
        *selected = Some(area);
    }

    pub fn take_area(&self) -> Option<CaptureArea> {
        let mut selected = self.selected_area.lock().unwrap();
        selected.take()
    }

    pub fn cancel(&self) {
        let mut cancelled = self.is_cancelled.lock().unwrap();
        *cancelled = true;
    }

    pub fn is_cancelled(&self) -> bool {
        *self.is_cancelled.lock().unwrap()
    }

    pub fn reset(&self) {
        let mut selected = self.selected_area.lock().unwrap();
        *selected = None;
        let mut cancelled = self.is_cancelled.lock().unwrap();
        *cancelled = false;
    }
}

impl Default for AreaSelectorState {
    fn default() -> Self {
        Self::new()
    }
}

/// 显示区域选择窗口
pub async fn show_area_selector(app: &AppHandle) -> Result<CaptureArea> {
    log::info!("🎯 打开区域选择窗口");

    // 检查窗口是否已存在
    if let Some(window) = app.get_webview_window("area-selector") {
        log::info!("关闭已存在的选择窗口");
        let _ = window.close();
        // 等待窗口关闭
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    }

    // 创建全屏透明窗口
    let selector_window = WebviewWindowBuilder::new(
        app,
        "area-selector",
        WebviewUrl::App("selector.html".into()),
    )
    .title("选择截图区域")
    .fullscreen(true)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .visible(false) // 先隐藏，加载完成后显示
    .focusable(true) // 确保窗口可以获得焦点
    .accept_first_mouse(true) // 接受第一次鼠标点击
    .build()
    .map_err(|e| ScreenshotError::CaptureFailed(format!("创建选择窗口失败: {}", e)))?;

    log::info!("✅ 选择窗口已创建");

    // 显示窗口
    selector_window
        .show()
        .map_err(|e| ScreenshotError::CaptureFailed(format!("显示窗口失败: {}", e)))?;

    // 等待窗口完全显示
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    // 将窗口置于最前并设置焦点
    selector_window
        .set_focus()
        .map_err(|e| ScreenshotError::CaptureFailed(format!("设置焦点失败: {}", e)))?;
    
    // 再次确保焦点
    tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
    let _ = selector_window.set_focus(); // 忽略错误

    log::info!("✅ 选择窗口已显示并获得焦点");

    // 获取状态
    let state = app.state::<AreaSelectorState>();
    state.reset();

    // 等待用户选择（轮询检查）
    let mut timeout_count = 0;
    let max_timeout = 300; // 30秒超时 (100ms * 300)

    loop {
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        // 检查是否取消
        if state.is_cancelled() {
            log::info!("❌ 用户取消了选择");
            let _ = selector_window.close();
            return Err(ScreenshotError::CaptureFailed("用户取消选择".to_string()));
        }

        // 检查是否有选择结果
        if let Some(area) = state.take_area() {
            log::info!("✅ 用户选择了区域: {}x{} @ ({}, {})", 
                area.width, area.height, area.x, area.y);
            let _ = selector_window.close();
            return Ok(area);
        }

        // 超时检查
        timeout_count += 1;
        if timeout_count > max_timeout {
            log::warn!("⏰ 选择超时");
            let _ = selector_window.close();
            return Err(ScreenshotError::CaptureFailed("选择超时".to_string()));
        }
    }
}
