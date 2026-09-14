namespace EffectUi

abbrev Stack := List String

def current (e : Stack) : Option String := e.reverse.head?

def backTarget (e : Stack) : Option String := e.reverse.tail.head?

def canGoBack (e : Stack) : Bool := decide (2 ≤ e.length)

def push (e : Stack) (hash : String) : Stack := e ++ [hash]

def pop (e : Stack) : Stack := e.dropLast

def reconcile (e : Stack) (hash : String) : Stack :=
  if current e = some hash then e
  else if backTarget e = some hash then pop e
  else [hash]


theorem current_push (e : Stack) (h : String) : current (push e h) = some h := by
  simp [current, push, List.reverse_append]

theorem backTarget_push (e : Stack) (h : String) : backTarget (push e h) = current e := by
  simp [backTarget, current, push, List.reverse_append]

theorem canGoBack_push {e : Stack} {h : String} (hne : e ≠ []) : canGoBack (push e h) = true := by
  cases e with
  | nil => exact absurd rfl hne
  | cons x t => simp [canGoBack, push]

theorem canGoBack_of_push {e : Stack} {h : String} (hne : e ≠ []) :
    canGoBack (push e h) = true := canGoBack_push hne


theorem current_nil : current ([] : Stack) = none := by simp [current]
theorem backTarget_nil : backTarget ([] : Stack) = none := by simp [backTarget]
theorem backTarget_singleton (y : String) : backTarget [y] = none := by simp [backTarget]

theorem reconcile_arrival (h : String) : reconcile ([] : Stack) h = [h] := by
  simp [reconcile, current_nil, backTarget_nil]

theorem canGoBack_arrival (h : String) : canGoBack (reconcile [] h) = false := by
  rw [reconcile_arrival]
  simp [canGoBack]

theorem canGoBack_iff_backTarget {e : Stack} : canGoBack e = true ↔ (backTarget e).isSome := by
  cases e with
  | nil => simp [canGoBack, backTarget]
  | cons x t =>
    cases t with
    | nil => simp [canGoBack, backTarget]
    | cons y t => simp [canGoBack, backTarget, List.reverse_cons]


theorem reconcile_own {e : Stack} {h : String} (hc : current e = some h) : reconcile e h = e := by
  simp [reconcile, hc]

theorem reconcile_back {e : Stack} {a h : String} (hc : current e = some a) (hne : h ≠ a) :
    reconcile (push e h) a = e := by
  have hcur : current (push e h) ≠ some a := by
    rw [current_push]
    simp [hne]
  have hback : backTarget (push e h) = some a := by rw [backTarget_push, hc]
  simp only [reconcile]
  rw [if_neg hcur, if_pos hback]
  exact List.dropLast_concat

theorem reconcile_jump {e : Stack} {x : String}
    (hc : current e ≠ some x) (hb : backTarget e ≠ some x) : reconcile e x = [x] := by
  simp [reconcile, hc, hb]

theorem reconcile_jump_canGoBack {e : Stack} {x : String}
    (hc : current e ≠ some x) (hb : backTarget e ≠ some x) : canGoBack (reconcile e x) = false := by
  rw [reconcile_jump hc hb]
  simp [canGoBack]

theorem dropLast_ne_nil {a b : String} {t : Stack} : (a :: b :: t).dropLast ≠ [] := by
  cases t <;> simp [List.dropLast]

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
