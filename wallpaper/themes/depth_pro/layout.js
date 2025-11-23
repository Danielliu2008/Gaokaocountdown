(function() {

    /*--------------------------
      1. 读取配置
    ---------------------------*/
    const config = window.STATE?.currentImageConfig?.layoutConfig;
    if (!config) return;

    /*--------------------------
      2. 容器重建
    ---------------------------*/
    const containerId = 'custom-linear-layout';
    let container = document.getElementById(containerId);
    if (container) container.remove();

    container = document.createElement('div');
    container.id = containerId;
    document.body.appendChild(container);

    /*--------------------------
      3. 引导线
    ---------------------------*/
    const guideLine = document.createElement('div');
    guideLine.className = 'guide-line';
    container.appendChild(guideLine);

    /*--------------------------
      4. 天数计算
    ---------------------------*/
    let days = '---';
    const domEl = document.getElementById('orbit-day-number');

    if (domEl && domEl.textContent.trim() !== '0') {
        days = domEl.textContent;
    } else if (window.STATE?.lastRendered?.days) {
        days = window.STATE.lastRendered.days;
    } else {
        const now = new Date();
        let year = now.getFullYear();
        const exam = new Date(year, 5, 7);

        if (now > new Date(year, 5, 9, 18, 0, 0)) {
            exam.setFullYear(year + 1);
        }

        days = Math.ceil((exam - now) / (1000 * 60 * 60 * 24));
    }

    /*--------------------------
      5. 年份计算
    ---------------------------*/
    const now = new Date();
    let examYear = now.getFullYear();
    if (now > new Date(examYear, 5, 9, 18, 0, 0)) examYear++;

    /*--------------------------
      6. 竖排年份
    ---------------------------*/
    const yearEl = document.createElement('div');
    yearEl.className = 'vertical-year';
    yearEl.innerText = examYear;
    container.appendChild(yearEl);

    /*--------------------------
      7. 主文案
    ---------------------------*/
    const textGroup = document.createElement('div');
    textGroup.className = 'text-group';

    config.content.forEach(item => {
        const line = document.createElement('div');
        line.className = 'layout-line';

        line.innerText = item.text.replace('{days}', days);

        if (item.size) line.style.fontSize = item.size;
        if (item.color) line.style.color = item.color;
        if (item.font) line.style.fontFamily = item.font;
        if (item.marginTop) line.style.marginTop = item.marginTop;

        textGroup.appendChild(line);
    });

    container.appendChild(textGroup);

    /*--------------------------
      8. 搬运 hitokoto
    ---------------------------*/
    const originalHitokoto = document.getElementById('hitokoto');
    if (originalHitokoto) {
        document.body.appendChild(originalHitokoto);

        originalHitokoto.style.display = 'block';
        originalHitokoto.classList.add('moved-hitokoto');
    }

})();
