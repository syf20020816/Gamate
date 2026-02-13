/// AI 分析命令
/// 
/// 接收前端传来的语音识别结果和双截图，触发 AI 分析

use tauri::{AppHandle, State};
use crate::commands::simulation_engine_commands::SimulationState;

#[derive(serde::Deserialize)]
pub struct AIAnalysisRequest {
    pub speech_text: String,
    pub screenshot_before: String,  // Base64
    pub screenshot_after: String,   // Base64
}

/// 判断礼物是否为大礼物
fn is_big_gift(gift_name: &str) -> bool {
    // 大礼物列表（可以根据实际情况调整）
    const BIG_GIFTS: &[&str] = &[
        "火箭", "🚀火箭", "游艇", "🛥️游艇", "城堡", "🏰城堡",
        "跑车", "🏎️跑车", "飞机", "✈️飞机", "豪华游轮",
    ];
    
    BIG_GIFTS.iter().any(|&big_gift| gift_name.contains(big_gift))
}

/// 判断是否需要播报礼物
fn should_announce_gift(gift_name: &str, gift_count: u32) -> bool {
    // 大礼物无论数量都播报
    if is_big_gift(gift_name) {
        return true;
    }
    
    // 小礼物数量 >= 10 才播报
    gift_count >= 10
}

/// 清理礼物名称用于播报（移除 emoji，保留中文）
fn clean_gift_name_for_speech(gift_name: &str) -> String {
    gift_name
        .chars()
        .filter(|c| {
            // 保留中文、英文、数字、空格
            c.is_alphabetic() || c.is_numeric() || c.is_whitespace() || (*c >= '\u{4E00}' && *c <= '\u{9FFF}')
        })
        .collect::<String>()
        .trim()
        .to_string()
}

