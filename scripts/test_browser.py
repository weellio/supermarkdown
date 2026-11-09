"""Browser regression test for both builds, opened from file:// exactly as people use them.

    python scripts/test_browser.py

Needs Playwright for Python with Chromium. Runs offline except for a mocked web host.
Exits non-zero on the first failed check.
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
failures = []


def check(label, ok, detail=""):
    print(("  ok   " if ok else "  FAIL ") + label + (f"  ({detail})" if detail and not ok else ""))
    if not ok:
        failures.append(label)


def poll(page, expr, tries=60):
    # wait_for_function needs eval, which the app's CSP refuses
    for _ in range(tries):
        if page.evaluate(expr):
            return True
        page.wait_for_timeout(200)
    return False


DROP = """([name, text]) => { const dt = new DataTransfer(); dt.items.add(new File([text], name, {type: 'text/markdown'}));
  document.dispatchEvent(new DragEvent('drop', {dataTransfer: dt, bubbles: true, cancelable: true})); }"""
PASTE = """([plain, html]) => { const dt = new DataTransfer(); dt.setData('text/plain', plain); if (html) dt.setData('text/html', html);
  document.body.dispatchEvent(new ClipboardEvent('paste', {clipboardData: dt, bubbles: true, cancelable: true})); }"""
EVIL = """# Evil
<script>window.__pwned=1</script>
<img src=x onerror="window.__pwned=2">
<a href="javascript:window.__pwned=4">x</a>
<iframe src="https://example.com"></iframe>
<style>body{display:none}</style>
"""
NOTE = "one kit covers every resistor in the build. Check 18k + 22k and 1.2k. Take the scoring box 1 k from the kit"
WIDE = "# Shopping\n\n|  | Buy | Part | Search for | Used by | Est. | At Mouser | Note |\n|---|---|---|---|---|---|---|---|\n" + "\n".join(
    f"| [{'x' if i == 0 else ' '}] | 1 x 50 | 10 uF electrolytic 50 V | 10uF 50V electrolytic | bench01 3, ohm 5 | $1.20 | $0.90 | {NOTE} |" for i in range(4)
) + "\n\n| A | B |\n|---|---|\n| short | table |\n"


def site(route):
    cors = {"Access-Control-Allow-Origin": "*"}
    path = route.request.url.split("example.test")[1]
    pages = {
        "/docs/a.md": "# Doc A\n\n![pic](img/p.png)\n\n[to b](b.md#part-two)\n",
        "/docs/b.md": "# Doc B\n\n" + "filler\n\n" * 80 + "## Part two\n\nHere.\n",
    }
    if path in pages:
        route.fulfill(status=200, headers={**cors, "Content-Type": "text/plain"}, body=pages[path])
    else:
        route.fulfill(status=404, headers=cors, body="nope")


def run(browser, build):
    print(build)
    ctx = browser.new_context(viewport={"width": 1600, "height": 950}, offline=False)
    ctx.route("https://example.test/**", site)
    ctx.route(lambda url: "example.test" not in url and url.startswith("http"), lambda r: r.abort())  # nothing else leaves
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto((ROOT / build).as_uri(), wait_until="domcontentloaded", timeout=15000)
    full = build == "SuperMarkdown.html"

    page.click("#welcome [data-act=sample]")
    if full:
        check("diagram drawn", poll(page, "!!document.querySelector('#doc .mermaid-block svg')"))
        check("math drawn", poll(page, "document.querySelectorAll('#doc .katex').length === 2"))
    s = page.evaluate("""() => ({ callouts: document.querySelectorAll('#doc .callout').length, code: document.querySelectorAll('#doc .codeblock').length,
        tables: document.querySelectorAll('#doc .table-wrap').length, tasks: document.querySelectorAll('#doc li.task').length,
        outline: document.querySelectorAll('#outline a').length, foot: !!document.querySelector('#doc .footnotes') })""")
    check("sample renders", s == {"callouts": 8, "code": 3, "tables": 2, "tasks": 3, "outline": 11, "foot": True}, s)
    page.evaluate("() => { const th = document.querySelectorAll('#doc table')[1].querySelectorAll('th')[1]; th.click(); th.click(); }")
    check("sort descending", page.evaluate("document.querySelectorAll('#doc table')[1].tBodies[0].rows[0].cells[0].textContent") == "Saturn")
    check("right-aligned column", page.evaluate("getComputedStyle(document.querySelectorAll('#doc table')[1].tBodies[0].rows[0].cells[1]).textAlign") == "right")
    page.keyboard.press("Control+f")
    page.fill("#search-input", "the")
    page.wait_for_timeout(300)
    check("search counts", "of" in (page.text_content("#search-count") or ""))
    page.keyboard.press("Escape")
    check("search marks cleared", page.evaluate("document.querySelectorAll('mark.hit').length") == 0)

    page.evaluate(DROP, ["evil.md", EVIL])
    page.wait_for_timeout(300)
    e = page.evaluate("""() => ({ pwned: window.__pwned || 0, bad: document.querySelectorAll('#doc script,#doc iframe,#doc style').length,
        js: [...document.querySelectorAll('#doc a')].filter(a => /javascript/i.test(a.getAttribute('href') || '')).length, shown: getComputedStyle(document.body).display })""")
    check("hostile document neutralised", e == {"pwned": 0, "bad": 0, "js": 0, "shown": "block"}, e)

    page.evaluate(DROP, ["shopping.md", WIDE])
    page.wait_for_timeout(300)
    w = page.evaluate("""() => { const [wide, small] = document.querySelectorAll('#doc .table-wrap'); const md = document.querySelector('#doc').getBoundingClientRect();
        return { wider: wide.getBoundingClientRect().width > md.width + 200, cut: wide.scrollWidth - wide.clientWidth, inView: wide.getBoundingClientRect().right <= innerWidth,
          small: Math.round(small.getBoundingClientRect().width) === Math.round(md.width), boxes: wide.querySelectorAll('td input[type=checkbox]').length,
          ticked: wide.querySelectorAll('td input:checked').length, blankHeaderSort: wide.querySelector('th').classList.contains('sortable') }; }""")
    check("wide table uses free width, nothing cut off", w["wider"] and w["cut"] == 0 and w["inView"], w)
    check("short table keeps text width", w["small"], w)
    check("[ ] / [x] cells are checkboxes", w["boxes"] == 4 and w["ticked"] == 1 and not w["blankHeaderSort"], w)

    page.keyboard.press("l")
    page.fill("#link-url", "example.test/docs/a.md")
    page.keyboard.press("Enter")
    check("web link opens", poll(page, "document.querySelector('#doc h1')?.textContent === 'Doc A'"))
    check("relative image resolves", page.evaluate("document.querySelector('#doc img')?.src") == "https://example.test/docs/img/p.png")
    page.click("#doc a:has-text('to b')")
    check("relative .md link opens in reader at its heading", poll(page, "document.querySelector('#doc h1')?.textContent === 'Doc B' && scrollY > 300"))
    page.keyboard.press("l")
    page.fill("#link-url", "https://blocked.example/x.md")
    page.keyboard.press("Enter")
    check("blocked site falls back to copy steps", poll(page, "!document.querySelector('#link-blocked').hidden"))
    page.keyboard.press("Escape")
    page.evaluate(PASTE, ["Title\nIntro bold", "<h1 style='color:red'>Pasted Title</h1><p>Intro <strong>bold</strong></p><script>window.__pwned=7</script>"])
    page.wait_for_timeout(200)
    check("formatted paste keeps structure, drops styles", page.evaluate("document.querySelector('#doc h1')?.textContent === 'Pasted Title' && !document.querySelector('#doc [style]') && !window.__pwned"))

    check("no page errors", not errors, errors[:3])
    ctx.close()


with sync_playwright() as p:
    b = p.chromium.launch()
    for build in ["SuperMarkdown.html", "SuperMarkdown-lite.html"]:
        run(b, build)
    b.close()

print("\nALL PASSED" if not failures else f"\n{len(failures)} FAILED: {failures}")
sys.exit(1 if failures else 0)
