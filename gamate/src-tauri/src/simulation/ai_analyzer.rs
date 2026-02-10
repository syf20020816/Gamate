use crate::llm::OpenAIClient;
use crate::settings::ModelConfig;
use anyhow::Result;
use base64::{engine::general_purpose, Engine as _};
/// AI 分析服务
///
/// 接收主播语音 + 双截图 + 员工对话历史，返回智能化的弹幕回复
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// AI 分析请求
#[derive(Debug, Clone, Serialize)]
pub struct AIAnalysisRequest {
    /// 主播说的话（语音识别结果）
    pub streamer_speech: String,

    /// 开始说话时的截图（Base64）
    pub screenshot_before: String,

    /// 结束说话时的截图（Base64）
    pub screenshot_after: String,

    /// 员工列表及其对话历史
    pub employees: Vec<EmployeeContext>,
}

/// 员工上下文信息
#[derive(Debug, Clone, Serialize)]
pub struct EmployeeContext {
    /// 员工 ID
    pub id: String,

    /// 员工昵称
    pub nickname: String,

    /// 员工性格
    pub personality: String,

    /// 对话历史（最近 10 条）
    pub conversation_history: Vec<ConversationMessage>,
}

/// 对话消息
#[derive(Debug, Clone, Serialize)]
pub struct ConversationMessage {
    pub role: String, // "user" (主播) 或 "assistant" (员工)
    pub content: String,
}

/// AI 分析响应
#[derive(Debug, Clone, Deserialize)]
pub struct AIAnalysisResponse {
    pub actions: Vec<EmployeeAction>,
}

/// 员工行为决策
#[derive(Debug, Clone, Deserialize)]
pub struct EmployeeAction {
    /// 员工 ID
    pub employee: String,

    /// 要发送的弹幕内容
    pub content: String,

    /// 是否发送礼物
    pub gift: bool,

    /// 礼物名称（如果 gift = true）
    #[serde(default)]
    pub gift_name: Option<String>,

    /// 礼物数量（如果 gift = true）
    #[serde(default)]
    pub gift_count: Option<u32>,
}

/// AI 分析器
#[derive(Clone)]
pub struct AIAnalyzer {
    client: Arc<OpenAIClient>,
    model: String,
}

impl AIAnalyzer {
    pub fn new(api_endpoint: String, api_key: String, model: String) -> Self {
        // 构建 ModelConfig
        let config = ModelConfig {
            provider: "openai".to_string(),
            api_base: api_endpoint,
            api_key: Some(api_key),
            model_name: model.clone(),
            enabled: true,
            temperature: 0.8,
            max_tokens: 2000,
        };

        let client = OpenAIClient::new(config).expect("创建 OpenAI 客户端失败");

        Self {
            client: Arc::new(client),
            model,
        }
    }

    /// 分析主播语音和游戏状态，生成员工互动决策
    pub async fn analyze(&self, request: AIAnalysisRequest) -> Result<AIAnalysisResponse, String> {
        // 清理和验证 base64 图片，过滤掉空截图
        let mut images = Vec::new();

        // 处理第一张截图
        if !request.screenshot_before.is_empty() {
            if let Ok(clean_img) = Self::sanitize_base64_image(&request.screenshot_before) {
                images.push(clean_img);
            }
        }

        // 处理第二张截图
        if !request.screenshot_after.is_empty() {
            if let Ok(clean_img) = Self::sanitize_base64_image(&request.screenshot_after) {
                images.push(clean_img);
            }
        }

        // 构建提示词
        let user_prompt = self.build_prompt(&request, images.len());
        let system_prompt = "你是一个直播间互动分析专家。根据主播的语音和游戏画面变化，为每个AI员工生成自然、有趣、符合其性格的弹幕回复。\n\n你必须严格按照以下JSON格式返回，不要包含任何其他文字：\n{\n  \"actions\": [\n    {\n      \"employee\": \"员工ID\",\n      \"content\": \"弹幕内容\",\n      \"gift\": false\n    }\n  ]\n}";

        // 调用 OpenAI Multi-Vision API
        let ai_response = self
            .client
            .chat_with_multi_vision(system_prompt, &user_prompt, &images)
            .await
            .map_err(|e| format!("AI API 调用失败: {}", e))?;

        // 解析 JSON 响应
        let response: AIAnalysisResponse = serde_json::from_str(&ai_response)
            .map_err(|e| format!("解析 AI 响应 JSON 失败: {}\n原始响应: {}", e, ai_response))?;

        Ok(response)
    }

    /// 净化 base64 图片字符串
    ///
    /// 功能:
    /// 1. 去除 data:image/...;base64, 前缀 (如果有)
    /// 2. 移除换行符和空白字符
    /// 3. 校验 base64 格式是否有效
    /// 4. 确保解码后的数据不为空
    fn sanitize_base64_image(s: &str) -> Result<String, String> {
        let mut cleaned = s.trim().to_string();

        // 0. 检查原始字符串是否为空
        if cleaned.is_empty() {
            return Err("base64 字符串为空".to_string());
        }

        // 1. 去除 data URL 前缀
        if let Some(comma_idx) = cleaned.find(',') {
            let prefix = &cleaned[..comma_idx];
            if prefix.starts_with("data:") && prefix.contains("base64") {
                cleaned = cleaned[comma_idx + 1..].to_string();
            }
        }

        // 2. 移除所有换行符和空白字符
        cleaned.retain(|c| !c.is_whitespace());

        // 3. 校验 base64 格式
        match general_purpose::STANDARD.decode(&cleaned) {
            Ok(decoded) => {
                // 4. 检查解码后的数据是否为空
                if decoded.is_empty() {
                    return Err("base64 解码后数据为空".to_string());
                }
                Ok(cleaned)
            }
            Err(e) => {
                Err(format!("无效的 base64 图片格式: {}", e))
            }
        }
    }

