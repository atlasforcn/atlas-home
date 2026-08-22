const THEME_OPTIONS = [
    {
        id: 'paper-orbit',
        name: 'Paper Orbit',
        note: '保留現在的紙本感，穩重、低調、易讀。',
        vars: {
            '--bg': '#f7f4ee',
            '--surface': '#fffefa',
            '--text': '#222222',
            '--muted': '#666666',
            '--line': '#d8d0c3',
            '--link': '#225c8b',
            '--accent': '#315f55'
        }
    },
    {
        id: 'mission-teal',
        name: 'Mission Teal',
        note: '偏航太與任務管理，乾淨但有技術感。',
        vars: {
            '--bg': '#eef5f2',
            '--surface': '#fbfffc',
            '--text': '#1e2927',
            '--muted': '#62736e',
            '--line': '#c9d9d2',
            '--link': '#176b87',
            '--accent': '#1f6b5d'
        }
    },
    {
        id: 'command-teal',
        name: 'Command Teal',
        note: 'Mission Teal 的深色加強版，像任務控制室但仍可讀。',
        vars: {
            '--bg': '#071b1f',
            '--surface': '#102a2d',
            '--text': '#edfffb',
            '--muted': '#9bb8b3',
            '--line': '#2b5658',
            '--link': '#79dfff',
            '--accent': '#41e0bd'
        }
    },
    {
        id: 'launch-cyan',
        name: 'Launch Cyan',
        note: '更明亮、更科技，青綠色存在感最強。',
        vars: {
            '--bg': '#e4fbf8',
            '--surface': '#ffffff',
            '--text': '#112727',
            '--muted': '#5c7472',
            '--line': '#9edbd2',
            '--link': '#0069b8',
            '--accent': '#009f90'
        }
    },
    {
        id: 'solar-teal',
        name: 'Solar Teal',
        note: '青綠主體加一點暖色反差，比較有個人品牌感。',
        vars: {
            '--bg': '#f1fbf7',
            '--surface': '#fffef8',
            '--text': '#172522',
            '--muted': '#64716b',
            '--line': '#bdd8cd',
            '--link': '#b84e18',
            '--accent': '#007c70'
        }
    },
    {
        id: 'orbital-teal',
        name: 'Orbital Teal',
        note: '更冷、更銳利，介於航太藍與資安青綠之間。',
        vars: {
            '--bg': '#edf7fb',
            '--surface': '#fbffff',
            '--text': '#17242d',
            '--muted': '#5f7078',
            '--line': '#b7d7df',
            '--link': '#004f9f',
            '--accent': '#00768a'
        }
    },
    {
        id: 'signal-blue',
        name: 'Signal Blue',
        note: '偏衛星通訊與國際合作，清楚、專業、科技感較強。',
        vars: {
            '--bg': '#f2f7fb',
            '--surface': '#ffffff',
            '--text': '#20252c',
            '--muted': '#65717e',
            '--line': '#cbd8e4',
            '--link': '#195ca8',
            '--accent': '#245b74'
        }
    },
    {
        id: 'civic-green',
        name: 'Civic Green',
        note: '偏公共參與、永續與教育服務，親和但不軟。',
        vars: {
            '--bg': '#f2f7ef',
            '--surface': '#fffffb',
            '--text': '#20261e',
            '--muted': '#667164',
            '--line': '#d1dccb',
            '--link': '#1f6e8f',
            '--accent': '#4c6f37'
        }
    },
    {
        id: 'copper-archive',
        name: 'Copper Archive',
        note: '偏人文、翻譯與跨域經歷，溫暖且有厚度。',
        vars: {
            '--bg': '#f5f1eb',
            '--surface': '#fffdf8',
            '--text': '#292520',
            '--muted': '#756b60',
            '--line': '#dacfc1',
            '--link': '#7a4c22',
            '--accent': '#68603a'
        }
    },
    {
        id: 'night-ops',
        name: 'Night Ops',
        note: '深色版本，偏資安社群與任務控制室感。',
        vars: {
            '--bg': '#151815',
            '--surface': '#20231f',
            '--text': '#f2eee7',
            '--muted': '#b2aaa0',
            '--line': '#494d45',
            '--link': '#9bc8d9',
            '--accent': '#b7d48b'
        }
    }
];

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

function applyPreviewTheme(theme) {
    for (const [name, value] of Object.entries(theme.vars)) {
        document.documentElement.style.setProperty(name, value);
    }

    localStorage.setItem('atlas-theme-preview', theme.id);
    document.querySelectorAll('.theme-option').forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.themeId === theme.id));
    });

    const meta = document.getElementById('theme-meta');
    if (meta) {
        meta.innerHTML = Object.entries(theme.vars).map(([name, value]) => {
            return `<dt>${escapeHtml(name.replace('--', ''))}</dt><dd>${escapeHtml(value)}</dd>`;
        }).join('');
    }
}

function renderThemeOptions() {
    const list = document.getElementById('theme-list');
    if (!list) return;

    list.innerHTML = THEME_OPTIONS.map(theme => {
        const swatches = Object.values(theme.vars).map(color => {
            return `<i class="swatch" style="background:${escapeAttr(color)}"></i>`;
        }).join('');

        return `
            <button class="theme-option" type="button" data-theme-id="${escapeAttr(theme.id)}" aria-pressed="false">
                <strong>${escapeHtml(theme.name)}</strong>
                <span>${escapeHtml(theme.note)}</span>
                <span class="swatches" aria-hidden="true">${swatches}</span>
            </button>
        `;
    }).join('');

    list.addEventListener('click', event => {
        const button = event.target.closest('.theme-option');
        if (!button) return;
        const theme = THEME_OPTIONS.find(option => option.id === button.dataset.themeId);
        if (theme) applyPreviewTheme(theme);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    renderThemeOptions();
    const preferred = localStorage.getItem('atlas-theme-preview');
    const theme = THEME_OPTIONS.find(option => option.id === preferred) || THEME_OPTIONS[0];
    applyPreviewTheme(theme);
});
