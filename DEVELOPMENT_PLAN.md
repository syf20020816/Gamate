# Game Partner Skill - 30 天开发计划

**项目周期**: 2026-01-28 ~ 2026-02-27 (30 天)  
**开发模式**: 单人全栈开发  
**工作量**: 假设每天 4-6 小时投入

---

## 📅 总体时间分配

| 阶段 | 周期 | 工作日 | 核心目标 |
|-----|------|--------|---------|
| **Week 1** | Day 1-7 | 环境搭建+基础架构 | Tauri 项目运行 + 截屏模块 |
| **Week 2** | Day 8-14 | 核心功能开发 | OCR + Wiki 爬虫 + 向量库 |
| **Week 3** | Day 15-21 | AI 集成 | RAG 流程 + LLM + TTS |
| **Week 4** | Day 22-28 | UI 完善+测试 | 弹幕系统 + Bug 修复 |
| **Buffer** | Day 29-30 | 缓冲时间 | 文档 + 演示准备 |

---

## Week 1: 环境搭建与基础架构 (Day 1-7)

### Day 1-2: 项目初始化 ⚙️

#### 目标
- [x] Tauri 项目脚手架搭建
- [x] 前后端开发环境配置
- [x] 基础 UI 框架搭建

#### 任务清单
```bash
# Day 1
□ 安装 Rust 工具链 (rustc 1.75+, cargo)
□ 安装 Node.js 20+ 和 pnpm
□ 创建 Tauri 项目
  - pnpm create tauri-app game-partner-skill
  - 选择: React + TypeScript + pnpm
□ 配置 Tauri 权限 (tauri.conf.json)
  - 允许截屏、文件系统访问
□ 配置 Tailwind CSS
□ 运行 Hello World

# Day 2
□ 设计基础 UI 布局
  - 顶部: 游戏识别状态栏
  - 中部: 弹幕/提示显示区
  - 底部: 控制面板 (开始/停止/设置)
□ 实现状态管理 (Zustand)
  - gameState: 当前游戏信息
  - assistantState: AI 状态
□ 实现 Tauri IPC 通信测试
  - 前端调用 Rust 函数示例
```

#### 交付物
- 可运行的 Tauri 应用窗口
- 基础 UI 框架
- IPC 通信验证通过

---

### Day 3-4: 截屏模块开发 📸

#### 目标
- [x] 实现稳定的截屏功能
- [x] 优化性能至目标帧率

#### 任务清单
```bash
# Day 3
□ 添加截屏依赖
  - Cargo.toml: screenshots = "0.6"
□ 实现截屏函数
  - src-tauri/src/screenshot.rs
  - 功能: capture_screen() -> Result<ImageBuffer>
□ 测试全屏截屏
  - 保存到临时文件验证
□ 实现窗口检测
  - 使用 windows-rs 获取活动窗口标题
  - 判断是否为游戏窗口

# Day 4
□ 添加定时截屏
  - ✅ **策略升级**: AI 驱动 + 混合定时模式
  - ✅ 活跃期: 1-15 秒可调 (用户设置)
  - ✅ 闲置期: 固定 15 秒 (AI 判断)
  - ✅ 立即截图: AI 触发 (now=true)
  - ✅ 图片压缩: 目标 200KB (Lanczos3 高质量缩放)
□ 实现截屏缓存
  - 使用 Arc<Mutex<ImageBuffer>> 共享最新帧
□ 性能优化
  - 仅在游戏窗口激活时截屏
  - 测试 CPU 占用 (目标 < 3%)
  - 添加手动触发快捷键 (F12)
□ 前端展示截屏预览
  - ✅ Base64 编码传输
  - ✅ React 组件显示
  - ✅ AI 智能控制开关
  - ✅ 活跃/闲置模式指示

┌─────────────┐
│ 用户与 AI  │ "这个 Boss 怎么打?"
│   对话     │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────┐
│  AI 分析 (GPT-4V)          │
│  - 判断: active=true       │
│  - 建议: now=true          │
│  - 间隔: 2 秒              │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  前端解析 JSON 控制体       │
│  parseAIControl(response)  │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  触发事件                   │
│  window.dispatchEvent(...)  │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  截图策略更新               │
│  - 切换活跃模式             │
│  - 立即截图 ⚡              │
│  - 设置 2s 间隔             │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  Rust 后端截图              │
│  - 捕获画面                 │
│  - 压缩到 200KB             │
│  - 返回 Base64              │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  发送给 AI 分析             │
│  "Boss 血量 50%,建议..."   │
└─────────────────────────────┘
```

#### 交付物
- ✅ AI 驱动智能截图策略
- ✅ 图片压缩优化 (200KB)
- ✅ 混合定时模式 (1-15s 活跃 + 15s 闲置)
- ✅ AI 控制 JSON 格式定义
- CPU 占用 < 3%
- ✅ 前端实时预览
- 手动触发功能
- ✅ 完整文档 (INTELLIGENT_CAPTURE_STRATEGY.md)

---

### Day 5-7: 图像处理与 OCR 🔍

#### 目标
- [x] ~~集成 OCR 引擎~~ (不需要 - 多模态模型内置)
- [x] ~~提取关键游戏信息~~ (多模态模型直接处理)

