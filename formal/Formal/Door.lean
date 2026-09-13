/-
  One read, two doors — `apps/mantis/src/effect-ui-chat.ts`,
  `apps/mantis/src/effect-ui-conversations.ts`, and
  `apps/effect-server/src/client/effect-ui-action-runtime.ts`.

  A console offers one read through two doors: a row's `Read`, which names the
  conversation by the key the row holds, and `Start`, which names one the console
  has not held. Both are presses of one action, so both make one call and answer
  at one path, and the surface that shows the answer — the timeline — cannot tell
  which door was pressed. That is what modelling a press as a *value* beside a
  *call* buys: two doors of one action differ in what they carried and in nothing
  else, so the second door cannot put a second answer somewhere the first is not
  read.

  The other half is the composer, and it is where two names can come apart. It is
  offered only while a conversation has been read, and the message it sends is
  addressed to that same conversation, so its gate path and its send path are one
  name. Nothing checks that they are one name: it is written twice, and the rule
  is that the two writings agree. The failure of the rule is silent in both
  directions — a control offered over a value it is not sending, which is a
  press that makes no call and says nothing, and a call that can be addressed
  while no control offers it, which is a fact nobody can act on.
-/

namespace EffectUi.Door

/-- The store, as the value a path holds. -/
abbrev Store := String → Option String

/-- What a press reads a parameter from. -/
def fromPath (store : Store) (path : String) : Option String := store path

/-- Whether a control is offered: its gate path carries a value. -/
def offered (store : Store) (gate : String) : Bool := (store gate).isSome

/-- Whether a one-parameter call can be addressed. A path parameter with no value
is an unaddressed call — skipped rather than sent empty, which is
`Formal/Entry.lean`'s `unaddressed_iff`. -/
def addressable (store : Store) (send : String) : Bool := (fromPath store send).isSome

/-! ### The gate and the press beside it -/

/-- A control's gate and its press name one path, so being offered and being
addressable are one question. This is the whole of the rule, and it is a
hypothesis about two names rather than a proof about two mechanisms: the
agreement is discharged by writing the same path twice, so the wrong version of
it is not a type error but a silent one. -/
theorem offered_iff_addressable {store : Store} {gate send : String} (h : gate = send) :
    offered store gate = addressable store send := by
  simp [offered, addressable, fromPath, h]

/-- The control: name them differently and the two questions come apart. One
store — holding the gate's value and not the send's — offers a control whose
press makes no call at all, and read the other way has an addressable call that
no control offers. Neither direction is loud. -/
theorem gate_must_name_the_send_path :
    ∃ (store : Store) (gate send : String),
      offered store gate = true ∧ addressable store send = false := by
  refine ⟨fun key => if key = "read" then some "ui" else none, "read", "start", ?_, ?_⟩
  · simp [offered]
  · simp [addressable, fromPath]

/-! ### Two doors of one read -/

/-- A read as the action declares it: one url template, and one path its answer
is written to. Neither belongs to the press. -/
structure Read where
  /-- the call's address, with the id templated into it -/
  url : String
  /-- where the answer goes, read back by every surface that shows one -/
  result : String

/-- A press of a read: the declaration, and the value this door carried. -/
structure Press where
  /-- the action the press is a press of -/
  call : Read
  /-- the value this particular door carried -/
  id : String

/-- The request a press makes: a function of the call and the value, and of
nothing else — so which door was used travels in the request rather than beside
it. -/
def request (press : Press) : String × String := (press.call.url, press.id)

/-- Two doors of one read differ in exactly what they carried: not in the url
they call, and not in where the answer goes. So the surface showing the answer
shows the answer of whichever door was pressed. -/
theorem doors_differ_only_in_what_they_carried {a b : Press} (h : a.call = b.call) :
    (request a = request b ↔ a.id = b.id) ∧ a.call.result = b.call.result := by
  refine ⟨?_, by rw [h]⟩
  constructor
  · intro hr
    simp [request] at hr
    exact hr.2
  · intro hid
    simp [request, h, hid]

/-- And two doors carrying the same value through one read make one request:
the door a press came through is the value it held, so the console shows one
timeline for it however it was reached. -/
theorem same_value_same_request {a b : Press} (hcall : a.call = b.call) (hid : a.id = b.id) :
    request a = request b := by
  simp [request, hcall, hid]

end EffectUi.Door
