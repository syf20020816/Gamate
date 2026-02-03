// Continuous Listener - 持续监听模式的语音输入系统
// 集成 VAD + 录音 + STT + AI 处理

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::task::JoinHandle;

use super::recorder::{AudioRecorder, RecorderConfig};
use super::vad::{VadConfig, VadState, VoiceActivityDetector};

#[cfg(windows)]
use super::stt_windows::WindowsSttEngine;

/// 监听器状态信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListenerState {
    /// 当前 VAD 状态
    pub vad_state: VadState,
    /// 是否正在监听
    pub is_listening: bool,
    /// 当前录音时长(秒)
    pub recording_duration: f32,
    /// 音频缓冲区大小(采样点数)
    pub buffer_size: usize,
    /// 最近一次识别的文字
    pub last_transcription: Option<String>,
}

/// 持续监听器事件
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", content = "data")]
pub enum ListenerEvent {
    /// 开始说话
    SpeechStarted,
    /// 停止说话
    SpeechEnded { duration_secs: f32 },
    /// 语音识别完成
    VoiceTranscribed { text: String },
    /// AI 响应就绪
    AiResponseReady { response: String },
    /// 错误
    Error { message: String },
}

/// 持续监听器
pub struct ContinuousListener {
    /// VAD 配置
    vad_config: VadConfig,
    /// 录音器配置
    recorder_config: RecorderConfig,
    
    /// 共享状态
    state: Arc<Mutex<ListenerStateInternal>>,
    
    /// 监听任务句柄
    listen_task: Option<JoinHandle<()>>,
    
    /// 事件发送器
    event_tx: Option<mpsc::UnboundedSender<ListenerEvent>>,
}

/// 内部状态 (需要线程安全)
struct ListenerStateInternal {
    vad: VoiceActivityDetector,
    is_listening: bool,
    last_transcription: Option<String>,
}

impl ContinuousListener {
    /// 创建新的持续监听器
    pub fn new(vad_config: VadConfig, recorder_config: RecorderConfig) -> Self {
        let vad = VoiceActivityDetector::new(vad_config.clone());
        
        let state = Arc::new(Mutex::new(ListenerStateInternal {
            vad,
            is_listening: false,
            last_transcription: None,
        }));

        Self {
            vad_config,
            recorder_config,
            state,
            listen_task: None,
            event_tx: None,
        }
    }

    /// 开始持续监听
    pub fn start_listening(
        &mut self,
        event_callback: impl Fn(ListenerEvent) + Send + 'static,
    ) -> Result<()> {
        if self.listen_task.is_some() {
            log::warn!("⚠️ 监听已经在运行中");
            return Ok(());
        }

        // 创建事件通道
        let (tx, mut rx) = mpsc::unbounded_channel();
        self.event_tx = Some(tx.clone());

        // 启动事件处理任务
        tokio::spawn(async move {
            while let Some(event) = rx.recv().await {
                event_callback(event);
            }
        });

        // 标记为监听状态
        {
            let mut state = self.state.lock().unwrap();
            state.is_listening = true;
            state.vad.reset();
        }

        // 启动监听循环
        let state = Arc::clone(&self.state);
        let recorder_config = self.recorder_config.clone();
        let event_tx = tx.clone();

        let handle = tokio::spawn(async move {
            if let Err(e) = Self::listen_loop(state, recorder_config, event_tx).await {
                log::error!("❌ 监听循环错误: {}", e);
            }
        });

        self.listen_task = Some(handle);
        log::info!("🎙️ 开始持续监听");

        Ok(())
    }

    /// 停止持续监听
    pub fn stop_listening(&mut self) -> Result<()> {
        // 标记为停止监听
        {
            let mut state = self.state.lock().unwrap();
            state.is_listening = false;
        }

        // 等待任务结束
        if let Some(handle) = self.listen_task.take() {
            handle.abort();
            log::info!("⏹️ 停止持续监听");
        }

        self.event_tx = None;

        Ok(())
    }

    /// 获取当前状态
    pub fn get_state(&self) -> ListenerState {
        let state = self.state.lock().unwrap();
        ListenerState {
            vad_state: state.vad.state(),
            is_listening: state.is_listening,
            recording_duration: state.vad.recording_duration(),
            buffer_size: state.vad.buffer_size(),
            last_transcription: state.last_transcription.clone(),
        }
    }

    /// 监听循环 (异步任务)
    async fn listen_loop(
        state: Arc<Mutex<ListenerStateInternal>>,
        recorder_config: RecorderConfig,
        event_tx: mpsc::UnboundedSender<ListenerEvent>,
    ) -> Result<()> {
        // 在 spawn_blocking 中运行,因为 cpal Stream 不是 Send
        tokio::task::spawn_blocking(move || {
            Self::listen_loop_blocking(state, recorder_config, event_tx)
        })
        .await
        .map_err(|e| anyhow::anyhow!("监听任务失败: {}", e))??;
        
        Ok(())
    }
    