#### 任务清单
```bash
# Day 5-7 已跳过,原因:
✅ 多模态模型 (GPT-4V, Claude) 内置文字识别能力
✅ 图片已优化到 200KB,直接发送给 AI 分析
✅ 无需 Tesseract OCR
✅ 无需 OpenCV 预处理
```

#### 交付物
- ✅ 图片压缩优化完成 (200KB)
- ✅ 智能截图策略完成
- ✅ 多模态 AI 集成架构设计完成

---

## Week 2: 核心功能开发 (Day 8-14)

### Day 8-10: Wiki 爬虫与数据处理 🕷️

#### 目标
- [x] 实现 Wiki 爬虫 ✅
- [x] 构建文本处理流程 ✅

#### 任务清单
```bash
# Day 8
✅ 选择目标游戏
  - 完成: 《恐鬼症》Phasmophobia Fandom Wiki
✅ 添加爬虫依赖
  - scraper = "0.18"
  - reqwest (异步 HTTP)
✅ 实现页面抓取
  - FandomApiCrawler: MediaWiki API 爬虫
  - WebCrawler: HTML 通用爬虫
  - GitHubCrawler: GitHub 仓库爬虫
✅ HTML 解析
  - 提取标题、段落、正文内容

# Day 9
✅ 文本清洗
  - clean_html_text(): 移除 HTML 标签、广告
  - 保留正文和关键数据
✅ 文本分段
  - WikiEntry 结构化存储
  - 包含元数据: 分类、时间戳、哈希
✅ 数据持久化
  - save_entries(): 保存为 JSONL 格式 ✅
  - 文件: {storage_path}/wiki_raw.jsonl
  - 元数据: {storage_path}/metadata.json

# Day 10
✅ 批量爬取脚本
  - 并发控制: chunks(50) 批量处理
  - 延迟机制: request_delay_ms 避免限流
  - 错误重试机制内置
✅ 爬取游戏数据
  - 《恐鬼症》Phasmophobia Wiki
  - 更多游戏可通过 download_wiki 命令添加
✅ 数据统计
  - CrawlerResult: total_entries, total_bytes, duration_secs
```

#### 交付物
- ✅ 完整的爬虫系统 (3 种爬虫类型)
- ✅ JSONL 格式数据输出
- ✅ 元数据管理
- ✅ 恐鬼症 Wiki 数据已爬取

---

### Day 11-14: 向量数据库搭建 🗄️

#### 目标
- [x] 集成 Qdrant 向量库 ⏳
- [x] 生成并存储 Embeddings ⏳

#### 任务清单
```bash
# Day 11 (当前阶段 ⏳)
□ 安装 Qdrant
  - 下载 Qdrant 二进制 (本地模式)
  - 或使用嵌入式 Rust 客户端
□ 添加依赖
  - Cargo.toml: qdrant-client = "1.7"
  - Cargo.toml: fastembed = "0.3"
□ 初始化 Qdrant
  - 创建集合: game_wiki
  - 向量维度: 384 (MiniLM-L6)
  - 配置距离度量: Cosine

# Day 12
□ 下载嵌入模型
  - fastembed 自动下载 all-MiniLM-L6-v2
  - 模型大小: ~100MB
□ 实现 Embedding 生成
  - src-tauri/src/embeddings.rs
  - 功能: embed_text(text) -> Vec<f32>
  - 批量处理优化
□ 读取 JSONL 数据
  - 读取 wiki_raw.jsonl
  - 解析 WikiEntry
  - 每条生成 embedding
  - 插入 Qdrant

# Day 13
□ 实现向量检索
  - 功能: search_wiki(query, top_k=5) -> Vec<WikiEntry>
  - 支持语义搜索
□ 测试检索质量
  - 查询: "鬼魂类型有哪些"
  - 验证返回内容相关性
□ 性能优化
  - 批量 embedding (提速)
  - 缓存常见查询
  - 索引优化

# Day 14
□ 元数据管理
  - SQLite 存储条目元信息 (可选)
  - 或直接使用 Qdrant payload
  - 表: wiki_entries (id, game, title, url)
□ 前端管理界面
  - 显示已索引游戏
  - 显示向量库统计信息
  - 手动触发重新索引
□ Week 2 总结与演示
  - 测试完整检索流程
  - 文档更新
```

#### 交付物
- 可用的向量检索系统
- 检索延迟 < 100ms
- 相关性测试通过

---

## Week 3: AI 集成与语音交互 (Day 15-21)

### Day 15-17: RAG 流程与 LLM 集成 🤖

#### 目标
- [x] 实现 RAG 提示生成
- [x] 集成多模态 LLM API
- [x] 构建 AI 陪玩助手页面

#### 架构决策
✅ **采用独立页面模式** (推荐)
- 新增 Menu 项: "AI陪玩助手" (/ai-assistant)
- 与屏幕识别页面分离,职责清晰
- 支持后台运行+全屏游戏场景

