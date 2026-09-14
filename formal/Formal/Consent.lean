namespace Agentdeck

inductive Decision where
  | pending
  | allow
  | deny
deriving DecidableEq, Repr

structure Entry where
  decision : Decision
deriving DecidableEq, Repr

inductive Verdict where
  | approve
  | reject
deriving DecidableEq, Repr

def verdictDecision : Verdict → Decision
  | Verdict.approve => Decision.allow
  | Verdict.reject => Decision.deny

def resolve (e : Entry) (v : Verdict) : Entry × Bool :=
  match e.decision with
  | Decision.pending => ({ decision := verdictDecision v }, true)
  | _ => (e, false)

def ask (auto : Bool) : Entry :=
  { decision := if auto then Decision.allow else Decision.pending }

def executes (e : Entry) : Bool := e.decision == Decision.allow


theorem resolve_reports_whether_it_moved (e : Entry) (v : Verdict) :
    (resolve e v).2 = true ↔ e.decision = Decision.pending := by
  cases e with
  | mk d => cases d <;> cases v <;> simp [resolve]

theorem a_first_decision_stands (e : Entry) (v v' : Verdict) :
    (resolve (resolve e v).1 v').1 = (resolve e v).1 := by
  cases e with
  | mk d => cases d <;> cases v <;> cases v' <;> simp [resolve, verdictDecision]

theorem a_decided_ask_is_never_pending_again (e : Entry) (v : Verdict) :
    (resolve e v).1.decision ≠ Decision.pending := by
  cases e with
  | mk d => cases d <;> cases v <;> simp [resolve, verdictDecision]

theorem a_refused_answer_changes_nothing (e : Entry) (v : Verdict)
    (h : (resolve e v).2 = false) : (resolve e v).1 = e := by
  cases e with
  | mk d => cases d <;> cases v <;> simp_all [resolve]


theorem nothing_runs_without_an_allow (e : Entry) :
    executes e = true ↔ e.decision = Decision.allow := by
  cases e with
  | mk d => cases d <;> simp [executes]

theorem an_unanswered_ask_never_runs : executes (ask false) = false := by
  simp [executes, ask]

theorem an_auto_approved_write_needs_no_operator : executes (ask true) = true := by
  simp [executes, ask]

theorem the_operator_decides_whether_a_write_runs (v : Verdict) :
    executes (resolve (ask false) v).1 = true ↔ v = Verdict.approve := by
  rw [nothing_runs_without_an_allow]
  cases v <;> simp [ask, resolve, verdictDecision]

end Agentdeck
