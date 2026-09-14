namespace EffectServer

def issue (issued : Nat) : Nat × Nat := (issued + 1, issued + 1)

def run (start : Nat) : Nat → List Nat
  | 0 => []
  | k + 1 => (issue start).1 :: run (issue start).2 k

theorem every_number_is_past_the_start (k s : Nat) : ∀ x ∈ run s k, s < x := by
  induction k generalizing s with
  | zero => intro x hx; simp [run] at hx
  | succ k ih =>
    intro x hx
    simp only [run, issue, List.mem_cons] at hx
    rcases hx with rfl | hx
    · exact Nat.lt_succ_self s
    · exact Nat.lt_trans (Nat.lt_succ_self s) (ih (s + 1) x hx)

theorem handing_out_a_number_never_hands_out_a_used_number (k s : Nat) :
    (run s k).Pairwise (· < ·) := by
  induction k generalizing s with
  | zero => exact List.Pairwise.nil
  | succ k ih =>
    show ((s + 1) :: run (s + 1) k).Pairwise (· < ·)
    exact List.Pairwise.cons (every_number_is_past_the_start k (s + 1)) (ih (s + 1))

structure Store where
  issued : Nat
  serving : Nat
  copies : List Nat
deriving DecidableEq, Repr

def commit (g : Nat) (s : Store) : Store :=
  { s with serving := g, copies := if s.serving = 0 then [g] else [g, s.serving] }

theorem commit_keeps_the_serving_generation_and_one_rollback (g : Nat) (s : Store) :
    (commit g s).serving = g ∧
    (s.serving ≠ 0 → s.serving ∈ (commit g s).copies) ∧
    (∀ c ∈ (commit g s).copies, c = g ∨ c = s.serving) ∧
    (commit g s).copies.length ≤ 2 := by
  rcases s with ⟨issued, serving, copies⟩
  by_cases h : serving = 0 <;> simp [commit, h]

def commitKeepingOnlyTheNew (g : Nat) (s : Store) : Store := { s with serving := g, copies := [g] }

theorem discarding_the_displaced_copy_loses_the_rollback_target (g d : Nat) (fresh : g ≠ d) :
    d ∈ ({ issued := 4, serving := d, copies := [d] } : Store).copies ∧
    d ∉ (commitKeepingOnlyTheNew g { issued := 4, serving := d, copies := [d] }).copies := by
  refine ⟨by simp, ?_⟩
  intro h
  simp [commitKeepingOnlyTheNew] at h
  exact fresh h.symm

end EffectServer
