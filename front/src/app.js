import {deflate} from 'pako';

function debounce(func, timeout=250){
  let timer = undefined;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => {func.apply(this,args);}, timeout);
  };
}

async function postSVG({x, y, target}){
  let button = document.getElementById('place-button');
  let image = target.getElementsByTagName('svg')[0];
  let title = document.getElementById('texinput').value.trim() || 'latex output';
  
  if(!image) return;

  button.disabled=true;
  button.classList.add('button-loading');

  image.setAttribute('width', image.scrollWidth);
  image.setAttribute('height', image.scrollHeight);

  try {
    let token = await miro.board.getIdToken();
    let response = await fetch('/img', {
      method: 'POST',
      headers: {
	Authorization: 'Bearer ' + token,
	'Content-Type': 'image/svg+xml',
	'Content-Encoding': 'deflate'
      },
      body: deflate(image.outerHTML)
    });
    let {id} = await response.json();
    let url = document.location.origin + '/img/' + id;
    await miro.board.createImage({url, x, y, title});
  } catch (err) {
    //console.log(err);
  }
  button.disabled=false;
  button.classList.remove('button-loading');
}

async function convert(value) {
  let input = value || document.getElementById('texinput').value.trim();
  let output = document.getElementById('texoutput');
  
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
  let texinput = document.getElementById('texinput');
  let mathlive = document.getElementById('mathlive');

  function mathliveToggleHandler({target}){
    function display(isTrue) {return isTrue ? 'block' : 'none';}
    texinput.parentElement.style.display = display(!target.checked);
    mathlive.parentElement.style.display = display(target.checked);
  }
  
  mathlive.value = texinput.value;
  convert(texinput.value || texinput.placeholder);

  mathlive.addEventListener('input', debounce(() => {
    texinput.value = mathlive.getValue('latex-expanded');
    convert();
  }, 500));

  texinput.addEventListener('input', debounce(() => {
    mathlive.setValue(texinput.value, {suppressChangeNotifications: true});
    convert();
  }, 500));

  setupCheckbox(document.getElementById('mathlive-toggle'),
		'mathlive', mathliveToggleHandler);
  
  setupCheckbox(document.getElementById('virtkbd'),
		'virtkbd', ({target})=>{
		  mathlive.virtualKeyboardMode = target.checked ? 'onfocus' : 'off';
		});
  
  document.getElementById('place-button').onclick = buttonHandler;

  await miro.board.ui.on('drop', postSVG);
}

// persistent checkbox state using localStorage
function setupCheckbox(element, storageName, handler, callHandler=true){
  element.addEventListener('change', (evt) => {
    window.localStorage.setItem(
      storageName, JSON.stringify(evt.target.checked || false));
    handler(evt);
  });
  element.checked = !!JSON.parse(window.localStorage.getItem(storageName)) || false;
  if(callHandler) handler({target: element});
}

window.addEventListener('load', init);
