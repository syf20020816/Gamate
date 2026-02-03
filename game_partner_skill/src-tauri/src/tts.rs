/// TTS (文字转语音) 模块
/// 
/// 使用 `tts` crate 实现跨平台语音合成
/// Windows: SAPI
/// macOS: AVFoundation
/// Linux: Speech Dispatcher
///
use anyhow::{Context, Result};
use std::sync::{Arc, Mutex};
use tts::Tts;
use tokio::sync::mpsc;

/// TTS 播报请求
#[derive(Debug, Clone)]
pub struct SpeakRequest {
    pub text: String,
    pub interrupt: bool, // 是否打断当前播报
}

/// TTS 引擎状态
pub struct TtsEngine {
    tts: Arc<Mutex<Tts>>,
    queue_tx: mpsc::UnboundedSender<SpeakRequest>,
}

impl TtsEngine {
    /// 创建 TTS 引擎实例
    pub fn new() -> Result<Self> {
        log::info!("🔊 初始化 TTS 引擎...");

        // 创建 TTS 实例
        let tts = Tts::default()
            .context("无法初始化 TTS 引擎")?;

        log::info!("✅ TTS 引擎初始化成功");

        let tts = Arc::new(Mutex::new(tts));
        
        // 创建播报队列
        let (queue_tx, mut queue_rx) = mpsc::unbounded_channel::<SpeakRequest>();

        // 启动后台播报任务
        let tts_clone = Arc::clone(&tts);
        tokio::spawn(async move {
            log::info!("🎙️ TTS 播报队列已启动");
            
            while let Some(request) = queue_rx.recv().await {
                log::debug!("📢 收到播报请求: {:?}", request);
                
                let mut tts = tts_clone.lock().unwrap();
                
                // 如果需要打断,先停止当前播报
                if request.interrupt {
                    if let Err(e) = tts.stop() {
                        log::warn!("⚠️  停止播报失败: {}", e);
                    }
                }
                
                // 开始播报
                match tts.speak(&request.text, request.interrupt) {
                    Ok(_) => {
                        log::debug!("✅ 播报成功: {}", &request.text[..request.text.len().min(50)]);
                    }
                    Err(e) => {
                        log::error!("❌ 播报失败: {}", e);
                    }
                }
            }
            
            log::warn!("🛑 TTS 播报队列已关闭");
        });

        Ok(Self { tts, queue_tx })
    }

    /// 播报文本 (异步,不阻塞)
    pub fn speak(&self, text: String, interrupt: bool) -> Result<()> {
        self.queue_tx.send(SpeakRequest { text, interrupt })
            .context("发送播报请求失败")?;
        Ok(())
    }

    /// 停止当前播报
    pub fn stop(&self) -> Result<()> {
        let mut tts = self.tts.lock().unwrap();
        tts.stop().context("停止播报失败")?;
        Ok(())
    }

    /// 设置语速 (0.0 - 10.0, 默认 1.0)
    pub fn set_rate(&self, rate: f32) -> Result<()> {
        let mut tts = self.tts.lock().unwrap();
        
        // 尝试设置语速
        match tts.set_rate(rate) {
            Ok(_) => {
                log::info!("🎚️ 语速已设置为: {}", rate);
                Ok(())
            }
            Err(e) => {
                log::warn!("⚠️  设置语速失败 (可能不支持): {}", e);
                Ok(()) // 不影响主流程
            }
        }
    }

    /// 设置音量 (0.0 - 1.0)
    pub fn set_volume(&self, volume: f32) -> Result<()> {
        let mut tts = self.tts.lock().unwrap();
        
        // 尝试设置音量
        match tts.set_volume(volume) {
            Ok(_) => {
                log::info!("🔊 音量已设置为: {}", volume);
                Ok(())
            }
            Err(e) => {
                log::warn!("⚠️  设置音量失败 (可能不支持): {}", e);
                Ok(()) // 不影响主流程
            }
        }
    }

    /// 获取可用的音色列表
    pub fn get_voices(&self) -> Result<Vec<String>> {
        let tts = self.tts.lock().unwrap();
        
        match tts.voices() {
            Ok(voices) => {
                let voice_names: Vec<String> = voices
                    .iter()
                    .map(|v| v.name().to_string())
                    .collect();
                
                log::debug!("🎤 可用音色: {:?}", voice_names);
                Ok(voice_names)
            }
            Err(e) => {
                log::warn!("⚠️  获取音色列表失败: {}", e);
                Ok(vec![]) // 返回空列表
            }
        }
    }

    /// 设置音色 (通过名称)
    pub fn set_voice(&self, voice_name: &str) -> Result<()> {
        let mut tts = self.tts.lock().unwrap();
        
        match tts.voices() {
            Ok(voices) => {
                // 查找匹配的音色
                if let Some(target_voice) = voices.iter().find(|v| v.name() == voice_name) {
                    match tts.set_voice(target_voice) {
                        Ok(_) => {
                            log::info!("🎤 音色已设置为: {}", voice_name);
                            Ok(())
                        }
                        Err(e) => {
                            log::warn!("⚠️  设置音色失败: {}", e);
                            Ok(())
                        }
                    }
                } else {
                    log::warn!("⚠️  未找到音色: {}", voice_name);
                    Ok(())
                }
            }
            Err(e) => {
                log::warn!("⚠️  获取音色列表失败: {}", e);
                Ok(())
            }
        }
    }
}

/// 全局 TTS 引擎实例
static mut TTS_ENGINE: Option<Arc<TtsEngine>> = None;
static INIT: std::sync::Once = std::sync::Once::new();

/// 获取或初始化 TTS 引擎
pub fn get_tts_engine() -> Result<Arc<TtsEngine>> {
    unsafe {
        INIT.call_once(|| {
            match TtsEngine::new() {
                Ok(engine) => {
                    TTS_ENGINE = Some(Arc::new(engine));
                }
                Err(e) => {
                    log::error!("❌ TTS 引擎初始化失败: {}", e);
                }
            }
        });

        TTS_ENGINE.clone().context("TTS 引擎未初始化")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_tts_basic() {
        env_logger::init();
        
        let engine = TtsEngine::new().unwrap();
        engine.speak("你好,这是一个测试".to_string(), false).unwrap();
        
        // 等待播报完成
        tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
    }

    #[test]
    fn test_tts_rate() {
        env_logger::init();
        
        let engine = TtsEngine::new().unwrap();
        engine.set_rate(1.5).unwrap();
        engine.speak("语速测试".to_string(), false).unwrap();
    }
}
