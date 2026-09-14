namespace EffectHost

structure Plane where
  id : String
  priority : Nat
  enabled : Bool
  loaded : Bool
  claims : Option (List String)
  owns : Option String

def answers (plane : Plane) (path : String) : Bool :=
  if plane.enabled && plane.loaded then
    match plane.claims with
    | some claims => claims.any fun claim => claim = path
    | none => plane.owns == some path
  else false

theorem a_disabled_plane_answers_nothing (plane : Plane) (path : String)
    (off : plane.enabled = false) : answers plane path = false := by
  simp [answers, off]

theorem an_unloaded_plane_answers_nothing (plane : Plane) (path : String)
    (absent : plane.loaded = false) : answers plane path = false := by
  simp [answers, absent]

theorem declaring_routes_replaces_what_the_plane_claims (plane : Plane) (claims : List String)
    (declared : plane.claims = some claims) (path : String) (other : Option String) :
    answers plane path = answers { plane with owns := other } path := by
  simp [answers, declared]

theorem an_empty_route_list_claims_nothing (plane : Plane) (path : String)
    (empty : plane.claims = some []) (on : plane.enabled = true) (up : plane.loaded = true) :
    answers plane path = false := by
  simp [answers, empty, on, up]

def answersUnion (plane : Plane) (path : String) : Bool :=
  if plane.enabled && plane.loaded then
    (match plane.claims with
     | some claims => claims.any fun claim => claim = path
     | none => false) || (plane.owns == some path)
  else false

theorem reading_routes_as_a_union_revives_a_silenced_plane :
    answers { id := "mirror", priority := 14, enabled := true, loaded := true,
              claims := some [], owns := some "/-/mirror" } "/-/mirror" = false ∧
    answersUnion { id := "mirror", priority := 14, enabled := true, loaded := true,
                   claims := some [], owns := some "/-/mirror" } "/-/mirror" = true := by
  decide

def dispatch (planes : List Plane) (path : String) : Option String :=
  match planes with
  | [] => none
  | plane :: rest => if answers plane path then some plane.id else dispatch rest path

theorem the_first_plane_that_answers_answers (plane : Plane) (rest : List Plane) (path : String)
    (here : answers plane path = true) : dispatch (plane :: rest) path = some plane.id := by
  simp [dispatch, here]

theorem a_plane_behind_one_that_answers_is_never_consulted (plane : Plane) (rest : List Plane)
    (path : String) (here : answers plane path = true) :
    dispatch (plane :: rest) path = dispatch [plane] path := by
  simp [dispatch, here]

theorem a_plane_that_claims_nothing_is_passed_over (plane : Plane) (rest : List Plane)
    (path : String) (silent : answers plane path = false) : dispatch (plane :: rest) path = dispatch rest path := by
  simp [dispatch, silent]

theorem nothing_answers_a_request_no_plane_claims (path : String) : dispatch [] path = none := rfl

end EffectHost
