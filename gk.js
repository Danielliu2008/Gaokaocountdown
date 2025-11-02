// =================================================================
// 壁纸自定义设置
// =================================================================
const enable_local_wallpaper = false;
const local_wallpaper_path = 'wallpaper.jpg';


// 选择启用动态取色功能或自动颜色调整
const useDynamicColor = true;

// 时间请求相关全局变量
let serverTimeOffset = null;
let retryIntervalId = null;

// 一言动画相关全局变量
let isHitokotoAnimating = false;
const HITOKOTO_REFRESH_ALLOW = false;
const HITOKOTO_REFRESH_INTERVAL = 30000;
const TYPING_SPEED_MS = 100;
const DELETING_SPEED_MS = 50;

// 网络错误处理相关全局变量
let hasWallpaperErrorOccurred = false;


// =================================================================
// 错误处理与壁纸切换 (现在仅用于壁纸加载失败)
// =================================================================
function showWallpaperErrorAndSwitchToLocal() {
    // 如果错误已处理过，则不再执行
    if (hasWallpaperErrorOccurred) return;
    
    hasWallpaperErrorOccurred = true;

    // 创建并显示错误提示
    const errorPopup = document.createElement('div');
    errorPopup.className = 'network-error-popup';
    errorPopup.innerText = '网络错误';
    document.body.appendChild(errorPopup);

    setTimeout(() => {
        errorPopup.style.opacity = '1';
    }, 10);

    setTimeout(() => {
        errorPopup.style.opacity = '0';
        setTimeout(() => {
            errorPopup.remove();
        }, 500);
    }, 3000);

    // 切换到本地壁纸
    console.log("在线壁纸加载失败，切换至本地壁纸。");
    setWallpaper(true); // 强制使用本地壁纸
}

function setWallpaper(forceLocal = false) {
    const useLocal = enable_local_wallpaper || forceLocal;
    const imageUrl = useLocal ? local_wallpaper_path : 'https://api.paugram.com/bing';

    document.body.style.backgroundImage = `url('${imageUrl}')`;
    
    if (useDynamicColor) {
        setupDynamicColorAnimation(imageUrl, useLocal);
    } else {
        setAutoColor();
    }
}


// =================================================================
// 时间处理逻辑
// =================================================================
function fetchServerTime() {
    if (retryIntervalId) {
        clearInterval(retryIntervalId);
        retryIntervalId = null;
    }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://worldtimeapi.org/api/timezone/Asia/Shanghai', true);
    xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
            var response = JSON.parse(xhr.responseText);
            var serverTime = new Date(response.utc_datetime);
            var localTime = new Date();
            serverTimeOffset = serverTime.getTime() - localTime.getTime();
            console.log("成功获取服务器时间。与本地时间差为: " + serverTimeOffset + "ms");
            if (retryIntervalId) {
                clearInterval(retryIntervalId);
                retryIntervalId = null;
            }
        } else {
            console.error('获取服务器时间失败，状态码: ' + xhr.status);
            // MODIFIED: 不再调用全局错误提示，而是直接启动自己的备用机制
            startRetryMechanism();
        }
    };
    xhr.onerror = function() {
        console.error('网络错误，无法获取服务器时间。');
        // MODIFIED: 不再调用全局错误提示，而是直接启动自己的备用机制
        startRetryMechanism();
    };
    xhr.send();
}

function startRetryMechanism() { if (retryIntervalId === null) { console.log("启动备用方案：使用本地时间，并在后台每3秒尝试重新获取服务器时间。"); retryIntervalId = setInterval(fetchServerTime, 3000); } }
function padZero(num) { return num < 10 ? '0' + num : num; }
function updateCountdown() { let now = serverTimeOffset !== null ? new Date(new Date().getTime() + serverTimeOffset) : new Date(); var currentYear = now.getFullYear(); var examDateStart = new Date(currentYear, 5, 7); var examDateEnd = new Date(currentYear, 5, 9, 18, 0, 0); var nextYearExamDate = new Date(currentYear + 1, 5, 7); var weeksDisplay = document.getElementById("weeks-display"); if (now >= examDateStart && now <= examDateEnd) { document.getElementById("countdown").style.display = "none"; weeksDisplay.style.display = "none"; document.getElementById("greeting").style.display = "block"; document.getElementById("greeting").innerText = "今年的高考进行中，祝考试的同学们旗开得胜，金榜题名！"; } else { document.getElementById("greeting").style.display = "none"; document.getElementById("countdown").style.display = "block"; weeksDisplay.style.display = "block"; var timeDiff = examDateStart - now; if (now > examDateEnd) { timeDiff = nextYearExamDate - now; currentYear++; } var days = Math.floor(timeDiff / (1000 * 60 * 60 * 24)); var weeks = Math.floor(days / 7); var remainingDays = days % 7; var hours = padZero(Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))); var minutes = padZero(Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60))); var seconds = padZero(Math.floor((timeDiff % (1000 * 60)) / 1000)); document.getElementById("days").innerText = days; document.getElementById("weeks").innerText = weeks; document.getElementById("remaining-days").innerText = remainingDays; document.getElementById("hours").innerText = hours; document.getElementById("minutes").innerText = minutes; document.getElementById("seconds").innerText = seconds; document.getElementById("year").innerText = currentYear; } }

