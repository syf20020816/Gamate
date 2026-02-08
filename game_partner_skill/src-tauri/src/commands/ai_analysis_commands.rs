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

/// 🔥 触发 AI 分析（前端调用）
#[tauri::command]
pub async fn trigger_ai_analysis(
    _app: AppHandle,
    state: State<'_, SimulationState>,
    request: AIAnalysisRequest,
) -> Result<String, String> {
    log::info!("🤖 收到 AI 分析请求");
    log::info!("  语音文本: {}", request.speech_text);
    log::info!("  截图数据: {}B / {}B", 
               request.screenshot_before.len(), 
               request.screenshot_after.len());

    // 🔥 获取必要的数据并在锁外调用
    let (app, employees, memory, ai_analyzer) = {
        let engine_lock = state.engine.lock().unwrap();
        if let Some(engine) = engine_lock.as_ref() {
            (
                engine.app.clone(),
                engine.employees.clone(),
                engine.memory.clone(),
                engine.ai_analyzer.clone(),
            )
        } else {
            return Err("直播间模拟未启动".to_string());
        }
    };

    // 🔥 在锁外部执行异步操作
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
            
            // 保存主播的话到所有员工的记忆
            for emp in &employees {
                memory.add_message(&emp.id, "user", &request.speech_text);
            }

            // 执行 AI 决策的行为
            for action in response.actions {
                // 查找对应的员工
                let Some(employee) = employees.iter().find(|e| e.id == action.employee) else {
                    log::warn!("⚠️ 未找到员工: {}", action.employee);
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
                    log::info!("💬 [{}] {}", emp_clone.nickname, content);

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
                        log::info!("🎁 [{}] 送出 {} x{}", emp_clone.nickname, gift, gift_count);
                    }
                });
            }
            
            Ok("AI 分析已触发".to_string())
        }
        Err(e) => {
            log::error!("❌ AI 分析失败: {}", e);
            Err(format!("AI 分析失败: {}", e))
        }
    }
}
