'use strict';
const sender=require('./career-submit.cjs');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function inspect(b){
 const fields=await b.evaluate(sender.inventoryExpression);
 for(const field of fields.filter(f=>f.role==='combobox'&&f.type==='text')){
  field.options_status='unavailable';field.options_complete=false;
  const selector=JSON.stringify('[data-career-field="'+field.index+'"]');
  try{
   const before=await b.evaluate('document.querySelector('+selector+')?.value');
   await b.evaluate('document.querySelector('+selector+')?.focus()');
   await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});
   await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});
   let choices=[];
   for(let i=0;i<5;i++){
    await pause(100);
    choices=await b.evaluate(`(()=>{const e=document.querySelector(${selector}),controlled=document.getElementById(e?.getAttribute('aria-controls')),scope=controlled||document;return [...scope.querySelectorAll('[role=option]')].filter(o=>o.getClientRects().length&&getComputedStyle(o).visibility!=='hidden').map(o=>o.innerText.trim()).filter(Boolean);})()`);
    if(choices.length)break;
   }
   await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
   await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
   const after=await b.evaluate('document.querySelector('+selector+')?.value');
   if(before!==after)throw Error('Option inspection changed field value');
   if(choices.length&&choices.length<=400){field.options=[...new Set(choices)];field.options_status='observed';}
  }catch{field.options_status='unavailable';}
 }
 return fields;
}
module.exports={inspect};
