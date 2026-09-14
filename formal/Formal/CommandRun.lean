namespace CommandRun

inductive Method where
  | get
  | post
  | patch
  | del
  | other (name : String)
  deriving DecidableEq

structure Action where
  params : List String
  url : Option String
  method : Option Method

def runsFromHere (a : Action) : Prop :=
  a.params = [] ∧ (a.url = none ∨ a.method = some Method.get)

def isWrite (a : Action) : Prop := a.url ≠ none ∧ a.method ≠ some Method.get

theorem a_write_never_runs_from_here {a : Action} (h : isWrite a) : ¬ runsFromHere a := by
  intro hr
  rcases hr.2 with hu | hu
  · exact h.1 hu
  · exact h.2 hu

theorem only_get_is_admitted (params : List String) (u : Option String) (hu : u ≠ none)
    (m : Method) : isWrite ⟨params, u, some m⟩ ↔ m ≠ Method.get := by
  constructor
  · intro h hc
    exact h.2 (by rw [hc])
  · intro h
    exact ⟨hu, fun hc => h (Option.some.inj hc)⟩

theorem an_action_with_arguments_never_runs {a : Action} (h : a.params ≠ []) :
    ¬ runsFromHere a := fun hr => h hr.1

def runsWithoutMethodCheck (a : Action) : Prop := a.params = []

def deleteOneTask : Action := ⟨[], some "/board/api/tasks/1", some .del⟩

theorem dropping_the_method_check_runs_a_delete :
    runsWithoutMethodCheck deleteOneTask ∧ isWrite deleteOneTask ∧ ¬ runsFromHere deleteOneTask := by
  have noparams : runsWithoutMethodCheck deleteOneTask := rfl
  have iswrite : isWrite deleteOneTask := ⟨by decide, fun hc => absurd hc (by decide)⟩
  have notrun : ¬ runsFromHere deleteOneTask := by
    rintro ⟨-, hu | hu⟩
    · exact absurd hu (by decide)
    · exact absurd hu (by decide)
  exact ⟨noparams, iswrite, notrun⟩


structure Mounted where
  app : String
  names : List String

def setMountedActions (_current : Option Mounted) (slot : Mounted) : Option Mounted := some slot

def clearMountedActions (current : Option Mounted) (app : String) : Option Mounted :=
  match current with
  | some slot => if slot.app = app then none else current
  | none => none

def runMountedAction (current : Option Mounted) (app name : String) : Option String :=
  match current with
  | none => none
  | some slot =>
    if slot.app = app then (if name ∈ slot.names then some name else none) else none

theorem nothing_runs_unmounted (app name : String) : runMountedAction none app name = none := rfl

theorem runs_only_the_mounted_app {current : Option Mounted} {app name r : String}
    (h : runMountedAction current app name = some r) :
    ∃ slot, current = some slot ∧ slot.app = app := by
  cases current with
  | none => simp [runMountedAction] at h
  | some slot =>
    by_cases ha : slot.app = app
    · exact ⟨slot, rfl, ha⟩
    · simp [runMountedAction, ha] at h

theorem runs_only_a_registered_name {current : Option Mounted} {app name r : String}
    (h : runMountedAction current app name = some r) :
    ∃ slot, current = some slot ∧ name ∈ slot.names := by
  cases current with
  | none => simp [runMountedAction] at h
  | some slot =>
    by_cases ha : slot.app = app
    · by_cases hn : name ∈ slot.names
      · exact ⟨slot, rfl, hn⟩
      · simp [runMountedAction, ha, hn] at h
    · simp [runMountedAction, ha] at h

theorem clear_the_mounted_app (slot : Mounted) : clearMountedActions (some slot) slot.app = none := by
  simp [clearMountedActions]

theorem clear_unmounted (app : String) : clearMountedActions none app = none := rfl

theorem stale_clear_leaves_the_replacement (slot : Mounted) (app : String) (h : slot.app ≠ app) :
    clearMountedActions (some slot) app = some slot := by
  simp [clearMountedActions, h]

end CommandRun
