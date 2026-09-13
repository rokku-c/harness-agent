/-
  The approval card's VERDICT — `apps/mantis/src/hosts/dingtalk/card/callback.ts`.

  A card travels out to the operator carrying the protected tool's own arguments
  (`approvalCardParamMap` puts `input` in the card data), and the click comes
  back over dingtalk-stream as a payload the parser walks. The reading the file
  had collected *every* string token in that payload and asked for "approve"
  first, so a call whose argument happened to contain the word decided its own
  approval — and a payload carrying both tokens read as the permissive one.

  The reading now takes candidates from fields named `action` only, and refuses
  when they name two different things. Both readings are total functions of what
  the payload says, which is what makes the pair of `decide`d facts below the
  whole argument: the same payload, and the two answers it used to have.
-/

namespace CardVerdict

/-- The verdict a button names. -/
inductive Verdict where
  | approve
  | deny
deriving DecidableEq, Repr

/-- A string met in the payload, as far as this mechanism cares: the two button
    tokens, and everything else. -/
inductive Token where
  | approve
  | deny
  | other
deriving DecidableEq, Repr

/-- The reading as the file had it: any token anywhere decides, approve first. -/
def looseVerdict (tokens : List Token) : Option Verdict :=
  if tokens.contains Token.approve then some Verdict.approve
  else if tokens.contains Token.deny then some Verdict.deny
  else none

/-- The reading now: only the values under fields named `action` count, and two
    different ones are no verdict at all. -/
def strictVerdict (actions : List Verdict) : Option Verdict :=
  match actions.eraseDups with
  | [v] => some v
  | _ => none

/--
The bug: the payload holds the button the operator clicked *and* the argument
the tool was called with, and the argument's token is read as the answer.
-/
theorem a_tool_argument_decides_for_the_operator :
    looseVerdict [Token.deny, Token.approve] = some Verdict.approve := by
  decide

/-- And the argument needs no click at all to be read as one. -/
theorem an_argument_alone_reads_as_a_verdict :
    looseVerdict [Token.approve] = some Verdict.approve := by
  decide

/-- Nor is the ordering that saves it: a token beside the argument does not
    stop it being found, because the search is for any token anywhere. -/
theorem a_token_beside_the_argument_does_not_stop_it :
    looseVerdict [Token.other, Token.approve] = some Verdict.approve := by
  decide

/--
The fix: two fields naming two different verdicts are no verdict, so a payload
carrying an injected token beside the real click is refused rather than obeyed.
-/
theorem two_different_actions_are_refused :
    strictVerdict [Verdict.deny, Verdict.approve] = none := by
  decide

/-- A payload naming no action at all names no verdict, whatever else it holds. -/
theorem no_action_is_no_verdict : strictVerdict ([] : List Verdict) = none := by
  decide

/-- The operator's own click is still the answer. -/
theorem a_lone_click_is_the_answer : strictVerdict [Verdict.deny] = some Verdict.deny := by
  decide

/-- And repeating it changes nothing, so a client that echoes the button twice
    is not read as a conflict. -/
theorem the_same_click_twice_is_one_verdict :
    strictVerdict [Verdict.deny, Verdict.deny] = some Verdict.deny := by
  decide

end CardVerdict
