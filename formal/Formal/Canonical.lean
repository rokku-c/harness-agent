/-
  WHAT A CANONICAL ENCODING MAY LOSE — `packages/effect-observe/src/types.ts` and
  `packages/agentd/src/stable.ts`, which are one rule written out twice.

  Both turn a value into a form whose `JSON.stringify` is the same for two values
  a reader would call equal, and neither was checked. Reordering is what the
  mechanism is for: sorting keys is the whole of it, and two records differing
  only in key order must encode alike, or a diff reports a phantom update on
  every re-push. What it may not do is *drop* a value. A change-detection hash
  reads "unchanged" and the observer records nothing; a `same` comparing equal is
  a plan diff nobody reads again. Ruled either way it is silent, and silent is
  the one thing both callers cannot notice.

  The distinction both files dropped is the value with no own keys to sort: a
  `Date` carries a `toJSON`, `Object.keys` on it is empty, so it encoded as `{}` —
  the encoding an empty object gets and the encoding every other date gets. Two
  frames differing only in a timestamp were one observation, and the second was
  never recorded.

  Modelling note: a record is an association list already in canonical key order,
  which is the state the sort leaves it in, so this file is not about ordering.
  That leaves one question — which constructors survive the encoding — and it is
  the question the fix answers. `ignoredToJSON` is the encoding both files had;
  `encode` is the one they have.
-/

namespace Canonical

/-- A value as a sampler or an artifact builder hands one over: a scalar, an
    instant, a list, or a record whose fields are in canonical key order. -/
inductive Val where
  | scalar : Nat → Val
  | instant : Nat → Val
  | items : List Val → Val
  | obj : List (String × Val) → Val

/-- What an encoding can still tell apart. `inst` is the constructor only a value
    with a `toJSON` of its own reaches. -/
inductive Json where
  | scalar : Nat → Json
  | inst : Nat → Json
  | items : List Json → Json
  | obj : List (String × Json) → Json

mutual
  /-- The encoding both files had: every object is read as the keys it has, and an
      instant has none, so it encodes as the empty record. -/
  def ignoredToJSON : Val → Json
    | .scalar n => .scalar n
    | .instant _ => .obj []
    | .items xs => .items (ignoredToJSONItems xs)
    | .obj fields => .obj (ignoredToJSONFields fields)

  def ignoredToJSONItems : List Val → List Json
    | [] => []
    | x :: xs => ignoredToJSON x :: ignoredToJSONItems xs

  def ignoredToJSONFields : List (String × Val) → List (String × Json)
    | [] => []
    | (name, v) :: rest => (name, ignoredToJSON v) :: ignoredToJSONFields rest
end

mutual
  /-- The encoding both files have: a value carrying its own `toJSON` is visited
      through it, as `JSON.stringify` visits it, and everything else the way it was
      visited before. -/
  def encode : Val → Json
    | .scalar n => .scalar n
    | .instant n => .inst n
    | .items xs => .items (encodeItems xs)
    | .obj fields => .obj (encodeFields fields)

  def encodeItems : List Val → List Json
    | [] => []
    | x :: xs => encode x :: encodeItems xs

  def encodeFields : List (String × Val) → List (String × Json)
    | [] => []
    | (name, v) :: rest => (name, encode v) :: encodeFields rest
end

/-- The symptom, at the top: a bare date and an empty object are one encoding —
    `jsonHash(new Date(0))` and `jsonHash({})` are the same hash. -/
theorem a_date_and_an_empty_object_are_one_encoding (n : Nat) :
    ignoredToJSON (.instant n) = ignoredToJSON (.obj []) := rfl

/-- Which is what makes every date every other date. A frame whose only change is
    a timestamp encodes as the frame before it, so the observer records the first
    and never the second. -/
theorem every_date_is_every_other (m n : Nat) :
    ignoredToJSON (.instant m) = ignoredToJSON (.instant n) := rfl

/-- With the `toJSON` step the two are two encodings. -/
theorem a_date_is_not_an_empty_object (n : Nat) :
    encode (.instant n) ≠ encode (.obj []) := by
  intro h
  cases h

/-- And two dates are told apart, which is the change the observer is for. -/
theorem a_date_is_told_from_another {m n : Nat}
    (h : encode (.instant m) = encode (.instant n)) : m = n := by
  injection h

/-- The step is not taken at the top only: a record is encoded by encoding its
    fields, so the same rule reaches a date under one — the frame a sampler
    actually hands over. -/
theorem a_field_is_encoded_the_same_way (name : String) (v : Val) :
    encode (.obj [(name, v)]) = .obj [(name, encode v)] := rfl

/-- So a date under a record is told from another date under it. -/
theorem a_date_under_a_record_is_told_from_another {m n : Nat}
    (h : encode (.obj [("at", .instant m)]) = encode (.obj [("at", .instant n)])) : m = n := by
  injection h with h
  injection h with h _
  injection h with _ h
  injection h

/-- The control: the fix is one case. Where no date is involved the encoding told
    values apart before it and still does — a scalar is not a record either way,
    so the sort's own job is what it was. -/
theorem a_scalar_is_not_a_record : encode (.scalar 1) ≠ encode (.obj []) := by
  intro h
  cases h

/-- The same distinction, on the encoding before the fix. -/
theorem a_scalar_was_not_a_record_either :
    ignoredToJSON (.scalar 1) ≠ ignoredToJSON (.obj []) := by
  intro h
  cases h

end Canonical
