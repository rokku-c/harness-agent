/-
  What a press leaves behind — `packages/effect-ui/src/data-spec.ts` (`clear`,
  `refresh`) and `apps/effect-server/src/client/effect-ui-action-runtime.ts`.

  A press reads something and writes the answer where the press was, so a refusal
  is read under the control that caused it. But the answer alone is not the whole
  of what the press did: sending a turn does not only answer, it changes the
  session's transcript, which is a *different* read, drawn elsewhere on the same
  screen. Without a way to run that read again the transcript keeps saying what it
  said before the turn — the deck's own defect: the reply landed in `/result/turn`
  and nothing on screen read it.

  The way is `refresh`, and the whole of its safety is that a re-run read is a
  read and not a press. Two edits exist — write an answer where it belongs, and
  empty the state a press consumed — and a press makes both while a refresh makes
  only the first:

  * `step_untouched` / `apply_untouched` — an edit that does not name a path does
    not change what that path reads. Everything below is this one fact;
  * `mem_readEdits` / `refresh_never_blanks` — a re-run read contributes a write
    at its own path and nothing else. So a refresh cannot empty anything, and
    cannot overwrite an answer at a path it does not own;
  * `answer_survives_refresh` — the whole point: the answer a press wrote is
    still where it wrote it after the reads it re-ran. That is why `clear` and
    `refresh` are two lists and not one — one takes state away and the other puts
    the world back, and folding them together would let the catch-up erase the
    thing the operator is reading.

  The condition is a condition on the app, not on the runtime: a refresh must not
  name the path the press's own answer went to. The deck's send writes
  `/result/turn` and refreshes the transcript read, which writes `/opened`.

  A press need not have a call at all. `{ name, refresh: [source] }` — a "Try
  again" under a list that failed to load — is a press whose whole work is the
  reads it re-runs, and it is the same `pressEdits` with no answer and nothing
  cleared. There is no answer of its own to protect, so `answer_survives_refresh`
  has no subject here; what such a press owes is the other half of the same fact,
  that it may not disturb what the operator reads anywhere its reads do not write.
  This is also why the runtime's gate on `clear` stays where it is while the gate
  on `refresh` does not: emptying a draft is something a write earns, and re-reading
  is not, because only one of the two can take something away.
-/

namespace EffectUi

/-- View state: what each path holds. `some ""` is a path a press emptied, which
is a different thing from a path nothing ever wrote — and is why a surface that
must say "nothing here" reads one path rather than two. -/
abbrev Store := String → Option String

/-- One change to the store: an answer written at the path that owns it, or the
state a press consumed, emptied. Only the second can leave a path empty. -/
inductive Edit where
  | write (path value : String)
  | blank (path : String)

/-- The one path an edit changes. -/
def Edit.pathOf : Edit → String
  | .write path _ => path
  | .blank path => path

/-- Whether an edit changes this path — by which it changes no other. -/
def touches (edit : Edit) (key : String) : Bool := edit.pathOf == key

/-- The edit, applied. A write puts its value at its own path and leaves every
other path exactly as it read; a blank empties its own. -/
def step (store : Store) (edit : Edit) : Store :=
  match edit with
  | .write path value => fun key => if key = path then some value else store key
  | .blank path => fun key => if key = path then some "" else store key

/-- Edits in order. -/
def apply (store : Store) : List Edit → Store
  | [] => store
  | edit :: rest => apply (step store edit) rest

/-- An edit that does not name a path does not change what that path reads. -/
theorem step_untouched {store : Store} {edit : Edit} {key : String}
    (h : touches edit key = false) : step store edit key = store key := by
  have hne : edit.pathOf ≠ key := (beq_eq_false_iff_ne).mp (by simpa [touches] using h)
  cases edit <;> simp only [step, Edit.pathOf] at hne ⊢ <;> rw [if_neg (Ne.symm hne)]

/-- So a list of them does not either. Everything below is this one fact. -/
theorem apply_untouched {edits : List Edit} {key : String} {store : Store}
    (h : ∀ edit ∈ edits, touches edit key = false) : apply store edits key = store key := by
  induction edits generalizing store with
  | nil => rfl
  | cons edit rest ih =>
    rw [apply, ih (fun e he => h e (List.mem_cons_of_mem edit he)),
      step_untouched (h edit List.mem_cons_self)]

/-- Edits in two parts are the first part, then the second. -/
theorem apply_append (store : Store) (first second : List Edit) :
    apply store (first ++ second) = apply (apply store first) second := by
  induction first generalizing store with
  | nil => rfl
  | cons edit rest ih => simp [apply, ih]

/-! ### What a read contributes -/

/-- What a read changes: its answer at the path that owns it. A read given no
path to write changes nothing — and no read ever empties anything. -/
def readEdits : Option String → String → List Edit
  | none, _ => []
  | some path, answer => [.write path answer]

/-- A re-run read writes where its answer belongs, and names no other path. -/
theorem mem_readEdits {result : Option String} {answer : String} {edit : Edit}
    (h : edit ∈ readEdits result answer) :
    ∃ path, result = some path ∧ edit = .write path answer := by
  cases result with
  | none => simp [readEdits] at h
  | some path => exact ⟨path, rfl, List.mem_singleton.mp h⟩