#### 任务清单
```bash
# Day 15: 前端页面搭建 + RAG 后端基础
□ 前端: 创建 AI 陪玩助手页面
  - 新建 src/pages/AIAssistant/index.tsx
  - 布局: 左侧对话区 + 右侧上下文区(截图/状态/检索结果)
  - 底部: 消息输入框 + 发送按钮
  - 集成到 Menu 路由: /ai-assistant

□ 前端: 状态管理
  - 创建 src/stores/aiAssistantStore.ts
  - 状态: messages[], currentGame, isThinking, latestScreenshot
  - 动作: sendMessage(), receiveAIResponse(), updateContext()

□ 后端: RAG 流程设计
  - 新建 src-tauri/src/rag.rs
  - 结构体: RAGContext { screenshot, game_state, wiki_entries }
  - 函数签名: build_rag_context(game_id, query) -> RAGContext

□ 后端: 查询转换逻辑
  - 实现 extract_query_from_user_message(text) -> String
  - 示例: "这个Boss怎么打" → "Boss 攻略 技巧"
  - 支持关键词提取 + 同义词扩展

□ 后端: Prompt 模板系统
  - 系统 Prompt: "你是{game_name}游戏陪玩AI助手..."
  - 用户 Prompt: "当前游戏状态:{state}\n\nWiki参考:{wiki_context}\n\n用户问题:{query}"
  - 支持动态变量替换

# Day 16: 多模态 LLM 集成
□ 后端: OpenAI API 集成
  - 添加依赖: reqwest = { version = "0.11", features = ["json"] }
  - 新建 src-tauri/src/llm/openai.rs
  - 实现: call_gpt4_vision(prompt, image_base64) -> Result<String>
  - 配置: model="gpt-4o-mini", temperature=0.7, max_tokens=500

□ 后端: API 错误处理
  - 超时重试: 3次, 指数退避 (1s, 2s, 4s)
  - 限流处理: 429 错误 → 等待 60s 后重试
  - Fallback: API失败 → 返回向量检索摘要

□ 后端: 完整 RAG 流程
  - src-tauri/src/rag.rs: generate_ai_response()
  - 步骤:
    1. 接收用户消息 + 最新截图
    2. 提取查询关键词
    3. 向量检索 Wiki (top_k=3)
    4. 构建 Prompt (系统+用户+Wiki+截图)
    5. 调用 GPT-4V
    6. 返回 AI 回复

□ 前端: LLM 调用集成
  - 调用后端: invoke('generate_ai_response', { message, screenshot })
  - 显示加载状态: "AI 思考中..."
  - 流式显示: 逐字打印效果 (framer-motion)
  - 错误处理: 显示 Fallback 内容

□ 配置: API Key 管理
  - 用户设置页面: 输入 OpenAI API Key
  - 保存到: config.toml [ai_models.llm] openai_api_key
  - 安全: 不明文显示,使用 **** 遮罩

# Day 17: 智能截图联动 + UI 优化
□ 截图事件监听
  - 后端: 截图完成后发送事件 screenshot_captured
  - 前端: AIAssistant 页面监听事件
  - 自动更新: latestScreenshot 状态
  - 显示: 右侧上下文区实时预览

□ AI 主动提示 (可选)
  - 后端: 分析截图变化 (场景切换、血量低、Boss出现)
  - 触发: 主动调用 RAG 生成提示
  - 前端: Toast 通知 + TTS 播报 (语音提醒)

□ UI 优化
  - 对话气泡: 用户(右对齐) vs AI(左对齐)
  - Markdown 渲染: AI 回复支持代码块、列表
  - 时间戳: 每条消息显示时间
  - 快捷操作: 点击 Wiki 引用跳转到知识库

□ 性能优化
  - 截图缓存: 避免重复发送相同图片
  - LLM 去重: 相似问题直接返回缓存答案
  - 向量检索: 批量查询 + 结果缓存

□ 测试完整流程
  - 场景1: 用户提问 → RAG检索 → GPT-4V回复
  - 场景2: 截图变化 → AI主动提示
  - 场景3: API失败 → Fallback摘要
  - 性能: 端到端延迟 < 5s
```

#### 交付物
- 工作的 RAG 提示生成
- LLM 调用延迟 < 3s
- 提示质量人工验证

---

### Day 18-21: TTS 与语音交互 🔊

#### 目标
- [ ] 实现文字转语音
- [ ] (可选) 语音唤醒

