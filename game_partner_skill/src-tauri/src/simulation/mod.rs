/// 直播间模拟系统
/// 
/// 负责模拟直播间场景,包括 AI 员工发送弹幕、送礼物等

pub mod engine;
pub mod events;
pub mod memory;

pub use engine::SimulationEngine;
pub use events::{SimulationEvent, EventType};
pub use memory::MemoryManager;
