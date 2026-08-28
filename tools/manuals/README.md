# Manual toolkit

Rebuilds the nine role manuals in `manuals/`. Every layout number in `fw.py` was
measured off the shipped PDFs rather than chosen, so regenerating does not
redesign anything.

## The four scripts

| File | What it does |
|---|---|
| `extract.py` | Reads the shipped PDFs back into `content/*.json` — headings, paragraphs, numbered steps, tables, callouts, deliberate spacers. |
| `fw.py` | The layout: page, frame, styles, cover, running head, footer, tables, callouts. |
| `compose.py` | Renders `content/*.json` into PDFs. |
| `diffcheck.py` | Compares old against new — geometry, styles, text, and rendered pixels. |

## Editing a manual

Edit the JSON in `content/`, not the PDF:

```bash
cd tools/manuals
python3 compose.py ../../manuals-new      # build to a scratch folder
python3 diffcheck.py ../../manuals ../../manuals-new --pixels
```

Read the diff before copying anything over `manuals/`. `--pixels` is the check
that matters — it catches things the text comparison cannot see, which is how the
decorative disc on the cover and the table grid were found missing.

To re-derive the content from the shipped PDFs (only needed if `content/` is lost):

```bash
python3 extract.py ../../manuals content
```

## Requirements

`reportlab`, `pdfplumber`, `Pillow`, `poppler-utils` (for `pdftoppm`), and the
DejaVu fonts — `apt-get install fonts-dejavu`. DejaVu is not decorative: the peso
sign and the arrows in the manuals do not render without it.

## Where the numbers came from

Measured, and re-measurable with `diffcheck.py`:

- page A4; frame x=51.02 (18mm), width 493.23, bottom 51.02
- text inset 6pt left / 5.845pt right; numbered steps indent to x=77 with the
  number as literal text, no hanging indent
- H1 DejaVuSans-Bold 17/21, space 14 before and 6 after
- H2 DejaVuSans-Bold 12.5/16, space 10 before and 4 after
- body DejaVuSans 9.5/14 in `#1A2030`; steps 3pt apart
- running head: 595x31 bar in `#00168F`, white bold 8pt
- footer: 8pt `#5A6270`, the role's reminder left, "Page N" right, counted from
  the first body page
- cover: full bleed `#00168F`, a `#1226A0` disc at (538.6, 813.5) r=170.1, logo at
  (51, 77.7) 119.1x69.7, brand 15pt regular, role and kicker 30pt bold on 36
  leading as one flowing block
- callouts: `#F2F5FC` fill, full frame width, 0.75pt border — green `#0E8A5F`,
  amber `#B7791F` — the colour is stored per callout in the JSON
- cover text: the 30pt title is white, the brand/audience/dateline lines are `#C8D6FF`
- tables: full 0.4pt `#D7DEEE` grid, blue header row, white row first,
  column widths taken from the header bar

The right inset (5.845) is fitted, not measured: 5.83–5.86 all reproduce the
shipped pagination exactly. If the installed DejaVu ever changes, re-fit it by
sweeping the value and taking the one with the fewest differing pages.

## Verification status

Reproduction was verified against the previously shipped PDFs before any content
was added: 9/9 page counts identical, covers identical to 0.1pt (including the IT
title that wraps to three lines), 77/80 body pages laid out identically (the 3
exceptions each move one word across a line break), vector rules and borders
identical in count, position, width and colour, and a worst page of 0.57% at a
real-difference pixel threshold.

The shipped manuals now include the Favourites section and the role-aware list of
where files attach, so they are intentionally longer than that baseline.
