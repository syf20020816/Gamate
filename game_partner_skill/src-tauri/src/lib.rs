mod crawler;
mod commands;
mod config;
mod screenshot;
mod embeddings;
mod settings;
mod rag;
pub mod vector_db;

use commands::*;
use config::Config;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 初始化日志
    env_logger::init();

    // 获取配置目录路径（可执行文件同级的 config 目录）
    let config_dir = settings::AppSettings::config_dir()
        .expect("无法获取配置目录");
    
    log::info!("📂 配置目录: {:?}", config_dir);

    // 加载游戏配置文件 (config/games.toml)
    let games_config_path = config_dir.join("games.toml");
    let game_config = Config::from_toml_file(&games_config_path)
        .expect("无法加载游戏配置文件");
    
    log::info!("✅ 成功加载 {} 个游戏配置", game_config.games.len());

    // 加载应用配置文件 (config/config.toml)
    let app_settings = settings::AppSettings::load()
        .expect("无法加载应用配置");
    
    log::info!("✅ 成功加载应用配置");
    log::info!("   语言: {}", app_settings.general.language);
    log::info!("   技能库路径: {}", app_settings.skill_library.storage_base_path);

    // 初始化截图状态
    let screenshot_state = ScreenshotState::default();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(game_config) // 将配置注入到应用状态
        .manage(screenshot_state) // 注入截图状态
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
            // 窗口捕获命令
            list_windows_command,
            capture_window_command,
            // 向量数据库命令
            import_wiki_to_vector_db,
            search_wiki,
            get_vector_db_stats,
            check_game_vector_db,
            list_imported_games,
            get_latest_wiki_jsonl,
            auto_import_latest_wiki,
            // 设置命令
            get_app_settings,
            save_app_settings,
            reset_app_settings,
            // 向量数据库测试命令
            test_vector_db_connection,
            // AI 命令
            generate_ai_response,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
