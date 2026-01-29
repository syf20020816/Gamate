# 贡献指南

感谢你对 Game Partner Skill 项目的关注!我们欢迎各种形式的贡献。

## 🤝 如何贡献

### 报告 Bug
1. 检查 [Issues](../../issues) 中是否已有相同问题
2. 创建新 Issue,包含:
   - 详细描述问题
   - 复现步骤
   - 系统环境 (OS, Rust/Node 版本)
   - 截图或日志

### 提交功能建议
1. 在 Issues 中描述你的想法
2. 说明使用场景和预期效果
3. 等待社区讨论

### 贡献代码
1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交改动 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

### 贡献游戏数据
1. 爬取新游戏的 Wiki 数据
2. 按格式整理为 `wiki_raw.jsonl`
3. 提交 PR 到 `data/` 目录

## 📝 代码规范

### Rust
- 遵循 `cargo fmt` 和 `cargo clippy` 规则
- 添加必要的注释和文档
- 编写单元测试

### TypeScript/React
- 使用 ESLint + Prettier
- 组件使用函数式 + Hooks
- 类型定义要完整

## 🎯 开发流程

1. 拉取最新代码
2. 创建 Issue 关联分支
3. 本地开发+测试
4. 提交 PR,关联 Issue
5. Code Review
6. 合并到主分支

## 🙏 行为准则

- 尊重所有贡献者
- 建设性沟通
- 欢迎新手,耐心解答

---

再次感谢你的贡献! ❤️
