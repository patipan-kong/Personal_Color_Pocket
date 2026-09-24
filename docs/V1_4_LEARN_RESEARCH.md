# V1.4 Learn — Research Notes and Source Register

Companion to [V1_4_LEARN_PLAN.md](V1_4_LEARN_PLAN.md), which governs. This file records what was researched, what each source supports, and where sources disagree. All sources were accessed on 2026-09-24. They are for authoring and provenance only: runtime Learn content never fetches them.

## 1. Method

- **Repository first.** The app's own model — `seasons.ts`, `palettes.ts`, `quiz.ts`, `scoring.ts`, `i18n/*`, `photoColor/*`, `luckyColor/*` and the V1.2/V1.3 docs — is the truth for everything product-specific.
- **External sources only for general concepts** the app does not define: what colour attributes mean, where seasonal analysis comes from, how systems differ, why photos misrepresent colour, and how strong the evidence is.
- **Source preference:**
  1. primary or academic sources;
  2. publisher or originator pages;
  3. established references (Britannica, Wikipedia as a secondary index).

  Practitioner and commercial pages were used only to *observe* naming differences between systems, never as proof of an effect.
- **Excluded:** SEO listicles, AI-generated "guides", quiz sites and social media.

Several search results were commercial personal-colour apps; they are not used as sources.

## 2. Source register

