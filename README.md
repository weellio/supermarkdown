# Super Markdown

A Markdown reader in **one HTML file**. Nothing to install. Works offline.

- **Try it online:** <https://weellio.github.io/supermarkdown/>
- **Download:** [SuperMarkdown.html](https://github.com/weellio/supermarkdown/raw/main/SuperMarkdown.html) (right-click → Save link as)

## Use it

1. Copy `SuperMarkdown.html` anywhere (USB stick, network share, desktop).
2. Double-click it to open it in Edge, Chrome or Firefox.
3. Drag a `.md` file onto the page.

| Want to… | Do this |
|---|---|
| Open a file | Drag it in, or press `Ctrl+O` |
| See images + follow links between files | Drop the whole **folder** |
| Read text from the clipboard | Press `Ctrl+V` anywhere on the page |
| Change theme, font, spacing | Sliders icon (top right) |
| Print or make a PDF | `⋯` menu → Print / save as PDF |
| Send a formatted copy | `⋯` menu → Save as an HTML page |

## Two versions

| File | Size | Has |
|---|---|---|
| `SuperMarkdown.html` | ~4.5 MB | Everything, including Mermaid diagrams and math |
| `SuperMarkdown-lite.html` | ~0.5 MB | Everything except diagrams and math (they show as code) |

## Safe for locked-down machines

- No network calls (a Content-Security-Policy blocks them). Only images a document links to on the web are loaded.
- Scripts inside a Markdown file never run (DOMPurify cleans every page).
- Open documents and settings are kept in the browser's local storage. Turn off **Remember open documents** in the options to stop that.
- Live reload (the green **Live** chip) works in Edge/Chrome when a file is dragged in or opened with `Ctrl+O`.

## Rebuild

Edit the files in `src/`, then:

```bash
cd vendor-src && npm install     # first time only
python scripts/build.py
```

| File | What it is |
|---|---|
| `src/template.html` | Page layout |
| `src/app.css` | Themes and typography |
| `src/app.js` | All behaviour |
| `src/sample.md` | The built-in sample document |
| `scripts/build.py` | Inlines everything into the two HTML files |
