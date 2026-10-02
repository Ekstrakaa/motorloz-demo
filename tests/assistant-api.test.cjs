const assert = require('node:assert/strict');
const test = require('node:test');
const { EventEmitter } = require('node:events');
const { handle } = require('../openai-assistant.cjs');

function response() {
  return {
    headers: {},
    chunks: [],
    setHeader(name, value) { this.headers[name] = value; },
    write(chunk) { this.chunks.push(Buffer.from(chunk)); },
    end(body) { this.body = body; }
  };
}


const facts = overrides => ({name:'',vehicle:'',year:'',mileage:'',issue:'',circumstances:'',urgency:'',...overrides});
const output = answer => ({status:'completed',output:[{type:'message',content:[{type:'output_text',text:typeof answer === 'string' ? answer : JSON.stringify(answer)}]}]});
async function chat(messages, answer, intake) {
  process.env.OPENAI_API_KEY = 'test-key';
  const old = global.fetch;
  let request;
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    request = JSON.parse(options.body);
    return {ok:true,json:async()=>output(answer)};
  };
  try {
    const res = response();
    await handle({method:'POST',body:{messages,intake},headers:{'x-forwarded-for':Math.random().toString()},socket:{}},res,'chat');
    assert.equal(res.statusCode,200);
    return {body:JSON.parse(res.body),request};
  } finally {global.fetch=old;delete process.env.OPENAI_API_KEY;}
}

test('OpenAI receives real user and assistant turns, including the answer to its last question', async()=>{
  const messages = [
    {role:'user',content:'Tengo un Subaru Impreza y escucho un golpeteo.'},
    {role:'assistant',content:'¿En qué situación lo escuchás?'},
    {role:'user',content:'Al acelerar.'}
  ];
  const {body,request}=await chat(messages,{reply:'Puede venir de varias zonas. ¿Desde cuándo empezó?',offerWhatsApp:false,facts:facts({vehicle:'Subaru Impreza',issue:'Golpeteo',circumstances:'Al acelerar'})});
  assert.deepEqual(request.input,messages);
  assert.match(request.instructions,/no vuelvas a preguntar lo mismo/);
  assert.match(request.instructions,/200 mil/);
  assert.equal(request.store,false);
  assert.equal(request.model,'gpt-4.1-mini');
  assert.equal(request.text.format.strict,true);
  assert.equal(body.source,'openai');
  assert.equal(body.facts.circumstances,'Al acelerar');
  assert.doesNotMatch(body.reply,/en qué situación/i);
});

test('first messages use OpenAI too, without generic hardcoded questions',async()=>{
  const {request,body}=await chat([{role:'user',content:'No arranca mi Subaru Impreza.'}],{reply:'Entiendo. ¿El motor gira cuando intentás arrancar?',offerWhatsApp:false,facts:facts({vehicle:'Subaru Impreza',issue:'No arranca'})});
  assert.equal(request.input[0].content,'No arranca mi Subaru Impreza.');
  assert.doesNotMatch(body.reply,/qué notaste exactamente/i);
});

test('short answers supply the intake used by the real WhatsApp control',async()=>{
  const messages=[{role:'user',content:'Quiero llevar mi Subaru Impreza por un ruido al acelerar.'},
    {role:'assistant',content:'¿Qué kilometraje tiene?'},{role:'user',content:'200 mil'},
    {role:'assistant',content:'¿Cómo te llamás?'},{role:'user',content:'Manuel Leone'},
    {role:'assistant',content:'¿Puede esperar una fecha?'},{role:'user',content:'Sí, puede esperar.'}];
  const {body}=await chat(messages,{reply:'Perfecto, Manuel. Podés revisar la solicitud en WhatsApp.',offerWhatsApp:true,facts:facts({name:'Manuel Leone',vehicle:'Subaru Impreza',mileage:'200.000 km aprox.',issue:'Ruido al acelerar',circumstances:'Al acelerar',urgency:'Puede esperar una fecha coordinada'})});
  assert.equal(body.handoffReady,true);
  assert.equal(body.facts.name,'Manuel Leone');
  assert.equal(body.facts.mileage,'200.000 km aprox.');
});

test('missing data cannot be bypassed by frontend booleans or a premature model offer',async()=>{
  const {body}=await chat([{role:'user',content:'Quiero un turno para mi Subaru.'}],{reply:'Podés tocar el botón de WhatsApp.',offerWhatsApp:true,facts:facts({vehicle:'Subaru'})},{name:true,vehicle:true,mileage:true,issue:true,urgency:true});
  assert.equal(body.handoffReady,false);
  assert.doesNotMatch(body.reply,/botón de WhatsApp/i);
  assert.doesNotMatch(body.reply,/cómo te llamás/i,'guard does not fabricate another repeated question');
});

