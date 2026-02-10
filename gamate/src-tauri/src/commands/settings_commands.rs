use crate::settings::AppSettings;

/// 获取应用设置
#[tauri::command]
pub async fn get_app_settings() -> Result<AppSettings, String> {
    AppSettings::load().map_err(|e| format!("加载设置失败: {}", e))
}

/// 保存应用设置
#[tauri::command]
pub async fn save_app_settings(mut settings: AppSettings) -> Result<(), String> {
    // 保护模拟场景配置：从现有配置中加载并合并
    // 这样可以避免在设置页面保存其他配置时，覆盖掉模拟场景中的 AI 员工配置和直播间配置
    if let Ok(existing_settings) = AppSettings::load() {
        // 检测是否为默认配置（前端未发送 simulation 字段时，Serde 会用 Default）
        let is_default_simulation = 
            settings.simulation.livestream.room_name == "游戏陪玩直播间"
            && settings.simulation.livestream.online_users == 1000
            && settings.simulation.employees.is_empty();

        // 如果是默认配置，则完整保留现有的模拟场景配置
        if is_default_simulation {
            settings.simulation = existing_settings.simulation;
        } else {
            // 否则只保护员工配置（允许更新直播间配置）
            if settings.simulation.employees.is_empty()
                && !existing_settings.simulation.employees.is_empty()
            {
                settings.simulation.employees = existing_settings.simulation.employees;
            }
        }
    }

    settings.save().map_err(|e| format!("保存设置失败: {}", e))
}

/// 重置为默认设置
#[tauri::command]
pub async fn reset_app_settings() -> Result<AppSettings, String> {
    let default_settings = AppSettings::default();
    default_settings
        .save()
        .map_err(|e| format!("重置设置失败: {}", e))?;
    Ok(default_settings)
}
