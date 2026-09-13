/-
  A tool's name on the two wires — `packages/effect-interface/src/tool-key.ts`
  (`keyOf`) and `packages/effect-mcp/src/node-server/tools.ts` (`sanitize`).

  A tool is declared once, under an interface, and reaches a caller through two
  different name forms. The registry flattens it to `ifaceId + "." + toolName`
  and looks tools up by that key; the MCP node server serves it under the
  sanitized name, which is what a connected agent sees. Both forms are strings
  built by concatenation or character replacement, so either could map two tools
  onto one name — and the failure would be silent: a lookup answers with the
  wrong tool, or a map's last write drops a tool an agent was told exists.

  The two halves get opposite treatment, and that is the point of proving both:

  * The flattened key is *unique* as long as the interface id carries no dot.
    `the_key_splits_where_the_id_ends` is why — the separator is the id's end,
    so the key splits back into exactly the pair that made it, and
    `a_dot_free_id_splits_the_key_only_one_way` is the injectivity that follows.
    The dot-free id is a precondition the registry does not yet check; that is
    what this half of the module writes down.
  * The served name is *not* unique: `the_served_name_keeps_only_allowed_characters`
    says what `sanitize` promises and `two_names_can_serve_as_one_name` says what
    it does not — two distinct names, one served name. So the node server cannot
    let the map's last write win, and `serve` below is the same map with a
    shared name refused instead: `every_name_is_served` and
    `a_shared_name_stops_the_surface` are the two halves of that refusal.

  The two name forms are different strings, and only the second is lossy: the
  key is injective, while the served name is the tool's *own* name with its
  disallowed characters replaced. That is why the refusal lives on the served
  name alone.

  Idealisation: names are `List Char`, which is what both functions actually do
  (append a separator, replace characters); nothing here depends on encoding,
  and the offered name is whatever the registry hands the surface.
-/

namespace EffectMcp

/-- A name, as the two functions that build one see it. -/
abbrev Name := List Char

/-- The separator the registry flattens with. -/
def dot : Char := '.'

/-- An id the flattened key can be split at: it carries no separator itself. -/
def DotFree (id : Name) : Prop := ∀ c ∈ id, c ≠ dot

/-- `keyOf ifaceId toolName = ifaceId + "." + toolName`. -/
def keyOf (ifaceId toolName : Name) : Name := ifaceId ++ dot :: toolName

/-- The key, split at its first separator: the id, and the rest. -/
def splitAtDot : Name → Name × Name
  | [] => ([], [])
  | c :: rest =>
    if c = dot then ([], rest)
    else ((c :: (splitAtDot rest).1), (splitAtDot rest).2)

/-- The key is the id, a separator, and the tool name — in that order. -/
theorem the_key_splits_where_the_id_ends (id toolName : Name) (h : DotFree id) :
    splitAtDot (keyOf id toolName) = (id, toolName) := by
  induction id with
  | nil => rfl
  | cons c rest ih =>
    have hc : c ≠ dot := h c (by simp)
    have hrest : DotFree rest := fun d hd => h d (by simp [hd])
    rw [keyOf, List.cons_append, splitAtDot, if_neg hc]
    show ((c :: (splitAtDot (keyOf rest toolName)).1), (splitAtDot (keyOf rest toolName)).2) = _
    rw [ih hrest]

/-- Two tools share a flattened key only by being the same tool: with a dot-free
id on each side, the key names exactly one pair. -/
theorem a_dot_free_id_splits_the_key_only_one_way (id₁ id₂ toolName₁ toolName₂ : Name)
    (h₁ : DotFree id₁) (h₂ : DotFree id₂)
    (h : keyOf id₁ toolName₁ = keyOf id₂ toolName₂) : id₁ = id₂ ∧ toolName₁ = toolName₂ := by
  have split₁ := the_key_splits_where_the_id_ends id₁ toolName₁ h₁
  have split₂ := the_key_splits_where_the_id_ends id₂ toolName₂ h₂
  rw [h] at split₁
  have pairs : (id₁, toolName₁) = (id₂, toolName₂) := split₁.symm.trans split₂
  exact ⟨congrArg Prod.fst pairs, congrArg Prod.snd pairs⟩

/-- The characters a tool name may carry once served. -/
def allowed (c : Char) : Bool := c.isAlphanum || c = '_' || c = '-'

/-- `sanitize`: every character the caller may not see becomes `_`. -/
def sanitize : Name → Name
  | [] => []
  | c :: rest => (if allowed c then c else '_') :: sanitize rest

theorem the_served_name_keeps_only_allowed_characters (toolName : Name) :
    ∀ c ∈ sanitize toolName, allowed c = true := by
  induction toolName with
  | nil => simp [sanitize]
  | cons c rest ih =>
    intro d hd
    rw [sanitize, List.mem_cons] at hd
    rcases hd with rfl | hd
    · by_cases h : allowed c = true
      · simp [h]
      · rw [if_neg h]
        decide
    · exact ih d hd

/-- Sanitizing replaces characters; it never drops one, so a name does not
quietly become a prefix of another. -/
theorem the_served_name_is_as_long_as_the_tool_name (toolName : Name) :
    (sanitize toolName).length = toolName.length := by
  induction toolName with
  | nil => rfl
  | cons c rest ih => by_cases h : allowed c = true <;> simp [sanitize, h, ih]

/-- Two different names, one served name: tools called `task.open` and
`task/open` both serve as `task_open`. Nothing about `sanitize` prevents this,
which is why the surface below refuses a shared name rather than letting the
map's last write win. -/
theorem two_names_can_serve_as_one_name :
    sanitize "task.open".toList = sanitize "task/open".toList
      ∧ "task.open".toList ≠ "task/open".toList := by
  decide

