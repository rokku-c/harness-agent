namespace EffectConfig

abbrev Layer := String → Option String

inductive Lvl where
  | dflt
  | yaml
  | ovrd
deriving DecidableEq, Repr

def layerOf (d y o : Layer) : Lvl → Layer
  | Lvl.dflt => d
  | Lvl.yaml => y
  | Lvl.ovrd => o

def rank : Lvl → Nat
  | Lvl.dflt => 0
  | Lvl.yaml => 1
  | Lvl.ovrd => 2

def join (a b : Layer) : Layer := fun k =>
  match b k with
  | some v => some v
  | none => a k

def merge3 (d y o : Layer) : Layer := join (join d y) o

def source (y o : Layer) (k : String) : Lvl :=
  match o k with
  | some _ => Lvl.ovrd
  | none =>
    match y k with
    | some _ => Lvl.yaml
    | none => Lvl.dflt


theorem join_idempotent (a : Layer) : join a a = a := by
  funext k
  unfold join
  cases a k <;> rfl

theorem join_assoc (a b c : Layer) : join (join a b) c = join a (join b c) := by
  funext k
  unfold join
  cases c k <;> cases b k <;> rfl


theorem provenance_is_true (d y o : Layer) (k : String) :
    merge3 d y o k = layerOf d y o (source y o k) k := by
  cases ho : o k <;> cases hy : y k <;> simp [merge3, join, source, layerOf, ho, hy]

theorem source_is_most_specific (d y o : Layer) (k : String) (l : Lvl)
    (h : rank (source y o k) < rank l) : (layerOf d y o l) k = none := by
  cases ho : o k <;> cases hy : y k <;> cases l <;> simp_all [source, layerOf, rank]

theorem source_carries_the_key (d y o : Layer) (k : String)
    (h : merge3 d y o k ≠ none) : (layerOf d y o (source y o k)) k ≠ none := by
  cases ho : o k <;> cases hy : y k <;> cases hd : d k <;> simp_all [merge3, join, source, layerOf]

theorem a_default_never_moves_an_override (d d' y o : Layer) (k : String) (v : String)
    (ho : o k = some v) : merge3 d y o k = some v ∧ merge3 d' y o k = some v := by
  simp [merge3, join, ho]

theorem an_override_moves_only_its_own_keys (d y o : Layer) (k : String) (h : o k = none) :
    merge3 d y o k = join d y k := by
  simp [merge3, join, h]

theorem a_key_is_where_a_layer_put_it (d y o : Layer) (k : String) :
    merge3 d y o k ≠ none ↔ d k ≠ none ∨ y k ≠ none ∨ o k ≠ none := by
  cases ho : o k <;> cases hy : y k <;> cases hd : d k <;>
    simp_all [merge3, join]


def mergeReversed (d y o : Layer) : Layer := join (join o y) d

theorem reversed_order_lets_the_default_win (d y o : Layer) (k v w : String)
    (hd : d k = some v) (ho : o k = some w) :
    mergeReversed d y o k = some v ∧ source y o k = Lvl.ovrd := by
  exact ⟨by simp [mergeReversed, join, hd], by simp [source, ho]⟩

end EffectConfig
