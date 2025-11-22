// gk.js — 最终重构版 (支持独立样式/动画/脚本)

// =============================================================================
// 1. 全局配置与状态
// =============================================================================
const CONFIG = {
    enableLocalWallpaper: true,   // 开关：本地/网络
    wallpaperMode: 'time',        // 模式：'time' (时间匹配) | 'random' (全局随机)
    currentTheme: 'default',      // 主题：对应 index.json 中的 key
    refreshInterval: 20 * 60000,  // 刷新间隔 (20分钟)
    useDynamicColor: true,        // 是否启用自动颜色提取 (当 json 未指定 style 时)
    countdownMode: 'days'         // 倒计时模式
};

// 运行时状态
const STATE = {
    serverTimeOffset: null,
    wallpaperConfig: null,
    isConfigLoading: false,
    currentImageConfig: null, // 当前壁纸的完整配置对象
    dynamicStyleSheet: null,  // 用于 ColorThief 的动态样式表
    themeStyleTag: null,      // 用于主题 baseCss 的 link 标签
    currentScriptTag: null,   // 用于当前壁纸 script 的 script 标签
    retryTimer: null,
    quotes: { data: [], index: 0 }
};

// 缓存颜色 (默认值)
let CachedColorStyle = {
    lightText: "rgba(255,255,255,0.95)",
    darkText: "rgba(0,0,0,0.85)",
    useLight: true,
    isManual: false // 标记是否是手动指定了颜色
};

// =============================================================================
// 2. 核心管线：配置加载 -> 壁纸选择 -> 资源加载 -> 样式应用
// =============================================================================

// 2.1 加载配置
async function loadThemeConfig() {
    if (STATE.wallpaperConfig) return STATE.wallpaperConfig;
    if (STATE.isConfigLoading) return null;
    STATE.isConfigLoading = true;

    try {
        const indexRes = await fetch('wallpaper/index.json');
        const indexData = await indexRes.json();
        const themeFolder = indexData.themes[CONFIG.currentTheme];
        if (!themeFolder) throw new Error(`主题未找到: ${CONFIG.currentTheme}`);

        const themeRes = await fetch(`wallpaper/${themeFolder}/theme.json`);
        const themeData = await themeRes.json();

        STATE.wallpaperConfig = {
            basePath: `wallpaper/${themeFolder}`,
            ...themeData
        };

        // 如果主题定义了通用 CSS，加载它
        if (STATE.wallpaperConfig.baseCss) {
            loadThemeCss(`${STATE.wallpaperConfig.basePath}/${STATE.wallpaperConfig.baseCss}`);
        }

        console.log(`主题 [${CONFIG.currentTheme}] 加载成功`);
        return STATE.wallpaperConfig;
    } catch (e) {
        console.error("配置加载失败:", e);
        return null;
    } finally {
        STATE.isConfigLoading = false;
    }
}

// 2.2 辅助：加载主题 CSS
function loadThemeCss(url) {
    if (STATE.themeStyleTag) STATE.themeStyleTag.remove();
    STATE.themeStyleTag = document.createElement('link');
    STATE.themeStyleTag.rel = 'stylesheet';
    STATE.themeStyleTag.href = url;
    document.head.appendChild(STATE.themeStyleTag);
}

// 2.3 选择壁纸
async function selectWallpaper() {
    const config = await loadThemeConfig();
    if (!config) return null;

    let candidates = [];

    if (CONFIG.wallpaperMode === 'random') {
        // 收集所有图片
        config.schedule.forEach(rule => {
            if (rule.images) rule.images.forEach(img => candidates.push({ ...img, folder: rule.folder }));
        });
    } else {
        // 按时间匹配
        const hour = new Date().getHours();
        let matchedRule = config.schedule.find(rule => 
            (rule.start > rule.end) ? (hour >= rule.start || hour < rule.end) : (hour >= rule.start && hour < rule.end)
        ) || config.schedule[0];

        if (matchedRule && matchedRule.images) {
            candidates = matchedRule.images.map(img => ({ ...img, folder: matchedRule.folder }));
        }
    }

    if (candidates.length === 0) return null;
    
    // 随机抽取
    const selection = candidates[Math.floor(Math.random() * candidates.length)];
    
    // 构建完整 URL
    let fullPath = config.basePath;
    if (selection.folder) fullPath += `/${selection.folder}`;
    fullPath += `/${selection.file}`;

    return { url: fullPath, config: selection };
}

// 2.4 更新壁纸主逻辑
async function updateWallpaper() {
    let wallpaperData = null;
    const img = new Image();
    
    // 获取壁纸信息
    if (CONFIG.enableLocalWallpaper) {
        wallpaperData = await selectWallpaper();
    }

    // 降级处理：如果没有本地壁纸，使用 Bing
    let imageUrl = wallpaperData ? wallpaperData.url : `https://api.paugram.com/bing?${Date.now()}`;
    // 只有网络图片才加 crossOrigin
    if (!wallpaperData) img.crossOrigin = "Anonymous";

    console.log(`切换壁纸: ${imageUrl}`);

    img.onload = async () => {
        // 1. 等待解码 (关键性能优化)
        if ('decode' in img) await img.decode().catch(() => {});

        // 2. 应用样式与特效 (核心重构点)
        applyWallpaperEffects(img, wallpaperData ? wallpaperData.config : null);

        // 3. 设置背景
        document.body.style.backgroundImage = `url('${imageUrl}')`;
    };

    img.src = imageUrl;
}