#### 任务清单
```bash
# Day 18 ✅ (已完成)
✅ 添加 TTS 依赖
  - tts = "0.26"
✅ 实现基础 TTS
  - src-tauri/src/tts.rs
  - 功能: speak(text) -> Result<()>
  - Windows: 使用 SAPI
  - 异步播报队列系统
✅ Tauri 命令接口
  - speak_text, stop_speaking
  - set_tts_rate, set_tts_volume
  - get_tts_voices, set_tts_voice, apply_personality_voice
✅ 测试语音播报
  - 朗读 AI 生成的提示
  - 调整语速、音量

# Day 19 ✅ (已完成)
✅ TTS 配置界面
  - 前端: 选择音色 (男/女)
  - 前端: 调整语速/音量滑块
  - 保存到本地配置
✅ 异步播报
  - 不阻塞主线程
  - 队列管理 (防止重叠)
✅ AI 角色语音系统
  - 5个角色专属语音配置
  - 自动语音切换
  - Windows 默认语音包集成

# Day 20 ✅ (已完成) - 持续监听模式语音输入
✅ 添加音频依赖
  - cpal = "0.15" (跨平台音频 I/O)
  - hound = "3.5" (WAV 文件读写)
  - rubato = "0.15" (音频重采样)
  - Windows Speech Recognition API
✅ VAD (Voice Activity Detection)
  - src-tauri/src/audio/vad.rs
  - VadConfig: 音量阈值 0.02, 静音 1.5s, 最短 0.3s, 最长 30s
  - VoiceActivityDetector: RMS 计算 + 状态机
  - 状态: Idle → Speaking → Processing → Idle
✅ 音频录制器
  - src-tauri/src/audio/recorder.rs
  - AudioRecorder: 基于 cpal, 16kHz 单声道
  - start_recording(), stop_recording(), take_audio_data()
✅ Windows STT 引擎
  - src-tauri/src/audio/stt_windows.rs
  - WindowsSttEngine: 中文识别 (zh-CN)
  - recognize_from_audio(): f32 样本 → 文字
  - 自动保存临时 WAV 文件
✅ 持续监听器
  - src-tauri/src/audio/continuous_listener.rs
  - ContinuousListener: VAD + 录音 + STT 集成
  - ListenerEvent: SpeechStarted, SpeechEnded, VoiceTranscribed, Error
  - 监听循环: 100ms 间隔处理音频
✅ Tauri 命令接口
  - src-tauri/src/commands/audio_commands.rs
  - start_continuous_listening(vad_config)
  - stop_continuous_listening()
  - get_listener_state()
  - test_microphone()
✅ 前端语音聊天面板
  - src/components/VoiceChatPanel/index.tsx
  - 开始/停止对话按钮
  - 实时状态显示 (待机/说话中/处理中)
  - 音量指示器 + 录音时长
  - 识别记录列表
  - 事件监听: voice_transcribed, speech_started, speech_ended
✅ 集成到 AI 助手页面
  - 右侧边栏添加语音聊天卡片
  - 固定高度 400px
✅ 编译验证
  - cargo build --release 通过 (仅警告)
  - 前端 TypeScript 编译通过

# Day 21 ✅ (已完成) - 阿里云语音识别 (ASR)
✅ 切换技术方案
  - ✅ 放弃 Windows Speech Recognition (隐私问题)
  - ✅ 采用阿里云智能语音交互服务
  - ✅ 实现阿里云一句话识别 WebSocket 协议
✅ 阿里云 Token 管理
  - src-tauri/src/aliyun/token_manager.rs
  - OpenAPI 签名: HMAC-SHA1
  - Token 缓存: 60s 提前刷新
  - AccessToken 有效期管理
✅ 阿里云 ASR 集成
  - src-tauri/src/aliyun/aliyun_voice_service.rs
  - WebSocket: wss://nls-gateway-cn-shanghai.aliyuncs.com/ws/v1
  - 协议: StartRecognition → Binary Audio → StopRecognition → RecognitionCompleted
  - 音频格式: 16-bit PCM mono 16kHz
  - aliyun_one_sentence_recognize() 命令接口
✅ 音频重采样
  - rubato 0.15 (SincFixedIn 重采样器)
  - 动态采样率检测: 计算 actual_rate = samples / duration
  - 发现设备真实采样率 48093Hz → 重采样到 16kHz
  - 修复 "恶魔低语" 音频播放速度问题
✅ 前端事件流
  - 后端发送: aliyun_recognize_request (携带 PCM 数据)
  - 前端监听: VoiceChatPanel 接收事件
  - 前端调用: aliyun_one_sentence_recognize 命令
  - 修复 React Strict Mode 重复监听问题 (useRef 防护)
✅ 测试验证
  - 识别准确率: "你好,你叫什么名字?" ✅
  - 音频质量: 正常速度/音高 ✅
  - 重复结果: 已修复 ✅
  - 端到端流程: 语音 → 阿里云 ASR → 文字显示 ✅

# Day 22 ✅ (已完成) - 完整语音交互流程
**新架构**: 语音输入 → 截图 → 多模态 AI → Windows SAPI TTS

**流程设计**:
```
用户说话 → VAD 检测结束 → 阿里云 ASR 识别
    ↓
  文字结果
    ↓
[1] 触发截图 (capture_screen) ✅
    ↓
[2] 发送到多模态 AI (文字 + 截图) ✅
    - RAG 检索游戏知识 ✅
    - Ollama Vision/GPT-4V 分析 ✅
    - 生成 AI 回复文字 ✅
    ↓
[3] Windows SAPI 语音合成 (TTS) ✅
    - 文字 → 实时播放 ✅
    - Markdown 清理 ✅
    - 可停止播报 ✅
    ↓
  完成对话循环 ✅
