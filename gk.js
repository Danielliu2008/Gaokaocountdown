// gk.js — 最终修复版 (修复 undefined 路径问题)

// =============================================================================
// 1. 全局配置与状态
// =============================================================================
const CONFIG = {
    enableLocalWallpaper: true,   // 开关：本地/网络
    wallpaperMode: 'time',        // 模式：'time' | 'random'
    currentTheme: 'depth_pro',    // 当前主题 Key (对应 index.json)
    refreshInterval: 20 * 60000,  // 刷新间隔
    useDynamicColor: true,        // 自动取色开关
    countdownMode: 'days'         // 倒计时模式
};

// 【关键修复】定义全局路径对象，防止 undefined
const PATHS = {
    root: 'wallpaper',
    themeRoot: '' // 这个值会在 loadThemeConfig 中被动态填充
};

const STATE = {
    serverTimeOffset: null,
    wallpaperConfig: null,
    isConfigLoading: false,
    currentImageConfig: null,
    dynamicStyleSheet: null,
    themeStyleTag: null,
    currentScriptTag: null,
    retryTimer: null,
    quotes: { data: [], index: 0 },
    
    // 【新增】缓存上一次渲染的状态，用于性能优化
    lastRendered: {
        days: null,      // 记录上次渲染的天数
        isExamTime: null // 记录上次是否处于考试中
    }
};


// 颜色缓存
let CachedColorStyle = {
    lightText: "rgba(255,255,255,0.95)",
    darkText: "rgba(0,0,0,0.85)",
    useLight: true,
    isManual: false
};

// =============================================================================
// 2. 核心配置加载器
// =============================================================================
async function loadThemeConfig() {
    if (STATE.wallpaperConfig) return STATE.wallpaperConfig;
    if (STATE.isConfigLoading) return null;
    STATE.isConfigLoading = true;

    try {
        // 1. 读取总索引 index.json
        const indexRes = await fetch(`${PATHS.root}/index.json`);
        if (!indexRes.ok) throw new Error("无法读取 index.json");
        const indexData = await indexRes.json();

        const activeKey = CONFIG.currentTheme;
        const relativeThemePath = indexData.list[activeKey];
        
        if (!relativeThemePath) throw new Error(`未找到主题定义: ${activeKey}`);

        // 【关键修复】设置当前主题的物理根路径
        // 例如: wallpaper/themes/depth_pro
        PATHS.themeRoot = `${PATHS.root}/${relativeThemePath}`;

        // 2. 读取具体主题配置 theme.json
        const themeRes = await fetch(`${PATHS.themeRoot}/theme.json`);
        if (!themeRes.ok) throw new Error("无法读取 theme.json");
        const themeData = await themeRes.json();

        STATE.wallpaperConfig = themeData;

        // 3. 加载主题 CSS
        if (themeData.meta && themeData.meta.css) {
            loadThemeCss(`${PATHS.themeRoot}/${themeData.meta.css}`);
        }

        console.log(`主题 [${themeData.meta.name}] 加载完毕，路径: ${PATHS.themeRoot}`);
        return STATE.wallpaperConfig;

    } catch (e) {
        console.error("配置加载失败:", e);
        return null;
    } finally {
        STATE.isConfigLoading = false;
    }
}

function loadThemeCss(url) {
    if (STATE.themeStyleTag) STATE.themeStyleTag.remove();
    STATE.themeStyleTag = document.createElement('link');
    STATE.themeStyleTag.rel = 'stylesheet';
    STATE.themeStyleTag.href = url;
    document.head.appendChild(STATE.themeStyleTag);
}

