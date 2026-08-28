"""Recover the manual CONTENT from the built PDFs, as structured blocks.

The PDFs are the only surviving source, so this reads them back: it groups
characters into lines, classifies each line by its font size and left edge
(the design uses size for hierarchy and x0 for indent), preserves bold runs
as <b> spans, and rejoins wrapped lines into whole paragraphs.

Output: one JSON per manual in content/, which compose.py renders back to PDF.
"""
import pdfplumber, json, glob, os, re, sys

H1, H2, BODY, SMALL = 17.0, 12.5, 9.5, 8.0
LEFT_TEXT, LEFT_INDENT = 57, 77   # measured: paragraphs at 57, list items at 77

def regions(page):
    """Where the tinted boxes and tables sit, so their text is not mistaken for
    ordinary paragraphs. Blue rect (not the 31pt running header) = a table
    header; a 493-wide #F2F5FC rect on its own = a callout box."""
    blue, panel = [], []
    for r in page.rects:
        col = tuple(round(x, 3) for x in (r.get('non_stroking_color') or ()))
        h, w, top = round(r['height']), round(r['width']), round(r['top'])
        if col == (0.0, 0.086, 0.561) and h != 31 and w > 400: blue.append((top, top + h))
        if col == (0.949, 0.961, 0.988) and w > 400:           panel.append((top, top + h))
    # the callout boxes are colour-coded by a 0.75pt border (green for TIP and
    # CADENCE, amber for AVAILABLE TO PROMISE and THE LOOP) — read it, don't guess
    out = []
    for top, bot in panel:
        col = None
        for e in page.edges:
            if e.get('linewidth') and e['orientation'] == 'h' and abs(e['top'] - top) < 0.6:
                sc = e.get('stroking_color') or ()
                if len(sc) == 3: col = '#%02X%02X%02X' % tuple(round(255 * x) for x in sc)
                break
        out.append((top, bot, col))
    return blue, out

def lines_of(page):
    rows = {}
    for ch in page.chars:
        rows.setdefault(round(ch['top'], 1), []).append(ch)
    out = []
    for top in sorted(rows):
        cs = sorted(rows[top], key=lambda c: c['x0'])
        if not cs: continue
        # rebuild the text with <b> around bold runs
        parts, cur, bold = [], '', None
        for c in cs:
            b = 'Bold' in c['fontname']
            if bold is None: bold = b
            if b != bold:
                parts.append((bold, cur)); cur, bold = '', b
            cur += c['text']
        parts.append((bold, cur))
        txt = ''.join(('<b>'+t+'</b>' if b and t.strip() else t) for b, t in parts)
        # a character the shipped PDF had no glyph for comes back as NUL; the
        # only one in these manuals is the + on the Attach button
        txt = txt.replace('\x00', '+')
        out.append({'top': top, 'x0': round(cs[0]['x0']),
                    'x1': round(max(c['x1'] for c in cs)), 'size': round(cs[0]['size'], 1),
                    'colour': tuple(round(x, 3) for x in (cs[0].get('non_stroking_color') or ())),
                    'text': txt})
    return out

# the shipped layout's own spacing, so a deliberate extra gap can be told apart
# from ordinary flow (these mirror the styles in fw.py)
LEAD         = {'h1': 21, 'h2': 16, 'p': 14, 'step': 14, 'small': 11.5, 'callout': 13}
SPACE_AFTER  = {'h1': 6, 'h2': 4, 'p': 5, 'step': 3, 'small': 5, 'callout': 5}
SPACE_BEFORE = {'h1': 14, 'h2': 10}

def kind_of(ln):
    t, sz, x = ln['text'].strip(), ln['size'], ln['x0']
    if ln.get('kind') == 'callout': return 'callout'
    if sz >= 16: return 'h1'
    if sz >= 12: return 'h2'
    if sz <= 8.2 and ln['colour'] and ln['colour'][0] > 0.3: return 'small'
    return 'step' if x >= LEFT_INDENT - 2 else 'p'

AFTER_TABLE = 2.3   # measured: normal flow resumes 2.3pt below the last row rect

