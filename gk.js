// gk.js — 最终重构版 (支持独立样式/动画/脚本)

// =============================================================================
// 1. 全局配置与状态
// =============================================================================
const CONFIG = {
    enableLocalWallpaper: true,   // 开关：本地/网络
    wallpaperMode: 'time',        // 模式：'time' (时间匹配) | 'random' (全局随机)
    currentTheme: 'depth_pro',      // 主题：对应 index.json 中的 key
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

//定义路径
const PATHS = {
    root: 'wallpaper',
    themeRoot: '' // 动态加载
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
        // A. 读取总入口 index.json
        const indexRes = await fetch(`${PATHS.root}/index.json`);
        const indexData = await indexRes.json();
        
        // 获取当前激活的主题路径
        const activeKey = indexData.active;
        const relativeThemePath = indexData.list[activeKey];
        
        if (!relativeThemePath) throw new Error(`未找到主题定义: ${activeKey}`);

        // 设置当前主题的物理根路径 (例如: wallpaper/themes/depth_pro)
        PATHS.themeRoot = `${PATHS.root}/${relativeThemePath}`;

        // B. 读取具体主题配置 theme.json
        const themeRes = await fetch(`${PATHS.themeRoot}/theme.json`);
        const themeData = await themeRes.json();

        // 存储配置
        STATE.wallpaperConfig = themeData;

        // C. 加载主题通用 CSS (如果有)
        if (themeData.meta && themeData.meta.css) {
            const cssPath = `${PATHS.themeRoot}/${themeData.meta.css}`;
            loadThemeCss(cssPath);
        }

        console.log(`主题 [${themeData.meta.name}] 加载完毕`);
        return STATE.wallpaperConfig;

    } catch (e) {
        console.error("配置加载链失败:", e);
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

    const hour = new Date().getHours();
    let candidates = [];

    // 遍历 schedule
    config.schedule.forEach(rule => {
        // 1. 判断时间匹配
        let isMatch = false;
        
        if (CONFIG.wallpaperMode === 'random') {
            // 随机模式：忽略时间，所有配置都加入候选
            isMatch = true;
        } else {
            // Time/Rule 模式：严格匹配时间段
            const [start, end] = rule.time;
            isMatch = (start > end) 
                ? (hour >= start || hour < end) // 跨夜 (如 18点 到 6点)
                : (hour >= start && hour < end); // 正常 (如 6点 到 18点)
        }

        // 2. 如果匹配，将该规则下的 items 加入候选池
        if (isMatch && rule.items && rule.items.length > 0) {
            candidates = candidates.concat(rule.items);
        }
    });

    if (candidates.length === 0) {
        console.warn("当前时间段未找到匹配的壁纸配置");
        return null;
    }

    // B. 随机抽取一张
    const selection = candidates[Math.floor(Math.random() * candidates.length)];

    // C. 路径拼接逻辑 (简化版)
    // 逻辑：最终路径 = wallpaper/themes/{主题名} + / + {json里配置的src}
    
    const makePath = (relativePath) => {
        // PATHS.themeRoot 已经在 loadThemeConfig 中被设置为 "wallpaper/themes/主题名"
        // 我们只需要简单地拼接，不再需要中间的 folder 变量
        return `${PATHS.themeRoot}/${relativePath}`;
    };

    let layersToRender = [];

    if (selection.type === 'layers') {
        // 多层模式
        layersToRender = selection.layers.map(layer => ({
            src: makePath(layer.src),
            z: layer.z
        }));
    } else {
        // 单图模式 (兼容旧配置，如果未写 type 默认为单图)
        layersToRender = [{
            src: makePath(selection.src),
            z: 1
        }];
    }

    // 返回结果
    return {
        layers: layersToRender,
        config: selection // 包含 style, script, desc, class 等
    };
}

// 2.4 更新壁纸主逻辑
async function updateWallpaper() {
    let selection = null;
    
    // 1. 获取壁纸配置
    if (CONFIG.enableLocalWallpaper) {
        selection = await selectWallpaper(); // 使用之前的选择逻辑
    }

    // 2. 准备图层数据
    // 统一格式：无论是单图还是多层，都转化为数组处理
    let layersToRender = [];
    let baseImageUrl = ''; // 用于 ColorThief 取色
    let isMultiLayer = false;

    if (selection && selection.config.layers) {
        // --- 模式 A: 多层模式 ---
        isMultiLayer = true;
        // 构建路径
        layersToRender = selection.config.layers.map(layer => ({
            src: `${selection.urlBase}/${layer.file}`,
            z: layer.z
        }));
        
        // 找到 z-index 最小的层作为取色基准
        const bgLayer = layersToRender.reduce((prev, curr) => (prev.z < curr.z ? prev : curr));
        baseImageUrl = bgLayer.src;

    } else if (selection) {
        // --- 模式 B: 单图模式 (本地) ---
        const fullPath = `${selection.urlBase}/${selection.config.file}`;
        layersToRender = [{ src: fullPath, z: 1 }]; // 默认 z=1
        baseImageUrl = fullPath;

    } else {
        // --- 模式 C: 网络兜底 ---
        const bingUrl = `https://api.paugram.com/bing?${Date.now()}`;
        layersToRender = [{ src: bingUrl, z: 1 }];
        baseImageUrl = bingUrl;
    }

    console.log(`准备渲染壁纸 (层数: ${layersToRender.length})`);

    // 3. 预加载所有图层
    // 我们创建一个 Promise 数组，确保所有层都加载完再插入 DOM
    const imagePromises = layersToRender.map(layer => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            if (!selection) img.crossOrigin = "Anonymous"; // 网络图片跨域
            img.src = layer.src;
            img.onload = () => {
                // 尝试解码
                if ('decode' in img) img.decode().catch(()=>{}); 
                resolve({ element: img, z: layer.z, src: layer.src });
            };
            img.onerror = () => {
                console.warn(`图层加载失败: ${layer.src}`);
                resolve(null); // 失败也resolve，防止整个壁纸卡死
            };
        });
    });

    // 4. 等待加载完成并渲染
    try {
        const loadedImages = await Promise.all(imagePromises);
        const validImages = loadedImages.filter(item => item !== null);

        // 4.1 应用颜色和特效 (使用 baseImage)
        // 我们临时创建一个 img 对象给 ColorThief 用
        const baseImgElement = new Image();
        if (!selection) baseImgElement.crossOrigin = "Anonymous";
        baseImgElement.src = baseImageUrl;
        // 注意：这里直接传 src 也可以，但为了兼容之前的 applyWallpaperEffects 接口：
        applyWallpaperEffects(baseImgElement, selection ? selection.config : null);

        // 4.2 渲染到 DOM
        renderLayersToDOM(validImages);

    } catch (e) {
        console.error("壁纸渲染管线异常:", e);
    }
}

