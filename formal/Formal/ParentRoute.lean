/-
  The parent screen of an address — `apps/effect-server/src/client/console-parent.ts`.

  §6.3's composed `Escape` ends "with no layer open, return to the parent screen",
  and this file is the shell's half of that answer: the four places that have a
  second level. A mounted app's screens are the other half and are not here — a
  view's chain is the view's own fact.

  The claim the file makes is that the parent is the address with one part taken
  off, so pressing it twice is not a second move. That claim has a silent failure
  and a loud one. The loud one is a route whose parent is a level it does not have
  — a press that goes sideways. The silent one is a *cycle*: a parent that leads
  back, so `Escape` is a key that appears to do nothing while it is in fact moving.
  Both are settled by `depth`, and the proof is that every parent is strictly
  shallower (`parentRoute_depth`) and therefore that no route is its own parent
  (`parentRoute_not_self`). A second press has nothing to do
  (`parentRoute_parent`) — the parent of a parent is not a route — which is what
  makes `Escape` on a place's detail land on the place and stop.

  The two readings of "there is a level above" cannot disagree
  (`parent_iff_depth`), the same way `canGoBack` and the browser's back button
  cannot in `Formal/Stack.lean`: a route the key can leave is exactly a route whose
  address has a second part.

  Idealisation: the routes are the addresses the console resolves, and the payload
  each carries beyond what names its parent is dropped — `tools` keeps the app it
  was narrowed to and loses the operation, `settings` loses the app — because that
  is what the file itself does. What is *not* idealised is the default arm: the
  routes with no parent are `none` and not "some busier answer", which is the
  property that keeps `Escape` on Home from guessing.
-/

namespace ParentRoute

/-- An address the shell resolves. Each constructor is one kind of place, carrying
    only the parts a parent is derived from. -/
inductive Route where
  | home
  | inbox (decision : Option String)
  | activity
  | tools (app : Option String) (operation : Option String)
  | settings (app : Option String)
  | app (id : String)
  | appSettings (id : String)
  | notFound

/-- One level up. The address with one part taken off, and `none` where the address
    has no second part — which is a real answer and not a failure. -/
def parentRoute : Route → Option Route
  | .inbox none => none
  | .inbox (some _) => some (.inbox none)
  | .tools _ none => none
  | .tools app (some _) => some (.tools app none)
  | .settings none => none
  | .settings (some _) => some (.settings none)
  | .appSettings id => some (.app id)
  | _ => none

/-- How many levels the address has above the root. Zero or one, because a place
    has a detail and a detail has the place. -/
def depth : Route → Nat
  | .inbox (some _) => 1
  | .tools _ (some _) => 1
  | .settings (some _) => 1
  | .appSettings _ => 1
  | _ => 0

/-! ### What the file says each address does -/

theorem parentRoute_home : parentRoute .home = none := rfl
theorem parentRoute_activity : parentRoute .activity = none := rfl
theorem parentRoute_notFound : parentRoute .notFound = none := rfl
theorem parentRoute_app (id : String) : parentRoute (.app id) = none := rfl
theorem parentRoute_inbox (decision : String) : parentRoute (.inbox (some decision)) = some (.inbox none) := rfl

theorem parentRoute_tools (app : Option String) (operation : String) :
    parentRoute (.tools app (some operation)) = some (.tools app none) := rfl

theorem parentRoute_settings (app : String) : parentRoute (.settings (some app)) = some (.settings none) := rfl

/-- An app's settings screen is a level of the app, and the level above it is the
    app itself. -/
theorem parentRoute_appSettings (id : String) : parentRoute (.appSettings id) = some (.app id) := rfl

/-! ### Why one press is one move -/

/-- Every parent is strictly shallower. This is the whole of "`Escape` cannot
    cycle": whatever a route's parent is, the parent has fewer levels above it
    than the route does. -/
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

/-- So no route is its own parent: there is no address `Escape` returns to without
    having left. A key whose press moved nowhere and one that moved to where it
    already was would look the same to the operator. -/
theorem parentRoute_not_self (r : Route) : parentRoute r ≠ some r := by
  intro h
  have := parentRoute_depth h
  omega

/-- A second press has nothing to do. This is what makes the key land on the place
    and stop rather than walking a chain nobody declared. -/
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

/-- A route with nowhere above it is exactly a route at the root — the same fact
    read from either side, so what the key can leave and what the address says
    about its own depth cannot disagree. -/
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

/-- And the root answers `none` rather than guessing at a destination: Home is
    already the root, and Not found is not a level of anything. -/
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
