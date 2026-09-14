namespace Board

inductive TaskState where
  | todo
  | doing
  | blocked
  | done
  | cancelled
deriving DecidableEq, Repr

def terminal (s : TaskState) : Bool :=
  match s with
  | .done => true
  | .cancelled => true
  | _ => false

def derive (running : Bool) (leaves : List TaskState) : TaskState :=
  if leaves.all (fun leaf => leaf = TaskState.done) then TaskState.done
  else if leaves.all (fun leaf => leaf = TaskState.cancelled) then TaskState.cancelled
  else if leaves.all terminal then TaskState.done
  else if leaves.any (fun leaf => leaf = TaskState.blocked) then TaskState.blocked
  else if running || leaves.any (fun leaf => leaf = TaskState.doing) then TaskState.doing
  else TaskState.todo

theorem not_all_of_a_leaf_that_is_not (leaves : List TaskState) (leaf : TaskState)
    (below : leaf ∈ leaves) (p : TaskState → Bool) (no : p leaf = false) :
    leaves.all p = false := by
  cases held : leaves.all p with
  | false => rfl
  | true =>
    have got : p leaf = true := (List.all_eq_true.mp held) leaf below
    rw [no] at got
    exact Bool.noConfusion got

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

def deriveAnyFirst (running : Bool) (leaves : List TaskState) : TaskState :=
  if leaves.any (fun leaf => leaf = TaskState.done) then TaskState.done
  else derive running leaves

theorem reading_the_first_rule_as_any_finishes_a_parent_over_a_running_leaf :
    deriveAnyFirst false [TaskState.done, TaskState.doing] = TaskState.done ∧
    derive false [TaskState.done, TaskState.doing] = TaskState.doing := by
  decide

theorem a_node_reads_done_only_when_nothing_below_it_is_left_to_run (running : Bool)
    (leaves : List TaskState) (derived : derive running leaves = TaskState.done) :
    ∀ leaf ∈ leaves, leaf = TaskState.done ∨ leaf = TaskState.cancelled := by
  rcases (derive_is_done_only_over_finished_or_abandoned_leaves running leaves).mp derived with
    allDone | ⟨_, allTerminal⟩
  · exact fun leaf below => Or.inl (allDone leaf below)
  · intro leaf below
    have finished : terminal leaf = true := allTerminal leaf below
    cases leaf <;> simp_all [terminal]

theorem a_parent_never_reads_done_over_a_leaf_that_is_still_going (running : Bool)
    (leaves : List TaskState) (leaf : TaskState) (below : leaf ∈ leaves) (going : leaf = TaskState.doing) :
    derive running leaves ≠ TaskState.done := by
  intro derived
  subst going
  rcases a_node_reads_done_only_when_nothing_below_it_is_left_to_run running leaves derived
    TaskState.doing below with same | same <;> exact TaskState.noConfusion same

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

def progressFirst (running : Bool) (leaves : List TaskState) : TaskState :=
  if running || leaves.any (fun leaf => leaf = TaskState.doing) then TaskState.doing
  else derive running leaves

theorem checking_progress_before_the_block_hides_a_stuck_leaf :
    progressFirst false [TaskState.blocked, TaskState.doing] = TaskState.doing ∧
    derive false [TaskState.blocked, TaskState.doing] = TaskState.blocked := by
  decide

def reported (stored : TaskState) (running : Bool) (leaves : List TaskState) : TaskState :=
  match leaves with
  | [] => stored
  | _ => derive running leaves

theorem a_node_with_nothing_below_it_reports_its_own_state (stored : TaskState) (running : Bool) :
    reported stored running [] = stored := rfl

theorem a_parent_reports_what_is_below_it_not_what_it_stored (stored : TaskState) (running : Bool)
    (leaves : List TaskState) (below : leaves ≠ []) : reported stored running leaves = derive running leaves := by
  cases leaves with
  | nil => exact absurd rfl below
  | cons leaf rest => rfl

theorem nodes_over_the_same_leaves_agree (held held' : TaskState) (running : Bool)
    (leaves : List TaskState) (below : leaves ≠ []) :
    reported held running leaves = reported held' running leaves := by
  rw [a_parent_reports_what_is_below_it_not_what_it_stored held running leaves below,
    a_parent_reports_what_is_below_it_not_what_it_stored held' running leaves below]

def reportedStored (stored : TaskState) : TaskState := stored

theorem keeping_a_parent_copy_lets_it_contradict_its_children :
    reportedStored TaskState.done = TaskState.done ∧
    reported TaskState.done false [TaskState.doing] = TaskState.doing ∧
    reportedStored TaskState.done ≠ reportedStored TaskState.todo := by
  decide

inductive NodeKind where
  | goal
  | group
  | leaf
deriving DecidableEq, Repr

def kindOf (parent : Option String) (children : Nat) : NodeKind :=
  match children, parent with
  | 0, _ => NodeKind.leaf
  | _, none => NodeKind.goal
  | _, some _ => NodeKind.group

theorem a_node_with_nothing_below_it_is_a_leaf (parent : Option String) :
    kindOf parent 0 = NodeKind.leaf := rfl

theorem a_leaf_has_nothing_below_it (parent : Option String) (children : Nat)
    (kind : kindOf parent children = NodeKind.leaf) : children = 0 := by
  cases children with
  | zero => rfl
  | succ below => cases parent <;> simp [kindOf] at kind

end Board
