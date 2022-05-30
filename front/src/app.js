function debounce(func, timeout=250){
  let timer = undefined;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => {func.apply(this,args);}, timeout);
  };
}

async function convert() {
  let input = document.getElementById("texinput").value.trim();
  //let button = document.getElementById("render-button");
  let output = document.getElementById("texoutput");
  
  // button.disabled=true;
  // button.classList.add('button-loading');
  output.innerHTML='';

  try {
    let svg = await MathJax.tex2svgPromise(input);
    output.appendChild(svg);
    MathJax.startup.document.clear();
    MathJax.startup.document.updateDocument();
    //console.log(MathJax.svgStylesheet());
  }
  catch(err){
    output
      .appendChild(document.createElement('pre'))
      .appendChild(document.createTextNode(err.message));
  }
  finally {
  //   button.disabled=false;
  //   button.classList.remove('button-loading');
  }  
  
}

// drop event handler
async function postSVG({x, y, target}){
  let [boardInfo, token] = await Promise.all([
    miro.board.getInfo(),
    miro.board.getIdToken()
  ]);
  let image = target.getElementsByTagName("svg").item(0);
  image.setAttribute('width', image.scrollWidth);
  image.setAttribute('height', image.scrollHeight);
  //console.log(image);

  let fd = new FormData();
  let imageBlob = new Blob([image.outerHTML],
			   {type: 'image/svg+xml'});
  let dataBlob = new Blob([JSON.stringify({
    position: {x, y}
    // geometry: {width: image.scrollWidth}
  })],
			  {type:'application/json'});
  
  fd.append('data', dataBlob);
  fd.append('resource', imageBlob, 'latex.svg');

  fetch(`http://localhost:3001/${boardInfo.id}/images`, {
    method: 'POST',
    headers: {Authorization: `Bearer ${token}`},
    body: fd
  }).then(response => {
    console.log('foo');
    switch(response.status){
    case 401: 
      miro.board.ui.openModal({url:'http://localhost:3001/auth'});
      break;
    default:
    }
  });
}


function init(){
  miro.board.ui.on('drop', postSVG);
  document.getElementById("texinput").oninput = debounce(convert, 500);
}

init();