// =============================================================================
// 3. 样式与特效管理器 (核心逻辑)
// =============================================================================

function applyWallpaperEffects(imgElement, imgConfig) {
    // 3.1 重置旧状态
    document.body.className = ''; // 清除之前的 class
    if (STATE.currentScriptTag) { // 移除旧脚本
        STATE.currentScriptTag.remove();
        STATE.currentScriptTag = null;
    }
    
    // 3.2 判定是否手动指定了样式
    const manualStyle = imgConfig && imgConfig.style;
    STATE.currentImageConfig = imgConfig;
    CachedColorStyle.isManual = !!manualStyle;

    if (manualStyle) {
        // --- 模式 A: 手动样式 (优先) ---
        console.log("应用自定义样式配置");
        // 将手动配置转为 CachedColorStyle 格式，方便 unify 接口
        CachedColorStyle.useLight = true; // 默认，具体看 style.color
        CachedColorStyle.lightText = manualStyle.color || "white";
        CachedColorStyle.darkText = manualStyle.color || "black";
        
        // 移除可能的自动颜色动画
        if (STATE.dynamicStyleSheet) STATE.dynamicStyleSheet.innerText = '';
        
        // 如果配置了 textShadow，在这里生成一个临时的 CSS class 或者直接应用
        // 为了简单，我们依赖 updateAutoColorElements 读取 CachedColorStyle
        // 但 manualStyle 可能很复杂，我们直接通过 CSS 变量或内联样式处理会更灵活
        // 这里采用：将 manualStyle 存入 CSS 变量，CSS 中使用 var
        document.documentElement.style.setProperty('--custom-color', manualStyle.color || 'inherit');
        document.documentElement.style.setProperty('--custom-shadow', manualStyle.textShadow || 'none');
        
    } else {
        // --- 模式 B: 自动颜色提取 (ColorThief / Canvas) ---
        document.documentElement.style.removeProperty('--custom-color');
        document.documentElement.style.removeProperty('--custom-shadow');
        
        if (CONFIG.useDynamicColor) {
            runColorThief(imgElement);
        } else {
            runCanvasAnalysis(imgElement);
        }
    }

    // 3.3 应用 CSS Class (动画)
    if (imgConfig && imgConfig.class) {
        document.body.classList.add(imgConfig.class);
        console.log(`应用动画 Class: ${imgConfig.class}`);
    }

    // 3.4 加载独立脚本
    if (imgConfig && imgConfig.script) {
        loadCustomScript(`${STATE.wallpaperConfig.basePath}/${imgConfig.script}`);
    }

    // 3.5 刷新 DOM 元素颜色
    updateAutoColorElements();
}

function loadCustomScript(url) {
    const script = document.createElement('script');
    script.src = url;
    script.onload = () => console.log(`已加载独立特效: ${url}`);
    document.body.appendChild(script);
    STATE.currentScriptTag = script;
}

// =============================================================================
// 4. 颜色算法 (ColorThief / Canvas)
// =============================================================================

function runColorThief(img) {
    try {
        if (typeof ColorThief === 'undefined') throw new Error("No ColorThief");
        const colorThief = new ColorThief();
        const palette = colorThief.getPalette(img, 5);
        if (palette && palette.length > 0) {
            generateDynamicKeyframes(palette);
        }
        // 即使生成了流光动画，也需要计算一个基础亮度，决定背景是深是浅
        runCanvasAnalysis(img); 
    } catch (e) {
        runCanvasAnalysis(img); // 降级
    }
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

        if (isTransparent || count === 0) throw new Error("Canvas empty");
        
        const avgYIQ = totalYIQ / count;
        CachedColorStyle.useLight = avgYIQ < 128; // 暗背景->亮字
        
        // 如果不是手动模式，才更新文字颜色缓存
        if (!CachedColorStyle.isManual) {
            CachedColorStyle.lightText = "rgba(255,255,255,0.95)";
            CachedColorStyle.darkText = "rgba(0,0,0,0.85)";
        }

    } catch (e) {
        // 出错回退
        if (!CachedColorStyle.isManual) {
            CachedColorStyle.useLight = true;
            CachedColorStyle.lightText = "white";
        }
    }
}

