// Audio commands for Tauri
// 提供语音输入相关的 Tauri 命令

use crate::audio::{
    continuous_listener::{ContinuousListener, ListenerEvent, ListenerState},
    recorder::{AudioRecorder, RecorderConfig},
    vad::VadConfig,
};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};

/// 全局持续监听器状态
pub struct AudioState {
    listener: Arc<Mutex<Option<ContinuousListener>>>,
    // 麦克风测试状态 (不存储AudioRecorder,避免Send问题)
    test_running: Arc<Mutex<bool>>,
}

impl AudioState {
    pub fn new() -> Self {
        Self {
            listener: Arc::new(Mutex::new(None)),
            test_running: Arc::new(Mutex::new(false)),
        }
    }
}

/// VAD 配置参数 (前端传入)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VadConfigDto {
    #[serde(default = "default_volume_threshold")]
    pub volume_threshold: f32,
    #[serde(default = "default_silence_duration")]
    pub silence_duration_secs: f32,
    #[serde(default = "default_min_speech_duration")]
    pub min_speech_duration_secs: f32,
    #[serde(default = "default_max_speech_duration")]
    pub max_speech_duration_secs: f32,
}

fn default_volume_threshold() -> f32 {
    0.02
}
fn default_silence_duration() -> f32 {
    1.5
}
fn default_min_speech_duration() -> f32 {
    0.3
}
fn default_max_speech_duration() -> f32 {
    30.0
}

impl From<VadConfigDto> for VadConfig {
    fn from(dto: VadConfigDto) -> Self {
        VadConfig {
            volume_threshold: dto.volume_threshold,
            silence_duration_secs: dto.silence_duration_secs,
            min_speech_duration_secs: dto.min_speech_duration_secs,
            max_speech_duration_secs: dto.max_speech_duration_secs,
            rms_window_size: 1024,
        }
    }
}

impl Default for VadConfigDto {
    fn default() -> Self {
        Self {
            volume_threshold: default_volume_threshold(),
            silence_duration_secs: default_silence_duration(),
            min_speech_duration_secs: default_min_speech_duration(),
            max_speech_duration_secs: default_max_speech_duration(),
        }
    }
}

/// 开始持续监听
#[tauri::command]
pub async fn start_continuous_listening(
    app: AppHandle,
    audio_state: State<'_, AudioState>,
    vad_config: Option<VadConfigDto>,
) -> Result<String, String> {
    log::info!("🎙️ 收到开始监听命令");

    let vad_config = vad_config.unwrap_or_default();
    let vad_config: VadConfig = vad_config.into();

    let recorder_config = RecorderConfig::default();

    // 创建监听器
    let mut listener = ContinuousListener::new(vad_config, recorder_config);

    // 事件回调:发送到前端
    let app_clone = app.clone();
    listener
        .start_listening(move |event| {
            log::debug!("📡 监听器事件: {:?}", event);
            
            // 发送事件到前端
            match &event {
                ListenerEvent::VoiceTranscribed { text } => {
                    let _ = app_clone.emit("voice_transcribed", text.clone());
                }
                ListenerEvent::SpeechStarted => {
                    let _ = app_clone.emit("speech_started", ());
                }
                ListenerEvent::SpeechEnded { duration_secs } => {
                    let _ = app_clone.emit("speech_ended", duration_secs);
                }
                ListenerEvent::AiResponseReady { response } => {
                    let _ = app_clone.emit("ai_response_ready", response.clone());
                }
                ListenerEvent::Error { message } => {
                    let _ = app_clone.emit("voice_error", message.clone());
                }
            }
        })
        .map_err(|e| e.to_string())?;

    // 保存到全局状态
    {
        let mut state = audio_state.listener.lock().unwrap();
        *state = Some(listener);
    }

    Ok("持续监听已启动".to_string())
}

/// 停止持续监听
#[tauri::command]
pub async fn stop_continuous_listening(
    audio_state: State<'_, AudioState>,
) -> Result<String, String> {
    log::info!("⏹️ 收到停止监听命令");

    let mut state = audio_state.listener.lock().unwrap();
    if let Some(listener) = state.as_mut() {
        listener.stop_listening().map_err(|e| e.to_string())?;
        *state = None;
        Ok("持续监听已停止".to_string())
    } else {
        Err("监听器未运行".to_string())
    }
}

/// 获取监听器状态
#[tauri::command]
pub async fn get_listener_state(
    audio_state: State<'_, AudioState>,
) -> Result<ListenerState, String> {
    let state = audio_state.listener.lock().unwrap();
    if let Some(listener) = state.as_ref() {
        Ok(listener.get_state())
    } else {
        // 返回默认状态
        Ok(ListenerState {
            vad_state: crate::audio::vad::VadState::Idle,
            is_listening: false,
            recording_duration: 0.0,
            buffer_size: 0,
            last_transcription: None,
        })
    }
}

