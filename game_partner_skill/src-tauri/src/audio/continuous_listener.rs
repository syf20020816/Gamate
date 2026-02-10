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
use rubato::{
    Resampler, SincFixedIn, SincInterpolationParameters, SincInterpolationType, WindowFunction,
};

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
    /// 请求阿里云识别 (包含PCM数据)
    AliyunRecognizeRequest {
        pcm_data: Vec<u8>,
        sample_rate: u32,
        duration_secs: f32,
    },
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

    /// 实际的设备采样率（在 start_listening 时设置）
    actual_sample_rate: Option<u32>,
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
            actual_sample_rate: None,
        }
    }

    /// 开始持续监听
    pub fn start_listening(
        &mut self,
        event_callback: impl Fn(ListenerEvent) + Send + 'static,
    ) -> Result<()> {
        if self.listen_task.is_some() {
            log::warn!("监听已经在运行中");
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
                log::error!("监听循环错误: {}", e);
            }
        });

        self.listen_task = Some(handle);

        Ok(())
    }

    /// 停止持续监听
    pub fn stop_listening(&mut self) -> Result<()> {
        // 先检查 event_tx 是否存在
        if self.event_tx.is_none() {
            log::warn!("⚠️ event_tx 为 None，监听器可能未启动或已停止");
            return Ok(());
        }

        // 在停止前,检查是否有未处理的音频数据
        let event_tx = self.event_tx.clone();
        let should_trigger_recognition = {
            let mut state = self.state.lock().unwrap();
            let buffer_size = state.vad.buffer_size();
            let recording_duration = state.vad.recording_duration();
            // 如果有音频数据且持续时间足够
            if buffer_size > 0 && recording_duration >= 0.3 {
                // 获取音频buffer
                let audio_samples = state.vad.take_audio_buffer();
                let duration = recording_duration;

                // 计算实际采样率: 样本数 / 时长
                let actual_sample_rate = (audio_samples.len() as f32 / duration) as u32;

                // 重采样到16kHz
                match Self::resample_to_16khz(&audio_samples, actual_sample_rate) {
                    Ok(pcm_data) => {
                        // // 保存 WAV 文件到下载目录
                        // if let Err(e) = Self::save_wav_file(&pcm_data, 16000, duration) {
                        //     log::error!("❌ 保存 WAV 文件失败: {}", e);
                        // }
                        Some((pcm_data, actual_sample_rate, duration))
                    }
                    Err(e) => {
                        log::error!("❌ 重采样失败: {}", e);
                        None
                    }
                }
            } else {
                if buffer_size > 0 {
                    log::warn!(
                        "⚠️ 音频数据过短,不触发识别: duration={:.1}s",
                        recording_duration
                    );
                } else {
                    println!("⚠️ 没有音频数据");
                }
                None
            }
        };

        // 在释放锁后发送事件
        if let Some((pcm_data, sample_rate, duration)) = should_trigger_recognition {
            if let Some(tx) = event_tx {
                println!("🚀🚀🚀 准备发送阿里云识别请求 !!!");
                println!("   - PCM 数据大小: {} 字节", pcm_data.len());
                println!("   - 采样率: {} Hz", sample_rate);
                println!("   - 音频时长: {:.2} 秒", duration);

                log::info!("🚀 准备发送阿里云识别请求:");
                log::info!("   - PCM 数据大小: {} 字节", pcm_data.len());
                log::info!("   - 采样率: {} Hz", sample_rate);
                log::info!("   - 音频时长: {:.2} 秒", duration);
                log::info!(
                    "   - 计算的音频时长: {:.2} 秒",
                    pcm_data.len() as f32 / (16000.0 * 2.0)
                );

                if let Err(e) = tx.send(ListenerEvent::AliyunRecognizeRequest {
                    pcm_data,
                    sample_rate,
                    duration_secs: duration,
                }) {
                    println!("❌ 发送阿里云识别请求事件失败: {}", e);
                    log::error!("❌ 发送阿里云识别请求事件失败: {}", e);
                } else {
                    println!("📤📤📤 已发送阿里云识别请求事件 !!!");
                    log::info!("📤 已发送阿里云识别请求事件");
                    // 等待一小段时间让事件循环处理事件
                    std::thread::sleep(std::time::Duration::from_millis(100));
                }
            } else {
                println!("❌❌❌ event_tx 为 None，无法发送识别请求 !!!");
                log::error!("❌ event_tx 为 None，无法发送识别请求");
            }
        } else {
            println!("⚠️ 没有触发识别（音频可能过短或重采样失败）");
            log::warn!("⚠️ 没有触发识别（音频可能过短或重采样失败）");
        }

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
        let mut recorder = AudioRecorder::new(recorder_config.clone()).context("无法创建录音器")?;

        // 获取实际的设备采样率（可能与配置不同）
        let actual_sample_rate = recorder.actual_sample_rate();
        log::info!(
            "🎤 实际设备采样率: {} Hz (配置: {} Hz)",
            actual_sample_rate,
            recorder_config.sample_rate
        );

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

            // 检查音频数据
            if audio_chunk.is_empty() {
                continue;
            }

            // VAD 处理
            let (should_trigger_stt, speech_ended_with_audio) = {
                let mut state = state.lock().unwrap();
                let old_vad_state = state.vad.state();

                let should_trigger = state.vad.process_audio(&audio_chunk);

                // 检测状态变化,发送事件
                let new_vad_state = state.vad.state();

                // 如果从 Speaking 切换到 Processing，立即取出音频数据
                let audio_data_for_recognition = if old_vad_state == VadState::Speaking
                    && new_vad_state == VadState::Processing
                {
                    let buffer = state.vad.take_audio_buffer();
                    let duration = state.vad.recording_duration();

                    if buffer.len() > 0 && duration >= 0.3 {
                        println!(
                            "🎤 检测到停止说话 (时长: {:.2}s, {} 样本)",
                            duration,
                            buffer.len()
                        );
                        log::info!(
                            "🎤 检测到停止说话 (时长: {:.2}s, {} 样本)",
                            duration,
                            buffer.len()
                        );
                        Some((buffer, duration))
                    } else {
                        println!("⚠️ 语音过短或无数据，忽略");
                        None
                    }
                } else {
                    None
                };

                // 🔍 只在状态真正变化时打印
                if old_vad_state != new_vad_state {
                    match new_vad_state {
                        VadState::Speaking => {
                            println!("🎤 检测到开始说话");
                            log::info!("🎤 检测到开始说话");
                            let _ = event_tx.send(ListenerEvent::SpeechStarted);
                        }
                        VadState::Processing => {
                            let duration = state.vad.recording_duration();
                            let _ = event_tx.send(ListenerEvent::SpeechEnded {
                                duration_secs: duration,
                            });
                        }
                        VadState::Idle => {
                            println!("🔄 VAD 状态恢复空闲");
                            log::info!("🔄 VAD 状态恢复空闲");
                        }
                    }
                }

                (should_trigger, audio_data_for_recognition)
            };

            // 在释放锁后处理音频识别（如果有的话）
            if let Some((audio_samples, duration)) = speech_ended_with_audio {
                // 计算实际采样率
                let actual_sample_rate = (audio_samples.len() as f32 / duration) as u32;

                println!(
                    "🔄 开始重采样: {} 样本 从 {}Hz 到 16000Hz",
                    audio_samples.len(),
                    actual_sample_rate
                );
                log::info!(
                    "🔄 计算的实际采样率: {} Hz (样本数: {}, 时长: {:.2}s)",
                    actual_sample_rate,
                    audio_samples.len(),
                    duration
                );

                // 重采样到16kHz
                match Self::resample_to_16khz(&audio_samples, actual_sample_rate) {
                    Ok(pcm_data) => {
                        // // 保存 WAV 文件到下载目录
                        // if let Err(e) = Self::save_wav_file(&pcm_data, 16000, duration) {
                        //     log::error!("保存 WAV 文件失败: {}", e);
                        // }

                        // 发送识别请求
                        if let Err(e) = event_tx.send(ListenerEvent::AliyunRecognizeRequest {
                            pcm_data,
                            sample_rate: actual_sample_rate,
                            duration_secs: duration,
                        }) {
                            log::error!("发送识别请求失败: {}", e);
                        }
                    }
                    Err(e) => {
                        log::error!("重采样失败: {}", e);
                    }
                }
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
        let text = stt_engine
            .recognize_from_audio(audio_data, sample_rate)
            .await?;
        Ok(text)
    }

    /// 非 Windows 平台的占位实现
    #[cfg(not(windows))]
    async fn process_voice_segment(_audio_data: &[f32], _sample_rate: u32) -> Result<String> {
        anyhow::bail!("STT 仅支持 Windows 平台");
    }

    /// 重采样音频数据到16kHz
    /// 输入: f32样本数据, 原始采样率
    /// 输出: 16kHz PCM u8数据 (16-bit little-endian)
    fn resample_to_16khz(samples: &[f32], from_rate: u32) -> Result<Vec<u8>> {
        const TARGET_RATE: u32 = 16000;

        if from_rate == TARGET_RATE {
            // 不需要重采样,直接转换为PCM
            let pcm_data: Vec<u8> = samples
                .iter()
                .flat_map(|&s| {
                    let sample_i16 = (s.clamp(-1.0, 1.0) * 32767.0) as i16;
                    sample_i16.to_le_bytes()
                })
                .collect();
            return Ok(pcm_data);
        }
        // 创建重采样器
        let params = SincInterpolationParameters {
            sinc_len: 256,
            f_cutoff: 0.95,
            interpolation: SincInterpolationType::Linear,
            oversampling_factor: 256,
            window: WindowFunction::BlackmanHarris2,
        };

        let mut resampler = SincFixedIn::<f32>::new(
            TARGET_RATE as f64 / from_rate as f64,
            2.0,
            params,
            samples.len(),
            1, // mono
        )
        .context("创建重采样器失败")?;

        // 重采样 (需要 Vec<Vec<f32>> 格式)
        let input = vec![samples.to_vec()];
        let output = resampler.process(&input, None).context("重采样失败")?;

        // 转换为PCM (16-bit little-endian)
        let resampled_samples = &output[0];
        let pcm_data: Vec<u8> = resampled_samples
            .iter()
            .flat_map(|&s| {
                let sample_i16 = (s.clamp(-1.0, 1.0) * 32767.0) as i16;
                sample_i16.to_le_bytes()
            })
            .collect();

        Ok(pcm_data)
    }

    /// 保存 WAV 文件到下载目录
    fn save_wav_file(pcm_data: &[u8], sample_rate: u32, duration: f32) -> Result<()> {
        use std::fs::File;
        use std::io::Write;

        // 生成文件名（时间戳）
        let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
        let filename = format!("voice_{}_{:.1}s.wav", timestamp, duration);
        let filepath = format!(r"C:\Users\Administrator\Downloads\{}", filename);

        // 创建 WAV 文件
        let mut file =
            File::create(&filepath).context(format!("创建 WAV 文件失败: {}", filepath))?;

        // 写入 WAV 头
        let num_samples = pcm_data.len() / 2; // 16-bit = 2 bytes per sample
        let byte_rate = sample_rate * 2; // 16-bit mono
        let data_size = pcm_data.len() as u32;
        let file_size = 36 + data_size;

        // RIFF header
        file.write_all(b"RIFF")?;
        file.write_all(&file_size.to_le_bytes())?;
        file.write_all(b"WAVE")?;

        // fmt chunk
        file.write_all(b"fmt ")?;
        file.write_all(&16u32.to_le_bytes())?; // chunk size
        file.write_all(&1u16.to_le_bytes())?; // audio format (1 = PCM)
        file.write_all(&1u16.to_le_bytes())?; // num channels (1 = mono)
        file.write_all(&sample_rate.to_le_bytes())?;
        file.write_all(&byte_rate.to_le_bytes())?;
        file.write_all(&2u16.to_le_bytes())?; // block align (2 = 16-bit mono)
        file.write_all(&16u16.to_le_bytes())?; // bits per sample

        // data chunk
        file.write_all(b"data")?;
        file.write_all(&data_size.to_le_bytes())?;
        file.write_all(pcm_data)?;

        log::info!(
            "已保存语音文件: {} ({:.1}s, {} bytes)",
            filepath,
            duration,
            pcm_data.len()
        );

        Ok(())
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
