/-
  What a parent's state is — `apps/board/src/tasks/rollup.ts`.

  A non-leaf's state is derived from the leaves below it and never stored, and the
  file's header says what that buys: a parent that kept its own copy could
  contradict its children, reading `done` while a child is still running. Every
  rule below is silent when it is read the other way — the board simply shows a
  finished parent over unfinished work.

  **`done` means nothing below is left to run** —
  `a_node_reads_done_only_when_nothing_below_it_is_left_to_run`, and the reading
  that matters, `a_parent_never_reads_done_over_a_leaf_that_is_still_going`. Read
  the first rule as "some leaf is done" and the parent finishes over a child that
  is still going: `reading_the_first_rule_as_any_finishes_a_parent_over_a_running_leaf`.

  **A stuck leaf is not hidden by progress elsewhere** —
  `a_blocked_leaf_reaches_the_parent`, whatever else is below. Check progress
  first instead and it disappears behind a running sibling:
  `checking_progress_before_the_block_hides_a_stuck_leaf`.

  **A node with children has no state of its own** —
  `a_parent_reports_what_is_below_it_not_what_it_stored`, which is why two nodes
  over the same leaves cannot disagree (`nodes_over_the_same_leaves_agree`),
  against `keeping_a_parent_copy_lets_it_contradict_its_children`. The kind is
  derived the same way: `a_node_with_nothing_below_it_is_a_leaf`.

  Idealisation: what sits below a node is the list of its leaves, which is what
  the file's `visit` collects by flattening its children's leaves. The rules of
  `derive` are written in the file's order, so the precedence is the thing proved
  about rather than a tidied version of it.
-/

namespace Board

/-- The five states a task can be in. -/
inductive TaskState where
  | todo
  | doing
  | blocked
  | done
  | cancelled
deriving DecidableEq, Repr

/-- `terminal`: finished, one way or the other. -/
def terminal (s : TaskState) : Bool :=
  match s with
  | .done => true
  | .cancelled => true
  | _ => false

/-- The file's `derive`, rule for rule in the order it writes them. -/
def derive (running : Bool) (leaves : List TaskState) : TaskState :=
  if leaves.all (fun leaf => leaf = TaskState.done) then TaskState.done
  else if leaves.all (fun leaf => leaf = TaskState.cancelled) then TaskState.cancelled
  else if leaves.all terminal then TaskState.done
  else if leaves.any (fun leaf => leaf = TaskState.blocked) then TaskState.blocked
  else if running || leaves.any (fun leaf => leaf = TaskState.doing) then TaskState.doing
  else TaskState.todo

/-- One leaf that is not `done` means not every leaf is. -/
theorem not_all_of_a_leaf_that_is_not (leaves : List TaskState) (leaf : TaskState)
    (below : leaf ∈ leaves) (p : TaskState → Bool) (no : p leaf = false) :
    leaves.all p = false := by
  cases held : leaves.all p with
  | false => rfl
  | true =>
    have got : p leaf = true := (List.all_eq_true.mp held) leaf below
    rw [no] at got
    exact Bool.noConfusion got

