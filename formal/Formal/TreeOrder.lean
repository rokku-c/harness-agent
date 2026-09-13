/-
  The tasks in tree order — `apps/board/src/tasks/tree-order.ts`.

  Two tasks may point at each other, and a task may name a parent that no longer
  exists. Neither may hide a row, and no row may appear twice. Both are silent
  when they go wrong: the board simply has one row fewer, or one row too many.

  **A cycle is reached by the second walk, not the first** —
  `a_cycle_member_is_below_no_root`: following the parent links up from a member
  of a two-task cycle never arrives at the root, so the walk down from the roots
  never pushes it. With that walk alone the members sit in the table and in no
  row: `the_walk_from_the_roots_alone_misses_a_cycle`. The file's second walk
  hands over every task, and `everything_handed_over_is_listed` is what makes
  that enough — so no task can be hidden, whatever its parent says.

  **Nothing is listed twice** — `the_listing_never_repeats`, against
  `an_unguarded_walk_lists_what_it_is_handed`, since a guard that never fired
  would not be one. Without it the walk appends every id it is handed, and since
  the second walk hands over every task, every task is listed twice:
  `dropping_the_guard_lists_every_task_twice`.

  Idealisation: the walk is modelled as its bookkeeping over the sequence of ids
  it hands itself — the recursion, the set it checks and the listing it appends
  to, without the depths and the order those come out in. The first walk's
  sequence is the tasks sitting below a root, which is what `below` describes and
  what the file's recursion down from the roots computes. The parent
  normalisation is not modelled, and does not need to be for what is proved here:
  an orphan is walked by the second sequence as a root either way, so the
  normalisation moves where its row sits, not whether it is there.
-/

namespace Board

/-- The parent a task names, when that parent is a task of the table. -/
abbrev Link := String → Option String

/-- `task` sits below `root`: the parent chain from `task` reaches `root` within
`depth` steps. The chain is a chain and not a search, which is the whole of why a
cycle is below nothing. -/
def below (link : Link) : Nat → String → String → Bool
  | 0, _, _ => false
  | depth + 1, root, task =>
    match link task with
    | some parent => if parent = root then true else below link depth root parent
    | none => false

/-- The walk's bookkeeping: it is handed ids one at a time, and appends the ones
it has not listed yet. The file keeps a `seen` set beside the listing; the two
hold the same ids by construction, so the model carries one list and the guard
asks whether the id is already in it. -/
def guarded (handed listing : List String) : List String :=
  match handed with
  | [] => listing
  | id :: rest => if id ∈ listing then guarded rest listing else guarded rest (listing ++ [id])

/-- The listing only grows: whatever the walk is handed, it never drops what it
had. This is what lets the walk down from the roots stand while the second one
runs over every task. -/
theorem the_listing_only_grows (handed listing : List String) :
    ∀ id ∈ listing, id ∈ guarded handed listing := by
  induction handed generalizing listing with
  | nil => exact fun _ held => held
  | cons id rest ih =>
    by_cases new : id ∈ listing
    · simp only [guarded, if_pos new]
      exact ih listing
    · simp only [guarded, if_neg new]
      intro x held
      exact ih (listing ++ [id]) x (List.mem_append_left [id] held)

/-- Every id handed over ends up in the listing. The file's second walk hands over
every task, so this is why a task cannot be missing from the board — including the
members of a cycle, which the walk down from the roots never reaches. -/
theorem everything_handed_over_is_listed (handed listing : List String) :
    ∀ id ∈ handed, id ∈ guarded handed listing := by
  induction handed generalizing listing with
  | nil => simp [guarded]
  | cons id rest ih =>
    by_cases new : id ∈ listing
    · simp only [guarded, if_pos new]
      intro x given
      rcases List.mem_cons.mp given with same | inRest
      · exact same ▸ the_listing_only_grows rest listing id new
      · exact ih listing x inRest
    · simp only [guarded, if_neg new]
      intro x given
      rcases List.mem_cons.mp given with same | inRest
      · exact same ▸ the_listing_only_grows rest (listing ++ [id]) id (by simp)
      · exact ih (listing ++ [id]) x inRest

/-- And nothing is listed twice, however often it is handed over. -/
theorem the_listing_never_repeats (handed listing : List String) (nodup : listing.Nodup) :
    (guarded handed listing).Nodup := by
  induction handed generalizing listing with
  | nil => simpa [guarded] using nodup
  | cons id rest ih =>
    by_cases new : id ∈ listing
    · simp only [guarded, if_pos new]
      exact ih listing nodup
    · have fresh : (listing ++ [id]).Nodup := by
        rw [List.nodup_append]
        refine ⟨nodup, by simp, ?_⟩
        rintro x held y once
        rw [List.mem_singleton] at once
        subst once
        intro same
        exact new (same ▸ held)
      simp only [guarded, if_neg new]
      exact ih (listing ++ [id]) fresh

/-- The same walk with the guard taken out — what the second walk would do to a
listing the first walk had already filled, and the control below. -/
def unguarded (handed listing : List String) : List String :=
  match handed with
  | [] => listing
  | id :: rest => unguarded rest (listing ++ [id])

/-- Read without the guard, the walk appends every id it is handed. -/
theorem an_unguarded_walk_lists_what_it_is_handed (handed listing : List String) :
    unguarded handed listing = listing ++ handed := by
  induction handed generalizing listing with
  | nil => simp [unguarded]
  | cons id rest ih => simp [unguarded, ih, List.append_assoc]

/-- Two tasks pointing at each other, and the root they hang off nowhere. -/
def cycleLink : Link
  | "a" => some "b"
  | "b" => some "a"
  | _ => none

/-- The reachability the control rests on: neither member of the cycle sits below
the root, at any depth, because the chain from either one is the cycle. -/
theorem a_cycle_member_is_below_no_root (depth : Nat) :
    below cycleLink depth "r" "a" = false ∧ below cycleLink depth "r" "b" = false := by
  induction depth with
  | zero => simp [below]
  | succ k ih =>
    rcases ih with ⟨fromA, fromB⟩
    simp [below, cycleLink, fromA, fromB]

/-- The control. `a` and `b` point at each other and at nothing the root reaches,
so the walk down from the roots hands over the root and stops: with the second
walk removed the whole cycle is invisible — two tasks in the table and in no row.
The second walk hands them over, and they are listed. -/
theorem the_walk_from_the_roots_alone_misses_a_cycle :
    guarded ["r"] [] = ["r"] ∧
    guarded (["r"] ++ ["a", "b"]) [] = ["r", "a", "b"] ∧
    ("a" ∈ guarded ["r"] [] → False) := by
  decide

/-- The control for the other rule. The second walk hands over `r` and `a`, which
the first walk has already handed over; with the guard removed both are listed a
second time, so the board shows two rows for one task. -/
theorem dropping_the_guard_lists_every_task_twice :
    guarded (["r", "a"] ++ ["r", "a"]) [] = ["r", "a"] ∧
    unguarded (["r", "a"] ++ ["r", "a"]) [] = ["r", "a", "r", "a"] := by
  decide

end Board
