/-
  ONE HOME FOR A SET AND A BINDING — `mcp-gateway/src/set-source.ts` and
  `mcp-gateway/src/live-sets.ts`.

  A set is declared in the center that configures machines and enforced at the
  door. Those are two apps in one host and one fact between them, and the file
  that carries it is a seam rather than a copy: the center hands over a *reader*
  and the door asks it at the moment it decides. Nothing is kept in step, so
  there is no instant at which the two could disagree — which is the defect this
  replaces, where a binding written in the center left the door's page reading a
  copy of a config nobody had written to.

  **The slot holds one author** — `a_second_provider_is_refused`. A fact with two
  writers is the thing the seam removes, so an app that is not the one holding the
  slot cannot take it (`another_app_cannot_take_the_sets`). A reload is not a
  second author — the same app saying the same thing again with a newer reading,
  and `a_reload_is_the_same_app_saying_it_again` is why it is allowed instead.

  **The door rebuilds on the counter, not on a clock** —
  `the_door_serves_what_the_center_holds`. `revision` is the center's own write
  counter, and the contract on a write is that it never rewinds the counter and
  moves it whenever it changes a declaration, which is the whole of what the
  door's one-line rule reads. A door that has not looked since a write is serving
  what that write replaced: `a_door_that_never_rebuilds_serves_a_replaced_binding`,
  which is one write away, and is what a timer's period costs.

  **A rebuild is total** — `the_center_refuses_what_the_door_could_not_build`. The
  registry refuses a set naming one server twice, a binding naming one set twice,
  and a set that both allows and denies one tool, and every one of those is a
  question the one mcpset grammar already asked. So a declaration the center
  stores is one the door's rebuild cannot throw on, and the rebuild cannot fail
  halfway through and leave the door holding half a topology. That it holds in
  both directions (`what_the_door_could_not_build_the_center_refuses`) is what
  makes the two *one* question rather than the stricter of two.

  Idealisation: a state is a counter and its declarations, and the declarations
  are their names — set ids and server ids — rather than the objects; what a
  registry does with them is `Formal/Sets.lean`'s, and this file reads only the
  guards its rebuild would throw on. Two of those guards are not modelled because
  they are unreachable rather than proved: a duplicate set and a duplicate binding
  cannot be stored at all, because the center holds one of each under a key, and a
  name nobody declares is refused where it is written (`upsertSet`, `bindAgent`)
  rather than at the door.
-/

namespace SetSource

/- The slot: one app says where the sets live, and no second one may. -/

/-- The seam as it is held: who filled it, and the reading they handed over. -/
structure Slot where
  provider : Option String
  reading : Option (List String)
deriving DecidableEq, Repr

/-- `provide`, one line of `set-source.ts`: the first author keeps the slot, and
the same author may say it again with a newer reading. -/
def provide (slot : Slot) (who : String) (reading : List String) : Option Slot :=
  match slot.provider with
  | none => some { provider := some who, reading := some reading }
  | some held => if held = who then some { provider := some who, reading := some reading } else none

/-- A fact with two authors is the defect the seam removes: an app that is not the
one holding the slot takes nothing, rather than overwriting it. -/
theorem a_second_provider_is_refused (slot : Slot) (held who : String) (reading : List String)
    (holds : slot.provider = some held) (other : held ≠ who) : provide slot who reading = none := by
  simp [provide, holds, other]

/-- The control, read at the shape a real second app has. -/
theorem another_app_cannot_take_the_sets (who other : String) (reading : List String) (different : who ≠ other) :
    provide { provider := some who, reading := some ["coding"] } other reading = none := by
  simp [provide, different]

/-- A reload is the same app saying the same thing again, so it is allowed: what
it takes is its own slot, with the reading it has now. -/
theorem a_reload_is_the_same_app_saying_it_again (who : String) (before after : List String) :
    provide { provider := some who, reading := some before } who after
      = some { provider := some who, reading := some after } := by
  simp [provide]

/- The counter, and the door's one line about it. -/

/-- What the center holds at one moment. -/
structure Center where
  revision : Nat
  sets : List String
  bindings : List String
deriving DecidableEq, Repr