// =============================================================================
// 3. 壁纸选择与路径构建
// =============================================================================
async function selectWallpaper() {
    const config = await loadThemeConfig();
    if (!config) return null;

    const hour = new Date().getHours();
    let candidates = [];

    // 筛选符合时间的图片
    config.schedule.forEach(rule => {
        let isMatch = false;
        if (CONFIG.wallpaperMode === 'random') {
            isMatch = true;
        } else {
            const [start, end] = rule.time;
            isMatch = (start > end) 
                ? (hour >= start || hour < end) 
                : (hour >= start && hour < end);
        }

        if (isMatch && rule.items) {
            candidates = candidates.concat(rule.items);
        }
    });

    if (candidates.length === 0) {
        console.warn("当前时间段无匹配壁纸");
        return null;
    }

    const selection = candidates[Math.floor(Math.random() * candidates.length)];

    // 【关键修复】路径拼接函数
    // 确保 PATHS.themeRoot 存在，否则返回空字符串避免 undefined/undefined
    const makePath = (relativePath) => {
        if (!relativePath) return '';
        if (!PATHS.themeRoot) {
            console.error("PATHS.themeRoot 未定义，请检查 index.json 加载");
            return relativePath;
        }
        return `${PATHS.themeRoot}/${relativePath}`;
    };

    let layersToRender = [];

    if (selection.type === 'layers' || selection.layers) {
        layersToRender = selection.layers.map(layer => ({
            src: makePath(layer.src),
            z: layer.z
        }));
    } else {
        layersToRender = [{
            src: makePath(selection.src),
            z: 1
        }];
    }

    return { layers: layersToRender, config: selection };
}

// =============================================================================
// 4. 壁纸渲染执行
// =============================================================================
async function updateWallpaper() {
    let renderData = null;
    
    if (CONFIG.enableLocalWallpaper) {
        renderData = await selectWallpaper();
    }

    let layersToLoad = [];
    let baseImageUrl = '';

    if (renderData && renderData.layers.length > 0) {
        layersToLoad = renderData.layers;
        // 找最底层作为取色基准
        const bgLayer = layersToLoad.reduce((prev, curr) => (prev.z < curr.z ? prev : curr));
        baseImageUrl = bgLayer.src;
    } else {
        const bingUrl = `https://api.paugram.com/bing?${Date.now()}`;
        layersToLoad = [{ src: bingUrl, z: 1 }];
        baseImageUrl = bingUrl;
    }

    console.log(`准备渲染壁纸 (层数: ${layersToLoad.length})`);

    // 预加载
    const imagePromises = layersToLoad.map(layer => {
        return new Promise((resolve) => {
            const img = new Image();
            if (layer.src.startsWith('http')) img.crossOrigin = "Anonymous";
            
            img.src = layer.src;
            img.onload = () => {
                if ('decode' in img) img.decode().catch(()=>{});
                resolve({ element: img, z: layer.z, src: layer.src });
            };
            img.onerror = () => {
                console.error(`图层加载失败: ${layer.src}`);
                resolve(null);
            };
        });
    });

    try {
        const loadedImages = await Promise.all(imagePromises);
        const validImages = loadedImages.filter(item => item !== null);

        if (validImages.length === 0) return;

        // 应用特效/样式
        const tempImg = new Image();
        tempImg.src = baseImageUrl;
        applyWallpaperEffects(tempImg, renderData ? renderData.config : null);

        // 渲染 DOM
        renderLayersToDOM(validImages);

    } catch (e) {
        console.error("渲染异常:", e);
    }
}

function renderLayersToDOM(imagesData) {
    const container = document.getElementById('wallpaper-layers');
    if (!container) return;

    container.innerHTML = '';
    document.body.style.backgroundImage = 'none';

    imagesData.forEach(data => {
        const imgDiv = document.createElement('img');
        imgDiv.src = data.src;
        imgDiv.className = 'wp-layer';
        imgDiv.style.zIndex = data.z;
        imgDiv.style.opacity = '0';
        container.appendChild(imgDiv);
        
        requestAnimationFrame(() => { imgDiv.style.opacity = '1'; });
    });
}

