// =================================================================
// 自定义设置
// =================================================================
const countdown_precision_mode = 'days';
const enable_local_wallpaper = false;
const local_wallpaper_path = 'wallpaper.jpg';
const useDynamicColor = true;
let serverTimeOffset = null;
let retryIntervalId = null;
let isHitokotoAnimating = false;
const HITOKOTO_REFRESH_ALLOW = false;
const HITOKOTO_REFRESH_INTERVAL = 30000;
const TYPING_SPEED_MS = 100;
const DELETING_SPEED_MS = 50;
let hasWallpaperErrorOccurred = false;

// 新增：用于背景图像分析的全局Canvas变量
let backgroundCanvas = null;
let backgroundContext = null;


// =================================================================
// 背景明暗度识别与颜色调整 (核心新功能)
// =================================================================
function initializeBackgroundCanvas(image) {
    backgroundCanvas = document.createElement('canvas');
    backgroundCanvas.width = window.innerWidth;
    backgroundCanvas.height = window.innerHeight;
    backgroundContext = backgroundCanvas.getContext('2d', { willReadFrequently: true });

    // 计算如何缩放和定位图像以匹配 'background-size: cover' 效果
    const canvasAspect = backgroundCanvas.width / backgroundCanvas.height;
    const imageAspect = image.naturalWidth / image.naturalHeight;
    let drawWidth, drawHeight, drawX, drawY;

    if (canvasAspect > imageAspect) {
        drawWidth = backgroundCanvas.width;
        drawHeight = drawWidth / imageAspect;
        drawX = 0;
        drawY = (backgroundCanvas.height - drawHeight) / 2;
    } else {
        drawHeight = backgroundCanvas.height;
        drawWidth = drawHeight * imageAspect;
        drawY = 0;
        drawX = (backgroundCanvas.width - drawWidth) / 2;
    }

    backgroundContext.drawImage(image, drawX, drawY, drawWidth, drawHeight);
    console.log("背景图片已绘制到内存Canvas，可供颜色分析。");

    // 首次加载时，立即为一言设置颜色
    setHitokotoColorByBackground();
}

function setHitokotoColorByBackground() {
    if (!backgroundContext) {
        console.warn("背景Canvas尚未准备好，无法分析颜色。");
        return;
    }

    const hitokotoElement = document.getElementById("hitokoto");
    const rect = hitokotoElement.getBoundingClientRect();

    // 确保元素可见且有尺寸
    if (rect.width === 0 || rect.height === 0) {
        return;
    }

    try {
        const imageData = backgroundContext.getImageData(rect.left, rect.top, rect.width, rect.height).data;
        let totalYIQ = 0;
        let count = 0;

        for (let i = 0; i < imageData.length; i += 4) {
            const r = imageData[i];
            const g = imageData[i + 1];
            const b = imageData[i + 2];
            const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
            totalYIQ += yiq;
            count++;
        }
        
        if (count === 0) return;

        const avgYIQ = totalYIQ / count;
        
        // 根据平均亮度设置颜色和阴影
        if (avgYIQ >= 128) {
            hitokotoElement.style.color = 'black';
            // 使用浅色阴影以在暗背景的边缘部分也能看清
            hitokotoElement.style.textShadow = '0px 1px 3px rgba(255, 255, 255, 0.5)';
        } else {
            hitokotoElement.style.color = 'white';
            // 使用深色阴影以在亮背景的边缘部分也能看清
            hitokotoElement.style.textShadow = '0px 2px 8px rgba(0, 0, 0, 0.6)';
        }
        console.log(`一言背后区域平均亮度: ${avgYIQ.toFixed(2)}，已自动设置为 ${avgYIQ >= 128 ? '黑色' : '白色'}。`);

    } catch (e) {
        console.error("分析一言背景颜色时出错:", e);
        // 出错时回退到默认白色
        hitokotoElement.style.color = 'white';
        hitokotoElement.style.textShadow = '0px 2px 8px rgba(0, 0, 0, 0.6)';
    }
}


