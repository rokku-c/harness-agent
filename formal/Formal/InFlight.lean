namespace EffectHost

abbrev Counts := Nat → Nat

def empty : Counts := fun _ => 0

def acquire (c : Counts) (t : Nat) : Counts := fun u => if u = t then c u + 1 else c u

def release (c : Counts) (t : Nat) : Counts := fun u => if u = t then c u - 1 else c u

def drained (c : Counts) (t : Nat) : Prop := c t = 0

theorem acquire_other (c : Counts) {u t : Nat} (h : u ≠ t) : acquire c t u = c u := by
  simp [acquire, h]

theorem acquire_same (c : Counts) (t : Nat) : acquire c t t = c t + 1 := by
  simp [acquire]

theorem release_other (c : Counts) {u t : Nat} (h : u ≠ t) : release c t u = c u := by
  simp [release, h]

theorem release_same (c : Counts) (t : Nat) : release c t t = c t - 1 := by
  simp [release]

theorem acquire_then_release_restores_the_count (c : Counts) (t : Nat) :
    release (acquire c t) t = c := by
  funext u
  by_cases h : u = t <;> simp [release, acquire, h]

theorem an_acquire_keeps_its_target_from_draining (c : Counts) (t : Nat) :
    ¬ drained (acquire c t) t := by
  simp [drained, acquire]

def flipThenReleaseCaptured (c : Counts) (a b : Nat) : Counts :=
  release (acquire (acquire c a) b) a

def flipThenReleaseCurrent (c : Counts) (a b : Nat) : Counts :=
  release (acquire (acquire c a) b) b

theorem releasing_the_current_target_lets_a_busy_target_read_as_drained
    (a b : Nat) (fresh : a ≠ b) :
    drained (flipThenReleaseCurrent empty a b) b ∧
    (flipThenReleaseCaptured empty a b) b = 1 := by
  have other : b ≠ a := Ne.symm fresh
  refine ⟨?_, ?_⟩
  · show release (acquire (acquire empty a) b) b b = 0
    rw [release_same, acquire_same, acquire_other _ other]
    simp [empty]
  · show release (acquire (acquire empty a) b) a b = 1
    rw [release_other _ other, acquire_same, acquire_other _ other]
    simp [empty]

theorem releasing_the_current_target_leaves_the_captured_one_never_draining
    (a b : Nat) (fresh : a ≠ b) :
    ¬ drained (flipThenReleaseCurrent empty a b) a ∧
    drained (flipThenReleaseCaptured empty a b) a := by
  have other : b ≠ a := Ne.symm fresh
  refine ⟨?_, ?_⟩
  · show ¬ (release (acquire (acquire empty a) b) b a = 0)
    rw [release_other _ fresh, acquire_other _ fresh, acquire_same]
    simp [empty]
  · show release (acquire (acquire empty a) b) a a = 0
    rw [release_same, acquire_other _ fresh, acquire_same]
    simp [empty]

theorem the_wake_up_is_the_last_release (c : Counts) (t : Nat) (last : c t = 1) :
    (release c t) t = 0 := by
  rw [release_same, last]

theorem a_release_that_is_not_the_last_does_not_wake (c : Counts) (t : Nat) (busy : 2 ≤ c t) :
    (release c t) t ≠ 0 := by
  rw [release_same]
  omega

end EffectHost
