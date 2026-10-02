const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const exported = {exports:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../assistant-pcm.js'),'utf8'),{module:exported});
const {create} = exported.exports;
function setup() {
  const scheduled = [];
  const context = {
    currentTime:0, destination:{},
    createBuffer(_channels, length, rate) { const samples=new Float32Array(length);return {duration:length/rate,samples,getChannelData:()=>samples}; },
    createBufferSource() { return {connect(){},start(time){this.time=time;scheduled.push(this);},stop(){this.stopped=true;}}; }
  };
  return {context,scheduled,player:create(context)};
}
const pcm = seconds => new Uint8Array(Math.round(seconds*24000)*2);
test('audio builds a cushion and chunks stay contiguous through network jitter',()=>{
  const {context,scheduled,player}=setup();
  player.push(pcm(.3));assert.equal(scheduled.length,0);
  context.currentTime=.22;player.push(pcm(.4));
  assert.equal(scheduled.length,1);
  context.currentTime=.5;player.push(pcm(.2));
  assert.equal(scheduled.length,2);
  assert.equal(scheduled[1].time,scheduled[0].time+scheduled[0].buffer.duration);
  context.currentTime=2;player.push(pcm(.1));
  assert.equal(scheduled.length,2,'after a stall, tiny chunks wait for a new cushion');
  player.push(pcm(.6));assert.equal(scheduled.length,3);
  assert.ok(scheduled[2].time>context.currentTime);
});
test('odd-byte boundaries and the last short chunk preserve every PCM sample',()=>{
  const {scheduled,player}=setup();
  player.push(new Uint8Array([0,128,255]));player.push(new Uint8Array([127,0,0]));
  assert.equal(scheduled.length,0);player.finish();
  assert.deepEqual(Array.from(scheduled[0].buffer.samples),[-1,32767/32768,0]);
});
test('cancel discards buffered audio and stops already scheduled sources',()=>{
  const {scheduled,player}=setup();player.push(pcm(.7));player.push(pcm(.05));player.stop();
  player.finish();player.push(pcm(1));assert.equal(scheduled.length,1);assert.equal(scheduled[0].stopped,true);
});
test('ending a phrase flushes the remaining audio and clears speaking only after playback',()=>{
  let drained=0;const {context,scheduled}=setup();const player=create(context,{onDrain:()=>drained++});
  player.push(pcm(.7));player.push(pcm(.06));player.finish();
  assert.equal(scheduled.length,2);assert.equal(drained,0);
  assert.equal(scheduled[1].time,scheduled[0].time+.7);
  scheduled.forEach(source=>source.onended());assert.equal(drained,1);
});
