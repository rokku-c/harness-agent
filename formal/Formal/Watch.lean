/-
  Reloading when an app's source changes — `apps/effect-server/src/boot/watch.ts`.

  Two claims in that file's header decide *when* an fs event is an edit, and both
  fail silently when they are wrong: one reloads forever, the other imports half a
  module and reports success.

  **An event is not an edit.** Compiling a bundle copies the app's own asset
  directories into the artifact, and the filesystem reports the *source* directory
  as renamed when it does. A rename moves a directory without writing it, so the
  path the report names still carries the modification time it had all along — and
  the judgement is made on the file, against the last time this app reacted.
  `a_reaction_does_not_report_itself_as_an_edit` is why the loop closes: the report
  the reaction causes is read against the line the reaction just stamped, and a
  path that only moved is not past it. Judge by the event instead and every copy is
  another reload — `judging_by_the_event_makes_the_reload_cause_the_next_one`.

  **A burst is one reload, after the last event.** An editor saving a file is
  several events, and a reload is a module import: one reload per event would
  import a half-written module and then the whole one over the top of it. One timer
  is armed per app and re-arming replaces it, so what fires carries the *last*
  event's time — `the_timer_carries_the_last_event_of_the_burst` — and a save in
  one app cannot touch its neighbours' timers — `a_burst_leaves_other_apps_alone`.

  Idealisation: a modification time is a natural number, and "the file moved past
  the line" is that number being larger. Which of the reports a build produces are
  moves and which are writes is what the file's own acceptance run measured; this
  model takes the distinction as given.
-/

namespace EffectServer

abbrev Millis := Nat

/-- When an app last reacted — `reactedAt`, or `startedAt` before it has reacted
once. The line an event's modification time is read against. -/
structure Line where
  stamp : Millis
deriving DecidableEq, Repr

/-- `modified path since`: an event is an edit exactly when the file's own
modification time is past the line. -/
def isEdit (l : Line) (mtime : Millis) : Bool := decide (l.stamp < mtime)

/-- The app reacts: the line is stamped at the moment of the reaction. -/
def react (_l : Line) (now : Millis) : Line := { stamp := now }

/-- One event handled: react if the file moved past the line, and if it did not,
do nothing at all — the report was not an edit. -/
def handle (l : Line) (mtime : Millis) (now : Millis) : Line :=
  if isEdit l mtime then react l now else l

/-- A path the reaction only moved is not an edit, however many times the
filesystem reports it. -/
theorem a_report_about_a_path_that_only_moved_is_not_an_edit
    (l : Line) (mtime : Millis) (moved : mtime ≤ l.stamp) : isEdit l mtime = false := by
  simp [isEdit, Nat.not_lt.mpr moved]

/-- A save is an edit: reading events against the file's time never drops one. -/
theorem a_save_after_the_last_reaction_is_an_edit
    (l : Line) (mtime : Millis) (saved : l.stamp < mtime) : isEdit l mtime = true := by
  simp [isEdit, saved]

/-- The loop closes. A save past the line starts a reaction at `now`; the reaction
moves the app's asset directories into the artifact and the filesystem reports the
source path, whose own modification time `moved` never moved. That report is read
against the line the reaction just stamped and it is not past it, so the reload
that copied does not report itself as the edit that starts the next one. -/
theorem a_reaction_does_not_report_itself_as_an_edit
    (l : Line) (edit moved now : Millis)
    (saved : l.stamp < edit) (untouched : moved ≤ l.stamp) (reaction : edit ≤ now) :
    isEdit (handle l edit now) moved = false := by
  have stamped : (handle l edit now).stamp = now := by simp [handle, isEdit, saved, react]
  have past : moved < now := Nat.lt_of_le_of_lt untouched (Nat.lt_of_lt_of_le saved reaction)
  simp [isEdit, stamped, Nat.not_lt.mpr (Nat.le_of_lt past)]

/-- Judging the event instead of the file: reload whenever the filesystem speaks.
The shape the header names as a reload loop, and the control for the three
theorems above. -/
def isEditByTheEvent (_l : Line) (_mtime : Millis) : Bool := true

/-- One report of a path the reaction only moved, both ways. The guarded
judgement leaves the line where it was, so the sequence settles; judging by the
event stamps the line anew, and the line a reaction leaves is the one the next
report is read against — so the reload causes the next reload and nothing stops
it. -/
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

/-- The timers the watcher is holding: which apps have a reaction pending, and the
time of the event that armed each. At most one entry per app, which is what makes
a burst one reload. -/
abbrev Timers := Nat → Option Millis

/-- An event for an app arms its timer, or re-arms it over whatever it was waiting
for. -/
def armed (t : Timers) (app : Nat) (eventAt : Millis) : Timers :=
  fun a => if a = app then some eventAt else t a

/-- The timer fires: that app is waiting for nothing. -/
def fired (t : Timers) (app : Nat) : Timers := fun a => if a = app then none else t a

/-- What the watcher holds after a burst of events for one app has arrived. -/
def burst (t : Timers) (app : Nat) : List Millis → Timers
  | [] => t
  | e :: es => burst (armed t app e) app es

/-- Re-arming is what makes a burst one reload: whatever events arrived, the timer
carries the last of them, so the import sees the file as the last write left it
rather than as an earlier event found it. -/
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

/-- An edit to one app touches no other app's timer: each app's reload is decided
by its own files, so a save in one cannot reload its neighbour. -/
theorem a_burst_leaves_other_apps_alone (t : Timers) (app other : Nat) (es : List Millis)
    (ne : other ≠ app) : (burst t app es) other = t other := by
  induction es generalizing t with
  | nil => rfl
  | cons e rest ih => simpa [burst, armed, ne] using ih (armed t app e)

/-- Firing leaves that app with nothing armed, so the next event starts a new burst
instead of joining the one that just reloaded. -/
theorem a_burst_fires_once (t : Timers) (app : Nat) (es : List Millis) :
    (fired (burst t app es) app) app = none := by
  simp [fired]

end EffectServer
