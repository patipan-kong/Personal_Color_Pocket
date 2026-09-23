# Personal Color Pocket V1.1 — Asset Generation Checklist

This is the production contract for the externally generated Visual Quiz assets. V1.1
contains no placeholder image files. Generate, review, and add an asset to
`installedQuizVisualAssets` only after the matching WebP exists at the exact path below.

## Global controls for every set

- Export WebP, sRGB, 1200 × 1500 px (4:5). Keep the subject and comparison area inside a
  central safe area so three cards remain readable at 390 px.
- Within one question and presentation, lock person/reference design, pose, crop,
  expression, hairstyle, background, camera, lens, exposure, white balance, skin
  rendering, and post-processing. Change only the named test property.
- Do not add labels, season names, subtype names, scores, UI, decorative borders, or
  baked-in text. The product supplies localized captions.
- Do not make the example person the answer. Show the property or its effect clearly;
  users compare that cue with their own face/features.
- Keep skin texture natural and identical across a controlled set. Do not lighten,
  darken, warm, cool, smooth, or recolor skin between variants.
- Men/Women are clothing-presentation preferences only. Match framing, lighting, and
  tested color values across both sets as closely as practical.
- Reject a set if hue, temperature, chroma, value, contrast, lighting, or styling changes
  beyond the property explicitly isolated below.

## Matrix summary

| Question | Visual type | Presentation | Variants | Files |
|---|---|---:|---:|---:|
| Q01 Undertone | model triptych | Men + Women | 3 each | 6 |
| Q02 Metal | jewelry comparison | Men + Women | 3 each | 6 |
| Q03 White | model triptych | Men + Women | 3 each | 6 |
| Q04 Warm colors | model triptych | Men + Women | 3 each | 6 |
| Q05 Cool colors | model triptych | Men + Women | 3 each | 6 |
| Q06 Hair | portrait hair reference | Men + Women | 3 each | 6 |
| Q07 Eyes | close-up eye reference | Men + Women | 3 each | 6 |
| Q08 Contrast | controlled portrait reference | Men + Women | 3 each | 6 |
| Q09 Intensity | controlled chroma triptych | Men + Women | 3 each | 6 |
| Q10 Clarity | controlled clarity triptych | Men + Women | 3 each | 6 |
| Q11 Depth | controlled value triptych | Men + Women | 3 each | 6 |

**Total contract: 66 reviewed assets. Q01–Q11 are installed: 66. The count increased from 57 to 66 because every portrait/reference question now follows the selected Women/Men presentation.**

## Q01 — Undertone

Approved source-crop exception: the Q01 masters provide clean portrait panels after
annotation-safe inspection. Keep the six installed assets at 432 × 540 px (4:5). Both
presentations use panel boxes x=0–509, 512–1021, 1026–1535 and the production-safe
vertical range y=0–638; source infographic content begins below the portrait region
(Men y=767, Women y=743). These bounds exclude headings, descriptions, Thai text,
swatches, separators, and footer content.

Property isolated: warm / cool / neutral color context around the **same face**. The
model's skin shade and rendering must be identical. Use a close head-and-shoulders crop,
neutral background, natural expression, and a large drape directly below the face. Do
not depict three people or three skin tones.

Women — 3 variants:

- [x] `/img/quiz/q01-undertone/women/golden.webp` — warm controlled drape; golden/peach context.
- [x] `/img/quiz/q01-undertone/women/rosy.webp` — cool controlled drape; blue/rose context.
- [x] `/img/quiz/q01-undertone/women/neutral.webp` — balanced neutral context.

Men — 3 variants:

- [x] `/img/quiz/q01-undertone/men/golden.webp`
- [x] `/img/quiz/q01-undertone/men/rosy.webp`
- [x] `/img/quiz/q01-undertone/men/neutral.webp`

Generation constraint: only the drape color family changes. Preserve brightness and
saturation closely enough that temperature—not intensity—drives the comparison.

## Q02 — Metal

Approved source-crop exception: the Q02 masters provide clean portrait panels after
annotation-safe crops. Keep the six installed assets at native 432 × 540 px (4:5)
resolution rather than upscaling them. Men uses source y=129–769; Women uses source
y=129–742; both crops retain face, necklace/earring, and wrist-watch context while
excluding the upper-right annotation and infographic footer.

