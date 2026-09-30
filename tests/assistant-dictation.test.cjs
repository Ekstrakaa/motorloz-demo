const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function element() {
  const listeners = {};
  const classes = new Set();
  return {
    hidden:true, disabled:false, value:'', style:{}, scrollHeight:30, scrollTop:0, dataset:{},
    listeners, children:[],
    classList:{ add:(...names)=>names.forEach(name=>classes.add(name)), remove:(...names)=>names.forEach(name=>classes.delete(name)), contains:name=>classes.has(name), toggle:()=>{} },
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
  get('#assistant-booking-form').elements = { issue: element() };
  const requests = [];
  const recognizers = [];
  let audioPlays = 0;
  class Recognition {
    constructor(){ recognizers.push(this);this.listeners={}; }
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
    querySelector:get, createElement:element, createTextNode:text=>({textContent:text}), addEventListener(){}
  };
  const context = {
    document, window:{ SpeechRecognition:Recognition, setTimeout }, Audio,
    location:{ search:'' }, URLSearchParams,
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
  assert.equal(recognizers[0].continuous,false);
  recognizers[0].emit('result',{results:[{0:{transcript:'Mi auto hace ruido al frenar'},isFinal:true}]});
  assert.equal(get('#assistant-input').value,'Mi auto hace ruido al frenar');
  recognizers[0].emit('end');
  await new Promise(resolve=>setTimeout(resolve,270));
  assert.equal(recognizers.length,2);
  recognizers[1].emit('result',{results:[{0:{transcript:'y vibra en la ruta'},isFinal:true}]});
  assert.equal(get('#assistant-input').value,'Mi auto hace ruido al frenar y vibra en la ruta');
  get('#assistant-stop-recording').listeners.click();
  await new Promise(resolve=>setImmediate(resolve));
  const chats = requests.filter(request=>request.url.endsWith('/chat'));
  assert.equal(chats.length,1);
  assert.equal(JSON.parse(chats[0].body).messages[0].content,'Mi auto hace ruido al frenar y vibra en la ruta');
  assert.ok(requests.every(request=>!request.url.includes('/voice')&&!request.url.includes('/transcribe')));
  assert.equal(get('#assistant-input').value,'');
  const spokenBeforeNextMessage = audioPlays;
  get('#assistant-input').value='¿Podés revisarlo?';
  get('#assistant-composer').listeners.submit({preventDefault(){}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.ok(requests.some(request=>request.url.endsWith('/speech')));
  assert.ok(audioPlays > spokenBeforeNextMessage);

  const recognizersBeforeSilentStop = recognizers.length;
  get('#assistant-mic').listeners.click();
  recognizers[recognizersBeforeSilentStop].emit('end');
  await new Promise(resolve=>setTimeout(resolve,450));
  assert.equal(recognizers.length, recognizersBeforeSilentStop+2, 'mobile-style early end opens a fresh listening session');
  recognizers.at(-1).emit('result',{results:[{0:{transcript:'El motor vibra'},isFinal:true}]});
  get('#assistant-stop-recording').listeners.click();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(JSON.parse(requests.filter(request=>request.url.endsWith('/chat')).at(-1).body).messages.at(-1).content,'El motor vibra');

  const recognizersBeforeNetworkCut = recognizers.length;
  get('#assistant-mic').listeners.click();
  recognizers[recognizersBeforeNetworkCut].emit('error',{error:'network'});
  await new Promise(resolve=>setTimeout(resolve,1260));
  assert.equal(recognizers.length, recognizersBeforeNetworkCut+2, 'a transient recognition error does not freeze the microphone');
  get('#assistant-close').listeners.click();
});
