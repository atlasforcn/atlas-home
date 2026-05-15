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
                    if ((targetHash === '#resume' || targetHash === '#blog') && typeof switchProfileTab === 'function') {
                        switchProfileTab(targetHash.slice(1), false);
                    }
                    const targetElement = targetHash === '#resume' || targetHash === '#blog'
                        ? document.getElementById('profile-tabs')
                        : document.querySelector(targetHash);
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

async function loadTimelineData() {
    const embedded = document.getElementById('timeline-data');
    const embeddedText = embedded && embedded.textContent.trim();

    if (window.location.protocol === 'file:' && embeddedText) {
        return JSON.parse(embeddedText);
    }

    try {
        const url = new URL('timeline.json', baseDirHref()).href;
        const raw = await fetch(url);
        if (!raw.ok) throw new Error(`HTTP ${raw.status}`);
        return raw.json();
    } catch (err) {
        if (embeddedText) return JSON.parse(embeddedText);
        throw err;
    }
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
            '<p class="blog-error">目前沒有文章。可以先檢查 `blog/posts.json` 裡的清單。</p>';
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
            '<p class="blog-error">文章沒有載入成功。可以檢查 `blog/posts.json` 的檔名，是否和 blog 資料夾裡的 .md 檔一致。</p>';
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
                '<p>要讀取 blog 裡的 Markdown，請用本機伺服器開啟網站，不要直接雙擊 HTML 檔。</p>';
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
        postBodyElement.innerHTML = '<p>網址裡沒有指定文章檔名。</p>';
    }
}

