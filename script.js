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

    let loaded = 0;
    for (const filename of postFiles) {
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
        loaded += 1;
    }

    if (loaded === 0) {
        blogPostsContainer.innerHTML =
            '<p class="blog-error">沒有載入任何文章。請檢查 blog/posts.json 的檔名是否與 blog 資料夾內的 .md 一致，並用 http(s) 網址開啟網站（勿用 file://）。</p>';
    }
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

// Initialize based on the current page
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('post-body')) {
        displayBlogPost();
    }
    if (document.querySelector('#blog .blog-posts')) {
        loadBlogPosts();
    }
});