/-- The first rule is the only one that says `done` on its own terms; the third
says it too, but only over leaves that have finished or been abandoned. -/
theorem derive_is_done_only_over_finished_or_abandoned_leaves (running : Bool) (leaves : List TaskState) :
    derive running leaves = TaskState.done ↔
      ((∀ leaf ∈ leaves, leaf = TaskState.done) ∨
       ((∃ leaf, leaf ∈ leaves ∧ leaf ≠ TaskState.cancelled) ∧
        ∀ leaf ∈ leaves, terminal leaf = true)) := by
  constructor
  · intro derived
    by_cases first : leaves.all (fun leaf => leaf = TaskState.done) = true
    · exact Or.inl fun leaf below => of_decide_eq_true ((List.all_eq_true.mp first) leaf below)
    · by_cases second : leaves.all (fun leaf => leaf = TaskState.cancelled) = true
      · exfalso
        have cancelled : derive running leaves = TaskState.cancelled := by simp [derive, first, second]
        rw [cancelled] at derived
        exact TaskState.noConfusion derived
      · by_cases third : leaves.all terminal = true
        · refine Or.inr ⟨?_, fun leaf below => (List.all_eq_true.mp third) leaf below⟩
          have no : leaves.all (fun leaf => leaf = TaskState.cancelled) = false := by
            cases held : leaves.all (fun leaf => leaf = TaskState.cancelled) with
            | false => rfl
            | true => exact absurd held second
          obtain ⟨leaf, below, notSame⟩ := List.all_eq_false.mp no
          exact ⟨leaf, below, fun same => notSame (by simp [same])⟩
        · exfalso
          have nope : derive running leaves ≠ TaskState.done := by
            unfold derive
            rw [if_neg first, if_neg second, if_neg third]
            split
            · simp
            · split <;> simp
          exact nope derived
  · intro claim
    by_cases first : leaves.all (fun leaf => leaf = TaskState.done) = true
    · simp [derive, first]
    · rcases claim with allDone | ⟨someone, allTerminal⟩
      · have flagged : leaves.all (fun leaf => leaf = TaskState.done) = true :=
          List.all_eq_true.mpr fun leaf below => by simp [allDone leaf below]
        exact absurd flagged first
      · obtain ⟨leaf, below, notCancelled⟩ := someone
        have no : leaves.all (fun leaf => leaf = TaskState.cancelled) = false := by
          cases held : leaves.all (fun leaf => leaf = TaskState.cancelled) with
          | false => rfl
          | true =>
            exact absurd (of_decide_eq_true ((List.all_eq_true.mp held) leaf below)) notCancelled
        have every : leaves.all terminal = true :=
          List.all_eq_true.mpr fun leaf below => allTerminal leaf below
        simp [derive, first, no, every]

/-- The first rule read as "some leaf is done" instead of "every leaf is done" —
the control for the reading above. -/
def deriveAnyFirst (running : Bool) (leaves : List TaskState) : TaskState :=
  if leaves.any (fun leaf => leaf = TaskState.done) then TaskState.done
  else derive running leaves

/-- The control: with the first rule read as "some", a parent finishes over a child
that is still going — a `done` row over work in progress, and nothing on screen
says so. Read as the file reads it, the same subtree is `doing`. -/
theorem reading_the_first_rule_as_any_finishes_a_parent_over_a_running_leaf :
    deriveAnyFirst false [TaskState.done, TaskState.doing] = TaskState.done ∧
    derive false [TaskState.done, TaskState.doing] = TaskState.doing := by
  decide

/-- `done` on a parent says nothing about a leaf other than that the leaf is not
still going: `done` over a subtree that ran and one that was abandoned is `done`. -/
theorem a_node_reads_done_only_when_nothing_below_it_is_left_to_run (running : Bool)
    (leaves : List TaskState) (derived : derive running leaves = TaskState.done) :
    ∀ leaf ∈ leaves, leaf = TaskState.done ∨ leaf = TaskState.cancelled := by
  rcases (derive_is_done_only_over_finished_or_abandoned_leaves running leaves).mp derived with
    allDone | ⟨_, allTerminal⟩
  · exact fun leaf below => Or.inl (allDone leaf below)
  · intro leaf below
    have finished : terminal leaf = true := allTerminal leaf below
    cases leaf <;> simp_all [terminal]

/-- And the reading that matters, as its own claim: a leaf still going keeps its
parent from reading `done`, however far along its siblings are. -/
theorem a_parent_never_reads_done_over_a_leaf_that_is_still_going (running : Bool)
    (leaves : List TaskState) (leaf : TaskState) (below : leaf ∈ leaves) (going : leaf = TaskState.doing) :
    derive running leaves ≠ TaskState.done := by
  intro derived
  subst going
  rcases a_node_reads_done_only_when_nothing_below_it_is_left_to_run running leaves derived
    TaskState.doing below with same | same <;> exact TaskState.noConfusion same

