function debounce(func, timeout=250){
  let timer = undefined;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => {func.apply(this,args);}, timeout);
  };
}

// render latex to svg
async function convert() {
  let input = document.getElementById("texinput").value.trim();
  let output = document.getElementById("texoutput");
  
  output.textContent='';

  try {
    let svg = await MathJax.tex2svgPromise(input);
    output.appendChild(svg);
    MathJax.startup.document.clear();
    MathJax.startup.document.updateDocument();
  }
  catch(err){
    output
      .appendChild(document.createElement('pre'))
      .appendChild(document.createTextNode(err.message));
  }
}

async function init(){
  convert();
  
  let texinput = document.getElementById('texinput');
  texinput.oninput = debounce(convert, 500);
  texinput.select(); 
  texinput.focus();
  
  document.getElementById('place-button').onclick = buttonHandler;
      
  let [boardInfo, token, _] = await Promise.all([
    miro.board.getInfo(),
    miro.board.getIdToken(),
    miro.board.ui.on('drop', postSVG)
  ]);
 
  // drop event handler
  function postSVG({x, y, target}){
    let button = document.getElementById('place-button');
    let image = target.getElementsByTagName("svg").item(0);
    button.disabled=true;
    button.classList.add('button-loading');
    //change size attributes from ex to pixels (for Miro)
    image.setAttribute('width', image.scrollWidth);
    image.setAttribute('height', image.scrollHeight);
    //prepare form data
    let imageBlob = new Blob([image.outerHTML],
			     {type: 'image/svg+xml'});
    let dataBlob = new Blob([JSON.stringify({position: {x, y}})],
			    {type:'application/json'});
    let fd = new FormData();
    fd.append('data', dataBlob);
    fd.append('resource', imageBlob, 'latex.svg');
    //POST. If 401 try to authorize in modal
    fetch(`/api/${boardInfo.id}/images`, {
      method: 'POST',
      headers: {Authorization: `Bearer ${token}`},
      body: fd
    }).then(response => {
      switch(response.status){
      case 401:  //unauthorized, open modal to get it
	let query = response.headers.has('x-team-id') ?
	  '?team_id='+response.headers.get('x-team-id') : '';
	miro.board.ui.openModal({url:'/auth' + query});
	break;
      default:
      }
      button.disabled=false;
      button.classList.remove('button-loading');
    });
  }

  async function buttonHandler(){
    const vp = await miro.board.viewport.get();
    postSVG({
      x: vp.x + vp.width / 2,
      y: vp.y + vp.height / 2,
      target: document.getElementById('texoutput')
    });
  }
}

window.addEventListener('load', init);