/// 测试麦克风
#[tauri::command]
pub async fn test_microphone() -> Result<String, String> {
    use crate::audio::recorder::{AudioRecorder, RecorderConfig};
    
    log::info!("🎤 测试麦克风...");
    
    // 在 spawn_blocking 中运行,避免 Send 问题
    let result = tokio::task::spawn_blocking(|| {
        let config = RecorderConfig::default();
        let mut recorder = AudioRecorder::new(config).map_err(|e| e.to_string())?;
        
        recorder.start_recording().map_err(|e| e.to_string())?;
        
        // 睡眠 1 秒
        std::thread::sleep(std::time::Duration::from_secs(1));
        
        let audio_data = recorder.take_audio_data();
        recorder.stop_recording().map_err(|e| e.to_string())?;
        
        // 计算平均音量
        let rms: f32 = if !audio_data.is_empty() {
            let sum_squares: f32 = audio_data.iter().map(|&s| s * s).sum();
            (sum_squares / audio_data.len() as f32).sqrt()
        } else {
            0.0
        };
        
        Ok(format!(
            "麦克风测试成功!\n采集了 {} 个采样点\n平均音量: {:.4}",
            audio_data.len(),
            rms
        ))
    }).await.map_err(|e| e.to_string())?;
    
    result
}

/// 开始麦克风测试 (持续10秒,实时显示音量)
#[tauri::command]
pub async fn start_microphone_test(
    app: AppHandle,
    audio_state: State<'_, AudioState>,
) -> Result<String, String> {
    log::info!("🎤 开始麦克风测试 (10秒)...");
    
    // 检查是否已在测试
    {
        let mut is_running = audio_state.test_running.lock().unwrap();
        if *is_running {
            return Err("麦克风测试已在进行中".to_string());
        }
        *is_running = true;
    }
    
    let test_running = Arc::clone(&audio_state.test_running);
    
    // 在spawn_blocking中创建recorder并运行测试
    tokio::task::spawn_blocking(move || {
        use crate::audio::recorder::{AudioRecorder, RecorderConfig};
        
        let config = RecorderConfig::default();
        let mut recorder = match AudioRecorder::new(config) {
            Ok(r) => r,
            Err(e) => {
                log::error!("创建录音器失败: {}", e);
                let mut is_running = test_running.lock().unwrap();
                *is_running = false;
                return;
            }
        };
        
        if let Err(e) = recorder.start_recording() {
            log::error!("启动录音失败: {}", e);
            let mut is_running = test_running.lock().unwrap();
            *is_running = false;
            return;
        }
        
        let start_time = std::time::Instant::now();
        let max_duration = std::time::Duration::from_secs(10);
        
        // 测试循环
        loop {
            // 检查是否应该停止
            {
                let is_running = test_running.lock().unwrap();
                if !*is_running {
                    break;
                }
            }
            
            // 检查是否超时
            let elapsed = start_time.elapsed();
            if elapsed >= max_duration {
                log::info!("⏱️ 麦克风测试达到10秒上限,自动停止");
                let _ = app.emit("microphone_test_finished", ());
                
                let mut is_running = test_running.lock().unwrap();
                *is_running = false;
                break;
            }
            
            // 获取音频数据并计算音量
            let audio_data = recorder.take_audio_data();
            let samples = audio_data.len();
            
            let rms: f32 = if !audio_data.is_empty() {
                let sum_squares: f32 = audio_data.iter().map(|&s| s * s).sum();
                (sum_squares / audio_data.len() as f32).sqrt()
            } else {
                0.0
            };
            
            // 发送更新事件
            let _ = app.emit("microphone_test_update", serde_json::json!({
                "volume": rms,
                "duration_secs": elapsed.as_secs_f32(),
                "samples": samples,
            }));
            
            // 等待100ms后继续
            std::thread::sleep(std::time::Duration::from_millis(100));
        }
        
        // 停止录音
        let _ = recorder.stop_recording();
    });
    
    Ok("麦克风测试已启动".to_string())
}

/// 麦克风测试结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MicrophoneTestResult {
    pub duration_secs: f32,
    pub total_samples: usize,
    pub average_volume: f32,
    pub max_volume: f32,
}

/// 停止麦克风测试
#[tauri::command]
pub async fn stop_microphone_test(
    audio_state: State<'_, AudioState>,
) -> Result<String, String> {
    log::info!("⏹️ 停止麦克风测试");
    
    let mut is_running = audio_state.test_running.lock().unwrap();
    
    if *is_running {
        *is_running = false;
        Ok("麦克风测试已停止".to_string())
    } else {
        Err("没有正在进行的麦克风测试".to_string())
    }
}
