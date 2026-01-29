use crate::settings::AppSettings;

/// 获取应用设置
#[tauri::command]
pub async fn get_app_settings() -> Result<AppSettings, String> {
    AppSettings::load().map_err(|e| format!("加载设置失败: {}", e))
}

/// 保存应用设置
#[tauri::command]
pub async fn save_app_settings(settings: AppSettings) -> Result<(), String> {
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
