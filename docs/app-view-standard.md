# App view standard

An app's console view (`apps/<app>/src/effect-ui.ts`) is one surface with one job: show an
operator the state of the thing the app owns, and let them act on it. These rules are what every
view follows. They are not taste — each one answers a defect that was measured across the eight
existing views (`apps/ui-host`, `mantis`, `ai-gateway`, `mcp-registry-app`, `mcp-gateway-app`,
`agentd`, `board`, `deckconsole`).

## 1. The page answers three questions, in this order

1. **What is this?** `Heading size="6"` plus one line of prose. Nothing before it.
2. **What is its state?** Only figures that are not repeated further down the page.
3. **What do I do here?** The app's primary task sits immediately under the header.

An operator must not scroll to reach the thing the app exists for. A card that is only useful
after an earlier card has been used goes *before* the list, not after it.

## 2. One figure, one place

A count, a status, or a revision appears once on the page. If a summary figure is worth a card at
the top, the row does not repeat it as a badge; if the row needs it, the summary does not repeat
it. Two renderings of one number eventually disagree, and the reader has no way to tell which is
right.

## 3. Every list has four states

`sourceStates(id, "Nothing registered yet.")` from `@effect-agent/effect-ui` renders loading
skeletons, an empty notice, and a failure callout — each visible on exactly the right verdict.
Place it directly above the list it describes. A list that shows a bare header when it is empty
reads as broken; a view that binds a source path nobody writes renders an empty element.

Source state lives at `/_sources/<id>` and the runtime owns it. The verdict is one word —
`loading`, `ready`, `empty`, `failed` — and a failure never empties the rows already on screen.
Read it through `sourceStatusPath()` / `sourceStates()`; never spell the path by hand.

## 4. A row leads with an identity, not an id

The first cell is the thing's name or its title. A raw identifier (`serverId`, `callId`, `nodeId`,
a UUID) is a key, not content: it belongs in a `Code` chip on the row's detail surface, or in the
`repeat` key. An operator cannot read a page of UUIDs.

## 5. One badge per row, not one per possible value

Render the state the row is *in* — `Badge` bound to the value — not one badge per possible state
with `visible` guards keeping all but one hidden. The guarded form ships N hidden elements per row
and breaks the moment a value is added.

The language has no value→style map, so a bound badge cannot take a per-value colour. That is the
rule working as intended rather than a gap to route around: **colour is for signals, not for
enumerations.** A state name is text. A red badge is for something that is wrong — a failed run, a
refused call, a source that could not be read — and it earns its colour by being guarded on a
condition that either holds or does not, not by being one of N alternatives.

## 6. A row carries the action that is primary for that row

One button, the one an operator most often wants. State changes are a `Select` (a control), not
one button per target state. Destructive actions are secondary — never a row of five equally
weighted buttons. Anything that needs an argument belongs on the detail surface, not in the row.

## 7. An action's result appears where the press was

If a press can fail, its failure is visible in the section that holds the button — not in a
different card, not behind a tab the operator has to open. A result readout is guarded by
`visible`, so it does not render as an empty chip before the first press. The action runtime
writes `{ ok: false, error }` on failure: read `error`, not `detail`.

## 8. Do not invent components

A node names a `@radix-ui/themes` export and carries that component's own props. There is no
component vocabulary of ours to extend, and no wrapper to write. If a presentation is missing,
the answer is a different arrangement of the library's components — not a new one.

## 9. A declaration that is served is either rendered or deleted

A source, a state path, or an action that no node reads is dead weight that reads as a feature.
Either render it or remove it. The same goes for a picker whose options are hard-coded while the
server serves the real list.

## 10. Anything sized to its content sits in a row

The page column and every card's stack are `Flex direction="column"`, and a flex column stretches
its children across the cross axis. Anything the design system sizes to its content — a `Badge`, a
`Code` chip, a lone `Button` — put straight into a stack grows to the full width of the page or the
card: a seven-character badge paints as a banner, a key paints as a bar under the name it belongs
to. Wrap them in `row([...])` from `@effect-agent/effect-ui`, or give the stack `align="start"` when
it holds a chip under a label. A row whose children are all hidden has nothing in it and takes no
height, so a guarded outcome can live in a row without leaving a gap.

Nothing else needs a row: text, callouts, fields, and tables are meant to fill the width they are
given, and wrapping one only narrows it.

This is the one rule a static read of the view cannot check by eye — the declaration is legal and
only the rendering shows the stretch. `row` exists so the remedy has one home rather than one per
console.
