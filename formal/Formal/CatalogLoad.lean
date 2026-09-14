namespace McpGateway

abbrev Surface := String → List String

def replace (surface : Surface) (serverId : String) (tools : List String) : Surface :=
  fun id => if id = serverId then tools else surface id

def install (surface : Surface) (listing : String → Option (List String)) (serverId : String) : Surface :=
  match listing serverId with
  | some tools => replace surface serverId tools
  | none => surface

def round (surface : Surface) (listing : String → Option (List String)) : List String → Surface
  | [] => surface
  | serverId :: rest => round (install surface listing serverId) listing rest

def loaded (listing : String → Option (List String)) (servers : List String) : List String :=
  servers.filter fun serverId => (listing serverId).isSome

def failed (listing : String → Option (List String)) (servers : List String) : List String :=
  servers.filter fun serverId => (listing serverId).isNone

theorem a_failed_listing_leaves_the_surface_untouched (surface : Surface)
    (listing : String → Option (List String)) (serverId : String) (down : listing serverId = none) :
    install surface listing serverId = surface := by
  simp [install, down]

theorem a_server_that_fails_keeps_what_it_last_advertised (surface : Surface)
    (listing : String → Option (List String)) (serverId : String) (down : listing serverId = none) :
    install surface listing serverId serverId = surface serverId := by
  simp [install, down]

theorem a_listing_that_answers_installs_exactly_what_it_listed (surface : Surface)
    (listing : String → Option (List String)) (serverId : String) (tools : List String)
    (up : listing serverId = some tools) :
    install surface listing serverId serverId = tools := by
  simp [install, up, replace]

theorem a_listing_that_answers_leaves_every_other_server_alone (surface : Surface)
    (listing : String → Option (List String)) (serverId other : String) (tools : List String)
    (up : listing serverId = some tools) (elsewhere : other ≠ serverId) :
    install surface listing serverId other = surface other := by
  simp [install, up, replace, elsewhere]

theorem an_install_leaves_every_other_server_alone (surface : Surface)
    (listing : String → Option (List String)) (serverId other : String) (elsewhere : other ≠ serverId) :
    install surface listing serverId other = surface other := by
  simp only [install]
  cases held : listing serverId with
  | some tools => simp [replace, elsewhere]
  | none => rfl

theorem a_round_leaves_an_unlisted_server_alone (surface : Surface)
    (listing : String → Option (List String)) (servers : List String) (other : String)
    (absent : other ∉ servers) : round surface listing servers other = surface other := by
  induction servers generalizing surface with
  | nil => rfl
  | cons serverId rest ih =>
    have elsewhere : other ≠ serverId := fun same => absent (by simp [same])
    simp only [round]
    rw [ih (install surface listing serverId) fun there => absent (by simp [there])]
    exact an_install_leaves_every_other_server_alone surface listing serverId other elsewhere

theorem a_report_names_only_servers_that_were_looked_at (listing : String → Option (List String))
    (servers : List String) (serverId : String) :
    (serverId ∈ loaded listing servers → serverId ∈ servers) ∧
    (serverId ∈ failed listing servers → serverId ∈ servers) :=
  ⟨fun there => (List.mem_filter.mp there).1, fun there => (List.mem_filter.mp there).1⟩

theorem every_server_looked_at_is_in_the_report (listing : String → Option (List String))
    (servers : List String) (serverId : String) (there : serverId ∈ servers) :
    serverId ∈ loaded listing servers ∨ serverId ∈ failed listing servers := by
  cases held : listing serverId with
  | some tools =>
    exact Or.inl (List.mem_filter.mpr ⟨there, by simp [held]⟩)
  | none =>
    exact Or.inr (List.mem_filter.mpr ⟨there, by simp [held]⟩)

theorem no_server_is_both_loaded_and_failed (listing : String → Option (List String))
    (servers : List String) (serverId : String)
    (both : serverId ∈ loaded listing servers ∧ serverId ∈ failed listing servers) : False := by
  have up : (listing serverId).isSome = true := (List.mem_filter.mp both.1).2
  have down : (listing serverId).isNone = true := (List.mem_filter.mp both.2).2
  cases held : listing serverId <;> simp [held] at up down

def installEmptying (surface : Surface) (listing : String → Option (List String)) (serverId : String) : Surface :=
  match listing serverId with
  | some tools => replace surface serverId tools
  | none => replace surface serverId []

theorem clearing_on_failure_empties_a_live_surface :
    installEmptying (fun _ => ["read"]) (fun _ => none) "gh" "gh" = [] ∧
    install (fun _ => ["read"]) (fun _ => none) "gh" "gh" = ["read"] ∧
    failed (fun _ => none) ["gh"] = ["gh"] := by
  decide

def failedQuietly (_ : String → Option (List String)) (_ : List String) : List String := []

theorem swallowing_a_failure_hides_it :
    round (fun _ => ["read"]) (fun _ => none) ["gh"] "gh" = ["read"] ∧
    failed (fun _ => none) ["gh"] = ["gh"] ∧
    failedQuietly (fun _ => none) ["gh"] = [] := by
  decide

end McpGateway
