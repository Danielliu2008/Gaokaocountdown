# 🎓 高考倒计时动态壁纸

一个基于 **HTML + CSS + JavaScript** 的高考倒计时页面，支持动态背景、颜色动画以及每日一言展示。  
你可以直接在线预览效果，也可以配合 [LiveWallpaper](https://github.com/lihaoze123/LiveWallpaper) 设置为桌面动态壁纸。

This project is based on [Countdown](https://github.com/Gasolcloudteam/Countdown) by 星尘, and has been heavily modified.


---

## 📺 在线预览

👉 [点击这里查看倒计时页面](https://raw.githack.com/Danielliu2008/Gaokaocountdown/main/wallpaper.html)

---

## ✨ 功能特色

- **高考倒计时**：实时显示距离高考的天数、周数、时分秒。  
- **动态背景**：每日自动更新 Bing 壁纸作为背景。  
- **动态取色**：自动提取背景主色调并应用到倒计时文字动画。  
- **每日一言**：接入 [Hitokoto API](https://hitokoto.cn)

---

## 🖥️ 设置为动态壁纸

你可以选择多种方式将本项目的 `wallpaper.html` 设置为桌面动态壁纸：

### 方法一（推荐）：使用 [LiveWallpaper](https://github.com/lihaoze123/LiveWallpaper) 适合学校等环境，便携无需安装，可设置自启动
1. 前往 [LiveWallpaper Releases](https://github.com/lihaoze123/LiveWallpaper/releases) 下载最新版本。  
2. 解压后进入 `resource` 文件夹。  
3. 将本项目的 `wallpaper.html`、`gk.css`、`gk.js` 文件替换到 `resource` 文件夹中。  
4. 运行 LiveWallpaper，选择 `wallpaper.html` 作为壁纸即可。  

### 方法二：使用 [Wallpaper Engine (Steam)]
1. 在 Steam 上购买并安装 [Wallpaper Engine](https://store.steampowered.com/app/431960/Wallpaper_Engine/)。  
2. 在 Wallpaper Engine 中选择 **导入本地网页** 功能。  
3. 指定 `wallpaper.html` 文件作为动态壁纸即可。  

### 方法三：使用插件（Windows / macOS / Linux）
1. 安装支持将浏览器页面作为桌面壁纸的插件，例如：
   - **Lively Wallpaper**（免费，Windows）
   - **WebViewScreenSaver**（macOS，可用作屏保或桌面背景）  
2. 将 `wallpaper.html` 文件路径添加到插件中即可运行。  

### 方法四：本地浏览器全屏运行（简易方式）
1. 打开 `wallpaper.html`（双击或用浏览器打开）。  
2. 按 `F11` 进入浏览器全屏模式。  
3. 在 Windows 上，可以用 **Wallpaper Engine Free Alternatives** 或 **ScreenToGif + OBS Overlay** 等方式挂到桌面。  
（此方法仅适合临时展示，不适合长期作为桌面壁纸。）  

---

## 📂 文件结构

```
.
├── wallpaper.html # 主页面
├── gk.css         # 样式文件
└── gk.js          # 倒计时逻辑、取色和一言功能

```

## 📜 License

本项目基于 **MIT License** 开源，详细内容请见 [LICENSE](./LICENSE)。
