# 日记

本地个人日记。点一下就能写，数据只存在浏览器里，可随时导出备份。

**在线使用：** https://dewyue.github.io/diary/

## 能做什么

- **今日**：左右滑动切日期；点 `+` 在页面里直接写，点已有条目直接改，都不用弹层
- **日历**：年月选择、点日读写；长按「本月」可连续滑动浏览到最早有记录的月份
- **数据**：关键词 / 日期 / 标签查找；长按标签可改名；JSON 导入导出与自动备份提醒
- **删除**：列表里长按一条日记即可删除

数据保存在本机 `localStorage`，清站点数据会丢，请定期导出 JSON。

## 本地开发

```bash
npm install
npm run dev
```

```bash
npm run build
```

构建产物部署到 GitHub Pages（路径 `/diary/`）。

## 从微信聊天记录导入（本地）

把以前写在微信里的日记转成可导入的 JSON。**全程在你电脑上运行，聊天内容不会上传。**

默认规则：
- 双方消息都导入，不记录昵称（只保留内容与时间）
- 同一天合并成一条，多条内容用换行连接

```bash
# 电脑微信导出的 txt
npm run wechat:import -- ~/Downloads/你的聊天记录.txt

# 或 wechat-insight 导出后再转
npm run wechat:insight -- ./path/to/export
```

生成 JSON 后，打开日记站 → **数据 → 合并导入**。

常用选项：

```bash
npm run wechat:import -- ./chat.txt -o ./my-diary.json
npm run wechat:import -- ./chat.txt --no-tag
```

样例（假数据）：

```bash
npm run wechat:import -- ./scripts/fixtures/wechat-sample.txt
```
