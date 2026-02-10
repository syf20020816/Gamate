use crate::simulation::SimulationEngine;
use std::sync::{Arc, Mutex};
/// 模拟系统命令接口
use tauri::{command, AppHandle, State};

/// 全局模拟引擎状态
pub struct SimulationState {
    pub engine: Arc<Mutex<Option<SimulationEngine>>>,
}

impl SimulationState {
    pub fn new() -> Self {
        Self {
            engine: Arc::new(Mutex::new(None)),
        }
    }
}

/// 启动直播间模拟
#[command]
pub async fn start_livestream_simulation(
    app: AppHandle,
    state: State<'_, SimulationState>,
) -> Result<(), String> {
    // 创建新引擎
    let mut engine = SimulationEngine::new(app.clone());
    engine.load_config()?;

    // 启动模拟
    engine.start().await?;

    // 存储引擎
    let mut engine_lock = state.engine.lock().unwrap();
    *engine_lock = Some(engine);

    Ok(())
}

/// 停止直播间模拟
#[command]
pub async fn stop_livestream_simulation(state: State<'_, SimulationState>) -> Result<(), String> {
    let mut engine_lock = state.engine.lock().unwrap();

    if let Some(engine) = engine_lock.as_ref() {
        engine.stop();
        *engine_lock = None;
        Ok(())
    } else {
        Err("模拟未运行".to_string())
    }
}

/// 检查模拟是否正在运行
#[command]
pub async fn is_simulation_running(state: State<'_, SimulationState>) -> Result<bool, String> {
    let engine_lock = state.engine.lock().unwrap();
    Ok(engine_lock.is_some())
}

/// 主播说话 (触发 AI 员工回复)
#[command]
pub async fn streamer_speak(
    message: String,
    state: State<'_, SimulationState>,
) -> Result<(), String> {
    // 先克隆引擎引用,避免跨 await 持有锁
    let engine_opt = {
        let engine_lock = state.engine.lock().unwrap();
        engine_lock.as_ref().map(|e| {
            // 克隆必要的数据
            (e.app.clone(), e.employees.clone(), e.memory.clone())
        })
    };

    if let Some((app, employees, memory)) = engine_opt {
        // 在锁外部调用异步方法
        use crate::simulation::SimulationEngine;
        let temp_engine = SimulationEngine::new(app);
        // 手动设置员工和记忆
        let mut temp = temp_engine;
        temp.employees = employees;
        temp.memory = memory;
        temp.on_streamer_speak(&message).await;
        Ok(())
    } else {
        Err("模拟未运行".to_string())
    }
}
