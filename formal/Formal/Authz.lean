/-
  The verdict algebra — `packages/effect-authz/src/decide.ts`.

  Entries arrive from three independent sources (a kind template, a consented
  grant, an operator revoke) and nothing orders them against each other, so the
  resolver cannot be allowed to read the list left to right and stop at the
  first thing it likes. What `decide.ts` actually computes is a *set* overlay —
  any explicit deny, else any allow, else default deny — and the file says so.

  So that is what this proves. `resolve` is the resolver as written: scan the
  matching effects, deny wins wherever it appears, an allow counts only when no
  deny is present, and no match at all is a deny. The three characterisations
  below say what each verdict means in terms of the entry *set*, and
  `resolve_perm` is the consequence the design needs: the order entries arrive
  in cannot change the answer. `resolve_congr` states it more directly still —
  two lists that match the same effects decide the same way.

  Matching itself (`entryCovers`: subject pattern, action membership, resource
  coverage) is left out on purpose. Order-freedom is a claim about the verdict
  algebra, not about which entries matched; a proof that depended on `covers`
  would be a proof about `covers`.

  The closing section is the projection: `visibleResources` filters candidates
  through `decide` itself, so "not visible ⇒ not callable" is composition
  rather than convention — `visible_is_decide` is the whole of it, which is the
  point. There is no second opinion about a resource to drift.
-/

namespace EffectAuthz

/-- What an entry says: it permits, or it forbids. -/
inductive Effect where
  | allow
  | deny
deriving DecidableEq, Repr

/-- The verdict, plus the case where nothing matched. -/
inductive Verdict where
  | allow
  | deny
  | default
deriving DecidableEq, Repr

/-- The resolver, over the effects of the entries that matched. Deny wins at once
and an allow is returned only after the rest of the list is known not to hold
one — which is `find`-deny-else-`find`-allow, read as a recursion. -/
def resolve : List Effect → Verdict
  | [] => Verdict.default
  | Effect.deny :: _ => Verdict.deny
  | Effect.allow :: rest =>
    match resolve rest with
    | Verdict.deny => Verdict.deny
    | Verdict.allow => Verdict.allow
    | Verdict.default => Verdict.allow

/-- A deny wins wherever it sits. -/
theorem resolve_deny_iff (es : List Effect) : resolve es = Verdict.deny ↔ Effect.deny ∈ es := by
  induction es with
  | nil => simp [resolve]
  | cons e rest ih =>
    cases e with
    | deny => simp [resolve]
    | allow => rw [resolve]; split <;> simp_all

/-- An allow is the verdict for a list with no deny in it and an allow in it. -/
theorem resolve_allow_iff (es : List Effect) :
    resolve es = Verdict.allow ↔ (Effect.deny ∉ es ∧ Effect.allow ∈ es) := by
  induction es with
  | nil => simp [resolve]
  | cons e rest ih =>
    cases e with
    | deny => simp [resolve]
    | allow =>
      -- The head's own allow is not the answer: the rest of the list decides,
      -- and it answers allow exactly when it holds no deny.
      have hiff : resolve (Effect.allow :: rest) = Verdict.allow ↔ resolve rest ≠ Verdict.deny := by
        rw [resolve]; split <;> simp_all
      rw [hiff, ne_eq, not_congr (resolve_deny_iff rest)]
      simp

/-- The default is the verdict for a list that matched nothing — and for nothing
else. A list this resolver has seen the head of never defaults. -/
theorem resolve_default_iff (es : List Effect) :
    resolve es = Verdict.default ↔ (Effect.deny ∉ es ∧ Effect.allow ∉ es) := by
  induction es with
  | nil => simp [resolve]
  | cons e rest _ih =>
    cases e with
    | deny => simp [resolve]
    | allow =>
      -- An allow at the head is answered by the rest of the list, never by the
      -- default: the verdict is deny or allow, and "no allow here" is false.
      have hne : resolve (Effect.allow :: rest) ≠ Verdict.default := by
        rw [resolve]; split <;> simp
      exact ⟨fun h => absurd h hne, fun h => by simp at h⟩

/-! ### Order-freedom -/

/-- The verdict is a function of which effects matched, not of where they were. -/
theorem resolve_congr {es es' : List Effect} (h : ∀ e, e ∈ es ↔ e ∈ es') : resolve es = resolve es' := by
  have hd := h Effect.deny
  have ha := h Effect.allow
  by_cases h1 : Effect.deny ∈ es
  · rw [(resolve_deny_iff es).mpr h1, (resolve_deny_iff es').mpr (hd.mp h1)]
  · by_cases h2 : Effect.allow ∈ es
    · rw [(resolve_allow_iff es).mpr ⟨h1, h2⟩,
          (resolve_allow_iff es').mpr ⟨fun hh => h1 (hd.mpr hh), ha.mp h2⟩]
    · rw [(resolve_default_iff es).mpr ⟨h1, h2⟩,
          (resolve_default_iff es').mpr ⟨fun hh => h1 (hd.mpr hh), fun hh => h2 (ha.mpr hh)⟩]

/-- Reordering the entries cannot change the verdict — the property that lets
three independent sources contribute to one list with no global order. -/
theorem resolve_perm {es es' : List Effect} (h : es.Perm es') : resolve es = resolve es' :=
  resolve_congr (fun _ => h.mem_iff)

/-! ### The three verdicts, named -/

theorem deny_overrides {es : List Effect} (h : Effect.deny ∈ es) : resolve es = Verdict.deny :=
  (resolve_deny_iff es).mpr h

theorem allow_when_no_deny {es : List Effect} (hd : Effect.deny ∉ es) (ha : Effect.allow ∈ es) :
    resolve es = Verdict.allow := (resolve_allow_iff es).mpr ⟨hd, ha⟩

/-- Nothing matched, so the answer is no. Silence is not consent. -/
theorem default_deny {es : List Effect} (hd : Effect.deny ∉ es) (ha : Effect.allow ∉ es) :
    resolve es = Verdict.default := (resolve_default_iff es).mpr ⟨hd, ha⟩

/-! ### Not visible is not callable -/

/-- The projection is the decision, applied as a filter. A resource that is not
in the projected list is one `decide` did not allow — there is no second check
to disagree with this one, because there is no second check. -/
theorem visible_is_decide {α : Type} (allowed : α → Bool) (candidates : List α) (a : α) :
    a ∈ candidates.filter allowed ↔ a ∈ candidates ∧ allowed a = true :=
  List.mem_filter

end EffectAuthz
