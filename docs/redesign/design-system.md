# The design system

The console is deleted and reimplemented against this document. Everything here is
binding: a reimplementation that follows it needs no further questions, and one that
departs from it is wrong unless this file is changed first.

Three things this design system is not. It is not a landing page, so the taste skill's
hero, imagery and marketing-density directives do not apply (`plan.md` §6 says so, and the
skill's own §13 agrees). It is not a second system: `@radix-ui/themes` is the whole of it,
and `@mantine/core` plus `@tabler/icons-react` leave the tree (`plan.md` §5). It is not a
greenfield product: what exists as *behaviour* today is inventoried in `console-surface.md`
and `app-surfaces.md`, and this document redesigns how it looks without inventing product
capability.

The one fact that governs every decision below: **the console is live.** Fleet state, event
rings, transcripts and access decisions stream and refresh on timers of 5 s, 10 s and 30 s
while a human reads them.

---

## 1. The design read and the dials

Design read, verbatim from `plan.md` §6:

> Reading this as: an operator console for a running agent host, for the developers and
> operators who live in it daily, with a Linear-style dark-tech language, leaning toward
> `@radix-ui/themes` locked to one appearance + Geist + a single restrained accent.

Dials, also fixed there: `DESIGN_VARIANCE: 3`, `MOTION_INTENSITY: 3`, `VISUAL_DENSITY: 7`.

### What each dial means here, concretely

**`DESIGN_VARIANCE: 3` means one control looks the same everywhere.** A filter is a
`SegmentedControl.Root` on every screen that has one, a destination is a `Button`, a status
is a `Badge` with a tone. No screen composes its own header, no screen invents its own row
shape, no surface is asymmetric for composition's sake. An operator builds muscle memory in
the first hour and it holds for the next thousand. Home is a uniform grid, never a bento.

**`MOTION_INTENSITY: 3` means nothing on a timer moves, ever.** Level 1 to 3 in the skill is
explicit: "no automatic animations, CSS `:hover` and `:active` states only". So the entire
motion vocabulary is interaction feedback plus user-initiated overlay transitions, and
nothing else. A live region that animates is a bug in this design, not a flourish.

**`VISUAL_DENSITY: 7` means the data is the product.** Mono for every id, tool name,
revision, duration, path, hash and number. 32 px table rows. One hairline per row. No
decorative whitespace, and surfaces used only where they carry hierarchy. Section 5 has the
numbers.

### The locked accent and the theme lock

`accentColor="jade"`, `grayColor="gray"`, `radius="medium"`, `scaling="100%"`,
`panelBackground="solid"`, set once on one `<Theme>` at the root of the client tree.

The console keeps today's accent (`console-theme.tsx` sets `accentColor="jade"`). Reasons, in
order of weight: it is already the platform's green and a redesign that repaints the brand
for no product gain spends risk for nothing; it is a high-contrast singular accent on a
neutral base, which is what the skill's §4.2 asks for; and it is nowhere near the AI-purple
the Lila rule exists to prevent, so no override is being claimed. `gray` (pure neutral) stays
because a warm neutral and a cool neutral cannot drift into each other, which is what "one
palette per project" needs.

**"Locked to one appearance" is the Theme Lock, not the removal of the appearance control.**
Exactly one `<Theme>` exists and it is the root. `appearance` is resolved once there from the
operator's stored choice and defaults to `dark`; no screen, card, region or declared node may
set an appearance of its own. One appearance is in force everywhere at once, and the one
thing an operator can change is which one, at the one place that owns it. This preserves an
existing capability (the appearance control cycles system, light and dark and persists under
`effect-theme`, `theme-runtime.ts`) while removing the failure mode the rule exists for: a
light panel inside a dark console.

`panelBackground="solid"` is a change from the system default (`translucent`). A translucent
panel over a table that re-reads every 5 s puts moving content behind the text, so the
text-to-background contrast stops being a number and becomes a function of the last read.
Solid panels keep it fixed and stop a per-row compositing cost on a region that repaints on a
timer.

---

## 2. Typography

### The pair

**Geist Sans** for everything that is a word, **Geist Mono** for everything that is a value.

One line of justification: Geist is a technical grotesque drawn as a matching sans and mono
pair, so the mono column that carries an operator's ids sits in the same skeleton as the
prose beside it instead of reading as a second typeface, and neither is Inter, which the
skill's §4.1 discourages as a default.

### Availability (skill §3.F, verified)

Neither face is in the tree. `node_modules` holds no `geist`, no `@fontsource-variable/geist`
and no `@fontsource-variable/geist-mono`. Verified against the registry:

| package | latest | what it ships |
|---|---|---|
| `@fontsource-variable/geist` | 5.3.0 | variable woff2 (weight 100 to 900, normal and italic), `index.css`, `wght.css`, `wght-italic.css` |
| `@fontsource-variable/geist-mono` | 5.3.0 | variable woff2, same entry points |

Install, in `apps/effect-server`:

```
bun add @fontsource-variable/geist @fontsource-variable/geist-mono
```

The `geist` package (1.7.2) is **not** the right dependency even though it ships the same
faces: its JavaScript entry points are Next.js `next/font` adapters, and this client is
bundled by `bun build src/client/effect-ui-client.tsx --outdir public --target browser
--format esm` (`apps/effect-server/package.json`). The fontsource packages are the
self-hosting route the skill's §3.A requires.

### How the faces reach the page

Two imports at the top of `apps/effect-server/src/client/effect-ui-client.tsx`, which already
imports `@radix-ui/themes/styles.css`:

```ts
import "@fontsource-variable/geist/wght.css"
import "@fontsource-variable/geist-mono/wght.css"
```

`wght.css` declares `@font-face` with `font-display: swap` and a variable weight axis. The
bundler emits the sheets into `public/effect-ui-client.css` and the woff2 files beside them,
which means the woff2 files must be added to the two served-file tables that already carry
`/console-client.js` and `/console-client.css`: `apps/effect-server/src/client-bundle.ts:31`
and `apps/effect-server/src/console-plugin.ts:22`. A face that is emitted but not in a served
table is a silent fallback to the system stack.

### The token mapping (through the system's own layer)

Radix Themes exposes the font family of every text component as a CSS variable
(`tokens.css:4402` and following). The console sets four of them on the root `<Theme>` and
sets no `font-family` anywhere else:

```css
--default-font-family: "Geist Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
--heading-font-family: var(--default-font-family);
--code-font-family:    "Geist Mono Variable", ui-monospace, "SF Mono", Menlo, monospace;
--strong-font-family:  var(--default-font-family);
--em-font-family:      var(--default-font-family);
--quote-font-family:   var(--default-font-family);
```

The last two matter more than they look. Radix Themes defaults `--em-font-family` and
`--quote-font-family` to `'Times New Roman', 'Times', serif` (`tokens.css:4439`, `:4444`), so
a `<Em>` or a `<Quote>` in a declared view would silently render as serif inside a
dark-tech console. Both are overridden here. There is no serif role in this design, and the
console never renders `Quote` or `Blockquote`.

### The scale

Every size below is a Radix Themes text or heading size at `scaling="100%"`, so the numbers
are the system's own tokens (`tokens.css:4405` onward) and not a second scale.

| role | component | size | px / line-height | weight | tracking | family |
|---|---|---|---|---|---|---|
| display | `Heading` | 7 | 28 / 36 | bold | -0.0075em | Geist Sans |
| section title | `Heading` | 4 | 18 / 26 | bold | -0.0025em | Geist Sans |
| region title | `Heading` | 3 | 16 / 24 | medium | 0 | Geist Sans |
| body | `Text` | 2 | 14 / 20 | regular | 0 | Geist Sans |
| body, dense (a table cell) | `Text` | 2 | 14 / 20 | regular | 0 | Geist Sans |
| label, column header | `Text` | 1 | 12 / 16 | medium | +0.0025em | Geist Sans |
| meta, caption | `Text` | 1 | 12 / 16 | regular | +0.0025em | Geist Sans, `--gray-11` |
| value: ids, tool names, revisions, durations, paths, hashes, counts | `Code` or `Text` | 1 | 12 / 16 | regular | 0 | Geist Mono |
| value, at body size (a JSON result, a transcript line) | `Code` | 2 | 14 / 20 | regular | 0 | Geist Mono |

Rules that hold the scale:

1. **Display exists once.** The `Heading size="7"` role is used on Home only. A screen title
   inside an app is a section title (size 4). No screen invents a bigger heading than Home.
2. **Nothing renders below 12 px.** At density 7 the temptation is 11 px meta; it is refused.
   12 px is the floor in both appearances.
3. **Numbers are mono, not merely tabular.** Every count, duration, revision, timestamp and
   ordinal is set in Geist Mono. `font-variant-numeric: tabular-nums` is used as well, on the
   clock and on any sans column that has to align, but it does not substitute for the mono
   role. This is the skill's §7 rule for a cockpit, applied one dial point lower.
4. **Mono is never one step down from its row.** A value in a body row is 14 px, the same as
   the prose in that row; a value in a caption strip is 12 px. Shrinking mono to make an id
   column fit is what makes id columns unreadable.
5. **Truncation is one line, middle, with the full value in a `Tooltip` and in the accessible
   name.** Long ids and paths truncate; they never wrap and never break a row's height. The
   `truncate` in the current status bar is the right instinct kept.

---

## 3. Colour

### 3.1 The accent, locked

One accent: **jade**. It is used for the same things on every screen and for nothing else.

| use | token | dark | light |
|---|---|---|---|
| solid interactive fill (`Button variant="solid"`) | `--accent-9` | `#29a383` | `#29a383` |
| text on that fill | `--accent-contrast` | `#0d1512` | `#ffffff` |
| focus ring | `--focus-8` (= `--accent-8`) | `#2a7e68` | `#56ba9f` |
| selection, current row, tint | `--accent-a3` | `#02f99920` | alpha step |
| border of a selected or active control | `--accent-a6` | `#34ffc24b` | alpha step |
| accent text and accent glyph | step 12 (see 3.4) | `#adf0d4` | `#1d3b31` |

The accent means one of two things and nothing else: **the console acts here** (a press, a
selection, focus) or **the console's own answer is yes** (a verdict of allowed, an enabled
identity, a completed action). It never means "healthy", never means "informational", and is
never used to make something look important.

