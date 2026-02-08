pub mod wiki_commands;
pub mod config_commands;
pub mod screen_commands;
pub mod vector_commands;
pub mod settings_commands;
pub mod vdb_test_commands;
pub mod ai_commands;
pub mod ai_assistant_commands;
pub mod tts_commands;
pub mod audio_commands;
pub mod hud_commands;
pub mod skill_library_commands;
pub mod simulation_commands;
pub mod simulation_engine_commands; // 新增模拟引擎命令
pub mod smart_capture_commands;    // 新增智能截图命令
pub mod ai_analysis_commands;      // 新增 AI 分析命令

pub use wiki_commands::*;
pub use config_commands::*;
pub use screen_commands::*;
pub use vector_commands::*;
pub use settings_commands::*;
pub use vdb_test_commands::*;
pub use ai_commands::*;
pub use ai_assistant_commands::*;
pub use tts_commands::*;
pub use audio_commands::*;
pub use hud_commands::*;
pub use skill_library_commands::*;
pub use simulation_commands::*;
pub use simulation_engine_commands::*; // 导出模拟引擎命令
pub use smart_capture_commands::*;
pub use ai_analysis_commands::*;
pub use smart_capture_commands::*;     // 导出智能截图命令
