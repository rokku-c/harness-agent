namespace Adapt

abbrev Props := String → Option String

def without (p : Props) (key : String) : Props := fun q => if q = key then none else p q

def attributes (p : Props) (children : Bool) (k : String) : Props :=
  if children then p else without p k

theorem the_content_and_the_attributes_decide_the_same_way (p : Props) (children : Bool)
    (k v : String) (carries : p k = some v) :
    (attributes p children k) k = none ↔ children = false := by
  cases children <;> simp [attributes, without, carries]

theorem the_content_key_survives_with_children_and_leaves_without (p : Props) (k v : String)
    (carries : p k = some v) :
    (attributes p true k) k = some v ∧ (attributes p false k) k = none := by
  simp [attributes, without, carries]

theorem the_other_props_are_passed_through (p : Props) (children : Bool) (k q : String)
    (other : q ≠ k) : (attributes p children k) q = p q := by
  cases children <;> simp [attributes, without, other]

theorem dropping_or_keeping_the_key_always_loses_a_reading (p : Props) (k v : String)
    (carries : p k = some v) :
    (without p k) k ≠ (attributes p true k) k ∧ p k ≠ (attributes p false k) k := by
  simp [attributes, without, carries]

inductive Arg where
  | event (carried : Option String)
  | value (given : String)

def read (dom : Bool) (a : Arg) : Arg :=
  match a with
  | .event carried => if dom then (carried.map .value).getD (.event none) else .event carried
  | .value given => .value given

theorem a_dom_shaped_binding_reads_the_value_the_event_carried (v : String) :
    read true (.event (some v)) = .value v := by simp [read]

theorem a_binding_handed_a_value_keeps_it (dom : Bool) (v : String) :
    read dom (.value v) = .value v := by cases dom <;> simp [read]

theorem the_two_shapes_are_not_interchangeable (v : String) :
    read false (.event (some v)) ≠ .value v := by simp [read]

def domByPropName (prop : String) : Bool := decide (prop = "checked")

theorem guessing_the_shape_from_the_prop_name_reads_an_event_for_a_text_field (typed : String) :
    read (domByPropName "value") (.event (some typed)) = .event (some typed) ∧
    read true (.event (some typed)) = .value typed := by
  have guessed : domByPropName "value" = false := by decide
  simp [read, guessed]

inductive Field where
  | value
  | checked

def handlerName : Field → String
  | .value => "onValueChange"
  | .checked => "onCheckedChange"

def heardOn (p : Field) (dom : Bool) : String := if dom then "onChange" else handlerName p

structure Binding where
  prop : Field
  handler : String
  dom : Bool

def wired (p : Field) (dom : Bool) : Binding :=
  { prop := p, handler := if dom then "onChange" else handlerName p, dom := dom }

def wiredByPropAlone (p : Field) (dom : Bool) : Binding :=
  { prop := p, handler := handlerName p, dom := dom }

def writesBack (b : Binding) : Bool := decide (b.handler = heardOn b.prop b.dom)

theorem a_text_field_is_wired_to_the_name_it_is_heard_on :
    (wired .value true).handler = "onChange" ∧ writesBack (wired .value true) = true := by
  decide

theorem reading_the_handler_off_the_prop_alone_names_a_text_field_wrong :
    (wiredByPropAlone .value true).handler = handlerName .value ∧
    (wiredByPropAlone .value true).handler ≠ (wired .value true).handler := by
  decide

theorem a_text_field_wired_by_the_prop_alone_never_writes_what_was_typed (typed : String) :
    writesBack (wiredByPropAlone .value true) = false ∧
    read (wiredByPropAlone .value true).dom (.event (some typed)) = .value typed := by
  refine ⟨by decide, ?_⟩
  simp [read, wiredByPropAlone]

theorem the_two_props_derive_two_different_handlers :
    handlerName .value ≠ handlerName .checked := by decide

theorem a_hand_written_binding_can_still_name_the_wrong_handler :
    ∃ b : Binding, b.prop = .checked ∧ b.handler = "onChange" ∧
      b.handler ≠ (wired .checked false).handler := by
  refine ⟨{ prop := .checked, handler := "onChange", dom := false }, rfl, rfl, ?_⟩
  decide

end Adapt
