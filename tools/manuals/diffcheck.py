"""Prove the rebuild matches the original design, by measurement not opinion.

Compares, per manual: page geometry, margins, the font/size/colour histogram,
the running-header bar, and the recoverable text. Any drift is reported.
"""
import pdfplumber, glob, os, sys, collections, re

def profile(path):
    g=collections.Counter(); styles=collections.Counter(); bars=collections.Counter()
    xs=[]; text=[]
    with pdfplumber.open(path) as pdf:
        pages=len(pdf.pages)
        for i,p in enumerate(pdf.pages):
            g[(round(p.width,1),round(p.height,1))]+=1
            for r in p.rects:
                col=tuple(round(x,3) for x in (r.get('non_stroking_color') or ()))
                bars[(round(r['x0']),round(r['top']),round(r['width']),round(r['height']),col)]+=1
            for ch in p.chars:
                if i==0: continue
                styles[(ch['fontname'].split('+')[-1],round(ch['size'],1),
                        tuple(round(c,3) for c in (ch.get('non_stroking_color') or ())))]+=1
                if ch['top']>32: xs.append(round(ch['x0']))
            text.append(p.extract_text() or '')
    return {'pages':pages,'geom':g,'styles':styles,'bars':bars,
            'left':min(xs) if xs else None,'right':max(xs) if xs else None,
            'text':re.sub(r'\s+',' ',' '.join(text))}

def norm(t):
    t=re.sub(r'HEALTHSPAN HQ — [A-Z /—-]+ MANUAL hq\.healthspan\.ph','',t)
    t=re.sub(r'hq\.healthspan\.ph · \w+ 2026 ·.*?today','',t)
    t=re.sub(r'\s+',' ',t)
    return t.strip()

def cmp(a,b,name):
    A,Bp=profile(a),profile(b)
    print('\n=== '+name+' ===')
    print(f"  pages      old {A['pages']:>2}  new {Bp['pages']:>2}   {'OK' if A['pages']==Bp['pages'] else 'DIFFERS'}")
    print(f"  page size  {'OK' if A['geom'].keys()==Bp['geom'].keys() else 'DIFFERS: '+str(set(A['geom'])^set(Bp['geom']))}")
    print(f"  text left  old {A['left']}  new {Bp['left']}   right old {A['right']} new {Bp['right']}")
    sa,sb=set(A['styles']),set(Bp['styles'])
    only_old=sorted(sa-sb); only_new=sorted(sb-sa)
    print(f"  styles     shared {len(sa&sb)} | only in old {len(only_old)} | only in new {len(only_new)}")
    for s in only_old[:4]: print('      old-only:',s, A['styles'][s])
    for s in only_new[:4]: print('      new-only:',s, Bp['styles'][s])
    # counts too: a shared style set can still hide a missing element
    for st in sorted(sa&sb):
        na,nb=A['styles'][st],Bp['styles'][st]
        if abs(na-nb) > max(20, 0.04*na):
            print(f"      count drift {st}: old {na} new {nb}")
    ba,bb=A['bars'],Bp['bars']
    hdr=[k for k in ba if k[3]==31]; hdr2=[k for k in bb if k[3]==31]
    print(f"  header bar old {hdr[:1]} new {hdr2[:1]}")
    ta,tb=norm(A['text']),norm(Bp['text'])
    same=ta==tb
    if not same:
        # how much of the old text survives
        import difflib
        r=difflib.SequenceMatcher(None,ta,tb).quick_ratio()
        print(f"  text       {round(r*100,1)}% similar  (old {len(ta)} chars, new {len(tb)})")
    else:
        print("  text       identical")

if __name__=='__main__':
    old,new=sys.argv[1],sys.argv[2]
    for f in sorted(glob.glob(os.path.join(old,'*.pdf'))):
        n=os.path.join(new,os.path.basename(f))
        if os.path.exists(n): cmp(f,n,os.path.basename(f))


# ---------------------------------------------------------------------------
# Pixel check. The text/style comparison above is blind to anything that is not
# text — it missed a decorative disc on every cover once. This renders both PDFs
# and reports how many pixels differ, which catches shapes, images and colour.
# ---------------------------------------------------------------------------
def pixels(old_dir, new_dir, dpi=100, tol=64):
    # tol=64 on purpose: identical text rendered a tenth of a point apart still
    # flips the anti-aliased edge pixels of every glyph, which reads as ~6% of a
    # page at tol=8 while looking pixel-identical. 64 only catches real changes.

    import subprocess, tempfile, os, glob as _g
    try:
        from PIL import Image, ImageChops
    except ImportError:
        print('  (pixel check skipped — Pillow not installed)'); return
    print('\n=== pixel comparison ===')
    worst = 0.0
    for f in sorted(_g.glob(os.path.join(old_dir, '*.pdf'))):
        name = os.path.basename(f)
        n = os.path.join(new_dir, name)
        if not os.path.exists(n): continue
        with tempfile.TemporaryDirectory() as td:
            for tag, src in (('o', f), ('nw', n)):
                subprocess.run(['pdftoppm', '-r', str(dpi), '-png', src,
                                os.path.join(td, tag)], check=True)
            a = sorted(_g.glob(os.path.join(td, 'o-*.png')))
            b = sorted(_g.glob(os.path.join(td, 'nw-*.png')))
            pct = []
            for pa, pb in zip(a, b):
                ia, ib = Image.open(pa).convert('L'), Image.open(pb).convert('L')
                if ia.size != ib.size: pct.append(100.0); continue
                d = ImageChops.difference(ia, ib).point(lambda v: 255 if v > tol else 0)
                pct.append(100.0 * sum(d.point(bool).getdata()) / (d.width * d.height))
            if not pct: continue
            mx = max(pct); worst = max(worst, mx)
            flag = '' if mx < 1 else '   <<< look at this one'
            print(f'  {name:<38} pages {len(a)}/{len(b)}  worst page {mx:5.2f}% px differ{flag}')
    print(f'  worst page overall: {worst:.2f}%')

if __name__ == '__main__' and len(sys.argv) > 3 and sys.argv[3] == '--pixels':
    pixels(sys.argv[1], sys.argv[2])
