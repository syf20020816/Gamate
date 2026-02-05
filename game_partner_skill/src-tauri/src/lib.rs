mod crawler;
mod commands;
mod config;
mod screenshot;
mod embeddings;
mod settings;
mod rag;
mod llm;
mod personality;
mod tts;
mod audio;
mod aliyun_voice_service;
mod tray;
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

    // 初始化音频状态
    let audio_state = audio_commands::AudioState::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(game_config) // 将配置注入到应用状态
        .manage(screenshot_state) // 注入截图状态
        .manage(audio_state) // 注入音频状态
        .setup(|app| {
            // 创建系统托盘
            tray::create_tray(app.handle())?;
            Ok(())
        })
        .on_window_event(|window, event| {
            // 拦截窗口关闭事件,改为隐藏到托盘
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
        })
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
            capture_screenshot,
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
            // AI 助手命令
            start_ai_assistant,
            stop_ai_assistant,
            get_ai_assistant_state,
            // TTS 命令
            speak_text,
            stop_speaking,
            set_tts_rate,
            set_tts_volume,
            get_tts_voices,
            set_tts_voice,
            apply_personality_voice,
            // 音频命令
            start_continuous_listening,
            stop_continuous_listening,
            get_listener_state,
            test_microphone,
            start_microphone_test,
            stop_microphone_test,
            // 阿里云语音服务命令
            aliyun_voice_service::aliyun_get_token,
            aliyun_voice_service::aliyun_get_cached_token,
            aliyun_voice_service::aliyun_test_connection,
            aliyun_voice_service::aliyun_one_sentence_recognize,
            aliyun_voice_service::aliyun_tts_synthesize,
            // HUD 浮窗命令
            open_hud_window,
            close_hud_window,
            toggle_hud_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
