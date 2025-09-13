# 🎓 高考倒计时动态壁纸

一个基于 **HTML + CSS + JavaScript** 的高考倒计时页面，支持动态背景、颜色动画以及每日一言展示。  
你可以直接在线预览效果，也可以配合 [LiveWallpaper](https://github.com/lihaoze123/LiveWallpaper) 设置为桌面动态壁纸。

---

## 📺 在线预览

👉 [点击这里查看倒计时页面](https://raw.githack.com/Danielliu2008/Gaokaocountdown/main/wallpaper.html)

---

## ✨ 功能特色

- **高考倒计时**：实时显示距离高考的天数、周数、时分秒。  
- **动态背景**：每日自动更新 Bing 壁纸作为背景。  
- **动态取色**：自动提取背景主色调并应用到倒计时文字动画。  
- **每日一言**：接入 [Hitokoto API](https://hitokoto.cn)，展示随机语句并带有打字机效果。  

---

## 🖥️ 设置为动态壁纸

借助 [LiveWallpaper](https://github.com/lihaoze123/LiveWallpaper)，可以将该页面设置为桌面动态壁纸。  

### 步骤

1. 前往 [LiveWallpaper Releases](https://github.com/lihaoze123/LiveWallpaper/releases) 下载最新版本。  
2. 解压后进入 `resource` 文件夹。  
3. 将本项目的 `wallpaper.html`、`gk.css`、`gk.js` 文件替换到 `resource` 文件夹中。  
4. 运行 LiveWallpaper，选择 `wallpaper.html` 作为壁纸即可。  

---

## 📂 文件结构

```
.
├── wallpaper.html # 主页面
├── gk.css         # 样式文件
└── gk.js          # 倒计时逻辑、取色和一言功能

---

## 📜 License

本项目基于 **MIT License** 开源，详细内容请见 [LICENSE](./LICENSE)。
