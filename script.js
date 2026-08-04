const RESUME_MD = 'resume.md';

function baseDirHref() {
    const url = new URL(window.location.href);
    let path = url.pathname;

    if (!path.endsWith('/')) {
        const lastPart = path.split('/').pop() || '';
        if (/\.[a-zA-Z0-9]+$/.test(lastPart)) {
            path = path.slice(0, path.lastIndexOf('/') + 1);
        } else {
            path += '/';
        }
    }

    url.pathname = path;
    url.search = '';
    url.hash = '';
    return url.href;
}

function contentUrl(path) {
    return new URL(path, baseDirHref()).href;
}

async function fetchText(path) {
    const response = await fetch(contentUrl(path), { cache: 'no-cache' });
    if (!response.ok) {
        throw new Error(`Could not load ${path}: ${response.status}`);
    }
    return response.text();
}

function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
}

function safeUrl(value) {
    const url = String(value || '').trim();
    if (/^(javascript|data):/i.test(url)) return '#';
    return url;
}

function linkAttrs(url) {
    if (/^https?:\/\//i.test(url)) {
        return ' target="_blank" rel="noopener"';
    }
    return '';
}

function renderInline(value) {
    let text = String(value || '');
    const tokens = [];
    const keep = html => {
        const token = `@@MDTOKEN${tokens.length}@@`;
        tokens.push(html);
        return token;
    };

    text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
        return keep(`<img class="md-image" src="${escapeAttr(safeUrl(src))}" alt="${escapeAttr(alt)}">`);
    });

    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
        const url = safeUrl(href);
        return keep(`<a href="${escapeAttr(url)}"${linkAttrs(url)}>${escapeHtml(label)}</a>`);
    });

    text = text.replace(/`([^`]+)`/g, (_, code) => keep(`<code>${escapeHtml(code)}</code>`));

    let html = escapeHtml(text);
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/@@MDTOKEN(\d+)@@/g, (_, index) => tokens[Number(index)] || '');
    return html;
}

function headingId(rawText, index) {
    const text = rawText.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[*`]/g, '').trim();
    const knownIds = {
        'Atlas You｜游毓堂': 'top',
        '個人摘要': 'summary',
        '得獎與榮譽': 'awards',
        '開發、太空與跨域競賽': 'awards-cross-domain',
        '射箭校隊競賽紀錄': 'archery-awards',
        '工作經驗': 'experience',
        '社群與公共參與': 'community',
        '教育背景': 'education',
        '著作與研究成果': 'publications',
        '專案與研究方向': 'projects',
        '國際交流、培訓與證明': 'training',
        '授課、演講與主持': 'talks',
        '語言能力': 'languages',
        '核心能力': 'skills'
    };

    if (knownIds[text]) return knownIds[text];

    const ascii = text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return ascii || `section-${index}`;
}

function structuredParts(text) {
    const parts = String(text || '')
        .split('｜')
        .map(part => part.trim())
        .filter(Boolean);

    if (parts.length < 2) return null;
    if (parts.length <= 4) return parts;

    return [
        parts[0],
        parts[1],
        parts[2],
        parts.slice(3).join('｜')
    ];
}

function tableLabels(columnCount) {
    if (columnCount === 2) return ['項目', '內容'];
    if (columnCount === 3) return ['時間／項目', '單位／活動', '內容'];
    return ['時間', '單位／活動', '職稱／成果', '說明'];
}

function renderStructuredTable(items) {
    const columnCount = Math.max(...items.map(item => item.parts.length));
    const labels = tableLabels(columnCount);
    const rows = items.map(item => {
        const cells = item.parts.slice();
        while (cells.length < columnCount) cells.push('');

        return '<tr>' + cells.map((cell, index) => {
            return [
                `<td class="resume-cell resume-cell-${index}" data-label="${escapeAttr(labels[index])}">`,
                renderInline(cell),
                '</td>'
            ].join('');
        }).join('') + '</tr>';
    }).join('\n');

    return `<table class="resume-table cols-${columnCount}"><tbody>${rows}</tbody></table>`;
}

