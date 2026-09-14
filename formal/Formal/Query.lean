namespace Query

structure Row where
  value : Nat

def page : List Row → Option Nat → List Row
  | rows, none => rows
  | _, some 0 => []
  | [], some (_ + 1) => []
  | r :: rs, some (n + 1) => if rs.length ≤ n then r :: rs else page rs (some (n + 1))

def wasPage (rows : List Row) (limit : Nat) : List Row := rows.take limit

def Suffix (part whole : List Row) : Prop := ∃ front, whole = front ++ part

theorem a_query_with_no_limit_returns_every_row (rows : List Row) : page rows none = rows := by
  cases rows <;> rfl

theorem a_page_is_the_end_of_the_log : ∀ (rows : List Row) (limit : Option Nat), Suffix (page rows limit) rows
  | rows, none => ⟨[], by simp [page]⟩
  | rows, some 0 => ⟨rows, by simp [page]⟩
  | [], some (_ + 1) => ⟨[], rfl⟩
  | r :: rs, some (n + 1) => by
      by_cases fits : rs.length ≤ n
      · refine ⟨[], ?_⟩
        simp [page, fits]
      · obtain ⟨front, hfront⟩ := a_page_is_the_end_of_the_log rs (some (n + 1))
        refine ⟨r :: front, ?_⟩
        rw [show page (r :: rs) (some (n + 1)) = page rs (some (n + 1)) from by simp only [page, if_neg fits]]
        exact congrArg (fun rest => r :: rest) hfront

theorem a_page_holds_no_more_than_was_asked : ∀ (rows : List Row) (limit : Nat), (page rows (some limit)).length ≤ limit
  | _, 0 => by simp [page]
  | [], _ + 1 => by simp [page]
  | r :: rs, n + 1 => by
      by_cases fits : rs.length ≤ n
      · rw [show page (r :: rs) (some (n + 1)) = r :: rs from by simp only [page, if_pos fits]]
        simp only [List.length_cons]
        omega
      · rw [show page (r :: rs) (some (n + 1)) = page rs (some (n + 1)) from by simp only [page, if_neg fits]]
        exact a_page_holds_no_more_than_was_asked rs (n + 1)

theorem a_page_of_rows_that_fit_is_all_of_them : ∀ (rows : List Row) (limit : Nat), rows.length ≤ limit → page rows (some limit) = rows
  | [], limit, _ => by cases limit <;> simp [page]
  | _ :: _, 0, h => by simp only [List.length_cons] at h; omega
  | r :: rs, n + 1, h => by
      have fits : rs.length ≤ n := by simp only [List.length_cons] at h; omega
      simp only [page, if_pos fits]

theorem the_old_rule_answered_with_the_oldest :
    wasPage [⟨1⟩, ⟨2⟩, ⟨3⟩] 1 = [⟨1⟩] ∧ page [⟨1⟩, ⟨2⟩, ⟨3⟩] (some 1) = [⟨3⟩] :=
  ⟨rfl, rfl⟩

end Query