/-- A blocked leaf reaches its parent whatever else is below it, so a branch that
needs a human is not covered over by progress on its siblings. -/
theorem a_blocked_leaf_reaches_the_parent (running : Bool) (leaves : List TaskState)
    (leaf : TaskState) (below : leaf ∈ leaves) (stuck : leaf = TaskState.blocked) :
    derive running leaves = TaskState.blocked := by
  have notFinished := not_all_of_a_leaf_that_is_not leaves leaf below
    (fun l => l = TaskState.done) (by simp [stuck])
  have notAbandoned := not_all_of_a_leaf_that_is_not leaves leaf below
    (fun l => l = TaskState.cancelled) (by simp [stuck])
  have notTerminal := not_all_of_a_leaf_that_is_not leaves leaf below terminal (by simp [terminal, stuck])
  have somewhere : leaves.any (fun l => l = TaskState.blocked) = true :=
    List.any_eq_true.mpr ⟨leaf, below, by simp [stuck]⟩
  simp [derive, notFinished, notAbandoned, notTerminal, somewhere]

/-- The rules with progress checked before the block — the control for the rule
above, and the order a reader who thinks "running beats stuck" would write. -/
def progressFirst (running : Bool) (leaves : List TaskState) : TaskState :=
  if running || leaves.any (fun leaf => leaf = TaskState.doing) then TaskState.doing
  else derive running leaves

/-- The control: a blocked leaf with a running sibling disappears behind it, so the
branch that needs a human reads as ordinary progress. -/
theorem checking_progress_before_the_block_hides_a_stuck_leaf :
    progressFirst false [TaskState.blocked, TaskState.doing] = TaskState.doing ∧
    derive false [TaskState.blocked, TaskState.doing] = TaskState.blocked := by
  decide

/-- What a node reports: its own state only when nothing sits below it. -/
def reported (stored : TaskState) (running : Bool) (leaves : List TaskState) : TaskState :=
  match leaves with
  | [] => stored
  | _ => derive running leaves

/-- A node with nothing below it is a leaf, and reports what it holds. -/
theorem a_node_with_nothing_below_it_reports_its_own_state (stored : TaskState) (running : Bool) :
    reported stored running [] = stored := rfl

/-- A node with something below it reports that, not what it holds — there is no
second fact that could disagree with the leaves. -/
theorem a_parent_reports_what_is_below_it_not_what_it_stored (stored : TaskState) (running : Bool)
    (leaves : List TaskState) (below : leaves ≠ []) : reported stored running leaves = derive running leaves := by
  cases leaves with
  | nil => exact absurd rfl below
  | cons leaf rest => rfl

/-- And so two nodes over the same leaves cannot disagree, which is what "never
stored" is for. -/
theorem nodes_over_the_same_leaves_agree (held held' : TaskState) (running : Bool)
    (leaves : List TaskState) (below : leaves ≠ []) :
    reported held running leaves = reported held' running leaves := by
  rw [a_parent_reports_what_is_below_it_not_what_it_stored held running leaves below,
    a_parent_reports_what_is_below_it_not_what_it_stored held' running leaves below]

/-- A node that reported the state it stored — the control for "never stored". -/
def reportedStored (stored : TaskState) : TaskState := stored

/-- The control: a stored copy lets one node read `done` while the leaf below it is
still going, and two nodes over the same leaves read differently. The file's rule
has no second fact to disagree with the leaves. -/
theorem keeping_a_parent_copy_lets_it_contradict_its_children :
    reportedStored TaskState.done = TaskState.done ∧
    reported TaskState.done false [TaskState.doing] = TaskState.doing ∧
    reportedStored TaskState.done ≠ reportedStored TaskState.todo := by
  decide

/-- `kind`, derived from the children a node has rather than stored beside them. -/
inductive NodeKind where
  | goal
  | group
  | leaf
deriving DecidableEq, Repr

/-- The file's kind: no children is a leaf; children, and no parent above, is a
goal; children under a parent is a group. -/
def kindOf (parent : Option String) (children : Nat) : NodeKind :=
  match children, parent with
  | 0, _ => NodeKind.leaf
  | _, none => NodeKind.goal
  | _, some _ => NodeKind.group

/-- A node with nothing below it is a leaf. -/
theorem a_node_with_nothing_below_it_is_a_leaf (parent : Option String) :
    kindOf parent 0 = NodeKind.leaf := rfl

/-- And the other direction: a leaf has nothing below it, so the kind cannot say
`leaf` over children. -/
theorem a_leaf_has_nothing_below_it (parent : Option String) (children : Nat)
    (kind : kindOf parent children = NodeKind.leaf) : children = 0 := by
  cases children with
  | zero => rfl
  | succ below => cases parent <;> simp [kindOf] at kind

end Board
