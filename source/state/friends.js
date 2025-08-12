
// source/state/friends.js
// Username-based friends list (no codes). UI-agnostic; persists to localStorage.
// Case-insensitive uniqueness; preserves original casing for display.
(function(){
  const KEY = 'etFriends';
  function read(){ try{ return JSON.parse(localStorage.getItem(KEY)||'[]'); } catch { return []; } }
  function write(list){ localStorage.setItem(KEY, JSON.stringify(list)); }

  function norm(u){ return String(u||'').trim(); }
  function key(u){ return norm(u).toLowerCase(); }

  function list(){ return read(); }

  function has(username){
    const k = key(username);
    return read().some(u => key(u) === k);
  }

  function add(username){
    const u = norm(username);
    if(!u) return { ok:false, error:'empty' };
    const friends = read();
    if(friends.some(x => key(x) == key(u))) return { ok:false, error:'exists' };
    friends.push(u);
    write(friends);
    emit('add', u);
    return { ok:true };
  }

  function remove(username){
    const k = key(username);
    const friends = read().filter(u => key(u) !== k);
    write(friends);
    emit('remove', username);
    return { ok:true };
  }

  function clear(){
    write([]);
    emit('clear');
  }

  function emit(type, detail){
    window.dispatchEvent(new CustomEvent('et:friends:'+type, { detail }));
  }

  window.ET_Friends = { list, add, remove, has, clear };
})();
