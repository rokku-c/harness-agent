namespace McpGateway

structure RuleCtx where
  agent : Option String
  session : Option String
  serverId : Option String
  tool : Option String
deriving DecidableEq, Repr

inductive RuleDecision where
  | allow
  | deny
deriving DecidableEq, Repr

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

def satisfies (c : Constraint) (ctx : RuleCtx) : Bool :=
  (match c.agent with | none => true | some a => decide (ctx.agent = some a)) &&
  (match c.session with | none => true | some s => decide (ctx.session = some s)) &&
  (match c.serverId with | none => true | some s => decide (ctx.serverId = some s)) &&
  (match c.tool with | none => true | some t => decide (ctx.tool = some t))

def applies (rule : Rule) (ctx : RuleCtx) : Bool :=
  match rule.matchOn with
  | none => true
  | some c => satisfies c ctx

def evaluate : List Rule → RuleCtx → Option Rule
  | [], _ => none
  | candidate :: rest, ctx =>
    if applies candidate ctx then some candidate else evaluate rest ctx

def decideAction (rules : List Rule) (ctx : RuleCtx) (fallback : RuleDecision) :
    Option Rule × RuleDecision :=
  match evaluate rules ctx with
  | none => (none, fallback)
  | some decided => (some decided, decided.action)

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

theorem an_earlier_matching_rule_takes_the_call_from_a_later_one (earlier later : Rule)
    (rest : List Rule) (ctx : RuleCtx) (hit : applies earlier ctx = true) :
    evaluate (earlier :: later :: rest) ctx = some earlier := by
  rw [evaluate, if_pos hit]

theorem the_first_matching_rule_decides (rules : List Rule) (ctx : RuleCtx)
    (fallback : RuleDecision) (rule : Rule) (found : evaluate rules ctx = some rule) :
    decideAction rules ctx fallback = (some rule, rule.action) := by
  simp only [decideAction, found]

theorem a_gateway_with_no_rule_decides_by_the_fallback (ctx : RuleCtx) (fallback : RuleDecision) :
    decideAction [] ctx fallback = (none, fallback) := rfl

theorem a_gateway_with_no_rules_allows_every_call (ctx : RuleCtx) :
    decideAction [] ctx RuleDecision.allow = (none, RuleDecision.allow) := rfl

theorem an_unconstrained_rule_matches_every_call (ctx : RuleCtx) :
    applies ⟨"permit", none, RuleDecision.allow⟩ ctx = true := rfl

theorem a_rule_that_names_one_field_leaves_the_others_open :
    applies ⟨"files", some ⟨none, none, some "files", none⟩, RuleDecision.deny⟩
      ⟨some "a9", some "s9", some "files", some "write"⟩ = true := by
  decide

def satisfiesExactly (c : Constraint) (ctx : RuleCtx) : Bool :=
  decide (ctx.agent = c.agent) && decide (ctx.session = c.session) &&
    decide (ctx.serverId = c.serverId) && decide (ctx.tool = c.tool)


def exampleCtx : RuleCtx := ⟨some "a1", none, some "files", some "read"⟩

def filesOnly : Constraint := ⟨none, none, some "files", none⟩

def permitEverything : Rule := ⟨"permit", none, RuleDecision.allow⟩
def denyReadingFiles : Rule := ⟨"deny-read", some filesOnly, RuleDecision.deny⟩

theorem an_unconstrained_rule_above_a_deny_lets_the_call_through :
    decideAction [permitEverything, denyReadingFiles] exampleCtx RuleDecision.allow =
        (some permitEverything, RuleDecision.allow) ∧
      decideAction [denyReadingFiles, permitEverything] exampleCtx RuleDecision.allow =
        (some denyReadingFiles, RuleDecision.deny) ∧
      decideAction [denyReadingFiles] exampleCtx RuleDecision.allow =
        (some denyReadingFiles, RuleDecision.deny) := by
  decide

theorem reading_a_constraint_as_an_exact_description_covers_nothing :
    applies ⟨"files", some filesOnly, RuleDecision.deny⟩ exampleCtx = true ∧
      satisfiesExactly filesOnly exampleCtx = false := by
  decide

theorem an_unconstrained_rule_read_exactly_covers_only_the_empty_context :
    applies permitEverything exampleCtx = true ∧
      applies permitEverything ⟨none, none, some "files", none⟩ = true ∧
      satisfiesExactly ⟨none, none, none, none⟩ exampleCtx = false := by
  decide

end McpGateway
