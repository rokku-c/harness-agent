/-
  What the palette may run, and against which app —
  `apps/effect-server/src/client/console-command-console.ts` (`runsFromHere`) and
  `console-action-registry.ts` (`runMountedAction`, `clearMountedActions`).

  §6.4's Actions group is the only group whose `Enter` does something instead of
  going somewhere, and it is the only one where a wrong answer is a *write*. Two
  rules from §6.3 and §6.4 meet there and both are refusals.

  **No destructive action is one keystroke.** The declarations carry no flag
  saying which actions destroy something, so the only signal there is is the
  method, and the rule admits `GET` and nothing else: a call that goes somewhere
  runs from one keystroke exactly when it is a read (`only_get_is_admitted`), and
  a method this model does not know is refused rather than assumed to be a read.
  What that costs is stated in the file itself — a few harmless actions are sent to
  their own screen — and it is the direction to be wrong in, because the other one
  is `Enter` on `Delete task` with no confirmation anywhere
  (`dropping_the_method_check_runs_a_delete` is that exact action, admitted by the
  reading that keeps only the argument rule).

  **An action that needs arguments never runs** (`an_action_with_arguments_never_runs`),
  so a row whose action declares `params` points at the control that supplies them
  instead of running with none.

  The registry half answers a different question: *which* app's action a press may
  run. One app is mounted at a time, the app id is part of the registration, and
  it is checked again on the way out — so a press that arrives in the moment
  between one app unmounting and the next mounting runs nothing
  (`nothing_runs_unmounted`, `runs_only_the_mounted_app`) rather than running the
  wrong app's action, and no name the view did not register runs at all
  (`runs_only_a_registered_name`). The clear is guarded by the same id, which is
  what makes it a *disposal* rather than a reset: an app that unmounts after its
  replacement has registered leaves the replacement's slot alone
  (`stale_clear_leaves_the_replacement`) — the same asymmetry
  `Formal/Lifecycle.lean` proves for the host's registry.

  Idealisation: a declared action is the arguments it declares, the address it
  calls and its method (`Action`) — the parts the two refusals read. The handlers
  are a list of names rather than functions, since what is proved about them is
  which ones can be reached and not what they do.
-/

namespace CommandRun

/-- The methods a declared action can name. `other` is everything the grammar has
    not been taught, and it is not read as a read. -/
inductive Method where
  | get
  | post
  | patch
  | del
  | other (name : String)
  deriving DecidableEq

/-- A declared action, as the palette's two refusals read it. -/
structure Action where
  params : List String
  url : Option String
  method : Option Method

/-- Whether the palette may run this action rather than point at the control that
    supplies it: no declared arguments, and not a write. -/
def runsFromHere (a : Action) : Prop :=
  a.params = [] ∧ (a.url = none ∨ a.method = some Method.get)

/-- What must never run in one keystroke: a call that goes somewhere and is not a
    read. A declaration that names no method is not read as a read either — the
    rule admits `GET` and nothing else. -/
def isWrite (a : Action) : Prop := a.url ≠ none ∧ a.method ≠ some Method.get

/-- §6.3's rule, at the one place it can be broken: what the palette runs is never
    a write. The two are complements, which is why the rule cannot be read two
    ways — a condition that admitted anything else would admit a write. -/
theorem a_write_never_runs_from_here {a : Action} (h : isWrite a) : ¬ runsFromHere a := by
  intro hr
  rcases hr.2 with hu | hu
  · exact h.1 hu
  · exact h.2 hu

/-- A call that goes somewhere runs from one keystroke exactly when it is a read.
    The refusals are not vacuous: everything a declaration can name besides `GET`
    — a `POST`, a `PATCH`, a `DELETE`, and any method the grammar does not know —
    is on the other side of this line. -/