/-- One write, with the two things the center's counter owes a reader: it never
rewinds, and a write that changes a declaration moves it. -/
structure Write where
  step : Center → Center
  never_rewinds : ∀ c, c.revision ≤ (step c).revision
  bumped : ∀ c, (step c).sets ≠ c.sets ∨ (step c).bindings ≠ c.bindings → (step c).revision ≠ c.revision

/-- The writes the center has taken since a reader looked, oldest first. -/
def run (writes : List Write) (c : Center) : Center := writes.foldl (fun c w => w.step c) c

/-- Reads are not rewinds. -/
theorem run_never_rewinds (writes : List Write) (c : Center) : c.revision ≤ (run writes c).revision := by
  induction writes generalizing c with
  | nil => exact Nat.le_refl _
  | cons w rest ih => exact Nat.le_trans (w.never_rewinds c) (ih (w.step c))

/-- A trace that did not move the counter did not move a declaration either. This
is the whole of what the door's rebuild rests on. -/
theorem what_the_counter_did_not_move_nothing_moved (writes : List Write) (c : Center)
    (same : (run writes c).revision = c.revision) :
    (run writes c).sets = c.sets ∧ (run writes c).bindings = c.bindings := by
  induction writes generalizing c with
  | nil => exact ⟨rfl, rfl⟩
  | cons w rest ih =>
    have held : (w.step c).revision = c.revision :=
      Nat.le_antisymm (by rw [← same]; exact run_never_rewinds rest (w.step c)) (w.never_rewinds c)
    have unmoved : ¬ ((w.step c).sets ≠ c.sets ∨ (w.step c).bindings ≠ c.bindings) :=
      fun changed => w.bumped c changed held
    have setsame : (w.step c).sets = c.sets := by
      by_cases h : (w.step c).sets = c.sets
      · exact h
      · exact absurd (Or.inl h) unmoved
    have bindsame : (w.step c).bindings = c.bindings := by
      by_cases h : (w.step c).bindings = c.bindings
      · exact h
      · exact absurd (Or.inr h) unmoved
    obtain ⟨sets, binds⟩ := ih (w.step c) (by rw [held]; exact same)
    exact ⟨sets.trans setsame, binds.trans bindsame⟩

/-- The door's cache: the declarations a build was made from, and the counter it
was made at. -/
structure Build where
  revision : Nat
  sets : List String
  bindings : List String
deriving DecidableEq, Repr

/-- What a build is made from. -/
def buildOf (c : Center) : Build := ⟨c.revision, c.sets, c.bindings⟩

/-- `live-sets.ts`'s rebuild rule: rebuild when the counter moved, serve the build
in hand otherwise — and never on a clock. -/
def served (built : Option Build) (now : Center) : Build :=
  match built with
  | none => buildOf now
  | some b => if b.revision = now.revision then b else buildOf now

/-- What the door serves is what the center holds, however far the center has moved
since the build — provided the build was made from a state the center reached. -/
theorem the_door_serves_what_the_center_holds (writes : List Write) (start : Center) (b : Build)
    (made : b = buildOf start) :
    (served (some b) (run writes start)).sets = (run writes start).sets ∧
      (served (some b) (run writes start)).bindings = (run writes start).bindings := by
  rw [made]
  have kept := fun same => what_the_counter_did_not_move_nothing_moved writes start same
  by_cases moved : (buildOf start).revision = (run writes start).revision
  · obtain ⟨sets, binds⟩ := kept moved.symm
    have serving : served (some (buildOf start)) (run writes start) = buildOf start := by
      simp only [served, if_pos moved]
    rw [serving]
    exact ⟨sets.symm, binds.symm⟩
  · have serving : served (some (buildOf start)) (run writes start) = buildOf (run writes start) := by
      simp only [served, if_neg moved]
    rw [serving]
    exact ⟨rfl, rfl⟩

/-- A door that decides with the build it holds and never asks the counter again:
what a refresh on a clock amounts to between two ticks. -/
def held (built : Build) (_now : Center) : Build := built

/-- The one write: the operator replaces an agent's binding, and the counter moves. -/
def rebindStep (to : List String) (c : Center) : Center :=
  { revision := c.revision + 1, sets := c.sets, bindings := to }

/-- That write, as the center performs it. -/
def rebind (to : List String) : Write where
  step := rebindStep to
  never_rewinds := fun c => Nat.le_succ c.revision
  bumped := fun _ _ => Nat.succ_ne_self _

