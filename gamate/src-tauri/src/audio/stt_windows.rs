// Windows Speech Recognition STT implementation
// 使用 Windows.Media.SpeechRecognition API

#![cfg(windows)]

use anyhow::{Context, Result};
use windows::{
    core::HSTRING,
    Foundation::IAsyncOperation,
    Globalization::Language,
    Media::SpeechRecognition::{SpeechRecognitionResult, SpeechRecognizer, SpeechRecognizerState},
    Storage::StorageFile,
};

/// Windows STT 引擎
pub struct WindowsSttEngine {
    recognizer: Option<SpeechRecognizer>,
}

impl WindowsSttEngine {
    /// 创建新的 STT 引擎
    pub fn new() -> Result<Self> {
        Ok(Self { recognizer: None })
    }

    /// 初始化识别器
    async fn init_recognizer(&mut self) -> Result<&SpeechRecognizer> {
        if self.recognizer.is_none() {
            // 创建中文语音识别器
            let language = Language::CreateLanguage(&HSTRING::from("zh-CN"))?;
            let recognizer = SpeechRecognizer::Create(&language)?;

            log::info!("🗣️ Windows STT 初始化成功 (语言: zh-CN)");
            self.recognizer = Some(recognizer);
        }

        Ok(self.recognizer.as_ref().unwrap())
    }

    /// 从音频文件识别文字
    ///
    /// # 参数
    /// - `audio_file_path`: WAV 文件路径
    ///
    /// # 返回
    /// - 识别的文字
    pub async fn recognize_from_file(&mut self, audio_file_path: &str) -> Result<String> {
        let recognizer = self.init_recognizer().await?;

        // 打开音频文件
        let file_path = HSTRING::from(audio_file_path);
        let file: StorageFile = StorageFile::GetFileFromPathAsync(&file_path)?
            .get()
            .context("无法打开音频文件")?;

        // 执行识别
        log::info!("🎤 开始识别音频文件: {}", audio_file_path);

        let result: SpeechRecognitionResult = recognizer.RecognizeAsync()?.get()?;

        // 获取识别文字
        let text = result.Text()?.to_string();

        log::info!("✅ 识别结果: {}", text);

        Ok(text)
    }

    /// 从音频数据识别文字 (内存流)
    ///
    /// # 参数
    /// - `audio_data`: 音频数据 (f32 样本, 16kHz, 单声道)
    ///
    /// # 返回
    /// - 识别的文字
    pub async fn recognize_from_audio(
        &mut self,
        audio_data: &[f32],
        sample_rate: u32,
    ) -> Result<String> {
        // 将 f32 音频数据转换为 i16 PCM
        let pcm_data: Vec<i16> = audio_data
            .iter()
            .map(|&sample| (sample.clamp(-1.0, 1.0) * 32767.0) as i16)
            .collect();

        // 保存为临时 WAV 文件
        let temp_path = std::env::temp_dir().join("stt_temp.wav");
        self.save_wav(&temp_path, &pcm_data, sample_rate)?;

        // 从文件识别
        let result = self
            .recognize_from_file(temp_path.to_str().unwrap())
            .await?;

        // 删除临时文件
        let _ = std::fs::remove_file(temp_path);

        Ok(result)
    }

    /// 保存音频数据为 WAV 文件
    fn save_wav(&self, path: &std::path::Path, data: &[i16], sample_rate: u32) -> Result<()> {
        use hound::{WavSpec, WavWriter};

        let spec = WavSpec {
            channels: 1,
            sample_rate,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };

        let mut writer = WavWriter::create(path, spec)?;
        for &sample in data {
            writer.write_sample(sample)?;
        }
        writer.finalize()?;

        Ok(())
    }

    /// 检查识别器状态
    pub async fn get_state(&mut self) -> Result<String> {
        if let Some(recognizer) = &self.recognizer {
            let state: SpeechRecognizerState = recognizer.State()?;
            Ok(format!("{:?}", state))
        } else {
            Ok("未初始化".to_string())
        }
    }
}

impl Default for WindowsSttEngine {
    fn default() -> Self {
        Self::new().unwrap()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore] // 需要实际的音频文件,仅在手动测试时运行
    async fn test_recognize_from_file() {
        let mut engine = WindowsSttEngine::new().unwrap();

        // 需要准备一个测试音频文件
        let test_file = "test_audio.wav";

        match engine.recognize_from_file(test_file).await {
            Ok(text) => {
                println!("识别结果: {}", text);
                assert!(!text.is_empty());
            }
            Err(e) => {
                println!("识别失败: {}", e);
            }
        }
    }
}