| ID | Source | Claim it supports | How Learn uses it | Confidence / limitation |
|---|---|---|---|---|
| L1 | Johannes Itten, *The Art of Color*, Wiley, New York, 1961. Summarised in [Wikipedia: Color analysis (art)](https://en.wikipedia.org/wiki/Color_analysis_(art)) and [Johannes Itten](https://en.wikipedia.org/wiki/Johannes_Itten). | Seasonal colour thinking comes from art education; Itten linked people's "subjective colours" to the four seasons. | One history line in "What is Personal Color?" (Level 3). | High for the attribution; the book was not read directly, only secondary summaries. |
| L2 | Carole Jackson, *Color Me Beautiful*, 1980; [Color Me Beautiful: color analysis](https://colormebeautiful.com/pages/color-analysis) (originator's current site). | The four-season consumer system (Spring/Summer/Autumn/Winter) was popularised around 1980. The originator today still presents four seasons, built on undertone, depth and intensity. | History line; supports "the four seasons are the classic system". | High. The originator site is commercial; used only for what the system says about itself. |
| L3 | Mary Spillane & Christine Sherlock, *Color Me Beautiful's Looking Your Best*, 1995 ([publisher page](https://www.simonandschuster.com/books/Color-Me-Beautifuls-Looking-Your-Best/Mary-Spillane/9781568330372)). | The seasonal system was later expanded to 12 palettes. | Supports "why there are 12 types": each season splits by its most defining quality. | Medium. The publisher page confirms the 12-palette expansion. The exact "Light/Deep/Warm/Cool/Clear/Soft" tonal names are widely attributed to this lineage, but that was not confirmed from a primary page. |
| L4 | Sci\ART / Kathryn Kalisz lineage, via practitioner descriptions ([Chrysalis Colour: 12 Seasons](https://www.chrysaliscolour.com/about-us/12-seasons/)). | Another 12-season system uses different names: Light/True/Bright Spring; Light/True/Soft Summer; Soft/True/Deep Autumn; Bright/True/Deep (or Dark) Winter. | Only for the note that systems use different names. No mapping table is published. | Low–medium: practitioner source. Used only to show that naming differs, which is visible across many independent sites. |
| L5 | Jung Yun-Seok, "A Study on the Quantitative Diagnosis Model of Personal Color" (퍼스널컬러의 정량적 진단 모델 연구), *Journal of Convergence for Information Technology*, 2021 ([KoreaScience](https://koreascience.kr/article/JAKO202134255871647.page?lang=ko)). | Korean practice classifies personal colour with PCCS-style tone concepts. The author notes existing systems "oversimplify … or it is difficult to distinguish objective differences between diagnosis types", and proposes 20 types. | Supports "systems differ, including the Korean tone-based approach common in Thailand", and supports humility about precision. | Medium–high (peer-reviewed; abstract read, not the full text). |
| L6 | Practitioner comparison of Korean vs Western systems ([MyColoury](https://www.mycoloury.ca/colour-analysis-resources/korean-vs-16-season-colour-analysis)). | Korean systems divide seasons by *tone* (for example vivid, light, pale, soft, deep, dull), while Western systems divide by undertone, value and chroma. 12- and 16-type variants exist. | Only for the disagreement note. | Low (commercial practitioner). Corroborates L5 in direction only. |
| L7 | Munsell colour system: hue, value, chroma ([Britannica](https://www.britannica.com/science/Munsell-color-system); [Wikipedia](https://en.wikipedia.org/wiki/Munsell_color_system)). | Value is lightness/darkness. Chroma is strength or purity (bright vs dull), and a grey has chroma 0. Hue is the colour-name attribute (red, yellow…). | Defines Light ↔ Deep (value) and Soft ↔ Clear (chroma) in the dimensions topic. | High: standard colour-science vocabulary. Britannica blocked automated fetch, so the wording was verified through search excerpts and Wikipedia. The Munsell company blog now redirects to Pantone. |
| L8 | Josef Albers, *Interaction of Color*, Yale University Press, 1963 ([Yale Books](https://yalebooks.yale.edu/book/9780300179354/interaction-of-color/)). | The same colour can look different depending on the colours around it. | Supports "the same colour can look different next to other colours" (checker and same-name topics). | High (canonical design text). |
| L9 | D. H. Brainard & A. C. Hurlbert, "Colour Vision: Understanding #TheDress", *Current Biology* 25(13): R551–R554, 2015, doi:10.1016/j.cub.2015.05.020 (PMID 26126278). | A photo's colours depend on the illumination. When the lighting is ambiguous, the same image can be seen as different object colours; the visual system "corrects" for assumed lighting. | Supports the photo-limitation explanation. | High (peer-reviewed). |
| L10 | Cambridge in Colour, "White balance" tutorial ([cambridgeincolour.com](https://www.cambridgeincolour.com/tutorials/white-balance.htm)). | Cameras guess the light colour with auto white balance; under different light the recorded colour of the same object shifts. | Supports "the camera guesses the lighting". | Medium–high: an established photography education site. Content verified through search excerpts only. |
| L11 | D. I. Perrett & R. Sprengelmeyer, "Clothing aesthetics: consistent colour choices to match fair and tanned skin tones", *i-Perception* 12(6), 2021, doi:10.1177/20416695211053361 ([PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC8597069/)). | Observers agreed on clothing colours for faces, favouring cool blues for fair skin and warm orange-reds for tanned skin. The study is limited: 12 faces, all young White women, flat simulated clothing, uncontrolled screens. It does **not** validate seasonal systems. | Supports the modest claim that warm/cool harmony with skin is a real, shared perception, not proof of any 12-type system. | High for what it tested; the limitations must travel with the claim. |
| L12 | [Wikipedia: Color analysis (art)](https://en.wikipedia.org/wiki/Color_analysis_(art)), citing Jackson. | Jackson herself called the seasons "a convenient artifice", and the field is described as controversial because there are no standard qualifications. | Supports the tone: a styling framework, not a diagnosis. | Medium (secondary; the quote is attributed to Jackson through Wikipedia's citation). |

Internal records reused as sources:
- `docs/V1_2_SLICE_5E_REAL_WORLD_SAMPLING_INVESTIGATION.md` and `V1_2_SLICE_5F_PHOTO_LIGHTING_GUIDANCE.md`: real-world photo shifts, especially light near-neutral colours.
- `docs/V1_2_SLICE_7_COLOR_NAMES.md`: names are deliberately coarser than HEX.
- `docs/V1_3_SLICE_0_DOMAIN_RESEARCH.md`: lucky-colour sources and framing.

## 3. Where systems disagree (not hidden)

1. **How many types:** 4 (classic), 12 (tonal and Sci\ART lineages, and Korean 12-tone), 16 (Western variants), 20 (L5's proposal). There is no single standard.
2. **What the names mean:**
   - Personal Color Pocket uses tonal-style names: Light, Warm, Clear, Soft, Cool, Deep.
   - Sci\ART-style systems say *Bright* where the app says *Clear*, and *True* where the app says *Warm* or *Cool*.
   - Korean practice often names *tones* (light, mute, bright, deep, and so on).

   A user may meet "Bright Spring" or "Spring Warm Bright" elsewhere, which is roughly the region the app calls Clear Spring. The app does **not** claim exact equivalence.
3. **How a type is found:** in-person draping, colorimetry, questionnaires (this app) or AI photo tools. The app's result is a guided questionnaire estimate (existing disclaimer).
4. **Evidence:** warm/cool harmony with skin has some experimental support (L11). The fine-grained seasonal systems have no validated scientific standard (L5, L12).

**Consequence for Learn:**
- Learn teaches **Personal Color Pocket's model** and labels it as such ("In Personal Color Pocket…").
- It explains the general concepts (L7–L10) as general colour knowledge.
- It says once, plainly, that other systems exist, with other names and other numbers of types.
- It never publishes a cross-system mapping table, which would force a false consensus.

## 4. Claims Learn must not make

- Any colour makes a type "objectively more attractive".
- Seasons or types reflect personality or character.
- The quiz result is a diagnosis or a scientific measurement.
- Another system's types map exactly onto the app's types.
- A photo shows the garment's true or base colour, or that the checker corrects lighting.
- A lucky colour has a supernatural effect. Daily framing stays as frozen in V1.3: "Lucky colors follow a Thai daily tradition…".
- A colour **absent** from a palette is "harder". Only listed Harder colours are harder.

## 5. Open research items (non-blocking)

- A native Thai reader should review all Learn copy before release.
- L3's exact tonal naming could be confirmed from a physical copy of the 1995 book, if the PO wants the history line to name it. Until then, the history line names Itten and Jackson only, and says the system was "later expanded to 12 types".
