/-
  Where a reloaded app's code lives — `apps/effect-server/src/manifest-loader/generation.ts`.

  A reload cannot re-import the app's own entry: Bun caches by resolved path, and
  a query string does not change that for the modules underneath, so an edited
  view keeps serving its old text while the reload reports success. So a
  generation is a *path*: the app's tree is copied to a fresh directory and
  imported from there. Two of that file's comments are safety claims nothing
  checked, and both fail silently.

  **A number is never handed out twice.** The counter is remembered rather than
  derived from what is on disk, because `commit` deletes copies: a number taken
  from the survivors would be one the run has spent, and a spent path is a cached
  module — the reload would hand back the code it already had and report success.
  `handing_out_a_number_never_hands_out_a_used_number` is the run of issues,
  strictly increasing, which is the same statement.

  **A commit leaves the serving copy and one rollback target.** Keeping only the
  new copy is the tempting cleanup and it is the one that breaks rollback:
  re-registering the displaced generation is a re-import from its recorded path,
  so a copy that has been deleted is a rollback that cannot run.
  `commit_keeps_the_serving_generation_and_one_rollback` is the invariant;
  `discarding_the_displaced_copy_loses_the_rollback_target` is the other version.

  Modelling note: what is modelled is the numbering and the copies a commit keeps,
  not the filesystem. That the copy preserves `import.meta.dir` layout and bare
  specifier sharing is the file's other subject and is not a claim a small model
  can carry — it is what the file's own acceptance run measured.
-/

namespace EffectServer

/-- One issue: hand out the next number, and remember that it is spent. The
remembering is the mechanism — a number derived from what survived a cleanup is
not the same number. -/
def issue (issued : Nat) : Nat × Nat := (issued + 1, issued + 1)

/-- The numbers a run of `k` issues hands out, from a counter that has already
issued `start`. Only the numbers count here; the counter is threaded through the
recursion, which is exactly what the implementation's `Map` does. -/
def run (start : Nat) : Nat → List Nat
  | 0 => []
  | k + 1 => (issue start).1 :: run (issue start).2 k

/-- Every number a run hands out is past the one it started from: nothing is
handed out that a previous life of this process had already spent. -/
theorem every_number_is_past_the_start (k s : Nat) : ∀ x ∈ run s k, s < x := by
  induction k generalizing s with
  | zero => intro x hx; simp [run] at hx
  | succ k ih =>
    intro x hx
    simp only [run, issue, List.mem_cons] at hx
    rcases hx with rfl | hx
    · exact Nat.lt_succ_self s
    · exact Nat.lt_trans (Nat.lt_succ_self s) (ih (s + 1) x hx)

/-- A run's numbers strictly increase, so no number is ever handed out twice. That
is the whole of "numbers are spent": a path that has been used is a path whose
module is cached, whatever happened to it. -/
theorem handing_out_a_number_never_hands_out_a_used_number (k s : Nat) :
    (run s k).Pairwise (· < ·) := by
  induction k generalizing s with
  | zero => exact List.Pairwise.nil
  | succ k ih =>
    show ((s + 1) :: run (s + 1) k).Pairwise (· < ·)
    exact List.Pairwise.cons (every_number_is_past_the_start k (s + 1)) (ih (s + 1))

/-- An app's generation state: the counter, which serves, and the copies under the
reload directory. Generation 0 is the app's own directory and is not a copy. -/
structure Store where
  issued : Nat
  serving : Nat
  copies : List Nat
deriving DecidableEq, Repr

/-- Commit: the new generation serves, the one it displaced is kept as the
rollback target, and every other copy — failed attempts included — is deleted. -/
def commit (g : Nat) (s : Store) : Store :=
  { s with serving := g, copies := if s.serving = 0 then [g] else [g, s.serving] }

/-- A commit leaves the serving generation, the one it displaced, and nothing
else: the new generation serves, the displaced one is still a copy so a rollback
can re-import it, every copy kept is one of those two, and there are at most two.
The second conjunct is the load-bearing one — it is what `commitKeepingOnlyTheNew`
below fails, and `discarding_the_displaced_copy_loses_the_rollback_target` is that
failure stated as the loss it is. -/
theorem commit_keeps_the_serving_generation_and_one_rollback (g : Nat) (s : Store) :
    (commit g s).serving = g ∧
    (s.serving ≠ 0 → s.serving ∈ (commit g s).copies) ∧
    (∀ c ∈ (commit g s).copies, c = g ∨ c = s.serving) ∧
    (commit g s).copies.length ≤ 2 := by
  rcases s with ⟨issued, serving, copies⟩
  by_cases h : serving = 0 <;> simp [commit, h]

/-- The tempting cleanup: keep only the copy that just committed. -/
def commitKeepingOnlyTheNew (g : Nat) (s : Store) : Store := { s with serving := g, copies := [g] }

/-- And what it costs. Re-registering the displaced generation is a re-import from
its recorded path, so a copy that is no longer there is a rollback that cannot
run — the one moment a reload that went badly needs it. -/
theorem discarding_the_displaced_copy_loses_the_rollback_target (g d : Nat) (fresh : g ≠ d) :
    d ∈ ({ issued := 4, serving := d, copies := [d] } : Store).copies ∧
    d ∉ (commitKeepingOnlyTheNew g { issued := 4, serving := d, copies := [d] }).copies := by
  refine ⟨by simp, ?_⟩
  intro h
  simp [commitKeepingOnlyTheNew] at h
  exact fresh h.symm

end EffectServer
