/-
  The consent ledger — `packages/agentdeck/src/consent.ts`, and the two ends of
  it in `adapters/effect-ops.ts`.

  A write op does not simply run. It raises an ask, the turn dies with the
  ask's id, and the operator answers; re-sending the same turn then either runs
  the write or dies again. The whole of the mechanism is the decision on one
  entry: `pending` until something answers it, then `allow` or `deny`, and the
  driver executes on `allow` alone.

  What is worth stating is what `resolve` refuses to do. It answers `false` for
  an entry that is no longer pending and changes nothing — so the first answer
  is the answer, and a second one (a double click, a stale card, a retry after
  the fact) cannot turn a denial into an approval. The file returns that boolean
  and a caller may ignore it, which is exactly why the property belongs in the
  ledger rather than in whoever is drawing the button: the refusal is not
  advice, it is what happened.

  `the_operator_decides_whether_a_write_runs` is the mechanism in one equation
  — for an ask nothing auto-approved, the write runs exactly when the operator
  approved it — and `an_auto_approved_write_needs_no_operator` is the other
  side of that policy: a tool on the auto list never waits, so a driver that
  waits for an answer can never wait forever.

  Modelling note: the ledger's storage is left out — ids, timestamps, `by`, and
  the reverse-chronological listing. Those are bookkeeping about an entry, and
  none of them can move its decision. What is modelled is one entry and the two
  transitions that touch it.
-/

namespace Agentdeck

/-- One ask's state. `pending` is the only state an operator still has a say in. -/
inductive Decision where
  | pending
  | allow
  | deny
deriving DecidableEq, Repr

/-- A ledger entry, of which `decision` is the whole of what the mechanism reads. -/
structure Entry where
  decision : Decision
deriving DecidableEq, Repr

/-- What an operator can answer. There is no "unanswer". -/
inductive Verdict where
  | approve
  | reject
deriving DecidableEq, Repr

def verdictDecision : Verdict → Decision
  | Verdict.approve => Decision.allow
  | Verdict.reject => Decision.deny

/-- Answer an ask. The boolean is whether it moved: a non-pending entry comes
back untouched, so a later answer cannot overwrite an earlier one. -/
def resolve (e : Entry) (v : Verdict) : Entry × Bool :=
  match e.decision with
  | Decision.pending => ({ decision := verdictDecision v }, true)
  | _ => (e, false)

/-- An ask, under the auto-approve list. A tool on it is decided at ask time and
is never pending — the point of the list is that nobody has to be watching. -/
def ask (auto : Bool) : Entry :=
  { decision := if auto then Decision.allow else Decision.pending }

/-- What the driver does with an entry: run the write, or die carrying the ask.
Only `allow` runs. -/
def executes (e : Entry) : Bool := e.decision == Decision.allow

/-! ### What `resolve` refuses -/

/-- The answer says whether it moved, and it moved exactly when the ask was
still open. A caller that renders "decided" without reading this is rendering
its own assumption. -/
theorem resolve_reports_whether_it_moved (e : Entry) (v : Verdict) :
    (resolve e v).2 = true ↔ e.decision = Decision.pending := by
  cases e with
  | mk d => cases d <;> cases v <;> simp [resolve]

/-- The first answer is the answer: whatever anyone says afterwards, the entry
keeps what it was first told. This is what a stale approval card cannot do. -/
theorem a_first_decision_stands (e : Entry) (v v' : Verdict) :
    (resolve (resolve e v).1 v').1 = (resolve e v).1 := by
  cases e with
  | mk d => cases d <;> cases v <;> cases v' <;> simp [resolve, verdictDecision]

/-- And nothing walks back into `pending`: an answered ask cannot be reopened,
so there is no way to make the operator answer twice for one call. -/
theorem a_decided_ask_is_never_pending_again (e : Entry) (v : Verdict) :
    (resolve e v).1.decision ≠ Decision.pending := by
  cases e with
  | mk d => cases d <;> cases v <;> simp [resolve, verdictDecision]

/-- A refused answer is a no-op, stated as the identity it is. -/
theorem a_refused_answer_changes_nothing (e : Entry) (v : Verdict)
    (h : (resolve e v).2 = false) : (resolve e v).1 = e := by
  cases e with
  | mk d => cases d <;> cases v <;> simp_all [resolve]

/-! ### What runs -/

/-- Only an allow runs. Read the other way: a pending ask and a denied one both
reach the driver as a dead turn, never as a write. -/
theorem nothing_runs_without_an_allow (e : Entry) :
    executes e = true ↔ e.decision = Decision.allow := by
  cases e with
  | mk d => cases d <;> simp [executes]

/-- An unanswered ask does not run — it dies carrying its id, which is the
`DECK_AWAIT:` the driver parses back off the failed turn. -/
theorem an_unanswered_ask_never_runs : executes (ask false) = false := by
  simp [executes, ask]

/-- A tool on the auto-approve list is never pending, and so never waits. -/
theorem an_auto_approved_write_needs_no_operator : executes (ask true) = true := by
  simp [executes, ask]

/-- The mechanism in one equation: for an ask nothing auto-approved, the write
runs exactly when the operator approved it. Denial, no answer, and a second
answer after either are all the same outcome — the write does not run. -/
theorem the_operator_decides_whether_a_write_runs (v : Verdict) :
    executes (resolve (ask false) v).1 = true ↔ v = Verdict.approve := by
  rw [nothing_runs_without_an_allow]
  cases v <;> simp [ask, resolve, verdictDecision]

end Agentdeck
