use anyhow::Result;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::Duration;
use chrono::Utc;
use hmac::{Hmac, Mac};
use sha1::Sha1;
use base64;
use percent_encoding::{percent_encode, NON_ALPHANUMERIC};
use uuid::Uuid;
use once_cell::sync::OnceCell;
use std::sync::Mutex;
use futures::{SinkExt, StreamExt};
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::connect_async;
use url::Url;
use tauri::{AppHandle, Emitter};

type HmacSha1 = Hmac<Sha1>;

const ENCODE_SET: &percent_encoding::AsciiSet = &NON_ALPHANUMERIC
    .remove(b'-')
    .remove(b'_')
    .remove(b'.')
    .remove(b'~');

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AliyunConfig {
    pub access_key: Option<String>,
    pub secret: Option<String>,
    pub region: Option<String>,
    pub endpoint: Option<String>,
}

impl Default for AliyunConfig {
    fn default() -> Self {
        Self {
            access_key: None,
            secret: None,
            region: Some("cn-shanghai".to_string()),
            endpoint: Some("https://nls-gateway.aliyuncs.com".to_string()),
        }
    }
}

#[derive(Serialize, Deserialize)]
pub struct TokenResult {
    pub token: String,
    pub expire_time: u64,
}

#[derive(Debug, Clone)]
struct CachedToken {
    token: String,
    expire_time: u64,
}

static TOKEN_CACHE: OnceCell<Mutex<Option<CachedToken>>> = OnceCell::new();

fn token_cache() -> &'static Mutex<Option<CachedToken>> {
    TOKEN_CACHE.get_or_init(|| Mutex::new(None))
}

fn percent_encode_str(s: &str) -> String {
    percent_encode(s.as_bytes(), ENCODE_SET).to_string()
}

/// 将PCM数据保存为WAV文件
fn save_pcm_as_wav(pcm_data: &[u8], filename: &str, sample_rate: u32) -> std::io::Result<()> {
    use std::fs::File;
    use std::io::Write;
    
    let mut file = File::create(filename)?;
    
    // WAV文件头
    let bits_per_sample = 16u16;
    let channels = 1u16;
    let byte_rate = sample_rate * (channels as u32) * (bits_per_sample as u32) / 8;
    let block_align = channels * bits_per_sample / 8;
    let data_size = pcm_data.len() as u32;
    
    // RIFF header
    file.write_all(b"RIFF")?;
    file.write_all(&(36 + data_size).to_le_bytes())?;
    file.write_all(b"WAVE")?;
    
    // fmt chunk
    file.write_all(b"fmt ")?;
    file.write_all(&16u32.to_le_bytes())?; // chunk size
    file.write_all(&1u16.to_le_bytes())?;  // audio format (PCM)
    file.write_all(&channels.to_le_bytes())?;
    file.write_all(&sample_rate.to_le_bytes())?;
    file.write_all(&byte_rate.to_le_bytes())?;
    file.write_all(&block_align.to_le_bytes())?;
    file.write_all(&bits_per_sample.to_le_bytes())?;
    
    // data chunk
    file.write_all(b"data")?;
    file.write_all(&data_size.to_le_bytes())?;
    file.write_all(pcm_data)?;
    
    Ok(())
}

