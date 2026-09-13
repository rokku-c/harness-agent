/-
  A screen's arrival — `packages/effect-ui/src/screen-spec.ts` (`UiScreen.onEnter`)
  and `apps/effect-server/src/client/effect-ui-action-runtime.ts`.

  A destination has to be complete on arrival, and it is reached by one of two
  doors: a press, or an address pasted into the bar. Before `onEnter` the press
  read the record and put it in the store, while the pasted address read nothing
  at all — so the same address showed a record when a press led to it and a
  heading over an empty screen when it was pasted. The parameters were in the
  address, and nobody read them.

  What makes the two doors one is that the press writes what it holds into the
  address and the screen reads it back from there. So the claim is an agreement
  between *writing* and *reading* — and the writing is a real step, because the
  address is a string, not the object the press held:

  * `read_write` — what a key reads after a write: the value written, if that was
    the key, and otherwise exactly what it read before. This is `URLSearchParams`
    with the most recent write in front, which is why a later write shadows an
    earlier one and nothing has to be removed;
  * `arrival_reads_the_press` — a value the press supplied, for a name the action
    declares, is what the screen reads on arrival;
  * `the_screen_is_handed_what_the_press_held` — and it is the same value the
    call was made with, which is the whole of `onEnter`: the pasted address and
    the press differ in nothing, because the arrival reads the address in both;
  * `written_only_names` — the address carries the names the action declares and
    no others, so a screen cannot read a value the press never wrote;
  * `unaddressed_iff` — the call is skipped when *some* path parameter has no
    value. Read as "all of them missing" instead, `{taskId}` empty would still be
    sent, and the server would answer about a path the declaration never named.
-/

namespace EffectUi

/-- What a call is made with: a value per parameter name. `none` is an absence,
not an empty string — the difference between "this press did not name a task" and
"this press named the empty task", which is the difference between skipping the
call and addressing the wrong one. -/
abbrev Params := String → Option String

/-- The address, as the pairs a query string carries. A later write sits in front
of an earlier one and shadows it, which is `URLSearchParams` with `set`. -/
abbrev Address := List (String × String)

/-- The names a url templates: every `{name}` in it is that resource's own id. -/
abbrev PathKeys := List String

/-- What a call is made with: the press's value where it has one, the declaration
where it does not. This is `{ ...declared, ...runtimeParams }`. -/
def resolve (declared supplied : Params) : Params := fun key =>
  match supplied key with
  | some value => some value
  | none => declared key

/-- A write to the address. Nothing is removed: the new pair goes in front, and a
read of that key finds it first. -/
def write (address : Address) (key value : String) : Address := (key, value) :: address

/-- A read of the address — `URLSearchParams.get`, whose answer is the value of
the first pair carrying the key. -/
def read (address : Address) (key : String) : Option String := address.lookup key

/-- The address a press leaves behind: every name the action declares, written
with the value that call resolved to. A name that resolved to nothing is not
written at all, so it reads back as nothing rather than as an empty value. -/
def written (params : Params) (names : List String) : Address :=
  names.foldr (fun key address => match params key with
    | some value => write address key value
    | none => address) []

/-- The press: resolve the call's parameters, write them into the address, enter
the screen. `open` hands the whole resolved set to the url, not the declaration
alone — which is what leaves the address holding what the press held. -/
def press (declared supplied : Params) (names : List String) : Address :=
  written (resolve declared supplied) names

/-! ### What a call is made with -/

/-- A parameter the press supplied is the value used, whatever the declaration
says. Without this a press could not override a declared default at all. -/
theorem resolve_supplied {declared supplied : Params} {key value : String}
    (h : supplied key = some value) : resolve declared supplied key = some value := by
  simp [resolve, h]

/-- With nothing supplied, the declaration is the value used — which is why a
literal parameter needs no entry in the address. -/
theorem resolve_declared {declared supplied : Params} {key : String}
    (h : supplied key = none) : resolve declared supplied key = declared key := by
  simp [resolve, h]

/-- Where neither has a value the call is made with none, and a path parameter
that is none is an unaddressed call, not an empty one. -/
theorem resolve_none {declared supplied : Params} {key : String}
    (hd : declared key = none) (hs : supplied key = none) :
    resolve declared supplied key = none := by
  simp [resolve, hd, hs]

/-! ### Writing and reading the address -/

/-- What a key reads after a write: the value written if that was the key, and
otherwise exactly what it read before. Everything in between is `lookup` walking
past pairs that are not the key. -/
theorem read_write (address : Address) (key other value : String) :
    read (write address other value) key = if key = other then some value else read address key := by
  rw [read, write, List.lookup_cons]
  split <;> simp_all [beq_iff_eq, read]

/-- A write of the key itself is what that key reads. -/
theorem read_write_same (address : Address) (key value : String) :
    read (write address key value) key = some value := by
  simp [read_write]

