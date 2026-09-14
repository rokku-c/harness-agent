namespace EffectUi


abbrev ViewState := String → Option String

def carries : Option String → Bool
  | none => false
  | some _ => true

structure Node where
  guard : Option String
  bind : Option String
deriving DecidableEq, Repr

def readout (p : String) : Node := { guard := some p, bind := some p }

def shows (n : Node) (s : ViewState) : Bool :=
  match n.guard with
  | none => true
  | some p => carries (s p)

theorem readout_guard_is_bind (p : String) : (readout p).guard = (readout p).bind := rfl

theorem readout_shows_iff (p : String) (s : ViewState) :
    shows (readout p) s = true ↔ carries (s p) = true := by
  simp [shows, readout]

theorem readout_hidden_before_the_press (p : String) (s : ViewState) (h : s p = none) :
    shows (readout p) s = false := by
  simp [shows, readout, carries, h]


def unpaired (g b : String) : Node := { guard := some g, bind := some b }

theorem unpaired_hides_an_answer (g b : String) (v : String) (s : ViewState)
    (hg : s g = none) (hb : s b = some v) :
    carries (s b) = true ∧ shows (unpaired g b) s = false := by
  refine ⟨by simp [carries, hb], ?_⟩
  simp [shows, unpaired, carries, hg]


inductive Verdict where
  | loading
  | ready
  | empty
  | failed
deriving DecidableEq, Repr

def verdict (answered : Bool) (error : Option String) (count : Nat) : Verdict :=
  match error with
  | some _ => Verdict.failed
  | none => if answered then (if count = 0 then Verdict.empty else Verdict.ready) else Verdict.loading

theorem failure_outranks_everything (answered : Bool) (e : String) (count : Nat) :
    verdict answered (some e) count = Verdict.failed := rfl

theorem never_answered_reads_as_loading (count : Nat) :
    verdict false none count = Verdict.loading := rfl

theorem loading_is_before_the_first_answer (e : Option String) (count : Nat)
    (h : verdict false e count = Verdict.loading) : e = none := by
  cases e with
  | none => rfl
  | some s => simp [verdict] at h

theorem answered_never_reads_as_loading (e : Option String) (count : Nat) :
    verdict true e count ≠ Verdict.loading := by
  cases e with
  | some s => simp [verdict]
  | none => by_cases h : count = 0 <;> simp [verdict, h]

theorem a_failure_and_an_empty_list_do_not_read_alike (e : String) (count : Nat) :
    verdict true (some e) count ≠ verdict true none count := by
  by_cases h : count = 0 <;> simp [verdict, h]

theorem ready_carries_rows (answered : Bool) (e : Option String) (count : Nat)
    (h : verdict answered e count = Verdict.ready) : count ≠ 0 := by
  intro hc
  cases e with
  | some s => simp [verdict] at h
  | none => cases answered <;> simp [verdict, hc] at h

end EffectUi
