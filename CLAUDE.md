# earnclaw 项目开发规范

## Code Review

涉及代码编写（新增、修改、删除）时，完成后必须使用 second-opinion skill 让 Codex review，无需 Ada 手动要求。

## 变更记录

每次对项目文件进行修改后，必须在此处追加变更记录，格式如下：

| 日期 | 变更范围 | 变更内容 |
|------|---------|---------|
| 2026-03-15 | docs/tech-v2, docs/prd-v5 | 文档与代码对齐：脚本扩展名 .sh→.ts；metadata 格式改为 openclaw 单行 JSON；用户画像字段名改英文；现货交易权限修正为 ❌；Market Ranking/Trading Signals 标注为仅参考；补充 margin-api history 命令、snapshot read 命令、lib.ts 文件；移除不支持的 frontmatter 字段（version/schedule）；确认模式命名统一为 confirm-first/auto；补充零值限额初始化警告和 cron 注册说明 |
| 2026-03-16 | setup.md, execute.md, SKILL.md, TESTING.md | setup 自动化：持仓自动查询、风险/流动性从持仓推断、授权限额按账户总额推算、cron 自动注册、API key 开头验证；execute 自动建议金额；setup 从 10 轮对话缩减到 2 轮 |

## 发布流程

```bash
# 1. 推送到 GitHub
git add <files>
git commit -m "message"
git push origin main

# 2. 构建干净的发布目录（排除 test/、TESTING.md、.DS_Store）
rsync -av --exclude='test/' --exclude='TESTING.md' --exclude='.DS_Store' \
  ./passive-income-claw/ ./passive-income-claw-dist/

# 3. 发布到 ClawHub（版本号需要手动 bump，重复版本号会报错）
clawhub publish ./passive-income-claw-dist \
  --slug passive-income-claw \
  --name "Passive Income Claw" \
  --version <new-version>

# 4. 清理
rm -rf ./passive-income-claw-dist
```

当前最新版本：0.2.0
