/// 直播间模拟引擎
/// 
/// 核心调度器,负责触发各种事件

use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::time::{interval, sleep};
use rand::Rng;
use tauri::{AppHandle, Emitter};

use super::events::{SimulationEvent, EventType, frequency_to_interval, gift_frequency_to_params};
use super::memory::MemoryManager;
use super::ai_analyzer::{
    AIAnalyzer, AIAnalysisRequest, EmployeeContext, ConversationMessage
};
use crate::settings::AppSettings;

/// AI 员工配置
#[derive(Debug, Clone)]
pub struct EmployeeConfig {
    pub id: String,
    pub personality: String,
    pub interaction_frequency: String,
    pub nickname: String,
}

/// 模拟引擎
pub struct SimulationEngine {
    pub app: AppHandle,
    pub memory: Arc<MemoryManager>,
    is_running: Arc<Mutex<bool>>,
    pub employees: Vec<EmployeeConfig>,
    gift_frequency: String,
    pub ai_analyzer: Option<AIAnalyzer>,
    /// 🔥 智能模式开关：true = 等待语音触发, false = 自动循环发送
    pub enable_smart_mode: bool,
}

impl SimulationEngine {
    pub fn new(app: AppHandle) -> Self {
        Self {
            app,
            memory: Arc::new(MemoryManager::new()),
            is_running: Arc::new(Mutex::new(false)),
            employees: Vec::new(),
            gift_frequency: "medium".to_string(),
            ai_analyzer: None,
            enable_smart_mode: true,  // 🔥 默认启用智能模式
        }
    }

    /// 加载配置
    pub fn load_config(&mut self) -> Result<(), String> {
        let settings = AppSettings::load().map_err(|e| e.to_string())?;
        
        // 加载 AI 员工配置
        self.employees = settings
            .simulation
            .employees
            .iter()
            .map(|emp| EmployeeConfig {
                id: emp.id.clone(),
                personality: emp.personality.clone(),
                interaction_frequency: emp.interaction_frequency.clone(),
                nickname: emp.nickname.clone(),
            })
            .collect();

        self.gift_frequency = settings.simulation.livestream.gift_frequency.clone();

        // 🔥 初始化 AI 分析器（使用多模态模型配置）
        let multimodal_config = &settings.ai_models.multimodal;
        let api_endpoint = multimodal_config.api_base.clone();
        let api_key = multimodal_config.api_key.clone().unwrap_or_default();
        let model = multimodal_config.model_name.clone();
        
        if !api_endpoint.is_empty() && !api_key.is_empty() {
            self.ai_analyzer = Some(AIAnalyzer::new(api_endpoint, api_key, model));
            println!("✅ AI 分析器已初始化: {}", multimodal_config.model_name);
        } else {
            println!("⚠️ 多模态 AI 未配置，将使用传统模板模式");
        }

        Ok(())
    }

    /// 启动模拟
    pub async fn start(&self) -> Result<(), String> {
        {
            let mut running = self.is_running.lock().unwrap();
            if *running {
                return Err("模拟已在运行中".to_string());
            }
            *running = true;
        }

        // 清空所有记忆
        self.memory.clear_all();

        println!("🎬 直播间模拟启动...");

        // 触发开播事件
        self.trigger_stream_start().await;

        // 🔥 只有在非智能模式下才启动自动循环
        if !self.enable_smart_mode {
            println!("🤖 传统模式：启动自动弹幕循环");
            for employee in &self.employees {
                self.spawn_employee_loop(employee.clone());
            }
        } else {
            println!("🤖 智能模式已启用，等待主播语音触发 AI 互动");
        }

        Ok(())
    }

    /// 停止模拟
    pub fn stop(&self) {
        let mut running = self.is_running.lock().unwrap();
        *running = false;
        println!("🛑 直播间模拟停止");
    }

    /// 触发开播事件
    async fn trigger_stream_start(&self) {
        println!("📢 触发开播事件");

        // 20% 概率刷礼物
        if rand::random::<f64>() < 0.2 {
            self.trigger_gift_event(None).await;
        }

        // 5-10秒后,50% 概率打招呼
        let delay = rand::thread_rng().gen_range(5..=10);
        let app = self.app.clone();
        let employees = self.employees.clone();
        let memory = self.memory.clone();

        tauri::async_runtime::spawn(async move {
            sleep(Duration::from_secs(delay)).await;

            if rand::random::<f64>() < 0.5 {
                if let Some(employee) = employees.first() {
                    let greeting = Self::generate_greeting(&employee.personality, &employee.nickname);
                    
                    // 保存到记忆
                    memory.add_message(&employee.id, "assistant", &greeting);

                    let event = SimulationEvent::new(EventType::Greeting {
                        employee_id: employee.id.clone(),
                        nickname: employee.nickname.clone(),
                        message: greeting,
                    });

                    let _ = app.emit("simulation_event", event);
                }
            }
        });
    }

