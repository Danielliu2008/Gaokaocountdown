(function() {
    // 1. 获取配置
    const config = window.STATE && window.STATE.currentImageConfig && window.STATE.currentImageConfig.layoutConfig;
    if (!config) return;

    // 2. 准备容器
    const containerId = 'custom-linear-layout';
    let container = document.getElementById(containerId);
    if (container) container.remove();

    container = document.createElement('div');
    container.id = containerId;
    container.style.zIndex = '5'; 
    document.body.appendChild(container);

    // 3. 渲染引导线
    const guideLine = document.createElement('div');
    guideLine.className = 'guide-line';
    if (config.lineColor) guideLine.style.backgroundColor = config.lineColor;
    container.appendChild(guideLine);

    // 4. 数据准备 (倒计时 & 年份)
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

    // 5. 渲染组件
    // A. 竖排年份
    const yearEl = document.createElement('div');
    yearEl.className = 'vertical-year';
    yearEl.innerText = examYear;
    container.appendChild(yearEl);

    // B. 文字组 (主倒计时)
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

    // 【核心修改】C. 搬运原有的一言元素
    // 不再创建新的div，而是把原有的 #hitokoto 移动过来
    const originalHitokoto = document.getElementById('hitokoto');
    if (originalHitokoto) {
        // 1. 不要 appendChild 到 container，而是直接 append 到 body
        // 这样它就脱离了 z-index: 5 的父容器限制，可以直接和 z-index: 10 的山峰 PK
        document.body.appendChild(originalHitokoto);
        
        // 2. 样式处理保持不变
        originalHitokoto.style.display = 'block';
        originalHitokoto.style.marginTop = '0'; 
        originalHitokoto.classList.add('moved-hitokoto');
    }

})(); // 脚本结束