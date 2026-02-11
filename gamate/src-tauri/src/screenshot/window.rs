use super::types::*;
use xcap::Window;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct WindowInfo {
    pub id: u32,
    pub title: String,
    pub app_name: String,
    pub width: u32,
    pub height: u32,
    pub x: i32,
    pub y: i32,
}

/// 获取所有可见窗口列表
pub fn list_windows() -> Result<Vec<WindowInfo>> {
    log::info!("📋 开始枚举窗口");

    let windows = Window::all()
        .map_err(|e| ScreenshotError::CaptureFailed(format!("枚举窗口失败: {}", e)))?;

    let window_list: Vec<WindowInfo> = windows
        .into_iter()
        .filter_map(|w| {
            // 过滤掉太小的窗口或获取信息失败的窗口
            let width = w.width().ok()?;
            let height = w.height().ok()?;
            if width > 100 && height > 100 {
                Some(w)
            } else {
                None
            }
        })
        .filter_map(|w| {
            Some(WindowInfo {
                id: w.id().ok()?,
                title: w.title().ok()?,
                app_name: w.app_name().ok()?,
                width: w.width().ok()?,
                height: w.height().ok()?,
                x: w.x().ok()?,
                y: w.y().ok()?,
            })
        })
        .collect();

    log::info!("✅ 找到 {} 个窗口", window_list.len());
    Ok(window_list)
}

/// 捕获指定窗口
pub fn capture_window(window_id: u32) -> Result<Screenshot> {
    // 获取所有窗口
    let windows = Window::all()
        .map_err(|e| ScreenshotError::CaptureFailed(format!("枚举窗口失败: {}", e)))?;

    // 查找目标窗口
    let target_window = windows
        .into_iter()
        .find(|w| w.id().ok() == Some(window_id))
        .ok_or_else(|| ScreenshotError::CaptureFailed(format!("未找到窗口 ID: {}", window_id)))?;

    let title = target_window
        .title()
        .unwrap_or_else(|_| "Unknown".to_string());
    let app_name = target_window
        .app_name()
        .unwrap_or_else(|_| "Unknown".to_string());
    log::info!("捕获窗口: {} ({})", title, app_name);

    // 捕获窗口图像
    let image = target_window
        .capture_image()
        .map_err(|e| ScreenshotError::CaptureFailed(format!("窗口捕获失败: {}", e)))?;

    let width = image.width();
    let height = image.height();

    // 转换为字节
    let raw_data = image.into_raw();

    // 使用我们项目的 image crate 重新创建图像
    use image::{ImageBuffer, Rgba};
    let img = ImageBuffer::<Rgba<u8>, _>::from_raw(width, height, raw_data)
        .ok_or_else(|| ScreenshotError::CaptureFailed("创建图像失败".to_string()))?;

    // 使用智能压缩编码图片
    let dynamic_img = image::DynamicImage::ImageRgba8(img);
    let data = encode_image_smart(dynamic_img)?;

    Ok(Screenshot {
        data,
        width,
        height,
        timestamp: chrono::Utc::now().timestamp() as u64,
        display_id: None,
        mode: CaptureMode::Window,
    })
}

/// 智能编码图片为 Base64
/// - 小于 400KB: 不压缩
/// - 大于 400KB: 压缩到原大小的 70%
fn encode_image_smart(img: image::DynamicImage) -> Result<String> {
    use std::io::Cursor;

    let (original_width, original_height) = (img.width(), img.height());

    // 先编码一次,获取实际文件大小
    let mut temp_buffer = Cursor::new(Vec::new());
    img.write_to(&mut temp_buffer, image::ImageFormat::Png)
        .map_err(|e| ScreenshotError::EncodeFailed(e.to_string()))?;

    let original_size = temp_buffer.into_inner().len();
    let original_size_kb = original_size / 1024;


    // 策略1: 小于 400KB, 不压缩
    let optimized_img = if original_size < 400 * 1024 {
        img
    } else {
        // 策略2: 大于 400KB, 压缩到 80%
        let target_size = (original_size as f64 * 0.8) as usize;

        // 计算缩放比例 (估算 PNG 压缩率为 50-70%, 每像素约 2 字节)
        let current_estimated_size = (original_width * original_height * 2) as usize;
        let scale_ratio = (target_size as f64 / current_estimated_size as f64).sqrt();
        let new_width = ((original_width as f64) * scale_ratio).round() as u32;
        let new_height = ((original_height as f64) * scale_ratio).round() as u32;

        log::info!(
            "缩放窗口截图: {}x{} → {}x{} (缩放比 {:.2})",
            original_width, original_height, new_width, new_height, scale_ratio
        );

        img.resize(new_width, new_height, image::imageops::FilterType::Lanczos3)
    };

    // 最终编码
    let mut final_buffer = Cursor::new(Vec::new());
    optimized_img
        .write_to(&mut final_buffer, image::ImageFormat::Png)
        .map_err(|e| ScreenshotError::EncodeFailed(e.to_string()))?;

    let png_data = final_buffer.into_inner();

    // Base64 编码
    let base64_data = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &png_data);

    Ok(format!("data:image/png;base64,{}", base64_data))
}