    /// 生成打招呼消息
    fn generate_greeting(personality: &str, nickname: &str) -> String {
        match personality {
            "sunnyou_male" => format!("{}来啦!兄弟们冲鸭!", nickname),
            "funny_female" => format!("{}报到~今天也要开心鸭!", nickname),
            "kobe" => format!("Mamba is here! Let's go!"),
            "sweet_girl" => format!("{}来咯~主播加油哦💕", nickname),
            "trump" => format!("I'm here, and this stream will be HUGE!"),
            _ => format!("{}来了~", nickname),
        }
    }

    /// 为每个员工启动事件循环
    fn spawn_employee_loop(&self, employee: EmployeeConfig) {
        let app = self.app.clone();
        let is_running = self.is_running.clone();
        let memory = self.memory.clone();
        let gift_frequency = self.gift_frequency.clone();

        // 使用 tauri::async_runtime::spawn 替代 tokio::spawn
        tauri::async_runtime::spawn(async move {
            let (min_interval, max_interval) = frequency_to_interval(&employee.interaction_frequency);

            while *is_running.lock().unwrap() {
                // 随机等待一段时间 (使用 rand::random 避免 ThreadRng)
                let wait_time = min_interval + (rand::random::<u64>() % (max_interval - min_interval + 1));
                sleep(Duration::from_secs(wait_time)).await;

                if !*is_running.lock().unwrap() {
                    break;
                }

                // 70% 概率发弹幕, 30% 概率送礼物
                if rand::random::<f64>() < 0.7 {
                    // 发送弹幕
                    Self::send_danmaku(&app, &employee, &memory).await;
                } else {
                    // 送礼物
                    Self::send_gift(&app, &employee, &gift_frequency).await;
                }
            }

            println!("🔚 员工 {} 的事件循环结束", employee.nickname);
        });
    }

    /// 发送弹幕
    async fn send_danmaku(app: &AppHandle, employee: &EmployeeConfig, memory: &Arc<MemoryManager>) {
        let message = Self::generate_danmaku(&employee.personality, &employee.nickname, memory, &employee.id).await;
        
        // 保存到记忆
        memory.add_message(&employee.id, "assistant", &message);

        let event = SimulationEvent::new(EventType::Danmaku {
            employee_id: employee.id.clone(),
            nickname: employee.nickname.clone(),
            message: message.clone(),
            personality: employee.personality.clone(),
        });

        let _ = app.emit("simulation_event", event);
        println!("💬 [{}] {}", employee.nickname, message);
    }

    /// 生成弹幕内容
    async fn generate_danmaku(personality: &str, nickname: &str, memory: &Arc<MemoryManager>, employee_id: &str) -> String {
        // 这里可以调用 LLM 生成更智能的内容
        // 暂时使用模板生成
        let templates = Self::get_danmaku_templates(personality);
        let index = rand::random::<usize>() % templates.len();
        
        templates[index].to_string()
    }

