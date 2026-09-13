/-
  WHAT A PAGE IS — the rule `packages/state/src/store/memory.ts` and
  `packages/storage-typeorm/src/store.ts` both implement for `QuerySpec.limit`.

  A caller that asks a store for rows of a type gets a page, and the store chose
  the page: a hundred rows, taken from the front, and nothing said so. So
  `checkpoint.list()` — read, by its own protocol, as "the checkpoints" —
  answered with the first hundred ever written; `memory.entries` the same; and
  the gateway's audit, whose page is titled "the fifty most recent events",
  showed events fifty-one to a hundred of all time. That is a window that stops
  moving: the hundred-and-first event the gateway carried was not in it, nor any
  event after that, while the figure printed beside it as "what it has carried"
  went on being counted over the same frozen hundred.

  A bound the caller cannot see is a wrong answer, so the bound becomes the
  caller's: no limit is every row, and a limit is the newest that many. The page
  is then the end of what an unbounded query would have returned — a reader of a
  page reads the end of the log it asked to read, and reads it in the order the
  log is written in, so a page is a suffix and never a sample.

  Modelling note: `rows` is the store's own order, which is what the durable
  store's `createdAt ASC` produces, so the newest rows are the last ones and no
  clock enters the model. The rows carry a value only so that the control can
  name the row the old rule answered with.
-/

namespace Query

/-- A row as the store holds it: what was written, and where it sits in the
    store's order. -/
structure Row where
  value : Nat

/-- The page a query returns: every row when the caller stated no limit, and the
    newest `limit` of them when it did. Drops from the front while more than
    `limit` rows remain, which is what makes the result the end of the log by
    construction rather than by arithmetic. -/
def page : List Row → Option Nat → List Row
  | rows, none => rows
  | _, some 0 => []
  | [], some (_ + 1) => []
  | r :: rs, some (n + 1) => if rs.length ≤ n then r :: rs else page rs (some (n + 1))

/-- The rule the store had: a hundred rows, taken from the front. -/
def wasPage (rows : List Row) (limit : Nat) : List Row := rows.take limit

/-- One list is the end of another. -/
def Suffix (part whole : List Row) : Prop := ∃ front, whole = front ++ part

/-- Asking for everything is asking for everything: no default stands between the
    caller and the rows it asked for. -/
theorem a_query_with_no_limit_returns_every_row (rows : List Row) : page rows none = rows := by
  cases rows <;> rfl

/-- A page is the end of the log. Nothing was skipped over to reach it: what came
    back is the tail of what an unbounded query would have returned, so a reader
    of a page has read the last rows written and not a sample of them. -/
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

/-- And it is no longer than it was asked to be. -/
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

/-- A store that fits inside the page is the page: the bound only ever bites when
    there is something beyond it to leave out. -/
theorem a_page_of_rows_that_fit_is_all_of_them : ∀ (rows : List Row) (limit : Nat), rows.length ≤ limit → page rows (some limit) = rows
  | [], limit, _ => by cases limit <;> simp [page]
  | _ :: _, 0, h => by simp only [List.length_cons] at h; omega
  | r :: rs, n + 1, h => by
      have fits : rs.length ≤ n := by simp only [List.length_cons] at h; omega
      simp only [page, if_pos fits]

/-- The control, and the bug in one line: three rows, a page of one. The old rule
    answered with the row that had been there longest; the new one answers with
    the row that had just arrived — so the page the audit called "the most
    recent" was the page that would never move again. -/
theorem the_old_rule_answered_with_the_oldest :
    wasPage [⟨1⟩, ⟨2⟩, ⟨3⟩] 1 = [⟨1⟩] ∧ page [⟨1⟩, ⟨2⟩, ⟨3⟩] (some 1) = [⟨3⟩] :=
  ⟨rfl, rfl⟩

end Query