// =================================================================
// 一言（Hitokoto）动画逻辑 (无变动)
// =================================================================
function typeEffect(element, text, callback) { let index = 0; element.innerText = ''; let intervalId = setInterval(() => { if (index < text.length) { element.innerText += text.charAt(index); index++; } else { clearInterval(intervalId); if (callback) callback(); } }, TYPING_SPEED_MS); }
function deleteEffect(element, callback) { let text = element.innerText; let intervalId = setInterval(() => { if (text.length > 0) { text = text.substring(0, text.length - 1); element.innerText = text; } else { clearInterval(intervalId); if (callback) callback(); } }, DELETING_SPEED_MS); }
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
        });
      } else {
        console.error('获取一言失败:', xhr.status);
        hitokotoElement.style.height = '';
        isHitokotoAnimating = false;
      }
    };
    xhr.onerror = function() {
      console.error('网络错误，无法获取一言。');
      hitokotoElement.style.height = '';
      isHitokotoAnimating = false;
    };
    xhr.send();
  };
  if (isInitialLoad) {
    fetchAndDisplay();
  } else {
    const currentHeight = hitokotoElement.offsetHeight;
    hitokotoElement.style.height = `${currentHeight}px`;
    deleteEffect(hitokotoElement, fetchAndDisplay);
  }
}


// =================================================================
// 颜色处理逻辑
// =================================================================
function setupDynamicColorAnimation(imageUrl, isLocal = false) {
    const tempImage = new Image();
    // 只有在线图片才需要设置跨域属性
    if (!isLocal) {
        tempImage.crossOrigin = 'Anonymous';
    }
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
        } catch (error) {
            console.error("颜色提取失败，将使用CSS中定义的备用动画:", error);
        }
    };
    tempImage.onerror = () => {
        console.error("无法加载背景图片进行颜色分析:", imageUrl);
        // MODIFIED: 只在加载在线壁纸失败时，才触发错误提示和切换逻辑
        if (!isLocal) {
            showWallpaperErrorAndSwitchToLocal();
        }
    };
    tempImage.src = imageUrl;
}
function setAutoColor() { const elements = document.querySelectorAll('.auto-color'); elements.forEach(el => { const rgb = getAverageRGB(document.body); const yiq = ((rgb.r * 299) + (rgb.g * 587) + (rgb.b * 114)) / 1000; el.style.color = (yiq >= 128) ? 'black' : 'white'; }); }
function getAverageRGB(imgEl) { var blockSize = 5, defaultRGB = {r:255,g:255,b:255}, canvas = document.createElement('canvas'), context = canvas.getContext && canvas.getContext('2d'), data, width, height, i = -4, length, rgb = {r:0,g:0,b:0}, count = 0; if (!context) { return defaultRGB; } height = canvas.height = imgEl.naturalHeight || imgEl.offsetHeight || imgEl.height; width = canvas.width = imgEl.naturalWidth || imgEl.offsetWidth || imgEl.width; try { context.drawImage(imgEl, 0, 0); data = context.getImageData(0, 0, width, height); } catch(e) { return defaultRGB; } length = data.data.length; while ( (i += blockSize * 4) < length ) { ++count; rgb.r += data.data[i]; rgb.g += data.data[i+1]; rgb.b += data.data[i+2]; } rgb.r = ~~(rgb.r/count); rgb.g = ~~(rgb.g/count); rgb.b = ~~(rgb.b/count); return rgb; }

// =================================================================
// 页面加载完成后的主执行函数 (无变动)
// =================================================================
document.addEventListener("DOMContentLoaded", () => {
    // 1. 壁纸与动态颜色初始化
    setWallpaper();

    // 2. 时间倒计时初始化
    fetchServerTime();
    setInterval(updateCountdown, 1000);
    // 每5分钟(300000毫秒)重新获取一次服务器时间进行校准
    setInterval(fetchServerTime, 300000);

    // 3. 一言初始化及定时刷新
    updateHitokotoWithAnimation(true);
    if (HITOKOTO_REFRESH_ALLOW) {
        setInterval(() => updateHitokotoWithAnimation(false), HITOKOTO_REFRESH_INTERVAL);
    };
});