function renderListItems(items) {
    const output = [];
    let index = 0;

    while (index < items.length) {
        const current = items[index];

        if (!current.parts) {
            const plainItems = [];
            while (index < items.length && !items[index].parts) {
                plainItems.push(items[index].text);
                index += 1;
            }
            output.push('<ul>');
            plainItems.forEach(text => {
                output.push(`<li>${renderInline(text)}</li>`);
            });
            output.push('</ul>');
            continue;
        }

        const columnCount = current.parts.length;
        const tableItems = [];
        while (
            index < items.length &&
            items[index].parts &&
            items[index].parts.length === columnCount
        ) {
            tableItems.push(items[index]);
            index += 1;
        }
        output.push(renderStructuredTable(tableItems));
    }

    return output.join('\n');
}

function markdownToHtml(markdown) {
    const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
    const html = [];
    let paragraph = [];
    let listItems = [];
    let headingCount = 0;

    const flushList = () => {
        if (!listItems.length) return;
        html.push(renderListItems(listItems));
        listItems = [];
    };

    const flushParagraph = () => {
        if (!paragraph.length) return;
        const body = paragraph.map(line => renderInline(line.trim())).join('<br>');
        html.push(`<p>${body}</p>`);
        paragraph = [];
    };

    for (const rawLine of lines) {
        const line = rawLine.trimEnd();

        if (!line.trim()) {
            flushParagraph();
            flushList();
            continue;
        }

        const heading = line.match(/^(#{1,3})\s+(.+)$/);
        if (heading) {
            flushParagraph();
            flushList();
            headingCount += 1;
            const level = heading[1].length;
            const text = heading[2].trim();
            const id = headingId(text, headingCount);
            html.push(`<h${level} id="${escapeAttr(id)}">${renderInline(text)}</h${level}>`);
            continue;
        }

        const listItem = line.match(/^-\s+(.+)$/);
        if (listItem) {
            flushParagraph();
            const text = listItem[1].trim();
            listItems.push({
                text,
                parts: structuredParts(text)
            });
            continue;
        }

        flushList();
        paragraph.push(line);
    }

    flushParagraph();
    flushList();
    return html.join('\n');
}

function renderLoadError(container, path) {
    container.innerHTML = `
        <h1 id="top">Atlas You｜游毓堂</h1>
        <p>
            目前首頁會讀取 <code>${escapeHtml(path)}</code>。
            若直接用 <code>file://</code> 開啟，瀏覽器通常會阻擋讀取本機 Markdown。
        </p>
        <p>
            請在專案資料夾執行 <code>python3 -m http.server 8000</code>，
            再開啟 <code>http://127.0.0.1:8000/</code>。
        </p>
        <p><a href="${escapeAttr(path)}">直接查看 Markdown 檔</a></p>
    `;
}

async function loadResume() {
    const container = document.getElementById('resume-content');
    if (!container) return;

    try {
        const markdown = await fetchText(RESUME_MD);
        container.innerHTML = markdownToHtml(markdown);

        if (window.location.hash) {
            const id = decodeURIComponent(window.location.hash.slice(1));
            const target = document.getElementById(id);
            if (target) target.scrollIntoView();
        }
    } catch (error) {
        console.error(error);
        renderLoadError(container, RESUME_MD);
    }
}

function getTitleFromMarkdown(markdown) {
    const title = String(markdown || '').match(/^#\s+(.+)$/m);
    return title ? title[1].trim() : '未命名文章';
}

function stripLeadingH1(markdown) {
    return String(markdown || '').replace(/^#\s+.+$/m, '').trim();
}

async function displayBlogPost() {
    const titleElement = document.getElementById('post-title');
    const bodyElement = document.getElementById('post-body');
    if (!titleElement || !bodyElement) return;

    const postFilename = new URLSearchParams(window.location.search).get('post');
    if (!postFilename) {
        titleElement.textContent = '文章未找到';
        bodyElement.innerHTML = '<p>網址裡沒有指定文章檔名。</p>';
        return;
    }

    try {
        const markdown = await fetchText(`blog/${postFilename}`);
        titleElement.textContent = getTitleFromMarkdown(markdown);
        bodyElement.innerHTML = markdownToHtml(stripLeadingH1(markdown));
    } catch (error) {
        console.error(error);
        titleElement.textContent = '文章未找到';
        bodyElement.innerHTML = '<p>無法載入此文章。若在本機預覽，請改用本機伺服器開啟網站。</p>';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadResume();
    displayBlogPost();
});
