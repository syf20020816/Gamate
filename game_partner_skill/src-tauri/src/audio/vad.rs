// Voice Activity Detection (VAD) module
// 基于 RMS 音量的语音活动检测

use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};

/// VAD 配置参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VadConfig {
    /// 音量阈值 (0.0 - 1.0),超过此值认为是语音
    pub volume_threshold: f32,
    
    /// 静音持续时长(秒),超过此时长认为用户停止说话
    pub silence_duration_secs: f32,
    
    /// 最短语音时长(秒),过滤掉过短的噪音
    pub min_speech_duration_secs: f32,
    
    /// 最长语音时长(秒),防止无限录音
    pub max_speech_duration_secs: f32,
    
    /// RMS 计算窗口大小 (采样点数)
    pub rms_window_size: usize,
}

impl Default for VadConfig {
    fn default() -> Self {
        Self {
            volume_threshold: 0.02,           // 2% 音量阈值
            silence_duration_secs: 1.5,       // 1.5秒静音判定停止
            min_speech_duration_secs: 0.3,    // 至少0.3秒才算有效语音
            max_speech_duration_secs: 30.0,   // 最长30秒
            rms_window_size: 1024,            // 1024个采样点计算RMS
        }
    }
}

/// 语音活动状态
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum VadState {
    /// 空闲,等待语音输入
    Idle,
    /// 检测到语音,正在录音
    Speaking,
    /// 处理中 (STT + AI)
    Processing,
}

/// 语音活动检测器
pub struct VoiceActivityDetector {
    config: VadConfig,
    state: VadState,
    
    /// 开始说话的时间
    speech_start_time: Option<Instant>,
    
    /// 最后一次检测到语音的时间
    last_voice_time: Option<Instant>,
    
    /// 累积的音频缓冲区
    audio_buffer: Vec<f32>,
}

impl VoiceActivityDetector {
    pub fn new(config: VadConfig) -> Self {
        Self {
            config,
            state: VadState::Idle,
            speech_start_time: None,
            last_voice_time: None,
            audio_buffer: Vec::new(),
        }
    }

    /// 获取当前状态
    pub fn state(&self) -> VadState {
        self.state
    }

    /// 设置状态
    pub fn set_state(&mut self, state: VadState) {
        self.state = state;
    }

    /// 计算音频样本的 RMS (均方根) 音量
    /// 
    /// RMS = sqrt(sum(samples^2) / len(samples))
    fn calculate_rms(&self, samples: &[f32]) -> f32 {
        if samples.is_empty() {
            return 0.0;
        }
        
        let sum_squares: f32 = samples.iter().map(|&s| s * s).sum();
        (sum_squares / samples.len() as f32).sqrt()
    }

    /// 处理新的音频数据,返回是否应该触发 STT
    /// 
    /// # 参数
    /// - `audio_chunk`: 新的音频采样数据 (f32, -1.0 到 1.0)
    /// 
    /// # 返回
    /// - `true`: 检测到语音结束,应该触发 STT
    /// - `false`: 继续监听
    pub fn process_audio(&mut self, audio_chunk: &[f32]) -> bool {
        let now = Instant::now();
        
        // 计算当前音频块的 RMS 音量
        let rms = self.calculate_rms(audio_chunk);
        
        match self.state {
            VadState::Idle => {
                // 空闲状态:检测是否有语音输入
                if rms > self.config.volume_threshold {
                    // 检测到语音,切换到 Speaking 状态
                    self.state = VadState::Speaking;
                    self.speech_start_time = Some(now);
                    self.last_voice_time = Some(now);
                    self.audio_buffer.clear();
                    self.audio_buffer.extend_from_slice(audio_chunk);
                    log::info!("🎤 VAD: 检测到语音开始 (RMS: {:.4})", rms);
                }
                false
            }
            
            VadState::Speaking => {
                // 说话状态:累积音频,检测静音或超时
                self.audio_buffer.extend_from_slice(audio_chunk);
                
                // 检查是否还有语音
                if rms > self.config.volume_threshold {
                    self.last_voice_time = Some(now);
                }
                
                // 检查各种结束条件
                let speech_duration = self.speech_start_time
                    .map(|start| now.duration_since(start))
                    .unwrap_or(Duration::ZERO);
                
                let silence_duration = self.last_voice_time
                    .map(|last| now.duration_since(last))
                    .unwrap_or(Duration::ZERO);
                
                // 条件1: 超过最长语音时长
                if speech_duration.as_secs_f32() > self.config.max_speech_duration_secs {
                    log::warn!("⏱️ VAD: 达到最长录音时长 ({:.1}s),强制结束", 
                              speech_duration.as_secs_f32());
                    self.state = VadState::Processing;
                    return self.check_min_speech_duration();
                }
                
                // 条件2: 静音超过阈值
                if silence_duration.as_secs_f32() > self.config.silence_duration_secs {
                    log::info!("🔇 VAD: 检测到静音 ({:.1}s),结束录音", 
                              silence_duration.as_secs_f32());
                    self.state = VadState::Processing;
                    return self.check_min_speech_duration();
                }
                
                false
            }
            
            VadState::Processing => {
                // 处理状态:检测新的语音输入以重新开始
                if rms > self.config.volume_threshold {
                    // 检测到新语音,清空旧缓冲区并重新开始
                    log::info!("🎤 VAD: 检测到新语音,清空旧缓冲区并重新开始");
                    self.state = VadState::Speaking;
                    self.speech_start_time = Some(now);
                    self.last_voice_time = Some(now);
                    self.audio_buffer.clear(); // 清空旧音频
                    self.audio_buffer.extend_from_slice(audio_chunk);
                    log::info!("🎤 VAD: 检测到语音开始 (RMS: {:.4})", rms);
                } else {
                    // 继续等待新的语音输入,超时后回到 Idle
                    if let Some(speech_end) = self.speech_start_time {
                        let elapsed = now.duration_since(speech_end);
                        if elapsed.as_secs() > 2 {
                            // 2秒无新语音,回到 Idle
                            log::info!("💤 VAD: 回到 Idle 状态");
                            self.reset();
                        }
                    }
                }
                false
            }
        }
    }

