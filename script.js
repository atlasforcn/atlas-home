const resumeContainer = document.querySelector('[data-resume-source]');
const RESUME_MD = resumeContainer ? resumeContainer.dataset.resumeSource : 'resume.md';

function isEnglishPage() {
    return /^en(?:-|$)/i.test(document.documentElement.lang || '');
}

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
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/@@MDTOKEN(\d+)@@/g, (_, index) => tokens[Number(index)] || '');
    return html;
}

function headingId(rawText, index) {
    const text = rawText.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[*`]/g, '').trim();
    const knownIds = {
        'Atlas You｜游毓堂': 'top',
        'Summary': 'summary',
        '個人摘要': 'summary',
        'Awards & Honors': 'awards',
        '得獎與榮譽': 'awards',
        'Mission Team Recognition': 'mission-team-recognition',
        '任務團隊榮譽': 'mission-team-recognition',
        'Development, Space & Cross-Disciplinary Competitions': 'awards-cross-domain',
        '開發、太空與跨域競賽': 'awards-cross-domain',
        'Archery Team Competition Record': 'archery-awards',
        '射箭校隊競賽紀錄': 'archery-awards',
        'Work Experience': 'experience',
        '工作經驗': 'experience',
        'Community & Public Engagement': 'community',
        '社群與公共參與': 'community',
        'Education': 'education',
        '教育背景': 'education',
        'Publications & Research': 'publications',
        '著作與研究成果': 'publications',
        'Projects & Research Directions': 'projects',
        '專案與研究方向': 'projects',
        'ONGLAISAT': 'onglaisat',
        '旺來衛星 ONGLAISAT': 'onglaisat',
        '6U CubeSat Embedded-System University Project': 'cubesat-study',
        '6U 立方衛星嵌入式系統專題': 'cubesat-study',
        'Other Projects & Research': 'other-projects',
        '其他專案與研究': 'other-projects',
        'International Exchange, Training & Certifications': 'training',
        '國際交流、培訓與證明': 'training',
        'Talks, Speaking & Hosting': 'talks',
        '授課、演講與主持': 'talks',
        'Language Skills': 'languages',
        '語言能力': 'languages',
        'Core Capabilities': 'skills',
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

function tableLabels(columnCount, language) {
    if (/^en(?:-|$)/i.test(language)) {
        if (columnCount === 2) return ['Item', 'Details'];
        if (columnCount === 3) return ['Time / Item', 'Organization / Event', 'Details'];
        return ['Time', 'Organization / Event', 'Role / Outcome', 'Notes'];
    }

    if (columnCount === 2) return ['項目', '內容'];
    if (columnCount === 3) return ['時間／項目', '單位／活動', '內容'];
    return ['時間', '單位／活動', '職稱／成果', '說明'];
}

function renderStructuredTable(items, language) {
    const columnCount = Math.max(...items.map(item => item.parts.length));
    const labels = tableLabels(columnCount, language);
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

function renderListItems(items, language) {
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
        output.push(renderStructuredTable(tableItems, language));
    }

    return output.join('\n');
}

function markdownToHtml(markdown, language = document.documentElement.lang || '') {
    const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
    const html = [];
    let paragraph = [];
    let listItems = [];
    let headingCount = 0;

    const flushList = () => {
        if (!listItems.length) return;
        html.push(renderListItems(listItems, language));
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

function enhanceResumeLayout(container) {
    const title = container.querySelector('h1:first-of-type');
    if (!title || title.closest('.resume-masthead')) return;

    const portrait = container.querySelector('.md-image');
    const portraitParagraph = portrait ? portrait.closest('p') : null;
    const contact = title.nextElementSibling;
    const lede = contact ? contact.nextElementSibling : null;

    const masthead = document.createElement('header');
    masthead.className = 'resume-masthead';

    if (portraitParagraph) {
        portraitParagraph.classList.add('portrait-frame');
        masthead.appendChild(portraitParagraph);
    }

    const identity = document.createElement('div');
    identity.className = 'resume-identity';

    const [latinName, chineseName] = title.textContent.split('｜').map(part => part.trim());
    if (latinName && chineseName) {
        const latin = document.createElement('span');
        latin.className = 'name-latin';
        latin.textContent = latinName;

        const divider = document.createElement('span');
        divider.className = 'name-divider';
        divider.setAttribute('aria-hidden', 'true');
        divider.textContent = '／';

        const chinese = document.createElement('span');
        chinese.className = 'name-chinese';
        chinese.textContent = chineseName;

        title.replaceChildren(latin, divider, chinese);
    }

    identity.appendChild(title);

    if (contact && contact.tagName === 'P') {
        contact.classList.add('resume-contact-line');

        const lines = [];
        let line = document.createElement('span');
        line.className = 'contact-item';

        Array.from(contact.childNodes).forEach(node => {
            if (node.nodeName === 'BR') {
                if (line.childNodes.length) lines.push(line);
                line = document.createElement('span');
                line.className = 'contact-item';
                return;
            }
            line.appendChild(node);
        });
        if (line.childNodes.length) lines.push(line);
        contact.replaceChildren(...lines);

        identity.appendChild(contact);
    }

    if (lede && lede.tagName === 'P') {
        lede.classList.add('resume-lede');
        identity.appendChild(lede);
    }

    masthead.appendChild(identity);
    container.prepend(masthead);

    const sectionHeadings = Array.from(container.querySelectorAll(':scope > h2'));
    sectionHeadings.forEach((heading, index) => {
        const section = document.createElement('section');
        section.className = 'resume-section';
        section.setAttribute('aria-labelledby', heading.id);
        section.dataset.section = String(index + 1).padStart(2, '0');
        heading.dataset.section = section.dataset.section;
        container.insertBefore(section, heading);
        section.appendChild(heading);

        let sibling = section.nextSibling;
        while (sibling && sibling.tagName !== 'H2') {
            const next = sibling.nextSibling;
            section.appendChild(sibling);
            sibling = next;
        }
    });
}

function renderResumeDetails(markdown, language = 'zh-Hant') {
    // The build and browser share this renderer. Its input is our generated HTML,
    // whose h2 boundaries are predictable and whose text is already escaped.
    const sections = new Map();
    const rendered = markdownToHtml(markdown, language);
    for (const match of rendered.matchAll(/<h2 id="([^"]+)">([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2 id="|$)/g)) {
        sections.set(match[1], { title: match[2], body: match[3] });
    }

    // The introduction and work history already appear above the homepage details.
    const order = ['awards', 'talks', 'community', 'projects', 'publications', 'education', 'training', 'languages', 'skills'];
    const aliases = { community: 'community-history', projects: 'research-projects' };
    return order.filter(id => sections.has(id)).map((sourceId, index) => {
        let { title, body } = sections.get(sourceId);
        if (sourceId === 'projects') {
            // The university project already appears in selected work above.
            const otherProjects = body.match(/<h3 id="other-projects">([\s\S]*?)<\/h3>/);
            if (otherProjects) {
                body = body.slice(otherProjects.index + otherProjects[0].length);
                title = otherProjects[1];
            }
        }
        const id = aliases[sourceId] || sourceId;
        const number = String(index + 1).padStart(2, '0');
        body = body.replace(/<(\/?)h3(?=[ >])/g, '<$1h4').trim();
        return `<section class="resume-section" aria-labelledby="${escapeAttr(id)}" data-section="${number}">\n` +
            `<h3 id="${escapeAttr(id)}" data-section="${number}">${title}</h3>\n${body}\n</section>`;
    }).join('\n');
}

function renderLoadError(container, path) {
    const headingTag = container.dataset.resumeMode === 'details' ? 'h3' : 'h1';
    if (isEnglishPage()) {
        container.innerHTML = `
            <${headingTag}>The résumé is temporarily unavailable</${headingTag}>
            <p>Please try refreshing the page, or read the text version below.</p>
            <p><a href="${escapeAttr(path)}">Read the résumé text</a></p>
        `;
        return;
    }

    container.innerHTML = `
        <${headingTag}>暫時無法載入履歷</${headingTag}>
        <p>請稍後重新整理頁面，或先閱讀下方的履歷文字版本。</p>
        <p><a href="${escapeAttr(path)}">閱讀履歷文字版本</a></p>
    `;
}

async function loadResume() {
    const container = document.getElementById('resume-content');
    if (!container) return;

    try {
        if (container.dataset.resumePrerendered !== 'true') {
            const markdown = await fetchText(RESUME_MD);
            if (container.dataset.resumeMode === 'details') {
                container.innerHTML = renderResumeDetails(markdown, document.documentElement.lang);
            } else {
                container.innerHTML = markdownToHtml(markdown);
                enhanceResumeLayout(container);
            }
        }
        document.querySelectorAll('[data-print]').forEach(button => {
            button.hidden = false;
        });

        if (window.location.hash) {
            let id = window.location.hash.slice(1);
            try {
                id = decodeURIComponent(id);
            } catch {
                // A malformed link fragment must not hide a successfully loaded résumé.
            }
            const target = document.getElementById(id);
            if (target) target.scrollIntoView();
        }
    } catch (error) {
        console.error(error);
        renderLoadError(container, RESUME_MD);
    } finally {
        container.setAttribute('aria-busy', 'false');
    }
}

function getTitleFromMarkdown(markdown) {
    const title = String(markdown || '').match(/^#\s+(.+)$/m);
    return title ? title[1].trim() : (isEnglishPage() ? 'Untitled article' : '未命名文章');
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
        bodyElement.innerHTML = '<p>暫時無法載入此文章，請稍後重新整理頁面。</p>';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-print]').forEach(button => {
        button.addEventListener('click', () => window.print());
    });
    loadResume();
    displayBlogPost();
});