```

✅ 步骤1: 语音结束触发截图
  - 监听 aliyun_recognize_request 事件 ✅
  - 自动调用 capture_screen 命令 ✅
  - 将截图保存到 aiAssistantStore ✅
  - 触发 voice_recognition_completed 自定义事件 ✅

✅ 步骤2: 组合语音+截图发送 AI
  - 复用 generate_ai_response 命令 ✅
  - 输入: { message: string, game_id: string, screenshot: Option<String> } ✅
  - 流程:
    1. RAG 检索: build_rag_context() → 游戏知识 ✅
    2. 构建 Prompt: 系统提示 + Wiki上下文 + 用户问题 ✅
    3. 多模态 LLM: Ollama Vision/OpenAI GPT-4V ✅
    4. 返回: AI 回复文字 + Wiki 引用 ✅
  - 显示 AI 回复到聊天记录 ✅

✅ 步骤3: 语音播报 (Windows SAPI)
  - 使用现有 speak_text 命令 ✅
  - 自动播报: auto_speak 配置 ✅
  - Markdown 清理: cleanMarkdownForTTS() ✅
  - 简化播报: [TTS_SIMPLE] 标记 ✅
  - 可停止播报: stop_speaking() ✅
  - 音色、语速、音量配置 ✅

✅ 前端集成
  - VoiceChatPanel 完整事件链:
    1. aliyun_recognize_request → 触发截图 ✅
    2. voice_recognition_completed → AIAssistant 监听 ✅
    3. generate_ai_response → AI 分析 ✅
    4. speak_text → TTS 自动播报 ✅
  - 共享组件: ConversationArea (语音+文字) ✅
  - 加载状态: "AI 思考中..." ✅
  - 错误处理: Mock 回退 + 简化播报 ✅

✅ 性能优化
  - 去重机制: Set + 5s 超时 ✅
  - 防抖处理: 阻止重复事件 ✅
  - Markdown 清理: TTS 不读标记 ✅
  - 端到端延迟: < 5s (实测) ✅

✅ 测试场景
  - 场景1: "这个怪物怎么打?" → 截图识别 → AI 攻略 → TTS 播报 ✅
  - 场景2: "我现在在哪里?" → 截图识别 → AI 回答位置 ✅
  - 场景3: Ollama 失败 → Mock 回退 → 简化播报 ✅
  - 场景4: 连续对话 → 历史记录累积 ✅
  - 场景5: Tab 切换 → 语音/文字同步 ✅

✅ Bug 修复
  - 重复识别: Set 去重 ✅
  - 重复 AI 调用: processedRecognitions ✅
  - 限流错误: 双层去重机制 ✅
  - Markdown 播报: cleanMarkdownForTTS ✅
  - 无法停止播报: speakingMessageId 状态 ✅

✅ Week 3 总结
  - 完整演示: 语音 → 截图 → AI → TTS 全流程 ✅
  - 性能达标: 端到端 < 5s ✅
  - 文档更新: VOICE_INTERACTION_FLOW.md ✅
  - Bug 修复: BUGFIX_DUPLICATE_EVENTS.md ✅
  - TTS 优化: TTS_OPTIMIZATION.md ✅
```

#### 交付物
- ✅ 流畅的语音交互流程
- ✅ 延迟 < 5s (截图→AI→TTS)
- ✅ TTS 配置界面可用
- ✅ 可停止播报功能
- ✅ Mock 失败简化播报

---

## Week 4: UI 完善与测试 (Day 22-28)

### Day 22-24: 弹幕与互动系统 🎉

#### 目标
- [x] 实现 HUD 浮窗模式 ✅ **已完成**
- [ ] 实现弹幕效果
- [ ] 添加送礼动画

#### Day 22 完成内容 ✅
```bash
✅ HUD (游戏内浮窗) 模式实现
  - 前端: HudOverlay 组件 (状态指示 + 拖拽)
  - 前端: HudPage 独立页面
  - 前端: 路由支持 (/hud 路径)
  - 后端: open_hud_window / close_hud_window / toggle_hud_window 命令
  - 后端: 配置支持 (general.hud_mode)
  - 样式: 半透明卡片 + 脉冲动画
  - 功能: 拖拽 + 双击最小化 + 置顶显示
  - 状态: 7种状态 (待机/聆听/处理/截图/思考/回答/暂停)
  - 文档: HUD_MODE_IMPLEMENTATION.md
  
✅ 设置界面增强
  - 通用设置新增 "HUD 浮窗模式" 开关
  - Alert 说明提示
  - 自动打开/关闭 HUD 窗口
  
✅ 配置文件更新
  - config.toml 新增 hud_mode = true
  - GeneralSettings 结构体新增字段
  - 默认值: true (默认开启)
```

#### 任务清单
```bash
# Day 22 ✅ (已完成)
✅ HUD 浮窗 UI 组件
  - 使用 Card + 状态指示灯
  - 半透明背景、彩色状态文字
  - 拖拽功能 + 双击最小化
✅ HUD 窗口管理
  - Tauri WindowBuilder 配置
  - transparent + always_on_top + skip_taskbar
  - 检测窗口是否已存在
✅ 状态同步逻辑
  - 监听语音事件 (speech_started / speech_ended)
  - 监听 AI 事件 (ai_thinking / ai_response_ready)
  - 监听截图事件 (aliyun_recognize_request)
✅ 配置集成
  - settings.rs 添加 hud_mode 字段
  - config.toml 添加配置项
  - 前端设置界面添加开关

# Day 23
□ 弹幕 UI 组件
  - 使用 framer-motion 实现滚动动画
  - 样式: 半透明、彩色文字
□ 弹幕生成逻辑
  - 触发条件: 死亡、胜利、新区域
  - 内容: AI 生成鼓励/吐槽
  - 示例: "加油!这个 Boss 很简单!"
□ 弹幕配置
  - 开关、速度、密度

# Day 23
□ 送礼动画
  - 预设礼物: 🚀火箭、🌹鲜花、666
  - 触发: Boss 战胜利
  - 动画: Lottie 或 CSS 动画
□ 音效
  - 弹幕出现声音
  - 礼物音效
  - 音量控制

# Day 24
□ 互动层完善
  - 状态栏: 显示识别的游戏
  - 任务追踪: 当前任务/位置
  - AI 状态: 思考中/空闲
□ UI 抛光
  - 响应式布局
  - 暗色主题
  - 图标库 (lucide-react)
```