Property isolated: gold / silver / mixed metal near skin. Use the same close crop, skin,
garment, jewelry scale, placement, and specular-light intensity. Keep jewelry design
simple and equivalent (for example, the same earring/necklace or collar pin/watch).

Women — 3 variants:

- [x] `/img/quiz/q02-metal/women/gold.webp`
- [x] `/img/quiz/q02-metal/women/silver.webp`
- [x] `/img/quiz/q02-metal/women/both.webp`

Men — 3 variants:

- [x] `/img/quiz/q02-metal/men/gold.webp`
- [x] `/img/quiz/q02-metal/men/silver.webp`
- [x] `/img/quiz/q02-metal/men/both.webp`

Generation constraint: metal color is the only change. The mixed image must show equal
visual weight for gold and silver, not a third metal or a dominant favorite.

## Q03 — White

Pilot export exception: the approved source triptychs provide 480 × 600 px portrait
panels. Keep the six installed pilot crops at that native 4:5 resolution rather than
upscaling them; the 1200 × 1500 px target above remains the contract for newly generated
sets.

Property isolated: garment white point. Same model, pose, shirt construction, crop,
lighting, background, and exposure; only the shirt/drape color changes.

Women — 3 variants:

- [x] `/img/quiz/q03-white/women/ivory.webp` — ivory, target reference near `#FFF1D6`.
- [x] `/img/quiz/q03-white/women/optic.webp` — pure/optic white, near `#FFFFFF` without clipping texture.
- [x] `/img/quiz/q03-white/women/soft-white.webp` — soft neutral white, near `#F5F3EE`.

Men — 3 variants:

- [x] `/img/quiz/q03-white/men/ivory.webp`
- [x] `/img/quiz/q03-white/men/optic.webp`
- [x] `/img/quiz/q03-white/men/soft-white.webp`

Generation constraint: retain fabric folds and detail in all whites; do not change skin
exposure or background white balance to exaggerate the difference.

## Q04 — Warm / earthy colors

Approved source-crop exception: the Q04 masters provide clean portrait panels after
annotation-safe crops. Keep the six installed assets at 432 × 540 px (4:5) using the
Men source y=129–767 and Women source y=129–742 bounds; the crop excludes the upper-right
annotation, panel separators, and infographic footer.

Property observed: how a controlled warm/earthy family behaves near the user's face.
Use one locked model per presentation with camel, terracotta, olive, and warm brown
visible as a coordinated drape/garment set. Captions outside the image express the three
possible user observations; do **not** fake glow or dullness by retouching the model.

Women — 3 answer-linked reference variants:

- [x] `/img/quiz/q04-warm-colors/women/glow.webp`
- [x] `/img/quiz/q04-warm-colors/women/heavy.webp`
- [x] `/img/quiz/q04-warm-colors/women/mixed.webp`

Men — 3 answer-linked reference variants:

- [x] `/img/quiz/q04-warm-colors/men/glow.webp`
- [x] `/img/quiz/q04-warm-colors/men/heavy.webp`
- [x] `/img/quiz/q04-warm-colors/men/mixed.webp`

Recommended composition: a consistent warm-family contact sheet within each card. For
`mixed`, soften chroma slightly while keeping hue/value stable. For `glow` and `heavy`,
keep the reference palette identical; the user's own observation—not a manipulated model
face—determines the answer.

## Q05 — Cool colors

Approved source-crop exception: the Q05 masters provide clean portrait panels after
annotation-safe crops. Keep the six installed assets at 432 × 540 px (4:5); Men uses
source boxes x=0–509, 512–1021, 1026–1535 with y=129–767, and Women uses
x=10–500, 522–1012, 1036–1526 with y=129–742. These bounds exclude headings,
descriptions, swatches, separators, the SAME PERSON annotation, and infographic footer.

Property observed: how a controlled cool family behaves near the user's face. Use cool
blue, berry pink, blue-based red, and cool navy with one locked model. Do not cool, pale,
or brighten the model's skin to simulate an answer.

Women — 3 answer-linked reference variants:

- [x] `/img/quiz/q05-cool-colors/women/clear.webp`
- [x] `/img/quiz/q05-cool-colors/women/drain.webp`
- [x] `/img/quiz/q05-cool-colors/women/soft-best.webp`

Men — 3 answer-linked reference variants:

- [x] `/img/quiz/q05-cool-colors/men/clear.webp`
- [x] `/img/quiz/q05-cool-colors/men/drain.webp`
- [x] `/img/quiz/q05-cool-colors/men/soft-best.webp`

