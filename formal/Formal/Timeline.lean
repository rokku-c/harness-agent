/-
  WHAT OPENS A TIMELINE — `apps/mantis/src/hosts/webui/console/ledger.ts`, whose
  rule `snapshot.ts` reads a conversation's panel from.

  The console keeps a conversation's timeline in memory and the host persists
  every turn to conversation memory, so a conversation that began before this
  process did has both. The panel read them as alternatives — the live timeline
  if it had anything on it, the stored history otherwise — and the two are not
  alternatives: the live timeline starts empty, so the process's first message
  made it non-empty and the fifty turns already on disk stopped being rendered.
  The panel showed one entry where the conversation had fifty-one, and the
  conversation list beside it reported one turn. Neither says so: the timeline
  looks like a timeline, and it simply begins where the process began.

  A timeline is therefore opened onto the conversation rather than started
  beside it, and the numbers follow: the entry a turn lands on is its place in
  the conversation, so the turn that arrives after fifty recorded ones is the
  fifty-first — where the process that started its own timeline numbered it one.

  Modelling note: the stored history is a list of turns, and a timeline entry
  carries the number it is read by. Text and roles are not modelled because
  nothing here reads them; the defect is entirely in the numbering and in what
  the panel is handed.
-/

namespace Timeline

/-- A turn as conversation memory holds it: when it was recorded. -/
structure Turn where
  ts : Nat

/-- An entry on a conversation's timeline: the number it is read by, and when the
    turn it came from happened. -/
structure Entry where
  seq : Nat
  ts : Nat

/-- Number the turns of a conversation by their place in it: the number a turn
    lands on is how many turns came before it, offset by what was already there. -/
def openedAt : List Turn → Nat → List Entry
  | [], _ => []
  | turn :: rest, before => ⟨before + 1, turn.ts⟩ :: openedAt rest (before + 1)

/-- The timeline a console opens onto: a conversation's recorded turns, numbered
    by their place in the conversation. -/
def opened (turns : List Turn) : List Entry := openedAt turns 0

/-- The number the next turn is given: one more than the entries on the timeline,
    which is the console's own rule and not a choice made here. -/
def nextNumber (rows : List Entry) : Nat := rows.length + 1

/-- Record a turn: it takes the next number and goes on the end. -/
def record (rows : List Entry) (turn : Turn) : List Entry := rows ++ [⟨nextNumber rows, turn.ts⟩]

/-- A timeline is numbered by a conversation's own count: the first entry is the
    turn after the ones recorded before the timeline began, and each entry after
    it is one more — no number skipped and none used twice. -/
def Runs : Nat → List Entry → Prop
  | _, [] => True
  | before, [entry] => entry.seq = before + 1
  | before, entry :: next :: rest => entry.seq = before + 1 ∧ Runs (before + 1) (next :: rest)

/-- Opening onto a conversation puts every turn it already holds on the timeline,
    and puts nothing else there. -/
theorem opening_puts_the_whole_conversation_on_the_timeline : ∀ (turns : List Turn) (before : Nat),
    (openedAt turns before).length = turns.length
  | [], _ => rfl
  | _ :: rest, before => by
      simp only [openedAt, List.length_cons]
      rw [opening_puts_the_whole_conversation_on_the_timeline rest (before + 1)]

/-- And numbers them by their place, so the number a turn is read by is the number
    of turns the conversation recorded before it, plus the ones this timeline
    began after. -/
theorem opening_numbers_every_turn_by_its_place : ∀ (turns : List Turn) (before : Nat),
    Runs before (openedAt turns before)
  | [], _ => trivial
  | [_], _ => rfl
  | _turn :: next :: rest, before => ⟨rfl, opening_numbers_every_turn_by_its_place (next :: rest) (before + 1)⟩

/-- The control, and the bug in one line: a timeline nobody opened onto is empty,
    so the turn that arrives next is numbered one — a conversation's fifty-first
    turn, reported as its first. -/
theorem a_timeline_nobody_opened_onto_numbers_from_one : nextNumber ([] : List Entry) = 1 := rfl

/-- So opening onto a conversation is what makes the turn that arrives next take
    its place in the conversation: after fifty recorded turns, the next one is
    the fifty-first. -/
theorem the_next_turn_is_numbered_after_the_conversation (turns : List Turn) :
    nextNumber (opened turns) = turns.length + 1 := by
  simp only [nextNumber, opened, opening_puts_the_whole_conversation_on_the_timeline turns 0]

/-- And recording drops nothing that was already on the timeline: the turns the
    conversation had recorded are still read, in their places, with the new one
    after them. -/
theorem recording_drops_nothing (rows : List Entry) (turn : Turn) : (record rows turn).length = rows.length + 1 := by
  simp only [record, List.length_append, List.length_singleton, nextNumber]

end Timeline
