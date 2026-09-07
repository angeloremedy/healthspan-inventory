"""Render the manuals from content/*.json using fw.py.

Content lives as data (recovered from the shipped PDFs by extract.py), so
editing a manual means editing JSON, not code. Add a block, re-run, done.

  python3 compose.py            → build all nine into ../../manuals-new/
  python3 compose.py out_dir    → build into out_dir
"""
import json, glob, os, sys, datetime
import fw

def story_of(doc):
    out = []
    for b in doc['blocks']:
        b = dict(b)
        t = b['t']
        if t == 'table':                     # tables carry head/rows, not a value
            out.append(fw.table(b['head'], b['rows'], b.get('w')))
            continue
        if t == 'gap':
            out.append(fw.gap(b['v']))
            continue
        v = b.get('v', '')
        if   t == 'h1':    out.append(fw.h1(v))
        elif t == 'h2':    out.append(fw.h2(v))
        elif t == 'p':     out.append(fw.p(v))
        elif t == 'small': out.append(fw.small(v))
        elif t == 'step':  out.append(fw.steps([(b.get('n', 1), v)])[0])
        elif t == 'callout': out.append(fw.callout(v, b.get('c')))
    return glue(out)

def glue(flow):
    """Headings carry keepWithNext, which Platypus honours for the next flowable. A
    heading followed by a numbered list still looked wrong when only the first step
    made the page, so every heading is bound to the first TWO flowables after it
    (or one, when the second is another heading). Tables and callouts are left to
    split on their own — a KeepTogether around a long table would push the whole
    section to a fresh page."""
    from reportlab.platypus import KeepTogether, Paragraph
    out, i = [], 0
    def is_head(f):
        return isinstance(f, Paragraph) and f.style.name in ('h1', 'h2')
    while i < len(flow):
        f = flow[i]
        if is_head(f):
            grp = [f]; j = i + 1; body = 0
            # an h1 straight into an h2 travels with it; then two body paragraphs
            while j < len(flow) and body < 2 and isinstance(flow[j], Paragraph):
                if not is_head(flow[j]): body += 1
                grp.append(flow[j]); j += 1
            if len(grp) > 1:
                for g in grp: g.keepWithNext = 0   # the group does the keeping now
                out.append(KeepTogether(grp)); i = j; continue
        out.append(f); i += 1
    return out

def run(out_dir):
    os.makedirs(out_dir, exist_ok=True)
    month = datetime.date.today().strftime('%B %Y')
    for f in sorted(glob.glob('content/*.json')):
        doc = json.load(open(f))
        c = doc['cover']
        path = os.path.join(out_dir, doc['file'])
        fw.build(path, c['role'], c['audience'], story_of(doc),
                 doc.get('foot') or '', kicker=c.get('kicker') or 'User Manual',
                 dateline='hq.healthspan.ph · ' + month +
                          ' · the app updates weekly — this manual describes what is live today')
        print('built', os.path.basename(path))

if __name__ == '__main__':
    run(sys.argv[1] if len(sys.argv) > 1 else '../../manuals-new')