    /// 构建提示词
    fn build_prompt(&self, request: &AIAnalysisRequest, screenshot_count: usize) -> String {
        let screenshot_info = match screenshot_count {
            0 => "（没有游戏截图，仅根据语音内容分析）",
            1 => "- 图片：主播说话时的游戏状态\n请分析游戏画面中的内容",
            2 => "- 图片1：主播开始说话时的游戏状态\n- 图片2：主播结束说话时的游戏状态\n请分析游戏画面中发生了什么变化（如角色移动、战斗、得分等）",
            _ => "- 多张游戏截图\n请分析游戏画面变化",
        };

        let mut prompt = format!(
            "# 直播间互动分析任务\n\n\
            ## 主播语音识别结果\n\
            \"{}\"\n\n\
            ## 游戏画面变化\n\
            {}\n\n\
            ## AI 员工信息\n",
            request.streamer_speech, screenshot_info
        );

        // 添加每个员工的信息
        for (i, employee) in request.employees.iter().enumerate() {
            prompt.push_str(&format!(
                "### 员工 {} - {} (性格: {})\n",
                i + 1,
                employee.nickname,
                self.get_personality_description(&employee.personality)
            ));

            // 添加对话历史
            if !employee.conversation_history.is_empty() {
                prompt.push_str("**最近对话历史:**\n");
                for msg in employee.conversation_history.iter().rev().take(5).rev() {
                    let role_label = if msg.role == "user" {
                        "主播"
                    } else {
                        &employee.nickname
                    };
                    prompt.push_str(&format!("- {}: {}\n", role_label, msg.content));
                }
            } else {
                prompt.push_str("*（暂无对话历史）*\n");
            }
            prompt.push('\n');
        }

        // 添加任务要求
        prompt.push_str(
            "## 任务要求\n\
            1. **分析主播的话和游戏画面变化**，理解当前的游戏进展和主播情绪\n\
            2. **为每个AI员工决定是否发弹幕**（不是所有员工都要回复，自然一点）\n\
            3. **生成符合员工性格的弹幕内容**（参考对话历史，保持连贯性）\n\
            4. **判断是否送礼物**（精彩操作、胜利、里程碑时刻可以送礼物）\n\n\
            ## 输出格式（严格 JSON）\n\
            ```json\n\
            {\n  \
              \"actions\": [\n    \
                {\n      \
                  \"employee\": \"员工ID\",\n      \
                  \"content\": \"弹幕内容（20字以内，自然口语化）\",\n      \
                  \"gift\": false,\n      \
                  \"gift_name\": \"🚀火箭\",\n      \
                  \"gift_count\": 1\n    \
                }\n  \
              ]\n\
            }\n\
            ```\n\n\
            **注意事项:**\n\
            - 如果主播说的话不需要回复（如自言自语、咕哝），可以返回空数组 `[]`\n\
            - 弹幕要简短、有趣、符合直播间氛围\n\
            - 礼物名称可选: 🚀火箭, 🌹鲜花, 666, 💎钻石\n\
            - 不要所有员工都回复，选择1-3个最相关的员工即可\n\
            - 参考员工的对话历史，避免重复相似的内容\n\n\
            请直接返回 JSON，不要包含任何其他说明文字。",
        );

        prompt
    }

    /// 获取性格描述
    fn get_personality_description(&self, personality: &str) -> &'static str {
        match personality {
            "sunnyou_male" => "损友男（幽默调侃、兄弟义气）",
            "funny_female" => "搞笑女（活泼开朗、爱开玩笑）",
            "kobe" => "科比风格（励志、专注、冠军心态）",
            "sweet_girl" => "甜妹（温柔可爱、鼓励支持）",
            "trump" => "特朗普风格（夸张、自信、口号式）",
            _ => "默认性格",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_prompt_building() {
        let analyzer = AIAnalyzer::new(
            "https://api.example.com/v1/chat/completions".to_string(),
            "test-key".to_string(),
            "gpt-4o".to_string(),
        );

        let request = AIAnalysisRequest {
            streamer_speech: "哇，这波操作可以啊！".to_string(),
            screenshot_before: "base64_image_1".to_string(),
            screenshot_after: "base64_image_2".to_string(),
            employees: vec![EmployeeContext {
                id: "emp1".to_string(),
                nickname: "小明".to_string(),
                personality: "sunnyou_male".to_string(),
                conversation_history: vec![
                    ConversationMessage {
                        role: "user".to_string(),
                        content: "开始游戏了".to_string(),
                    },
                    ConversationMessage {
                        role: "assistant".to_string(),
                        content: "冲冲冲！".to_string(),
                    },
                ],
            }],
        };

        let prompt = analyzer.build_prompt(&request, 0);
        assert!(prompt.contains("直播间互动分析任务"));
        assert!(prompt.contains("小明"));
        assert!(prompt.contains("损友男"));
    }
}
