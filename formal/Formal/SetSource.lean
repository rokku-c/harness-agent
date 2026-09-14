namespace SetSource


structure Slot where
  provider : Option String
  reading : Option (List String)
deriving DecidableEq, Repr

def provide (slot : Slot) (who : String) (reading : List String) : Option Slot :=
  match slot.provider with
  | none => some { provider := some who, reading := some reading }
  | some held => if held = who then some { provider := some who, reading := some reading } else none

theorem a_second_provider_is_refused (slot : Slot) (held who : String) (reading : List String)
    (holds : slot.provider = some held) (other : held ≠ who) : provide slot who reading = none := by
  simp [provide, holds, other]

theorem another_app_cannot_take_the_sets (who other : String) (reading : List String) (different : who ≠ other) :
    provide { provider := some who, reading := some ["coding"] } other reading = none := by
  simp [provide, different]

theorem a_reload_is_the_same_app_saying_it_again (who : String) (before after : List String) :
    provide { provider := some who, reading := some before } who after
      = some { provider := some who, reading := some after } := by
  simp [provide]


structure Center where
  revision : Nat
  sets : List String
  bindings : List String
deriving DecidableEq, Repr

structure Write where
  step : Center → Center
  never_rewinds : ∀ c, c.revision ≤ (step c).revision
  bumped : ∀ c, (step c).sets ≠ c.sets ∨ (step c).bindings ≠ c.bindings → (step c).revision ≠ c.revision

def run (writes : List Write) (c : Center) : Center := writes.foldl (fun c w => w.step c) c

theorem run_never_rewinds (writes : List Write) (c : Center) : c.revision ≤ (run writes c).revision := by
  induction writes generalizing c with
  | nil => exact Nat.le_refl _
  | cons w rest ih => exact Nat.le_trans (w.never_rewinds c) (ih (w.step c))

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

structure Build where
  revision : Nat
  sets : List String
  bindings : List String
deriving DecidableEq, Repr

def buildOf (c : Center) : Build := ⟨c.revision, c.sets, c.bindings⟩

def served (built : Option Build) (now : Center) : Build :=
  match built with
  | none => buildOf now
  | some b => if b.revision = now.revision then b else buildOf now

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

def held (built : Build) (_now : Center) : Build := built

def rebindStep (to : List String) (c : Center) : Center :=
  { revision := c.revision + 1, sets := c.sets, bindings := to }

def rebind (to : List String) : Write where
  step := rebindStep to
  never_rewinds := fun c => Nat.le_succ c.revision
  bumped := fun _ _ => Nat.succ_ne_self _

def boundToCoding : Center := { revision := 7, sets := ["coding"], bindings := ["a1"] }

theorem a_clock_serves_what_the_write_replaced :
    (held (buildOf boundToCoding) (run [rebind ["a2"]] boundToCoding)).bindings = ["a1"] ∧
      (run [rebind ["a2"]] boundToCoding).bindings = ["a2"] := by
  decide

theorem the_counter_door_serves_the_replacement_at_once :
    served (some (buildOf boundToCoding)) (run [rebind ["a2"]] boundToCoding)
      = buildOf (run [rebind ["a2"]] boundToCoding) := by
  decide


def repeated : List String → Bool
  | [] => false
  | x :: xs => decide (x ∈ xs) || repeated xs

theorem no_repeat_is_no_duplicate (xs : List String) : repeated xs = false ↔ xs.Nodup := by
  induction xs with
  | nil => simp [repeated]
  | cons x xs ih => simp [repeated, ih, List.nodup_cons, Bool.or_eq_false_iff, decide_eq_false_iff_not]

structure Declaration where
  servers : List String
  allow : Option (List String)
  deny : List String
  setIds : List String
deriving DecidableEq, Repr

def overlap (d : Declaration) : Bool :=
  match d.allow with
  | none => false
  | some allowed => d.deny.any fun tool => decide (tool ∈ allowed)

def accepted (d : Declaration) : Prop :=
  repeated d.servers = false ∧ repeated d.setIds = false ∧ overlap d = false

def buildable (d : Declaration) : Prop :=
  d.servers.Nodup ∧ d.setIds.Nodup ∧ overlap d = false

theorem the_center_refuses_what_the_door_could_not_build (d : Declaration) (ok : accepted d) :
    buildable d :=
  ⟨(no_repeat_is_no_duplicate d.servers).mp ok.1, (no_repeat_is_no_duplicate d.setIds).mp ok.2.1, ok.2.2⟩

theorem what_the_door_could_not_build_the_center_refuses (d : Declaration) (bad : ¬ d.servers.Nodup) :
    ¬ accepted d :=
  fun ok => bad ((no_repeat_is_no_duplicate d.servers).mp ok.1)

def exampleDeclaration : Declaration :=
  { servers := ["files", "archives"], allow := some ["read"], deny := ["write"], setIds := ["safe", "danger"] }

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
