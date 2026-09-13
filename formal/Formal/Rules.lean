/-
  Which rule decides a call — `packages/mcp-gateway/src/rules.ts`.

  Two lines of the file are stated as facts, and they are the whole of its
  policy: *First matching rule wins; rules earlier in the list take precedence*,
  and a context no rule applies is answered by the fallback. Both are silent when
  misread, and the misreadings are the ones a reader brings with them.

  **Order decides, not specificity** —
  `an_earlier_matching_rule_takes_the_call_from_a_later_one`, and what it costs:
  `an_unconstrained_rule_above_a_deny_lets_the_call_through`. The search stops at
  the first rule that matches, not at the first that *denies*, so an allow rule
  above a deny rule is a hole in it. `effect-authz`'s `decide.ts` is the opposite
  engine — deny-overrides — and names this one in as many words; the two are one
  import apart, so the difference is worth a proof rather than a comment.

  **A field left out is unconstrained, not required to be absent** —
  `a_rule_that_names_one_field_leaves_the_others_open`, against
  `reading_a_constraint_as_an_exact_description_covers_nothing`. Reading the bag as
  an exact description gives a rule that covers nothing it was written for, which
  is the shape `Formal/Match.lean`'s depth pin has: a constraint that reaches
  somewhere other than where its author pictured. A rule with no bag at all
  applies everything, so it reaches furthest of all —
  `an_unconstrained_rule_matches_every_call`.

  **No rule is not no answer** — `a_gateway_with_no_rules_allows_every_call`: the
  fallback is what an uncovered context gets, and both fallbacks the file writes —
  `decideAction`'s and `makeMcpGateway`'s — are `allow`. A gateway handed an empty
  rule list is not one that refuses; it is one with no policy, which allows.

  Idealisation: a context is the four fields a rule may name, which is all the
  file's `matches` reads. `evaluate` is the same search written as a recursion
  rather than a `find`, so that the facts above are about the order rather than
  about a library function — `a_rule_that_decides_is_one_of_the_rules` and
  `a_deciding_rule_is_one_that_matches` say the recursion answers with a rule from
  the list and one that matches, so it is the search and not something else. The
  pipeline around it — resolving a target, the set denial, the authz gate — is
  `Formal/Sets.lean`, `Formal/Authorize.lean` and `Formal/Resolve.lean`, and is
  not restated here.
-/

namespace McpGateway

/-- What a rule is matched against: the four fields a rule may name. -/
structure RuleCtx where
  agent : Option String
  session : Option String
  serverId : Option String
  tool : Option String
deriving DecidableEq, Repr

/-- The action a rule carries, and the fallback for a context no rule carries. -/
inductive RuleDecision where
  | allow
  | deny
deriving DecidableEq, Repr

/-- A rule's `match` bag. A field left `none` is not required to be absent — it is
not looked at. -/
structure Constraint where
  agent : Option String
  session : Option String
  serverId : Option String
  tool : Option String
deriving DecidableEq, Repr

structure Rule where
  ruleId : String
  matchOn : Option Constraint
  action : RuleDecision
deriving DecidableEq, Repr

/-- One field of the bag against one field of the context: unconstrained, or equal
to what was written. -/
def satisfies (c : Constraint) (ctx : RuleCtx) : Bool :=
  (match c.agent with | none => true | some a => decide (ctx.agent = some a)) &&
  (match c.session with | none => true | some s => decide (ctx.session = some s)) &&
  (match c.serverId with | none => true | some s => decide (ctx.serverId = some s)) &&
  (match c.tool with | none => true | some t => decide (ctx.tool = some t))

/-- `matches` in the file, named `applies` here: a rule with no bag applies
everything; a rule with one asks each of its four fields. -/
def applies (rule : Rule) (ctx : RuleCtx) : Bool :=
  match rule.matchOn with
  | none => true
  | some c => satisfies c ctx

/-- `evaluateRules`: the search, stopping at the first rule that matches. -/
def evaluate : List Rule → RuleCtx → Option Rule
  | [], _ => none
  | candidate :: rest, ctx =>
    if applies candidate ctx then some candidate else evaluate rest ctx

/-- `decideAction`: the rule that decided, if any, and the decision. -/
def decideAction (rules : List Rule) (ctx : RuleCtx) (fallback : RuleDecision) :
    Option Rule × RuleDecision :=
  match evaluate rules ctx with
  | none => (none, fallback)
  | some decided => (some decided, decided.action)

/-- Whatever the search answers with is one of the rules it was given. -/
theorem a_rule_that_decides_is_one_of_the_rules (rules : List Rule) (ctx : RuleCtx) (rule : Rule)
    (found : evaluate rules ctx = some rule) : rule ∈ rules := by
  induction rules with
  | nil => simp [evaluate] at found
  | cons head rest ih =>
    simp only [evaluate] at found
    split at found
    · rename_i hit
      rw [Option.some.inj found]
      exact List.mem_cons_self
    · rename_i miss
      exact List.mem_cons_of_mem _ (ih found)