// ... (错误处理、壁纸设置、时间获取等函数保持不变)
function showWallpaperErrorAndSwitchToLocal() { if (hasWallpaperErrorOccurred) return; hasWallpaperErrorOccurred = true; const errorPopup = document.createElement('div'); errorPopup.className = 'network-error-popup'; errorPopup.innerText = '网络错误'; document.body.appendChild(errorPopup); setTimeout(() => { errorPopup.style.opacity = '1'; }, 10); setTimeout(() => { errorPopup.style.opacity = '0'; setTimeout(() => { errorPopup.remove(); }, 500); }, 3000); console.log("在线壁纸加载失败，切换至本地壁纸。"); setWallpaper(true); }
function setWallpaper(forceLocal = false) { const useLocal = enable_local_wallpaper || forceLocal; const imageUrl = useLocal ? local_wallpaper_path : 'https://api.paugram.com/bing'; document.body.style.backgroundImage = `url('${imageUrl}')`; if (useDynamicColor) { setupDynamicColorAnimation(imageUrl, useLocal); } else { setAutoColor(); } }
function fetchServerTime() { if (retryIntervalId) { clearInterval(retryIntervalId); retryIntervalId = null; } var xhr = new XMLHttpRequest(); xhr.open('GET', 'https://worldtimeapi.org/api/timezone/Asia/Shanghai', true); xhr.onload = function() { if (xhr.status >= 200 && xhr.status < 300) { var response = JSON.parse(xhr.responseText); var serverTime = new Date(response.utc_datetime); var localTime = new Date(); serverTimeOffset = serverTime.getTime() - localTime.getTime(); console.log("成功获取服务器时间。与本地时间差为: " + serverTimeOffset + "ms"); if (retryIntervalId) { clearInterval(retryIntervalId); retryIntervalId = null; } } else { console.error('获取服务器时间失败，状态码: ' + xhr.status); startRetryMechanism(); } }; xhr.onerror = function() { console.error('网络错误，无法获取服务器时间。'); startRetryMechanism(); }; xhr.send(); }
function startRetryMechanism() { if (retryIntervalId === null) { console.log("启动备用方案：使用本地时间，并在后台每3秒尝试重新获取服务器时间。"); retryIntervalId = setInterval(fetchServerTime, 3000); } }
function padZero(num) { return num < 10 ? '0' + num : num; }
function updateCountdown() { let now = serverTimeOffset !== null ? new Date(new Date().getTime() + serverTimeOffset) : new Date(); var currentYear = now.getFullYear(); var examDateStart = new Date(currentYear, 5, 7); var examDateEnd = new Date(currentYear, 5, 9, 18, 0, 0); var nextYearExamDate = new Date(currentYear + 1, 5, 7); const greeting = document.getElementById("greeting"); const fullCountdownContainer = document.getElementById("full-countdown-container"); const calendarCountdownContainer = document.getElementById("calendar-countdown"); if (now >= examDateStart && now <= examDateEnd) { fullCountdownContainer.style.display = "none"; calendarCountdownContainer.style.display = "none"; greeting.style.display = "block"; greeting.innerText = "今年的高考进行中，祝考试的同学们旗开得胜，金榜题名！"; } else { greeting.style.display = "none"; var timeDiff = examDateStart - now; if (now > examDateEnd) { timeDiff = nextYearExamDate - now; currentYear++; } var days = Math.floor(timeDiff / (1000 * 60 * 60 * 24)); if (countdown_precision_mode === 'days') { fullCountdownContainer.style.display = "none"; calendarCountdownContainer.style.display = "block"; document.getElementById("calendar-day-number").innerText = days; } else { fullCountdownContainer.style.display = "block"; calendarCountdownContainer.style.display = "none"; var weeks = Math.floor(days / 7); var remainingDays = days % 7; var hours = padZero(Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))); var minutes = padZero(Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60))); var seconds = padZero(Math.floor((timeDiff % (1000 * 60)) / 1000)); document.getElementById("year").innerText = currentYear; document.getElementById("days").innerText = days; document.getElementById("weeks").innerText = weeks; document.getElementById("remaining-days").innerText = remainingDays; document.getElementById("hours").innerText = hours; document.getElementById("minutes").innerText = minutes; document.getElementById("seconds").innerText = seconds; } } }
function typeEffect(element, text, callback) { let index = 0; element.innerText = ''; let intervalId = setInterval(() => { if (index < text.length) { element.innerText += text.charAt(index); index++; } else { clearInterval(intervalId); if (callback) callback(); } }, TYPING_SPEED_MS); }
function deleteEffect(element, callback) { let text = element.innerText; let intervalId = setInterval(() => { if (text.length > 0) { text = text.substring(0, text.length - 1); element.innerText = text; } else { clearInterval(intervalId); if (callback) callback(); } }, DELETING_SPEED_MS); }

