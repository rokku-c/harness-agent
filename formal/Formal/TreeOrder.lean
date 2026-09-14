namespace Board

abbrev Link := String → Option String

def below (link : Link) : Nat → String → String → Bool
  | 0, _, _ => false
  | depth + 1, root, task =>
    match link task with
    | some parent => if parent = root then true else below link depth root parent
    | none => false

def guarded (handed listing : List String) : List String :=
  match handed with
  | [] => listing
  | id :: rest => if id ∈ listing then guarded rest listing else guarded rest (listing ++ [id])

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

def unguarded (handed listing : List String) : List String :=
  match handed with
  | [] => listing
  | id :: rest => unguarded rest (listing ++ [id])

theorem an_unguarded_walk_lists_what_it_is_handed (handed listing : List String) :
    unguarded handed listing = listing ++ handed := by
  induction handed generalizing listing with
  | nil => simp [unguarded]
  | cons id rest ih => simp [unguarded, ih, List.append_assoc]

def cycleLink : Link
  | "a" => some "b"
  | "b" => some "a"
  | _ => none

theorem a_cycle_member_is_below_no_root (depth : Nat) :
    below cycleLink depth "r" "a" = false ∧ below cycleLink depth "r" "b" = false := by
  induction depth with
  | zero => simp [below]
  | succ k ih =>
    rcases ih with ⟨fromA, fromB⟩
    simp [below, cycleLink, fromA, fromB]

theorem the_walk_from_the_roots_alone_misses_a_cycle :
    guarded ["r"] [] = ["r"] ∧
    guarded (["r"] ++ ["a", "b"]) [] = ["r", "a", "b"] ∧
    ("a" ∈ guarded ["r"] [] → False) := by
  decide

theorem dropping_the_guard_lists_every_task_twice :
    guarded (["r", "a"] ++ ["r", "a"]) [] = ["r", "a"] ∧
    unguarded (["r", "a"] ++ ["r", "a"]) [] = ["r", "a", "r", "a"] := by
  decide

end Board
