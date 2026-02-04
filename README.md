# Game Partner Skill

一个基于 Tauri 的智能游戏伴侣应用，通过实时截屏识别、本地知识库和 AI 对话，为玩家提供沉浸式的游戏体验。

## 项目愿景

打造一款能够：
- 自动识别当前游戏画面
- 构建游戏 Wiki 本地知识库
- 实时提供游戏提示和语音鼓励
- 模拟弹幕/送礼/直播间氛围

## 技术栈

### 前端
- React 18 + TypeScript
- Tailwind CSS (UI 框架)
- Zustand (状态管理)
- React Query (数据获取)

### 后端 (Tauri)
- Rust 1.75+
- Tauri 2.0
- 截屏: screenshots-rs / windows-capture
- OCR: tesseract-rs / paddleocr-rust
- 向量数据库: qdrant-client / lancedb
- LLM 接口: reqwest (调用 OpenAI/本地模型)
- TTS: tts-rs / rodio

### 核心依赖
- screenpipe / windows-rs (截屏)
- opencv-rust (图像处理)
- tokenizers (文本处理)
- fastembed-rs (嵌入模型)
- sqlx (数据持久化)

## 项目状态

🚧 开发中 - 目标：一个月内完成 MVP Demo

## 开发计划

查看 [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md) 了解详细的开发路线图。

## 技术需求

查看 [TECHNICAL_REQUIREMENTS.md](./TECHNICAL_REQUIREMENTS.md) 了解完整的技术规格。

## 快速开始

### 前置要求

- Node.js 18+
- Rust 1.75+
- Windows 10 1903+ 或 Windows 11
- **Windows 语音识别已启用** ⚠️

### 首次使用：配置 Windows 语音识别

语音对话功能依赖 Windows 系统的语音识别服务。请先配置：

```powershell
# 1. 运行诊断脚本检查配置
.\check_speech_config.ps1

# 2. 按照提示启用语音识别
# 或手动操作：设置 > 隐私和安全性 > 语音 > 打开"联机语音识别"
```

📖 详细步骤：[Windows 语音识别设置指南](./WINDOWS_SPEECH_SETUP.md)

### 安装依赖

```bash
# 安装前端依赖
cd game_partner_skill
npm install
```

### 运行应用

```bash
# 开发模式
npm run tauri dev

# 构建生产版本
npm run tauri build
```

### 测试语音功能

```bash
# 查看测试指南
# 见 VOICE_TEST_GUIDE.md
```