// 辅助：渲染图层到 #wallpaper-layers 容器
function renderLayersToDOM(imagesData) {
    const container = document.getElementById('wallpaper-layers');
    if (!container) return;

    // 策略：为了实现平滑过渡，我们创建一组新图层，盖在旧图层上面，然后淡出旧图层
    // 但为了简化逻辑且避免 DOM 爆炸，这里采用：清空 -> 插入
    // 如果需要极致平滑，可以使用双缓冲容器。这里使用简单的清空重绘。
    
    // 清除旧背景 (防止透明图层叠加导致重影)
    container.innerHTML = '';
    document.body.style.backgroundImage = 'none'; // 清除旧版 body 背景

    imagesData.forEach(data => {
        const imgDiv = document.createElement('img');
        imgDiv.src = data.src;
        imgDiv.className = 'wp-layer';
        imgDiv.style.zIndex = data.z;
        
        // 简单的入场动画
        imgDiv.style.opacity = '0';
        container.appendChild(imgDiv);
        
        // 强制重排后显示，触发 transition
        requestAnimationFrame(() => {
            imgDiv.style.opacity = '1';
        });
    });
}

// =============================================================================
// 3. 样式与特效管理器 (核心逻辑)
// =============================================================================

function applyWallpaperEffects(imgElement, imgConfig) {
    // 1. 重置旧状态 (关键步骤)
    // 这行代码会移除 body 上所有的 class，防止上一个主题的样式残留
    document.body.className = ''; 
    
    // 如果有旧的脚本标签，移除它
    if (STATE.currentScriptTag) { 
        STATE.currentScriptTag.remove();
        STATE.currentScriptTag = null;
    }
    
    // 2. 保存当前配置状态
    STATE.currentImageConfig = imgConfig;
    const manualStyle = imgConfig && imgConfig.style;
    CachedColorStyle.isManual = !!manualStyle;

    // 3. 应用 CSS Class (这里就是实现你需求的地方)
    // 检查 theme.json 里是否配置了 "class": "mountains-style"
    if (imgConfig && imgConfig.class) {
        document.body.classList.add(imgConfig.class);
        console.log(`已注入 CSS Class: ${imgConfig.class}`);
    }

    // 4. 处理手动样式 (style 字段)
    if (manualStyle) {
        console.log("应用自定义内联样式配置");
        // 设置 CSS 变量，方便在 CSS 文件中通过 var(--custom-color) 调用
        document.documentElement.style.setProperty('--custom-color', manualStyle.color || 'inherit');
        document.documentElement.style.setProperty('--custom-shadow', manualStyle.textShadow || 'none');
        
        // 同时更新缓存对象，用于 updateAutoColorElements
        CachedColorStyle.useLight = true; 
        CachedColorStyle.lightText = manualStyle.color || "white";
        CachedColorStyle.darkText = manualStyle.color || "black";
        
        // 清除可能存在的流光动画样式
        if (STATE.dynamicStyleSheet) STATE.dynamicStyleSheet.innerText = '';
        
    } else {
        // 如果没有手动样式，清理变量并执行自动取色
        document.documentElement.style.removeProperty('--custom-color');
        document.documentElement.style.removeProperty('--custom-shadow');
        
        if (CONFIG.useDynamicColor) {
            runColorThief(imgElement);
        } else {
            runCanvasAnalysis(imgElement);
        }
    }

    // 5. 加载独立脚本 (script 字段)
    if (imgConfig && imgConfig.script) {
        // 拼接完整路径: wallpaper/themes/depth_pro/rain.js
        const scriptPath = `${PATHS.themeRoot}/${imgConfig.script}`;
        loadCustomScript(scriptPath);
    }

    // 6. 刷新页面上的文字颜色
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
    const count = Math.floor(Math.random() * 360) + 150;
    
    for (let i = 0; i < count; i++) {
        const m = document.createElement('div');
        m.className = 'meteor';
        const angle = Math.random() * 360;
        const len = 10 + Math.random() * 35;
        const dur = 0.8 + Math.random() * 6.2;
        const op = 0.3 + Math.random() * 0.5;
        
        m.style.height = `${28 + len}%`;
        m.style.width = `${1 + Math.random() * 3}px`;
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
