/-
  The console's conversion layer — `apps/effect-server/src/client/adapt/contract.ts`
  and `apps/effect-server/src/client/adapt/controls.ts`.

  A view node is a component name, props and children; a design system component is a React
  element. Each of the three things these two files decide is a pair that must agree.

  **The content and the attributes are duals.** A JSON element has no children of its own, so
  a node's content arrives on the `value` prop — unless the node declared children, when
  `value` is the component's own (`Select.Item` means something by it). Drop `value` whatever
  the node declared and a compound component loses the prop it matches an item by; never drop
  it and a heading is handed `value="Fleet"` beside `Fleet` as its child, which reaches a DOM
  node as a stray attribute. Neither throws.

  **The shape of what a handler is called with is a fact about the component, not a guess
  about the prop's name.** The handler is handed either the DOM event its own input raised —
  the value on that event's target — or the value itself, and exactly two components, the two
  text fields, are the former. The replaced rule compared the prop with `checked`; a text
  field's prop is `value`, so view state receives an event where a string was expected.

  **The handler is derived from the prop, with one named exception, and the exception is not a
  second fact.** A control that reports its own DOM event is one whose change prop is
  `onChange`: "raises its own event" and "is heard on `onChange`" are one fact, which is why
  one flag decides both the argument's shape and the handler's name, and a third text field is
  named in that one place. It is not a detail — the prop alone derives `onValueChange` for a
  text field, and an input whose `value` nothing writes back is read-only to React, so what
  was typed is dropped with nothing reported. That is also why a derivation with one named
  exception beat the hand-written `{ prop, handler }` pair: a pair's two fields are
  independent, so one wired to another's handler is an edit no code refuses.

  Idealisation: props are a partial map from names to strings and the children one flag, so
  the props record and React's rendering of children belong to the component. Which components
  are controls, and which two report an event, are facts about the design system read off the
  file's tables; an argument is an event as far as `read` looks at it, or the value itself, and
  the handler names are the code's strings.
-/

namespace Adapt

/-- Props as the conversion reads them: a name carries a value or is absent. -/
abbrev Props := String → Option String

/-- `without` — every prop less one, without mutating what the spec handed us. -/
def without (p : Props) (key : String) : Props := fun q => if q = key then none else p q

/-- Its attributes: the props, less the content prop when that prop *is* the content. -/
def attributes (p : Props) (children : Bool) (k : String) : Props :=
  if children then p else without p k

/-- **The duality**, the statement to lead with: for a node whose content key carries a value,
the key is gone from the attributes exactly when the node declared no children. -/
theorem the_content_and_the_attributes_decide_the_same_way (p : Props) (children : Bool)
    (k v : String) (carries : p k = some v) :
    (attributes p children k) k = none ↔ children = false := by
  cases children <;> simp [attributes, without, carries]

/-- Both halves by name: with children the key survives as an ordinary attribute, which is what
a compound component means by it; with none it is gone, so no stray attribute reaches a DOM
node and React has nothing to warn about. -/
theorem the_content_key_survives_with_children_and_leaves_without (p : Props) (k v : String)
    (carries : p k = some v) :
    (attributes p true k) k = some v ∧ (attributes p false k) k = none := by
  simp [attributes, without, carries]

/-- Every other prop is passed through, children or not — what `as: "src"` rests on: a value
the node put on a prop the component owns is an ordinary attribute. -/
theorem the_other_props_are_passed_through (p : Props) (children : Bool) (k q : String)
    (other : q ≠ k) : (attributes p children k) q = p q := by
  cases children <;> simp [attributes, without, other]

/-- The control, both wrong ways at once: dropping the key whatever the node declared loses a
compound component's own `value`, and keeping it whatever the node declared hands a heading a
stray attribute — each is where the exception's reading differs from it. -/
theorem dropping_or_keeping_the_key_always_loses_a_reading (p : Props) (k v : String)
    (carries : p k = some v) :
    (without p k) k ≠ (attributes p true k) k ∧ p k ≠ (attributes p false k) k := by
  simp [attributes, without, carries]

/-- What a handler is called with: the DOM event its own input raised — as far as `read` looks
at it, a target that may carry the value the input now holds — or the value itself. -/
inductive Arg where
  | event (carried : Option String)
  | value (given : String)

/-- `read` — the value out of whatever the handler was called with. The shape is the binding's
`dom` flag and nothing else: a DOM-reporting handler's value is on the event's target, and an
argument with no target is not an event and is handed back untouched. -/
def read (dom : Bool) (a : Arg) : Arg :=
  match a with
  | .event carried => if dom then (carried.map .value).getD (.event none) else .event carried
  | .value given => .value given

/-- A DOM-shaped binding reads the value the event carried — for a text field, what was typed. -/
theorem a_dom_shaped_binding_reads_the_value_the_event_carried (v : String) :
    read true (.event (some v)) = .value v := by simp [read]

