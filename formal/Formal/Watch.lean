namespace EffectServer

abbrev Millis := Nat

structure Line where
  stamp : Millis
deriving DecidableEq, Repr

def isEdit (l : Line) (mtime : Millis) : Bool := decide (l.stamp < mtime)

def react (_l : Line) (now : Millis) : Line := { stamp := now }

def handle (l : Line) (mtime : Millis) (now : Millis) : Line :=
  if isEdit l mtime then react l now else l

theorem a_report_about_a_path_that_only_moved_is_not_an_edit
    (l : Line) (mtime : Millis) (moved : mtime ≤ l.stamp) : isEdit l mtime = false := by
  simp [isEdit, Nat.not_lt.mpr moved]

theorem a_save_after_the_last_reaction_is_an_edit
    (l : Line) (mtime : Millis) (saved : l.stamp < mtime) : isEdit l mtime = true := by
  simp [isEdit, saved]

theorem a_reaction_does_not_report_itself_as_an_edit
    (l : Line) (edit moved now : Millis)
    (saved : l.stamp < edit) (untouched : moved ≤ l.stamp) (reaction : edit ≤ now) :
    isEdit (handle l edit now) moved = false := by
  have stamped : (handle l edit now).stamp = now := by simp [handle, isEdit, saved, react]
  have past : moved < now := Nat.lt_of_le_of_lt untouched (Nat.lt_of_lt_of_le saved reaction)
  simp [isEdit, stamped, Nat.not_lt.mpr (Nat.le_of_lt past)]

def isEditByTheEvent (_l : Line) (_mtime : Millis) : Bool := true

theorem judging_by_the_event_makes_the_reload_cause_the_next_one
    (l : Line) (moved now : Millis) (untouched : moved ≤ l.stamp) (later : l.stamp < now) :
    isEdit l moved = false ∧ isEditByTheEvent l moved = true ∧ handle l moved now = l ∧
    react l now ≠ l := by
  have quiet : isEdit l moved = false :=
    a_report_about_a_path_that_only_moved_is_not_an_edit l moved untouched
  refine ⟨quiet, rfl, by simp [handle, quiet], ?_⟩
  intro advanced
  have stamped : now = l.stamp := by simpa [react] using congrArg Line.stamp advanced
  exact Nat.ne_of_gt later stamped

abbrev Timers := Nat → Option Millis

def armed (t : Timers) (app : Nat) (eventAt : Millis) : Timers :=
  fun a => if a = app then some eventAt else t a

def fired (t : Timers) (app : Nat) : Timers := fun a => if a = app then none else t a

def burst (t : Timers) (app : Nat) : List Millis → Timers
  | [] => t
  | e :: es => burst (armed t app e) app es

theorem the_timer_carries_the_last_event_of_the_burst (t : Timers) (app : Nat)
    (es : List Millis) (arrived : es ≠ []) : (burst t app es) app = es.getLast? := by
  induction es generalizing t with
  | nil => exact absurd rfl arrived
  | cons e rest ih =>
    cases rest with
    | nil => simp [burst, armed]
    | cons f more =>
      have restArrived : f :: more ≠ [] := List.cons_ne_nil f more
      simpa [burst] using ih (armed t app e) restArrived

theorem a_burst_leaves_other_apps_alone (t : Timers) (app other : Nat) (es : List Millis)
    (ne : other ≠ app) : (burst t app es) other = t other := by
  induction es generalizing t with
  | nil => rfl
  | cons e rest ih => simpa [burst, armed, ne] using ih (armed t app e)

theorem a_burst_fires_once (t : Timers) (app : Nat) (es : List Millis) :
    (fired (burst t app es) app) app = none := by
  simp [fired]

end EffectServer