/// 触发 AI 分析（前端调用）
#[tauri::command]
pub async fn trigger_ai_analysis(
    _app: AppHandle,
    state: State<'_, SimulationState>,
    request: AIAnalysisRequest,
) -> Result<String, String> {
    // 获取必要的数据并在锁外调用
    let (app, employees, memory, ai_analyzer, tts_engine, game_id) = {
        let engine_lock = state.engine.lock().unwrap();
        if let Some(engine) = engine_lock.as_ref() {
            (
                engine.app.clone(),
                engine.employees.clone(),
                engine.memory.clone(),
                engine.ai_analyzer.clone(),
                engine.tts_engine.clone(),
                engine.game_id.clone(),
            )
        } else {
            log::warn!("⚠️ 直播间已停止，忽略 AI 分析请求");
            return Err("直播间模拟未启动，已忽略此请求".to_string());
        }
    };

    use crate::simulation::{SimulationEngine, ai_analyzer::{AIAnalyzer, AIAnalysisRequest as AIRequest, EmployeeContext, ConversationMessage}};
    
    // 构建每个员工的上下文
    let employee_contexts: Vec<EmployeeContext> = employees
        .iter()
        .map(|emp| {
            let history = memory.get_conversation_history(&emp.id);
            EmployeeContext {
                id: emp.id.clone(),
                nickname: emp.nickname.clone(),
                personality: emp.personality.clone(),
                conversation_history: history
                    .into_iter()
                    .map(|msg| ConversationMessage {
                        role: msg.role,
                        content: msg.content,
                    })
                    .collect(),
            }
        })
        .collect();

    // 构建 AI 分析请求
    let ai_request = AIRequest {
        streamer_speech: request.speech_text.clone(),
        screenshot_before: request.screenshot_before.clone(),
        screenshot_after: request.screenshot_after.clone(),
        employees: employee_contexts,
        game_id: game_id.clone(),
    };

    // 如果没有 AI 分析器，返回错误
    let Some(analyzer) = ai_analyzer else {
        log::warn!("⚠️ AI 未配置");
        return Err("AI 分析器未配置".to_string());
    };

    // 调用 AI 分析
    match analyzer.analyze(ai_request).await {
        Ok(response) => {
            log::info!("✅ AI 分析成功，生成 {} 个行为", response.actions.len());
            
            // 🔥 打印所有 actions 详情
            for (i, action) in response.actions.iter().enumerate() {
                log::info!("  Action {}: employee={}, content={}, gift={}", 
                    i + 1, action.employee, action.content, action.gift);
            }
            
            // 保存主播的话到所有员工的记忆
            for emp in &employees {
                memory.add_message(&emp.id, "user", &request.speech_text);
            }

            // 执行 AI 决策的行为
            for action in response.actions {
                // 查找对应的员工（支持 ID 或昵称匹配）
                let employee_opt = employees.iter().find(|e| {
                    e.id == action.employee || e.nickname == action.employee
                });
                
                let Some(employee) = employee_opt else {
                    log::warn!("未找到员工: {}", action.employee);
                    continue;
                };

                // 随机延迟 0.5-2 秒（让互动更自然）
                let delay = 500 + (rand::random::<u64>() % 1500);
                
                let app_clone = app.clone();
                let emp_clone = employee.clone();
                let memory_clone = memory.clone();
                let content = action.content.clone();
                let send_gift = action.gift;
                let gift_name = action.gift_name.clone();
                let gift_count = action.gift_count.unwrap_or(1);
                let tts_clone = tts_engine.clone();

                tauri::async_runtime::spawn(async move {
                    use tokio::time::sleep;
                    use std::time::Duration;
                    use tauri::Emitter;
                    use crate::simulation::events::{SimulationEvent, EventType};
                    
                    sleep(Duration::from_millis(delay)).await;
                    
                    // 发送弹幕
                    memory_clone.add_message(&emp_clone.id, "assistant", &content);
                    
                    let event = SimulationEvent::new(EventType::Danmaku {
                        employee_id: emp_clone.id.clone(),
                        nickname: emp_clone.nickname.clone(),
                        message: content.clone(),
                        personality: emp_clone.personality.clone(),
                    });

                    let _ = app_clone.emit("simulation_event", event);

                    // TTS 播报逻辑
                    if let Some(tts) = tts_clone.as_ref() {
                        let announcement = if send_gift {
                            let gift = gift_name.clone().unwrap_or("🚀火箭".to_string());
                            
                            // 判断是否需要播报礼物
                            if should_announce_gift(&gift, gift_count) {
                                // 清理礼物名称（去掉 emoji）
                                let clean_gift = clean_gift_name_for_speech(&gift);
                                
                                if gift_count > 1 {
                                    format!("{}赠送了{}个{}，说：{}", 
                                        emp_clone.nickname, gift_count, clean_gift, content)
                                } else {
                                    format!("{}赠送了{}，说：{}", 
                                        emp_clone.nickname, clean_gift, content)
                                }
                            } else {
                                // 小礼物少量，只播报对话
                                format!("{}说：{}", emp_clone.nickname, content)
                            }
                        } else {
                            // 仅对话
                            format!("{}说：{}", emp_clone.nickname, content)
                        };
                        
                        if let Err(e) = tts.speak(announcement, false) {
                            log::warn!("TTS 播报失败: {}", e);
                        }
                    }

                    // 如果需要送礼物
                    if send_gift {
                        sleep(Duration::from_millis(500)).await;
                        
                        let gift = gift_name.unwrap_or("🚀火箭".to_string());
                        let event = SimulationEvent::new(EventType::Gift {
                            employee_id: emp_clone.id.clone(),
                            nickname: emp_clone.nickname.clone(),
                            gift_name: gift.clone(),
                            count: gift_count,
                        });

                        let _ = app_clone.emit("simulation_event", event);
                    }
                });
            }
            
            Ok("AI 分析已触发".to_string())
        }
        Err(e) => {
            log::error!("AI 分析失败: {}", e);
            Err(format!("AI 分析失败: {}", e))
        }
    }
}