async function loadTimeline() {
    const container = document.getElementById('timeline-events');
    if (!container) return;

    container.innerHTML = '';

    try {
        const data = await loadTimelineData();
        const events = Array.isArray(data.events) ? data.events : (Array.isArray(data) ? data : []);

        if (events.length === 0) {
            container.innerHTML =
                '<p class="blog-error">找不到時間軸資料：`timeline.json` 裡的 events 是空的。</p>';
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
            '<p class="blog-error">時間軸載入失敗。可以檢查 `timeline.json` 是否存在，內容是否能被讀取。</p>';
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

    try {
        const data = await loadTimelineData();

        const events = Array.isArray(data.events) ? data.events : (Array.isArray(data) ? data : []);
        if (events.length === 0) {
            root.innerHTML = '<p class="blog-error">找不到時間軸資料：`timeline.json` 裡的 events 是空的。</p>';
            return;
        }

        const TRACKS = [
            { id: 'space', label: '太空／通訊', color: '#2f5f9e' },
            { id: 'security', label: '資安／韌性', color: '#6b5ca5' },
            { id: 'education', label: '學習／研究', color: '#2f6f5e' },
            { id: 'community', label: '社群／協力', color: '#6f8529' },
            { id: 'public_service', label: '公共／國際', color: '#b26a3c' },
            { id: 'achievement', label: '競賽／里程碑', color: '#8a7f6a' },
        ];

        const TRACK_BY_ID = {};
        TRACKS.forEach(t => { TRACK_BY_ID[t.id] = t; });

        const validEvents = events
            .filter(e => typeof e.startYear === 'number')
            .map(e => {
                const category = TRACK_BY_ID[e.category] ? e.category : 'community';
                return { ...e, category };
            });

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
            const when = (e.when || '').trim();
            if (when) return when;
            return start;
        }

        function escapeHtml(value) {
            return String(value || '').replace(/[&<>"']/g, ch => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[ch]));
        }

        function detailsHtml(e) {
            const details = Array.isArray(e.details) ? e.details : [];
            if (details.length === 0) return '';
            return '<ul class="tt-list">' + details.map(d => `<li>${escapeHtml(d)}</li>`).join('') + '</ul>';
        }

        function keywordsHtml(e, trackColorHex, limit = 5) {
            const tags = Array.isArray(e.keywords) ? e.keywords : [];
            if (!tags.length) return '';
            return `<div class="tt-tags">${tags.slice(0, limit).map(t =>
                `<span class="tt-tag" style="background:${trackColorHex}22;color:${trackColorHex}">${escapeHtml(t)}</span>`
            ).join('')}</div>`;
        }

        function sortEvents(list) {
            return list.slice().sort((a, b) => {
                const ay = typeof a.startYear === 'number' ? a.startYear : 0;
                const by = typeof b.startYear === 'number' ? b.startYear : 0;
                if (ay !== by) return by - ay;
                const am = typeof a.startMonth === 'number' ? a.startMonth : 0;
                const bm = typeof b.startMonth === 'number' ? b.startMonth : 0;
                return bm - am;
            });
        }

        const tabs = document.createElement('nav');
        tabs.className = 'tl-tabs';
        tabs.setAttribute('aria-label', '時間軸分類');

        const list = document.createElement('div');
        list.className = 'tl-list';

        function makeTab(id, label, color, count) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'tl-tab' + (id === 'all' ? ' active' : '');
            btn.dataset.id = id;
            btn.innerHTML = `<span>${escapeHtml(label)}</span><span class="tl-tab-count">${count}</span>`;
            if (color) btn.style.setProperty('--tl-tab-color', color);
            btn.addEventListener('click', () => setActive(id));
            tabs.appendChild(btn);
        }

        function buildCard(ev) {
            const track = TRACK_BY_ID[ev.category] || TRACK_BY_ID.community;
            const period = renderPeriod(ev);
            const article = document.createElement('article');
            article.className = 'tl-card';
            article.dataset.category = ev.category;
            article.style.setProperty('--tl-card-color', track.color);
            article.tabIndex = 0;
            article.setAttribute('role', 'button');
            article.setAttribute('aria-expanded', 'false');

            const details = detailsHtml(ev);
            const summary = ev.summary ? `<p class="tl-card-summary">${escapeHtml(ev.summary)}</p>` : '';
            const tags = keywordsHtml(ev, track.color, 4);
            article.innerHTML = `
                <div class="tl-card-marker" aria-hidden="true"></div>
                <div class="tl-card-body">
                    <div class="tl-card-meta">
                        <span class="tl-card-period">${escapeHtml(period)}</span>
                        <span class="tl-card-chip">${escapeHtml(track.label)}</span>
                    </div>
                    <h3 class="tl-card-title">${escapeHtml(ev.title || '')}</h3>
                    ${summary}
                    ${tags}
                    ${details ? `<div class="tl-card-details" hidden>${details}</div>` : ''}
                    <button class="tl-card-more" type="button" aria-expanded="false">${details ? '展開細節' : '標記重點'}</button>
                </div>
            `;

            const button = article.querySelector('.tl-card-more');
            const detailBlock = article.querySelector('.tl-card-details');

            function toggleCard() {
                if (!detailBlock) {
                    article.classList.toggle('is-highlighted');
                    const highlighted = article.classList.contains('is-highlighted');
                    article.setAttribute('aria-expanded', highlighted ? 'true' : 'false');
                    button.setAttribute('aria-expanded', highlighted ? 'true' : 'false');
                    return;
                }

                const open = detailBlock.hidden;
                detailBlock.hidden = !open;
                article.classList.toggle('is-open', open);
                article.setAttribute('aria-expanded', open ? 'true' : 'false');
                button.setAttribute('aria-expanded', open ? 'true' : 'false');
                button.textContent = open ? '收起細節' : '展開細節';
            }

            article.addEventListener('click', toggleCard);
            article.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    toggleCard();
                }
            });
            button.addEventListener('click', event => {
                event.stopPropagation();
                toggleCard();
            });

            return article;
        }

        function renderList(activeId = 'all') {
            const filtered = activeId === 'all'
                ? validEvents
                : validEvents.filter(ev => ev.category === activeId);

            const grouped = new Map();
            sortEvents(filtered).forEach(ev => {
                const year = ev.startYear;
                if (!grouped.has(year)) grouped.set(year, []);
                grouped.get(year).push(ev);
            });

            list.innerHTML = '';
            Array.from(grouped.entries()).forEach(([year, yearEvents]) => {
                const group = document.createElement('section');
                group.className = 'tl-year-group';

                const yearLabel = document.createElement('div');
                yearLabel.className = 'tl-year-label';
                yearLabel.textContent = year;
                group.appendChild(yearLabel);

                const cards = document.createElement('div');
                cards.className = 'tl-year-cards';
                yearEvents.forEach(ev => cards.appendChild(buildCard(ev)));
                group.appendChild(cards);

                list.appendChild(group);
            });
        }

        function setActive(id) {
            tabs.querySelectorAll('.tl-tab').forEach(btn => {
                const active = btn.dataset.id === id;
                btn.classList.toggle('active', active);
            });
            renderList(id);
        }

        makeTab('all', '全部', '', validEvents.length);
        TRACKS.forEach(track => {
            const count = validEvents.filter(ev => ev.category === track.id).length;
            makeTab(track.id, track.label, track.color, count);
        });
        renderList('all');
        root.appendChild(tabs);
        root.appendChild(list);
    } catch (err) {
        console.error(err);
        root.innerHTML =
            '<p class="blog-error">時間軸載入失敗。可以檢查 `timeline.json` 是否存在，格式是否正確。</p>';
    }
}

