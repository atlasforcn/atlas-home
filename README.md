# Atlas You Personal Website

個人網站，整理航太專案管理、衛星通訊、資安社群、數位韌性培訓與國際協作經驗。
目前首頁會讀取 `resume.md` 並渲染成接近純履歷的頁面，方便快速瀏覽做過的事情。

![網站目前預覽](assets/readme-preview.png)

## Online

- GitHub Pages: https://atlasforcn.github.io/atlas-home/
- English resume: https://atlasforcn.github.io/atlas-home/en/

## Local Preview

```bash
python3 -m http.server 8000
```

Open `http://127.0.0.1:8000/` in a browser.
直接用 `file://` 開啟時，瀏覽器可能會阻擋首頁讀取 `resume.md`。

## Content

- `index.html`: 讀取 `resume.md` 的履歷首頁
- `resume.html`: 同樣讀取 `resume.md` 的履歷頁
- `resume.md`: 履歷內容來源
- `resume-en.md`: English resume content source
- `style.css`: 簡潔文件式樣式
- `script.js`: Markdown 載入與渲染
- `blog/`, `post.html`, `timeline.json`: 舊版部落格與時間軸資料，首頁目前未載入
