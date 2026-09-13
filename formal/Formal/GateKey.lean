/-
  The approval ledger's REQUEST KEY — `packages/gate/src/gate/contract.ts`'s
  `keyOf`, read by `gate/ledger.ts`'s `lookup` and written by its `record`.

  `ManualGate.decide` returns a remembered verdict BEFORE it consults
  `askWhen`, so this key decides which later calls the operator is never asked
  about. A key that is too coarse cannot fail loudly — it answers, and the
  answer is whatever the operator gave for a different call. The two fields it
  used to drop were the conversation the approval belonged to and whether the
  call reads or writes.

  `keyOf` is therefore modelled as what it is: a projection of the request. The
  ledger is a function from request to remembered verdict, and a key is a
  function that the projection is applied through — so "the key cannot tell
  these two apart" is an equation between projections, and the collision is the
  `decide`'d witness that follows from it.
-/

namespace GateKey

/-- Which conversation asked. Two atoms are enough: the claim is precisely that
    the key cannot tell one from the other. -/
inductive Room where
  | first
  | second
deriving DecidableEq, Repr

/-- Whether the call reads or writes. -/
inductive Access where
  | read
  | write
deriving DecidableEq, Repr

structure Request where
  tool : Nat
  access : Access
  session : Option Room
  input : Nat
deriving DecidableEq, Repr

/-- The ledger as it is read: the verdict remembered under a key, if any. -/
abbrev Ledger := Request → Option Bool

/--
The key as the file built it: the tool and its input, with `access` and
`session` dropped on the floor.
-/
def coarseKey (r : Request) : Request := { r with access := Access.read, session := none }

/-- The key that names the whole request: the request itself. -/
def wholeKey (r : Request) : Request := r

/-- Remember a verdict under a request's key, leaving every other key alone. -/
def remember (key : Request → Request) (ledger : Ledger) (r : Request) (allow : Bool) : Ledger :=
  fun k => if k = key r then some allow else ledger k

/-- The verdict remembered for a request, read through the key. -/
def recall (key : Request → Request) (ledger : Ledger) (r : Request) : Option Bool :=
  ledger (key r)

/-- A protected write, asked in a conversation. -/
def asked (room : Room) : Request :=
  { tool := 1, access := Access.write, session := some room, input := 0 }

/-- The mechanism itself, for any key: what was remembered is what is answered. -/
theorem a_remembered_verdict_answers_without_asking (key : Request → Request) (r : Request)
    (allow : Bool) : recall key (remember key (fun _ => none) r allow) r = some allow := by
  simp [recall, remember]

/-- The projection the old key is: a room is not in it. -/
theorem the_coarse_key_reads_two_rooms_as_one : coarseKey (asked Room.first) = coarseKey (asked Room.second) := by
  decide

/-- Nor is the access: a write reads as the read of the same call. -/
theorem the_coarse_key_reads_a_write_as_a_read :
    coarseKey (asked Room.first) = coarseKey { asked Room.first with access := Access.read } := by
  decide

/--
The bug: the owner approves a call in one conversation, and the same call in
another conversation is answered from that verdict, with no Ask and no card.
-/
theorem a_verdict_from_one_room_answers_another :
    recall coarseKey (remember coarseKey (fun _ => none) (asked Room.first) true) (asked Room.second)
      = some true := by
  decide

/-- And an approved write answers the read of the same tool, in the same room. -/
theorem an_approved_write_answers_a_read :
    recall coarseKey (remember coarseKey (fun _ => none) (asked Room.first) true)
      { asked Room.first with access := Access.read } = some true := by
  decide

/--
The control: with the whole request as the key, neither happens. The other room
and the other access are recalled as nothing, so each is asked about in its own
right.
-/
theorem the_whole_request_keeps_rooms_and_accesses_apart :
    recall wholeKey (remember wholeKey (fun _ => none) (asked Room.first) true) (asked Room.second) = none
    ∧ recall wholeKey (remember wholeKey (fun _ => none) (asked Room.first) true)
        { asked Room.first with access := Access.read } = none := by
  decide

/-- A verdict is still remembered for the very request it was given for: the
    fix costs no dedupe that was ever wanted. -/
theorem the_whole_request_still_remembers_its_own :
    recall wholeKey (remember wholeKey (fun _ => none) (asked Room.second) false) (asked Room.second)
      = some false := by
  decide

end GateKey