def classify(doc_lines):
    WRAPPED = 505   # a line this wide was broken by wrapping, so its paragraph continues
    blocks, buf, kind, prev_top, num, prev_x1, ccol = [], [], None, None, None, 0, None
    def flush():
        nonlocal buf, kind, num, ccol
        if buf:
            body = ' '.join(buf).replace('</b> <b>', ' ')
            body = re.sub(r'\s+', ' ', body).strip()
            if body:
                b = {'t': kind, 'v': body}
                if kind == 'step' and num: b['n'] = num
                if kind == 'callout' and ccol: b['c'] = ccol
                blocks.append(b)
        buf, kind, num, ccol = [], None, None, None
    for ln in doc_lines:
        t, s, x = ln['text'].strip(), ln['size'], ln['x0']
        if not t: continue
        k = kind_of(ln)
        # a page turn is not itself a paragraph break — but if the last line of the
        # previous page stopped short of the column edge, that paragraph had ended
        page_turn = prev_top is not None and ln['top'] < prev_top - 50
        # a heading that wraps is ONE heading: the gap test has to know the
        # leading of the kind it is looking at (h1 is 21pt, h2 is 16pt), or every
        # wrapped heading gets split into two and the spacing doubles
        gap = {'h1': 22.5, 'h2': 17.5, 'callout': 14.0, 'small': 12.5}.get(k, 16.5)
        starts_new = (k != kind) or \
                     (k == 'step' and re.match(r'^(<b>)?\d+\.', t)) or \
                     (page_turn and prev_x1 < WRAPPED) or \
                     (not page_turn and prev_top is not None and ln['top'] - prev_top > gap)
        if starts_new:
            # the originals sometimes carry a deliberate extra gap (the closing
            # note at the end of every manual sits ~17pt lower than normal flow).
            # Anything more than 6pt beyond the style's own spacing is recorded
            # so the rebuild reproduces it instead of closing it up.
            box = {'callout', 'table'}      # boxes carry their own padding, so the
            if buf and not page_turn and prev_top is not None \
               and k not in box and kind not in box:
                want = LEAD.get(k, 14) + SPACE_AFTER.get(kind, 5) + SPACE_BEFORE.get(k, 0)
                extra = (ln['top'] - prev_top) - want
                flush()
                if extra > 6: blocks.append({'t': 'gap', 'v': round(extra, 1)})
            else:
                flush()
        kind = k
        if k == 'callout' and ln.get('ccol'): ccol = ln['ccol']
        if k == 'step':
            m = re.match(r'^(<b>)?(\d+)\.\s*', t)
            if m: num = m.group(2)                     # keep it: the originals number literally
            buf.append(re.sub(r'^(<b>)?\d+\.\s*', r'\1', t))
        else:
            buf.append(t)
        prev_top, prev_x1 = ln['top'], ln['x1']
    flush()
    return blocks

def cover_of(pdf):
    txt = [l.strip() for l in (pdf.pages[0].extract_text() or '').split('\n') if l.strip()]
    # the role title can wrap onto two lines ("IT — Specialist Account / Admin"),
    # so take everything between the brand and the kicker
    k = next((i for i, l in enumerate(txt) if i and l.endswith('Manual')), 2)
    return {'brand': txt[0] if txt else '',
            'role': ' '.join(txt[1:k]),
            'kicker': txt[k] if len(txt) > k else 'User Manual',
            'audience': txt[k + 1] if len(txt) > k + 1 else '',
            'foot': txt[k + 2] if len(txt) > k + 2 else ''}

FRAME_L, FRAME_R = 51.0236, 544.2520   # the tables bleed to the full frame width
CELL_PAD = 6                 # measured: cell text sits 6pt in from its column edge

def columns_of(page, bar):
    """Column starts read off the blue header bar itself — the tables are not all
    three columns wide (the meeting-crib tables are two)."""
    cs = [c for c in page.chars if bar[0] - 1 <= c['top'] <= bar[1] + 1]
    starts, prev = [], -99.0
    for x in sorted(c['x0'] for c in cs):      # unrounded: the column rules sit
        if x - prev > 20: starts.append(x)     # half a point off if these are ints
        prev = x
    return starts or [FRAME_L + CELL_PAD]

