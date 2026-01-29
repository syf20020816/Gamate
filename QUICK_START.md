# Quick Start Guide

## 前置要求

### 必需安装
- **Rust** 1.75+ ([安装指南](https://www.rust-lang.org/tools/install))
- **Node.js** 20+ ([下载](https://nodejs.org/))
- **pnpm** (运行 `npm install -g pnpm`)

### Windows 特定要求
- **Visual Studio C++ Build Tools** ([下载](https://visualstudio.microsoft.com/downloads/))
- **WebView2** (Windows 10/11 已内置)

### 可选依赖
- **Tesseract OCR** ([下载](https://github.com/UB-Mannheim/tesseract/wiki))
  - 安装后设置环境变量: `TESSDATA_PREFIX=C:\Program Files\Tesseract-OCR\tessdata`

---

## 快速开始

### 1. 创建项目

```powershell
# 使用 Tauri CLI 创建项目
pnpm create tauri-app

# 选择配置:
# - 项目名: game-partner-skill
# - 语言: TypeScript
# - 框架: React
# - 包管理器: pnpm

cd game-partner-skill
```

### 2. 安装依赖

```powershell
# 安装前端依赖
pnpm install

# 添加必需的前端库
pnpm add zustand @tanstack/react-query framer-motion lucide-react
pnpm add -D tailwindcss postcss autoprefixer
pnpx tailwindcss init -p
```

### 3. 配置 Tauri

编辑 `src-tauri/Cargo.toml`:

```toml
[dependencies]
tauri = { version = "2.0", features = ["shell-open"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio = { version = "1.35", features = ["full"] }
```

### 4. 运行开发服务器

```powershell
pnpm tauri dev
```

---

## 第一周任务 Checklist

### Day 1-2: 基础搭建
- [ ] 完成上述快速开始步骤
- [ ] 应用能正常启动并显示 Hello World
- [ ] 配置 Tailwind CSS
- [ ] 创建基础 UI 布局
- [ ] 实现一个简单的 Tauri 命令 (Rust → 前端通信)

### Day 3-4: 截屏模块
- [ ] 添加 `screenshots = "0.6"` 到 Cargo.toml
- [ ] 实现 `capture_screen()` 命令
- [ ] 前端显示截屏预览
- [ ] 测试性能 (帧率 + CPU 占用)

### Day 5-7: OCR 集成
- [ ] 安装 Tesseract OCR
- [ ] 添加 `tesseract-rs` 依赖
- [ ] 实现 `extract_text(image)` 功能
- [ ] 前端显示识别结果

---

## 常用命令

```powershell
# 开发模式
pnpm tauri dev

# 构建生产版本
pnpm tauri build

# 运行前端开发服务器
pnpm dev

# 检查 Rust 代码
cd src-tauri
cargo check
cargo clippy

# 格式化代码
cargo fmt
pnpm format
```

---

## 项目结构 (目标)

```
game-partner-skill/
├── src/                      # React 前端
│   ├── components/           # UI 组件
│   │   ├── Danmaku.tsx      # 弹幕组件
│   │   ├── Assistant.tsx    # AI 助手界面
│   │   └── StatusBar.tsx    # 状态栏
│   ├── stores/              # Zustand 状态管理
│   │   └── gameStore.ts
│   ├── App.tsx
│   └── main.tsx
├── src-tauri/               # Rust 后端
│   ├── src/
│   │   ├── main.rs          # 入口
│   │   ├── screenshot.rs    # 截屏模块
│   │   ├── ocr.rs           # OCR 模块
│   │   ├── crawler.rs       # Wiki 爬虫
│   │   ├── embeddings.rs    # 向量嵌入
│   │   ├── llm.rs           # LLM 调用
│   │   └── tts.rs           # 语音播报
│   ├── Cargo.toml
│   └── tauri.conf.json
├── data/                    # 数据目录
│   └── elden_ring/          # 游戏数据
│       ├── wiki_raw.jsonl
│       └── qdrant/          # 向量库
├── docs/                    # 文档
├── README.md
├── TECHNICAL_REQUIREMENTS.md
└── DEVELOPMENT_PLAN.md
```

---

## 故障排查

### 问题: Tauri 编译失败
```
error: linking with `link.exe` failed
```
**解决**: 安装 Visual Studio C++ Build Tools

### 问题: 截屏返回空图像
**解决**: 检查 `tauri.conf.json` 是否允许屏幕捕获权限

### 问题: Tesseract 找不到
```
Error: Failed to initialize Tesseract
```
**解决**: 
1. 确认 Tesseract 已安装
2. 设置环境变量 `TESSDATA_PREFIX`
3. 重启终端

---

## 下一步

完成 Quick Start 后,按照 [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md) 的 Week 1 任务继续开发。

需要帮助? 
- 查看 [技术需求文档](./TECHNICAL_REQUIREMENTS.md)
- 参考 [Tauri 官方文档](https://tauri.app/v2/guides/)

Good luck! 🚀