test('consultation alone never creates a handoff, even when all data is known',async()=>{
  const {body}=await chat([{role:'user',content:'Solo quiero saber qué podría ser.'}],{reply:'Podría involucrar varios componentes; hay que revisarlo para confirmarlo.',offerWhatsApp:true,facts:facts({name:'Manuel',vehicle:'Subaru Impreza',mileage:'200.000 km',issue:'Ruido',circumstances:'Al acelerar',urgency:'Puede esperar'})});
  assert.equal(body.handoffReady,false);
});

test('known mileage is never requested again when the provider tries to reconfirm it',async()=>{
  const {body,request}=await chat([{role:'user',content:'Me llamo Manuel, Subaru Impreza de 200 mil km, ruido al acelerar desde ayer, puede esperar. Quiero llevarlo.'}],{
    facts:facts({name:'Manuel',vehicle:'Subaru Impreza',mileage:'200 mil',issue:'Golpeteo',circumstances:'Al acelerar desde ayer',urgency:'Puede esperar'}),
    offerWhatsApp:true,reply:'Perfecto, Manuel. Para preparar todo bien, me confirmás porfa el año de tu Subaru Impreza y los kilómetros aproximados? Así tenemos todo listo para cuando quieras traerlo.'
  });
  assert.deepEqual(Object.keys(request.text.format.schema.properties),['facts','offerWhatsApp','reply']);
  assert.equal(body.handoffReady,true);
  assert.doesNotMatch(body.reply,/confirmás|kilómetros aproximados/);
  assert.match(body.reply,/botón de WhatsApp/);
});

test('the condition and start already answered cannot be requested a second time',async()=>{
  const {body}=await chat([{role:'assistant',content:'¿En qué situación lo notás?'},{role:'user',content:'Al acelerar, empezó ayer.'}],{
    facts:facts({vehicle:'Subaru Impreza',issue:'Golpeteo al acelerar',circumstances:'Desde ayer'}),offerWhatsApp:false,
    reply:'Lo anoté. ¿En qué situación lo notás? ¿Desde cuándo empezó?'
  });
  assert.equal(body.reply,'Lo anoté.');
});

test('serves the selected Cedar voice without requiring Gemini for narration', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  const geminiKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  const previousFetch = global.fetch;
  let request;
  const wav = Buffer.from('RIFFtest-WAVE-audio');
  global.fetch = async (_url, options) => {
    request = JSON.parse(options.body);
    return { ok: true, arrayBuffer: async () => Buffer.concat([wav, Buffer.alloc(44)]) };
  };
  try {
    const res = response();
    await handle({ method: 'POST', body: { text: 'Hola, soy MOTORLOZ, Pablo Lozano.' }, headers: {}, socket: {} }, res, 'speech');
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['Content-Type'], 'audio/wav');
    assert.equal(Buffer.compare(res.body.subarray(0,wav.length), wav), 0);
    assert.equal(request.voice, 'cedar');
    assert.equal(request.model, 'gpt-4o-mini-tts');
    assert.equal(request.response_format, 'wav');
    assert.equal(request.input, 'Hola, soy Motor Los, Pablo Lozano.');
    assert.match(request.instructions, /uruguayo de Montevideo/);
    assert.match(request.instructions, /nunca Motorola/);
    assert.equal(res.headers['X-Voice'], 'cedar');
  } finally {
    global.fetch = previousFetch;
    if(geminiKey) process.env.GEMINI_API_KEY = geminiKey;
    delete process.env.OPENAI_API_KEY;
  }
});

test('streams fixed-voice audio chunks without waiting for the complete recording', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  const previousFetch = global.fetch;
  const pcm = Buffer.from([0, 0, 12, 1]);
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  let request;
  global.fetch = async (_url, options) => {
    request = JSON.parse(options.body);
    return { ok: true, body: ReadableStream.from((async function*(){ yield pcm.subarray(0,3); await pending; yield pcm.subarray(3); })()) };
  };
  try {
    const res = response();
    const handling = handle({ method: 'POST', body: { text: 'Hola, te escucho.', voice: 'other' }, headers: {}, socket: {} }, res, 'speech-stream');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(res.chunks.length, 1, 'first audio is sent while provider is still generating');
    release();
    await handling;
    assert.equal(res.statusCode, 200);
    assert.match(res.headers['Content-Type'], /text\/event-stream/);
    const frames = Buffer.concat(res.chunks).toString().trim().split('\n\n').map(frame => JSON.parse(frame.slice(6)));
    assert.deepEqual(Buffer.concat(frames.map(frame => Buffer.from(frame.delta.data, 'base64'))), pcm);
    assert.equal(request.response_format, 'pcm');
    assert.equal(request.voice, 'cedar');
  } finally {
    global.fetch = previousFetch;
    release();
    delete process.env.OPENAI_API_KEY;
  }
});