### 3.2 The neutral ramp

`grayColor="gray"`, pure neutral, all twelve steps available from the system. The ones this
design uses:

| step | role | dark | light |
|---|---|---|---|
| 1 | page ground | `#111111` | `#fcfcfc` |
| 2 | panel ground, table surface | `#191919` | `#f9f9f9` |
| 3 | raised row, hovered row | `#222222` | `#f0f0f0` |
| a4 | hairline (the only divider) | `#ffffff1b` | alpha step |
| a6 | control border | `#ffffff2c` | alpha step |
| 11 | meta text, captions, disabled labels | `#b4b4b4` | `#646464` |
| 12 | body text, values, titles | `#eeeeee` | `#202020` |

Contrast, computed against the page ground (`#111111` dark, `#fcfcfc` light): `gray-11` is
9.11:1 dark and 5.77:1 light; `gray-12` is 16.28:1 dark and 15.88:1 light; both remain above
4.5:1 on a step 3 row (7.67:1 and 5.19:1). The neutral ramp is never used to carry a status.

A hairline is `--gray-a4`, never a solid step and never a border on both sides of a row. The
skill bans `border-t` plus `border-b` on every row of a long list; a table with 40 rows gets
one line per row, drawn by `Table`, and nothing else.

### 3.3 The semantic tones

Five tones. Each is a row in the table below, and each renders through three channels at
once: a **glyph**, a **word**, and a **colour**. The colour is the third channel, never the
first, and never the only one.

| tone | means | text | badge | surface tint | glyph (Phosphor) |
|---|---|---|---|---|---|
| `ok` | healthy, current, allowed, enabled | `--gray-12`, glyph in `--accent-12` | `Badge variant="surface" color="jade" highContrast` | none | `Check` |
| `pending` | a human decision is outstanding, or a step is in flight | step-12 amber | `Badge variant="soft" color="amber" highContrast` | `--amber-a3` | `Hourglass` |
| `failed` | an operation errored, a source is failed, a revision drifted | step-12 red | `Badge variant="soft" color="red" highContrast` | `--red-a3` | `WarningCircle` |
| `denied` | a policy verdict refused | step-12 red | `Badge variant="outline" color="red" highContrast` | none | `Prohibit` |
| `info` | a plain fact worth distinguishing: a kind, an era, a version, an endpoint | step-12 blue | `Badge variant="soft" color="blue" highContrast` | `--blue-a3` | `Info` |

Exact step-12 values, dark then light: amber `#ffe7b3` / `#4f3422`, red `#ffd1d9` / `#641723`,
blue `#c2e6ff` / `#113264`, jade `#adf0d4` / `#1d3b31`.

Four hues carry five tones. That is deliberate and it is where the design earns "never by
colour alone":

- `failed` and `denied` share red because both are negative, and are separated by **fill**
  (`soft` has a tinted ground, `outline` has none), by **glyph** (`WarningCircle` against
  `Prohibit`), and by **word** ("Failed" against "Denied"). A reader who cannot see colour
  reads two different words and two different shapes.
- `ok` is quiet on purpose. In a fleet view where thirty agents are all current, thirty
  saturated badges is noise, so `ok` renders as a small accent tick beside ordinary body
  text. Green is not a wallpaper in this console.
- `info` is blue and never the accent. The accent is reserved for the console acting or
  answering yes, so a fact never wears the accent by accident.

### 3.4 The step-12 rule

**Tone text is the scale's step 12 in both appearances. Step 11 is not used anywhere in this
console.**

The numbers are why. Measured against the page ground:

| token | dark | light |
|---|---|---|
| amber-11 | 12.33:1 | **4.49:1** |
| jade-11 | 10.27:1 | **4.54:1** |
| blue-11 | 8.98:1 | 4.65:1 |
| red-11 | 8.96:1 | 5.08:1 |
| amber-12 | 15.59:1 | 11.08:1 |
| jade-12 | 14.56:1 | 11.89:1 |
| blue-12 | 14.44:1 | 12.30:1 |
| red-12 | 13.82:1 | 12.12:1 |

