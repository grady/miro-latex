function debounce(func, timeout=250){
  let timer = undefined;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => {func.apply(this,args);}, timeout);
  };
}

async function postSVG({x, y, target}){
  let button = document.getElementById('place-button');
  let image = target.getElementsByTagName('svg').item(0);
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
    await miro.board.createImage({url, x, y});
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
    window.localStorage.setItem('mathlive',
				JSON.stringify(target.checked || false));
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

  let mathliveToggle = document.getElementById('mathlive-toggle');
  
  mathliveToggle.addEventListener('change', mathliveToggleHandler);
  mathliveToggle.checked =
    JSON.parse(window.localStorage.getItem('mathlive'));
  mathliveToggleHandler({target: mathliveToggle});
  
  document.getElementById('place-button').onclick = buttonHandler;

  window.localStorage.setItem('panel-open',
			      JSON.stringify(window.location.pathname));
  
  await miro.board.ui.on('drop', postSVG);
}

window.addEventListener('visibilitychange', () => {
  if(document.visibilityState === 'hidden')
    window.localStorage.removeItem('panel-open');
  else
    window.localStorage
    .setItem('panel-open', JSON.stringify(window.location.pathname));
});


window.addEventListener('load', init);
