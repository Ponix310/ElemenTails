// source/phaser/firebase.js
// Firebase helpers: auth, friends, presence (with heartbeat), username save.
(function(){
  // Check if we're running in a supported environment
  const isSupported = location.protocol === 'http:' || location.protocol === 'https:' || location.protocol === 'chrome-extension:';
  
  let app, auth, db, provider;
  
  if (isSupported) {
    const cfg = {
      apiKey: "AIzaSyBaIjbM7dVNjKE7CJXPQOievhkiIF17rds",
      authDomain: "elementails.firebaseapp.com",
      projectId: "elementails",
      storageBucket: "elementails.firebasestorage.app",
      messagingSenderId: "497100635124",
      appId: "1:497100635124:web:aeeb25ead96b84751e57a1"
    };
    app = firebase.initializeApp(cfg);
    auth = firebase.auth();
    // Ensure auth persists across reloads so users don't need to login every time
    try {
      auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    } catch(e) { /* ignore if unsupported or already set */ }
    db = firebase.firestore();
    provider = new firebase.auth.GoogleAuthProvider();
  } else {
    console.warn('Firebase not supported in file:// protocol. Running in offline mode.');
    // Create mock objects for offline mode
    app = null;
    auth = { currentUser: null, onAuthStateChanged: () => () => {}, signInWithPopup: () => Promise.reject(new Error('Offline mode')) };
    db = null;
    provider = null;
  }

  // ---- Auth ----
  async function ensureAuth(){
    if (!isSupported) {
      console.warn('Auth not available in offline mode');
      return Promise.reject(new Error('Offline mode - no auth'));
    }
    return new Promise((resolve, reject) => {
      const unsub = auth.onAuthStateChanged(async (u) => {
        if (u) { unsub(); resolve(u); }
      });
      if (!auth.currentUser) {
        auth.signInWithPopup(provider).catch(err => { console.error(err); reject(err); });
      }
    });
  }

  // ---- Presence: heartbeat writer for self + robust reader for others ----
  let hbTimer = null;
  function startPresenceHeartbeat(){
    if (!isSupported) return;
    const u = auth.currentUser; if (!u) return;
    const ref = db.doc(`presence/${u.uid}`);
    // mark online immediately
    ref.set({ online:true, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true }).catch(()=>{});
    // update every 25s
    hbTimer = setInterval(()=>{
      ref.set({ online:true, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true }).catch(()=>{});
    }, 25000);

    // best-effort offline on tab close/hidden
    function goOffline(){
      ref.set({ online:false, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true }).catch(()=>{});
    }
    window.addEventListener('beforeunload', goOffline);
    document.addEventListener('visibilitychange', ()=>{
      if (document.visibilityState === 'hidden') goOffline();
      else ref.set({ online:true, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true }).catch(()=>{});
    });
  }
  function stopPresenceHeartbeat(){
    if (hbTimer){ clearInterval(hbTimer); hbTimer=null; }
  }
  // Reader: consider user online only if online==true AND updatedAt within 60s
  function onPresence(uid, cb){
    if (!isSupported) { cb(false); return () => {}; }
    const THRESH_MS = 60000;
    return db.doc(`presence/${uid}`).onSnapshot(snap => {
      let online = false;
      if (snap.exists){
        const d = snap.data();
        if (d && d.online){
          const t = (d.updatedAt && d.updatedAt.toDate && d.updatedAt.toDate()) || null;
          const age = t ? (Date.now() - t.getTime()) : Infinity;
          online = age < THRESH_MS;
        }
      }
      cb(online);
    });
  }

  // ---- Profiles & friends ----
  async function saveUsername(username){
    if (!isSupported) throw new Error('Offline mode - no database');
    // lower-case, 3-20, a-z 0-9 _
    if (!/^[a-z0-9_]{3,20}$/.test(username)) throw new Error('Invalid username (a-z, 0-9, _) 3–20 chars.');
    const u = auth.currentUser; if (!u) throw new Error('Not signed in');
    const profRef = db.doc(`publicProfiles/${u.uid}`);
    const claimRef = db.doc(`usernames/${username}`);
    // check claim
    const claim = await claimRef.get();
    if (claim.exists && claim.data().uid !== u.uid) throw new Error('Username taken');
    // fetch old to unclaim if different
    let oldU = null;
    const curr = await profRef.get();
    if (curr.exists && curr.data().username) oldU = curr.data().username;
    // batch
    const batch = db.batch();
    batch.set(profRef, { username, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });
    batch.set(claimRef, { uid: u.uid });
    if (oldU && oldU !== username) batch.delete(db.doc(`usernames/${oldU}`));
    await batch.commit();
    return username;
  }

  async function listFriends(uid){
    if (!isSupported) return [];
    const out = [];
    const fs = await db.collection(`users/${uid}/friends`).get();
    for (const doc of fs.docs){
      const fid = doc.id;
      let username = null;
      try {
        const prof = await db.doc(`publicProfiles/${fid}`).get();
        if (prof.exists && prof.data().username) username = prof.data().username;
      } catch {}
      out.push({ uid: fid, username });
    }
    return out;
  }

  window.ETFirebase = {
    app, auth, db, provider,
    ensureAuth,
    startPresenceHeartbeat, stopPresenceHeartbeat, onPresence,
    saveUsername, listFriends
  };
})();
