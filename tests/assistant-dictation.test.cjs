const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function element() {
  const listeners = {};
  const classes = new Set();
  return {
    hidden:true, disabled:false, value:'', style:{}, scrollHeight:30, scrollTop:0,
    listeners, children:[],
    classList:{ add:(...names)=>names.forEach(name=>classes.add(name)), remove:(...names)=>names.forEach(name=>classes.delete(name)), toggle:()=>{} },
    addEventListener:(name,handler)=>{ listeners[name]=handler; },
    setAttribute(){}, removeAttribute(){}, focus(){}, load(){}, pause(){},
    append(...children){ this.children.push(...children); },
    replaceChildren(){ this.children=[]; },
    remove(){}, querySelector(){ return null; }, querySelectorAll(){ return []; }
  };
}

test('dictation displays words while speaking and sends only text after stopping', async () => {
  const nodes = new Map();
  const get = selector => {
    if (!nodes.has(selector)) nodes.set(selector, element());
    return nodes.get(selector);
  };
  const requests = [];
  let recognizer;
  let audioPlays = 0;
  class Recognition {
    constructor(){ recognizer=this;this.listeners={}; }
    addEventListener(name,handler){ this.listeners[name]=handler; }
    start(){ this.starts=(this.starts||0)+1; }
    stop(){ this.listeners.end?.(); }
    abort(){}
    emit(name,event){ this.listeners[name]?.(event); }
  }
  class Audio {
    addEventListener(){} pause(){} removeAttribute(){} load(){}
    async play(){ audioPlays += 1; }
  }
  const document = {
    querySelector:get, createElement:element, addEventListener(){}
  };
  const context = {
    document, window:{ SpeechRecognition:Recognition, setTimeout }, Audio,
    localStorage:{ getItem:()=> 'off' }, location:{ search:'' }, URLSearchParams,
    fetch:async (url,options) => {
      requests.push({url,body:options?.body});
      return url.endsWith('/speech')
        ? { ok:true, blob:async()=>({type:'audio/wav',size:100}) }
        : { ok:true, json:async()=>url.endsWith('/status') ? {configured:true} : {reply:'Podemos revisarlo en el taller.'} };
    },
    setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame:handler=>handler(),
    URL:{ createObjectURL:()=> 'blob:voice', revokeObjectURL(){} },AbortController
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../assistant-widget.js'),'utf8'),context);
  get('#assistant-launcher').listeners.click();
  await new Promise(resolve=>setImmediate(resolve));
  get('#assistant-mic').listeners.click();
  recognizer.emit('result',{results:[{0:{transcript:'Mi auto hace ruido al frenar'},isFinal:true}]});
  assert.equal(get('#assistant-input').value,'Mi auto hace ruido al frenar');
  recognizer.emit('end');
  await new Promise(resolve=>setTimeout(resolve,170));
  assert.equal(recognizer.starts,2);
  recognizer.emit('result',{results:[{0:{transcript:'y vibra en la ruta'},isFinal:true}]});
  assert.equal(get('#assistant-input').value,'Mi auto hace ruido al frenar y vibra en la ruta');
  get('#assistant-stop-recording').listeners.click();
  await new Promise(resolve=>setImmediate(resolve));
  const chats = requests.filter(request=>request.url.endsWith('/chat'));
  assert.equal(chats.length,1);
  assert.equal(JSON.parse(chats[0].body).messages[0].content,'Mi auto hace ruido al frenar y vibra en la ruta');
  assert.ok(requests.every(request=>!request.url.includes('/voice')&&!request.url.includes('/transcribe')));
  assert.equal(get('#assistant-input').value,'');
  get('#assistant-voice-toggle').listeners.click();
  get('#assistant-input').value='¿Podés revisarlo?';
  get('#assistant-composer').listeners.submit({preventDefault(){}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.ok(requests.some(request=>request.url.endsWith('/speech')));
  assert.equal(audioPlays,1);
});
