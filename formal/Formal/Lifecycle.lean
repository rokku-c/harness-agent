namespace EffectHost

structure Reg where
  id : String
  gen : Nat
deriving DecidableEq, Repr

abbrev Registry := String → Option Reg

def set (r : Reg) (reg : Registry) : Registry :=
  fun id => if id = r.id then some r else reg id

def eraseId (a : String) (reg : Registry) : Registry :=
  fun id => if id = a then none else reg id

def dispose (r : Reg) (reg : Registry) : Registry :=
  fun id => if id = r.id then (if reg id = some r then none else reg id) else reg id

def disposeById (a : String) (reg : Registry) : Registry := eraseId a reg


theorem dispose_set (r : Reg) (reg : Registry) : dispose r (set r reg) = eraseId r.id reg := by
  funext id
  by_cases h : id = r.id
  · subst h; simp [dispose, eraseId, set]
  · simp [dispose, eraseId, set, h]

theorem dispose_set_gone (r : Reg) (reg : Registry) : dispose r (set r reg) r.id = none := by
  rw [dispose_set]; simp [eraseId]

theorem dispose_set_restores (r : Reg) (reg : Registry) (h : reg r.id = none) :
    dispose r (set r reg) = reg := by
  rw [dispose_set]
  funext id
  by_cases hid : id = r.id
  · subst hid; simp [eraseId, h]
  · simp [eraseId, hid]

theorem dispose_idempotent (r : Reg) (reg : Registry) : dispose r (dispose r reg) = dispose r reg := by
  funext id
  by_cases h : id = r.id
  · subst h; simp [dispose]
  · simp [dispose, h]

theorem dispose_commutes {r₁ r₂ : Reg} (h : r₁.id ≠ r₂.id) (reg : Registry) :
    dispose r₁ (set r₂ reg) = set r₂ (dispose r₁ reg) := by
  funext id
  by_cases h₁ : id = r₁.id
  · have h₂ : ¬(id = r₂.id) := fun hh => h (by rw [← h₁]; exact hh)
    subst h₁; simp [dispose, set, h₂]
  · by_cases h₂ : id = r₂.id
    · subst h₂; simp [dispose, set, h₁]
    · simp [dispose, set, h₁, h₂]


def reload (reg : Registry) (r : Reg) : Registry := set r reg

theorem stale_disposer_spares_the_new_one {old fresh : Reg} (hid : old.id = fresh.id)
    (hne : old ≠ fresh) (reg : Registry) : dispose old (reload reg fresh) old.id = some fresh := by
  have hheld : (reload reg fresh) old.id = some fresh := by simp [reload, set, hid]
  have hnot : ¬(some fresh = some old) := fun he => hne (Option.some.inj he).symm
  rw [dispose, if_pos rfl, hheld, if_neg hnot]

theorem stale_disposer_takes_the_new_one {old fresh : Reg} (hid : old.id = fresh.id)
    (reg : Registry) : disposeById old.id (reload reg fresh) fresh.id = none := by
  simp [disposeById, eraseId, hid]

end EffectHost
