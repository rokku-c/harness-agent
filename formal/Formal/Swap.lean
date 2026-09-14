namespace EffectBundle

structure Slots where
  serving : Option String
  loaded : List String
deriving DecidableEq, Repr

def running (a : String) : Slots := { serving := some a, loaded := [a] }

inductive Step where
  | stage
  | flip
  | commit
  | stopOld
deriving DecidableEq, Repr

def next (a b : String) : Slots → Step → Slots
  | s, Step.stage => { s with loaded := b :: s.loaded }
  | s, Step.flip => { s with serving := some b }
  | s, Step.commit => s
  | s, Step.stopOld => { s with loaded := s.loaded.erase a }

def servesALoaded (s : Slots) : Bool :=
  match s.serving with
  | none => true
  | some k => s.loaded.contains k

def afterStage (a b : String) : Slots := next a b (running a) Step.stage
def afterFlip (a b : String) : Slots := next a b (afterStage a b) Step.flip
def afterCommit (a b : String) : Slots := next a b (afterFlip a b) Step.commit
def afterStop (a b : String) : Slots := next a b (afterCommit a b) Step.stopOld

theorem the_declared_order_never_points_at_a_stopped_kernel (a b : String) (h : a ≠ b) :
    servesALoaded (running a) = true ∧
    servesALoaded (afterStage a b) = true ∧
    servesALoaded (afterFlip a b) = true ∧
    servesALoaded (afterCommit a b) = true ∧
    servesALoaded (afterStop a b) = true := by
  refine ⟨?_, ?_, ?_, ?_, ?_⟩ <;>
    simp [servesALoaded, running, afterStage, afterFlip, afterCommit, afterStop, next,
      beq_iff_eq, h, Ne.symm h]

theorem unloading_first_points_the_dispatcher_at_nothing (a b : String) :
    (next a b (running a) Step.stopOld).serving = some a ∧
    (next a b (running a) Step.stopOld).loaded = [] := by
  simp [next, running]

end EffectBundle
