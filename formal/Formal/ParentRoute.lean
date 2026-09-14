namespace ParentRoute

inductive Route where
  | home
  | inbox (decision : Option String)
  | activity
  | tools (app : Option String) (operation : Option String)
  | settings (app : Option String)
  | app (id : String)
  | appSettings (id : String)
  | notFound

def parentRoute : Route → Option Route
  | .inbox none => none
  | .inbox (some _) => some (.inbox none)
  | .tools _ none => none
  | .tools app (some _) => some (.tools app none)
  | .settings none => none
  | .settings (some _) => some (.settings none)
  | .appSettings id => some (.app id)
  | _ => none

def depth : Route → Nat
  | .inbox (some _) => 1
  | .tools _ (some _) => 1
  | .settings (some _) => 1
  | .appSettings _ => 1
  | _ => 0


theorem parentRoute_home : parentRoute .home = none := rfl
theorem parentRoute_activity : parentRoute .activity = none := rfl
theorem parentRoute_notFound : parentRoute .notFound = none := rfl
theorem parentRoute_app (id : String) : parentRoute (.app id) = none := rfl
theorem parentRoute_inbox (decision : String) : parentRoute (.inbox (some decision)) = some (.inbox none) := rfl

theorem parentRoute_tools (app : Option String) (operation : String) :
    parentRoute (.tools app (some operation)) = some (.tools app none) := rfl

theorem parentRoute_settings (app : String) : parentRoute (.settings (some app)) = some (.settings none) := rfl

theorem parentRoute_appSettings (id : String) : parentRoute (.appSettings id) = some (.app id) := rfl


theorem parentRoute_depth {r p : Route} (h : parentRoute r = some p) : depth p < depth r := by
  cases r with
  | home => simp [parentRoute] at h
  | activity => simp [parentRoute] at h
  | notFound => simp [parentRoute] at h
  | app id => simp [parentRoute] at h
  | inbox decision =>
    cases decision with
    | none => simp [parentRoute] at h
    | some _ => simp [parentRoute] at h; subst h; simp [depth]
  | tools app operation =>
    cases operation with
    | none => simp [parentRoute] at h
    | some _ => simp [parentRoute] at h; subst h; simp [depth]
  | settings app =>
    cases app with
    | none => simp [parentRoute] at h
    | some _ => simp [parentRoute] at h; subst h; simp [depth]
  | appSettings id => simp [parentRoute] at h; subst h; simp [depth]

theorem parentRoute_not_self (r : Route) : parentRoute r ≠ some r := by
  intro h
  have := parentRoute_depth h
  omega

theorem parentRoute_parent (r : Route) : (parentRoute r).bind parentRoute = none := by
  cases r with
  | home => rfl
  | activity => rfl
  | notFound => rfl
  | app id => rfl
  | inbox decision => cases decision <;> simp [parentRoute]
  | tools app operation => cases operation <;> simp [parentRoute]
  | settings app => cases app <;> simp [parentRoute]
  | appSettings id => simp [parentRoute]

theorem parent_iff_depth (r : Route) : (parentRoute r).isSome = true ↔ depth r = 1 := by
  cases r with
  | home => simp [parentRoute, depth]
  | activity => simp [parentRoute, depth]
  | notFound => simp [parentRoute, depth]
  | app id => simp [parentRoute, depth]
  | inbox decision => cases decision <;> simp [parentRoute, depth]
  | tools app operation => cases operation <;> simp [parentRoute, depth]
  | settings app => cases app <;> simp [parentRoute, depth]
  | appSettings id => simp [parentRoute, depth]

theorem parentRoute_root {r : Route} (h : depth r = 0) : parentRoute r = none := by
  cases r with
  | home => rfl
  | activity => rfl
  | notFound => rfl
  | app id => rfl
  | inbox decision => cases decision with
    | none => rfl
    | some _ => simp [depth] at h
  | tools app operation => cases operation with
    | none => rfl
    | some _ => simp [depth] at h
  | settings app => cases app with
    | none => rfl
    | some _ => simp [depth] at h
  | appSettings id => simp [depth] at h
end ParentRoute
