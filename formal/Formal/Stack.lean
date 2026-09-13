/-
  The session's own stack — `apps/effect-server/src/client/console-stack.ts`.

  `Screen.lean` and `Chain.lean` prove the chain a *view* declares: which screens
  are below the one on top, for a link that arrived cold. What they say nothing
  about is whether there is a history under it at all, and Back has to be two
  different things because of it:

  * a screen this session walked to has the screen it came from behind it in the
    browser's history, and `history.back()` is the same stack the browser pops;
  * a screen pasted into the address bar has nothing behind it, and leaving the
    product is what `history.back()` does there.

  So the implementation keeps the one fact the address bar cannot answer — did
  this session push the entry below the top, or did the reader arrive at this
  address directly — and this file proves the readings it takes off it agree with
  the browser's own stack:

  * `backTarget_push` — what the browser's back button lands on after a push is
    the destination that was on top before it, so up one level is the level the
    reader came from;
  * `reconcile_own` — the change this module made itself is not an observation,
    so it cannot be mistaken for a move the reader made;
  * `reconcile_back` — a back button pressed once pops exactly one entry, and
    everything under that entry is still behind it;
  * `reconcile_jump` — a typed or pasted address is a jump the stack knows
    nothing about, so it becomes the whole stack and `canGoBack` is false, which
    is what leaves Back meaning "up to the screen's parent";
  * `canGoBack_iff_backTarget` — "there is something behind this" and "the back
    button lands somewhere" are one question, read two ways, so the control the
    host draws and the key the browser handles cannot disagree.

  The state is the entries oldest-first, exactly as the module keeps them; the
  two readings are taken off the reversed view, which is what the browser's own
  history list is, and why `current` and `backTarget` are head-of-tail apart.
-/

namespace EffectUi

/-- What the stack holds: one hash per history entry, oldest first. -/
abbrev Stack := List String

/-- Where the reader is. -/
def current (e : Stack) : Option String := e.reverse.head?

/-- The entry one below the top: what the browser's back button lands on. -/
def backTarget (e : Stack) : Option String := e.reverse.tail.head?

/-- Whether this session walked here, i.e. whether anything is behind this entry. -/
def canGoBack (e : Stack) : Bool := decide (2 ≤ e.length)

/-- A destination this session entered. -/
def push (e : Stack) (hash : String) : Stack := e ++ [hash]

/-- One step back through the history this session walked. -/
def pop (e : Stack) : Stack := e.dropLast

/-- A hash change: either the one `push` just made, or the browser's — a back
button, a forward button, or an address the reader typed. -/
def reconcile (e : Stack) (hash : String) : Stack :=
  if current e = some hash then e
  else if backTarget e = some hash then pop e
  else [hash]

/-! ### The two readings, and a push -/

theorem current_push (e : Stack) (h : String) : current (push e h) = some h := by
  simp [current, push, List.reverse_append]

/-- What the back button lands on after a push is what was on top before it. -/
theorem backTarget_push (e : Stack) (h : String) : backTarget (push e h) = current e := by
  simp [backTarget, current, push, List.reverse_append]

theorem canGoBack_push {e : Stack} {h : String} (hne : e ≠ []) : canGoBack (push e h) = true := by
  cases e with
  | nil => exact absurd rfl hne
  | cons x t => simp [canGoBack, push]

/-- A push leaves something behind it. -/
theorem canGoBack_of_push {e : Stack} {h : String} (hne : e ≠ []) :
    canGoBack (push e h) = true := canGoBack_push hne

/-! ### Arriving at an address directly -/

theorem current_nil : current ([] : Stack) = none := by simp [current]
theorem backTarget_nil : backTarget ([] : Stack) = none := by simp [backTarget]
theorem backTarget_singleton (y : String) : backTarget [y] = none := by simp [backTarget]

/-- The stack the module starts from is the address itself, so a pasted link is
the whole of what is behind the reader — which is the entry they are on. -/
theorem reconcile_arrival (h : String) : reconcile ([] : Stack) h = [h] := by
  simp [reconcile, current_nil, backTarget_nil]

theorem canGoBack_arrival (h : String) : canGoBack (reconcile [] h) = false := by
  rw [reconcile_arrival]
  simp [canGoBack]

/-- "There is something behind this" and "the back button lands somewhere" are
one question: the control the host draws and the key the browser handles cannot
disagree. -/
theorem canGoBack_iff_backTarget {e : Stack} : canGoBack e = true ↔ (backTarget e).isSome := by
  cases e with
  | nil => simp [canGoBack, backTarget]
  | cons x t =>
    cases t with
    | nil => simp [canGoBack, backTarget]
    | cons y t => simp [canGoBack, backTarget, List.reverse_cons]

/-! ### What the browser's own moves do to the stack -/

/-- The push this module made is not an observation: the address changed under a
reader who did not move, and the stack stays what the push left. -/
theorem reconcile_own {e : Stack} {h : String} (hc : current e = some h) : reconcile e h = e := by
  simp [reconcile, hc]

/-- A back button pressed once pops exactly one entry, and lands on the entry
that was below it — so every ancestor's parameters are still behind the reader. -/
theorem reconcile_back {e : Stack} {a h : String} (hc : current e = some a) (hne : h ≠ a) :
    reconcile (push e h) a = e := by
  have hcur : current (push e h) ≠ some a := by
    rw [current_push]
    simp [hne]
  have hback : backTarget (push e h) = some a := by rw [backTarget_push, hc]
  simp only [reconcile]
  rw [if_neg hcur, if_pos hback]
  exact List.dropLast_concat

/-- An address the reader typed or pasted is a jump the stack knows nothing
about: it becomes the whole stack, which is what makes `canGoBack` false for it
and leaves Back meaning "up to the screen's parent". -/
theorem reconcile_jump {e : Stack} {x : String}
    (hc : current e ≠ some x) (hb : backTarget e ≠ some x) : reconcile e x = [x] := by
  simp [reconcile, hc, hb]

/-- A jump leaves nothing behind it, whatever the stack held before. -/
theorem reconcile_jump_canGoBack {e : Stack} {x : String}
    (hc : current e ≠ some x) (hb : backTarget e ≠ some x) : canGoBack (reconcile e x) = false := by
  rw [reconcile_jump hc hb]
  simp [canGoBack]

/-- A list of two or more has an entry below its top, so popping one leaves a
stack that is still not empty. -/
theorem dropLast_ne_nil {a b : String} {t : Stack} : (a :: b :: t).dropLast ≠ [] := by
  cases t <;> simp [List.dropLast]

/-- The stack is never empty after an observation, so the reading the host takes
off it is always of an entry that exists. -/
theorem reconcile_nonempty (e : Stack) (x : String) : reconcile e x ≠ [] := by
  match e with
  | [] => rw [reconcile_arrival]; simp
  | [y] =>
    by_cases h : y = x
    · subst h; simp [reconcile, current]
    · simp [reconcile, current, backTarget_singleton, h]
  | y :: z :: t =>
    simp only [reconcile]
    by_cases hc : current (y :: z :: t) = some x
    · rw [if_pos hc]; simp
    · rw [if_neg hc]
      by_cases hb : backTarget (y :: z :: t) = some x
      · rw [if_pos hb]; exact dropLast_ne_nil
      · rw [if_neg hb]; simp

end EffectUi