// 修改：更新一言后，重新计算其颜色
function updateHitokotoWithAnimation(isInitialLoad = false) {
    if (isHitokotoAnimating) return;
    isHitokotoAnimating = true;
    const hitokotoElement = document.getElementById("hitokoto");
    const fetchAndDisplay = () => {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', 'https://v1.hitokoto.cn/?c=l&c=k&c=j&c=i', true);
        xhr.onload = function() {
            if (xhr.status >= 200 && xhr.status < 300) {
                var response = JSON.parse(xhr.responseText);
                const newHitokoto = `${response.hitokoto} -- ${response.from}`;
                typeEffect(hitokotoElement, newHitokoto, () => {
                    hitokotoElement.style.height = '';
                    isHitokotoAnimating = false;
                    // 新增：打字动画结束后，立即重新分析背景颜色
                    setHitokotoColorByBackground();
                });
            } else { console.error('获取一言失败:', xhr.status); hitokotoElement.style.height = ''; isHitokotoAnimating = false; }
        };
        xhr.onerror = function() { console.error('网络错误，无法获取一言。'); hitokotoElement.style.height = ''; isHitokotoAnimating = false; };
        xhr.send();
    };
    if (isInitialLoad) { fetchAndDisplay(); } else { const currentHeight = hitokotoElement.offsetHeight; hitokotoElement.style.height = `${currentHeight}px`; deleteEffect(hitokotoElement, fetchAndDisplay); }
}

// 修改：加载背景图片后，初始化Canvas用于颜色分析
function setupDynamicColorAnimation(imageUrl, isLocal = false) {
    const tempImage = new Image();
    if (!isLocal) { tempImage.crossOrigin = 'Anonymous'; }
    tempImage.onload = () => {
        try {
            const colorThief = new ColorThief();
            const palette = colorThief.getPalette(tempImage, 5);
            if (palette && palette.length >= 4) {
                const colors = palette.slice(0, 4).map(rgb => `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`);
                const keyframes = ` @keyframes colorChange { 0%, 100% { color: ${colors[0]}; } 25% { color: ${colors[1]}; } 50% { color: ${colors[2]}; } 75% { color: ${colors[3]}; } } `;
                const styleSheet = document.createElement("style");
                styleSheet.innerText = keyframes;
                document.head.appendChild(styleSheet);
                console.log("成功从背景图中提取颜色并应用新动画:", colors);
            }
        } catch (error) { console.error("颜色提取失败，将使用CSS中定义的备用动画:", error); }

        // 新增：图片加载成功后，立即初始化背景Canvas
        initializeBackgroundCanvas(tempImage);
    };
    tempImage.onerror = () => { console.error("无法加载背景图片进行颜色分析:", imageUrl); if (!isLocal) { showWallpaperErrorAndSwitchToLocal(); } };
    tempImage.src = imageUrl;
}
function setAutoColor() { const elements = document.querySelectorAll('.auto-color'); elements.forEach(el => { const rgb = getAverageRGB(document.body); const yiq = ((rgb.r * 299) + (rgb.g * 587) + (rgb.b * 114)) / 1000; el.style.color = (yiq >= 128) ? 'black' : 'white'; }); }
function getAverageRGB(imgEl) { var blockSize = 5, defaultRGB = {r:255,g:255,b:255}, canvas = document.createElement('canvas'), context = canvas.getContext && canvas.getContext('2d'), data, width, height, i = -4, length, rgb = {r:0,g:0,b:0}, count = 0; if (!context) { return defaultRGB; } height = canvas.height = imgEl.naturalHeight || imgEl.offsetHeight || imgEl.height; width = canvas.width = imgEl.naturalWidth || imgEl.offsetWidth || imgEl.width; try { context.drawImage(imgEl, 0, 0); data = context.getImageData(0, 0, width, height); } catch(e) { return defaultRGB; } length = data.data.length; while ( (i += blockSize * 4) < length ) { ++count; rgb.r += data.data[i]; rgb.g += data.data[i+1]; rgb.b += data.data[i+2]; } rgb.r = ~~(rgb.r/count); rgb.g = ~~(rgb.g/count); rgb.b = ~~(rgb.b/count); return rgb; }

// =================================================================
// 页面加载完成后的主执行函数
// =================================================================
document.addEventListener("DOMContentLoaded", () => {
    setWallpaper();
    fetchServerTime();
    setInterval(updateCountdown, 1000);
    setInterval(fetchServerTime, 300000);
    updateHitokotoWithAnimation(true);
    if (HITOKOTO_REFRESH_ALLOW) { setInterval(() => updateHitokotoWithAnimation(false), HITOKOTO_REFRESH_INTERVAL); };

    // 新增：当窗口大小改变时，重新绘制Canvas并计算一言颜色
    window.addEventListener('resize', () => {
        // 需要重新加载图片以确保获取的是最新尺寸的背景
        const currentBgImage = document.body.style.backgroundImage.slice(5, -2);
        const tempImage = new Image();
        if (!currentBgImage.startsWith('wallpaper.jpg')) {
            tempImage.crossOrigin = 'Anonymous';
        }
        tempImage.onload = () => initializeBackgroundCanvas(tempImage);
        tempImage.src = currentBgImage;
    });
});