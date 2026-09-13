/-
  The layering rule — `packages/effect-config/src/merge.ts`.

  Three layers arrive from independent places: what the app declares as its
  default, what the operator wrote in YAML, what an override supplies. The file
  spreads them in one expression — `{ ...defaults, ...yaml, ...override }` —
  and then, separately, walks the same three layers to name the source of each
  key. Two passes over the same data are two chances to disagree, and the
  disagreement is silent: the operator reads a provenance that says `override`
  next to a value the default supplied, and there is nothing to notice.

  So the value at a key is modelled as a right-biased join — the more specific
  layer takes the key when it has it — and the source is modelled as it is read
  in the file: ask the override, then the YAML, then call it a default. What is
  proven:

  * `provenance_is_true` — the source named is the layer the value came from.
    Not a property of a well-chosen example: for every key, of every three
    layers.
  * `source_is_most_specific` / `source_carries_the_key` — the source is a layer
    that really carries the key, and no more specific layer does.
  * `a_default_never_moves_an_override` — adding a key to an app's default
    cannot move the value an operator overrode. This is the one that makes
    shipping a new default safe, and it holds because the override layer is
    consulted first when the spread is built, not because anyone checked.
  * `an_override_moves_only_its_own_keys` — and symmetrically, an override
    touches the keys it carries and nothing else.
  * `a_key_is_where_a_layer_put_it` — no key is invented and none is dropped:
    the merged config has a key exactly where some layer has one.
  * `join_assoc` / `join_idempotent` — the layers may be grouped or folded in
    any order, so the one-expression spread and a fold agree.
  * `reversed_order_lets_the_default_win` — the other half: spread the other way
    round, as a right-to-left reading of "default < yaml < override" gives, and
    the default wins while the provenance still says `override`. That is the
    lie the pairing above rules out.

  Values are modelled as opaque strings. Nothing here turns on what a config
  value *is*; the question is only which layer's copy survives, so the proofs
  are about the layers and never about the payload. Validation
  (`validateConfig`) is a separate claim and is left where it is.

  Modelling note: a layer is a key-to-value map, so "present and `undefined`"
  and "absent" are the same thing here, while `Object.hasOwn` separates them.
  The two models' answer differs only where a layer carries a key with an
  `undefined` value — which is the merged config's `validateConfig` refusing
  that key a moment later. `source_carries_the_key` carries the hypothesis the
  code's own `Object.keys(value)` walk supplies, and no theorem below is stated
  about a key the merged config does not have.
-/

namespace EffectConfig

/-- A config layer: what it has at a key, or nothing at that key. -/
abbrev Layer := String → Option String

/-- Which layer a value came from, named in precedence order — weakest first,
the order the file's own comment gives. -/
inductive Lvl where
  | dflt
  | yaml
  | ovrd
deriving DecidableEq, Repr

/-- The layer a name refers to, so a proof about layers can be a proof about
names. -/
def layerOf (d y o : Layer) : Lvl → Layer
  | Lvl.dflt => d
  | Lvl.yaml => y
  | Lvl.ovrd => o

/-- How specific a layer is. Higher wins. -/
def rank : Lvl → Nat
  | Lvl.dflt => 0
  | Lvl.yaml => 1
  | Lvl.ovrd => 2

/-- The join: the more specific layer takes the key when it has it. Right-biased,
which is what a `{ ...a, ...b }` spread is. -/
def join (a b : Layer) : Layer := fun k =>
  match b k with
  | some v => some v
  | none => a k

/-- The merged config, in the one grouping `merge.ts` writes it:
`{ ...defaults, ...yaml, ...override }`. -/
def merge3 (d y o : Layer) : Layer := join (join d y) o

/-- The source of a key, read off the layers in the same most-specific-first
order the file reads them in. The default is not consulted: being a default is
what is left when neither of the other two has the key, which is why this takes
two layers and answers about three. -/
def source (y o : Layer) (k : String) : Lvl :=
  match o k with
  | some _ => Lvl.ovrd
  | none =>
    match y k with
    | some _ => Lvl.yaml
    | none => Lvl.dflt