/// 根据阿里云 OpenAPI 签名机制，构造 CreateToken 请求并返回 Token
#[tauri::command]
pub async fn aliyun_get_token(
    access_key: String,
    access_secret: String,
    region: Option<String>,
) -> Result<TokenResult, String> {
    let region = region.unwrap_or_else(|| "cn-shanghai".to_string());

    // 准备参数（不包含 Signature）
    let mut params = vec![
        ("AccessKeyId".to_string(), access_key.clone()),
        ("Action".to_string(), "CreateToken".to_string()),
        ("Version".to_string(), "2019-02-28".to_string()),
        ("Format".to_string(), "JSON".to_string()),
        ("RegionId".to_string(), region.clone()),
        ("Timestamp".to_string(), Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string()),
        ("SignatureMethod".to_string(), "HMAC-SHA1".to_string()),
        ("SignatureVersion".to_string(), "1.0".to_string()),
        ("SignatureNonce".to_string(), Uuid::new_v4().to_string()),
    ];

    // 按参数名字典序排序
    params.sort_by(|a, b| a.0.cmp(&b.0));

    // 构造规范化请求字符串
    let mut canonicalized = String::new();
    for (i, (k, v)) in params.iter().enumerate() {
        if i > 0 {
            canonicalized.push('&');
        }
        canonicalized.push_str(&format!("{}={}", percent_encode_str(k), percent_encode_str(v)));
    }

    // 构造待签名字符串: GET&%2F&percentEncode(canonicalized)
    let string_to_sign = format!(
        "GET&{}&{}",
        percent_encode_str("/"),
        percent_encode_str(&canonicalized)
    );

    // 计算 HMAC-SHA1 签名，key = access_secret + "&"
    let signing_key = format!("{}&", access_secret);
    let mut mac = HmacSha1::new_from_slice(signing_key.as_bytes())
        .map_err(|e| format!("签名初始化失败: {}", e))?;
    mac.update(string_to_sign.as_bytes());
    let signature_bytes = mac.finalize().into_bytes();
    let signature_base64 = base64::encode(&signature_bytes);
    let signature_encoded = percent_encode_str(&signature_base64);

    // 组合带签名的请求字符串
    let query_with_sig = format!("Signature={}&{}", signature_encoded, canonicalized);

    // Token 服务域名
    let url = format!(
        "http://nls-meta.{}.aliyuncs.com/?{}",
        region, query_with_sig
    );

    let client = Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    let resp = client
        .get(&url)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    let status = resp.status();
    let text = resp
        .text()
        .await
        .map_err(|e| format!("读取响应失败: {}", e))?;

    if !status.is_success() {
        return Err(format!("获取 Token 失败: {} - {}", status, text));
    }

    // 解析 JSON，获取 Token.Id 和 Token.ExpireTime
    let v: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| format!("解析响应为 JSON 失败: {} (raw: {})", e, text))?;

    if let Some(token_obj) = v.get("Token") {
        let id = token_obj
            .get("Id")
            .and_then(|s| s.as_str())
            .ok_or_else(|| "响应中未包含 Token.Id".to_string())?;
        let expire = token_obj
            .get("ExpireTime")
            .and_then(|n| n.as_u64())
            .ok_or_else(|| "响应中未包含 Token.ExpireTime".to_string())?;

        Ok(TokenResult {
            token: id.to_string(),
            expire_time: expire,
        })
    } else {
        Err(format!("响应中未包含 Token 字段: {}", text))
    }
}

/// 获取缓存的 token，如果不存在或快过期则重新请求
#[tauri::command]
pub async fn aliyun_get_cached_token(
    access_key: String,
    access_secret: String,
    region: Option<String>,
) -> Result<TokenResult, String> {
    let region = region.unwrap_or_else(|| "cn-shanghai".to_string());

    // 检查缓存
    {
        let lock = token_cache().lock().map_err(|e| e.to_string())?;
        if let Some(cached) = &*lock {
            // 提前 60 秒刷新
            let now = Utc::now().timestamp() as u64;
            if cached.expire_time > now + 60 {
                return Ok(TokenResult {
                    token: cached.token.clone(),
                    expire_time: cached.expire_time,
                });
            }
        }
    }

    // 否则请求新 token
    let token_res = aliyun_get_token(access_key.clone(), access_secret.clone(), Some(region)).await?;

    // 更新缓存
    {
        let mut lock = token_cache().lock().map_err(|e| e.to_string())?;
        *lock = Some(CachedToken {
            token: token_res.token.clone(),
            expire_time: token_res.expire_time,
        });
    }

    Ok(token_res)
}

/// 测试连接
#[tauri::command]
pub async fn aliyun_test_connection(config: String) -> Result<String, String> {
    let cfg: AliyunConfig = serde_json::from_str(&config).map_err(|e| e.to_string())?;

    if cfg.access_key.is_none() {
        return Err("access_key 未提供".to_string());
    }

    let endpoint = cfg
        .endpoint
        .clone()
        .unwrap_or_else(|| "https://nls-gateway.aliyuncs.com".to_string());

    let client = Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .get(&endpoint)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    Ok(format!("状态: {}", resp.status()))
}

