async function convert() {
  let input = document.getElementById("texinput").value.trim();
  let button = document.getElementById("render-button");
  let output = document.getElementById("texoutput");
  
  button.disabled=true;
  button.classList.add('button-loading');
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
    button.disabled=false;
    button.classList.remove('button-loading');
  }  
  
}

async function init(){
  document.getElementById('render-button').onclick = convert;
  document.getElementById('test-button').onclick =
    async function test() {
      let token = await miro.board.getIdToken();
      //this await never resolves if not in a board?
      //console.log('test button firing', token);
      let testcall = await fetch('http://localhost:3001', {
	headers: {
	  Authorization: `Bearer ${token}`
	}});
      if(testcall.status == 401){
	miro.board.ui.openModal({url: 'http://localhost:3001/auth'});
	console.log('unauth!!');
      }
      console.log(`from fetch ${testcall.url}:`, await testcall.text());
      //console.log(testcall);
    };
}

init();
