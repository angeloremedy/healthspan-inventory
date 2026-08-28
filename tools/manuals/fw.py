"""Manual layout framework — rebuilt to match the existing PDFs by measurement.

Every number here was read off the shipped manuals with pdfplumber, not chosen:

  page          A4, 595.3 x 841.9 pt
  frame         x=51.02 (18mm), width 493.23, bottom 51.02; text inset 6 / 5.845
  running head   full-width bar 595 x 31 in #00168F, white bold 8pt at x=51,
                 baseline top≈14.3; role name left, hq.healthspan.ph right
  cover         full-bleed #00168F, logo at (51, 78) sized 119 x 70
  H1            DejaVu Sans Bold 17pt  #00168F   space before 14, after 6
  H2            DejaVu Sans Bold 12.5pt #00168F  space before 10, after 4
  body          DejaVu Sans 9.5pt #1A2030, leading 14.0
  list item     same, indented to x=77, 3pt between items
  small print   DejaVu Sans 8pt #5A6270
  panel/table   fill #F2F5FC, width 493

DejaVu is used because the peso sign and the arrows must render.
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, KeepTogether, Table, TableStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os, glob

BLUE  = HexColor('#00168F')
INK   = HexColor('#1A2030')
MUT   = HexColor('#5A6270')
PANEL = HexColor('#F2F5FC')
W, H  = A4
M     = 51.0236       # frame left/right — 18mm, measured off the panels
FRAME_W = 493.2284

def _font(name, files):
    for f in files:
        if os.path.exists(f):
            pdfmetrics.registerFont(TTFont(name, f)); return True
    return False

def register_fonts():
    hits = glob.glob('/usr/share/fonts/**/DejaVuSans.ttf', recursive=True)
    bold = glob.glob('/usr/share/fonts/**/DejaVuSans-Bold.ttf', recursive=True)
    ok  = _font('DVS', hits)
    okb = _font('DVB', bold)
    if not (ok and okb):
        raise SystemExit('DejaVu fonts not found — apt-get install fonts-dejavu (the peso sign needs them)')
    pdfmetrics.registerFontFamily('DVS', normal='DVS', bold='DVB', italic='DVS', boldItalic='DVB')
register_fonts()

# The right inset is fitted, not guessed: 5.83-5.86 all reproduce the shipped
# pagination exactly and anything outside that window changes where lines break.
# tools/manuals/diffcheck.py re-fits it if the DejaVu build ever changes.
RIGHT_INSET = 5.845

# Text is inset 6pt on BOTH sides of the 493pt frame (measured: body runs 57→538),
# but the tinted panels and tables bleed to the full frame width from x=51 — which is
# why the inset lives on the styles and the frame itself carries zero padding.
S_H1    = ParagraphStyle('h1', fontName='DVB', fontSize=17, leading=21, textColor=BLUE,
                         spaceBefore=14, spaceAfter=6, leftIndent=6, rightIndent=RIGHT_INSET)
S_H2    = ParagraphStyle('h2', fontName='DVB', fontSize=12.5, leading=16, textColor=BLUE,
                         spaceBefore=10, spaceAfter=4, leftIndent=6, rightIndent=RIGHT_INSET)
S_BODY  = ParagraphStyle('p',  fontName='DVS', fontSize=9.5, leading=14, textColor=INK,
                         spaceAfter=5, leftIndent=6, rightIndent=RIGHT_INSET)
# The originals do not use reportlab bullets: the number is literal text and the
# continuation lines sit flush under it (both at x=77), so there is no hanging indent.
S_STEP  = ParagraphStyle('li', fontName='DVS', fontSize=9.5, leading=14, textColor=INK,
                         spaceAfter=3, leftIndent=26, rightIndent=RIGHT_INSET)
S_SMALL = ParagraphStyle('sm', fontName='DVS', fontSize=8, leading=11.5, textColor=MUT,
                         spaceAfter=5, leftIndent=6, rightIndent=RIGHT_INSET)
S_TH    = ParagraphStyle('th', fontName='DVB', fontSize=8.5, leading=11, textColor=HexColor('#FFFFFF'))
S_TD    = ParagraphStyle('td', fontName='DVS', fontSize=8.5, leading=12, textColor=INK)

S_CALL  = ParagraphStyle('call', fontName='DVS', fontSize=9, leading=13, textColor=INK)

def gap(h):  return Spacer(1, h)
def h1(t):   return Paragraph(t, S_H1)
def h2(t):   return Paragraph(t, S_H2)
def p(t):    return Paragraph(t, S_BODY)
def small(t):return Paragraph(t, S_SMALL)
def B(t):    return '<b>' + t + '</b>'
def steps(items, start=1):
    """items: strings, or (number, text) pairs when the source PDF numbered them."""
    out = []
    for i, it in enumerate(items):
        n, t = it if isinstance(it, (tuple, list)) else (start + i, it)
        out.append(Paragraph(str(n) + '. ' + t, S_STEP))
    return out
GRID = HexColor('#D7DEEE')   # 0.4pt table rules, measured

def callout(t, border=None):
    """The tinted note boxes (TIP —, AVAILABLE TO PROMISE — ...): 9pt on #F2F5FC,
    the full 493pt frame width, measured off the originals."""
    tb = Table([[Paragraph(t, S_CALL)]], colWidths=[FRAME_W], hAlign='LEFT')
    tb.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), PANEL),
        ('LEFTPADDING', (0, 0), (-1, -1), 8), ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6), ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ] + ([('BOX', (0, 0), (-1, -1), 0.75, HexColor(border))] if border else [])))
    return tb

def table(head, rows, widths=None):
    data = [[Paragraph(h, S_TH) for h in head]] + [[Paragraph(str(c), S_TD) for c in r] for r in rows]
    if not widths:
        widths = [187, 168, 138] if len(head) == 3 else [FRAME_W / len(head)] * len(head)
    t = Table(data, colWidths=widths, hAlign='LEFT')
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BLUE),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [HexColor('#FFFFFF'), PANEL]),  # white row first
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6), ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        # full 0.4pt #D7DEEE grid: box, row rules and column rules
        ('BOX', (0, 0), (-1, -1), 0.4, GRID),
        ('INNERGRID', (0, 0), (-1, -1), 0.4, GRID),
    ]))
    return t

LOGO = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'logo_white.png')

def _wrap(text, font, size, width):
    """Greedy word wrap for the canvas-drawn cover title."""
    words, lines, cur = text.split(), [], ''
    for w in words:
        trial = (cur + ' ' + w).strip()
        if cur and pdfmetrics.stringWidth(trial, font, size) > width:
            lines.append(cur); cur = w
        else:
            cur = trial
    if cur: lines.append(cur)
    return lines or ['']

def build(path, role_title, audience, story, foot_note, kicker='User Manual',
          dateline='hq.healthspan.ph · %s · the app updates weekly — this manual describes what is live today'):
    def cover(canv, doc):
        """Measured off the shipped covers, not designed:

          logo          x=51, top=77.7, 119.1 x 69.7
          HEALTHSPAN HQ DejaVuSans REGULAR 15pt, x=57, glyph top 259.1
          role + kicker DejaVuSans-Bold 30pt, x=57, first line top 292.0, leading 36
                        — one flowing block, so a long role wraps and pushes the
                          kicker down (that is why the IT cover runs to three lines)
          audience      DejaVuSans 13pt, 48.9 below the last title line
          dateline      DejaVuSans 9.5pt, 158.9 below the audience line
        """
        TX = M + 6                       # cover text is indented like body text
        AS = 0.7593                      # glyph-top → baseline, fitted on these covers
        # only the 30pt title is pure white; the brand line, the audience line and
        # the dateline are the paler #C8D6FF — measured, not a design choice
        WHITE, PALE = HexColor('#FFFFFF'), HexColor('#C8D6FF')
        def put(size, bold, top, text):
            canv.setFillColor(WHITE if bold else PALE)
            canv.setFont('DVB' if bold else 'DVS', size)
            canv.drawString(TX, H - (top + size * AS), text)
        canv.saveState()
        canv.setFillColor(BLUE); canv.rect(0, 0, W, H, fill=1, stroke=0)
        # the decorative disc bleeding off the top-right corner: #1226A0,
        # centre (538.6, 813.5), r=170.1 — measured, it is on every cover
        canv.setFillColor(HexColor('#1226A0'))
        canv.circle(538.6, 813.5, 170.1, fill=1, stroke=0)
        if os.path.exists(LOGO):
            try: canv.drawImage(LOGO, M, H - 147.4, width=119.1, height=69.7, mask='auto')
            except Exception: pass
        put(15, False, 259.1, 'HEALTHSPAN HQ')
        top = 292.0
        for block in (role_title, kicker):
            for line in _wrap(block, 'DVB', 30, FRAME_W - 12):
                put(30, True, top, line); top += 36
        top += 12.9                      # 48.9 below the last title line, less its 36
        put(13, False, top, audience)
        put(9.5, False, top + 158.9, dateline)
        canv.restoreState()
    def later(canv, doc):
        canv.saveState()
        canv.setFillColor(BLUE); canv.rect(0, H - 31, W, 31, fill=1, stroke=0)
        canv.setFillColor(HexColor('#FFFFFF')); canv.setFont('DVB', 8)
        canv.drawString(M, H - 20.5, 'HEALTHSPAN HQ — ' + role_title.upper() + ' MANUAL')
        canv.drawRightString(W - M, H - 20.5, 'hq.healthspan.ph')
        # footer, measured off the originals: 8pt muted, baseline y≈22.7,
        # the role's one-line reminder on the left and "Page N" on the right,
        # numbered from the first body page (the cover is not page 1)
        canv.setFillColor(MUT); canv.setFont('DVS', 8)
        canv.drawString(M, 22.7, foot_note)
        canv.drawRightString(W - M, 22.7, 'Page ' + str(canv.getPageNumber() - 1))
        canv.restoreState()
    doc = BaseDocTemplate(path, pagesize=A4, leftMargin=M, rightMargin=M,
                          topMargin=44, bottomMargin=44, title='Healthspan HQ — ' + role_title + ' Manual',
                          author='Healthspan Global, Inc.')
    # zero padding: reportlab defaults to 6pt all round, which shifted every
    # measured x by +6 (body 63 instead of 57, steps 83 instead of 77)
    # 4.5pt top inset: measured, the first heading of a body page sits at top=52.6
    pad = dict(leftPadding=0, rightPadding=0, topPadding=4.5, bottomPadding=0, showBoundary=0)
    fcover = Frame(M, 51.0236, FRAME_W, H - 44 - 51.0236, id='cover', **pad)
    fbody  = Frame(M, 51.0236, FRAME_W, H - 44 - 51.0236, id='body',  **pad)
    doc.addPageTemplates([PageTemplate(id='cover', frames=[fcover], onPage=cover),
                          PageTemplate(id='body',  frames=[fbody],  onPage=later)])
    from reportlab.platypus import NextPageTemplate, PageBreak
    flow = [NextPageTemplate('body'), PageBreak()] + list(story)
    doc.build(flow)
