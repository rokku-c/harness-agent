namespace EffectServer

abbrev Host := Option Nat

inductive Step where
  | register
  | adjudicate
  | dispose
  | restore
deriving DecidableEq, Repr

def next (serving : Nat) (incoming : Nat) : Host → Step → Host
  | _, Step.register => some incoming
  | s, Step.adjudicate => s
  | _, Step.dispose => none
  | _, Step.restore => some serving

def giveUp (serving : Nat) (incoming : Nat) (s : Host) : Host :=
  next serving incoming (next serving incoming s Step.dispose) Step.restore

def refusedBeforeRegistering (serving : Nat) : Host := some serving

def refusedAtRegister (serving : Nat) (incoming : Nat) : Host :=
  giveUp serving incoming (some serving)

def refusedAtAdjudication (serving : Nat) (incoming : Nat) : Host :=
  giveUp serving incoming (next serving incoming (some serving) Step.register)

def committed (serving : Nat) (incoming : Nat) : Host :=
  next serving incoming (next serving incoming (some serving) Step.register) Step.adjudicate

theorem refused_before_registering_moves_nothing (serving : Nat) :
    refusedBeforeRegistering serving = (some serving : Host) := rfl

theorem every_refusal_leaves_the_serving_generation_serving (serving : Nat) (incoming : Nat) :
    refusedBeforeRegistering serving = some serving ∧
    refusedAtRegister serving incoming = some serving ∧
    refusedAtAdjudication serving incoming = some serving ∧
    committed serving incoming = some incoming := by
  refine ⟨rfl, ?_, ?_, ?_⟩ <;>
    simp [refusedAtRegister, refusedAtAdjudication, committed, giveUp, next]

theorem a_refusal_that_forgets_the_restore_leaves_the_app_down (serving : Nat) (incoming : Nat) :
    (some serving : Host) ≠ none ∧
    next serving incoming (next serving incoming (some serving) Step.register) Step.dispose = none := by
  refine ⟨?_, ?_⟩
  · simp
  · simp [next]

end EffectServer
