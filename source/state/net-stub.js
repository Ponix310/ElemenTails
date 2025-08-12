
// source/state/net-stub.js
// Placeholder "multiplayer": simulates networking state for UI testing.
const NetStub = (function(){
  let connected = false;
  const statusEl = ()=>document.getElementById('status');
  function update(msg){ if(statusEl()) statusEl().textContent = msg; }

  return {
    host(){
      Session.setRole('host');
      connected = true;
      update('Hosting room ' + (Session.getRoomCode() || '(no code)'));
    },
    join(){
      Session.setRole('guest');
      connected = true;
      update('Joined room ' + (Session.getRoomCode() || '(no code)'));
    },
    isConnected(){ return connected; }
  };
})();
