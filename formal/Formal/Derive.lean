/-
  Naming the screens read off a view — `packages/effect-ui/src/screen-derive.ts`.

  A view that did not name its screens has them read off its layout, one screen
  per function card, each named after the card's heading. Names are ids, and
  ids are looked up: `screensOf` puts the view's first screen at the head under
  the reserved id `root`, and everything the host does from there — rebuilding a
  stack from a URL, deciding a link still lands somewhere — is a lookup by id.
  Two screens with one id is a screen nobody can reach.

  So the derivation's whole obligation is that the id it mints for a card is one
  nothing else has taken. It keeps a pool of used ids and mints from the heading
  until it finds one the pool does not have — that is `Fresh`, below, and it is
  the only assumption any of this needs. What the pool must contain is the point:
  `root` is spoken for before the first card is read, so a card titled "Root" has
  to become something else. `derived_ids_nodup` is the guarantee; `root_collides`
  is the same derivation with the reserved id left out of the pool, which is how
  a card titled "Root" came to take the id of the view's own first screen.
-/

namespace EffectUi

/-- The reserved id of the screen a view starts on. -/
def ROOT_SCREEN : String := "root"

/-- An id as minted from a card's heading, given the ids already used. -/
abbrev Mint := String → List String → String

/-- A mint is fresh when it never returns an id the pool already holds.
This is the derivation's only assumption, and the thing a seeded pool supplies. -/
def Fresh (mint : Mint) : Prop := ∀ (base : String) (pool : List String), mint base pool ∉ pool

/-- The ids a run of headings mints, and the pool it leaves behind. -/
def mintAll (mint : Mint) : List String → List String → List String × List String
  | [], pool => ([], pool)
  | title :: rest, pool =>
    let id := mint title pool
    let (ids, pool') := mintAll mint rest (id :: pool)
    (id :: ids, pool')

/-- Nothing a mint produces can be an id the pool already had — so seeding the
pool with the reserved id is what keeps a card from being named `root`. -/
theorem minted_ne (mint : Mint) (hfresh : Fresh mint) : ∀ (titles : List String) (pool : List String)
    (a : String), a ∈ pool → ∀ y ∈ (mintAll mint titles pool).1, y ≠ a
  | [], pool, a, _, y, hy => by simp [mintAll] at hy
  | title :: rest, pool, a, ha, y, hy => by
    simp only [mintAll, List.mem_cons] at hy
    rcases hy with rfl | hy
    · exact fun h => hfresh title pool (h ▸ ha)
    · exact minted_ne mint hfresh rest (mint title pool :: pool) a
        (List.mem_cons.mpr (Or.inr ha)) y hy

/-- A run of headings mints no id twice. -/
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

/-- What a view's screens are called: the one it starts on, then the ones it
declared — or, declaring none, the ones read off it. -/
def screenIds (mint : Mint) (declared : Option (List String)) (titles : List String)
    (pool : List String) : List String :=
  match declared with
  | some ids => ROOT_SCREEN :: ids
  | none => ROOT_SCREEN :: (mintAll mint titles pool).1

/-- Read off a view whose pool holds the reserved id, the screens have distinct ids. -/
theorem derived_ids_nodup (mint : Mint) (hfresh : Fresh mint) {titles pool : List String}
    (hpool : pool.Nodup) (hroot : ROOT_SCREEN ∈ pool) :
    (screenIds mint none titles pool).Nodup := by
  refine List.nodup_cons.mpr ⟨?_, minted_nodup mint hfresh titles pool hpool⟩
  intro hid
  exact minted_ne mint hfresh titles pool ROOT_SCREEN hroot ROOT_SCREEN hid rfl

/-- Declared, a view says its own ids: they have to be distinct, and none of them
may take the reserved one. -/
theorem declared_ids_nodup {ids : List String} (h : ids.Nodup) (hroot : ROOT_SCREEN ∉ ids) :
    (screenIds mint (some ids) [] []).Nodup :=
  List.nodup_cons.mpr ⟨hroot, h⟩

/-! ### What the pool's seed buys -/

/-- A pool that does not hold the reserved id guarantees nothing: a card whose
heading slugs to `root` takes it, and the view then has two screens called
`root` — the one it starts on, and the one nobody can reach. -/
theorem root_collides (mint : Mint) {pool : List String} (h : mint "Root" pool = ROOT_SCREEN) :
    ROOT_SCREEN ∈ (screenIds mint none ["Root"] pool) := by
  simp only [screenIds, mintAll, h]
  exact List.mem_cons.mpr (Or.inl rfl)

end EffectUi
