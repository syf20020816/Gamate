mod crawler;
mod commands;
mod config;
mod screenshot;

use commands::*;
use config::Config;
use screenshot::AreaSelectorState;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 初始化日志
    env_logger::init();

    // 加载配置文件
    let config_path = std::env::current_dir()
        .unwrap()
        .parent()
        .unwrap()
        .join("config")
        .join("games.toml");
    
    let game_config = Config::from_toml_file(&config_path)
        .expect("无法加载游戏配置文件");
    
    log::info!("成功加载 {} 个游戏配置", game_config.games.len());

    // 初始化截图状态
    let screenshot_state = ScreenshotState::default();
    let area_selector_state = AreaSelectorState::default();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(game_config) // 将配置注入到应用状态
        .manage(screenshot_state) // 注入截图状态
        .manage(area_selector_state) // 注入区域选择状态
        .invoke_handler(tauri::generate_handler![
            greet,
            download_wiki,
            update_skill_library,
            open_folder,
            delete_skill_library,
            validate_skill_library,
            get_folder_size,
            get_games_config,
            // 截图命令
            list_displays,
            capture_fullscreen,
            capture_area,
            refresh_displays,
            show_area_selector_window,
            set_selected_area,
            cancel_area_selection,
            // 窗口捕获命令
            list_windows_command,
            capture_window_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
