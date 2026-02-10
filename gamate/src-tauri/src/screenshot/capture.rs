use super::types::*;
use base64::{engine::general_purpose, Engine};
use image::{DynamicImage, ImageFormat};
use screenshots::Screen;
use std::io::Cursor;
use std::time::{SystemTime, UNIX_EPOCH};

/// 屏幕截图器
pub struct ScreenCapturer {
    screens: Vec<Screen>,
}

impl ScreenCapturer {
    /// 创建新的截图器
    pub fn new() -> Result<Self> {
        let screens = Screen::all().map_err(|e| ScreenshotError::CaptureFailed(e.to_string()))?;

        log::info!("检测到 {} 个显示器", screens.len());

        Ok(Self { screens })
    }

    /// 获取所有显示器信息
    pub fn list_displays(&self) -> Vec<DisplayInfo> {
        self.screens
            .iter()
            .enumerate()
            .map(|(idx, screen)| DisplayInfo {
                id: idx,
                name: format!("Display {}", idx + 1),
                width: screen.display_info.width,
                height: screen.display_info.height,
                is_primary: idx == 0, // 简化：假设第一个是主显示器
            })
            .collect()
    }

    /// 全屏截图
    pub fn capture_fullscreen(&self, display_id: Option<usize>) -> Result<Screenshot> {
        let display_id = display_id.unwrap_or(0);

        let screen = self
            .screens
            .get(display_id)
            .ok_or(ScreenshotError::DisplayNotFound(display_id))?;

        log::info!("开始全屏截图，显示器 {}", display_id);

        let image = screen
            .capture()
            .map_err(|e| ScreenshotError::CaptureFailed(e.to_string()))?;

        let width = image.width();
        let height = image.height();

        // 转换为 Base64
        let data = self.encode_image(&image)?;

        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        log::info!("✅ 截图完成: {}x{}, {} bytes", width, height, data.len());

        Ok(Screenshot {
            data,
            width,
            height,
            timestamp,
            display_id: Some(display_id),
            mode: CaptureMode::Fullscreen,
        })
    }

    /// 区域截图
    pub fn capture_area(&self, area: CaptureArea, display_id: Option<usize>) -> Result<Screenshot> {
        let display_id = display_id.unwrap_or(0);

        let screen = self
            .screens
            .get(display_id)
            .ok_or(ScreenshotError::DisplayNotFound(display_id))?;

        // 验证区域有效性
        if area.width == 0 || area.height == 0 {
            return Err(ScreenshotError::InvalidArea);
        }

        log::info!(
            "开始区域截图: {}x{} at ({}, {})",
            area.width,
            area.height,
            area.x,
            area.y
        );

        // 先截取全屏
        let full_image = screen
            .capture()
            .map_err(|e| ScreenshotError::CaptureFailed(e.to_string()))?;

        // 裁剪指定区域
        let cropped = self.crop_image(&full_image, &area)?;

        let width = cropped.width();
        let height = cropped.height();

        // 转换为 Base64
        let data = self.encode_image(&cropped)?;

        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        log::info!("✅ 区域截图完成: {}x{}", width, height);

        Ok(Screenshot {
            data,
            width,
            height,
            timestamp,
            display_id: Some(display_id),
            mode: CaptureMode::Area,
        })
    }

    /// 裁剪图片
    fn crop_image(&self, image: &image::RgbaImage, area: &CaptureArea) -> Result<image::RgbaImage> {
        let x = area.x.max(0) as u32;
        let y = area.y.max(0) as u32;
        let width = area.width.min(image.width() - x);
        let height = area.height.min(image.height() - y);

        Ok(image::imageops::crop_imm(image, x, y, width, height).to_image())
    }

    /// 编码图片为 Base64 (优化版：压缩到 200KB 左右)
    fn encode_image(&self, image: &image::RgbaImage) -> Result<String> {
        use image::DynamicImage;

        let dynamic_img = DynamicImage::ImageRgba8(image.clone());

        // 优化图片大小 (目标 200KB)
        let optimized_img = self.optimize_image(dynamic_img, 200 * 1024)?;

        let mut buffer = Cursor::new(Vec::new());

        optimized_img
            .write_to(&mut buffer, ImageFormat::Png)
            .map_err(|e| ScreenshotError::EncodeFailed(e.to_string()))?;

        let png_data = buffer.into_inner();
        log::info!("📦 图片优化完成: {} KB", png_data.len() / 1024);

        let base64_data = general_purpose::STANDARD.encode(&png_data);

        Ok(format!("data:image/png;base64,{}", base64_data))
    }

    /// 优化图片大小 (缩放到目标文件大小)
    fn optimize_image(&self, img: DynamicImage, target_size_bytes: usize) -> Result<DynamicImage> {
        let (original_width, original_height) = (img.width(), img.height());

        // 估算当前大小 (PNG 压缩率约 50-70%, 假设每像素 2 字节)
        let current_estimated_size = (original_width * original_height * 2) as usize;

        if current_estimated_size <= target_size_bytes {
            return Ok(img); // 已经足够小
        }

        // 计算缩放比例 (保持宽高比)
        let scale_ratio = (target_size_bytes as f64 / current_estimated_size as f64).sqrt();
        let new_width = ((original_width as f64) * scale_ratio).round() as u32;
        let new_height = ((original_height as f64) * scale_ratio).round() as u32;

        log::info!(
            "🔍 缩放图片: {}x{} → {}x{} (缩放比 {:.2})",
            original_width,
            original_height,
            new_width,
            new_height,
            scale_ratio
        );

        // 使用高质量的 Lanczos3 滤波器缩放
        Ok(img.resize(new_width, new_height, image::imageops::FilterType::Lanczos3))
    }
}

impl Default for ScreenCapturer {
    fn default() -> Self {
        Self::new().expect("无法初始化屏幕截图器")
    }
}
