// Audio recording module using cpal
// 负责从麦克风捕获音频流

use anyhow::{Context, Result};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Device, Host, Stream, StreamConfig};
use std::sync::{Arc, Mutex};

/// 音频录制器配置
#[derive(Debug, Clone)]
pub struct RecorderConfig {
    /// 采样率 (Hz)
    pub sample_rate: u32,
    /// 声道数
    pub channels: u16,
}

impl Default for RecorderConfig {
    fn default() -> Self {
        Self {
            sample_rate: 16000, // 16kHz 适合语音识别
            channels: 1,        // 单声道
        }
    }
}

/// 音频录制器
pub struct AudioRecorder {
    host: Host,
    device: Device,
    config: StreamConfig,
    stream: Option<Stream>,
    
    /// 共享的音频缓冲区
    audio_buffer: Arc<Mutex<Vec<f32>>>,
}

impl AudioRecorder {
    /// 创建新的录制器
    pub fn new(recorder_config: RecorderConfig) -> Result<Self> {
        // 获取默认音频主机
        let host = cpal::default_host();
        
        // 获取默认输入设备 (麦克风)
        let device = host
            .default_input_device()
            .context("未找到默认输入设备 (麦克风)")?;
        
        log::info!("🎙️ 使用音频设备: {:?}", device.name());
        
        // 获取设备的默认配置
        let default_config = device
            .default_input_config()
            .context("无法获取设备默认配置")?;
        
        log::info!("📋 设备默认配置: {:?}", default_config);
        
        // 使用设备默认配置,但尝试调整采样率
        let config = StreamConfig {
            channels: default_config.channels(),
            sample_rate: default_config.sample_rate(),
            buffer_size: cpal::BufferSize::Default,
        };
        
        log::info!("✅ 使用配置: {:?}", config);
        
        Ok(Self {
            host,
            device,
            config,
            stream: None,
            audio_buffer: Arc::new(Mutex::new(Vec::new())),
        })
    }

    /// 开始录音
    pub fn start_recording(&mut self) -> Result<()> {
        if self.stream.is_some() {
            log::warn!("⚠️ 录音已经在进行中");
            return Ok(());
        }

        let buffer = Arc::clone(&self.audio_buffer);
        
        // 清空缓冲区
        buffer.lock().unwrap().clear();

        // 获取采样格式
        let default_config = self.device.default_input_config()?;
        let sample_format = default_config.sample_format();
        
        log::info!("🎵 采样格式: {:?}", sample_format);

        // 根据采样格式创建不同的音频流
        let stream = match sample_format {
            cpal::SampleFormat::F32 => {
                self.device.build_input_stream(
                    &self.config,
                    move |data: &[f32], _: &cpal::InputCallbackInfo| {
                        let mut buf = buffer.lock().unwrap();
                        buf.extend_from_slice(data);
                    },
                    |err| {
                        log::error!("❌ 音频流错误: {}", err);
                    },
                    None,
                )?
            }
            cpal::SampleFormat::I16 => {
                let buffer_clone = Arc::clone(&buffer);
                self.device.build_input_stream(
                    &self.config,
                    move |data: &[i16], _: &cpal::InputCallbackInfo| {
                        let mut buf = buffer_clone.lock().unwrap();
                        // 转换 i16 -> f32
                        for &sample in data {
                            buf.push(sample as f32 / 32768.0);
                        }
                    },
                    |err| {
                        log::error!("❌ 音频流错误: {}", err);
                    },
                    None,
                )?
            }
            cpal::SampleFormat::U16 => {
                let buffer_clone = Arc::clone(&buffer);
                self.device.build_input_stream(
                    &self.config,
                    move |data: &[u16], _: &cpal::InputCallbackInfo| {
                        let mut buf = buffer_clone.lock().unwrap();
                        // 转换 u16 -> f32
                        for &sample in data {
                            buf.push((sample as f32 / 32768.0) - 1.0);
                        }
                    },
                    |err| {
                        log::error!("❌ 音频流错误: {}", err);
                    },
                    None,
                )?
            }
            _ => {
                anyhow::bail!("不支持的采样格式: {:?}", sample_format);
            }
        };

        // 启动流
        stream.play()?;
        
        self.stream = Some(stream);
        log::info!("🎙️ 开始录音");
        
        Ok(())
    }

    /// 停止录音
    pub fn stop_recording(&mut self) -> Result<()> {
        if let Some(stream) = self.stream.take() {
            drop(stream);
            log::info!("⏹️ 停止录音");
        }
        Ok(())
    }

    /// 获取录制的音频数据并清空缓冲区
    pub fn take_audio_data(&self) -> Vec<f32> {
        let mut buffer = self.audio_buffer.lock().unwrap();
        std::mem::take(&mut *buffer)
    }

    /// 清空音频缓冲区
    pub fn clear_buffer(&self) {
        self.audio_buffer.lock().unwrap().clear();
    }

    /// 获取当前缓冲区大小 (采样点数)
    pub fn buffer_size(&self) -> usize {
        self.audio_buffer.lock().unwrap().len()
    }

    /// 检查是否正在录音
    pub fn is_recording(&self) -> bool {
        self.stream.is_some()
    }
}

impl Drop for AudioRecorder {
    fn drop(&mut self) {
        let _ = self.stop_recording();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_recorder_creation() {
        let config = RecorderConfig::default();
        let recorder = AudioRecorder::new(config);
        
        // 在没有麦克风的环境中可能失败,这是正常的
        match recorder {
            Ok(r) => {
                assert!(!r.is_recording());
                assert_eq!(r.buffer_size(), 0);
            }
            Err(e) => {
                println!("无法创建录制器 (可能没有麦克风): {}", e);
            }
        }
    }
}
