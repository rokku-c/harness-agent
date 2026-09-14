import Formal.Screen

namespace EffectUi

theorem nodup_reverse {α : Type} {l : List α} (h : l.Nodup) : l.reverse.Nodup := by
  induction l with
  | nil => exact List.nodup_nil
  | cons a t ih =>
    rw [List.nodup_cons] at h
    obtain ⟨hat, ht⟩ := h
    rw [List.reverse_cons, List.nodup_append]
    refine ⟨ih ht, by simp, ?_⟩
    intro x hx y hy hxy
    rw [List.mem_singleton] at hy
    rw [hy] at hxy
    exact hat (hxy ▸ List.mem_reverse.mp hx)

theorem eq_of_id_eq : ∀ (l : List Screen) (a b : Screen),
    (ids l).Nodup → a ∈ l → b ∈ l → a.id = b.id → a = b
  | [], a, b, _, ha, _, _ => by simp at ha
  | c :: t, a, b, h, ha, hb, hid => by
    simp only [ids, List.map_cons, List.nodup_cons] at h
    obtain ⟨hnotin, hnodup⟩ := h
    rcases List.mem_cons.mp ha with rfl | ha'
    · rcases List.mem_cons.mp hb with rfl | hb'
      · rfl
      · exact absurd (List.mem_map.mpr ⟨b, hb', hid.symm⟩) hnotin
    · rcases List.mem_cons.mp hb with rfl | hb'
      · exact absurd (List.mem_map.mpr ⟨a, ha', hid⟩) hnotin
      · exact eq_of_id_eq t a b hnodup ha' hb' hid

theorem nodup_of_ids_nodup : ∀ (l : List Screen), (ids l).Nodup → l.Nodup
  | [], _ => List.nodup_nil
  | c :: t, h => by
    simp only [ids, List.map_cons, List.nodup_cons] at h
    obtain ⟨hnotin, hnodup⟩ := h
    exact List.nodup_cons.mpr
      ⟨fun hc => hnotin (List.mem_map.mpr ⟨c, hc, rfl⟩), nodup_of_ids_nodup t hnodup⟩

theorem not_mem_erase_self_of_nodup : ∀ (l : List Screen) (a : Screen),
    l.Nodup → a ∈ l → a ∉ l.erase a
  | [], a, _, ha => by simp at ha
  | c :: t, a, h, ha => by
    rw [List.nodup_cons] at h
    obtain ⟨hct, ht⟩ := h
    rcases List.mem_cons.mp ha with rfl | hat
    · rw [List.erase_cons_head]
      exact hct
    · have hne : ¬(c == a) = true := fun hbeq => hct ((beq_iff_eq.mp hbeq) ▸ hat)
      rw [List.erase_cons_tail hne]
      intro hmem
      rcases List.mem_cons.mp hmem with hac | hat'
      · exact hct (hac ▸ hat)
      · exact not_mem_erase_self_of_nodup t a ht hat hat'

theorem walk_nodup : ∀ (l : List Screen) (c : String), (ids l).Nodup → (walk l c).Nodup := by
  intro l c
  refine walk.induct (motive := fun l c => (ids l).Nodup → (walk l c).Nodup) ?_ ?_ ?_ l c
  · intro l c hf _
    rw [walk_eq_nil hf]
    exact List.nodup_nil
  · intro l c t hf hn _
    rw [walk_eq_singleton hf hn]
    exact List.nodup_cons.mpr ⟨by simp, List.nodup_nil⟩
  · intro l c t hf c' hc ih h
    have ht : t ∈ l := List.mem_of_find?_eq_some hf
    have hclean : (ids (l.erase t)).Nodup := by
      have hsub : List.Sublist ((l.erase t).map (fun x : Screen => x.id))
          (l.map (fun x : Screen => x.id)) :=
        List.Sublist.map (fun x : Screen => x.id) List.erase_sublist
      exact List.Nodup.sublist hsub (by simpa only [ids] using h)
    rw [walk_eq_cons hf hc]
    refine List.nodup_cons.mpr ⟨?_, ih hclean⟩
    intro ht_mem
    exact not_mem_erase_self_of_nodup l t (nodup_of_ids_nodup l h) ht
      (mem_walk (l.erase t) c' t ht_mem)

theorem walk_ids_nodup : ∀ (l : List Screen) (c : String), (ids l).Nodup → (ids (walk l c)).Nodup := by
  intro l c
  refine walk.induct (motive := fun l c => (ids l).Nodup → (ids (walk l c)).Nodup) ?_ ?_ ?_ l c
  · intro l c hf _
    rw [walk_eq_nil hf]
    exact List.nodup_nil
  · intro l c t hf hn _
    rw [walk_eq_singleton hf hn]
    exact List.nodup_cons.mpr ⟨by simp, List.nodup_nil⟩
  · intro l c t hf c' hc ih h
    have ht : t ∈ l := List.mem_of_find?_eq_some hf
    have hclean : (ids (l.erase t)).Nodup := by
      have hsub : List.Sublist ((l.erase t).map (fun x : Screen => x.id))
          (l.map (fun x : Screen => x.id)) :=
        List.Sublist.map (fun x : Screen => x.id) List.erase_sublist
      exact List.Nodup.sublist hsub (by simpa only [ids] using h)
    rw [walk_eq_cons hf hc]
    simp only [ids, List.map_cons, List.nodup_cons]
    refine ⟨?_, ih hclean⟩
    intro hid
    obtain ⟨u, hu_mem, hu_id⟩ := List.mem_map.mp hid
    have hu : u ∈ l := List.mem_of_mem_erase (mem_walk (l.erase t) c' u hu_mem)
    have hut : u = t := eq_of_id_eq l u t h hu ht (by rw [hu_id, walk_found_id hf])
    exact not_mem_erase_self_of_nodup l t (nodup_of_ids_nodup l h) ht
      (hut ▸ mem_walk (l.erase t) c' u hu_mem)

theorem chainOf_nodup {screens : List Screen} {id : String} (h : (ids screens).Nodup) :
    (chainOf screens id).Nodup := by
  have hw : (walk screens id).Nodup := walk_nodup screens id h
  rw [chainOf]
  exact nodup_reverse hw

theorem chainOf_ids_nodup {screens : List Screen} {id : String} (h : (ids screens).Nodup) :
    (ids (chainOf screens id)).Nodup := by
  have hw : (ids (walk screens id)).Nodup := walk_ids_nodup screens id h
  rw [chainOf, ids, List.map_reverse]
  exact nodup_reverse (by simpa only [ids] using hw)

end EffectUi
