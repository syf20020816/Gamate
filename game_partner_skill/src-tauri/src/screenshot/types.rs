use serde::{Deserialize, Serialize};

/// 截图结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Screenshot {
    /// Base64 编码的图片数据
    pub data: String,
    /// 图片宽度
    pub width: u32,
    /// 图片高度
    pub height: u32,
    /// 截图时间戳（秒）
    pub timestamp: u64,
    /// 显示器 ID
    pub display_id: Option<usize>,
    /// 截图模式
    pub mode: CaptureMode,
}

/// 捕获模式
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CaptureMode {
    /// 全屏
    Fullscreen,
    /// 窗口
    Window,
    /// 区域
    Area,
}

/// 截图区域
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptureArea {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

/// 显示器信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DisplayInfo {
    pub id: usize,
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub is_primary: bool,
}

/// 截图错误
#[derive(Debug, thiserror::Error)]
pub enum ScreenshotError {
    #[error("截图失败: {0}")]
    CaptureFailed(String),
    
    #[error("显示器不存在: {0}")]
    DisplayNotFound(usize),
    
    #[error("图片编码失败: {0}")]
    EncodeFailed(String),
    
    #[error("无效的截图区域")]
    InvalidArea,
    
    #[error("IO 错误: {0}")]
    IoError(#[from] std::io::Error),
}

pub type Result<T> = std::result::Result<T, ScreenshotError>;
