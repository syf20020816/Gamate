use crate::settings::AppSettings;

/// 获取应用设置
#[tauri::command]
pub async fn get_app_settings() -> Result<AppSettings, String> {
    AppSettings::load().map_err(|e| format!("加载设置失败: {}", e))
}

/// 保存应用设置
#[tauri::command]
pub async fn save_app_settings(mut settings: AppSettings) -> Result<(), String> {
    // 🔥 保护模拟场景配置：从现有配置中加载并合并
    // 这样可以避免在设置页面保存其他配置时，覆盖掉模拟场景中的 AI 员工配置
    if let Ok(existing_settings) = AppSettings::load() {
        // 如果新配置中的 simulation.employees 为空，则保留现有的员工配置
        if settings.simulation.employees.is_empty()
            && !existing_settings.simulation.employees.is_empty()
        {
            log::info!(
                "🔒 保护模拟场景配置：保留 {} 个 AI 员工",
                existing_settings.simulation.employees.len()
            );
            settings.simulation.employees = existing_settings.simulation.employees;
        }

        // 同样保护直播间配置（如果前端没有发送完整的直播间配置）
        if settings.simulation.livestream.room_name.is_empty()
            && !existing_settings.simulation.livestream.room_name.is_empty()
        {
            log::info!("🔒 保护直播间配置");
            settings.simulation.livestream = existing_settings.simulation.livestream;
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
