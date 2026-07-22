# 个人日记

简洁的本地日记工具：按天写多条记录，支持标签、月历与查找。数据存在浏览器本地，可随时导出 / 导入 JSON，并支持到期自动备份提醒。

**在线使用：** https://dewyue.github.io/diary/

## 功能

- **今日**：快速记录当天内容
- **日历**：按月查看、点选日期读写
- **数据**：关键词 / 日期 / 标签查找，导出导入，自动备份设置

## 本地开发

```bash
npm install
npm run dev
```

```bash
npm run build
```

构建产物会部署到 GitHub Pages（`/diary/` 路径）。

## 从微信聊天记录导入（本地）

把以前写在微信里的日记转成可导入的 JSON。**全程在你电脑上运行，聊天内容不会上传。**

1. 用电脑微信导出该聊天为 `.txt`
2. 在项目目录执行：

```bash
npm run wechat:import -- ~/Downloads/你的聊天记录.txt --from "你的微信昵称"
```

3. 生成 `diary-from-wechat.json` 后，打开日记站 → **数据 → 合并导入**

常用选项：

```bash
# 指定输出文件
npm run wechat:import -- ./chat.txt --from "昵称" -o ./my-diary.json

# 同一天多条合并成一条
npm run wechat:import -- ./chat.txt --from "昵称" --merge-day

# 不打「微信」标签
npm run wechat:import -- ./chat.txt --from "昵称" --no-tag
```

可用仓库里的样例试跑（假数据）：

```bash
npm run wechat:import -- ./scripts/fixtures/wechat-sample.txt --from "小兑"
```
