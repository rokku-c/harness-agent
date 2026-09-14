namespace EffectUi

abbrev Params := String → Option String

abbrev Address := List (String × String)

abbrev PathKeys := List String

def resolve (declared supplied : Params) : Params := fun key =>
  match supplied key with
  | some value => some value
  | none => declared key

def write (address : Address) (key value : String) : Address := (key, value) :: address

def read (address : Address) (key : String) : Option String := address.lookup key

def written (params : Params) (names : List String) : Address :=
  names.foldr (fun key address => match params key with
    | some value => write address key value
    | none => address) []

def press (declared supplied : Params) (names : List String) : Address :=
  written (resolve declared supplied) names


theorem resolve_supplied {declared supplied : Params} {key value : String}
    (h : supplied key = some value) : resolve declared supplied key = some value := by
  simp [resolve, h]

theorem resolve_declared {declared supplied : Params} {key : String}
    (h : supplied key = none) : resolve declared supplied key = declared key := by
  simp [resolve, h]

theorem resolve_none {declared supplied : Params} {key : String}
    (hd : declared key = none) (hs : supplied key = none) :
    resolve declared supplied key = none := by
  simp [resolve, hd, hs]


theorem read_write (address : Address) (key other value : String) :
    read (write address other value) key = if key = other then some value else read address key := by
  rw [read, write, List.lookup_cons]
  split <;> simp_all [beq_iff_eq, read]

theorem read_write_same (address : Address) (key value : String) :
    read (write address key value) key = some value := by
  simp [read_write]

theorem read_write_other (address : Address) {key other value : String} (h : key ≠ other) :
    read (write address other value) key = read address key := by
  simp [read_write, h]


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

theorem arrival_reads_the_press {declared supplied : Params} {names : List String}
    {key value : String} (hnd : names.Nodup) (hmem : key ∈ names)
    (h : supplied key = some value) : read (press declared supplied names) key = some value :=
  read_written_of_mem hnd hmem (resolve_supplied h)

theorem the_screen_is_handed_what_the_press_held {declared supplied : Params}
    {names : List String} {key value : String} (hnd : names.Nodup) (hmem : key ∈ names)
    (h : supplied key = some value) :
    read (press declared supplied names) key = resolve declared supplied key := by
  rw [arrival_reads_the_press hnd hmem h, resolve_supplied h]

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

theorem written_only_names {params : Params} {names : List String} {key value : String}
    (h : read (written params names) key = some value) : key ∈ names := by
  obtain ⟨before, after, heq, -⟩ := List.lookup_eq_some_iff.mp (by simpa [read] using h)
  exact written_subset (heq ▸ List.mem_append_right before List.mem_cons_self)


def addressed (keys : PathKeys) (params : Params) : Bool := keys.all (fun key => (params key).isSome)

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

theorem addressed_of_mem {keys : PathKeys} {params : Params} {key : String}
    (h : addressed keys params = true) (hmem : key ∈ keys) : (params key).isSome = true := by
  rw [addressed, List.all_eq_true] at h
  exact h key hmem

end EffectUi
