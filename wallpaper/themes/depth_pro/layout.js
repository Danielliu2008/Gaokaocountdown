(function() {
    // ----------------------------------------------------
    // 1. 标准布局渲染逻辑 (保持之前的代码不变)
    // ----------------------------------------------------
    const config = window.STATE && window.STATE.currentImageConfig && window.STATE.currentImageConfig.layoutConfig;
    if (!config) return;

    const containerId = 'custom-linear-layout';
    let container = document.getElementById(containerId);
    if (container) container.remove();

    container = document.createElement('div');
    container.id = containerId;
    container.style.zIndex = '5'; 
    document.body.appendChild(container);

    const guideLine = document.createElement('div');
    guideLine.className = 'guide-line';
    if (config.lineColor) guideLine.style.backgroundColor = config.lineColor;
    container.appendChild(guideLine);

    // --- 数据准备 ---
    let days = '---';
    const domEl = document.getElementById('orbit-day-number');
    if (domEl && domEl.textContent.trim() !== '0') {
        days = domEl.textContent;
    } else if (window.STATE && window.STATE.lastRendered && window.STATE.lastRendered.days) {
        days = window.STATE.lastRendered.days;
    } else {
        const now = new Date();
        const currentYear = now.getFullYear();
        const examDate = new Date(currentYear, 5, 7);
        if (now > new Date(currentYear, 5, 9, 18, 0, 0)) examDate.setFullYear(currentYear + 1);
        days = Math.ceil((examDate - now) / (1000 * 60 * 60 * 24));
    }

    const now = new Date();
    let examYear = now.getFullYear();
    if (now > new Date(examYear, 5, 9, 18, 0, 0)) examYear += 1;

    // --- 渲染组件 ---
    const yearEl = document.createElement('div');
    yearEl.className = 'vertical-year';
    yearEl.innerText = examYear;
    container.appendChild(yearEl);

    const textGroup = document.createElement('div');
    textGroup.className = 'text-group';
    
    config.content.forEach(item => {
        const line = document.createElement('div');
        line.className = 'layout-line';
        let content = item.text.replace('{days}', days);
        line.innerText = content;
        if (item.size) line.style.fontSize = item.size;
        if (item.color) line.style.color = item.color;
        if (item.font) line.style.fontFamily = item.font;
        if (item.isOverlay) {
            line.style.position = 'relative'; 
            line.style.marginTop = '-8vh';   
            line.style.right = '-2vh';       
            line.style.textAlign = 'right';  
            line.style.zIndex = '6';         
            line.style.pointerEvents = 'none'; 
        } else {
            if (item.marginTop) line.style.marginTop = item.marginTop;
        }
        textGroup.appendChild(line);
    });
    container.appendChild(textGroup);

    const originalHitokoto = document.getElementById('hitokoto');
    if (originalHitokoto) {
        // 1. 【关键】强制移动到 body 下，确保层级可以最高
        document.body.appendChild(originalHitokoto);
        
        // 2. 【关键】暴力清除 JS 添加的干扰样式和类名
        // 移除 auto-color 类，防止 gk.js 再次给它加颜色动画
        originalHitokoto.classList.remove('auto-color'); 
        // 移除内联样式 (animation, color, text-shadow 等统统干掉)
        originalHitokoto.removeAttribute('style');
        
        // 3. 重新添加我们需要的基础样式
        originalHitokoto.style.display = 'block';
        originalHitokoto.classList.add('moved-hitokoto');
    }

    // ----------------------------------------------------
    // 2. 【核心新增】注入主题专属的动画逻辑
    // ----------------------------------------------------
    
    // 保存原始的全局函数，防止切换主题时回不去（可选，如果只是单页应用可忽略）
    // const _originalUpdateHitokoto = window.updateHitokoto;


    // 动画锁
    let isMistAnimating = false;

    // 重写全局 window.updateHitokoto 函数
    window.updateHitokoto = async function(isInit) {
        const el = document.getElementById("hitokoto");
        if (!el) return;

        // 【修改】这里不要再调用 refreshColor 或 updateAutoColorElements 了
        // 因为我们希望样式完全由 theme.css 控制，不需要主程序的自动颜色

        if (isMistAnimating && !isInit) return;

        // 获取数据
        if (window.STATE.quotes.data.length === 0) {
            if (typeof localQuotesData !== 'undefined') {
                window.STATE.quotes.data = [...localQuotesData].sort(() => Math.random() - 0.5);
            } else { return; }
        }
        const item = window.STATE.quotes.data[window.STATE.quotes.index++ % window.STATE.quotes.data.length];
        const newText = `${item.hitokoto} -- ${item.from || '佚名'}`;

        // 场景 A: 初始加载
        if (isInit) {
            el.innerText = newText;
            el.classList.remove('hitokoto-fade-out');
            return; // 直接返回，不加颜色
        }

        // 场景 B: 迷雾动画流程
        isMistAnimating = true;
        el.classList.add('hitokoto-fade-out');

        setTimeout(() => {
            el.innerText = newText;
            // 【修改】删除了 refreshColor() 调用
            
            el.classList.add('hitokoto-ready-in');
            el.classList.remove('hitokoto-fade-out');
            void el.offsetWidth;
            el.classList.remove('hitokoto-ready-in');

            setTimeout(() => {
                isMistAnimating = false;
            }, 1200);
        }, 1200);
    };

    console.log("[Depth Pro] 专属迷雾动画已注入");

})();