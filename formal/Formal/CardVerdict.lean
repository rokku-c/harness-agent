namespace CardVerdict

inductive Verdict where
  | approve
  | deny
deriving DecidableEq, Repr

inductive Token where
  | approve
  | deny
  | other
deriving DecidableEq, Repr

def looseVerdict (tokens : List Token) : Option Verdict :=
  if tokens.contains Token.approve then some Verdict.approve
  else if tokens.contains Token.deny then some Verdict.deny
  else none

def strictVerdict (actions : List Verdict) : Option Verdict :=
  match actions.eraseDups with
  | [v] => some v
  | _ => none

theorem a_tool_argument_decides_for_the_operator :
    looseVerdict [Token.deny, Token.approve] = some Verdict.approve := by
  decide

theorem an_argument_alone_reads_as_a_verdict :
    looseVerdict [Token.approve] = some Verdict.approve := by
  decide

theorem a_token_beside_the_argument_does_not_stop_it :
    looseVerdict [Token.other, Token.approve] = some Verdict.approve := by
  decide

theorem two_different_actions_are_refused :
    strictVerdict [Verdict.deny, Verdict.approve] = none := by
  decide

theorem no_action_is_no_verdict : strictVerdict ([] : List Verdict) = none := by
  decide

theorem a_lone_click_is_the_answer : strictVerdict [Verdict.deny] = some Verdict.deny := by
  decide

theorem the_same_click_twice_is_one_verdict :
    strictVerdict [Verdict.deny, Verdict.deny] = some Verdict.deny := by
  decide

end CardVerdict