/-- So nothing a press's reads do can leave a path empty. This is why `clear` and
`refresh` are two lists: folding them together would let the catch-up erase what
the operator is reading. -/
theorem refresh_never_blanks {reads : List (Option String × String)} {edit : Edit}
    (h : edit ∈ reads.flatMap (fun read => readEdits read.1 read.2)) :
    ∀ path, edit ≠ .blank path := by
  obtain ⟨read, _, hread⟩ := List.mem_flatMap.mp h
  obtain ⟨path, _, rfl⟩ := mem_readEdits hread
  exact fun other hEq => Edit.noConfusion hEq

/-! ### What a press leaves behind -/

/-- What a press changes: the answer it just got, the state it consumed, and then
the reads it runs again. -/
def pressEdits (answer : String) (result : Option String) (cleared : List String)
    (reads : List (Option String × String)) : List Edit :=
  readEdits result answer ++ cleared.map Edit.blank
    ++ reads.flatMap (fun read => readEdits read.1 read.2)

/-- A refresh names no path but its own, so a path no re-run read owns is not
touched by any of them. -/
theorem refresh_untouched {reads : List (Option String × String)} {key : String}
    (h : ∀ read ∈ reads, read.1 ≠ some key) :
    ∀ edit ∈ reads.flatMap (fun read => readEdits read.1 read.2), touches edit key = false := by
  intro edit hedit
  obtain ⟨read, hread, hmem⟩ := List.mem_flatMap.mp hedit
  obtain ⟨path, hresult, rfl⟩ := mem_readEdits hmem
  have hpath : path ≠ key := fun hEq => h read hread (by rw [hresult, hEq])
  simpa [touches, Edit.pathOf, beq_eq_false_iff_ne] using hpath

/-- A clear touches the paths it names and no others. -/
theorem clear_untouched {cleared : List String} {key : String} (h : key ∉ cleared) :
    ∀ edit ∈ cleared.map Edit.blank, touches edit key = false := by
  intro edit hedit
  obtain ⟨path, hpath, rfl⟩ := List.mem_map.mp hedit
  simpa [touches, Edit.pathOf, beq_eq_false_iff_ne] using fun (hEq : path = key) => h (hEq ▸ hpath)

/-- A read of a path writes that path its answer. -/
theorem apply_read_self (store : Store) (result : Option String) (answer : String) {key : String}
    (h : result = some key) : apply store (readEdits result answer) key = some answer := by
  rw [h]; simp [readEdits, apply, step]

/-- **The whole point.** What a press wrote is still where it wrote it after the
reads it re-ran: a refresh writes its own answer at its own path and empties
nothing, so the reply stays under the control that asked for it while the list
beside it catches up. An app breaks this only by naming, in `refresh`, a read
whose answer belongs to the path the press's own answer went to. -/
theorem answer_survives_refresh {store : Store} {answer : String} {path : String}
    {cleared : List String} {reads : List (Option String × String)}
    (hclear : path ∉ cleared) (hreads : ∀ read ∈ reads, read.1 ≠ some path) :
    apply store (pressEdits answer (some path) cleared reads) path = some answer := by
  rw [pressEdits, apply_append, apply_append,
    apply_untouched (refresh_untouched hreads), apply_untouched (clear_untouched hclear)]
  exact apply_read_self store (some path) answer rfl

/-! ### The press with no call to make -/

/-- A press may name reads and have no call: `{ name, refresh: [source] }`. It wrote
no answer and consumed no draft, so it is `pressEdits` with neither — and the whole
of it is the reads it re-runs. -/
theorem retry_is_refresh_only {answer : String} {reads : List (Option String × String)} :
    pressEdits answer none [] reads = reads.flatMap (fun read => readEdits read.1 read.2) := by
  simp [pressEdits, readEdits]

/-- **So the whole of a retry's safety is one thing:** it changes the paths its reads
own and no other. Nothing else can move, so it cannot take away what the operator is
reading. This is what the runtime's gate on `refresh` rests on, and the reason that
gate is not the gate on `clear` — a press that made no call may re-read, but it may
not empty a draft. -/
theorem retry_untouched {store : Store} {reads : List (Option String × String)} {key : String}
    (h : ∀ read ∈ reads, read.1 ≠ some key) :
    apply store (reads.flatMap (fun read => readEdits read.1 read.2)) key = store key :=
  apply_untouched (refresh_untouched h)

/-- And it is not a no-op: the path a re-run read owns does get its answer, which is
the point of retrying. Stated for the read that runs first — a later read naming the
same path would be the app contradicting itself, and `retry_untouched` is what says
no *other* path moves. -/
theorem retry_writes_its_read {store : Store} {key : String} {answer : String}
    {rest : List (Option String × String)} (h : ∀ read ∈ rest, read.1 ≠ some key) :
    apply store (((some key, answer) :: rest).flatMap (fun read => readEdits read.1 read.2)) key
      = some answer := by
  rw [List.flatMap_cons, apply_append, apply_untouched (refresh_untouched h)]
  simp [readEdits, apply, step]

end EffectUi
