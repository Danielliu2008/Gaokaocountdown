(function() {
    // ==========================================
    // 1. 强力清理旧元素 & 隐藏原生 Hitokoto
    // ==========================================
    const cleanStyle = document.createElement('style');
    // 注意：这里把 #hitokoto 也隐藏了，我们会用自定义的结构来显示它
    cleanStyle.innerHTML = `
        #orbit-countdown, #full-countdown-container, #orbit-day-number, 
        .orbit-text-path, #greeting, #meteor-container, #hitokoto {
            display: none !important;
        }
    `;
    document.head.appendChild(cleanStyle);

    const existingClock = document.getElementById('classic-clock-root');
    if (existingClock) existingClock.remove();

    // ==========================================
    // 2. 注入 CSS (含时钟与新版语录动画)
    // ==========================================
    const style = document.createElement('style');
    const fontPath = 'wallpaper/themes/shanghai_dream/fonts/Playfair Display/PlayfairDisplay-VariableFont_wght.ttf';
    const fontPath2 = 'wallpaper/themes/shanghai_dream/fonts/AbrilFatface-Regular.ttf';
    
    style.innerHTML = `
        @font-face {
            font-family: 'Playfair Local';
            src: url('${fontPath}') format('truetype');
            font-weight: 400 900;
        }
        @font-face {
            font-family: 'AbrilFatface';
            src: url('${fontPath2}') format('truetype');
            font-weight: 400 900;
        }

        /* --- 时钟基础样式 (保持不变) --- */
        #classic-clock-root {
            position: absolute;
            top: -29%; left: 50%;
            width: 450px; height: 450px;
            transform: translate(-50%, -50%) perspective(1000px) rotateX(5deg);
            z-index: 5;
            pointer-events: none;
        }
        .clock-glass-ring {
            position: absolute;
            top: 0; left: 0; width: 100%; height: 100%;
            border-radius: 50%;
            backdrop-filter: blur(5px); 
            -webkit-backdrop-filter: blur(5px);
            background: radial-gradient(circle, transparent 65%, rgba(0,0,0,0.4) 85%, rgba(0,0,0,0.6) 100%);
            border: 1px solid rgba(255, 215, 0, 0.3);
            box-shadow: 0 5px 20px rgba(0,0,0,0.3);
            -webkit-mask: radial-gradient(transparent 63%, black 64%);
            mask: radial-gradient(transparent 34%, black 64%);
            z-index: 1;
        }
        .clock-inner-border {
            position: absolute;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            width: 63%; height: 63%; 
            border-radius: 50%;
            border: 1px solid rgba(255, 215, 0, 0.8);
            z-index: 2;
        }
        .clock-num {
            position: absolute;
            width: 50px; height: 50px;
            top: 50%; left: 50%;
            margin-top: -25px; margin-left: -25px;
            text-align: center;
            line-height: 50px;
            font-family: 'Playfair Local', 'Times New Roman', serif;
            font-size: 36px;
            font-weight: 700; 
            color: rgba(255, 230, 150, 0.95); 
            text-shadow: 0 2px 5px rgba(0,0,0,0.8);
            z-index: 3;
        }
        .center-countdown {
            position: absolute;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            width: 260px; height: 260px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 20; 
            background: radial-gradient(circle, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 65%);
        }
        .countdown-val {
            font-family: 'AbrilFatface', serif;
            font-size: 150px; 
            line-height: 1;
            font-weight: 900;
            background: linear-gradient(45deg, #bf953f, #fcf6ba, #b38728, #fbf5b7);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            filter: drop-shadow(0 5px 10px rgba(0,0,0,0.9));
        }
        .countdown-label {
            font-family: 'Arial', sans-serif;
            font-size: 12px;
            letter-spacing: 4px;
            color: rgba(255, 255, 255, 0.5);
            text-transform: uppercase;
            margin-top: -10px;
        }
        /* 指针 */
        .hand-container {
            position: absolute; top: 50%; left: 50%; width: 0; height: 0; z-index: 10; 
            filter: drop-shadow(2px 2px 4px rgba(0,0,0,0.6));
        }
        .hand-hour-body {
            position: absolute; bottom: 0; left: -4px; width: 8px; height: 120px; 
            background: linear-gradient(90deg, #fff 0%, #ccc 50%, #fff 100%); border-radius: 4px 4px 0 0;
        }
        .hand-hour-deco {
            position: absolute; bottom: 25px; left: -10px; width: 20px; height: 20px;
            border: 3px solid #e0e0e0; transform: rotate(45deg);
        }
        .hand-hour-deco::after {
            content: ''; position: absolute; top: 15px; left: 6px; width: 4px; height: 25px; background: #e0e0e0; transform: rotate(-45deg);
        }
        .hand-min-body {
            position: absolute; bottom: 0; left: -2px; width: 4px; height: 180px; 
            background: linear-gradient(90deg, #FFD700 0%, #ffeaa7 50%, #FFD700 100%); border-radius: 2px 2px 0 0;
        }
        .hand-min-deco {
            position: absolute; bottom: 30px; left: -8px; width: 16px; height: 16px; border: 2px solid #FFD700; border-radius: 50%;
        }
        .hand-min-tail {
            position: absolute; top: 0; left: -1px; width: 2px; height: 40px; background: #FFD700; opacity: 0.8;
        }
        .center-nut {
            position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
            width: 12px; height: 12px; background: #fff; border: 2px solid #FFD700; border-radius: 50%; z-index: 15;
        }

        /* =========================================
           【核心新增】高级语录动画样式
           ========================================= */
        #custom-hitokoto-wrapper {
            position: absolute;
            bottom: -580%;
            left: 50%;
            transform: translateX(-50%);
            width: 80%;
            max-width: 900px;
            height: 60px; /* 固定高度，方便垂直居中 */
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 20;
            
            /* 两端淡出遮罩：中间10%-90%可见，两头渐变透明 */
            -webkit-mask: linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%);
            mask: linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%);
        }

        /* 内部动画容器 */
        .hitokoto-anim-box {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden; /* 保证文字被金线“切”出来 */
            
            /* 初始状态：宽度为0，表现为一根竖线 */
            width: 0px; 
            padding: 10px 0; /* 上下留白 */
            
            /* 左右金线 */
            border-left: 2px solid rgba(255, 215, 0, 0.8);
            border-right: 2px solid rgba(255, 215, 0, 0.8);
            background: rgba(0, 0, 0, 0.3); /* 淡淡的背景增加可读性 */
            
            white-space: nowrap; /* 强制不换行，为了拉开的效果 */
        }

        /* 文字样式 */
        .hitokoto-content-text {
            font-family: 'AbrilFatface', 'Songti SC', 'SimSun', serif;
            
            /* 稍微调整一下字号，因为 Abril Fatface 比较粗大，混排时视觉上需要平衡 */
            font-size: 20px; 
            letter-spacing: 1px; 
            
            color: rgba(255, 230, 150, 0.95);
            text-shadow: 0 1px 3px rgba(0,0,0,0.8);
            padding: 0 20px;
            opacity: 0;
        }

        /* --- 动画关键帧 --- */
        
        /* 1. 容器展开：从 0 到 100% 宽度 */
        @keyframes expandBox {
            0% { width: 0; border-color: rgba(255, 215, 0, 1); background: rgba(0,0,0,0.5); }
            100% { width: 100%; border-color: rgba(255, 215, 0, 0); /* 结束时边框淡出 */ background: rgba(0,0,0,0.2); }
        }
        
        /* 2. 文字浮现：稍微延迟一点出现 */
        @keyframes fadeInText {
            0% { opacity: 0; transform: scale(0.95); }
            100% { opacity: 1; transform: scale(1); }
        }

        /* 激活类：JS 每次更新时会添加这个类 */
        .hitokoto-anim-box.animate {
            animation: expandBox 2.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        
        .hitokoto-anim-box.animate .hitokoto-content-text {
            animation: fadeInText 1.5s ease-out 0.5s forwards; /* 延迟0.5s播放 */
        }

    `;
    document.head.appendChild(style);

    // ==========================================
    // 3. 构建时钟 DOM (略微简化，保持不变)
    // ==========================================
    const root = document.createElement('div');
    root.id = 'classic-clock-root';

    // 组装时钟部件...
    const glassRing = document.createElement('div'); glassRing.className = 'clock-glass-ring'; root.appendChild(glassRing);
    const innerBorder = document.createElement('div'); innerBorder.className = 'clock-inner-border'; root.appendChild(innerBorder);

    const arabicNumerals = ["12", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"];
    const dialRadius = 195; 
    arabicNumerals.forEach((numText, index) => {
        const numDiv = document.createElement('div');
        numDiv.className = 'clock-num';
        numDiv.innerText = numText;
        const angleRad = (index * 30 - 90) * (Math.PI / 180);
        numDiv.style.transform = `translate(${Math.cos(angleRad) * dialRadius}px, ${Math.sin(angleRad) * dialRadius}px)`;
        root.appendChild(numDiv);
    });

    const minContainer = document.createElement('div'); minContainer.className = 'hand-container';
    minContainer.innerHTML = `<div class="hand-min-tail"></div><div class="hand-min-deco"></div><div class="hand-min-body"></div>`;
    const hourContainer = document.createElement('div'); hourContainer.className = 'hand-container';
    hourContainer.innerHTML = `<div class="hand-hour-deco"></div><div class="hand-hour-body"></div>`;
    const nut = document.createElement('div'); nut.className = 'center-nut';
    root.appendChild(minContainer); root.appendChild(hourContainer); root.appendChild(nut);

    // 中心倒计时
    const centerCountdown = document.createElement('div'); centerCountdown.className = 'center-countdown';
    const now = new Date(); const currentYear = now.getFullYear();
    const examDate = new Date(currentYear, 5, 7);
    if (now > new Date(currentYear, 5, 9, 18, 0, 0)) examDate.setFullYear(currentYear + 1);
    const diff = examDate - now;
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    centerCountdown.innerHTML = `<div class="countdown-val">${days}</div><div class="countdown-label">DAYS LEFT</div>`;
    root.appendChild(centerCountdown);

    // 插入时钟
    const contentContainer = document.querySelector('.content') || document.body;
    contentContainer.appendChild(root);

    // ==========================================
    // 4. 构建并控制自定义 Hitokoto
    // ==========================================
    
    // 创建自定义语录容器
    const hitokotoWrapper = document.createElement('div');
    hitokotoWrapper.id = 'custom-hitokoto-wrapper';
    
    const hitokotoInner = document.createElement('div');
    hitokotoInner.className = 'hitokoto-anim-box';
    
    const hitokotoText = document.createElement('span');
    hitokotoText.className = 'hitokoto-content-text';
    hitokotoText.innerText = '正在获取...';
    
    hitokotoInner.appendChild(hitokotoText);
    hitokotoWrapper.appendChild(hitokotoInner);
    contentContainer.appendChild(hitokotoWrapper);

    // 监听原 #hitokoto 元素的变化 (gk.js 在更新数据时会修改原元素的 innerText)
    const originalHitokoto = document.getElementById('hitokoto');
    
    if (originalHitokoto) {
        // 创建观察器，一旦原文本变化，就触发我们的动画
        const observer = new MutationObserver(() => {
            const newText = originalHitokoto.innerText;
            
            // 1. 更新文字
            hitokotoText.innerText = newText;
            
            // 2. 重启动画 (移除 class -> 强制重绘 -> 添加 class)
            hitokotoInner.classList.remove('animate');
            void hitokotoInner.offsetWidth; // 触发 reflow
            hitokotoInner.classList.add('animate');
        });

        // 开始监听
        observer.observe(originalHitokoto, { childList: true, subtree: true, characterData: true });
        
        // 首次手动触发一次 (如果已有内容)
        if (originalHitokoto.innerText) {
            hitokotoText.innerText = originalHitokoto.innerText;
            hitokotoInner.classList.add('animate');
        }
    }

    // ==========================================
    // 5. 时钟动画循环
    // ==========================================
    function animate() {
        if (!document.getElementById('classic-clock-root')) return;
        const date = new Date();
        const minDeg = (date.getMinutes() * 6) + (date.getSeconds() * 0.1);
        const hourDeg = ((date.getHours() % 12) * 30) + (date.getMinutes() * 0.5);
        minContainer.style.transform = `rotate(${minDeg}deg)`;
        hourContainer.style.transform = `rotate(${hourDeg}deg)`;
        requestAnimationFrame(animate);
    }
    animate();
})();