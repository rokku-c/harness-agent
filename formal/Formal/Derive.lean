namespace EffectUi

def ROOT_SCREEN : String := "root"

abbrev Mint := String → List String → String

def Fresh (mint : Mint) : Prop := ∀ (base : String) (pool : List String), mint base pool ∉ pool

def mintAll (mint : Mint) : List String → List String → List String × List String
  | [], pool => ([], pool)
  | title :: rest, pool =>
    let id := mint title pool
    let (ids, pool') := mintAll mint rest (id :: pool)
    (id :: ids, pool')

theorem minted_ne (mint : Mint) (hfresh : Fresh mint) : ∀ (titles : List String) (pool : List String)
    (a : String), a ∈ pool → ∀ y ∈ (mintAll mint titles pool).1, y ≠ a
  | [], pool, a, _, y, hy => by simp [mintAll] at hy
  | title :: rest, pool, a, ha, y, hy => by
    simp only [mintAll, List.mem_cons] at hy
    rcases hy with rfl | hy
    · exact fun h => hfresh title pool (h ▸ ha)
    · exact minted_ne mint hfresh rest (mint title pool :: pool) a
        (List.mem_cons.mpr (Or.inr ha)) y hy

theorem minted_nodup (mint : Mint) (hfresh : Fresh mint) : ∀ (titles : List String) (pool : List String),
    pool.Nodup → (mintAll mint titles pool).1.Nodup
  | [], _, _ => List.nodup_nil
  | title :: rest, pool, h => by
    simp only [mintAll]
    refine List.nodup_cons.mpr ⟨?_, minted_nodup mint hfresh rest (mint title pool :: pool)
      (List.nodup_cons.mpr ⟨hfresh title pool, h⟩)⟩
    intro hid
    exact minted_ne mint hfresh rest (mint title pool :: pool) (mint title pool)
      (List.mem_cons.mpr (Or.inl rfl)) (mint title pool) hid rfl

def screenIds (mint : Mint) (declared : Option (List String)) (titles : List String)
    (pool : List String) : List String :=
  match declared with
  | some ids => ROOT_SCREEN :: ids
  | none => ROOT_SCREEN :: (mintAll mint titles pool).1

theorem derived_ids_nodup (mint : Mint) (hfresh : Fresh mint) {titles pool : List String}
    (hpool : pool.Nodup) (hroot : ROOT_SCREEN ∈ pool) :
    (screenIds mint none titles pool).Nodup := by
  refine List.nodup_cons.mpr ⟨?_, minted_nodup mint hfresh titles pool hpool⟩
  intro hid
  exact minted_ne mint hfresh titles pool ROOT_SCREEN hroot ROOT_SCREEN hid rfl

theorem declared_ids_nodup {ids : List String} (h : ids.Nodup) (hroot : ROOT_SCREEN ∉ ids) :
    (screenIds mint (some ids) [] []).Nodup :=
  List.nodup_cons.mpr ⟨hroot, h⟩


theorem root_collides (mint : Mint) {pool : List String} (h : mint "Root" pool = ROOT_SCREEN) :
    ROOT_SCREEN ∈ (screenIds mint none ["Root"] pool) := by
  simp only [screenIds, mintAll, h]
  exact List.mem_cons.mpr (Or.inl rfl)

end EffectUi
