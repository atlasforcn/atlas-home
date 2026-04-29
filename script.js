// Smooth scrolling for navigation links
document.querySelectorAll('nav a').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        // Check if the hash starts with /atlas-home/ (for GitHub Pages project site)
        // or if it's just a local hash (for local development or root deployment)
        const baseUrl = window.location.origin + '/atlas-home/';
        let targetHash = this.hash;

        // Adjust hash for smooth scrolling if it's pointing to the current page's section
        if (this.href.startsWith(baseUrl) || this.href.startsWith(window.location.origin + '/')) {
            const path = new URL(this.href).pathname;
            const currentPath = window.location.pathname;

            // Only prevent default if it's an internal link on the same page
            if (path === currentPath || (path === baseUrl || path === '/') && currentPath === baseUrl) {
                e.preventDefault();
                if (targetHash !== '') {
                    const targetElement = document.querySelector(targetHash);
                    if (targetElement) {
                        targetElement.scrollIntoView({
                            behavior: 'smooth'
                        });
                    }
                }
            }
        }
    });
});


const SUMMARY_CHAR_LEN = 20;

/**
 * 目前頁面所在「目錄」的完整 URL（結尾為 /）。
 * 避免 pathname 像 /repo-name 沒有尾階斜線時，new URL('blog/x') 被解析成 /blog/x 而非 /repo-name/blog/x。
 */
function baseDirHref() {
    const u = new URL(window.location.href);
    let p = u.pathname;
    if (!p.endsWith('/')) {
        const last = p.split('/').pop() || '';
        if (/\.[a-zA-Z0-9]+$/.test(last)) {
            p = p.substring(0, p.lastIndexOf('/')) || '/';
        }
        if (!p.endsWith('/')) p += '/';
    }
    u.pathname = p;
    return u.href;
}

function blogUrl(path) {
    return new URL(path, baseDirHref()).href;
}

async function fetchBlogText(path) {
    const response = await fetch(blogUrl(path));
    if (!response.ok) throw new Error(`Could not load: ${path}`);
    return response.text();
}

