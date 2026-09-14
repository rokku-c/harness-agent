namespace Canonical

inductive Val where
  | scalar : Nat → Val
  | instant : Nat → Val
  | items : List Val → Val
  | obj : List (String × Val) → Val

inductive Json where
  | scalar : Nat → Json
  | inst : Nat → Json
  | items : List Json → Json
  | obj : List (String × Json) → Json

mutual
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

theorem a_date_and_an_empty_object_are_one_encoding (n : Nat) :
    ignoredToJSON (.instant n) = ignoredToJSON (.obj []) := rfl

theorem every_date_is_every_other (m n : Nat) :
    ignoredToJSON (.instant m) = ignoredToJSON (.instant n) := rfl

theorem a_date_is_not_an_empty_object (n : Nat) :
    encode (.instant n) ≠ encode (.obj []) := by
  intro h
  cases h

theorem a_date_is_told_from_another {m n : Nat}
    (h : encode (.instant m) = encode (.instant n)) : m = n := by
  injection h

theorem a_field_is_encoded_the_same_way (name : String) (v : Val) :
    encode (.obj [(name, v)]) = .obj [(name, encode v)] := rfl

theorem a_date_under_a_record_is_told_from_another {m n : Nat}
    (h : encode (.obj [("at", .instant m)]) = encode (.obj [("at", .instant n)])) : m = n := by
  injection h with h
  injection h with h _
  injection h with _ h
  injection h

theorem a_scalar_is_not_a_record : encode (.scalar 1) ≠ encode (.obj []) := by
  intro h
  cases h

theorem a_scalar_was_not_a_record_either :
    ignoredToJSON (.scalar 1) ≠ ignoredToJSON (.obj []) := by
  intro h
  cases h

end Canonical