/-- A binding handed a value rather than an event hands it on — the direct reading every other
control has, and the defensive branch under a DOM-shaped one, so an input that never raises an
event corrupts nothing. -/
theorem a_binding_handed_a_value_keeps_it (dom : Bool) (v : String) :
    read dom (.value v) = .value v := by cases dom <;> simp [read]

/-- The shapes are not interchangeable, which is why the flag cannot be read off the prop: a
direct binding handed an event does not yield a value, it yields the event. Get `dom` wrong for
one control and view state receives the event itself. -/
theorem the_two_shapes_are_not_interchangeable (v : String) :
    read false (.event (some v)) ≠ .value v := by simp [read]

/-- The rule the file replaced: the shape guessed from the prop's name — `checked` an event,
anything else the value. Two strings compared, which is what made a guess possible. -/
def domByPropName (prop : String) : Bool := decide (prop = "checked")

/-- The control, and the defect in one theorem: both text fields keep their value on `value` and
both report the event their input raised, so the guessed rule hands view state the event where
the binding reads the value that was typed. -/
theorem guessing_the_shape_from_the_prop_name_reads_an_event_for_a_text_field (typed : String) :
    read (domByPropName "value") (.event (some typed)) = .event (some typed) ∧
    read true (.event (some typed)) = .value typed := by
  have guessed : domByPropName "value" = false := by decide
  simp [read, guessed]

/-- The props a control keeps its value on; the code writes them as strings. -/
inductive Field where
  | value
  | checked

/-- The prop-derived handler name: `on` ++ the prop capitalised ++ `Change`. -/
def handlerName : Field → String
  | .value => "onValueChange"
  | .checked => "onCheckedChange"

/-- The handler a control is heard on: `onChange` for one that raises its own DOM event, and
the prop-derived name otherwise. This is the same expression the derivation writes, kept as the
fact it is — one flag decides the argument's shape and the handler's name together. -/
def heardOn (p : Field) (dom : Bool) : String := if dom then "onChange" else handlerName p

/-- A control's wiring: the prop it holds its value on, the handler that hears it change, and
whether that handler reports the DOM event its own input raised. -/
structure Binding where
  prop : Field
  handler : String
  dom : Bool

/-- The binding a prop gets: the exception is inside the derivation rather than beside it. -/
def wired (p : Field) (dom : Bool) : Binding :=
  { prop := p, handler := if dom then "onChange" else handlerName p, dom := dom }

/-- The same wiring with the exception dropped — the handler the prop alone derives, which is
what the file returned before it read `dom` for the name too. -/
def wiredByPropAlone (p : Field) (dom : Bool) : Binding :=
  { prop := p, handler := handlerName p, dom := dom }

/-- A wiring is heard exactly when it names the handler the control reports under; name
anything else and the handler is never called, so nothing is written back. -/
def writesBack (b : Binding) : Bool := decide (b.handler = heardOn b.prop b.dom)

/-- The property: for a text field the derived handler IS the name the control is heard on, so
its value has something writing it back. -/
theorem a_text_field_is_wired_to_the_name_it_is_heard_on :
    (wired .value true).handler = "onChange" ∧ writesBack (wired .value true) = true := by
  decide

/-- The control: the same mechanism with the exception dropped. The prop alone says
`onValueChange` for a text field and the derivation says `onChange`, so the two readings differ
on exactly the control that reports its own event. -/
theorem reading_the_handler_off_the_prop_alone_names_a_text_field_wrong :
    (wiredByPropAlone .value true).handler = handlerName .value ∧
    (wiredByPropAlone .value true).handler ≠ (wired .value true).handler := by
  decide

/-- The consequence: a text field wired the prop-derived way is never called, so what the
operator typed — the value `read` takes off the event its own input raised — is never written
back to view state. -/
theorem a_text_field_wired_by_the_prop_alone_never_writes_what_was_typed (typed : String) :
    writesBack (wiredByPropAlone .value true) = false ∧
    read (wiredByPropAlone .value true).dom (.event (some typed)) = .value typed := by
  refine ⟨by decide, ?_⟩
  simp [read, wiredByPropAlone]

/-- The derivation still sends the two props to two different names, so the two other controls
cannot be wired to each other's event. -/
theorem the_two_props_derive_two_different_handlers :
    handlerName .value ≠ handlerName .checked := by decide

/-- And what the derivation does not remove: `Binding`'s two fields are independent, so a
hand-written pair can still name `onChange` for a select, which is heard on `onCheckedChange`. -/
theorem a_hand_written_binding_can_still_name_the_wrong_handler :
    ∃ b : Binding, b.prop = .checked ∧ b.handler = "onChange" ∧
      b.handler ≠ (wired .checked false).handler := by
  refine ⟨{ prop := .checked, handler := "onChange", dom := false }, rfl, rfl, ?_⟩
  decide

end Adapt