async function loadAwardsProjectsTimeline() {
    const root = document.getElementById('awards-projects-timeline');
    if (!root) return;

    root.innerHTML = '';

    try {
        const data = await loadTimelineData();
        const items = Array.isArray(data.awardsProjects) ? data.awardsProjects : [];
        if (!items.length) {
            root.innerHTML = '<p class="blog-error">目前還沒有得獎與專案資料。</p>';
            return;
        }

        const sorted = items.slice().sort((a, b) => {
            const ay = Number(a.year) || 0;
            const by = Number(b.year) || 0;
            if (ay !== by) return by - ay;
            return String(a.title || '').localeCompare(String(b.title || ''), 'zh-Hant');
        });

        const grouped = new Map();
        sorted.forEach(item => {
            const year = Number(item.year) || '其他';
            if (!grouped.has(year)) grouped.set(year, []);
            grouped.get(year).push(item);
        });

        const typeLabel = { award: '得獎', project: '專案' };
        const typeColor = { award: '#b26a3c', project: '#2f5f9e' };

        function escapeHtml(value) {
            return String(value || '').replace(/[&<>"']/g, ch => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[ch]));
        }

        function tagsHtml(tags) {
            if (!Array.isArray(tags) || !tags.length) return '';
            return `<div class="ap-tags">${tags.slice(0, 4).map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}</div>`;
        }

        const fragment = document.createDocumentFragment();
        grouped.forEach((yearItems, year) => {
            const group = document.createElement('section');
            group.className = 'ap-year-group';
            group.innerHTML = `<div class="ap-year">${escapeHtml(year)}</div>`;

            const list = document.createElement('div');
            list.className = 'ap-list';

            yearItems.forEach(item => {
                const type = item.type === 'project' ? 'project' : 'award';
                const card = document.createElement('article');
                card.className = `ap-card ap-card-${type}`;
                card.style.setProperty('--ap-color', typeColor[type]);
                card.innerHTML = `
                    <div class="ap-card-top">
                        <span class="ap-type">${typeLabel[type]}</span>
                        <span class="ap-result">${escapeHtml(item.result || '')}</span>
                    </div>
                    <h3>${escapeHtml(item.title || '')}</h3>
                    <p>${escapeHtml(item.summary || '')}</p>
                    ${tagsHtml(item.tags)}
                `;
                list.appendChild(card);
            });

            group.appendChild(list);
            fragment.appendChild(group);
        });

        root.appendChild(fragment);
    } catch (err) {
        console.error(err);
        root.innerHTML = '<p class="blog-error">得獎與專案時間軸載入失敗。</p>';
    }
}

function switchProfileTab(panelId, updateHash = true) {
    const tabsRoot = document.getElementById('profile-tabs');
    if (!tabsRoot) return;

    const nextPanel = panelId === 'blog' ? 'blog' : 'resume';
    tabsRoot.querySelectorAll('.profile-tab').forEach(button => {
        const active = button.dataset.panel === nextPanel;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    tabsRoot.querySelectorAll('.profile-tab-panel').forEach(panel => {
        const active = panel.dataset.panel === nextPanel;
        panel.classList.toggle('active', active);
        panel.hidden = !active;
    });

    if (updateHash) {
        history.replaceState(null, '', '#' + nextPanel);
    }
}

function initProfileTabs() {
    const tabsRoot = document.getElementById('profile-tabs');
    if (!tabsRoot) return;

    tabsRoot.querySelectorAll('.profile-tab').forEach(button => {
        button.addEventListener('click', () => {
            switchProfileTab(button.dataset.panel);
        });
    });

    if (window.location.hash === '#blog') {
        switchProfileTab('blog', false);
    } else {
        switchProfileTab('resume', false);
    }
}

// Initialize based on the current page
document.addEventListener('DOMContentLoaded', () => {
    initProfileTabs();
    if (document.getElementById('post-body')) {
        displayBlogPost();
    }
    if (document.querySelector('#blog .blog-posts')) {
        loadBlogPosts();
    }
    if (document.getElementById('timeline-mt')) {
        loadTimelineMultiTrack();
    }
    if (document.getElementById('awards-projects-timeline')) {
        loadAwardsProjectsTimeline();
    }
});