def table_blocks(page):
    """Rebuild a bell table from the page: the blue bar is the header row, the
    tinted/white bars below it are the body rows, and text is bucketed into the
    three measured columns."""
    blue, panel = regions(page)
    if not blue: return None, set()
    top0 = blue[0][0]
    rows = {}
    used = set()
    for ch in page.chars:
        if round(ch['size'], 1) != 8.5: continue
        if ch['top'] < top0 - 2: continue
        rows.setdefault(round(ch['top'], 1), []).append(ch)
        used.add(round(ch['top'], 1))
    if not rows: return None, set()
    cols = columns_of(page, blue[0])
    n = len(cols)
    def cells(cs):
        out = [''] * n
        for c in sorted(cs, key=lambda c: c['x0']):
            i = 0
            for j in range(n - 1, -1, -1):
                if c['x0'] >= cols[j] - CELL_PAD: i = j; break
            out[i] += c['text']
        return out
    ks = sorted(rows)
    head = cells(rows[ks[0]])
    # Every row is drawn as a full-width rectangle, so the rectangles — not a
    # guess about which column holds text — decide where one row ends and the
    # next begins. A cell that wraps keeps its lines inside one rectangle.
    bands = sorted((round(r['top'], 1), round(r['bottom'], 1)) for r in page.rects
                   if round(r['width']) > 400 and round(r['height']) != 31
                   and round(r['top'], 1) > blue[0][0] + 1)
    body = []
    if bands:
        for a, b in bands:
            inside = [k for k in ks[1:] if a - 1 <= k <= b + 1]
            if not inside: continue
            cur = ['' for _ in range(n)]
            for k in inside:
                c = cells(rows[k])
                cur = [x + (' ' if x and y else '') + y for x, y in zip(cur, c)]
            body.append(cur)
    else:
        cur = None
        for k in ks[1:]:
            c = cells(rows[k])
            if cur is None or c[0].strip():
                if cur: body.append(cur)
                cur = c
            else:
                cur = [x + (' ' if x and y else '') + y for x, y in zip(cur, c)]
        if cur: body.append(cur)
    edges = [c - CELL_PAD for c in cols] + [FRAME_R]
    widths = [round(edges[i + 1] - edges[i], 2) for i in range(n)]
    return {'t': 'table', 'head': head, 'rows': body, 'w': widths}, used

def run(src_dir, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    for f in sorted(glob.glob(os.path.join(src_dir, '*.pdf'))):
        with pdfplumber.open(f) as pdf:
            blocks = []
            pending = []
            foot = ''
            for i, p in enumerate(pdf.pages):
                if i == 0: continue                       # cover handled separately
                tbl, tbl_tops = table_blocks(p); placed = False
                _rb = [r for r in p.rects if round(r['width']) > 400 and round(r['height']) != 31]
                tbl_bottom = max((r['bottom'] for r in _rb), default=0)
                _, panels = regions(p)
                for ln in lines_of(p):
                    if ln['top'] < 32: continue           # running header bar
                    if ln['top'] > 795:                   # page footer — drawn by the frame
                        foot = foot or re.sub(r'\s*Page\s+\d+\s*$', '', ln['text']).strip()
                        continue
                    if round(ln['top'], 1) in tbl_tops: continue   # belongs to the table
                    # the table sits in the middle of the page, not at its end:
                    # flush everything above it, drop it in, then carry on
                    if tbl and not placed and tbl_tops and ln['top'] > max(tbl_tops):
                        blocks += classify(pending); pending = []
                        blocks.append(tbl); placed = True
                        # a deliberate gap after a table would otherwise vanish,
                        # because the flow restarts with no previous line to measure from
                        extra = ln['top'] - (tbl_bottom + AFTER_TABLE
                                             + SPACE_BEFORE.get(kind_of(ln), 0))
                        if extra > 6: blocks.append({'t': 'gap', 'v': round(extra, 1)})
                    hit = next(((a, b, c) for a, b, c in panels if a - 4 <= ln['top'] <= b), None)
                    if hit and ln['size'] == 9.0:
                        ln = dict(ln, kind='callout', ccol=hit[2])
                    pending.append(ln)
                if tbl and not placed:                    # nothing followed it on the page
                    blocks += classify(pending); pending = []
                    blocks.append(tbl)
            blocks += classify(pending)
            doc = {'file': os.path.basename(f), 'cover': cover_of(pdf), 'foot': foot,
                   'blocks': blocks, 'pages': len(pdf.pages)}
        out = os.path.join(out_dir, os.path.basename(f).replace('.pdf', '.json'))
        json.dump(doc, open(out, 'w'), ensure_ascii=False, indent=1)
        kinds = {}
        for b in doc['blocks']: kinds[b['t']] = kinds.get(b['t'], 0) + 1
        print(f"{os.path.basename(f):<38} {doc['pages']:>2}pp  blocks={len(doc['blocks']):>3}  {kinds}")

if __name__ == '__main__':
    run(sys.argv[1] if len(sys.argv) > 1 else '../../manuals',
        sys.argv[2] if len(sys.argv) > 2 else 'content')
