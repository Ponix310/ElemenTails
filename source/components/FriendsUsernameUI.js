// source/components/FriendsUsernameUI.js
// Production: Firebase-only Friends panel (validate by username, add/remove, realtime list).
// Requires Firebase Auth + Firestore already loaded on the page.
//
// Firestore structure used:
//   /usernames/{lowerUsername} -> { uid }
//   /users/{uid}/friends/{friendUid} -> { uid, username, usernameLower, addedAt }

(function () {
  const norm  = s => String(s || '').trim();
  const lower = s => norm(s).toLowerCase();

  // Minimal styles (only injected once)
  const css = `
    .et-friends { display:grid; gap:10px; }
    .et-friends-row { display:flex; gap:8px; align-items:center; }
    .et-friends-input { flex:1; padding:10px; border-radius:10px; border:1px solid #2a3147; background:#0f1320; color:#fff }
    .et-friends-btn { padding:10px 14px; border-radius:10px; border:0; background:#20c997; color:#06241e; font-weight:700; cursor:pointer }
    .et-friends-btn.secondary { background:#1e2433; color:#fff }
    .et-friends-status { min-height:18px; font-size:12px }
    .et-ok { color:#63e6be } .et-err { color:#ff6b6b } .et-muted { color:#9aa4b2 }
    .et-friends-list { display:grid; gap:6px }
    .et-friends-item { display:flex; align-items:center; justify-content:space-between; background:#0f1220; border:1px solid #2a3147; border-radius:10px; padding:8px 10px }
  `;
  function injectStyle() {
    if (document.getElementById('et-friends-style')) return;
    const st = document.createElement('style');
    st.id = 'et-friends-style';
    st.textContent = css;
    document.head.appendChild(st);
  }

  function el(tag, attrs = {}, children = []) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'style') Object.assign(n.style, v);
      else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else if (v != null) n.setAttribute(k, v);
    }
    (Array.isArray(children) ? children : [children]).forEach(c => n.append(c));
    return n;
  }

  let statusEl, listEl, inputEl, addBtn, unsubList = null;

  function setStatus(msg, ok = null) {
    if (!statusEl) return;
    statusEl.textContent = msg || '';
    statusEl.className = 'et-friends-status ' + (ok === true ? 'et-ok' : ok === false ? 'et-err' : 'et-muted');
  }

  function requireFirebase() {
    return !!(window.firebase && firebase.auth && firebase.firestore);
  }

  async function onAdd() {
    const v = norm(inputEl?.value);
    if (!v) return setStatus('Type a username.', false);
    if (!requireFirebase()) return setStatus('App not initialized.', false);

    const auth = firebase.auth();
    const db = firebase.firestore();
    const me = auth.currentUser;
    if (!me) return setStatus('Sign in first.', false);

    addBtn.disabled = true;
    setStatus('Searching…');

    try {
      const uLower = lower(v);
      const claim = await db.collection('usernames').doc(uLower).get();
      if (!claim.exists) return setStatus('User not found.', false);
      const friendUid = claim.data()?.uid;
      if (!friendUid) return setStatus('User not found.', false);
      if (friendUid === me.uid) return setStatus('That’s you 🙂', false);

      const prof = await db.collection('users').doc(friendUid).get();
      const display = prof.exists ? (prof.data()?.username || v) : v;

      const ref = db.collection('users').doc(me.uid).collection('friends').doc(friendUid);
      const existing = await ref.get();
      if (existing.exists) return setStatus('Already in your friends.', true);

      await ref.set({
        uid: friendUid,
        username: display,
        usernameLower: uLower,
        addedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      inputEl.value = '';
      setStatus('Friend added ✔', true);
    } catch (e) {
      setStatus('Could not add friend.', false);
    } finally {
      addBtn.disabled = false;
    }
  }

  async function onRemove(friendUid) {
    if (!requireFirebase()) return;
    const auth = firebase.auth();
    const db = firebase.firestore();
    const me = auth.currentUser;
    if (!me) return;

    try {
      await db.collection('users').doc(me.uid).collection('friends').doc(friendUid).delete();
      setStatus('Removed.', true);
    } catch {
      setStatus('Could not remove.', false);
    }
  }

  function renderList(items) {
    listEl.innerHTML = '';
    if (!items.length) {
      listEl.append(el('div', { class: 'et-muted' }, '(none yet)'));
      return;
    }
    items.forEach(it => {
      const name = it.username || it.usernameLower || it.id;
      const row = el('div', { class: 'et-friends-item' }, [
        el('span', {}, name),
        el('div', {}, [
          el('button', { class: 'et-friends-btn secondary', onclick: () => onRemove(it.id) }, 'Remove')
        ])
      ]);
      listEl.append(row);
    });
  }

  function startRealtime() {
    if (unsubList) { try { unsubList(); } catch {} unsubList = null; }
    if (!requireFirebase()) return setStatus('App not initialized.', false);

    const auth = firebase.auth();
    const db = firebase.firestore();

    auth.onAuthStateChanged(user => {
      if (unsubList) { try { unsubList(); } catch {} unsubList = null; }
      if (!user) {
        renderList([]);
        return setStatus('Sign in first.', false);
      }
      unsubList = db.collection('users').doc(user.uid).collection('friends')
        .orderBy('usernameLower')
        .onSnapshot(snap => {
          const items = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
          renderList(items);
          setStatus('Ready.', true);
        }, () => setStatus('Could not load friends.', false));
    });
  }

  function mount(container) {
    injectStyle();
    container.innerHTML = '';

    inputEl = el('input', {
      class: 'et-friends-input',
      placeholder: 'Enter username',
      onkeydown: e => { if (e.key === 'Enter') onAdd(); }
    });
    addBtn = el('button', { class: 'et-friends-btn', onclick: onAdd }, 'Add');
    statusEl = el('div', { class: 'et-friends-status et-muted' }, '');
    listEl = el('div', { class: 'et-friends-list' });

    container.append(
      el('div', { class: 'et-friends' }, [
        el('div', { class: 'et-friends-row' }, [inputEl, addBtn]),
        statusEl,
        listEl
      ])
    );

    startRealtime();
  }

  document.addEventListener('DOMContentLoaded', () => {
    const panel = document.getElementById('friends-panel');
    if (panel) mount(panel);
  });

  window.ET_FriendsUI = { mount };
})();