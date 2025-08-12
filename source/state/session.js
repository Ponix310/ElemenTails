
// source/state/session.js
const KEY = 'etSession';
const Session = (function(){
  function read(){ try{ return JSON.parse(localStorage.getItem(KEY)||'{}'); }catch{return{};} }
  function write(obj){ localStorage.setItem(KEY, JSON.stringify(obj)); }
  function set(key, val){ const s = read(); s[key]=val; write(s); }
  const api = {
    getName(){ return read().playerName || ''; },
    setName(v){ set('playerName', v); },
    getRoomCode(){ return read().roomCode || ''; },
    setRoomCode(v){ set('roomCode', v); },
    setRole(v){ set('role', v); },
    getRole(){ return read().role || 'guest'; },
    mockFill(){
      api.setName('Ponix'); api.setRoomCode('59Y09N'); api.setRole('host');
      alert('Demo values filled.');
    }
  };
  window.Session = api;
  return api;
})();
