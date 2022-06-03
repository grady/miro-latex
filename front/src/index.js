async function init() {
  miro.board.ui.on('icon:click', async () => {
    await miro.board.ui.openPanel({url: 'app.html'});
  });
  let lastPanel = JSON.parse(window.localStorage.getItem('panel-open'));;
  if(lastPanel) miro.board.ui.openPanel({url: lastPanel});
}

init();
