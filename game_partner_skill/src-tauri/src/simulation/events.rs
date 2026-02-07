/// 直播间事件定义

use serde::{Deserialize, Serialize};

/// 事件类型
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum EventType {
    /// 弹幕消息
    Danmaku {
        employee_id: String,
        nickname: String,
        message: String,
        personality: String,
    },
    /// 礼物
    Gift {
        employee_id: String,
        nickname: String,
        gift_name: String,
        count: u32,
    },
    /// 打招呼
    Greeting {
        employee_id: String,
        nickname: String,
        message: String,
    },
}

/// 模拟事件
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationEvent {
    pub event_type: EventType,
    pub timestamp: u64,
}

impl SimulationEvent {
    pub fn new(event_type: EventType) -> Self {
        Self {
            event_type,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        }
    }
}

/// 频率级别转换为时间间隔 (秒)
pub fn frequency_to_interval(frequency: &str) -> (u64, u64) {
    match frequency {
        "high" => (4, 8),     // 高频: 4-8秒
        "medium" => (10, 20), // 中频: 10-20秒
        "low" => (25, 60),    // 低频: 25-60秒
        _ => (10, 20),        // 默认中频
    }
}

/// 礼物频率转换为礼物数量和连刷次数
pub fn gift_frequency_to_params(frequency: &str) -> (u32, u32, u32, u32) {
    // (单次最小数量, 单次最大数量, 最小连刷次数, 最大连刷次数)
    match frequency {
        "high" => (10, 20, 3, 5),  // 高频: 10-20个, 连刷3-5次
        "medium" => (2, 5, 1, 3),  // 中频: 2-5个, 连刷1-3次
        "low" => (1, 1, 1, 1),     // 低频: 1个, 不连刷
        _ => (2, 5, 1, 3),         // 默认中频
    }
}