// =============================================================================
// 5. 样式与特效管理器
// =============================================================================
function applyWallpaperEffects(imgElement, imgConfig) {
    document.body.className = ''; 
    if (STATE.currentScriptTag) { 
        STATE.currentScriptTag.remove();
        STATE.currentScriptTag = null;
    }
    
    STATE.currentImageConfig = imgConfig;
    const manualStyle = imgConfig && imgConfig.style;
    CachedColorStyle.isManual = !!manualStyle;

    if (imgConfig && imgConfig.class) {
        document.body.classList.add(imgConfig.class);
        console.log(`已注入 CSS Class: ${imgConfig.class}`);
    }

    if (manualStyle) {
        console.log("应用自定义内联样式配置");
        document.documentElement.style.setProperty('--custom-color', manualStyle.color || 'inherit');
        document.documentElement.style.setProperty('--custom-shadow', manualStyle.textShadow || 'none');
        
        CachedColorStyle.useLight = true; 
        CachedColorStyle.lightText = manualStyle.color || "white";
        CachedColorStyle.darkText = manualStyle.color || "black";
        
        if (STATE.dynamicStyleSheet) STATE.dynamicStyleSheet.innerText = '';
    } else {
        document.documentElement.style.removeProperty('--custom-color');
        document.documentElement.style.removeProperty('--custom-shadow');
        if (CONFIG.useDynamicColor) runColorThief(imgElement);
        else runCanvasAnalysis(imgElement);
    }

    if (imgConfig && imgConfig.script) {
        loadCustomScript(`${PATHS.themeRoot}/${imgConfig.script}`);
    }

    updateAutoColorElements();
}

function loadCustomScript(url) {
    const script = document.createElement('script');
    script.src = url;
    document.body.appendChild(script);
    STATE.currentScriptTag = script;
}

// =============================================================================
// 6. 颜色提取与辅助
// =============================================================================
function runColorThief(img) {
    try {
        if (typeof ColorThief === 'undefined') throw new Error("No ColorThief");
        const colorThief = new ColorThief();
        const palette = colorThief.getPalette(img, 5);
        if (palette && palette.length > 0) generateDynamicKeyframes(palette);
        runCanvasAnalysis(img); 
    } catch (e) { runCanvasAnalysis(img); }
}

function runCanvasAnalysis(img) {
    const canvas = document.createElement('canvas');
    canvas.width = 10; canvas.height = 10;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    try {
        ctx.drawImage(img, 0, 0, 10, 10);
        const data = ctx.getImageData(0, 0, 10, 10).data;
        let totalYIQ = 0, count = 0, isTransparent = true;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] > 0) isTransparent = false;
            totalYIQ += (data[i]*299 + data[i+1]*587 + data[i+2]*114) / 1000;
            count++;
        }
        if (isTransparent || count === 0) throw new Error("Empty");
        
        const avgYIQ = totalYIQ / count;
        CachedColorStyle.useLight = avgYIQ < 128;
        if (!CachedColorStyle.isManual) {
            CachedColorStyle.lightText = "rgba(255,255,255,0.95)";
            CachedColorStyle.darkText = "rgba(0,0,0,0.85)";
        }
    } catch (e) {
        if (!CachedColorStyle.isManual) {
            CachedColorStyle.useLight = true;
            CachedColorStyle.lightText = "white";
        }
    }
}

function generateDynamicKeyframes(palette) {
    if (CachedColorStyle.isManual) return;
    const stops = [0, 25, 50, 75, 100];
    let content = '';
    const count = Math.min(4, palette.length);
    for (let i = 0; i < count; i++) {
        const [r, g, b] = palette[i];
        const yiq = (r*299 + g*587 + b*114) / 1000;
        const opacity = 0.8 - (yiq / 255) * 0.7; 
        const blur = 8 - (yiq / 255) * 4;
        const shadow = `0 0 ${blur.toFixed(1)}px rgba(255,255,255,${opacity.toFixed(2)})`;
        content += `${stops[i]}% { color: rgb(${r},${g},${b}); text-shadow: ${shadow}; } `;
        if (i===0) content += `100% { color: rgb(${r},${g},${b}); text-shadow: ${shadow}; } `;
    }
    if (!STATE.dynamicStyleSheet) {
        STATE.dynamicStyleSheet = document.createElement("style");
        document.head.appendChild(STATE.dynamicStyleSheet);
    }
    STATE.dynamicStyleSheet.innerText = `@keyframes colorChange { ${content} }`;
}