Step 11 clears AA on a dark ground by a wide margin and fails it on a light ground in two of
the four hues. Re-deciding that per hue is how a palette drifts, so the rule is one rule:
step 12 for tone text, `gray-11` for meta, `gray-12` for body. Everything in the table above
clears AA with room, in both appearances, on both the page ground and a step-3 row.

The same reasoning forces `highContrast` on every tone badge and every tone callout. A soft
badge draws its label in step 11 over a step-3 ground, which is exactly the combination that
fails; `highContrast` moves the label to step 12 using the system's own switch
(`badge.props.d.ts`, `callout.props.d.ts`) rather than a hand-written override.

### 3.5 Choosing a tone

The tone is a function of a declared field, first match wins:

1. The data carries a verdict in the console's own vocabulary (`allowed`, `denied` on an
   access decision, a consent decision, an approval decision): `ok` for allowed, `denied`
   for denied.
2. The data carries an error: an action result with `ok: false`, a source whose
   `/_sources/<id>.state` is `failed`, a non-empty `failure` field, `pendingRestart: false`
   with a config error state. Tone `failed`.
3. The data carries an outstanding human decision or an unanswered step: a pending approval,
   a pending consent, a launch intent with no outcome, a desired revision that differs from
   the reported one, `pendingRestart: true`. Tone `pending`.
4. The data carries a distinguishing literal that is neither health nor a problem (a kind, an
   era, a tool name, an endpoint, a version). Tone `info`.
5. Otherwise the row is plain: no tone, body text.

**A tone is never computed from a free-text string, never inferred from a node's component
name, and never chosen per screen.** If no field declares one of the four cases above, the
row is plain. This is the rule that keeps a reimplementation from inventing heuristics that
disagree with the host's own verdicts.

### 3.6 Tinted surfaces

A tint (`--<hue>-a3`) is always the alpha scale, so it composites over whatever ground it is
on and needs no second definition per appearance. **Tinted surfaces carry step-12 text, never
step 11.** A tint is additive: it never carries a row's meaning on its own, and any row that
is tinted also carries the tone's badge or glyph somewhere inside it.

---

## 4. Shape

**One radius scale: Radix Themes' `radius="medium"`, set once on the root `<Theme>` and never
overridden per component.**

That setting gives `--radius-factor: 1`, so the system's six steps resolve to
(`tokens.css:4483`):

| token | value | where the system applies it |
|---|---|---|
| `--radius-1` | 3 px | `Checkbox`, small chips |
| `--radius-2` | 4 px | `TextField.Root`, `TextArea`, `Select.Trigger`, `Button size="1"` |
| `--radius-3` | 6 px | `Button size="2"`, `SegmentedControl.Item` |
| `--radius-4` | 8 px | `Card size="1"` and `size="2"`, `Callout` |
| `--radius-5` | 12 px | `Card size="3"` and above |
| `--radius-6` | 16 px | the largest panels |

This is a change from today's `radius="large"` (`console-theme.tsx`), which multiplies every
corner by 1.5 and puts a 24 px corner on a card. At density 7 a 24 px corner reads as a
bubble and wastes the pixels a dense layout cannot spare.

Documented exceptions, and there are only two:

1. **Circular affordances are circular.** `--radius-thumb: 9999px` at this radius setting
   makes a slider thumb, a switch thumb, an avatar and a status dot fully round. That is the
   system's decision, not a second one, and it is the only exception this design takes.
2. **Nobody passes `radius`.** No component in the console, no node in any declared view, and
   no shell element sets the `radius` prop. The scale in the table above is the whole answer,
   and a component that picks its own corner is the mixed system the skill's Shape
   Consistency Lock exists to prevent.

No pill buttons. No pill badges. A status is a `Badge` at the scale's corner, not a capsule.

---

## 5. Spacing and density

`scaling="100%"` stays. Expressing density by scaling the whole system to 95 percent would
put type on half pixels (11.4 px, 13.3 px) and blur the mono columns this console is mostly
made of. Density is expressed instead through explicit `size` and `p` props, so every number
in this section is a whole pixel and identical to the number in the CSS.

Space tokens at 100 percent: `--space-1` 4, `-2` 8, `-3` 12, `-4` 16, `-5` 24, `-6` 32, `-7`
40, `-8` 48, `-9` 64.

| surface | property | value | result |
|---|---|---|---|
| **dense table row** | `Table.Cell` `py="2" px="2"`, `Table size="1"` | 8 px / 8 px | 32 px row height |
| a row that carries a title and a caption | `Table.Cell` `py="2" px="2"` | 8 px | 40 px row height |
| column header | `Table.ColumnHeaderCell` `py="2" px="2"` | 8 px | 32 px |
| **card** | `Card size="1"` | `--space-3` 12 px | 8 px corner, one hairline |
| a card that holds a table | `Card size="1"` with the table's own padding as the inner frame | 12 px | the table's first cell starts at 20 px |
| **form field block** | label, then `gap="1"` to the control, then `gap="1"` to the message; blocks separated by `gap="3"` | 4 px / 4 px / 12 px | one field is 56 px tall at size 2 controls |
| a group of related fields | `Card` or `Section`, inner `gap="4"` | 16 px | |
| **section** | header to body `gap="5"`; section to section `gap="6"` | 24 px / 32 px | |
| **screen outer frame, app route** | `px="4" py="3"` (horizontal padding is a frame, vertical is a gutter) | 16 px / 12 px | the surface fills the height the chrome leaves |
| **screen outer frame, document route** | `Container size="3"` (`max-width: 880px`) with `py="6"` | 32 px vertical | Settings and a config form |
| **chrome bar** | `Flex align="center" gap="3" px="3"`, height 48 px | 12 px | one line, 48 px, under the skill's 80 px cap |
| **dock** | item 64 x 64 with `gap="2"` between items, dock padding `--space-2` | 8 px | 80 px total, down from today's 112 px |

Two rules that keep the density honest:

1. **A gap is a gap, not a margin.** Spacing comes from `gap` on a container or from the
   system's own `p` props. No element carries a hand-written `margin` to fix a neighbour.
2. **Vertical rhythm is uniform.** Every row in a table is the same height unless a screen
   declares a two-line row, and every card in a column is the same width and the same
   padding. At `DESIGN_VARIANCE: 3`, a screen whose blocks have different paddings is wrong.

---

## 6. Motion

At `MOTION_INTENSITY: 3` the vocabulary is short and it is closed:

| what | duration | easing | why it is allowed |
|---|---|---|---|
| hover tint on a row, a dock item, a card press target | 120 ms | `cubic-bezier(0.16, 1, 0.3, 1)` | feedback: the pointer found a target |
| `:active` press | 80 ms, `transform: translateY(1px)` | same | feedback: the press landed (skill §4.5) |
| focus ring appears | 0 ms | none | never faded; a focus ring that fades is a focus ring that is missed |
| `Dialog`, `Popover`, `Tooltip`, `DropdownMenu`, `Select.Content` enter and exit | 150 ms in, 100 ms out | the system's own | state transition, and user-initiated |
| a `Button` awaiting an answer showing `loading` | the system's spinner | n/a | feedback: the press is in flight |

