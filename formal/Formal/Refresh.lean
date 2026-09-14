namespace EffectUi

abbrev Store := String → Option String

inductive Edit where
  | write (path value : String)
  | blank (path : String)

def Edit.pathOf : Edit → String
  | .write path _ => path
  | .blank path => path

def touches (edit : Edit) (key : String) : Bool := edit.pathOf == key

def step (store : Store) (edit : Edit) : Store :=
  match edit with
  | .write path value => fun key => if key = path then some value else store key
  | .blank path => fun key => if key = path then some "" else store key

def apply (store : Store) : List Edit → Store
  | [] => store
  | edit :: rest => apply (step store edit) rest

theorem step_untouched {store : Store} {edit : Edit} {key : String}
    (h : touches edit key = false) : step store edit key = store key := by
  have hne : edit.pathOf ≠ key := (beq_eq_false_iff_ne).mp (by simpa [touches] using h)
  cases edit <;> simp only [step, Edit.pathOf] at hne ⊢ <;> rw [if_neg (Ne.symm hne)]

theorem apply_untouched {edits : List Edit} {key : String} {store : Store}
    (h : ∀ edit ∈ edits, touches edit key = false) : apply store edits key = store key := by
  induction edits generalizing store with
  | nil => rfl
  | cons edit rest ih =>
    rw [apply, ih (fun e he => h e (List.mem_cons_of_mem edit he)),
      step_untouched (h edit List.mem_cons_self)]

theorem apply_append (store : Store) (first second : List Edit) :
    apply store (first ++ second) = apply (apply store first) second := by
  induction first generalizing store with
  | nil => rfl
  | cons edit rest ih => simp [apply, ih]


def readEdits : Option String → String → List Edit
  | none, _ => []
  | some path, answer => [.write path answer]

theorem mem_readEdits {result : Option String} {answer : String} {edit : Edit}
    (h : edit ∈ readEdits result answer) :
    ∃ path, result = some path ∧ edit = .write path answer := by
  cases result with
  | none => simp [readEdits] at h
  | some path => exact ⟨path, rfl, List.mem_singleton.mp h⟩

theorem refresh_never_blanks {reads : List (Option String × String)} {edit : Edit}
    (h : edit ∈ reads.flatMap (fun read => readEdits read.1 read.2)) :
    ∀ path, edit ≠ .blank path := by
  obtain ⟨read, _, hread⟩ := List.mem_flatMap.mp h
  obtain ⟨path, _, rfl⟩ := mem_readEdits hread
  exact fun other hEq => Edit.noConfusion hEq


def pressEdits (answer : String) (result : Option String) (cleared : List String)
    (reads : List (Option String × String)) : List Edit :=
  readEdits result answer ++ cleared.map Edit.blank
    ++ reads.flatMap (fun read => readEdits read.1 read.2)

theorem refresh_untouched {reads : List (Option String × String)} {key : String}
    (h : ∀ read ∈ reads, read.1 ≠ some key) :
    ∀ edit ∈ reads.flatMap (fun read => readEdits read.1 read.2), touches edit key = false := by
  intro edit hedit
  obtain ⟨read, hread, hmem⟩ := List.mem_flatMap.mp hedit
  obtain ⟨path, hresult, rfl⟩ := mem_readEdits hmem
  have hpath : path ≠ key := fun hEq => h read hread (by rw [hresult, hEq])
  simpa [touches, Edit.pathOf, beq_eq_false_iff_ne] using hpath

theorem clear_untouched {cleared : List String} {key : String} (h : key ∉ cleared) :
    ∀ edit ∈ cleared.map Edit.blank, touches edit key = false := by
  intro edit hedit
  obtain ⟨path, hpath, rfl⟩ := List.mem_map.mp hedit
  simpa [touches, Edit.pathOf, beq_eq_false_iff_ne] using fun (hEq : path = key) => h (hEq ▸ hpath)

theorem apply_read_self (store : Store) (result : Option String) (answer : String) {key : String}
    (h : result = some key) : apply store (readEdits result answer) key = some answer := by
  rw [h]; simp [readEdits, apply, step]

theorem answer_survives_refresh {store : Store} {answer : String} {path : String}
    {cleared : List String} {reads : List (Option String × String)}
    (hclear : path ∉ cleared) (hreads : ∀ read ∈ reads, read.1 ≠ some path) :
    apply store (pressEdits answer (some path) cleared reads) path = some answer := by
  rw [pressEdits, apply_append, apply_append,
    apply_untouched (refresh_untouched hreads), apply_untouched (clear_untouched hclear)]
  exact apply_read_self store (some path) answer rfl


theorem retry_is_refresh_only {answer : String} {reads : List (Option String × String)} :
    pressEdits answer none [] reads = reads.flatMap (fun read => readEdits read.1 read.2) := by
  simp [pressEdits, readEdits]

theorem retry_untouched {store : Store} {reads : List (Option String × String)} {key : String}
    (h : ∀ read ∈ reads, read.1 ≠ some key) :
    apply store (reads.flatMap (fun read => readEdits read.1 read.2)) key = store key :=
  apply_untouched (refresh_untouched h)

theorem retry_writes_its_read {store : Store} {key : String} {answer : String}
    {rest : List (Option String × String)} (h : ∀ read ∈ rest, read.1 ≠ some key) :
    apply store (((some key, answer) :: rest).flatMap (fun read => readEdits read.1 read.2)) key
      = some answer := by
  rw [List.flatMap_cons, apply_append, apply_untouched (refresh_untouched h)]
  simp [readEdits, apply, step]

end EffectUi
