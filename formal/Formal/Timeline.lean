namespace Timeline

structure Turn where
  ts : Nat

structure Entry where
  seq : Nat
  ts : Nat

def openedAt : List Turn → Nat → List Entry
  | [], _ => []
  | turn :: rest, before => ⟨before + 1, turn.ts⟩ :: openedAt rest (before + 1)

def opened (turns : List Turn) : List Entry := openedAt turns 0

def nextNumber (rows : List Entry) : Nat := rows.length + 1

def record (rows : List Entry) (turn : Turn) : List Entry := rows ++ [⟨nextNumber rows, turn.ts⟩]

def Runs : Nat → List Entry → Prop
  | _, [] => True
  | before, [entry] => entry.seq = before + 1
  | before, entry :: next :: rest => entry.seq = before + 1 ∧ Runs (before + 1) (next :: rest)

theorem opening_puts_the_whole_conversation_on_the_timeline : ∀ (turns : List Turn) (before : Nat),
    (openedAt turns before).length = turns.length
  | [], _ => rfl
  | _ :: rest, before => by
      simp only [openedAt, List.length_cons]
      rw [opening_puts_the_whole_conversation_on_the_timeline rest (before + 1)]

theorem opening_numbers_every_turn_by_its_place : ∀ (turns : List Turn) (before : Nat),
    Runs before (openedAt turns before)
  | [], _ => trivial
  | [_], _ => rfl
  | _turn :: next :: rest, before => ⟨rfl, opening_numbers_every_turn_by_its_place (next :: rest) (before + 1)⟩

theorem a_timeline_nobody_opened_onto_numbers_from_one : nextNumber ([] : List Entry) = 1 := rfl

theorem the_next_turn_is_numbered_after_the_conversation (turns : List Turn) :
    nextNumber (opened turns) = turns.length + 1 := by
  simp only [nextNumber, opened, opening_puts_the_whole_conversation_on_the_timeline turns 0]

theorem recording_drops_nothing (rows : List Entry) (turn : Turn) : (record rows turn).length = rows.length + 1 := by
  simp only [record, List.length_append, List.length_singleton, nextNumber]

end Timeline