    /// 获取弹幕模板 (根据性格)
    fn get_danmaku_templates(personality: &str) -> Vec<&'static str> {
        match personality {
            "sunnyou_male" => vec![
                "这波操作可以啊!",
                "兄弟稳住,我看好你!",
                "哈哈哈笑死我了",
                "主播别怂,就是干!",
                "这游戏有点东西啊",
            ],
            "funny_female" => vec![
                "哈哈哈主播好搞笑~",
                "这是什么神仙操作!",
                "加油加油!你可以的!",
                "笑不活了哈哈哈",
                "主播太可爱了吧!",
            ],
            "kobe" => vec![
                "Mamba Mentality! Keep going!",
                "You got this! Focus!",
                "Great move! Championship level!",
                "Never give up!",
                "That's what I'm talking about!",
            ],
            "sweet_girl" => vec![
                "主播好厉害呀~",
                "加油加油💕",
                "好帅气的操作!",
                "主播最棒了!",
                "我会一直支持你的~",
            ],
            "trump" => vec![
                "This is TREMENDOUS!",
                "Nobody plays better than you!",
                "HUGE victory coming!",
                "You're doing a fantastic job!",
                "Make gaming great again!",
            ],
            _ => vec![
                "666",
                "主播加油!",
                "这波可以",
                "nice!",
                "支持主播!",
            ],
        }
    }

    /// 发送礼物
    async fn send_gift(app: &AppHandle, employee: &EmployeeConfig, gift_frequency: &str) {
        let (min_count, max_count, min_combo, max_combo) = gift_frequency_to_params(gift_frequency);

        let combo = min_combo + (rand::random::<u32>() % (max_combo - min_combo + 1));
        let gifts = vec!["🚀火箭", "🌹鲜花", "666"];
        let gift_name = gifts[rand::random::<usize>() % gifts.len()];

        for _ in 0..combo {
            let count = min_count + (rand::random::<u32>() % (max_count - min_count + 1));

            let event = SimulationEvent::new(EventType::Gift {
                employee_id: employee.id.clone(),
                nickname: employee.nickname.clone(),
                gift_name: gift_name.to_string(),
                count,
            });

            let _ = app.emit("simulation_event", event);
            println!("🎁 [{}] 送出 {} x{}", employee.nickname, gift_name, count);

            // 连刷间隔 500ms
            sleep(Duration::from_millis(500)).await;
        }
    }

    /// 触发礼物事件 (手动触发,如开播)
    async fn trigger_gift_event(&self, employee_id: Option<String>) {
        let employee = if let Some(id) = employee_id {
            self.employees.iter().find(|e| e.id == id).cloned()
        } else {
            self.employees.first().cloned()
        };

        if let Some(emp) = employee {
            Self::send_gift(&self.app, &emp, &self.gift_frequency).await;
        }
    }

    /// 处理主播说话事件 (极大概率触发弹幕反馈)
    pub async fn on_streamer_speak(&self, message: &str) {
        // 90% 概率触发弹幕反馈
        if rand::random::<f64>() >= 0.9 {
            return;
        }

        // 随机选择1-3个员工回复
        let response_count = 1 + (rand::random::<usize>() % 3.min(self.employees.len()));
        let mut employees: Vec<_> = self.employees.clone();
        
        // 打乱顺序 (Fisher-Yates shuffle)
        for i in (1..employees.len()).rev() {
            let j = rand::random::<usize>() % (i + 1);
            employees.swap(i, j);
        }

        for employee in employees.iter().take(response_count) {
            // 随机延迟 0.5-2 秒
            let delay = 500 + (rand::random::<u64>() % 1500);
            
            let app = self.app.clone();
            let emp = employee.clone();
            let memory = self.memory.clone();
            let msg = message.to_string();

            tauri::async_runtime::spawn(async move {
                sleep(Duration::from_millis(delay)).await;
                
                // 保存主播的话到记忆
                memory.add_message(&emp.id, "user", &msg);
                
                // 生成回复
                Self::send_danmaku(&app, &emp, &memory).await;
            });
        }
    }

    /// 🔥 处理智能截图事件（AI 驱动的互动）
    pub async fn on_smart_capture_completed(
        &self,
        speech_text: &str,
        screenshot_before: &str,
        screenshot_after: &str,
    ) {
        println!("🎬 处理智能截图事件");
        println!("  语音: {}", speech_text);
        
        // 如果没有配置 AI，回退到传统模式
        let Some(ai_analyzer) = &self.ai_analyzer else {
            println!("⚠️ AI 未配置，使用传统模式");
            self.on_streamer_speak(speech_text).await;
            return;
        };

        // 构建每个员工的上下文
        let employee_contexts: Vec<EmployeeContext> = self.employees
            .iter()
            .map(|emp| {
                let history = self.memory.get_conversation_history(&emp.id);
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
        let request = AIAnalysisRequest {
            streamer_speech: speech_text.to_string(),
            screenshot_before: screenshot_before.to_string(),
            screenshot_after: screenshot_after.to_string(),
            employees: employee_contexts,
        };

        // 调用 AI 分析
        match ai_analyzer.analyze(request).await {
            Ok(response) => {
                println!("✅ AI 分析成功，生成 {} 个行为", response.actions.len());
                
                // 保存主播的话到所有员工的记忆
                for emp in &self.employees {
                    self.memory.add_message(&emp.id, "user", speech_text);
                }

                // 执行 AI 决策的行为
                for action in response.actions {
                    // 查找对应的员工
                    let Some(employee) = self.employees.iter().find(|e| e.id == action.employee) else {
                        println!("⚠️ 未找到员工: {}", action.employee);
                        continue;
                    };

                    // 随机延迟 0.5-2 秒（让互动更自然）
                    let delay = 500 + (rand::random::<u64>() % 1500);
                    
                    let app = self.app.clone();
                    let emp = employee.clone();
                    let memory = self.memory.clone();
                    let content = action.content.clone();
                    let send_gift = action.gift;
                    let gift_name = action.gift_name.clone();
                    let gift_count = action.gift_count.unwrap_or(1);

                    tauri::async_runtime::spawn(async move {
                        sleep(Duration::from_millis(delay)).await;
                        
                        // 发送弹幕
                        memory.add_message(&emp.id, "assistant", &content);
                        
                        let event = SimulationEvent::new(EventType::Danmaku {
                            employee_id: emp.id.clone(),
                            nickname: emp.nickname.clone(),
                            message: content.clone(),
                            personality: emp.personality.clone(),
                        });

                        let _ = app.emit("simulation_event", event);
                        println!("💬 [{}] {}", emp.nickname, content);

                        // 如果需要送礼物
                        if send_gift {
                            sleep(Duration::from_millis(500)).await;
                            
                            let gift = gift_name.unwrap_or("🚀火箭".to_string());
                            let event = SimulationEvent::new(EventType::Gift {
                                employee_id: emp.id.clone(),
                                nickname: emp.nickname.clone(),
                                gift_name: gift.clone(),
                                count: gift_count,
                            });

                            let _ = app.emit("simulation_event", event);
                            println!("🎁 [{}] 送出 {} x{}", emp.nickname, gift, gift_count);
                        }
                    });
                }
            }
            Err(e) => {
                println!("❌ AI 分析失败: {}", e);
                // 回退到传统模式
                self.on_streamer_speak(speech_text).await;
            }
        }
    }
}
