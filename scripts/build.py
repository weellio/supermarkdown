"""Build Super Markdown into single, self-contained HTML files.

    python scripts/build.py

Writes:
    SuperMarkdown.html       full build (diagrams + math included, ~5 MB)
    SuperMarkdown-lite.html  no diagrams/math (~0.6 MB)

Vendor libraries come from vendor-src/node_modules (run `npm install` in vendor-src first).
"""
import base64
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
NM = ROOT / "vendor-src" / "node_modules"
VERSION = "1.0"
SENTINEL = ""

VENDOR = [
    NM / "marked" / "lib" / "marked.umd.js",
    NM / "marked-footnote" / "dist" / "index.umd.js",
    NM / "dompurify" / "dist" / "purify.min.js",
    NM / "@highlightjs" / "cdn-assets" / "highlight.min.js",
]
FONTS = [
    ("Atkinson Hyperlegible", 400, "normal", NM / "@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-normal.woff2", None),
    ("Atkinson Hyperlegible", 700, "normal", NM / "@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-700-normal.woff2", None),
    ("Atkinson Hyperlegible", 400, "italic", NM / "@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-italic.woff2", None),
    ("Atkinson Hyperlegible", 700, "italic", NM / "@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-700-italic.woff2", None),
    ("Atkinson Hyperlegible", 400, "normal", NM / "@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-ext-400-normal.woff2",
     "U+0100-02AF,U+0304,U+0308,U+0329,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF"),
    ("Atkinson Hyperlegible", 700, "normal", NM / "@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-ext-700-normal.woff2",
     "U+0100-02AF,U+0304,U+0308,U+0329,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF"),
    ("JetBrains Mono", 400, "normal", NM / "@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2", None),
    ("JetBrains Mono", 700, "normal", NM / "@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff2", None),
]
LATIN_RANGE = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"


def read(p: Path) -> str:
    return p.read_text(encoding="utf-8")


def b64(p: Path) -> str:
    return base64.b64encode(p.read_bytes()).decode("ascii")


def inline_script_safe(js: str) -> str:
    """Make JS safe to sit inside <script>…</script>. Only touches '<!--' and '</script',
    which in these libraries appear inside strings/regexes/comments where \\x21 and \\/ are equivalent."""
    js = re.sub(r"<!--", r"<\\x21--", js)
    js = re.sub(r"</(script)", r"<\\/\1", js, flags=re.I)
    return js


def lazy_safe(text: str) -> str:
    """Exactly reversible escaping for text stored in a non-executed <script> holder.
    The app reverses it with .replace(/<\\uE000/g, '<')."""
    if SENTINEL in text:
        sys.exit("sentinel character found in source text; pick another")
    return re.sub(r"<(?=!--|/script)", "<" + SENTINEL, text, flags=re.I)


def font_css() -> str:
    out = []
    for family, weight, style, path, rng in FONTS:
        out.append(
            "@font-face{font-family:'%s';font-style:%s;font-weight:%d;font-display:swap;"
            "src:url(data:font/woff2;base64,%s) format('woff2');unicode-range:%s}"
            % (family, style, weight, b64(path), rng or LATIN_RANGE)
        )
    return "\n".join(out)


def katex_css() -> str:
    css = read(NM / "katex/dist/katex.min.css")
    fonts = NM / "katex/dist/fonts"

    def repl(m):
        name = re.search(r"fonts/([\w-]+)\.woff2", m.group(0)).group(1)
        return "src:url(data:font/woff2;base64,%s) format(\"woff2\")" % b64(fonts / f"{name}.woff2")

    css, n = re.subn(r"src:url\(fonts/[^;}]+", repl, css)
    if n < 15:
        sys.exit(f"katex font rewrite only matched {n} faces")
    return css


def build(full: bool) -> str:
    tpl = read(SRC / "template.html")
    css = read(SRC / "app.css").replace("/*@FONTS@*/", font_css())
    app = read(SRC / "app.js").replace("{{BUILD}}", "full" if full else "lite")
    vendor = "\n".join(f"<script>\n{inline_script_safe(read(p))}\n</script>" for p in VENDOR)

    lazy, credits, helptext = "", "", ""
    if full:
        lazy = (
            f'<script type="text/x-lazy" id="lib-katex">{lazy_safe(read(NM / "katex/dist/katex.min.js"))}</script>\n'
            f'<script type="text/x-lazy" id="lib-katex-css">{lazy_safe(katex_css())}</script>\n'
            f'<script type="text/x-lazy" id="lib-mermaid">{lazy_safe(read(NM / "mermaid/dist/mermaid.min.js"))}</script>'
        )
        credits = "Mermaid (MIT) - KaTeX (MIT, fonts SIL OFL 1.1)"
        helptext = ", math (<code>$x^2$</code>, <code>$$&hellip;$$</code>) and Mermaid diagrams"

    parts = {
        "{{CSS}}": css.replace("</style", "<\\/style"),
        "{{SAMPLE}}": lazy_safe(read(SRC / "sample.md")),
        "{{LAZY}}": lazy,
        "{{VENDOR}}": vendor,
        "{{APP}}": inline_script_safe(app),
        "{{LAZY_CREDITS}}": credits,
        "{{LAZY_HELP}}": helptext,
        "{{VERSION}}": VERSION,
        "{{BUILD}}": "full" if full else "lite",
    }
    # single pass so placeholder-looking text inside libraries is never touched
    pattern = re.compile("|".join(re.escape(k) for k in parts))
    return pattern.sub(lambda m: parts[m.group(0)], tpl)


def main():
    for p in VENDOR:
        if not p.exists():
            sys.exit(f"missing {p} - run `npm install` in vendor-src")
    versions = {}
    for pkg in ["marked", "marked-footnote", "dompurify", "@highlightjs/cdn-assets", "mermaid", "katex"]:
        versions[pkg] = json.loads(read(NM / pkg / "package.json"))["version"]
    for full, name in [(True, "SuperMarkdown.html"), (False, "SuperMarkdown-lite.html")]:
        html = build(full)
        out = ROOT / name
        out.write_text(html, encoding="utf-8", newline="\n")
        print(f"{name}: {out.stat().st_size / 1024 / 1024:.2f} MB")
    print("bundled:", ", ".join(f"{k} {v}" for k, v in versions.items()))


if __name__ == "__main__":
    main()