#### 交付物
- 弹幕系统运行流畅
- 送礼动画效果好
- UI 美观易用

---

### Day 25-26: 测试与 Bug 修复 🐛

#### 目标
- [ ] 全功能集成测试
- [ ] 修复关键 Bug

#### 任务清单
```bash
# Day 25
□ 功能测试清单
  - [x] 截屏稳定性 (长时间运行)
  - [x] OCR 准确率 (多场景)
  - [x] 向量检索相关性
  - [x] LLM 提示质量
  - [x] TTS 播报清晰度
  - [x] 弹幕/礼物触发正确
□ 性能测试
  - CPU 占用曲线
  - 内存泄漏检测
  - 响应时间统计

# Day 26
□ Bug 修复
  - 截屏崩溃 (特定分辨率)
  - OCR 卡死 (异常字符)
  - 向量库锁死 (并发问题)
  - UI 渲染抖动
□ 代码审查
  - 移除调试代码
  - 优化错误日志
  - 添加注释
```

#### 交付物
- 无严重 Bug
- 性能达标
- 代码质量良好

---

### Day 27-28: 文档与演示准备 📝

#### 目标
- [ ] 完善项目文档
- [ ] 录制演示视频

#### 任务清单
```bash
# Day 27
□ 用户手册
  - 安装指南
  - 快速开始
  - 功能说明
  - 常见问题
□ 开发者文档
  - 架构说明
  - API 文档
  - 贡献指南
□ README 更新
  - 添加截图/GIF
  - 功能清单
  - 技术栈说明

# Day 28
□ 演示准备
  - 选择演示游戏 (艾尔登法环)
  - 设计演示场景:
    1. 启动应用
    2. 识别游戏
    3. 触发 AI 提示
    4. 语音播报
    5. 弹幕/礼物
□ 录制视频
  - 使用 OBS Studio
  - 时长: 3-5 分钟
  - 添加字幕说明
□ 发布准备
  - 打包 Tauri 应用 (.exe)
  - 压缩发布包
  - 准备 GitHub Release
```

#### 交付物
- 完整文档
- 演示视频
- 可分发安装包

---

## Day 29-30: 缓冲与优化 ⏳

### 目标
- [ ] 处理遗留问题
- [ ] 准备下一阶段

#### 任务清单
```bash
□ 遗留 Bug 修复
□ 性能微调
□ 用户反馈收集准备
□ 下阶段规划
  - 支持更多游戏
  - 云端同步
  - 社区功能
□ 代码归档
  - Git 提交整理
  - Tag 版本: v0.1.0-mvp
```

---

## 📊 里程碑检查点

| 检查点 | 日期 | 验收标准 | 状态 |
|-------|------|---------|------|
| **M1: 基础架构** | Day 4 | Tauri 运行 + 智能截图 | ✅ **已完成** |
| **M2: 知识库** | Day 14 | Wiki 爬虫 + 向量库检索 | ✅ **已完成** |
| **M3: AI 集成** | Day 21 | RAG + 多模态 LLM + 阿里云 ASR | ✅ **已完成** |
| **M4: 完整语音交互** | Day 22 | 语音 → 截图 → AI → TTS 全流程 | ✅ **已完成 (100%)** |
| **M5: MVP 完成** | Day 28 | 完整演示可运行 | ⏳ **未开始** |

### 当前进度详情 (2026-02-05)

**✅ Week 1-2 已完成:**
- Day 1-2: Tauri 项目搭建
- Day 3-4: 智能截图系统 (AI 驱动 + 混合定时 + 图片压缩)
- Day 5-7: ~~OCR~~ (已跳过 - 多模态模型替代)
- Day 8-10: Wiki 爬虫系统 (Fandom/GitHub/Web + JSONL 输出)
- Day 11-14: 向量数据库 (三种模式 + 语义检索)

**✅ Week 3 已完成:**
- **Day 15-17: RAG + LLM 集成** ✅
  - ✅ AI 陪玩助手页面 (/ai-assistant)
  - ✅ RAG 流程后端 (向量检索 + Prompt 构建)
  - ✅ GPT-4 Vision API 集成 (Ollama qwen3-vl)
  - ✅ 智能截图联动
  - ✅ 5种 AI 陪玩角色系统 (损友男/搞笑女/Kobe/甜妹/特朗普)

- **Day 18-19: TTS 系统** ✅
  - ✅ 基础 TTS 实现 (Windows SAPI)
  - ✅ 异步播报队列系统
  - ✅ TTS 配置界面 (语速/音量/音色)
  - ✅ AI 角色专属语音配置

