async function init() {
  
  miro.board.ui.on('icon:click', async () => {
    await miro.board.ui.openPanel({url: 'app.html'});
  });
}

init();

document.getElementById('content')
  .appendChild(document.createElement('p'))
  .appendChild(document.createTextNode('index.js ran'));
