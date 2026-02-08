/// 直播间智能截图+语音识别系统
/// 
/// 功能：
/// 1. 持续监听主播语音（使用优化的 VAD 配置）
/// 2. 语音开始时截图（记录游戏初始状态）
/// 3. 语音结束时截图（记录游戏变化状态）
/// 4. 将双截图+语音文本发送给多模态 AI 分析
///
/// VAD 配置优化（直播间场景）：
/// - 音量阈值：0.035（避免游戏音效误触发）
/// - 静音判定：2.5秒（允许主播思考暂停）
/// - 最短语音：0.5秒（过滤短促噪音）
/// - 最长语音：60秒（支持连续讲解）

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tokio::sync::mpsc;
use tokio::task::JoinHandle;
use tauri::{AppHandle, Emitter, Manager};

use crate::audio::{
    continuous_listener::ContinuousListener,
    recorder::RecorderConfig,
    vad::VadConfig,
};
use crate::screenshot::Screenshot;
use crate::commands::screen_commands::ScreenshotState;

/// 智能截图事件
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type")]
pub enum SmartCaptureEvent {
    /// 开始说话（已截图）
    SpeechStarted {
        screenshot_start: Screenshot,
        timestamp: u64,
    },
    /// 结束说话（已截图+识别）
    SpeechEnded {
        screenshot_start: Screenshot,
        screenshot_end: Screenshot,
        transcription: String,
        duration_secs: f32,
        timestamp: u64,
    },
    /// 识别失败
    RecognitionFailed {
        screenshot_start: Screenshot,
        screenshot_end: Screenshot,
        error: String,
        timestamp: u64,
    },
    /// 错误
    Error {
        message: String,
    },
}

/// 直播间智能截图配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmartCaptureConfig {
    /// 截图模式（"window" 或 "fullscreen"）
    pub capture_mode: String,
    /// 目标窗口 ID（窗口模式时使用）
    pub target_window_id: Option<u32>,
    /// 是否启用双截图
    pub enable_dual_screenshot: bool,
    /// VAD 配置
    pub vad_config: VadConfigDto,
}

impl Default for SmartCaptureConfig {
    fn default() -> Self {
        Self {
            capture_mode: "fullscreen".to_string(),
            target_window_id: None,
            enable_dual_screenshot: true,
            vad_config: VadConfigDto::livestream_optimized(),
        }
    }
}

/// VAD 配置 DTO（用于前端通信）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VadConfigDto {
    pub volume_threshold: f32,
    pub silence_duration_secs: f32,
    pub min_speech_duration_secs: f32,
    pub max_speech_duration_secs: f32,
}

impl VadConfigDto {
    /// 直播间优化配置
    pub fn livestream_optimized() -> Self {
        Self {
            volume_threshold: 0.035,          // 避免游戏音效误触发
            silence_duration_secs: 2.5,       // 允许主播思考暂停
            min_speech_duration_secs: 0.5,    // 过滤短促噪音
            max_speech_duration_secs: 60.0,   // 支持连续讲解
        }
    }
}

impl From<VadConfigDto> for VadConfig {
    fn from(dto: VadConfigDto) -> Self {
        VadConfig {
            volume_threshold: dto.volume_threshold,
            silence_duration_secs: dto.silence_duration_secs,
            min_speech_duration_secs: dto.min_speech_duration_secs,
            max_speech_duration_secs: dto.max_speech_duration_secs,
            rms_window_size: 1024, // 固定值
        }
    }
}

/// 智能截图管理器
pub struct SmartCaptureManager {
    app: AppHandle,
    config: SmartCaptureConfig,
    
    /// 语音监听器
    listener: Option<ContinuousListener>,
    
    /// 当前会话的开始截图（临时存储）
    current_screenshot_start: Arc<Mutex<Option<Screenshot>>>,
    
    /// 是否正在运行
    is_running: Arc<Mutex<bool>>,
    
    /// 监听任务句柄
    listen_task: Option<JoinHandle<()>>,
}

impl SmartCaptureManager {
    /// 创建新的智能截图管理器
    pub fn new(app: AppHandle, config: SmartCaptureConfig) -> Self {
        Self {
            app,
            config,
            listener: None,
            current_screenshot_start: Arc::new(Mutex::new(None)),
            is_running: Arc::new(Mutex::new(false)),
            listen_task: None,
        }
    }

    /// 开始智能截图+语音识别
    pub async fn start(&mut self) -> Result<()> {
        // 检查是否已运行
        {
            let mut running = self.is_running.lock().unwrap();
            if *running {
                return Err(anyhow::anyhow!("智能截图已在运行中"));
            }
            *running = true;
        }

        log::info!("🎬 启动直播间智能截图系统");
        log::info!("📋 VAD 配置: 音量阈值={}, 静音判定={}秒, 最短语音={}秒, 最长语音={}秒",
                  self.config.vad_config.volume_threshold,
                  self.config.vad_config.silence_duration_secs,
                  self.config.vad_config.min_speech_duration_secs,
                  self.config.vad_config.max_speech_duration_secs);

        // 创建语音监听器
        let vad_config: VadConfig = self.config.vad_config.clone().into();
        let recorder_config = RecorderConfig::default();
        let mut listener = ContinuousListener::new(vad_config, recorder_config);

        // 设置事件回调
        let app = self.app.clone();
        let config = self.config.clone();
        let screenshot_start_ref = Arc::clone(&self.current_screenshot_start);

        listener.start_listening(move |event| {
            let app = app.clone();
            let config = config.clone();
            let screenshot_start_ref = screenshot_start_ref.clone();

            // 在 tokio runtime 中处理事件
            tokio::spawn(async move {
                if let Err(e) = Self::handle_listener_event(
                    &app,
                    &config,
                    screenshot_start_ref,
                    event,
                ).await {
                    log::error!("❌ 处理监听器事件失败: {}", e);
                }
            });
        })?;

        self.listener = Some(listener);
        
        log::info!("✅ 智能截图系统已启动");
        Ok(())
    }