/-- And it is one that matches, so the search is not answering with a rule it never
looked at. -/
theorem a_deciding_rule_is_one_that_matches (rules : List Rule) (ctx : RuleCtx) (rule : Rule)
    (found : evaluate rules ctx = some rule) : applies rule ctx = true := by
  induction rules with
  | nil => simp [evaluate] at found
  | cons head rest ih =>
    simp only [evaluate] at found
    split at found
    · rename_i hit
      rw [← Option.some.inj found]
      exact hit
    · rename_i miss
      exact ih found

/-- The order decides: a matching rule takes the call before any rule behind it is
looked at. -/
theorem an_earlier_matching_rule_takes_the_call_from_a_later_one (earlier later : Rule)
    (rest : List Rule) (ctx : RuleCtx) (hit : applies earlier ctx = true) :
    evaluate (earlier :: later :: rest) ctx = some earlier := by
  rw [evaluate, if_pos hit]

/-- And the decision is that rule's own action. -/
theorem the_first_matching_rule_decides (rules : List Rule) (ctx : RuleCtx)
    (fallback : RuleDecision) (rule : Rule) (found : evaluate rules ctx = some rule) :
    decideAction rules ctx fallback = (some rule, rule.action) := by
  simp only [decideAction, found]

/-- A context no rule applies is answered by the fallback — a policy's edge is the
caller's, not the file's. -/
theorem a_gateway_with_no_rule_decides_by_the_fallback (ctx : RuleCtx) (fallback : RuleDecision) :
    decideAction [] ctx fallback = (none, fallback) := rfl

/-- The fallbacks the file writes are both `allow`, so the edge of the policy lets
the call through. -/
theorem a_gateway_with_no_rules_allows_every_call (ctx : RuleCtx) :
    decideAction [] ctx RuleDecision.allow = (none, RuleDecision.allow) := rfl

/-- A rule with no bag at all applies every context there is. -/
theorem an_unconstrained_rule_matches_every_call (ctx : RuleCtx) :
    applies ⟨"permit", none, RuleDecision.allow⟩ ctx = true := rfl

/-- A rule that names one field asks about that field and leaves the rest open: the
context below differs from it in all three other fields and is still matched. -/
theorem a_rule_that_names_one_field_leaves_the_others_open :
    applies ⟨"files", some ⟨none, none, some "files", none⟩, RuleDecision.deny⟩
      ⟨some "a9", some "s9", some "files", some "write"⟩ = true := by
  decide

/-- The constraint read as an exact description instead — every field, including the
ones left out, has to agree. The control for the theorem above. -/
def satisfiesExactly (c : Constraint) (ctx : RuleCtx) : Bool :=
  decide (ctx.agent = c.agent) && decide (ctx.session = c.session) &&
    decide (ctx.serverId = c.serverId) && decide (ctx.tool = c.tool)

/-! ### The examples the controls are decided on -/

def exampleCtx : RuleCtx := ⟨some "a1", none, some "files", some "read"⟩

def filesOnly : Constraint := ⟨none, none, some "files", none⟩

def permitEverything : Rule := ⟨"permit", none, RuleDecision.allow⟩
def denyReadingFiles : Rule := ⟨"deny-read", some filesOnly, RuleDecision.deny⟩

/-- The control for the order: one unconstrained `allow` above the deny lets the
call through, and the same two rules the other way round refuse it — so the engine
is not deny-overrides, and the list's order is the policy. -/
theorem an_unconstrained_rule_above_a_deny_lets_the_call_through :
    decideAction [permitEverything, denyReadingFiles] exampleCtx RuleDecision.allow =
        (some permitEverything, RuleDecision.allow) ∧
      decideAction [denyReadingFiles, permitEverything] exampleCtx RuleDecision.allow =
        (some denyReadingFiles, RuleDecision.deny) ∧
      decideAction [denyReadingFiles] exampleCtx RuleDecision.allow =
        (some denyReadingFiles, RuleDecision.deny) := by
  decide

/-- The control for the bag: the rule reaches the context it was written for, and
read as an exact description it would reach nothing — the context names an agent, a
session and a tool the constraint never mentions. -/
theorem reading_a_constraint_as_an_exact_description_covers_nothing :
    applies ⟨"files", some filesOnly, RuleDecision.deny⟩ exampleCtx = true ∧
      satisfiesExactly filesOnly exampleCtx = false := by
  decide

/-- And the control for the open rule: with no bag at all, the read as an exact
description would have to match a context whose every field is absent. -/
theorem an_unconstrained_rule_read_exactly_covers_only_the_empty_context :
    applies permitEverything exampleCtx = true ∧
      applies permitEverything ⟨none, none, some "files", none⟩ = true ∧
      satisfiesExactly ⟨none, none, none, none⟩ exampleCtx = false := by
  decide

end McpGateway