/** 從 Markdown 取第一行 # 標題 */
function getTitleFromMarkdown(markdown) {
    const m = markdown.match(/^#\s+(.+)$/m);
    return m ? m[1].trim() : '未命名文章';
}

/** 取正文第一段純文字，截成前 SUMMARY_CHAR_LEN 字（用於首頁摘要） */
function getSummaryPlain(markdown) {
    const bodyMd = markdown.replace(/^#\s+.+$/m, '').trim();
    let text = '';
    try {
        if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
            const html = marked.parse(bodyMd);
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const p = doc.body.querySelector('p');
            text = p ? p.textContent.replace(/\s+/g, ' ').trim() : '';
        }
    } catch (e) {
        console.warn('marked 摘要失敗，改用純文字', e);
    }
    if (!text) {
        text = bodyMd.replace(/[#*`\[\]()_]/g, '').replace(/\s+/g, ' ').trim();
    }
    if (text.length > SUMMARY_CHAR_LEN) {
        return text.slice(0, SUMMARY_CHAR_LEN) + '…';
    }
    return text;
}

function stripLeadingH1(markdown) {
    return markdown.replace(/^#\s+.+$/m, '').trim();
}

async function loadPostFilenames() {
    try {
        const raw = await fetchBlogText('blog/posts.json');
        const data = JSON.parse(raw);
        if (Array.isArray(data.posts)) return data.posts;
        if (Array.isArray(data)) return data;
    } catch (e) {
        console.warn('blog/posts.json 無法讀取，使用預設清單', e);
    }
    return ['my-first-post.md', 'my-second-post.md'];
}

// Function to load and display blog post summaries on index.html
async function loadBlogPosts() {
    const blogPostsContainer = document.querySelector('#blog .blog-posts');
    if (!blogPostsContainer) return;

    blogPostsContainer.innerHTML = '';

    if (window.location.protocol === 'file:') {
        blogPostsContainer.innerHTML =
            '<p class="blog-error">瀏覽器無法在「直接開啟檔案」模式下載入 blog 文章。請在專案目錄執行 <code>python3 -m http.server</code>，再用 <code>http://localhost:8000/</code> 開啟網站。</p>';
        return;
    }

    const postFiles = await loadPostFilenames();
    if (!postFiles || postFiles.length === 0) {
        blogPostsContainer.innerHTML =
            '<p class="blog-error">沒有找到任何文章。請確認 `blog/posts.json` 內容是否正確。</p>';
        return;
    }

    const INITIAL_COUNT = 5; // 首頁只顯示最新幾篇
    const BATCH_COUNT = 5; // 每次「看更多」再多載入幾篇
    let nextIndex = 0;
    let totalLoaded = 0;

    const renderPosts = async (filenames) => {
        for (const filename of filenames) {
            let markdown;
            try {
                markdown = await fetchBlogText('blog/' + filename);
            } catch (e) {
                console.error(e);
                continue;
            }

            let title;
            let summary;
            try {
                title = getTitleFromMarkdown(markdown);
                summary = getSummaryPlain(markdown);
            } catch (e) {
                console.error(e);
                title = filename;
                summary = '（摘要產生失敗）';
            }

            // 相對連結，與 index 同層的 post.html，避免專案網址子路徑解析錯誤
            const href = 'post.html?post=' + encodeURIComponent(filename);

            const articleElement = document.createElement('article');
            articleElement.innerHTML = `
                <h3><a href="${href}">${title}</a></h3>
                <p class="post-excerpt">${summary}</p>
                <a href="${href}" class="read-more">閱讀更多</a>
            `;
            blogPostsContainer.appendChild(articleElement);
            totalLoaded += 1;
        }
    };

    // 建立「看更多」按鈕（如果文章不足一批就不顯示）
    const loadMoreBtn = document.createElement('button');
    loadMoreBtn.type = 'button';
    loadMoreBtn.id = 'blog-load-more';
    loadMoreBtn.className = 'blog-load-more-btn';
    loadMoreBtn.textContent = '看更多';

    blogPostsContainer.appendChild(loadMoreBtn);

    const initialSlice = postFiles.slice(0, INITIAL_COUNT);
    nextIndex = initialSlice.length;
    // 先把「初始文章」渲染出來
    // 注意：我們先不 append button 到底層清單外面，而是渲染後再把 button 留在後面（視覺上就是最後一個元素）
    blogPostsContainer.innerHTML = '';
    await renderPosts(initialSlice);
    if (totalLoaded === 0) {
        blogPostsContainer.innerHTML =
            '<p class="blog-error">沒有載入任何文章。請檢查 `blog/posts.json` 的檔名是否與 blog 資料夾內的 .md 一致。</p>';
        return;
    }
    if (nextIndex >= postFiles.length) {
        // 沒有更多文章
        return;
    }

    // 只有需要時才顯示按鈕
    blogPostsContainer.appendChild(loadMoreBtn);
    loadMoreBtn.addEventListener('click', async () => {
        if (loadMoreBtn.disabled) return;

        loadMoreBtn.disabled = true;
        const originalText = loadMoreBtn.textContent;
        loadMoreBtn.textContent = '載入中...';

        const batch = postFiles.slice(nextIndex, nextIndex + BATCH_COUNT);
        await renderPosts(batch);
        nextIndex += batch.length;

        loadMoreBtn.disabled = false;
        loadMoreBtn.textContent = originalText;

        if (nextIndex >= postFiles.length) {
            loadMoreBtn.remove();
        }
    });
}

// Function to display a single blog post on post.html
async function displayBlogPost() {
    const postTitleElement = document.getElementById('post-title');
    const postBodyElement = document.getElementById('post-body');

    if (!postTitleElement || !postBodyElement) return;

    const urlParams = new URLSearchParams(window.location.search);
    const postFilename = urlParams.get('post');

    if (postFilename) {
        if (window.location.protocol === 'file:') {
            postTitleElement.innerText = '無法載入';
            postBodyElement.innerHTML =
                '<p>請使用本機伺服器開啟網站（勿用檔案總管直接雙擊 HTML），才能讀取 blog 內的 Markdown。</p>';
            return;
        }
        try {
            const markdown = await fetchBlogText('blog/' + postFilename);
            postTitleElement.innerText = getTitleFromMarkdown(markdown);
            const bodyMd = stripLeadingH1(markdown);
            const html =
                typeof marked !== 'undefined' && typeof marked.parse === 'function'
                    ? marked.parse(bodyMd || markdown)
                    : '<pre>' + (bodyMd || markdown).replace(/</g, '&lt;') + '</pre>';
            postBodyElement.innerHTML = html;
        } catch (e) {
            console.error(e);
            postTitleElement.innerText = '文章未找到';
            postBodyElement.innerHTML = '<p>無法載入此文章。</p>';
        }
    } else {
        postTitleElement.innerText = '文章未找到';
        postBodyElement.innerHTML = '<p>請確認您是否有提供文章檔名。</p>';
    }
}

async function loadTimeline() {
    const container = document.getElementById('timeline-events');
    if (!container) return;

    container.innerHTML = '';

    if (window.location.protocol === 'file:') {
        container.innerHTML =
            '<p class="blog-error">時間軸需要透過本機伺服器載入 `timeline.json`。請用 <code>python3 -m http.server 8000</code> 啟動網站後再開啟。</p>';
        return;
    }

    try {
        const url = new URL('timeline.json', baseDirHref()).href;
        const raw = await fetch(url);
        if (!raw.ok) throw new Error(`HTTP ${raw.status}`);
        const data = await raw.json();
        const events = Array.isArray(data.events) ? data.events : (Array.isArray(data) ? data : []);

        if (events.length === 0) {
            container.innerHTML =
                '<p class="blog-error">找不到時間軸資料：`timeline.json` 內 events 為空。</p>';
            return;
        }

        // 由早到晚排列（較新的會在下方）
        events.sort((a, b) => {
            const ay = typeof a.startYear === 'number' ? a.startYear : (a.startYear || 0);
            const by = typeof b.startYear === 'number' ? b.startYear : (b.startYear || 0);
            if (ay !== by) return ay - by;

            const am = typeof a.startMonth === 'number' ? a.startMonth : (a.startMonth || 0);
            const bm = typeof b.startMonth === 'number' ? b.startMonth : (b.startMonth || 0);
            return am - bm;
        });

        const fragment = document.createDocumentFragment();

        for (const e of events) {
            const category = e.category || 'community';
            const categoryClass = `cat-${category}`;

            const item = document.createElement('div');
            item.className = `timeline-item ${categoryClass}`;

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'timeline-toggle';
            button.setAttribute('aria-expanded', 'false');

            const whenSpan = document.createElement('span');
            whenSpan.className = 'timeline-when';
            whenSpan.textContent = e.when || '';

            const titleSpan = document.createElement('span');
            titleSpan.className = 'timeline-title';
            titleSpan.textContent = e.title || '';

            const actionSpan = document.createElement('span');
            actionSpan.className = 'timeline-action';
            actionSpan.textContent = '展開';

            button.appendChild(whenSpan);
            button.appendChild(titleSpan);
            button.appendChild(actionSpan);

            const detailsDiv = document.createElement('div');
            detailsDiv.className = 'timeline-details';

            const detailHeading = document.createElement('div');
            detailHeading.className = 'timeline-detail-heading';
            detailHeading.textContent = '細節';
            detailsDiv.appendChild(detailHeading);

            const summaryP = document.createElement('p');
            summaryP.className = 'timeline-summary';
            summaryP.textContent = e.summary || '';
            detailsDiv.appendChild(summaryP);

            if (Array.isArray(e.details) && e.details.length > 0) {
                const ul = document.createElement('ul');
                ul.className = 'timeline-detail-list';
                for (const d of e.details) {
                    const li = document.createElement('li');
                    li.textContent = d;
                    ul.appendChild(li);
                }
                detailsDiv.appendChild(ul);
            }

            item.appendChild(button);
            item.appendChild(detailsDiv);

            button.addEventListener('click', () => {
                const isOpen = item.classList.contains('is-open');
                const allItems = container.querySelectorAll('.timeline-item');
                allItems.forEach((it) => {
                    const open = it === item ? !isOpen : false;
                    it.classList.toggle('is-open', open);
                    const btn = it.querySelector('.timeline-toggle');
                    const act = it.querySelector('.timeline-action');
                    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
                    if (act) act.textContent = open ? '收起' : '展開';
                });
            });

            fragment.appendChild(item);
        }

        container.appendChild(fragment);
    } catch (err) {
        console.error(err);
        container.innerHTML =
            '<p class="blog-error">時間軸載入失敗：請確認 `timeline.json` 是否存在且內容正確。</p>';
    }
}

async function loadTimelineMultiTrack() {
    const root = document.getElementById('timeline-mt');
    if (!root) return;

    const detailsPanel = document.getElementById('timeline-mt-details');
    if (detailsPanel) {
        detailsPanel.hidden = true;
    }

    root.innerHTML = '';

    if (window.location.protocol === 'file:') {
        root.innerHTML =
            '<p class="blog-error">時間軸需要透過本機伺服器載入 `timeline.json`，請用 <code>python3 -m http.server 8000</code> 啟動後再開啟。</p>';
        return;
    }

    try {
        const url = new URL('timeline.json', baseDirHref()).href;
        const raw = await fetch(url);
        if (!raw.ok) throw new Error(`HTTP ${raw.status}`);
        const data = await raw.json();

        const events = Array.isArray(data.events) ? data.events : (Array.isArray(data) ? data : []);
        if (events.length === 0) {
            root.innerHTML = '<p class="blog-error">找不到時間軸資料：`timeline.json` 的 events 為空。</p>';
            return;
        }

        const yearNumbersStart = events
            .map(e => (typeof e.startYear === 'number' ? e.startYear : null))
            .filter(v => v !== null);
        const yearNumbersEnd = events
            .map(e => {
                if (typeof e.endYear === 'number') return e.endYear;
                return typeof e.startYear === 'number' ? e.startYear : null;
            })
            .filter(v => v !== null);

        const YEAR_START = Math.min(...yearNumbersStart);
        const YEAR_MAX = Math.max(...yearNumbersEnd);
        const YEAR_END = YEAR_MAX + 1;
        const SPAN = YEAR_END - YEAR_START;
        if (!Number.isFinite(SPAN) || SPAN <= 0) throw new Error('Invalid year range');

        function pct(y) {
            return ((y - YEAR_START) / SPAN * 100).toFixed(4) + '%';
        }

        const TRACKS = [
            { id: 'achievement', label: '入選／里程碑', color: '#2f6f5e', colorVar: 'var(--tl-c-achievement)' },
            { id: 'project', label: '專案／工作', color: '#2f5f9e', colorVar: 'var(--tl-c-project)' },
            { id: 'job', label: '職涯／管理', color: '#6b5ca5', colorVar: 'var(--tl-c-job)' },
            { id: 'public_service', label: '公部門／訓練', color: '#b26a3c', colorVar: 'var(--tl-c-public_service)' },
            { id: 'community', label: '社群／協力', color: '#7a8f2a', colorVar: 'var(--tl-c-community)' },
        ];

        const TRACK_BY_ID = {};
        TRACKS.forEach(t => { TRACK_BY_ID[t.id] = t; });

        // Tooltip
        const tt = document.createElement('div');
        tt.className = 'tl-tooltip';
        root.appendChild(tt);

        // Year axis
        const yearRow = document.createElement('div');
        yearRow.className = 'tl-year-row';
        TRACKS; // keep reference
        for (let y = YEAR_START; y <= YEAR_END; y++) {
            const c = document.createElement('div');
            c.className = 'tl-year-cell';
            c.textContent = y;
            yearRow.appendChild(c);
        }
        root.appendChild(yearRow);

        // Decide shape
        function shapeOf(e) {
            const hasEnd = typeof e.endYear === 'number';
            if (hasEnd) return 'bar';
            const when = (e.when || '') + '';
            if (when.includes('起')) return 'bar';
            if (typeof e.startMonth === 'number') return 'bar';
            return 'dot';
        }

        function renderPeriod(e) {
            const sY = e.startYear;
            const sM = e.startMonth;
            const eY = e.endYear;
            const eM = e.endMonth;

            // If month precision exists, show month. Otherwise show year only.
            const start = (typeof sM === 'number') ? `${sY} 年 ${sM} 月` : `${sY} 年`;
            if (typeof eY === 'number') {
                if (typeof eM === 'number') {
                    return (start === `${eY} 年 ${eM} 月`) ? start : `${start} — ${eY} 年 ${eM} 月`;
                }
                return (start === `${eY} 年`) ? start : `${start} — ${eY} 年`;
            }
            // ongoing
            return whenTextOngoing(e, start);
        }

        function whenTextOngoing(e, start) {
            const when = (e.when || '');
            if (when && (when.includes('至今') || when.includes('起'))) return when;
            return start + ' — 至今';
        }

        function detailsHtml(e) {
            const details = Array.isArray(e.details) ? e.details : [];
            if (details.length === 0) return '';
            return '<ul class="tt-list">' + details.map(d => `<li>${d}</li>`).join('') + '</ul>';
        }

        function keywordsHtml(e, trackColorHex) {
            const tags = Array.isArray(e.keywords) ? e.keywords : [];
            if (!tags.length) return '';
            return `<div class="tt-tags">${tags.slice(0, 6).map(t =>
                `<span class="tt-tag" style="background:${trackColorHex}22;color:${trackColorHex}">${t}</span>`
            ).join('')}</div>`;
        }

        function move(e) {
            const r = root.getBoundingClientRect();
            const x = e.clientX - r.left + 14;
            const y = e.clientY - r.top + 14;
            tt.style.left = (x + 250 > r.width ? x - 260 : x) + 'px';
            tt.style.top = y + 'px';
        }

        function openDetailsPanel(e, track, period) {
            if (!detailsPanel) return;
            const title = e.title || '';
            const summary = e.summary ? `<div class="tt-panel-summary">${e.summary}</div>` : '';
            const list = detailsHtml(e);
            detailsPanel.hidden = false;
            detailsPanel.innerHTML = `
                <h3 class="tt-panel-title">細節</h3>
                <div class="tt-panel-meta"><span class="tt-panel-track" style="color:${track.colorVar}">${track.label}</span></div>
                <div class="tt-panel-headline">${title}</div>
                <div class="tt-panel-period">${period}</div>
                ${summary}
                ${list || '<div class="tt-panel-empty">（尚無補充細節）</div>'}
            `;
        }

        // Render tracks
        TRACKS.forEach(track => {
            const row = document.createElement('div');
            row.className = 'tl-row';

            const lbl = document.createElement('div');
            lbl.className = 'tl-row-label';
            lbl.textContent = track.label;
            row.appendChild(lbl);

            const canvas = document.createElement('div');
            canvas.className = 'tl-canvas';

            const axis = document.createElement('div');
            axis.className = 'tl-axis';
            canvas.appendChild(axis);

            const items = events
                .filter(ev => (ev.category || 'community') === track.id)
                .slice();

            // sort by startYear then startMonth
            items.sort((a, b) => {
                const ay = typeof a.startYear === 'number' ? a.startYear : 0;
                const by = typeof b.startYear === 'number' ? b.startYear : 0;
                if (ay !== by) return ay - by;
                const am = typeof a.startMonth === 'number' ? a.startMonth : 0;
                const bm = typeof b.startMonth === 'number' ? b.startMonth : 0;
                return am - bm;
            });

            items.forEach(ev => {
                const item = document.createElement('div');
                item.className = 'tl-item';
                item.dataset.shape = shapeOf(ev);
                item.style.left = pct(ev.startYear);

                const shape = item.dataset.shape;
                if (shape === 'bar') {
                    const endY = (typeof ev.endYear === 'number') ? ev.endYear : YEAR_END;
                    const w = ((endY - ev.startYear) / SPAN * 100).toFixed(4) + '%';
                    const bar = document.createElement('div');
                    bar.className = 'tl-bar' + ((typeof ev.endYear !== 'number') ? ' tl-bar-ongoing' : '');
                    bar.style.cssText = `width:${w}; background:${track.colorVar};`;
                    item.appendChild(bar);
                } else {
                    const dot = document.createElement('div');
                    dot.className = 'tl-dot';
                    dot.style.cssText = `background:${track.colorVar};`;
                    item.appendChild(dot);
                }

                const itemLabel = document.createElement('div');
                itemLabel.className = 'tl-item-label';
                itemLabel.textContent = ev.title || '';
                item.appendChild(itemLabel);

                const period = renderPeriod(ev);

                item.addEventListener('mouseenter', e => {
                    const keywords = keywordsHtml(ev, track.color);
                    const body = ev.summary || '';
                    tt.innerHTML = `
                        <div class="tt-track" style="color:${track.colorVar}">${track.label}</div>
                        <div class="tt-title">${ev.title || ''}</div>
                        <div class="tt-period">${period}</div>
                        <div class="tt-divider"></div>
                        <div class="tt-body">${body ? body : ''}${detailsHtml(ev)}</div>
                        ${keywords}
                    `;
                    tt.classList.add('visible');
                    move(e);
                });

                item.addEventListener('mousemove', move);
                item.addEventListener('mouseleave', () => tt.classList.remove('visible'));

                item.addEventListener('click', () => {
                    openDetailsPanel(ev, track, period);
                });

                canvas.appendChild(item);
            });

            row.appendChild(canvas);
            root.appendChild(row);
        });

        // Legend
        const legend = document.createElement('div');
        legend.className = 'tl-legend';
        TRACKS.forEach(t => {
            const el = document.createElement('div');
            el.className = 'tl-legend-item';
            el.innerHTML = `<div class="tl-legend-bar" style="background:${t.colorVar}"></div><span>${t.label}</span>`;
            legend.appendChild(el);
        });
        root.appendChild(legend);
    } catch (err) {
        console.error(err);
        root.innerHTML =
            '<p class="blog-error">時間軸載入失敗：請確認 `timeline.json` 是否存在且格式正確。</p>';
    }
}

// Initialize based on the current page
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('post-body')) {
        displayBlogPost();
    }
    if (document.querySelector('#blog .blog-posts')) {
        loadBlogPosts();
    }
    if (document.getElementById('timeline-mt')) {
        loadTimelineMultiTrack();
    }
});