theorem only_get_is_admitted (params : List String) (u : Option String) (hu : u ≠ none)
    (m : Method) : isWrite ⟨params, u, some m⟩ ↔ m ≠ Method.get := by
  constructor
  · intro h hc
    exact h.2 (by rw [hc])
  · intro h
    exact ⟨hu, fun hc => h (Option.some.inj hc)⟩

/-- §6.4 rule 2: an action that needs arguments never runs from the palette, and
    the refusal is the declaration's own — nothing has to notice at press time. -/
theorem an_action_with_arguments_never_runs {a : Action} (h : a.params ≠ []) :
    ¬ runsFromHere a := fun hr => h hr.1

/-- The reading that keeps only the argument rule. It is not a straw man: "it takes
    no arguments, so it is safe to repeat" is the natural simplification, and the
    action below is argument-free. -/
def runsWithoutMethodCheck (a : Action) : Prop := a.params = []

/-- Deleting one task by id: no arguments, because the id is in the address. -/
def deleteOneTask : Action := ⟨[], some "/board/api/tasks/1", some .del⟩

/-- One `Enter`, one deleted record, nothing asked. This is the failure the method
    check exists for, and it is silent until the record is gone. -/
theorem dropping_the_method_check_runs_a_delete :
    runsWithoutMethodCheck deleteOneTask ∧ isWrite deleteOneTask ∧ ¬ runsFromHere deleteOneTask := by
  have noparams : runsWithoutMethodCheck deleteOneTask := rfl
  have iswrite : isWrite deleteOneTask := ⟨by decide, fun hc => absurd hc (by decide)⟩
  have notrun : ¬ runsFromHere deleteOneTask := by
    rintro ⟨-, hu | hu⟩
    · exact absurd hu (by decide)
    · exact absurd hu (by decide)
  exact ⟨noparams, iswrite, notrun⟩

/-! ### Which app's action a press may run -/

/-- The app whose view is mounted, and the actions it said it can run. -/
structure Mounted where
  app : String
  names : List String

/-- One slot, because one app is mounted at a time: a registration replaces the one
    before it rather than joining it. -/
def setMountedActions (_current : Option Mounted) (slot : Mounted) : Option Mounted := some slot

/-- Unmounting. Guarded by the app's own id, so it is this app's slot or nothing. -/
def clearMountedActions (current : Option Mounted) (app : String) : Option Mounted :=
  match current with
  | some slot => if slot.app = app then none else current
  | none => none

/-- Runs one declared action of the mounted app, and nothing at all for any other.
    `none` is "nothing ran". -/
def runMountedAction (current : Option Mounted) (app name : String) : Option String :=
  match current with
  | none => none
  | some slot =>
    if slot.app = app then (if name ∈ slot.names then some name else none) else none

theorem nothing_runs_unmounted (app name : String) : runMountedAction none app name = none := rfl

/-- What runs is the mounted app's action and no other's. The check is on the way
    out rather than only at registration, which is what covers the moment between
    one app unmounting and the next mounting: a press that arrives then runs
    nothing at all. -/
theorem runs_only_the_mounted_app {current : Option Mounted} {app name r : String}
    (h : runMountedAction current app name = some r) :
    ∃ slot, current = some slot ∧ slot.app = app := by
  cases current with
  | none => simp [runMountedAction] at h
  | some slot =>
    by_cases ha : slot.app = app
    · exact ⟨slot, rfl, ha⟩
    · simp [runMountedAction, ha] at h

/-- And only a name the app registered, so no row can run an action the view never
    said it can run. -/
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

/-- A disposal is not a reset: an app that unmounts after its replacement has
    registered leaves the replacement's slot exactly as it was. Without the id
    check the late unmount empties a slot it does not own, and the app now on
    screen can run nothing. -/
theorem stale_clear_leaves_the_replacement (slot : Mounted) (app : String) (h : slot.app ≠ app) :
    clearMountedActions (some slot) app = some slot := by
  simp [clearMountedActions, h]

end CommandRun