/-- An agent bound to `coding`. -/
def boundToCoding : Center := { revision := 7, sets := ["coding"], bindings := ["a1"] }

/-- The control: a door that has not looked since the binding was replaced is still
serving the binding that was replaced. One write of staleness — and a clock door
serves it for as long as the period, which is the whole of what the period costs. -/
theorem a_clock_serves_what_the_write_replaced :
    (held (buildOf boundToCoding) (run [rebind ["a2"]] boundToCoding)).bindings = ["a1"] ∧
      (run [rebind ["a2"]] boundToCoding).bindings = ["a2"] := by
  decide

/-- And the door that asks the counter instead: the same write, and the binding it
serves is the one the write put there. There is no window between the two. -/
theorem the_counter_door_serves_the_replacement_at_once :
    served (some (buildOf boundToCoding)) (run [rebind ["a2"]] boundToCoding)
      = buildOf (run [rebind ["a2"]] boundToCoding) := by
  decide

/- The one grammar, and the guards the door's rebuild would throw on. -/

/-- `repeatedName` in `set-schema.ts`: whether some name appears twice. -/
def repeated : List String → Bool
  | [] => false
  | x :: xs => decide (x ∈ xs) || repeated xs

/-- The grammar's question and the registry's `unique()` are the same question:
naming a name twice is exactly having a duplicate. -/
theorem no_repeat_is_no_duplicate (xs : List String) : repeated xs = false ↔ xs.Nodup := by
  induction xs with
  | nil => simp [repeated]
  | cons x xs ih => simp [repeated, ih, List.nodup_cons, Bool.or_eq_false_iff, decide_eq_false_iff_not]

/-- A declaration as both readings see one: the set's servers and its two lists,
and the set ids a binding names. -/
structure Declaration where
  servers : List String
  allow : Option (List String)
  deny : List String
  setIds : List String
deriving DecidableEq, Repr

/-- The one rule about sets that a field shape cannot carry: a set that both allows
and denies one tool has no meaning. -/
def overlap (d : Declaration) : Bool :=
  match d.allow with
  | none => false
  | some allowed => d.deny.any fun tool => decide (tool ∈ allowed)

/-- What the mcpset grammar stores: no name twice, and no allow-deny overlap. -/
def accepted (d : Declaration) : Prop :=
  repeated d.servers = false ∧ repeated d.setIds = false ∧ overlap d = false

/-- What the door's rebuild can build: nothing `registerSet` or `bindAgent` throws
on. -/
def buildable (d : Declaration) : Prop :=
  d.servers.Nodup ∧ d.setIds.Nodup ∧ overlap d = false

/-- The center refuses what the door could not build. A declaration that got past
the grammar is one the rebuild cannot throw on, so the door cannot be left holding
half a topology. -/
theorem the_center_refuses_what_the_door_could_not_build (d : Declaration) (ok : accepted d) :
    buildable d :=
  ⟨(no_repeat_is_no_duplicate d.servers).mp ok.1, (no_repeat_is_no_duplicate d.setIds).mp ok.2.1, ok.2.2⟩

/-- And the other direction, which is what makes the two one question rather than
the stricter of two: what the door could not build never reaches the door. -/
theorem what_the_door_could_not_build_the_center_refuses (d : Declaration) (bad : ¬ d.servers.Nodup) :
    ¬ accepted d :=
  fun ok => bad ((no_repeat_is_no_duplicate d.servers).mp ok.1)

/-- A well-formed declaration, decided both ways: the grammar stores it and the
rebuild builds it. -/
def exampleDeclaration : Declaration :=
  { servers := ["files", "archives"], allow := some ["read"], deny := ["write"], setIds := ["safe", "danger"] }

/-- The control: the same declaration naming one server twice is refused by the
grammar and unbuildable at the door — refused before it is stored, so there is no
half-topology for the door to be stuck in. -/
def twiceDeclaration : Declaration := { exampleDeclaration with servers := ["files", "files"] }

theorem a_declaration_both_readings_admit :
    accepted exampleDeclaration ∧ buildable exampleDeclaration := by
  unfold accepted buildable
  decide

theorem a_name_twice_is_refused_by_both_readings :
    ¬ accepted twiceDeclaration ∧ ¬ buildable twiceDeclaration := by
  unfold accepted buildable
  decide

end SetSource