function updateAutoColorElements() {
    const elements = document.querySelectorAll('.auto-color');
    elements.forEach(el => {
        if (CachedColorStyle.isManual) {
            el.style.animation = 'none';
            el.style.color = 'var(--custom-color)';
            el.style.textShadow = 'var(--custom-shadow)';
        } else {
            el.style.removeProperty('color');
            el.style.removeProperty('text-shadow');
            if (STATE.dynamicStyleSheet && STATE.dynamicStyleSheet.innerText !== '') {
                el.style.animation = 'colorChange 40s infinite';
            } else {
                el.style.animation = 'none';
                el.style.color = CachedColorStyle.useLight ? CachedColorStyle.lightText : CachedColorStyle.darkText;
                el.style.textShadow = CachedColorStyle.useLight ? '0px 1px 3px rgba(0,0,0,0.6)' : '0px 1px 2px rgba(255,255,255,0.8)';
            }
        }
    });
}

// =============================================================================
// 7. 其他功能 (倒计时/语录/流星)
// =============================================================================
function padZero(num) { return num < 10 ? '0' + num : String(num); }

function initMeteorEffect() {
    const container = document.getElementById('meteor-container');
    if (!container) return;
    container.innerHTML = '';
    const count = Math.floor(Math.random() * 121) + 100;
    for (let i = 0; i < count; i++) {
        const m = document.createElement('div');
        m.className = 'meteor';
        const angle = Math.random() * 360;
        const len = 10 + Math.random() * 35;
        const dur = 0.8 + Math.random() * 6.2;
        const op = 0.3 + Math.random() * 0.5;
        const totalHeight = 28 + len;
        m.style.height = `${totalHeight}%`;
        m.style.width = `${1 + Math.random() * 2}px`;
        m.style.setProperty('--angle', `${angle}deg`);
        m.style.setProperty('--max-opacity', op);
        m.style.transform = `translate(-50%, -100%) rotate(${angle}deg)`;
        m.style.animation = `meteorFadeInOut ${dur}s infinite ease-in-out`;
        m.style.animationDelay = `-${Math.random() * 10}s`;
        const tp = (28 / totalHeight) * 100;
        m.style.background = `linear-gradient(to top, transparent ${tp}%, rgba(255,255,255,${op}) ${tp+15}%, rgba(255,255,255,${op}) 100%)`;
        container.appendChild(m);
    }
}

async function updateHitokoto(isInit) {
    const el = document.getElementById("hitokoto");
    if (!el) return;
    if (STATE.quotes.data.length === 0) {
        if (typeof localQuotesData !== 'undefined') STATE.quotes.data = [...localQuotesData].sort(() => Math.random() - 0.5);
        else return;
    }
    const item = STATE.quotes.data[STATE.quotes.index++ % STATE.quotes.data.length];
    const text = `${item.hitokoto} -- ${item.from || '佚名'}`;
    
    const type = (str) => {
        let i = 0; el.innerText = '';
        const timer = setInterval(() => {
            el.innerText += str.charAt(i++);
            if (i >= str.length) { clearInterval(timer); updateAutoColorElements(); }
        }, 100);
    };
    if (isInit) type(text);
    else {
        let old = el.innerText;
        const delTimer = setInterval(() => {
            if (old.length > 0) { old = old.slice(0, -1); el.innerText = old; } 
            else { clearInterval(delTimer); type(text); }
        }, 30);
    }
}

function syncTime() {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://worldtimeapi.org/api/timezone/Asia/Shanghai', true);
    xhr.onload = () => {
        if (xhr.status === 200) {
            try {
                STATE.serverTimeOffset = new Date(JSON.parse(xhr.responseText).utc_datetime).getTime() - Date.now();
                if (STATE.retryTimer) clearInterval(STATE.retryTimer);
            } catch(e) {}
        }
    };
    xhr.send();
}