Nothing else moves. There is no entry animation, no stagger, no fade-in, no reveal on scroll,
no number roll, no pulse, no shimmer, no skeleton sweep, no progress bar animation, no
magnetic hover, no parallax, and no animated background of any kind. A `Skeleton` is a static
block at the system's own colour; if the system's skeleton sweeps, the console disables the
sweep.

### 6.1 The live-surface contract (read this section twice)

This is the part a reimplementation is most likely to get wrong, because a live console
invites animation. The rules are absolute.

**What happens when a value changes in a region the operator is reading:**

1. **The value is replaced in place.** The cell's content changes; the row does not move, the
   row does not flash, the row does not grow, and the region does not scroll. Mono values are
   width-stable, so nothing shifts horizontally either.
2. **A changed cell carries a mark for exactly one refresh interval.** A 2 px inset on the
   cell's leading edge in `--accent-a6`. The mark is cleared by the next read in which the
   value is unchanged. The mark is information (this changed while you were looking), not
   motion, so it neither fades nor blinks, and it survives as long as the fact does.
3. **The region's meta strip states the truth**: `Live · read at 14:32:07 · next read in 4s`,
   mono, one middle dot per line at most.
4. **A row that is new is inserted at its sorted position only on an unpaused read**, never
   animated in. It is simply present on the next paint.

**What does not happen, ever:**

1. **No region re-enters a loading state on a refresh.** A region that has data keeps it.
   The skeleton belongs to the first paint and to nothing else. (Today's behaviour, per
   `console-source-runtime.ts:36-37`, is the right behaviour, and this document keeps it.)
2. **No auto-scroll.** A region that the operator has scrolled does not jump to the top when
   rows arrive.
3. **No reordering under the pointer.** While a region is paused (see below), neither row
   order nor row membership changes.

**The pause rule.** A region whose source has a refresh interval **pauses while the pointer
is inside it or focus is inside it**, and resumes when both have left. The reason is the one
hazard a live console has: an operator decides on a value that changes under their cursor
between reading it and pressing the control that acts on it. Pausing removes the hazard
instead of hiding it.

While paused the meta strip reads `Paused while you are in it · last read 14:32:07`, and a
`Button variant="ghost" size="1"` reading `Read now` sits at the region's trailing edge and
performs the read on demand. If a region stays paused for more than 30 s the tone of the
strip escalates from plain meta to `pending`: `Paused 42s · last read 14:31:12`. A paused
region is never dimmed, never blurred and never greyed: the data is still true, it is merely
not the newest, and the strip is where that is said.

**Refusal of the tempting alternatives.** No flash on change, no fade on change, no transient
highlight that decays, no "live" pulse near the clock, no marquee, no toast on update, no
sound. At `MOTION_INTENSITY: 3` a decaying highlight is an animation, and an animation on a
surface that repaints every 5 s is a surface that flickers at the person reading it.

### 6.2 Reduced motion

