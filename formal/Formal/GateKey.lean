namespace GateKey

inductive Room where
  | first
  | second
deriving DecidableEq, Repr

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

abbrev Ledger := Request → Option Bool

def coarseKey (r : Request) : Request := { r with access := Access.read, session := none }

def wholeKey (r : Request) : Request := r

def remember (key : Request → Request) (ledger : Ledger) (r : Request) (allow : Bool) : Ledger :=
  fun k => if k = key r then some allow else ledger k

def recall (key : Request → Request) (ledger : Ledger) (r : Request) : Option Bool :=
  ledger (key r)

def asked (room : Room) : Request :=
  { tool := 1, access := Access.write, session := some room, input := 0 }

theorem a_remembered_verdict_answers_without_asking (key : Request → Request) (r : Request)
    (allow : Bool) : recall key (remember key (fun _ => none) r allow) r = some allow := by
  simp [recall, remember]

theorem the_coarse_key_reads_two_rooms_as_one : coarseKey (asked Room.first) = coarseKey (asked Room.second) := by
  decide

theorem the_coarse_key_reads_a_write_as_a_read :
    coarseKey (asked Room.first) = coarseKey { asked Room.first with access := Access.read } := by
  decide

theorem a_verdict_from_one_room_answers_another :
    recall coarseKey (remember coarseKey (fun _ => none) (asked Room.first) true) (asked Room.second)
      = some true := by
  decide

theorem an_approved_write_answers_a_read :
    recall coarseKey (remember coarseKey (fun _ => none) (asked Room.first) true)
      { asked Room.first with access := Access.read } = some true := by
  decide

theorem the_whole_request_keeps_rooms_and_accesses_apart :
    recall wholeKey (remember wholeKey (fun _ => none) (asked Room.first) true) (asked Room.second) = none
    ∧ recall wholeKey (remember wholeKey (fun _ => none) (asked Room.first) true)
        { asked Room.first with access := Access.read } = none := by
  decide

theorem the_whole_request_still_remembers_its_own :
    recall wholeKey (remember wholeKey (fun _ => none) (asked Room.second) false) (asked Room.second)
      = some false := by
  decide

end GateKey
