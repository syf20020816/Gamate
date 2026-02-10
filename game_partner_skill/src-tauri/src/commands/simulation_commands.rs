use crate::settings::{AIEmployeeConfig, AppSettings};
use serde::{Deserialize, Serialize};
/// 模拟场景配置管理命令
///
/// 提供保存和加载模拟场景配置的命令
use tauri::AppHandle;

/// 前端传入的模拟场景配置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SimulationConfigPayload {
    pub livestream: LivestreamConfigPayload,
    pub employees: Vec<AIEmployeePayload>,
}

/// 前端传入的直播间配置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LivestreamConfigPayload {
    pub online_users: u32,
    pub room_name: String,
    pub room_description: String,
    pub danmaku_frequency: String,
    pub gift_frequency: String,
    pub allow_mic: bool,
}

/// 前端传入的 AI 员工配置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AIEmployeePayload {
    pub id: String,
    pub personality: String,
    pub interaction_frequency: String,
    pub nickname: String,
}

/// 保存模拟场景配置
#[tauri::command]
pub async fn save_simulation_config(
    _app: AppHandle,
    config: SimulationConfigPayload,
) -> Result<(), String> {
    let mut settings = AppSettings::load().map_err(|e| e.to_string())?;

    // ✅ 检查员工昵称是否重复
    use std::collections::HashSet;
    let mut nickname_set = HashSet::new();
    let mut duplicate_nicknames = Vec::new();

    for emp in &config.employees {
        let nickname = emp.nickname.trim();
        if nickname.is_empty() {
            return Err("员工昵称不能为空".to_string());
        }

        if !nickname_set.insert(nickname.to_string()) {
            duplicate_nicknames.push(nickname.to_string());
        }
    }

    if !duplicate_nicknames.is_empty() {
        return Err(format!(
            "员工昵称重复: {}。每个员工必须有唯一的昵称！",
            duplicate_nicknames.join(", ")
        ));
    }

    // 更新直播间配置
    settings.simulation.livestream.online_users = config.livestream.online_users;
    settings.simulation.livestream.room_name = config.livestream.room_name;
    settings.simulation.livestream.room_description = config.livestream.room_description;
    settings.simulation.livestream.danmaku_frequency = config.livestream.danmaku_frequency;
    settings.simulation.livestream.gift_frequency = config.livestream.gift_frequency;
    settings.simulation.livestream.allow_mic = config.livestream.allow_mic;

    // 更新 AI 员工列表
    settings.simulation.employees = config
        .employees
        .into_iter()
        .map(|emp| AIEmployeeConfig {
            id: emp.id,
            personality: emp.personality,
            interaction_frequency: emp.interaction_frequency,
            nickname: emp.nickname,
        })
        .collect();

    settings.save().map_err(|e| e.to_string())?;

    Ok(())
}

/// 加载模拟场景配置
#[tauri::command]
pub async fn load_simulation_config(_app: AppHandle) -> Result<SimulationConfigPayload, String> {
    let settings = AppSettings::load().map_err(|e| e.to_string())?;

    let config = SimulationConfigPayload {
        livestream: LivestreamConfigPayload {
            online_users: settings.simulation.livestream.online_users,
            room_name: settings.simulation.livestream.room_name,
            room_description: settings.simulation.livestream.room_description,
            danmaku_frequency: settings.simulation.livestream.danmaku_frequency,
            gift_frequency: settings.simulation.livestream.gift_frequency,
            allow_mic: settings.simulation.livestream.allow_mic,
        },
        employees: settings
            .simulation
            .employees
            .into_iter()
            .map(|emp| AIEmployeePayload {
                id: emp.id,
                personality: emp.personality,
                interaction_frequency: emp.interaction_frequency,
                nickname: emp.nickname,
            })
            .collect(),
    };

    Ok(config)
}