/-- A write to another key does not change what this key reads. -/
theorem read_write_other (address : Address) {key other value : String} (h : key ≠ other) :
    read (write address other value) key = read address key := by
  simp [read_write, h]

/-! ### What the screen reads on arrival -/

/-- A name the action declares, with a value the press supplied, is what the
screen reads back from the address. The names are distinct because they are an
object's keys; that is what lets a write to one of them leave the others alone. -/
theorem read_written_of_mem {params : Params} {names : List String} {key value : String}
    (hnd : names.Nodup) (hmem : key ∈ names) (h : params key = some value) :
    read (written params names) key = some value := by
  induction names with
  | nil => simp at hmem
  | cons head tail ih =>
    obtain ⟨hhead, htail⟩ := List.nodup_cons.mp hnd
    rw [written, List.foldr_cons]
    rcases List.mem_cons.mp hmem with rfl | hmem
    · rw [h, read_write_same]
    · have hne : key ≠ head := fun he => hhead (he ▸ hmem)
      cases hh : params head with
      | none => exact ih htail hmem
      | some other => simp only [] at * ; rw [read_write_other _ hne] ; exact ih htail hmem

/-- The whole of `onEnter`. A value the press supplied, for a name the action
declares, is the value the screen reads on arrival — so the pasted address and
the press hand the screen the same thing, and a cold link lands on a complete
screen rather than on a heading over nothing. -/
theorem arrival_reads_the_press {declared supplied : Params} {names : List String}
    {key value : String} (hnd : names.Nodup) (hmem : key ∈ names)
    (h : supplied key = some value) : read (press declared supplied names) key = some value :=
  read_written_of_mem hnd hmem (resolve_supplied h)

/-- Both doors are one door: what the screen is handed on arrival is the value the
call was made with. There is no second path to keep in step — the press writes the
address and the screen reads it, and a pasted address is read by that same screen
at that same key. -/
theorem the_screen_is_handed_what_the_press_held {declared supplied : Params}
    {names : List String} {key value : String} (hnd : names.Nodup) (hmem : key ∈ names)
    (h : supplied key = some value) :
    read (press declared supplied names) key = resolve declared supplied key := by
  rw [arrival_reads_the_press hnd hmem h, resolve_supplied h]

/-- Everything in the address was written from a declared name, so the address
carries no name the action did not declare. -/
theorem written_subset {params : Params} {names : List String} {pair : String × String}
    (hp : pair ∈ written params names) : pair.1 ∈ names := by
  induction names with
  | nil => simp [written, List.foldr_nil] at hp
  | cons head tail ih =>
    revert hp
    simp only [written, List.foldr_cons]
    cases hh : params head with
    | none => intro hp; exact List.mem_cons_of_mem head (ih hp)
    | some value =>
      intro hp
      simp only [] at *
      rcases List.mem_cons.mp hp with heq | hp
      · exact heq ▸ List.mem_cons_self
      · exact List.mem_cons_of_mem head (ih hp)

/-- The address carries the names the action declares and no others. A screen
declaring `/_nav/<name>` for a name no press wrote reads nothing — not a value
from some earlier arrival, and not a value from another screen's parameters. -/
theorem written_only_names {params : Params} {names : List String} {key value : String}
    (h : read (written params names) key = some value) : key ∈ names := by
  obtain ⟨before, after, heq, -⟩ := List.lookup_eq_some_iff.mp (by simpa [read] using h)
  exact written_subset (heq ▸ List.mem_append_right before List.mem_cons_self)

/-! ### A url with a path parameter nothing supplied -/

/-- Whether the call can be addressed: every id its path names has a value. -/
def addressed (keys : PathKeys) (params : Params) : Bool := keys.all (fun key => (params key).isSome)

/-- Unaddressed is *some* id missing, not all of them. Read as "all", a url naming
two ids would be called as soon as either had a value, and a press that names no
task would send `/tasks/` — a request about a path the declaration never
described, answered by whatever that path happens to mean. -/
theorem unaddressed_iff {keys : PathKeys} {params : Params} :
    addressed keys params = false ↔ ∃ key ∈ keys, params key = none := by
  rw [addressed, List.all_eq_false]
  constructor
  · rintro ⟨key, hmem, hnone⟩
    cases h : params key with
    | none => exact ⟨key, hmem, h⟩
    | some value => simp [h] at hnone
  · rintro ⟨key, hmem, hnone⟩
    exact ⟨key, hmem, by simp [hnone]⟩

/-- An addressed call has a value for every id its path names. -/
theorem addressed_of_mem {keys : PathKeys} {params : Params} {key : String}
    (h : addressed keys params = true) (hmem : key ∈ keys) : (params key).isSome = true := by
  rw [addressed, List.all_eq_true] at h
  exact h key hmem

end EffectUi