Recommended composition: consistent cool-family contact sheet. `soft-best` may reduce
chroma while preserving cool temperature and value. `clear` and `drain` use the same
clear-cool references; the labels describe what the user observes on themself.

## Q06 — Natural hair depth

Approved source-crop exception: the Q06 RGB 1536 × 1024 master provides clean portrait
panels after separator-safe inspection. The white separators are x=511–512 and
x=1023–1024; the infographic begins at y=739. Keep the six installed assets at
432 × 540 px (4:5) using source boxes x=0–509, 513–1022, 1025–1534 and y=0–638
(inclusive notation; Pillow half-open boxes end at x=510/1023/1535 and y=639).
These bounds exclude headings, descriptions, Thai text, swatches, separators, and the
infographic footer.

Property isolated: light / medium / deep natural hair value, not ethnicity, hairstyle,
age, or dye fashion. Use one locked portrait per presentation with glasses/garment,
neutral background, expression, and lighting held constant. The hair is the controlled
cue; skin, eyewear, top, and background remain stable.

Approved source-crop exceptions:

- Women uses the already accepted Q06 master: x=0–509, 513–1022, 1025–1534 and
  y=0–638 (inclusive notation; Pillow half-open ends x=510/1023/1535 and y=639).
- Men uses the matching 1536 × 1024 triptych with the same separator-safe portrait
  boxes and y=0–638. Production crops are 432 × 540 px RGB WebP, quality 88,
  method 6.

Women — 3 variants:

- [x] `/img/quiz/q06-hair/women/light.webp`
- [x] `/img/quiz/q06-hair/women/medium.webp`
- [x] `/img/quiz/q06-hair/women/deep.webp`

Men — 3 variants:

- [x] `/img/quiz/q06-hair/men/light.webp`
- [x] `/img/quiz/q06-hair/men/medium.webp`
- [x] `/img/quiz/q06-hair/men/deep.webp`

Generation constraint: keep hue family, gloss, texture, crop, and lighting constant;
change only hair value/depth. Presentation changes the person/reference only, never the
canonical answer meaning.

## Q07 — Natural eye impression

Property isolated: light-clear / soft-mixed / deep-clear natural eye impression. Use
one locked close-up eye reference per presentation. The iris value and pattern clarity
change; person identity, brow/skin rendering, gaze, catchlight, makeup level, and
framing stay stable. Men retains the same glasses and frame/reflection relationship in
all three cards.

Approved source-crop exception: the Women and Men Q07 masters are 1774 × 887 with
portrait panels x=0–589, 592–1181, 1184–1773 and y=0–549. Each panel is center-cropped
to x-width 440 (x=75–514, 667–1106, 1259–1698 in inclusive notation) before the
standard 432 × 540 RGB WebP export. This preserves both eyes for Women and the full
glasses-framed reference eye for Men without letterboxing or source text.

Women — 3 variants:

- [x] `/img/quiz/q07-eyes/women/light-clear.webp`
- [x] `/img/quiz/q07-eyes/women/soft-mixed.webp`
- [x] `/img/quiz/q07-eyes/women/deep-clear.webp`

Men — 3 variants:

- [x] `/img/quiz/q07-eyes/men/light-clear.webp`
- [x] `/img/quiz/q07-eyes/men/soft-mixed.webp`
- [x] `/img/quiz/q07-eyes/men/deep-clear.webp`

Generation constraint: light-clear and deep-clear retain visible iris definition;
soft-mixed reads as the more blended/multi-tone reference. Do not use brightness,
makeup, blur, catchlight, or glasses-reflection changes to make an answer preferable.

## Q08 — Facial contrast

Property isolated: **relative difference** among skin, hair, eyes, and brows—not whether
a person is light or dark. Use one locked portrait per presentation with stable pose,
expression, skin rendering, background, garment, glasses (Men), and lighting. Low,
medium, and high are feature-separation references; they are not a beauty or preference
ladder.

Approved source-crop exceptions: the 1774 × 887 Women master uses panel boxes
x=0–589, 592–1181, 1184–1773 and portrait y=0–594; the Men master uses the same
panel x ranges and portrait y=0–595. Each panel is center-cropped to x-width 476 before
the standard 432 × 540 RGB WebP export, excluding labels, swatches, separators, and
footer text.

Women — 3 variants:

