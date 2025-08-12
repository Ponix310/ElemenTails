
// source/state/router.js
window.Router = {
  to(href){ window.location.href = href; },
  goGame(){ this.to('game.html'); },
  goMenu(){ this.to('mainmenu.html'); }
};