function updateCountdown() {
    const now = new Date(Date.now() + (STATE.serverTimeOffset || 0));
    const currentYear = now.getFullYear();
    
    // 定义高考时间段
    const examDateStart = new Date(currentYear, 5, 7); 
    const examDateEnd = new Date(currentYear, 5, 9, 18, 0, 0);
    
    // 判断当前是否在高考进行中
    const isExamNow = now >= examDateStart && now <= examDateEnd;

    const fullContainer = document.getElementById("full-countdown-container");
    const orbitContainer = document.getElementById("orbit-countdown");
    const greeting = document.getElementById("greeting");

    // --- 场景 A: 状态切换检测 (高考中 <-> 倒计时) ---
    // 如果当前状态(考试中/倒计时)与上次渲染不一致，必须强制刷新 DOM 显示/隐藏
    if (isExamNow !== STATE.lastRendered.isExamTime) {
        STATE.lastRendered.isExamTime = isExamNow;
        
        if (isExamNow) {
            orbitContainer.style.display = 'none';
            fullContainer.style.display = 'none';
            greeting.style.display = 'block';
            greeting.innerText = "高考进行中，祝同学们金榜题名！";
            return; // 考试中不需要计算倒计时
        } else {
            greeting.style.display = 'none';
            // 恢复对应的倒计时容器显示
            if (CONFIG.countdownMode === 'days') {
                orbitContainer.style.display = 'block';
                fullContainer.style.display = 'none';
            } else {
                orbitContainer.style.display = 'none';
                fullContainer.style.display = 'block';
            }
            // 重置天数缓存，强制下文刷新一次数字
            STATE.lastRendered.days = null; 
        }
    }
    
    // 如果正在考试中，后续逻辑跳过
    if (isExamNow) return;

    // --- 场景 B: 计算倒计时数值 ---
    let target = examDateStart;
    let yearToShow = currentYear;
    if (now > examDateEnd) {
        target = new Date(currentYear + 1, 5, 7);
        yearToShow = currentYear + 1;
    }

    const timeDiff = target - now;

    // --- 场景 C: 根据模式更新 DOM ---
    
    if (CONFIG.countdownMode === 'days') {
        // 【性能优化核心】
        // 计算剩余天数 (向上取整)
        const days = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

        // 如果计算出的天数和上次渲染的一样，直接退出，不做任何 DOM 操作
        if (days === STATE.lastRendered.days) {
            return; 
        }

        // 只有变了才更新
        console.log(`刷新倒计时显示: ${days} 天`); // 调试用，你会发现这个log一天只出一次
        STATE.lastRendered.days = days;
        
        document.getElementById("orbit-day-number").innerText = days;
        document.getElementById("orbit-year").innerText = yearToShow;
        
    } else {
        // 精确模式：必须每秒更新，无法缓存
        const daysFloor = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        const hours = padZero(Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
        const minutes = padZero(Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60)));
        const seconds = padZero(Math.floor((timeDiff % (1000 * 60)) / 1000));

        document.getElementById("year").innerText = yearToShow;
        document.getElementById("days").innerText = daysFloor;
        document.getElementById("weeks").innerText = Math.floor(daysFloor / 7);
        document.getElementById("remaining-days").innerText = daysFloor % 7;
        document.getElementById("hours").innerText = hours;
        document.getElementById("minutes").innerText = minutes;
        document.getElementById("seconds").innerText = seconds;
    }
}

// =============================================================================
// 8. 初始化入口
// =============================================================================
window.STATE = STATE; 
document.addEventListener("DOMContentLoaded", () => {
    updateWallpaper();
    setInterval(updateWallpaper, CONFIG.refreshInterval);
    
    syncTime();
    STATE.retryTimer = setInterval(syncTime, 300000);
    setInterval(updateCountdown, 1000);
    
    initMeteorEffect();
    updateHitokoto(true);
    setInterval(() => updateHitokoto(false), 30000);
});