/-! ### The join, before anything is said about which layer is which -/

/-- The join is idempotent: a layer laid over itself changes nothing. -/
theorem join_idempotent (a : Layer) : join a a = a := by
  funext k
  unfold join
  cases a k <;> rfl

/-- And associative: the layers may be grouped however they are written, which
is what lets the file write one spread and lets a fold agree with it. -/
theorem join_assoc (a b c : Layer) : join (join a b) c = join a (join b c) := by
  funext k
  unfold join
  cases c k <;> cases b k <;> rfl

/-! ### What the three layers mean -/

/-- The provenance is true: the value at a key is the value of the layer the
source names. Two passes over the same three layers, and they agree. -/
theorem provenance_is_true (d y o : Layer) (k : String) :
    merge3 d y o k = layerOf d y o (source y o k) k := by
  cases ho : o k <;> cases hy : y k <;> simp [merge3, join, source, layerOf, ho, hy]

/-- The source is the most specific layer that carries the key: nothing above it
has one. So "why is this value here" has one answer, and it is the top one. -/
theorem source_is_most_specific (d y o : Layer) (k : String) (l : Lvl)
    (h : rank (source y o k) < rank l) : (layerOf d y o l) k = none := by
  cases ho : o k <;> cases hy : y k <;> cases l <;> simp_all [source, layerOf, rank]

/-- And for a key the merged config actually has, the source names a layer that
really carries it — the other half of being the answer, since it is not naming a
layer with nothing to say. The hypothesis is not a convenience: `merge.ts` walks
`Object.keys(value)`, so a key no layer carries is never asked about. -/
theorem source_carries_the_key (d y o : Layer) (k : String)
    (h : merge3 d y o k ≠ none) : (layerOf d y o (source y o k)) k ≠ none := by
  cases ho : o k <;> cases hy : y k <;> cases hd : d k <;> simp_all [merge3, join, source, layerOf]

/-- A default never moves a value an override set. Adding a key to an app's
default is safe for every operator who overrode it — which is the reason a new
default can ship at all. -/
theorem a_default_never_moves_an_override (d d' y o : Layer) (k : String) (v : String)
    (ho : o k = some v) : merge3 d y o k = some v ∧ merge3 d' y o k = some v := by
  simp [merge3, join, ho]

/-- An override moves only the keys it carries: every other key is what it was
with no override layer at all. -/
theorem an_override_moves_only_its_own_keys (d y o : Layer) (k : String) (h : o k = none) :
    merge3 d y o k = join d y k := by
  simp [merge3, join, h]

/-- No key is invented and none is dropped: the merged config has a key exactly
where some layer has one. -/
theorem a_key_is_where_a_layer_put_it (d y o : Layer) (k : String) :
    merge3 d y o k ≠ none ↔ d k ≠ none ∨ y k ≠ none ∨ o k ≠ none := by
  cases ho : o k <;> cases hy : y k <;> cases hd : d k <;>
    simp_all [merge3, join]

/-! ### What the disagreement costs -/

/-- The spread written the other way round — `{ ...override, ...yaml, ...default }`,
which is what reading "default < yaml < override" right to left gives. -/
def mergeReversed (d y o : Layer) : Layer := join (join o y) d

/-- Written that way the weakest layer wins, and the provenance the file still
reports is a lie: the value is the default's while the source says `override`.
Stated as both halves, because either alone is a smaller thing than the bug. -/
theorem reversed_order_lets_the_default_win (d y o : Layer) (k v w : String)
    (hd : d k = some v) (ho : o k = some w) :
    mergeReversed d y o k = some v ∧ source y o k = Lvl.ovrd := by
  exact ⟨by simp [mergeReversed, join, hd], by simp [source, ho]⟩

end EffectConfig
