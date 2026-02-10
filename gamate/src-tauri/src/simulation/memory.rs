/// AI 员工记忆管理
///
/// 为每个 AI 员工维护独立的对话历史 (最多30条)
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

/// 对话记录
#[derive(Debug, Clone)]
pub struct Message {
    pub role: String, // "user" 或 "assistant"
    pub content: String,
    pub timestamp: u64,
}

/// 记忆管理器
pub struct MemoryManager {
    /// 每个员工的对话历史: employee_id -> Vec<Message>
    memories: Arc<Mutex<HashMap<String, Vec<Message>>>>,
    max_messages: usize, // 最多保存的消息数量
}

impl MemoryManager {
    pub fn new() -> Self {
        Self {
            memories: Arc::new(Mutex::new(HashMap::new())),
            max_messages: 30,
        }
    }

    /// 添加消息到员工记忆
    pub fn add_message(&self, employee_id: &str, role: &str, content: &str) {
        let mut memories = self.memories.lock().unwrap();
        let history = memories
            .entry(employee_id.to_string())
            .or_insert_with(Vec::new);

        let message = Message {
            role: role.to_string(),
            content: content.to_string(),
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        };

        history.push(message);

        // 保持最多 max_messages 条记录
        if history.len() > self.max_messages {
            history.drain(0..history.len() - self.max_messages);
        }
    }

    /// 获取员工的对话历史
    pub fn get_history(&self, employee_id: &str) -> Vec<Message> {
        let memories = self.memories.lock().unwrap();
        memories.get(employee_id).cloned().unwrap_or_default()
    }

    /// 🔥 获取对话历史（用于 AI 分析）
    pub fn get_conversation_history(&self, employee_id: &str) -> Vec<Message> {
        self.get_history(employee_id)
    }

    /// 构建 LLM Prompt (包含历史对话)
    pub fn build_context(&self, employee_id: &str) -> String {
        let history = self.get_history(employee_id);

        if history.is_empty() {
            return String::new();
        }

        let mut context = String::from("对话历史:\n");
        for msg in history.iter().take(10) {
            // 只取最近10条
            let prefix = if msg.role == "user" { "主播" } else { "我" };
            context.push_str(&format!("{}: {}\n", prefix, msg.content));
        }

        context
    }

    /// 清空所有记忆
    pub fn clear_all(&self) {
        let mut memories = self.memories.lock().unwrap();
        memories.clear();
    }

    /// 清空指定员工记忆
    pub fn clear_employee(&self, employee_id: &str) {
        let mut memories = self.memories.lock().unwrap();
        memories.remove(employee_id);
    }
}

impl Default for MemoryManager {
    fn default() -> Self {
        Self::new()
    }
}
