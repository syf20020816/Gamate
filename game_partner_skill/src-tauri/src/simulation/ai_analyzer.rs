/// AI 分析服务
/// 
/// 接收主播语音 + 双截图 + 员工对话历史，返回智能化的弹幕回复

use serde::{Deserialize, Serialize};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

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
    pub role: String,  // "user" (主播) 或 "assistant" (员工)
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
    api_endpoint: String,
    api_key: String,
    model: String,
}

impl AIAnalyzer {
    pub fn new(api_endpoint: String, api_key: String, model: String) -> Self {
        Self {
            api_endpoint,
            api_key,
            model,
        }
    }

    /// 分析主播语音和游戏状态，生成员工互动决策
    pub async fn analyze(
        &self,
        request: AIAnalysisRequest,
    ) -> Result<AIAnalysisResponse, String> {
        println!("🤖 开始 AI 分析...");
        println!("  主播说话: {}", request.streamer_speech);
        println!("  员工数量: {}", request.employees.len());

        // 构建提示词
        let prompt = self.build_prompt(&request);
        
        // 构建多模态消息
        let messages = vec![
            serde_json::json!({
                "role": "system",
                "content": "你是一个直播间互动分析专家。根据主播的语音和游戏画面变化，为每个AI员工生成自然、有趣、符合其性格的弹幕回复。你必须严格按照JSON格式返回，不要包含任何其他文字。"
            }),
            serde_json::json!({
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": prompt
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": format!("data:image/png;base64,{}", request.screenshot_before)
                        }
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": format!("data:image/png;base64,{}", request.screenshot_after)
                        }
                    }
                ]
            }),
        ];

        // 调用 LLM API
        let client = reqwest::Client::new();
        let response = client
            .post(&self.api_endpoint)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&serde_json::json!({
                "model": self.model,
                "messages": messages,
                "temperature": 0.8,
                "max_tokens": 2000,
                "response_format": { "type": "json_object" }
            }))
            .send()
            .await
            .map_err(|e| format!("API 请求失败: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("API 返回错误 {}: {}", status, error_text));
        }

        let response_json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("解析响应失败: {}", e))?;

        // 提取 AI 返回的内容
        let content = response_json["choices"][0]["message"]["content"]
            .as_str()
            .ok_or("无法获取 AI 响应内容")?;

        println!("✅ AI 返回: {}", content);

        // 解析 JSON
        let ai_response: AIAnalysisResponse = serde_json::from_str(content)
            .map_err(|e| format!("解析 AI 响应 JSON 失败: {}", e))?;

        println!("✅ AI 分析完成，生成 {} 个员工行为", ai_response.actions.len());

        Ok(ai_response)
    }

    /// 构建提示词
    fn build_prompt(&self, request: &AIAnalysisRequest) -> String {
        let mut prompt = format!(
            "# 直播间互动分析任务\n\n\
            ## 主播语音识别结果\n\
            \"{}\"\n\n\
            ## 游戏画面变化\n\
            - 图片1：主播开始说话时的游戏状态\n\
            - 图片2：主播结束说话时的游戏状态\n\
            请分析游戏画面中发生了什么变化（如角色移动、战斗、得分等）\n\n\
            ## AI 员工信息\n",
            request.streamer_speech
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
                    let role_label = if msg.role == "user" { "主播" } else { &employee.nickname };
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
            请直接返回 JSON，不要包含任何其他说明文字。"
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
            employees: vec![
                EmployeeContext {
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
                },
            ],
        };

        let prompt = analyzer.build_prompt(&request);
        assert!(prompt.contains("直播间互动分析任务"));
        assert!(prompt.contains("小明"));
        assert!(prompt.contains("损友男"));
    }
}
