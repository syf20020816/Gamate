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
- [ ] 实现 RAG 提示生成
- [ ] 集成多模态 LLM API
- [ ] 构建 AI 陪玩助手页面

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
# Day 18
□ 添加 TTS 依赖
  - tts = "0.26"
□ 实现基础 TTS
  - src-tauri/src/tts.rs
  - 功能: speak(text) -> Result<()>
  - Windows: 使用 SAPI 5
□ 测试语音播报
  - 朗读 AI 生成的提示
  - 调整语速、音量

# Day 19
□ TTS 配置界面
  - 前端: 选择音色 (男/女)
  - 前端: 调整语速滑块
  - 保存到本地配置
□ 异步播报
  - 不阻塞主线程
  - 队列管理 (防止重叠)
□ 测试播报延迟
  - 目标: < 300ms

# Day 20
□ (可选) 语音唤醒
  - 添加 Vosk 依赖
  - 实现麦克风监听
  - 唤醒词检测: "小助手"
  - 触发主动提示
□ 或替代: 快捷键唤醒
  - 全局热键: Ctrl+Shift+G

# Day 21
□ 集成测试
  - 完整流程: 游戏触发 → AI 提示 → 语音播报
□ 性能优化
  - TTS 预加载
  - 音频缓存
□ Week 3 总结
```

#### 交付物
- 流畅的语音播报
- 延迟 < 500ms
- 配置界面可用

---

## Week 4: UI 完善与测试 (Day 22-28)

### Day 22-24: 弹幕与互动系统 🎉

#### 目标
- [ ] 实现弹幕效果
- [ ] 添加送礼动画

#### 任务清单
```bash
# Day 22
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
| **M3: AI 集成** | Day 21 | RAG + 多模态 LLM + TTS | ⏳ **进行中 (0%)** |
| **M4: MVP 完成** | Day 28 | 完整演示可运行 | ⏳ **未开始** |

### 当前进度详情 (2026-01-30)

**✅ Week 1-2 已完成:**
- Day 1-2: Tauri 项目搭建
- Day 3-4: 智能截图系统 (AI 驱动 + 混合定时 + 图片压缩)
- Day 5-7: ~~OCR~~ (已跳过 - 多模态模型替代)
- Day 8-10: Wiki 爬虫系统 (Fandom/GitHub/Web + JSONL 输出)
- Day 11-14: 向量数据库 (三种模式 + 语义检索)

**✅ 已完成:**
- Day 1-2: Tauri 项目搭建
- Day 3-4: 智能截图系统 (AI 驱动 + 混合定时 + 图片压缩)
- Day 5-7: ~~OCR~~ (已跳过 - 多模态模型替代)
- Day 8-10: Wiki 爬虫系统 (Fandom/GitHub/Web + JSONL 输出)
- **Day 11-14: 向量数据库系统** ✅
  - ✅ 三种模式: Local (JSON) / Qdrant / AI Direct (JSONL)
  - ✅ 向量导入: `import_wiki_to_vector_db`
  - ✅ 语义检索: `search_wiki` (支持三种模式)
  - ✅ 前端 Wiki 知识库界面
  - ✅ Markdown 渲染优化

**⏳ 进行中:**
- **Day 15-17: RAG + LLM 集成** ← **你在这里**
  - [ ] AI 陪玩助手页面
  - [ ] RAG 流程后端
  - [ ] GPT-4 Vision API 集成
  - [ ] 智能截图联动

**📅 待开始:**
- Day 18-21: TTS + 语音交互
- Day 22-28: UI 完善 + 测试
- Day 29-30: 文档 + 演示

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
