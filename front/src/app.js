function debounce(func, timeout=250){
  let timer = undefined;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => {func.apply(this,args);}, timeout);
  };
}

async function postSVG({x, y, target}){
  let button = document.getElementById('place-button');
  let image = target.getElementsByTagName("svg").item(0);
  if(!image) return;

  let token = await miro.board.getIdToken();
  
  button.disabled=true;
  button.classList.add('button-loading');

  image.setAttribute('width', image.scrollWidth);
  image.setAttribute('height', image.scrollHeight);
  try { 
    let response = await fetch('/img', {
      method: 'POST',
      headers: {
	Authorization: 'Bearer ' + token,
	'Content-Type': 'image/svg+xml'
      },
      body: image.outerHTML
    });
    let {id} = await response.json();
    let url = document.location.origin + '/img/' + id;
    let board_image = await miro.board.createImage({url, x, y});
  } catch (err) {
    //console.log(err);
  }
  button.disabled=false;
  button.classList.remove('button-loading');
}

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

async function buttonHandler(){
  const vp = await miro.board.viewport.get();
  postSVG({
    x: vp.x + vp.width / 2,
    y: vp.y + vp.height / 2,
    target: document.getElementById('texoutput')
  });
}

async function init() {
  convert();

  let texinput = document.getElementById('texinput');
  let mathlive = document.getElementById('mathlive');
  mathlive.oninput = debounce(function(){
    texinput.value = mathlive.value;
    convert();
  }, 500);
  texinput.oninput = debounce(convert, 500);
  texinput.select(); 
  texinput.focus();

  document.getElementById('place-button').onclick = buttonHandler;

  console.log('attaching drop event listener');
  await miro.board.ui.on('drop', postSVG);
  console.log('drop event listener attached');
}

window.addEventListener('load', init);