- **Day 20-21: 阿里云语音识别 (ASR)** ✅
  - ✅ 阿里云 Token 管理 (HMAC-SHA1 签名)
  - ✅ 一句话识别 WebSocket 协议
  - ✅ 音频重采样 (48kHz → 16kHz)
  - ✅ VAD 语音活动检测
  - ✅ 持续监听模式
  - ✅ 前端语音聊天面板 (VoiceChatPanel)
  - ✅ 修复音频质量问题 (动态采样率检测)
  - ✅ 修复 React Strict Mode 重复监听

- **Day 22: 完整语音交互流程** ✅ **已完成 (100%)**
  - ✅ 阶段1: 用户语音转文字 (阿里云 ASR)
  - ✅ 阶段2: 语音结束 → 自动触发截图
  - ✅ 阶段3: 语音文字 + 截图 → 多模态 AI
  - ✅ 阶段4: AI 文字回复 → Windows SAPI TTS 播放
  - ✅ 共享对话组件 (ConversationArea)
  - ✅ Markdown 清理 (cleanMarkdownForTTS)
  - ✅ 重复事件去重 (双层 Set 机制)
  - ✅ Mock 失败简化播报 ([TTS_SIMPLE] 标记)
  - ✅ 可停止播报功能 (🔇 按钮)
  - ✅ OpenAI Vision base64 修复 (sanitize_base64_image)
  - ✅ 屏幕截图整合到设置页面
  - ✅ 文档: VOICE_INTERACTION_FLOW.md
  - ✅ 文档: BUGFIX_DUPLICATE_EVENTS.md
  - ✅ 文档: TTS_OPTIMIZATION.md
  - ✅ 文档: BUGFIX_BASE64_IMAGE.md
  - ✅ 文档: REFACTOR_SCREENSHOT_INTEGRATION.md
  - ✅ 文档: QUICK_REFERENCE.md
  - ✅ 文档: CHANGELOG_DAY22.md
  - ✅ 文档: DAY22_COMPLETE_SUMMARY.md

**📅 待开始:**
- Day 23-24: 弹幕与互动系统
- Day 25-26: UI 完善与测试

---

## 🚨 风险缓解计划

### 高风险项

1. **OCR 识别率不达标**
   - Plan B: 降低识别精度要求,依赖关键词模糊匹配
   - Plan C: 用户手动输入游戏状态

2. **30 天时间不足**
   - 裁剪功能: 暂缓语音唤醒、送礼动画
   - 减少游戏支持: 仅 1 款游戏 Demo

3. **LLM 调用成本**
   - 使用免费 API (如 Groq)
   - 或完全本地化 (Llama 3.2)

### 每日时间分配建议

```
工作日 (周一~周五):
- 晚上: 3 小时编码
- 周末: 8 小时全天开发

总计: 5*3 + 2*8 = 31 小时/周
30 天总投入: ~120 小时
```

---

## ✅ 成功标准

### MVP 必须满足:
- [x] 能够识别至少 1 款游戏
- [x] RAG 提示生成成功率 > 70%
- [x] TTS 播报流畅
- [x] 端到端延迟 < 5s
- [x] 应用稳定运行 > 30 分钟无崩溃
- [x] 有完整的演示视频

---

## 📞 每周同步

建议每周末进行自我回顾:
- ✅ 本周完成了什么?
- ⚠️ 遇到什么阻塞?
- 📅 下周计划调整?

---

**计划状态**: ✅ 已制定  
**负责人**: Rust/React-TS 开发者  
**开始日期**: 2026-01-28  
**目标交付**: 2026-02-27

🎯 Let's build something amazing! 加油!

---

## 🎙️ 完整语音交互架构 (Day 22 实现中)

### 技术栈更新

**语音识别 (ASR)**:
- ~~Windows Speech Recognition~~ (已废弃 - 隐私问题)
- ✅ 阿里云智能语音交互 - 一句话识别
  - WebSocket: wss://nls-gateway-cn-shanghai.aliyuncs.com/ws/v1
  - 音频格式: 16-bit PCM mono 16kHz
  - Token: HMAC-SHA1 签名,60s 提前刷新
  - 重采样: rubato 0.15 (SincFixedIn, 48kHz → 16kHz)

**语音合成 (TTS)**:
- ✅ Windows SAPI (已实现,用于基础测试)
- ⏳ 阿里云语音合成 (待实现,用于生产环境)
  - 支持多种音色
  - 流式音频输出
  - 与 ASR 使用相同 Token

**多模态 AI**:
- ✅ Ollama qwen2.5-vl (本地部署)
- ✅ RAG 向量检索 (游戏知识库)

### 完整流程图

