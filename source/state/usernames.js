
// source/state/usernames.js
// Username reservation & change using Firebase Firestore.
// Requires window.firebase (App, Auth, Firestore) to be loaded on the page.
(function(){
  const NS = {};

  function getDb(){
    const db = window.firebase && window.firebase.firestore && window.firebase.firestore();
    if(!db) throw new Error('Firebase Firestore not available');
    return db;
  }
  function getAuth(){
    const auth = window.firebase && window.firebase.auth && window.firebase.auth();
    if(!auth) throw new Error('Firebase Auth not available');
    return auth;
  }

  // Allowed: letters, numbers, underscore. 3-20 chars.
  const RE = /^[A-Za-z0-9_]{3,20}$/;

  function normalize(username){ return String(username||'').trim(); }
  function lower(username){ return normalize(username).toLowerCase(); }

  async function getUserDoc(uid){
    const db = getDb();
    return db.collection('users').doc(uid).get();
  }

  async function checkAvailability(username){
    const db = getDb();
    const uLower = lower(username);
    if(!RE.test(username)) return { ok:false, reason:'invalid' };
    const snap = await db.collection('usernames').doc(uLower).get();
    if(snap.exists && snap.data() && snap.data().uid){
      return { ok:false, reason:'taken' };
    }
    return { ok:true };
  }

  // Reserve username and write user profile in a single transaction.
  async function reserveUsername(uid, desired){
    const db = getDb();
    const uNorm = normalize(desired);
    const uLower = lower(desired);
    if(!RE.test(uNorm)) throw Object.assign(new Error('invalid'), { code:'invalid' });

    const userRef = db.collection('users').doc(uid);
    const nameRef = db.collection('usernames').doc(uLower);
    const ts = window.firebase.firestore.FieldValue.serverTimestamp();

    await db.runTransaction(async (tx)=>{
      const nameDoc = await tx.get(nameRef);
      if(nameDoc.exists && nameDoc.data()?.uid && nameDoc.data().uid !== uid){
        throw Object.assign(new Error('taken'), { code:'taken' });
      }
      tx.set(nameRef, { uid, at: ts });
      tx.set(userRef, {
        uid,
        username: uNorm,
        usernameLower: uLower,
        updatedAt: ts,
        createdAt: ts
      }, { merge: true });
    });
    return { ok:true, username: uNorm };
  }

  // Change username: remove old mapping (if owned), add new mapping, update user doc.
  async function changeUsername(uid, next){
    const db = getDb();
    const nextNorm = normalize(next);
    const nextLower = lower(next);
    if(!RE.test(nextNorm)) throw Object.assign(new Error('invalid'), { code:'invalid' });

    const userRef = db.collection('users').doc(uid);
    const nextRef = db.collection('usernames').doc(nextLower);
    const ts = window.firebase.firestore.FieldValue.serverTimestamp();

    await db.runTransaction(async (tx)=>{
      const userDoc = await tx.get(userRef);
      const prevLower = userDoc.exists ? (userDoc.data()?.usernameLower || null) : null;

      const nextDoc = await tx.get(nextRef);
      if(nextDoc.exists && nextDoc.data()?.uid && nextDoc.data().uid !== uid){
        throw Object.assign(new Error('taken'), { code:'taken' });
      }

      // Clear previous mapping if owned
      if(prevLower && prevLower !== nextLower){
        const prevRef = db.collection('usernames').doc(prevLower);
        const prevDoc = await tx.get(prevRef);
        if(prevDoc.exists && prevDoc.data()?.uid === uid){
          tx.delete(prevRef);
        }
      }

      tx.set(nextRef, { uid, at: ts });
      tx.set(userRef, {
        username: nextNorm,
        usernameLower: nextLower,
        updatedAt: ts
      }, { merge: true });
    });
    return { ok:true, username: nextNorm };
  }

  async function getCurrentProfile(){
    const auth = getAuth();
    const user = auth.currentUser;
    if(!user) return null;
    const snap = await getUserDoc(user.uid);
    return snap.exists ? snap.data() : null;
  }

  // Expose API
  NS.checkAvailability = checkAvailability;
  NS.reserveUsername = reserveUsername;
  NS.changeUsername = changeUsername;
  NS.getCurrentProfile = getCurrentProfile;
  NS.regex = RE;

  window.Username = NS;
})();