    /// 监听循环 (阻塞版本,在单独线程中运行)
    fn listen_loop_blocking(
        state: Arc<Mutex<ListenerStateInternal>>,
        recorder_config: RecorderConfig,
        event_tx: mpsc::UnboundedSender<ListenerEvent>,
    ) -> Result<()> {
        // 创建录音器
        let mut recorder = AudioRecorder::new(recorder_config.clone())
            .context("无法创建录音器")?;

        // 开始录音
        recorder.start_recording()?;

        // 音频处理间隔 (毫秒)
        let process_interval = Duration::from_millis(100);

        loop {
            // 检查是否应该继续监听
            {
                let state = state.lock().unwrap();
                if !state.is_listening {
                    break;
                }
            }

            // 等待一段时间再处理
            std::thread::sleep(process_interval);

            // 获取音频数据
            let audio_chunk = recorder.take_audio_data();
            if audio_chunk.is_empty() {
                continue;
            }

            // VAD 处理
            let should_trigger_stt = {
                let mut state = state.lock().unwrap();
                let old_vad_state = state.vad.state();
                let should_trigger = state.vad.process_audio(&audio_chunk);

                // 检测状态变化,发送事件
                let new_vad_state = state.vad.state();
                if old_vad_state != new_vad_state {
                    match new_vad_state {
                        VadState::Speaking => {
                            let _ = event_tx.send(ListenerEvent::SpeechStarted);
                        }
                        VadState::Processing => {
                            let duration = state.vad.recording_duration();
                            let _ = event_tx.send(ListenerEvent::SpeechEnded {
                                duration_secs: duration,
                            });
                        }
                        _ => {}
                    }
                }

                should_trigger
            };

            // 如果检测到语音结束,触发 STT
            if should_trigger_stt {
                let audio_buffer = {
                    let mut state = state.lock().unwrap();
                    state.vad.take_audio_buffer()
                };

                // 执行 STT (在后台线程中,避免阻塞)
                let event_tx_clone = event_tx.clone();
                let state_clone = Arc::clone(&state);
                let sample_rate = recorder_config.sample_rate;
                
                std::thread::spawn(move || {
                    // 使用 tokio runtime 执行异步 STT
                    let rt = tokio::runtime::Runtime::new().unwrap();
                    match rt.block_on(Self::process_voice_segment(&audio_buffer, sample_rate)) {
                        Ok(text) => {
                            log::info!("📝 STT 识别结果: {}", text);
                            
                            // 保存识别结果
                            {
                                let mut s = state_clone.lock().unwrap();
                                s.last_transcription = Some(text.clone());
                                s.vad.reset(); // 重置 VAD 状态
                            }
                            
                            // 发送事件
                            let _ = event_tx_clone.send(ListenerEvent::VoiceTranscribed {
                                text: text.clone(),
                            });

                            // TODO: 这里应该触发截图 + RAG + AI 处理
                            // 暂时只是示例
                        }
                        Err(e) => {
                            log::error!("❌ STT 识别失败: {}", e);
                            let _ = event_tx_clone.send(ListenerEvent::Error {
                                message: format!("STT 失败: {}", e),
                            });
                            
                            // 重置 VAD 状态
                            let mut s = state_clone.lock().unwrap();
                            s.vad.reset();
                        }
                    }
                });
            }
        }

        // 停止录音
        recorder.stop_recording()?;

        Ok(())
    }

    /// 处理语音片段:STT 识别
    #[cfg(windows)]
    async fn process_voice_segment(audio_data: &[f32], sample_rate: u32) -> Result<String> {
        let mut stt_engine = WindowsSttEngine::new()?;
        let text = stt_engine.recognize_from_audio(audio_data, sample_rate).await?;
        Ok(text)
    }

    /// 非 Windows 平台的占位实现
    #[cfg(not(windows))]
    async fn process_voice_segment(_audio_data: &[f32], _sample_rate: u32) -> Result<String> {
        anyhow::bail!("STT 仅支持 Windows 平台");
    }
}

impl Drop for ContinuousListener {
    fn drop(&mut self) {
        let _ = self.stop_listening();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_listener_creation() {
        let vad_config = VadConfig::default();
        let recorder_config = RecorderConfig::default();
        let listener = ContinuousListener::new(vad_config, recorder_config);

        let state = listener.get_state();
        assert!(!state.is_listening);
        assert_eq!(state.vad_state, VadState::Idle);
    }
}