function generateDynamicKeyframes(palette) {
    // 只有在非手动模式下才应用流光动画
    if (CachedColorStyle.isManual) return;

    const stops = [0, 25, 50, 75, 100];
    let content = '';
    const count = Math.min(4, palette.length);

    for (let i = 0; i < count; i++) {
        const [r, g, b] = palette[i];
        const yiq = (r*299 + g*587 + b*114) / 1000;
        // 智能调整阴影浓度
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

// 更新 DOM 元素的颜色
function updateAutoColorElements() {
    const elements = document.querySelectorAll('.auto-color');
    elements.forEach(el => {
        // 1. 如果是手动模式，使用 CSS 变量
        if (CachedColorStyle.isManual) {
            el.style.animation = 'none'; // 停止流光动画
            el.style.color = 'var(--custom-color)';
            el.style.textShadow = 'var(--custom-shadow)';
        } 
        // 2. 如果是自动模式
        else {
            el.style.removeProperty('color');
            el.style.removeProperty('text-shadow');
            
            // 恢复流光动画 (如果存在)
            if (STATE.dynamicStyleSheet && STATE.dynamicStyleSheet.innerText !== '') {
                el.style.animation = 'colorChange 40s infinite';
            } else {
                // 没有流光，使用静态 Canvas 颜色
                el.style.animation = 'none';
                el.style.color = CachedColorStyle.useLight ? CachedColorStyle.lightText : CachedColorStyle.darkText;
                el.style.textShadow = CachedColorStyle.useLight ? '0px 1px 3px rgba(0,0,0,0.6)' : '0px 1px 2px rgba(255,255,255,0.8)';
            }
        }
    });
}

// =============================================================================
// 5. 倒计时、语录、流星 (辅助功能)
// =============================================================================

// 流星特效
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
        
        m.style.height = `${28 + len}%`;
        m.style.width = `${1 + Math.random() * 2}px`;
        m.style.setProperty('--angle', `${angle}deg`);
        m.style.setProperty('--max-opacity', op);
        m.style.transform = `translate(-50%, -100%) rotate(${angle}deg)`;
        m.style.animation = `meteorFadeInOut ${dur}s infinite ease-in-out`;
        m.style.animationDelay = `-${Math.random() * 10}s`;
        
        const tp = (28 / (28 + len)) * 100;
        m.style.background = `linear-gradient(to top, transparent ${tp}%, rgba(255,255,255,${op}) ${tp+15}%, rgba(255,255,255,${op}) 100%)`;
        container.appendChild(m);
    }
}

// 语录
async function updateHitokoto(isInit) {
    const el = document.getElementById("hitokoto");
    if (!el) return;
    
    // 加载数据
    if (STATE.quotes.data.length === 0) {
        if (typeof localQuotesData !== 'undefined') {
            STATE.quotes.data = [...localQuotesData].sort(() => Math.random() - 0.5);
        } else {
            return;
        }
    }
    
    const item = STATE.quotes.data[STATE.quotes.index++ % STATE.quotes.data.length];
    const text = `${item.hitokoto} -- ${item.from || '佚名'}`;
    
    // 动画打字
    const type = (str) => {
        let i = 0; el.innerText = '';
        const timer = setInterval(() => {
            el.innerText += str.charAt(i++);
            if (i >= str.length) {
                clearInterval(timer);
                updateAutoColorElements(); // 确保新字应用样式
            }
        }, 100);
    };

    if (isInit) {
        type(text);
    } else {
        // 删除动画模拟
        let old = el.innerText;
        const delTimer = setInterval(() => {
            if (old.length > 0) {
                old = old.slice(0, -1);
                el.innerText = old;
            } else {
                clearInterval(delTimer);
                type(text);
            }
        }, 30);
    }
}

// 倒计时与时间
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
    const year = now.getFullYear();
    // 示例高考日期：6月7日
    let target = new Date(year, 5, 7);
    if (now > new Date(year, 5, 9, 18, 0, 0)) target = new Date(year + 1, 5, 7);
    
    const diff = target - now;
    const days = Math.ceil(diff / 86400000);
    
    // 仅展示 orbit 模式
    const orbitContainer = document.getElementById("orbit-countdown");
    const fullContainer = document.getElementById("full-countdown-container");
    const greeting = document.getElementById("greeting");
    
    if (now.getMonth() === 5 && now.getDate() >= 7 && now.getDate() <= 9) {
        orbitContainer.style.display = 'none';
        fullContainer.style.display = 'none';
        greeting.style.display = 'block';
        greeting.innerText = "高考进行中，加油！";
    } else {
        greeting.style.display = 'none';
        orbitContainer.style.display = 'block';
        fullContainer.style.display = 'none';
        
        document.getElementById("orbit-day-number").innerText = days;
        document.getElementById("orbit-year").innerText = target.getFullYear();
    }
}

// =============================================================================
// 6. 初始化
// =============================================================================
document.addEventListener("DOMContentLoaded", () => {
    // 启动核心循环
    updateWallpaper();
    setInterval(updateWallpaper, CONFIG.refreshInterval);
    
    // 启动时间与倒计时
    syncTime();
    STATE.retryTimer = setInterval(syncTime, 300000); // 5分钟校准
    setInterval(updateCountdown, 1000);
    
    // 启动特效
    initMeteorEffect();
    updateHitokoto(true);
    setInterval(() => updateHitokoto(false), 30000);
});
