namespace EffectUi.Door

abbrev Store := String → Option String

def fromPath (store : Store) (path : String) : Option String := store path

def offered (store : Store) (gate : String) : Bool := (store gate).isSome

def addressable (store : Store) (send : String) : Bool := (fromPath store send).isSome


theorem offered_iff_addressable {store : Store} {gate send : String} (h : gate = send) :
    offered store gate = addressable store send := by
  simp [offered, addressable, fromPath, h]

theorem gate_must_name_the_send_path :
    ∃ (store : Store) (gate send : String),
      offered store gate = true ∧ addressable store send = false := by
  refine ⟨fun key => if key = "read" then some "ui" else none, "read", "start", ?_, ?_⟩
  · simp [offered]
  · simp [addressable, fromPath]


structure Read where
  url : String
  result : String

structure Press where
  call : Read
  id : String

def request (press : Press) : String × String := (press.call.url, press.id)

theorem doors_differ_only_in_what_they_carried {a b : Press} (h : a.call = b.call) :
    (request a = request b ↔ a.id = b.id) ∧ a.call.result = b.call.result := by
  refine ⟨?_, by rw [h]⟩
  constructor
  · intro hr
    simp [request] at hr
    exact hr.2
  · intro hid
    simp [request, h, hid]

theorem same_value_same_request {a b : Press} (hcall : a.call = b.call) (hid : a.id = b.id) :
    request a = request b := by
  simp [request, hcall, hid]

end EffectUi.Door
