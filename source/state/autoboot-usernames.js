
// source/state/autoboot-usernames.js
// Auto-enforce username after Firebase login, with a minimal modal UI.
// Injects its own CSS; no external stylesheet needed.
(function(){
  if(!(window.firebase && window.firebase.auth && window.firebase.firestore)){
    console.warn('[UsernameGate] Firebase not detected on page.');
    return;
  }
  if(!window.Username || !window.Username.reserveUsername){
    console.warn('[UsernameGate] usernames.js not loaded; include source/state/usernames.js before this file.');
    return;
  }

  // Styles
  const css = `
  .ugate-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:99999}
  .ugate-card{width:min(520px, 92vw);background:#121520;color:#e9eef5;border-radius:14px;box-shadow:0 18px 60px rgba(0,0,0,.5);padding:20px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto}
  .ugate-h{margin:0 0 10px 0;font-size:20px}
  .ugate-p{margin:0 0 12px 0;color:#9aa4b2}
  .ugate-row{display:flex;gap:10px;align-items:center}
  .ugate-input{flex:1;padding:12px;border-radius:10px;border:1px solid #2a3147;background:#0f1320;color:#fff;font-size:15px}
  .ugate-btn{appearance:none;border:0;border-radius:10px;padding:12px 16px;font-weight:700;cursor:pointer;background:#20c997;color:#06241e}
  .ugate-btn:disabled{opacity:.6;cursor:not-allowed}
  .ugate-status{min-height:18px;font-size:12px;margin-top:8px}
  .ugate-error{color:#ff6b6b}
  .ugate-ok{color:#63e6be}
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  let mounted = null;

  function open(usernameSuggest){
    if(mounted) return;
    const root = document.createElement('div');
    root.className = 'ugate-backdrop';
    root.innerHTML = `
      <div class="ugate-card">
        <h2 class="ugate-h">Pick a username</h2>
        <p class="ugate-p">Choose how others will find you. You can change this later.</p>
        <div class="ugate-row">
          <input id="ugate-input" class="ugate-input" placeholder="username" value="${usernameSuggest||''}" />
          <button id="ugate-btn" class="ugate-btn" disabled>Save</button>
        </div>
        <div id="ugate-status" class="ugate-status"></div>
      </div>
    `;
    document.body.appendChild(root);
    mounted = root;

    const input = root.querySelector('#ugate-input');
    const btn = root.querySelector('#ugate-btn');
    const status = root.querySelector('#ugate-status');

    let last = '';
    let valid = false;
    function setStatus(msg, ok){
      status.textContent = msg || '';
      status.className = 'ugate-status ' + (ok ? 'ugate-ok' : 'ugate-error');
    }

    async function validate(){
      const v = String(input.value||'').trim();
      if(v === last) return;
      last = v;
      if(!window.Username.regex.test(v)){
        valid = false;
        btn.disabled = true;
        if(v.length) setStatus('3–20 letters/numbers/underscore only.', false); else setStatus('', false);
        return;
      }
      setStatus('Checking availability…', true);
      try{
        const res = await window.Username.checkAvailability(v);
        if(res.ok){
          valid = true; btn.disabled = false;
          setStatus('Available ✔', true);
        }else{
          valid = false; btn.disabled = true;
          setStatus(res.reason === 'taken' ? 'That name is taken.' : 'Invalid username.', false);
        }
      }catch(err){
        valid = false; btn.disabled = true;
        setStatus('Error checking availability.', false);
      }
    }

    input.addEventListener('input', validate);
    input.addEventListener('keydown', (e)=>{ if(e.key==='Enter' && !btn.disabled) submit(); });
    btn.addEventListener('click', submit);

    setTimeout(()=> input.focus(), 0);

    async function submit(){
      if(!valid) return;
      btn.disabled = true;
      btn.textContent = 'Saving…';
      const auth = firebase.auth();
      const user = auth.currentUser;
      try{
        await window.Username.reserveUsername(user.uid, input.value);
        close();
      }catch(err){
        console.error(err);
        btn.disabled = false;
        btn.textContent = 'Save';
        const code = err && err.code || '';
        setStatus(code === 'taken' ? 'That name was just taken—try another.' : 'Could not save username.', false);
      }
    }
  }

  function close(){
    if(mounted){
      mounted.remove();
      mounted = null;
    }
  }

  // Public API for later "Change username" action
  window.UsernameGate = {
    open, close
  };

  // Enforce on login
  firebase.auth().onAuthStateChanged(async (user)=>{
    if(!user) return;
    try{
      const prof = await window.Username.getCurrentProfile();
      const needs = !(prof && prof.username);
      if(needs){
        const guess = (user.displayName || '').split(' ')[0] || '';
        open(guess.replace(/[^A-Za-z0-9_]/g, ''));
      }
    }catch(e){
      console.warn('[UsernameGate] Could not check profile:', e);
    }
  });
})();
