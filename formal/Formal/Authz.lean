namespace EffectAuthz

inductive Effect where
  | allow
  | deny
deriving DecidableEq, Repr

inductive Verdict where
  | allow
  | deny
  | default
deriving DecidableEq, Repr

def resolve : List Effect → Verdict
  | [] => Verdict.default
  | Effect.deny :: _ => Verdict.deny
  | Effect.allow :: rest =>
    match resolve rest with
    | Verdict.deny => Verdict.deny
    | Verdict.allow => Verdict.allow
    | Verdict.default => Verdict.allow

theorem resolve_deny_iff (es : List Effect) : resolve es = Verdict.deny ↔ Effect.deny ∈ es := by
  induction es with
  | nil => simp [resolve]
  | cons e rest ih =>
    cases e with
    | deny => simp [resolve]
    | allow => rw [resolve]; split <;> simp_all

theorem resolve_allow_iff (es : List Effect) :
    resolve es = Verdict.allow ↔ (Effect.deny ∉ es ∧ Effect.allow ∈ es) := by
  induction es with
  | nil => simp [resolve]
  | cons e rest ih =>
    cases e with
    | deny => simp [resolve]
    | allow =>
      have hiff : resolve (Effect.allow :: rest) = Verdict.allow ↔ resolve rest ≠ Verdict.deny := by
        rw [resolve]; split <;> simp_all
      rw [hiff, ne_eq, not_congr (resolve_deny_iff rest)]
      simp

theorem resolve_default_iff (es : List Effect) :
    resolve es = Verdict.default ↔ (Effect.deny ∉ es ∧ Effect.allow ∉ es) := by
  induction es with
  | nil => simp [resolve]
  | cons e rest _ih =>
    cases e with
    | deny => simp [resolve]
    | allow =>
      have hne : resolve (Effect.allow :: rest) ≠ Verdict.default := by
        rw [resolve]; split <;> simp
      exact ⟨fun h => absurd h hne, fun h => by simp at h⟩


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

theorem resolve_perm {es es' : List Effect} (h : es.Perm es') : resolve es = resolve es' :=
  resolve_congr (fun _ => h.mem_iff)


theorem deny_overrides {es : List Effect} (h : Effect.deny ∈ es) : resolve es = Verdict.deny :=
  (resolve_deny_iff es).mpr h

theorem allow_when_no_deny {es : List Effect} (hd : Effect.deny ∉ es) (ha : Effect.allow ∈ es) :
    resolve es = Verdict.allow := (resolve_allow_iff es).mpr ⟨hd, ha⟩

theorem default_deny {es : List Effect} (hd : Effect.deny ∉ es) (ha : Effect.allow ∉ es) :
    resolve es = Verdict.default := (resolve_default_iff es).mpr ⟨hd, ha⟩


theorem visible_is_decide {α : Type} (allowed : α → Bool) (candidates : List α) (a : α) :
    a ∈ candidates.filter allowed ↔ a ∈ candidates ∧ allowed a = true :=
  List.mem_filter

end EffectAuthz
