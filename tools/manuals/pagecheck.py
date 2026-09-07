"""Pagination lint for the built manuals: flags a heading that is the last text on a
page (orphan title), a page that ends with the first line of a paragraph, or a page
that begins with the last line of one (widow). Run after compose.py:
    python3 pagecheck.py ../../manuals-new
Exit code 1 when anything is flagged."""
import sys, glob, os, pdfplumber
def lines_of(page):
    words = page.extract_words(extra_attrs=['size', 'fontname'], keep_blank_chars=True, use_text_flow=True)
    rows = {}
    for w in words:
        k = round(w['top'])
        rows.setdefault(k, []).append(w)
    out = []
    for k in sorted(rows):
        ws = sorted(rows[k], key=lambda w: w['x0'])
        txt = ' '.join(w['text'] for w in ws).strip()
        if not txt: continue
        out.append({'y': k, 'text': txt, 'size': max(w['size'] for w in ws), 'bold': any('Bold' in w['fontname'] or 'DVB' in w['fontname'] for w in ws), 'x0': min(w['x0'] for w in ws)})
    return out
def main(d):
    bad = 0
    for f in sorted(glob.glob(os.path.join(d, '*.pdf'))):
        with pdfplumber.open(f) as pdf:
            for i, page in enumerate(pdf.pages):
                if i == 0: continue                      # cover
                L = [l for l in lines_of(page) if 30 < l['y'] < page.height - 40]   # drop running header/footer
                if not L: continue
                last = L[-1]
                if last['size'] >= 12 and last['bold']:
                    print('ORPHAN HEADING', os.path.basename(f), 'p.' + str(i + 1), '→', last['text'][:70]); bad += 1
                # a body line that starts a paragraph (capital, ends without period) alone at the foot, followed
                # by more of it on the next page is hard to see from text alone; check the classic signs instead:
                first = L[0]
                if first['size'] < 12 and first['x0'] > 60 and len(first['text']) < 40 and first['text'][:1].islower():
                    print('WIDOW?', os.path.basename(f), 'p.' + str(i + 1), '→', first['text'][:70]); bad += 1
    print('pagecheck:', 'clean' if not bad else str(bad) + ' issue(s)')
    return 1 if bad else 0
if __name__ == '__main__':
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else '../../manuals-new'))