    /// 停止智能截图+语音识别
    pub fn stop(&mut self) -> Result<()> {
        log::info!("⏹️ 停止直播间智能截图系统");

        // 标记为未运行
        {
            let mut running = self.is_running.lock().unwrap();
            *running = false;
        }

        // 停止监听器
        if let Some(mut listener) = self.listener.take() {
            listener.stop_listening()?;
        }

        // 清理临时截图
        {
            let mut screenshot = self.current_screenshot_start.lock().unwrap();
            *screenshot = None;
        }

        log::info!("✅ 智能截图系统已停止");
        Ok(())
    }

    /// 处理监听器事件
    async fn handle_listener_event(
        app: &AppHandle,
        config: &SmartCaptureConfig,
        screenshot_start_ref: Arc<Mutex<Option<Screenshot>>>,
        event: crate::audio::continuous_listener::ListenerEvent,
    ) -> Result<()> {
        use crate::audio::continuous_listener::ListenerEvent;

        match event {
            ListenerEvent::SpeechStarted => {
                log::info!("🎤 检测到语音开始，执行第一次截图...");
                
                // 截图
                match Self::capture_screenshot(app, config).await {
                    Ok(screenshot) => {
                        log::info!("📸 开始截图成功: {}x{}", screenshot.width, screenshot.height);
                        
                        // 保存到临时存储
                        {
                            let mut current = screenshot_start_ref.lock().unwrap();
                            *current = Some(screenshot.clone());
                        }

                        // 发送事件到前端
                        let event = SmartCaptureEvent::SpeechStarted {
                            screenshot_start: screenshot,
                            timestamp: chrono::Utc::now().timestamp() as u64,
                        };
                        let _ = app.emit("smart_capture_event", event);
                    }
                    Err(e) => {
                        log::error!("❌ 开始截图失败: {}", e);
                    }
                }
            }

            ListenerEvent::SpeechEnded { duration_secs } => {
                log::info!("🎤 检测到语音结束 ({:.1}秒)，执行第二次截图...", duration_secs);
                
                // 截图
                match Self::capture_screenshot(app, config).await {
                    Ok(screenshot_end) => {
                        log::info!("📸 结束截图成功: {}x{}", screenshot_end.width, screenshot_end.height);
                        
                        // 获取开始截图
                        let screenshot_start = {
                            let mut current = screenshot_start_ref.lock().unwrap();
                            current.take()
                        };

                        if let Some(screenshot_start) = screenshot_start {
                            log::info!("✅ 双截图准备完成，等待语音识别结果...");
                            // 注意：语音识别结果会在 AliyunRecognizeRequest 事件中处理
                            // 这里暂时不发送事件，等待识别完成
                            
                            // 临时存储结束截图，等待识别结果
                            // TODO: 需要在 AliyunRecognizeRequest 事件中获取这两张截图
                        } else {
                            log::warn!("⚠️ 未找到开始截图，跳过本次双截图");
                        }
                    }
                    Err(e) => {
                        log::error!("❌ 结束截图失败: {}", e);
                    }
                }
            }

            ListenerEvent::AliyunRecognizeRequest { pcm_data, sample_rate, duration_secs } => {
                log::info!("🎯 收到阿里云识别请求: {} 字节, {}Hz, {:.1}秒",
                          pcm_data.len(), sample_rate, duration_secs);
                
                // 发送事件到前端，前端会调用 aliyun_one_sentence_recognize
                let payload = serde_json::json!({
                    "pcm_data": pcm_data,
                    "sample_rate": sample_rate,
                    "duration_secs": duration_secs,
                });
                let _ = app.emit("livestream_recognize_request", payload);
            }

            ListenerEvent::VoiceTranscribed { text } => {
                log::info!("📝 语音识别完成: {}", text);
                
                // 这里可以发送包含双截图和识别结果的事件
                // TODO: 实现完整的事件发送逻辑
            }

            ListenerEvent::Error { message } => {
                log::error!("❌ 监听器错误: {}", message);
                let event = SmartCaptureEvent::Error { message };
                let _ = app.emit("smart_capture_event", event);
            }

            _ => {
                // 其他事件忽略
            }
        }

        Ok(())
    }

    /// 执行截图
    async fn capture_screenshot(
        app: &AppHandle,
        config: &SmartCaptureConfig,
    ) -> Result<Screenshot> {
        // 从 Tauri State 获取 ScreenshotState
        let screenshot_state: tauri::State<ScreenshotState> = app.state();

        match config.capture_mode.as_str() {
            "window" => {
                // 窗口截图
                if let Some(window_id) = config.target_window_id {
                    log::debug!("🪟 捕获窗口 ID: {}", window_id);
                    crate::screenshot::capture_window(window_id)
                        .context("窗口截图失败")
                } else {
                    log::warn!("⚠️ 窗口模式但未设置窗口 ID，回退到全屏截图");
                    let capturer = screenshot_state.get_or_init()
                        .context("初始化截图器失败")?;
                    capturer.capture_fullscreen(None)
                        .context("全屏截图失败")
                }
            }
            "fullscreen" | _ => {
                // 全屏截图
                log::debug!("🖥️ 全屏截图");
                let capturer = screenshot_state.get_or_init()
                    .context("初始化截图器失败")?;
                capturer.capture_fullscreen(None)
                    .context("全屏截图失败")
            }
        }
    }

    /// 获取运行状态
    pub fn is_running(&self) -> bool {
        *self.is_running.lock().unwrap()
    }
}