`@media (prefers-reduced-motion: reduce)` sets every transition and animation in the console
to `0ms`, hides the `Button` spinner while keeping `aria-busy` and the label, and makes
overlays appear and disappear instantly. The pause rule, the change mark and the meta strip
are unaffected, because none of them is motion. Today's console already has one reduced
motion rule (`console-shell.css`'s dock transition); this generalises it.

---

## 7. Elevation and surfaces

The skill's §4.4 bans cards as a default and bans generic card containers outright above
density 7. This console is at 7, so surfaces have to earn their place. There are three, in
ascending order of weight, and a screen picks the lowest one that works.

**1. Plain space (the default).** Blocks are separated by `gap` and by the section rhythm in
§5. A group of rows, a run of key and value pairs, and a paragraph of a screen's prose need
nothing. Most of the console is this.

**2. A hairline.** Exactly one line, `--gray-a4`, in three places and no others: between the
chrome bar and the body; between a table's rows (drawn by `Table` itself); between the
key and value columns of a `DataList` when the row is wide enough that the eye loses the
column. Never a line above and below the same row, never a line under every row of a prose
list, and never a decorative rule.

**3. A `Card`.** A card is used when a block has its own identity and its own controls, or
when two adjacent blocks would otherwise be ambiguous about where one ends. The complete list
of places a card is correct in this console:

- a `Preview` result, which is a document from an app the console does not trust;
- a tool's result panel in the inspector;
- the config editor's panel, which holds a form and its own save controls;
- an app tile on Home;
- a settings row when it carries a status and a press of its own.

Everywhere else a card is a defect. Specifically banned: a card around a table (the table has
its own surface and its own hairlines), a card around one sentence, a card inside a card, a
card whose only child is a heading, and a card used to make a screen look organised.

**Shadow.** The system's `--shadow-1` for the chrome bar's hairline lift and `--shadow-3` for
the two floating layers (the dock and the command palette). No other shadow exists. Nothing
static ever casts one, so "raised" always means floating and never means "more important".

The system's shadow tokens are neutral alpha. On the light appearance the skill would tint
them to the ground hue; that is declined deliberately, because tinting the system's shadows
would be a second shadow scale to keep in step, and two shadows in the whole product do not
justify it. This is the one place the console knowingly follows the system rather than the
skill's letter, and it is recorded here so nobody "fixes" it twice.

**Raised ground.** On the light appearance a card's ground is the system's
`--color-panel-solid`, which is white, over a `#fcfcfc` page. The skill's no-pure-white rule
is honoured by the page (`#fcfcfc`) and by the dark appearance's off-black (`#111111`); a
raised panel is the one place true white is allowed, because the light appearance has no
lighter step to raise into.

---

## 8. Icons

**One family: `@phosphor-icons/react`.** It is first in the skill's §3.C priority order,
`@tabler/icons-react` is leaving the tree (`plan.md` §5), and hand-rolled SVG is banned.

Availability: not in the tree. Latest on the registry is **2.1.10**. Install, in
`apps/effect-server`:

```
bun add @phosphor-icons/react
```

Phosphor has no stroke axis: its glyphs are filled paths and the knob that plays
`strokeWidth`'s role is `weight`. Claiming a pinned `strokeWidth` for this family would be
inventing a property. The pinned values are therefore:

| context | `weight` | `size` |
|---|---|---|
| chrome (bar, dock, palette), forms, buttons | `regular` | 16 |
| inside a table cell, a badge's neighbour, a dense row | `regular` | 14 |
| inside a `Badge` | `bold` | 12 |

`regular` is the only weight used above 14 px, and `bold` appears only at 12 px where a
`regular` glyph loses its stroke. No `fill`, no `duotone`, no `light`, no `thin`, and no
per-instance departure from the three rows above.

Two rules keep one family actually one family:

1. **Radix Themes' own internal glyphs stay the system's.** The `Select` chevron, the
   `Checkbox` tick, the `Dialog` close and the `Tooltip` arrow are drawn by the design system
   and are not replaced with Phosphor equivalents. They belong to the component, not to the
   icon family. The console never re-draws a control's own glyph.
2. **No emoji and no textual glyph stand-ins anywhere.** The characters the current status
   bar uses for its controls (`◐`, `⌂`, `‹`) are replaced by `CircleHalf`, `House` and
   `CaretLeft`. The skill's §3.D discourages emoji in visible product text and the console
   allows none, in copy, in a tile's mark, or in a badge.

The tone glyphs are fixed by §3.3: `Check`, `Hourglass`, `WarningCircle`, `Prohibit`, `Info`.
Beyond those, the console uses one glyph per concept and reuses it: `House` for Home,
`MagnifyingGlass` for the palette, `CaretLeft` for back, `ArrowClockwise` for a read-now and
a retry, `DotsThree` for a screen menu, `ArrowSquareOut` for a resource opened out,
`ShieldCheck` for an access decision, `Key` for a token, `Plugs` for an MCP server,
`Robot` for an agent, `Desktop` for a machine, `ListBullets` for an event ring,
`Terminal` for a transcript, `Gear` for Settings. Two screens never use the same glyph for
two different things, and a screen never invents a glyph where a word would do.

---

## 9. The interaction-state contract

Every surface class below answers all six states. `console-surface.md` §6 records what exists
today and what is absent; the absences are: no not-found screen, no error boundary, no retry
anywhere, no first-paint skeleton, no offline state, no focus management. Every absence is
closed by a rule here.

Three rules apply to every state on every surface:

- **No spinner-only loading.** A region that is loading shows a `Skeleton` shaped like what is
  coming: the same column count, the same row height, the same block widths. A `Spinner` is
  permitted in exactly one place, which is a `Button` awaiting an answer, via its own
  `loading` prop.
- **No error without a retry.** Every failure is an inline `Callout color="red"
  highContrast` carrying a sentence, the reason in mono when the server gave one, and a
  `Button` reading `Try again` that repeats exactly the request that failed.
- **No empty state that does not say how it fills.** Every empty sentence names the thing
  that is absent and then names the route by which it arrives, whether that route is a
  control on this screen or an agent elsewhere.

Copy register for every string below: sentence case, no exclamation mark, no "please", no
"Oops", no "Something went wrong", no apology, reasons in mono, and no string that a reader
could not act on.

### 9.1 A live table (a source-bound region rendered as `Table`)

| state | what renders | copy |
|---|---|---|
| loading (first paint) | skeleton header plus 6 skeleton rows at the real column widths and the real 32 px row height; the region carries `aria-busy="true"` | meta strip: `Reading` |
| empty | the table is not drawn; one line of body text and one press | `No task is on the board. Open New task to add one.` (board). Each region declares its own sentence in the same shape: what is absent, then how it arrives. A region whose rows come from an agent rather than a control says so: `No launch has been asked of a machine. Requests appear here when an agent asks for one.` (agentd) |
| empty because of a filter | the filter's own state, distinct from an empty source | `No task matches <filter>.` plus a `Button variant="soft" size="1"` reading `Show all` |
| error, no previous read | `Callout color="red" highContrast` above the region; the table is not drawn | `Could not read the task table.` plus the reason in mono, plus `Try again` |
| error, after a successful read | the callout above, **the rows stay below it**, meta strip switches to the failed tone | `Could not read the task table. Showing the read from 14:31:02.` plus the reason in mono, plus `Try again` |
| disabled | a row's own press is disabled, and the reason is stated inline in the row, never only in a tooltip | `Save is unavailable while a save is in flight.` |
| stale | rows keep their values, no dimming, no blur; the meta strip says which of the two kinds of stale it is | paused: `Paused while you are in it · last read 14:32:07` with `Read now`; long-paused (over 30 s): `Paused 42s · last read 14:31:12` in the `pending` tone |
| optimistic | **does not exist.** A row shows only what the host reported. A press in flight shows its own busy state and the table does not change until the answer lands and the region re-reads | none |

### 9.2 A screen's data region (cards, lists, key and value pairs)

| state | what renders | copy |
|---|---|---|
| loading | skeleton blocks matching the real block shapes; `aria-busy` | meta strip: `Reading` |
| empty | one line plus the route by which it fills | `This agent has no resolution recorded yet. Open it again after the host has planned a push.` |
| error | inline `Callout`, previous content kept below it | `Could not read this agent. Showing the read from 14:31:02.` plus reason plus `Try again` |
| disabled | not a property of a display region; its controls carry the disabled state and the reason | n/a |
| stale | identical rule to 9.1, including the pause and the escalation | identical |
| optimistic | does not exist | none |

### 9.3 A form (the config editor, an action's argument form, the inspector's argument form)

| state | what renders | copy |
|---|---|---|
| loading | skeleton label and control pairs at the real field rhythm; the form carries `aria-busy="true"` | `Reading configuration.` |
| empty (an array with no rows) | the array container with one press | `No items. Add one to include it.` plus `Add item` |
| error, field level | the message below the control, in the field's own place, never in a toast | `<Field label>: <reason>.` |
| error, form level | `Callout color="red" highContrast` above the form, previous values kept and still editable | `The configuration could not be saved. <reason>` plus `Try again` |
| disabled (a save or apply in flight) | every input, select, textarea and button in the form disabled, container `aria-busy="true"` (today's contract, `config-session.ts:21-24`) | `Saving. The form is locked until the answer lands.` |
| unsaved changes | the hint that already exists, kept verbatim | `Unsaved changes; choose Save and Apply or Save for Restart.` |
| success | the server's values are read back and the note says so | `Operation succeeded; saved server values were reloaded.` and, when the reload failed, `The save succeeded but the server's values could not be read back. Reload the form.` |
| stale (saved, not applied) | the config status callout, tone from the server's own state | `Saved · restart or apply pending` plus `Apply saved configuration`; error state: `Configuration error` plus revision |
| optimistic | **does not exist**, and this one is already the host's rule: the callout's wording and tone come from the server's state, never an optimistic guess (`config-state.ts:4-20`) | none |

### 9.4 An action press

| state | what renders | copy |
|---|---|---|
| loading | the `Button` keeps its label and shows its own `loading` state; the action's result region says the work is in flight | result region: `Running` |
| empty | not applicable | n/a |
| error (a refusal or a failure) | written **at the control that caused it**, beside that control, as an inline `Callout color="red" highContrast`, matching today's contract (`effect-ui-action-runtime.ts:44-46`) | `<Action label> was refused. <reason>` plus `Try again` |
| disabled (a declared parameter is missing) | the press is disabled and the missing thing is named inline, not only in a tooltip | `Preview needs an identity and a tool. Choose both above.` |
| stale | an answer is a record, not a live read, so it does not escalate; it states when it landed | meta strip: `Answered at 14:32:07` |
| optimistic | the press itself may show busy immediately, because that is feedback about the press and not a claim about data. Nothing else is optimistic | none |

### 9.5 The shell

| state | what renders | copy |
|---|---|---|
| loading | the bar draws immediately and completely: Home control, title, appearance control, clock. The bar is never blank and is never skeletoned | status line: `Reading host status.` |
| empty (no apps) | the springboard draws one composed block, not an empty grid | `No apps are loaded on this host. An app appears here once the host has loaded it.` plus `Try again` |
| error (the catalogue) | the existing red callout above the surface (`console-shell.tsx:69`, `:77`), now with a retry | `Could not read the app catalogue.` plus reason plus `Try again` |
| error (a mounted surface throws) | the existing red callout above the mount (`console-mounted.tsx:34`), now with two ways out | `This screen stopped while drawing.` plus reason plus `Try again` and `Back to Home` |
| error (a node's component name resolves to nothing) | unchanged, and kept verbatim because it is precise | `Unknown component: <name>` |
| error (host status) | the status line degrades and says when it last worked | `Status unavailable. Last read at 14:31:02.` |
| not found (today: silently rewritten to Home or Settings) | the rewrite stays, because a stale address correcting itself is better than an error page. What is added is the announcement: the route-change live region says `Home` so the operator knows the address was not honoured | none visible beyond the announcement |
| disabled, optimistic | not applicable to the shell | n/a |

---

## 10. The chrome and the keyboard model

### 10.1 What the chrome is today

Per `console-surface.md` §3: a status bar (Home, title, host status line, clock, appearance),
a springboard of tiles on Home, a dock that is drawn **only on document routes that are not
Home** (in practice, under Settings), a `‹ Back` bar inside a view, and a screen menu drawn
only when the host derived the screens rather than being told them. Keyboard affordances:
none at all. No command palette.

### 10.2 The redesign

Five pieces, each with one job, all on one line, all at the same 48 px bar height. The chrome
never wraps and never reaches the skill's 80 px cap.

**1. The bar.** Persistent on every route. One line, 48 px, sticky, ground
`--color-panel-solid`, one `--gray-a4` hairline below it. Left to right: the Home control
(`IconButton variant="ghost" size="2"`, `House`, aria-label `Home`), drawn on every route
except Home; the open surface's title (`Text size="2" weight="bold" truncate`); the host
status line (`Text size="1" color="gray"`, the count in mono); a spacer; the palette trigger
(`Button variant="soft" size="1"` with `MagnifyingGlass` and a `Kbd` showing the shortcut);
the clock (`Text size="1" color="gray"`, mono, tabular figures, refreshed every 30 s as
today); the appearance control (`IconButton variant="ghost" size="1"`, `CircleHalf`, tooltip
`Appearance: Follow system | Light mode | Dark mode`).

Below 700 px, the palette trigger collapses to an `IconButton` and the host status line is
dropped; the Home control, the title and the clock remain. The bar is always one line.

**2. The springboard (Home only).** A `Grid` of app tiles, `columns={{ initial: "2", sm:
"3", md: "4", lg: "6" }}`, `gap="3"`. A tile is a `Card size="1"` wrapping the app's press:
an `Avatar` in the app's own declared colour carrying its mark, the app's declared title
(`Text size="2" weight="medium"`), and, for the `settings` id, the same shape. The
hand-written gradient tile in today's dock CSS is removed; an app's identity is its declared
colour and its mark, which is what `console-app-icon.tsx` already renders.

**3. The dock.** Raised to **every route except Home**, which closes the incoherence
`console-surface.md` records: today an app route has no app switcher at all and the only way
to another app is Home and then a tile. The dock stays a hand-written element, because it is
the one thing the design system has no component for, and it is written in the system's own
tokens with no named colour, exactly as today's CSS comment says. Changes: height 80 px
(down from 112), item 64 x 64, icon 32 px, label 12 px, `aria-current="page"` on the current
entry, and one `Separator orientation="vertical"` before the fixed Settings entry. The dead
`.shell-menu` rule for a floating round button that no component renders
(`console-shell.css:100-108`, `:116`) is deleted.

**4. The back bar.** Inside a view, above the current screen, drawn only when the screen has
an ancestor, exactly as today (`effect-ui-screen-panes.tsx:36-40`). It becomes a `Button
variant="ghost" size="1"` reading `Back to <parent screen title>` with `CaretLeft`, so the
destination is named rather than the direction. The first screen still has no back
affordance; the way out is Home, which is what the bar's Home control is for.

**5. The screen menu.** Kept, for the case it exists for: the host had to read an app's
screens off its layout rather than being told them, so those screens have no control in the
view. Rendered as a wrapping `Flex gap="2"` of `Button variant="soft" size="1"` per screen,
inside a group with `aria-label="Screens of <app title>"`. A declared screen has its own
control and no menu, as today.

### 10.3 The keyboard model

Today there is no `keydown` handler, no hotkey, no `aria-keyshortcuts` and no focus
management anywhere in the client. For a console whose users live in it daily, this is the
largest single gap in the product, and it is fixed here.

Every key the console owns:

| key | action | scope |
|---|---|---|
| `Command` or `Ctrl` + `K` | open the command palette | global |
| `Escape` | close the topmost overlay (palette, dialog, popover, dropdown, tooltip). When no overlay is open it does nothing: **`Escape` never navigates** | global |
| `?` | open the palette showing the keyboard list | global, not while a text field has focus |
| `g` then `h` | go Home | global, not while a text field has focus; the `g` prefix expires after 1500 ms |
| `g` then `s` | go Settings | same |
| `r` | read the current screen's sources again, now | global, not while a text field has focus |
| `Tab` / `Shift` + `Tab` | the browser's own order, with Radix's focus scope inside an open dialog and nowhere else | global |
| `Enter` / `Space` | run the focused control | on any focusable control |

The console does not hijack `Escape`, `Tab`, arrow keys, `/` or any letter without modifier
while a text field, textarea, select or slider has focus.

**Focus management on route change, which does not exist today.** On every route change the
console moves focus to the route's heading: the screen title if the route declares one, and
otherwise the `Heading` at the top of the mounted surface, each given `tabIndex={-1}`. If the
route has no heading at all, focus goes to the shell body. Focus is never left on a control
that no longer exists, and focus is never moved when the route change came from a keystroke
inside a text field (it cannot, since no keystroke inside a text field navigates).

**Skip link.** The first focusable element in the document is a `VisuallyHidden` control
reading `Skip to content`, which moves focus to the mounted surface.

**The command palette.** A `Dialog.Root` whose content is anchored near the top of the
viewport: `position: fixed; top: 12vh`, width `min(560px, calc(100vw - 32px))`, ground
`--color-panel-solid`, `--radius-5`, `--shadow-3`. Inside: a `TextField.Root` with `value` on
the search string and a placeholder `Search apps, screens and settings`, a `ScrollArea`, and a
list of rows, each a `Button variant="ghost"` with the glyph, the label, an optional caption
and its shortcut in a `Kbd`.

**A palette row invents no destination.** Every row resolves through the same two functions
the rest of the console uses, `appRoute` and `hashOf` (`console-plan.ts:99-100`,
`console-nav.ts:20-28`), so the palette is a second control over the routes the console
already answers and not a second navigation graph. Its contents, in order, filtered by the
search string:

1. every app with a view: `Open <app title>`;
2. every screen of the open app: `<screen title>`, with the app's title as the caption;
3. Settings: `Open Settings`, and one row per app with `hasConfig`: `Configure <app title>`;
4. the built-in Activity surface: `Open Activity`;
5. the appearance actions, three rows, worded exactly as today's tooltip words them:
   `Appearance: Follow system`, `Appearance: Light mode`, `Appearance: Dark mode`;
6. `Read now`, the same action as `r`;
7. `Keyboard shortcuts`, a static list of the table above.

Arrow keys move a cursor, `Enter` runs the highlighted row, `Escape` closes, and focus
returns to whatever opened the palette (or, when a row navigated, to the new route's heading
by the rule above).

**Where the navigation graph ends.** This section specifies the chrome and the keyboard, and
the palette is chrome. Which screens exist, how one screen leads to another, and what a
declared view's controls navigate to are the subject of the flows document being written in
parallel, and nothing here overrides it.

---

## 11. The component conventions an app declares against

An app declares a tree of nodes as `{ component: name, props: {...} }`. The adaptation layer
resolves the name against `@radix-ui/themes`' own exports, dotted for subcomponents
(`catalog.ts:29-51`). **Every component name in this design exists in `@radix-ui/themes`
3.3.0**, verified against the installed package's export surface. A name that does not
resolve renders as `Unknown component: <name>` in place of that node.

### 11.1 The three shapes (unchanged, and binding)

- **Content arrives on `value`.** A node with no declared children renders its `value` prop as
  its content, and every other prop is an attribute. A node with declared children keeps the
  prop for whatever the component means by it (`contract.ts:1-25`). `as` is not a second way
  to say the same thing: it names a prop the component already owns.
- **A control** holds a live value that writes back to view state.
- **A press** is `Button` or `IconButton` and runs the action the node declared under `press`
  (`render.tsx`, `PRESSABLE`).
- **Everything else is display.**
- **One renderer per name, cached for the life of the page** (`render.tsx`, `CACHE`). This is
  not an optimisation: a fresh component type per draw makes React unmount and lose focus
  mid-keystroke. A reimplementation that "cleans up" the cache breaks typing into every field
  in a view.

### 11.2 The controls, exactly

These eight names are the whole control vocabulary. For each, the prop it holds its value on
and the handler that hears it change are fixed; the app declares neither the handler nor the
prop name, it declares the *state path* and the layer supplies the rest
(`controls.ts:32-54`).

| control | Radix name | value on | handler | argument | used by |
|---|---|---|---|---|---|
| text field | `TextField.Root` | `value` | `onChange` | the DOM event (`event.target.value`) | board, agentd, mantis, mcp-gateway-app, mcp-registry-app, ui-host, deckconsole, herdr-app, every config string field |
| textarea | `TextArea` | `value` | `onChange` | the DOM event | board, agentd, mantis, mcp-registry-app, deckconsole, herdr-app, config multi-line fields |
| select | `Select.Root` | `value` | `onValueChange` | the value | board (state), mantis (workspace kind), mcp-gateway-app (identity, tool, kind), ui-host (renderer, theme), deckconsole (agent kind), herdr-app (workspace), every config enum field |
| segmented control | `SegmentedControl.Root` | `value` | `onValueChange` | the value | board only, twice: `/view` (Worktable, Columns) and `/filter` (All plus the five states) |
| radio group | `RadioGroup.Root` | `value` | `onValueChange` | the value | none today; the declaration for a config enum of two to four options whose labels are too long for a segmented control |
| slider | `Slider` | `value` (an array of numbers) | `onValueChange` | the array | none today; the declaration for a bounded number |
| switch | `Switch` | `checked` | `onCheckedChange` | the boolean | a config boolean field |
| checkbox | `Checkbox` | `checked` | `onCheckedChange` | the boolean | an inspector boolean argument, a config boolean field |

Two facts about that table are load-bearing and are stated plainly:

1. **`TextField.Root` and `TextArea` report their own DOM event and every other control
   reports the value.** The handler is derived from the prop name (`onValueChange`,
   `onCheckedChange`) and the two DOM reporters are a named exception; a hand-written pair
   was removed because it could name `onValueChange` for a text field where the real prop is
   `onChange`, and an input whose `value` has no handler that writes it back is read-only to
   React and silently drops what the operator types (`controls.ts`, header comment). The
   reimplementation derives the handler and does not write it down.
2. **The config form is the one place two of these render as native elements.** The config
   reader rebuilds a value out of the DOM (`data-ui="input"`, `data-path`,
   `config-react-mount.tsx:32`), and the system renders `Select` and `Checkbox` as buttons,
   which a form the reader submits cannot use (`config-fields.tsx`, header comment). So the
   config form renders a native `<select>` and a native `<input type="checkbox">` and keeps
   the system's *look* through tokens rather than through the component: 32 px height,
   `--radius-2`, 1 px `--gray-a6` border, `--color-surface` ground, `Text size="2"` inside,
   and `accent-color: var(--accent-9)` on the checkbox. Nothing else about it departs from
   §5's form rhythm. This is a documented exception with a reason, not an oversight, and the
   reimplementation does not "fix" it.

### 11.3 Exactly one component is ours

`Preview` renders a `ui://` resource as a sandboxed iframe, an image or text. It is the only
name in a view that is not the design system's, and it qualifies under a rule that admits no
other candidates:

> A name may be ours only when `@radix-ui/themes` has no component with that capability at
> all, and the capability cannot be composed from names that do exist.

`Preview` qualifies because a sandboxed frame with `allow-scripts` and without
`allow-same-origin` is a capability no Radix component has, and it is the whole reason the
node exists (`preview.tsx`, header comment). It keeps its five outcomes in their order: a
failure the resource reported (`Callout color="red"`), nothing chosen yet (`Select a resource
to preview.`), a page (iframe), an image (img), and any other body as text (`Card
variant="surface"` around `Code`).

**This design adds no second one.** Specifically, none of the following becomes a component,
because each is a composition of names that already exist: a mono text wrapper (`Code` or
`Text` with the mono family), a status dot (`Badge` plus a tone glyph), a key and value block
(`DataList.Root` / `DataList.Item` / `DataList.Label` / `DataList.Value`), a JSON block
(`Code` with `whiteSpace: "pre-wrap"`), a code panel (`Card` plus `Code`), a data grid
(`Table`), a confirm dialog (`AlertDialog`), a toolbar (`Flex`), and the command palette
itself (`Dialog` plus `TextField.Root` plus `ScrollArea`).

---

## 12. The accessibility floor

**Focus visibility.** One ring, everywhere, never removed: the system's own,
`outline: 2px solid var(--focus-8)` with the system's offset, which every Radix Themes control
already carries (`components.css:2005` and following). The two hand-written chrome elements
(the dock item and the palette row when it is not a `Button`) add the same rule explicitly
using `--focus-8`. Nothing in the console sets `outline: none`, `outline: 0`, or a custom
ring, and no control has a focus state that differs from its neighbour's.

**Focus management on route change.** Specified in §10.3, and it does not exist today. Focus
moves to the new route's heading; a route with no heading takes focus on the shell body; the
focus move is never combined with a scroll into view, so the operator's scroll position on a
document route is preserved.

**Live regions.** Exactly two in the whole console, and neither is a data region:

1. One polite region owned by the shell, which announces a route change with the surface
   title and, when there is one, the screen title. One announcement per route change, never
   one per re-render.
2. One assertive region owned by the shell, which announces a refused action: the same
   sentence that is written at the control that caused it, so a screen reader hears what a
   sighted reader sees.

**A data region is never `aria-live`.** A table that re-reads every 5 s must not talk. A data
region carries `aria-busy="true"` while it is reading and nothing else, and the values it
holds are read on demand. The region's meta strip (read time, pause state, change count) is
ordinary text in the DOM, so a screen reader reads it when the operator navigates to it and
not before.

**Contrast floors.** Body text and any text the operator must read: 4.5:1 minimum, measured
against the actual ground, including a tinted row. Borders, focus rings, glyphs and any
non-text indicator: 3:1. The token choices in §3.2 and the step-12 rule in §3.4 are what meet
these floors; the numbers are in those tables and every one of them clears AA.

**Colour is never the only channel.** Every tone renders a glyph and a word beside its
colour (§3.3). A `Badge` carries its word. A tinted row also carries a badge or a glyph. A
`Table` column whose values are states carries a text column, never a column of dots.

**Targets.** 24 px minimum for any press on the desktop console; 44 px below 700 px, where
the bar's controls, the dock items and the form controls all enlarge to that floor.

**Tooltips are supplementary only.** A `Tooltip` never carries the only copy of something the
operator needs, because it is unreachable by touch and by keyboard-only traversal of some
controls. Every reason, every missing parameter and every retry lives in inline text.

**Reduced motion** is §6.2. **Reduced transparency** needs no work: `panelBackground` is
`solid`, so no surface in the console depends on translucency. Under
`prefers-reduced-transparency: reduce` the two floating layers (dock, palette) take
`--color-panel-solid` and drop their `backdrop-filter`, which they already do on every ground
that is not a scrim.

**No high-contrast mode is added**, and the floor is met without one: the meta step
(`gray-11`) is 9.11:1 in the dark appearance and 5.77:1 in the light one, and tone text is
step 12 in both. If a future change reaches for step 11 in the light appearance it must
re-measure first, because that is the one combination in this palette that does not clear AA
(§3.4).

---

## 13. Verification

### 13.1 What this design asserts about today, and where it is recorded

| assertion | recorded in |
|---|---|
| the console's root Theme is jade, gray, radius large, scaling 100 percent | `console-theme.tsx:20-23`, and `console-surface.md` §3 |
| the appearance control cycles system, light and dark and persists under `effect-theme` | `console-surface.md` §3, `theme-runtime.ts` |
| the status bar carries Home, title, host status, clock and the appearance control | `console-surface.md` §3, `console-status-bar.tsx` |
| the dock is drawn only on document routes that are not Home | `console-surface.md` §3, `console-shell.tsx:86` |
| there are no keyboard affordances and no command palette anywhere in the client | `console-surface.md` §3 |
| a `.shell-menu` rule exists for a control no component renders | `console-surface.md` §3, `console-shell.css:100-108`, `:116` |
| a node's content arrives on `value` unless it declares children | `contract.ts:1-25`, `:44-56` |
| pressable components are `Button` and `IconButton` | `render.tsx`, `PRESSABLE` |
| the eight controls and their value props | `controls.ts:32-54` |
| a source does not re-enter loading on refresh; a failed source keeps its rows | `console-surface.md` §6 |
| the config form locks while a save or apply is in flight | `console-surface.md` §5, `config-session.ts:21-24` |
| a failed action writes `{ok:false, error}` to its declared result path | `console-surface.md` §6, `effect-ui-action-runtime.ts:44-46` |
| the config note is never an optimistic guess | `console-surface.md` §5, `config-state.ts:4-20` |
| the config form renders a native select and checkbox because the reader reads the DOM | `config-fields.tsx`, header comment |
| `Preview` is the only component in a view that is ours | `preview.tsx`, header comment |
| the nine apps' screens, sources, 69 actions and controls | `app-surfaces.md` |
| the config form's array add and remove, and unset as an explicit deletion | `console-surface.md` §5 |
| which files are presentation and which are behaviour | `auxiliary-hosts.md` §2 |

### 13.2 What this design changes from today

| today | this design | why |
|---|---|---|
| `radius="large"` | `radius="medium"` | a 24 px corner reads as a bubble at density 7 |
| `panelBackground` default (translucent) | `solid` | a translucent panel over a 5 s table makes contrast a moving number |
| system font stack | Geist Sans and Geist Mono, self-hosted | one mono role for a console that is mostly values, and not Inter |
| Radix's default serif `--em-font-family` and `--quote-font-family` | both the sans family | no serif role exists in this design |
| `◐`, `⌂`, `‹` text glyphs in the chrome | Phosphor `CircleHalf`, `House`, `CaretLeft` | one icon family, no textual stand-ins, no emoji |
| accent green also available to mean "healthy" | `ok` is a quiet tick; green means the console acts or answers yes | a wall of green badges is noise and the accent must not mean two things |
| dock hidden on app routes | dock on every route except Home | today an operator in an app has no app switcher |
| dock 112 px | 80 px | it is chrome, not content |
| no keyboard affordances, no palette | the key table and the palette in §10.3 | the largest single gap for daily users |
| no focus management on route change | focus moves to the route's heading | a keyboard operator loses their place on every navigation |
| no retry on any failure | `Try again` on every failure | a console that cannot recover from a failed read is a console that must be reloaded |
| spinner or a sentence while loading | a skeleton shaped like the answer | a spinner tells the operator nothing about what is coming |
| `Saved · restart or apply pending` and friends | kept, and the middle dot is now the only separator, once per line | one separator family |
| dead `.shell-menu` CSS | deleted | it renders nothing today |

### 13.3 Pre-flight

Run against the skill's §14 matrix, with the landing-page items marked not applicable by
`plan.md` §6 and the skill's own §13.

- [x] Design read declared, verbatim from `plan.md` §6.
- [x] Dials explicit and reasoned: 3 / 3 / 7.
- [x] One design system: `@radix-ui/themes`. `@mantine/core` and `@tabler/icons-react` leave
      the tree.
- [x] Redesign mode: overhaul on visuals, preserve on capability. Capability list unchanged.
- [x] Zero em-dashes anywhere, in this document and in every string specified above.
- [x] Theme Lock: one `<Theme>` at the root, one appearance in force, no section inverts.
- [x] Colour Consistency Lock: one accent (jade), used identically everywhere; the semantic
      tones are not accents and never replace one.
- [x] Shape Consistency Lock: one radius setting, no component passes `radius`, two
      documented exceptions, both the system's.
- [x] Button contrast: solid fills use `--accent-9` with `--accent-contrast`; no white on
      white, no transparent press without a border.
- [x] Form contrast: labels are `--gray-11` or `--gray-12` (5.77:1 and 15.88:1 at worst), the
      focus ring is `--focus-8`, error text is step-12 red, and no placeholder is a label.
- [x] No serif anywhere, and the system's two serif defaults are overridden.
- [x] Reduced motion wrapped for every transition.
- [x] Empty, loading, error, disabled, stale and optimistic specified for all five surface
      classes, with copy.
- [x] Cards omitted in favour of spacing except in the five named places.
- [x] Icons from one allowed library, one weight, three sizes, no hand-rolled paths.
- [x] No AI tells: no Inter, no purple, no emoji, no three equal cards, no locale strip, no
      scroll cue, no decorative dot, no version footer, no fake-precise number in any string
      specified above.
- [x] One system, one surface, one accent, one icon family, one radius scale.
- N/A by `plan.md` §6 and skill §13: hero discipline, hero padding, hero stack, imagery,
      content density, bento rules, marquee, logo wall, section-layout repetition, zebra
      alternation, eyebrow count, split-header, scroll cues, Core Web Vitals targets for a
      marketing page.