/-- What the surface holds: the name the caller sees, and the name that produced
it. The second one is the tool the first one reaches. -/
abbrev Served := Name × Name

/-- The map the node server builds: each offered name under its served name, and
`none` the moment two of them would share one. That `none` is the collision the
code has to fail on instead of overwriting. -/
def serve : List Name → Option (List Served)
  | [] => some []
  | toolName :: rest =>
    match serve rest with
    | none => none
    | some out =>
      if out.any (fun entry => entry.1 = sanitize toolName) then none
      else some ((sanitize toolName, toolName) :: out)

/-- No tool is silently dropped: every name the registry offers is on the
surface. -/
theorem every_name_is_served : ∀ (toolNames : List Name) (out : List Served),
    serve toolNames = some out → ∀ toolName ∈ toolNames, ∃ entry ∈ out, entry.2 = toolName := by
  intro toolNames
  induction toolNames with
  | nil => intro out h toolName hname; simp at hname
  | cons first rest ih =>
    intro out h toolName hname
    rw [serve] at h
    split at h
    · exact absurd h (by simp)
    · rename_i out' hout
      split at h
      · exact absurd h (by simp)
      · rw [Option.some.injEq] at h
        subst h
        rw [List.mem_cons] at hname
        rcases hname with heq | hname
        · rw [heq]
          exact ⟨(sanitize first, first), by simp, rfl⟩
        · obtain ⟨entry, hentry, hname⟩ := ih out' hout toolName hname
          exact ⟨entry, by simp [hentry], hname⟩

/-- Every entry the surface holds is a name the registry offered, sanitized. -/
theorem a_served_name_is_its_tool_name_sanitized : ∀ (toolNames : List Name) (out : List Served),
    serve toolNames = some out → ∀ entry ∈ out, entry.1 = sanitize entry.2 := by
  intro toolNames
  induction toolNames with
  | nil =>
    intro out h entry hentry
    simp [serve] at h
    subst h
    simp at hentry
  | cons first rest ih =>
    intro out h entry hentry
    rw [serve] at h
    split at h
    · exact absurd h (by simp)
    · rename_i out' hout
      split at h
      · exact absurd h (by simp)
      · rw [Option.some.injEq] at h
        subst h
        rw [List.mem_cons] at hentry
        rcases hentry with rfl | hentry
        · rfl
        · exact ih out' hout entry hentry

/-- A served name holds one tool, so an agent that calls a name calls the tool it
was advertised for. -/
theorem a_served_name_holds_one_tool : ∀ (toolNames : List Name) (out : List Served),
    serve toolNames = some out → ∀ e₁ ∈ out, ∀ e₂ ∈ out, e₁.1 = e₂.1 → e₁ = e₂ := by
  intro toolNames
  induction toolNames with
  | nil =>
    intro out h e₁ he₁
    simp [serve] at h
    subst h
    simp at he₁
  | cons first rest ih =>
    intro out h e₁ he₁ e₂ he₂ hserved
    rw [serve] at h
    split at h
    · exact absurd h (by simp)
    · rename_i out' hout
      split at h
      · exact absurd h (by simp)
      · rename_i hany
        rw [Option.some.injEq] at h
        subst h
        rw [Bool.not_eq_true] at hany
        have taken := List.any_eq_false.mp hany
        rw [List.mem_cons] at he₁ he₂
        rcases he₁ with rfl | he₁ <;> rcases he₂ with rfl | he₂
        · rfl
        · exact absurd (show decide (e₂.1 = sanitize first) = true from by rw [← hserved]; simp)
            (taken e₂ he₂)
        · exact absurd (show decide (e₁.1 = sanitize first) = true from by rw [hserved]; simp)
            (taken e₁ he₁)
        · exact ih out' hout e₁ he₁ e₂ he₂ hserved

/-- Distinct names are served distinctly whenever the surface is built at all. -/
theorem the_surface_serves_distinct_names_distinctly (toolNames : List Name) (out : List Served)
    (h : serve toolNames = some out) (name₁ name₂ : Name) (h₁ : name₁ ∈ toolNames)
    (h₂ : name₂ ∈ toolNames) (hne : name₁ ≠ name₂) : sanitize name₁ ≠ sanitize name₂ := by
  intro hs
  obtain ⟨e₁, he₁, hname₁⟩ := every_name_is_served toolNames out h name₁ h₁
  obtain ⟨e₂, he₂, hname₂⟩ := every_name_is_served toolNames out h name₂ h₂
  have sanitized₁ := a_served_name_is_its_tool_name_sanitized toolNames out h e₁ he₁
  have sanitized₂ := a_served_name_is_its_tool_name_sanitized toolNames out h e₂ he₂
  have same : e₁ = e₂ :=
    a_served_name_holds_one_tool toolNames out h e₁ he₁ e₂ he₂
      (by rw [sanitized₁, sanitized₂, hname₁, hname₂, hs])
  exact hne (by rw [← hname₁, ← hname₂, same])

/-- A shared name stops the surface rather than costing a tool: if two distinct
names sanitize alike, there is no surface to serve. -/
theorem a_shared_name_stops_the_surface (toolNames : List Name) (name₁ name₂ : Name)
    (h₁ : name₁ ∈ toolNames) (h₂ : name₂ ∈ toolNames) (hne : name₁ ≠ name₂)
    (hs : sanitize name₁ = sanitize name₂) : serve toolNames = none := by
  cases h : serve toolNames with
  | none => rfl
  | some out =>
    exact absurd hs (the_surface_serves_distinct_names_distinctly toolNames out h name₁ name₂ h₁ h₂ hne)

end EffectMcp