- [x] `/img/quiz/q08-contrast/women/low.webp`
- [x] `/img/quiz/q08-contrast/women/medium.webp`
- [x] `/img/quiz/q08-contrast/women/high.webp`

Men — 3 variants:

- [x] `/img/quiz/q08-contrast/men/low.webp`
- [x] `/img/quiz/q08-contrast/men/medium.webp`
- [x] `/img/quiz/q08-contrast/men/high.webp`

Generation constraint: skin/background/garment exposure stays stable while the
skin–hair–brow–eye separation increases low → medium → high. Hair is a contributor but
must not be the only cue; brows and eyes remain materially involved so Q08 does not
duplicate Q06 Hair Depth.

## Q09 — Intensity / chroma

Approved source-crop exception: the Q09 masters provide clean 432 × 540 px portrait
panels after the common annotation-safe crop. Keep the six installed assets at that
native 4:5 resolution rather than upscaling them.

Property isolated: muted / balanced / bright-clear chroma. Use the same model, garment,
pose, and two fixed hue families (coral and green). Keep temperature and value closely
matched; only chroma changes.

Women — 3 variants:

- [x] `/img/quiz/q09-intensity/women/muted.webp`
- [x] `/img/quiz/q09-intensity/women/balanced.webp`
- [x] `/img/quiz/q09-intensity/women/bright.webp`

Men — 3 variants:

- [x] `/img/quiz/q09-intensity/men/muted.webp`
- [x] `/img/quiz/q09-intensity/men/balanced.webp`
- [x] `/img/quiz/q09-intensity/men/bright.webp`

Generation constraint: do not make brighter variants lighter, darker, warmer, or cooler.
Do not increase exposure or contrast; increase color saturation only.

## Q10 — Clarity

Approved source-crop exception: the Q10 masters provide clean 432 × 540 px portrait
panels after the common annotation-safe crop. Keep the six installed assets at that
native 4:5 resolution rather than upscaling them.

Property isolated: dusty/muted / intermediate / fresh-clear. Use a second controlled set
that is visually distinct from Q09 but still holds hue, temperature, value, model, and
lighting constant. A soft coral and green family is recommended.

Women — 3 variants:

- [x] `/img/quiz/q10-clarity/women/muted.webp`
- [x] `/img/quiz/q10-clarity/women/balanced.webp`
- [x] `/img/quiz/q10-clarity/women/clear.webp`

Men — 3 variants:

- [x] `/img/quiz/q10-clarity/men/muted.webp`
- [x] `/img/quiz/q10-clarity/men/balanced.webp`
- [x] `/img/quiz/q10-clarity/men/clear.webp`

Generation constraint: muted means controlled gray admixture, not blur, haze, low image
quality, lower exposure, or a different hue. Fresh-clear must retain fabric detail.

## Q11 — Color depth / value

Approved source-crop exception: the Q11 masters provide clean 432 × 540 px portrait
panels after the common annotation-safe crop. Keep the six installed assets at that
native 4:5 resolution rather than upscaling them.

Property isolated: light / medium / deep value in the **same hue family**. Use the same
model, garment, pose, and paired blue/green families. Do not compare light yellow with
dark navy; temperature, hue, and chroma must remain stable.

Women — 3 variants:

- [x] `/img/quiz/q11-depth/women/light.webp`
- [x] `/img/quiz/q11-depth/women/medium.webp`
- [x] `/img/quiz/q11-depth/women/deep.webp`

Men — 3 variants:

- [x] `/img/quiz/q11-depth/men/light.webp`
- [x] `/img/quiz/q11-depth/men/medium.webp`
- [x] `/img/quiz/q11-depth/men/deep.webp`

Generation constraint: vary lightness only. Keep hue angle and saturation as close as
practical, and keep camera exposure identical so “light” does not mean overexposed and
“deep” does not mean underexposed.

## Integration acceptance check

For each completed set:

- [x] Every file exists at the exact path and has the required dimensions/profile.
- [x] Side-by-side pixel review confirms the isolation controls above.
- [x] Men/Women asset mapping is correct where applicable.
- [x] The option-specific alt-text key in the typed manifest matches the asset.
- [x] Paths are added one-by-one to `installedQuizVisualAssets`; no glob or optimistic
  path assumption is used.
- [x] Missing siblings still render deterministic fallbacks with no broken-image icon.
- [x] TH/EN captions, visual selection, text selection, keyboard selection, enlargement,
  and quiz completion pass after integration.