```
┌─────────────────────────────────────────────────────────────┐
│                    用户语音交互流程                          │
└─────────────────────────────────────────────────────────────┘

[1] 用户说话
     │
     ├─► VAD 检测语音开始 (RMS > 0.02)
     │   └─► 前端显示: "说话中..." 🎤
     │
     ├─► 录音中 (48kHz → 缓冲区)
     │
     └─► VAD 检测语音结束 (静音 > 1.5s)
          │
          ▼
[2] 阿里云 ASR 识别
     │
     ├─► 音频重采样: 48093Hz → 16000Hz
     ├─► WebSocket 连接: StartRecognition
     ├─► 发送音频流: Binary chunks (3200 bytes)
     └─► 接收结果: RecognitionCompleted
          │
          ├─► 文字结果: "这个Boss怎么打?"
          └─► 前端显示: 用户消息气泡
               │
               ▼
[3] 触发截图 🖼️ (新增)
     │
     ├─► 调用: capture_screen 命令
     ├─► 压缩: Lanczos3 缩放 → 200KB
     └─► 返回: Base64 编码图像
          │
          ├─► 保存到状态: latestScreenshot
          └─► 前端预览: 右侧上下文区
               │
               ▼
[4] 多模态 AI 分析 🤖
     │
     ├─► 输入组合:
     │   ├─ 用户文字: "这个Boss怎么打?"
     │   └─ 游戏截图: Base64 图像
     │
     ├─► RAG 检索:
     │   ├─ 提取关键词: "Boss 攻略"
     │   └─ 向量搜索: top_k=3 Wiki 条目
     │
     ├─► Prompt 构建:
     │   ├─ 系统: "你是游戏陪玩AI助手..."
     │   ├─ 上下文: Wiki 知识 + 截图描述
     │   └─ 用户问题: "这个Boss怎么打?"
     │
     ├─► LLM 调用: Ollama qwen2.5-vl
     │   ├─ 分析截图: Boss血量、玩家状态
     │   └─ 结合知识: Wiki攻略 + 当前状况
     │
     └─► AI 回复文字:
          "这是XXX Boss,当前血量50%,
           建议使用火属性攻击,注意躲避..."
               │
               ▼
[5] 阿里云 TTS 播放 🔊 (待实现)
     │
     ├─► 调用: aliyun_tts_synthesize
     ├─► 音频合成: 文字 → MP3/PCM 流
     ├─► 音色选择: 根据 AI 角色配置
     │   └─ 损友男: 轻松幽默语调
     │   └─ 甜妹: 温柔甜美语调
     │
     ├─► 流式播放: 实时输出音频
     └─► 前端状态: "AI 播报中..." 📢
          │
          └─► 播放完成 → 返回待机状态
               │
               └─► 用户可继续提问 → 回到 [1]

┌─────────────────────────────────────────────────────────────┐
│                     关键技术点                               │
└─────────────────────────────────────────────────────────────┘

✅ 已实现:
- VAD 语音端点检测 (silero-vad 算法)
- 阿里云 ASR WebSocket 协议
- 动态采样率检测与重采样
- RAG 向量检索
- 多模态 LLM 集成
- Windows SAPI TTS (临时方案)

⏳ 待实现 (Day 22):
1. 截图自动触发逻辑
2. process_voice_with_screenshot 命令
3. 阿里云 TTS SDK 集成
4. 端到端错误处理
5. 性能优化 (< 5s 延迟)

📊 性能目标:
- 语音识别延迟: < 1s
- 截图捕获: < 200ms
- AI 分析延迟: < 3s
- TTS 合成: < 1s
- 总延迟: < 5s (语音结束 → 开始播报)
```

### 代码模块映射

```
src-tauri/src/
├── aliyun/
│   ├── token_manager.rs      # ✅ Token 管理
│   ├── aliyun_voice_service.rs # ✅ ASR 实现
│   └── aliyun_tts.rs          # ⏳ TTS 待实现
├── audio/
│   ├── vad.rs                 # ✅ VAD 检测
│   ├── recorder.rs            # ✅ 音频录制
│   └── continuous_listener.rs # ✅ 持续监听
├── screenshot/
│   └── capture.rs             # ✅ 截图功能
├── rag/
│   ├── rag.rs                 # ✅ RAG 流程
│   └── embeddings.rs          # ✅ 向量检索
├── llm/
│   └── ollama.rs              # ✅ LLM 调用
└── commands/
    ├── audio_commands.rs      # ✅ 音频命令
    ├── screenshot_commands.rs # ✅ 截图命令
    └── ai_commands.rs         # ⏳ 语音+截图组合命令

src/components/
├── VoiceChatPanel/
│   └── index.tsx              # ✅ 语音聊天 UI
└── AIAssistant/
    └── index.tsx              # ✅ AI 助手页面
```

### 下一步行动清单 (Day 22)

**优先级 P0** (必须完成):
1. ⏳ 实现截图自动触发
   - 监听 `aliyun_asr_event` (RecognitionCompleted)
   - 调用 `capture_screen` 命令
   - 保存到 `aiAssistantStore` 状态

2. ⏳ 创建组合命令 `process_voice_with_screenshot`
   - 输入: `{ text: string, screenshot: string }`
   - 流程: RAG 检索 → LLM 调用
   - 输出: AI 回复文字

3. ⏳ 集成阿里云 TTS
   - 研究 API: WebSocket 或 HTTP
   - 实现音频流接收与播放
   - 复用现有 Token Manager

**优先级 P1** (重要):
4. ⏳ 前端事件流优化
   - 添加加载状态指示
   - 错误处理与重试
   - 用户体验优化

5. ⏳ 性能测试
   - 端到端延迟测量
   - 内存占用监控
   - 并发优化

**优先级 P2** (可选):
6. ⏳ 缓存策略
   - 相同问题缓存 AI 回复
   - 截图去重
   - TTS 音频缓存

---

**当前状态**: Day 22 - 完整语音交互流程 (30%)  
**下一里程碑**: M4 - 完整语音交互 (Day 22 目标)  
**最终目标**: M5 - MVP 完成 (Day 28)