test('stops generating voice when the visitor interrupts playback', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  const previousFetch = global.fetch;
  let aborted = false;
  global.fetch = async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')); });
  });
  try {
    const req = Object.assign(new EventEmitter(), { method:'POST', body:{ text:'Hola, soy MOTORLOZ.' }, headers:{}, socket:{} });
    const res = Object.assign(new EventEmitter(), response());
    const handling = handle(req, res, 'speech-stream');
    await new Promise(resolve => setImmediate(resolve));
    res.emit('close');
    await handling;
    assert.equal(aborted, true);
    assert.equal(res.body, undefined);
  } finally { global.fetch = previousFetch; delete process.env.OPENAI_API_KEY; }
});

test('an exhausted OpenAI balance never calls Gemini or changes the selected voice', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  const previousFetch = global.fetch;
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push(JSON.parse(options.body));
    assert.equal(url, 'https://api.openai.com/v1/audio/speech');
    return { ok: false, status: 429, json: async () => ({error:{code:'insufficient_quota'}}) };
  };
  try {
    const res = response();
    await handle({ method: 'POST', body: { text: 'Hola' }, headers: {}, socket: {} }, res, 'speech-stream');
    assert.equal(res.statusCode, 429);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].voice, 'cedar');
    assert.equal(JSON.parse(res.body).error, 'saldo_openai_agotado');
  } finally { global.fetch = previousFetch; delete process.env.OPENAI_API_KEY; }
});

test('reports an interrupted audio stream so the browser can offer a complete replay', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  const previousFetch = global.fetch;
  global.fetch = async () => ({ ok:true, body:ReadableStream.from((async function*(){
    yield Buffer.from([0,0]);
    throw new Error('connection lost');
  })()) });
  try {
    const res = response();
    await handle({ method:'POST', body:{text:'Una respuesta completa.'}, headers:{}, socket:{} }, res, 'speech-stream');
    assert.equal(res.statusCode, 200);
    const events = Buffer.concat(res.chunks).toString().trim().split('\n\n').map(frame=>JSON.parse(frame.slice(6)));
    assert.equal(events[0].delta.type, 'audio');
    assert.equal(events.at(-1).error.code, 'voice_interrupted');
  } finally { global.fetch = previousFetch; delete process.env.OPENAI_API_KEY; }
});


test('summary uses OpenAI and only customer statements, never assistant suggestions',async()=>{
  process.env.OPENAI_API_KEY='test-key';
  const old=global.fetch;
  let request;
  global.fetch=async(url,options)=>{
    assert.equal(url,'https://api.openai.com/v1/responses');request=JSON.parse(options.body);
    return {ok:true,json:async()=>output('Después de pasar un pozo comenzó un ruido al acelerar.')};
  };
  try {
    const res=response();
    await handle({method:'POST',body:{messages:[{role:'user',content:'Después de un pozo hace ruido al acelerar.'},{role:'assistant',content:'¿También falla el freno?'}]},headers:{'x-forwarded-for':'summary-test'},socket:{}},res,'summary');
    assert.equal(res.statusCode,200);
    assert.match(request.input[0].content,/pozo/);
    assert.doesNotMatch(request.input[0].content,/falla el freno/);
    assert.match(JSON.parse(res.body).summary,/al acelerar/);
  }finally{global.fetch=old;delete process.env.OPENAI_API_KEY;}
});

test('provider outages return a real error instead of repeating a generic question',async()=>{
  process.env.OPENAI_API_KEY='test-key';const old=global.fetch;let calls=0;
  global.fetch=async(url)=>{calls++;assert.match(url,/api.openai.com/);return {ok:false,status:503,json:async()=>({error:{code:'unavailable'}})};};
  try {
    const res=response();
    await handle({method:'POST',body:{messages:[{role:'user',content:'Al acelerar.'}]},headers:{'x-forwarded-for':'outage-test'},socket:{}},res,'chat');
    assert.equal(res.statusCode,502);assert.equal(calls,1);
    assert.equal(JSON.parse(res.body).reply,undefined);
    assert.match(JSON.parse(res.body).message,/Conservé/);
  }finally{global.fetch=old;delete process.env.OPENAI_API_KEY;}
});

test('status and chat require only OpenAI, and obsolete audio input is rejected',async()=>{
  process.env.OPENAI_API_KEY='test-key';delete process.env.GEMINI_API_KEY;
  const res=response();await handle({method:'GET'},res,'status');
  assert.equal(JSON.parse(res.body).configured,true);
  assert.equal(JSON.parse(res.body).provider,'openai');
  for(const action of ['voice','transcribe']){
    const responseObject=response();await handle({method:'POST'},responseObject,action);assert.equal(responseObject.statusCode,404);
  }
  delete process.env.OPENAI_API_KEY;
});