/// 一句话识别 (使用 WebSocket)
#[tauri::command]
pub async fn aliyun_one_sentence_recognize(
    app: AppHandle,
    appkey: String,
    access_key: String,
    access_secret: String,
    pcm_data: Vec<u8>,
    region: Option<String>,
) -> Result<String, String> {
    log::info!("🎤 开始一句话识别，音频数据: {} 字节", pcm_data.len());
    
    if pcm_data.is_empty() {
        return Err("音频数据为空".to_string());
    }
    
    if pcm_data.len() < 3200 {
        log::warn!("⚠️ 音频数据较小: {} 字节", pcm_data.len());
    }
    
    // 保存为WAV文件用于调试 - 使用时间戳避免覆盖
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
    
    // 音频应该已经被重采样到 16kHz，所以这里使用 16000
    let actual_sample_rate = 16000u32;
    
    // 尝试多个可能的下载目录
    let possible_paths = vec![
        std::env::var("USERPROFILE").ok().map(|p| format!("{}\\Downloads\\debug_audio_{}.wav", p, timestamp)),
        Some(format!("debug_audio_{}.wav", timestamp)), // 当前目录作为后备
    ];
    
    let mut saved = false;
    for path_option in possible_paths {
        if let Some(debug_filename) = path_option {
            if let Ok(_) = save_pcm_as_wav(&pcm_data, &debug_filename, actual_sample_rate) {
                log::info!("💾 已保存调试音频: {}", debug_filename);
                log::info!("📊 音频信息: {} 字节, {}Hz, 16-bit PCM, 单声道", pcm_data.len(), actual_sample_rate);
                log::info!("⏱️ 音频时长: 约 {:.2} 秒", pcm_data.len() as f32 / (actual_sample_rate as f32 * 2.0));
                saved = true;
                break;
            }
        }
    }
    
    if !saved {
        log::warn!("⚠️ 无法保存调试音频文件到任何位置");
    }
    
    let region = region.unwrap_or_else(|| "cn-shanghai".to_string());

    log::info!("🔑 获取 Token...");
    let token_res = aliyun_get_cached_token(access_key, access_secret, Some(region.clone())).await?;
    let token = token_res.token;
    log::info!("✅ Token 获取成功: {}", &token[..20.min(token.len())]);

    // 构造 WebSocket URL (不需要对token进行URL编码,直接使用)
    let ws_url = format!(
        "wss://nls-gateway-{}.aliyuncs.com/ws/v1?token={}",
        region,
        token
    );
    
    log::info!("🌐 Region: {}", region);
    log::info!("🔗 WebSocket URL: {}", ws_url);

    log::info!("🔌 正在连接 WebSocket...");
    let (ws_stream, _resp) = connect_async(&ws_url).await.map_err(|e| format!("WS连接失败: {}", e))?;
    log::info!("✅ WebSocket 连接成功");
    
    let (mut write, mut read) = ws_stream.split();

    let task_id = Uuid::new_v4().simple().to_string();
    log::info!("📋 任务 ID: {}", task_id);

    // 1. 发送 StartRecognition
    let start_msg = json!({
        "header": {
            "message_id": Uuid::new_v4().simple().to_string(),
            "task_id": task_id.clone(),
            "namespace": "SpeechRecognizer",
            "name": "StartRecognition",
            "appkey": appkey.clone()
        },
        "payload": {
            "format": "pcm",
            "sample_rate": 16000,
            "enable_intermediate_result": true,
            "enable_punctuation_prediction": true,
            "enable_inverse_text_normalization": true
        }
    });
    
    let start_text = serde_json::to_string(&start_msg).map_err(|e| e.to_string())?;
    log::info!("📤 发送 StartRecognition");
    write.send(Message::Text(start_text)).await.map_err(|e| format!("发送失败: {}", e))?;

    // 1.5. 等待 RecognitionStarted 确认
    log::info!("⏳ 等待 RecognitionStarted 确认...");
    let mut recognition_started = false;
    
    while let Some(msg) = read.next().await {
        match msg {
            Ok(Message::Text(txt)) => {
                log::info!("📥 收到确认消息: {}", txt);
                
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(&txt) {
                    if let Some(header) = v.get("header") {
                        let name = header.get("name").and_then(|n| n.as_str()).unwrap_or("");
                        let status = header.get("status").and_then(|s| s.as_i64()).unwrap_or(0);
                        
                        if status != 20000000 && status != 0 {
                            if let Some(status_text) = header.get("status_text").and_then(|s| s.as_str()) {
                                return Err(format!("启动识别失败: {} - {}", status, status_text));
                            }
                        }
                        
                        if name == "RecognitionStarted" {
                            log::info!("✅ 识别已启动，可以发送音频数据");
                            recognition_started = true;
                            break;
                        }
                    }
                }
            }
            Ok(Message::Close(_)) => {
                return Err("服务器在启动识别前关闭连接".to_string());
            }
            Err(e) => {
                return Err(format!("等待确认时出错: {}", e));
            }
            _ => {}
        }
    }
    
    if !recognition_started {
        return Err("未收到 RecognitionStarted 确认".to_string());
    }

    // 2. 发送音频数据
    log::info!("📤 发送音频数据: {} 字节", pcm_data.len());
    
    const CHUNK_SIZE: usize = 3200;
    let mut offset = 0;
    
    while offset < pcm_data.len() {
        let end = (offset + CHUNK_SIZE).min(pcm_data.len());
        let chunk = &pcm_data[offset..end];
        
        write.send(Message::Binary(chunk.to_vec()))
            .await
            .map_err(|e| format!("发送音频块失败 (offset: {}): {}", offset, e))?;
        
        offset = end;
        
        if offset < pcm_data.len() {
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    }
    
    log::info!("✅ 音频数据发送完成，共发送 {} 字节", pcm_data.len());

    // 3. 发送 StopRecognition
    let stop_msg = json!({
        "header": {
            "message_id": Uuid::new_v4().simple().to_string(),
            "task_id": task_id.clone(),
            "namespace": "SpeechRecognizer",
            "name": "StopRecognition",
            "appkey": appkey
        },
        "payload": {}
    });
    
    let stop_text = serde_json::to_string(&stop_msg).map_err(|e| e.to_string())?;
    log::info!("📤 发送 StopRecognition");
    write.send(Message::Text(stop_text)).await.map_err(|e| format!("发送失败: {}", e))?;

    // 4. 接收识别结果
    let mut final_result = String::new();
    let timeout_duration = Duration::from_secs(10);
    
    log::info!("👂 开始接收识别结果 (超时: {}秒)...", timeout_duration.as_secs());
    
    let receive_task = async {
        let mut message_count = 0;
        while let Some(msg) = read.next().await {
            message_count += 1;
            match msg {
                Ok(Message::Text(txt)) => {
                    log::info!("📥 收到消息 #{}: {}", message_count, txt);
                    
                    let _ = app.emit("aliyun_asr_event", txt.clone());
                    
                    if let Ok(v) = serde_json::from_str::<serde_json::Value>(&txt) {
                        if let Some(header) = v.get("header") {
                            let name = header.get("name").and_then(|n| n.as_str()).unwrap_or("");
                            let status = header.get("status").and_then(|s| s.as_i64()).unwrap_or(0);
                            
                            log::info!("   消息类型: {}, 状态码: {}", name, status);
                            
                            if status != 20000000 && status != 0 {
                                if let Some(status_text) = header.get("status_text").and_then(|s| s.as_str()) {
                                    log::error!("❌ 服务端错误: {} - {}", status, status_text);
                                }
                            }
                            
                            if name == "RecognitionResultChanged" {
                                if let Some(payload) = v.get("payload") {
                                    if let Some(result) = payload.get("result").and_then(|r| r.as_str()) {
                                        log::info!("   中间结果: {}", result);
                                    }
                                }
                            }
                            
                            if name == "RecognitionCompleted" {
                                if let Some(payload) = v.get("payload") {
                                    if let Some(result) = payload.get("result").and_then(|r| r.as_str()) {
                                        log::info!("✅ 最终结果: {}", result);
                                        final_result = result.to_string();
                                    } else {
                                        log::warn!("⚠️ RecognitionCompleted 但没有 result 字段");
                                    }
                                } else {
                                    log::warn!("⚠️ RecognitionCompleted 但没有 payload");
                                }
                                break;
                            }
                        }
                    }
                }
                Ok(Message::Close(_)) => {
                    log::info!("🔌 WebSocket 连接关闭");
                    break;
                }
                Err(e) => {
                    log::error!("❌ 接收消息错误: {}", e);
                    break;
                }
                _ => {
                    log::debug!("收到其他类型消息");
                }
            }
        }
        log::info!("📊 总共收到 {} 条消息", message_count);
        final_result.clone()
    };

    let result = tokio::time::timeout(timeout_duration, receive_task)
        .await
        .map_err(|_| {
            log::error!("⏱️ 识别超时 ({}秒)", timeout_duration.as_secs());
            "识别超时".to_string()
        })?;

    log::info!("🔌 关闭 WebSocket 连接");
    let _ = write.close().await;

    if result.is_empty() {
        log::warn!("⚠️ 未获取到识别结果");
        Err("未获取到识别结果".to_string())
    } else {
        log::info!("🎉 识别成功: {}", result);
        Ok(result)
    }
}

/// TTS 合成占位
#[tauri::command]
pub async fn aliyun_tts_synthesize(_text: String) -> Result<String, String> {
    Ok("(aliyun tts) base64-audio-placeholder".to_string())
}
