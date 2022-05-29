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

async function postSVG({x, y, target}){
  let boardInfo = await miro.board.getInfo();
  let token = await miro.board.getIdToken();
  let image = target.getElementsByTagName("svg").item(0);
  //console.log(image);
  let fd = new FormData();
  let imageBlob = new Blob([image.outerHTML],
			   {type: 'image/svg+xml'});
  let dataBlob = new Blob([JSON.stringify({
    position: {x, y},
    geometry: {height: image.scrollHeight}
  })], {type:'application/json'});
  //console.log(imageBlob);
  fd.append('data', dataBlob);
  fd.append('resource', imageBlob, 'latex.svg');

  fetch(`http://localhost:3001/${boardInfo.id}/images`,
 	{
 	  method: 'POST',
	  headers: {Authorization: `Bearer ${token}`},
		    //'Content-Type': 'multipart/form-data'
		    //'Content-Type': 'applicationmulti/json'
	  body: fd //JSON.stringify({image:image.outerHTML})
	});
}

async function init(){
  await miro.board.ui.on('drop', postSVG);
  document.getElementById('render-button').onclick = convert;
  document.getElementById('test-button').onclick =
    async function test() {
      //console.log(this);
      this.classList.add('button-loading');
      let id = await miro.board.getInfo();
      let token = await miro.board.getIdToken();
      //this await never resolves if not in a board?
      //console.log('test button firing', token);
      let testcall = await fetch(`http://localhost:3001/${id.id}/sticky`, {
	method: 'POST',
	headers: {
	  Authorization: `Bearer ${token}`
	}});
      this.classList.remove('button-loading');
      if(testcall.status == 401){
	miro.board.ui.openModal({url: 'http://localhost:3001/auth'});
	console.log('unauth!!');
      }
      
      console.log(`from fetch ${testcall.url}:`, await testcall.text());
      //console.log(testcall);
    };
  //document.getElementById('test-button').onclick = postSVG;
}

init();