    /// 检查是否满足最短语音时长要求
    fn check_min_speech_duration(&self) -> bool {
        if let Some(start) = self.speech_start_time {
            let duration = Instant::now().duration_since(start);
            let secs = duration.as_secs_f32();
            
            if secs < self.config.min_speech_duration_secs {
                log::warn!("⚠️ VAD: 语音过短 ({:.2}s < {:.2}s),忽略", 
                          secs, self.config.min_speech_duration_secs);
                return false;
            }
            
            log::info!("✅ VAD: 有效语音片段 ({:.2}s)", secs);
            true
        } else {
            false
        }
    }

    /// 获取累积的音频数据
    pub fn take_audio_buffer(&mut self) -> Vec<f32> {
        std::mem::take(&mut self.audio_buffer)
    }

    /// 重置到空闲状态
    pub fn reset(&mut self) {
        self.state = VadState::Idle;
        self.speech_start_time = None;
        self.last_voice_time = None;
        self.audio_buffer.clear();
    }

    /// 获取当前音频缓冲区大小 (采样点数)
    pub fn buffer_size(&self) -> usize {
        self.audio_buffer.len()
    }

    /// 获取当前录音时长 (秒)
    pub fn recording_duration(&self) -> f32 {
        self.speech_start_time
            .map(|start| Instant::now().duration_since(start).as_secs_f32())
            .unwrap_or(0.0)
    }
    
    /// 获取音量阈值
    pub fn volume_threshold(&self) -> f32 {
        self.config.volume_threshold
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rms_calculation() {
        let config = VadConfig::default();
        let vad = VoiceActivityDetector::new(config);
        
        // 静音样本
        let silence = vec![0.0; 1024];
        assert_eq!(vad.calculate_rms(&silence), 0.0);
        
        // 最大音量
        let max_volume = vec![1.0; 1024];
        assert_eq!(vad.calculate_rms(&max_volume), 1.0);
        
        // 中等音量
        let medium = vec![0.5; 1024];
        assert_eq!(vad.calculate_rms(&medium), 0.5);
    }

    #[test]
    fn test_vad_state_transitions() {
        let config = VadConfig {
            volume_threshold: 0.1,
            silence_duration_secs: 0.5,
            min_speech_duration_secs: 0.1,
            max_speech_duration_secs: 5.0,
            rms_window_size: 512,
        };
        
        let mut vad = VoiceActivityDetector::new(config);
        
        // 初始状态应该是 Idle
        assert_eq!(vad.state(), VadState::Idle);
        
        // 静音不应该触发状态变化
        let silence = vec![0.01; 512];
        assert!(!vad.process_audio(&silence));
        assert_eq!(vad.state(), VadState::Idle);
        
        // 语音应该触发 Speaking 状态
        let voice = vec![0.5; 512];
        assert!(!vad.process_audio(&voice));
        assert_eq!(vad.state(), VadState::Speaking);
    }
}
