// async function init(){
//   let token = await miro.board.getIdToken();
//   let result = await fetch('http://localhost:3001/who',
// 			   {headers: {Authorization: `Bearer ${token}`}});
//   let id = await result.text();
//   document.getElementById("content")
//     .appendChild(document.createElement('p'))
//     .appendChild(document.createTextNode(id));
//   setTimeout(miro.board.ui.closeModal, 3000);
// }
//
//init();
miro.board.ui.closeModal();
