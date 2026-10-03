'use strict';
(() => {
  const defaults = [
    {name:'Hyundai en movimiento',type:'video',src:'assets/cinema-hyundai-natural.mp4',thumb:'assets/clips/hyundai-home.jpg',duration:15,label:'HYUNDAI · EN MOVIMIENTO'},
    {name:'El taller en movimiento',type:'video',src:'assets/cinema-workshop-natural.mp4',thumb:'assets/salon-panoramica-optimized.webp',duration:10,label:'EL TALLER · EN MOVIMIENTO'},
    {name:'Herramientas y oficio',type:'image',src:'assets/hero-herramientas.webp',thumb:'assets/hero-herramientas.webp',duration:3,label:'HERRAMIENTAS · DIAGNÓSTICO · OFICIO'},
    {name:'Mecánica de cerca',type:'video',src:'assets/motorloz-subaru-loop.mp4',thumb:'assets/hero-subaru.webp',duration:10,label:'MECÁNICA · DE CERCA'},
    {name:'Subaru en movimiento',type:'video',src:'assets/cinema-subaru-natural.mp4',thumb:'assets/clips/subaru-home.jpg',duration:10,label:'SUBARU · EN MOVIMIENTO'},
    {name:'Subaru en el corazón',type:'image',src:'assets/hero-subaru-azul.webp',thumb:'assets/hero-subaru-azul.webp',duration:3,label:'SUBARU · EN EL CORAZÓN'}
  ];
  const key = 'motorloz-home-sequence-draft-v1';
  const $ = id => document.getElementById(id);
  const list = $('scene-list');
  const canvas = $('canvas');
  const image = $('preview-image');
  const video = $('preview-video');
  const clone = value => JSON.parse(JSON.stringify(value));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value)));
  let scenes;
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    scenes = Array.isArray(saved) && saved.length ? saved : clone(defaults);
  } catch { scenes = clone(defaults); }
  const updatedSources = {'assets/clips/hyundai-home.mp4':'assets/cinema-hyundai-natural.mp4','assets/cinema-workshop.mp4':'assets/cinema-workshop-natural.mp4','assets/cinema-workshop-10s.mp4':'assets/cinema-workshop-natural.mp4','assets/cinema-engine.mp4':'assets/motorloz-subaru-loop.mp4','assets/clips/subaru-home.mp4':'assets/cinema-subaru-natural.mp4'};
  scenes = scenes.filter(scene => scene.src !== 'assets/hero-bruno.png').map(scene => ({...scene,src:updatedSources[scene.src] || scene.src})).map((scene, i) => ({
    ...(defaults.find(item => item.src === scene.src) || defaults[i] || {}),
    ...scene,
    duration: clamp(scene.duration || (scene.type === 'video' ? 10 : 3), 1, 30),
    focusX: clamp(scene.focusX ?? 50, 0, 100),
    focusY: clamp(scene.focusY ?? 50, 0, 100),
    trimStart: Number(scene.trimStart || 0),
    trimEnd: scene.trimEnd == null ? null : Number(scene.trimEnd),
    transition: Number(scene.transition ?? 1)
  }));

  let selected = 0;
  let playing = false;
  let singleOnly = false;
  let runTimer = 0;
  let progressTimer = 0;
  let videoReady = false;
  let sceneToken = 0;
  const formatTime = value => `${String(Math.floor(value / 60)).padStart(2,'0')}:${String(Math.round(value % 60)).padStart(2,'0')}`;
  const decimal = value => Number(value).toFixed(1).replace('.',',');

  function toast(message) {
    const notice = $('toast');
    notice.textContent = message;
    notice.classList.add('on');
    setTimeout(() => notice.classList.remove('on'), 2600);
  }

  function save() {
    try { localStorage.setItem(key, JSON.stringify(scenes.filter(scene => !scene.src.startsWith('blob:')))); }
    catch { toast('No se pudo guardar en este navegador. Descargá la guía antes de salir.'); }
  }

  function renderList() {
    list.replaceChildren();
    scenes.forEach((scene, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `scene${index === selected ? ' active' : ''}`;
      button.setAttribute('aria-pressed', String(index === selected));
      const thumb = document.createElement('img');
      thumb.src = scene.thumb;
      thumb.alt = '';
      const copy = document.createElement('span');
      copy.className = 'scene-copy';
      const name = document.createElement('strong');
      name.textContent = scene.name;
      const kind = document.createElement('small');
      kind.textContent = scene.type === 'video' ? 'VIDEO' : 'FOTO';
      copy.append(name, kind);
      const duration = document.createElement('span');
      duration.className = 'duration-badge';
      duration.textContent = `${scene.duration}s`;
      button.append(thumb, copy, duration);
      button.addEventListener('click', () => select(index));
      list.append(button);
    });
    $('scene-count').textContent = `${String(scenes.length).padStart(2,'0')} TOMAS`;
    $('total-duration').textContent = formatTime(scenes.reduce((sum, scene) => sum + scene.duration, 0));
  }

  function selectedRange(scene) {
    const fileLength = Number.isFinite(video.duration) ? video.duration : 0;
    const start = clamp(scene.trimStart || 0, 0, Math.max(0, fileLength - .15));
    const end = clamp(scene.trimEnd ?? fileLength, start + .1, fileLength);
    return {start, end, fileLength};
  }

  function updateTrimLabels(scene, range) {
    $('trim-start').max = Math.max(0, range.fileLength - .1);
    $('trim-end').max = range.fileLength;
    $('trim-start').value = range.start;
    $('trim-end').value = range.end;
    $('trim-start-value').textContent = `${decimal(range.start)} s`;
    $('trim-end-value').textContent = `${decimal(range.end)} s`;
    const rate = (range.end - range.start) / scene.duration;
    $('source-duration').textContent = `Archivo: ${decimal(range.fileLength)} s. Se reproduce una sola vez${rate < 1 ? ', a velocidad ajustada' : ''}.`;
  }

  function setPreviewRate(scene) {
    const range = selectedRange(scene);
    video.playbackRate = clamp((range.end - range.start) / scene.duration, .25, 4);
  }

  function showScene(autoPlay = false) {
    const scene = scenes[selected];
    const token = ++sceneToken;
    video.pause();
    video.ontimeupdate = null;
    video.onended = null;
    video.onloadedmetadata = null;
    video.onerror = null;
    videoReady = false;
    video.classList.remove('visible');
    image.classList.remove('visible');
    $('media-type').textContent = `${scene.type === 'video' ? 'VIDEO' : 'FOTO'} · TOMA ${String(selected + 1).padStart(2,'0')}`;
    $('selected-title').textContent = scene.name;
    $('duration').value = scene.duration;
    $('duration-number').value = scene.duration;
    $('duration-hint').textContent = scene.type === 'video' ? 'Cada clip se muestra una vez, sin reiniciarse.' : 'La foto cambia al terminar este tiempo.';
    $('transition').value = String(scene.transition);
    $('focus-x').value = scene.focusX;
    $('focus-y').value = scene.focusY;
    $('focus-x-value').textContent = `${scene.focusX}%`;
    $('focus-y-value').textContent = `${scene.focusY}%`;
    $('trim-start').disabled = scene.type !== 'video';
    $('trim-end').disabled = scene.type !== 'video';
    document.querySelectorAll('.trim-field').forEach(field => field.style.opacity = scene.type === 'video' ? '1' : '.42');
    video.style.objectPosition = image.style.objectPosition = `${scene.focusX}% ${scene.focusY}%`;
    canvas.style.setProperty('--preview-transition', `${scene.transition}s`);
    image.src = scene.type === 'video' ? scene.thumb : scene.src;
    image.classList.add('visible');
    $('source-duration').textContent = scene.type === 'video' ? 'Leyendo duración del archivo…' : '';
    $('preview-caption').textContent = `${String(selected + 1).padStart(2,'0')} / ${String(scenes.length).padStart(2,'0')} · ${scene.label || scene.name.toUpperCase()}`;
    $('now-playing').textContent = `${String(selected + 1).padStart(2,'0')} · ${scene.name}`;
    $('progress-fill').style.width = '0%';
    if (scene.type !== 'video') return;

    const onMetadata = () => {
      if (token !== sceneToken) return;
      const range = selectedRange(scene);
      updateTrimLabels(scene, range);
      videoReady = true;
      video.currentTime = range.start;
      video.loop = false;
      setPreviewRate(scene);
      if (autoPlay && playing) {
        video.play().then(() => { if (token === sceneToken) { video.classList.add('visible'); image.classList.remove('visible'); } })
          .catch(() => toast('El navegador bloqueó la vista previa. Tocá reproducir de nuevo.'));
      }
    };
    video.onloadedmetadata = onMetadata;
    video.ontimeupdate = () => {
      if (token !== sceneToken || !videoReady) return;
      if (video.currentTime >= selectedRange(scene).end - .06) video.pause();
    };
    video.onended = () => video.pause();
    video.onerror = () => { if (token === sceneToken) $('source-duration').textContent = 'No se pudo cargar este archivo.'; };
    if (video.dataset.src !== scene.src) {
      video.dataset.src = scene.src;
      video.src = scene.src;
      video.load();
    } else if (video.readyState >= 1) onMetadata();
  }

  function stopRun() {
    playing = false;
    clearTimeout(runTimer);
    clearInterval(progressTimer);
    video.pause();
    $('play-sequence').textContent = '▶ Ver secuencia';
    $('play-current').textContent = '▶';
    $('progress-fill').style.width = '0%';
  }

  function select(index) {
    stopRun();
    selected = (index + scenes.length) % scenes.length;
    renderList();
    showScene();
  }

  function advanceRun() {
    if (!playing) return;
    clearTimeout(runTimer);
    clearInterval(progressTimer);
    const scene = scenes[selected];
    showScene(true);
    const durationMs = scene.duration * 1000;
    const start = performance.now();
    progressTimer = setInterval(() => {
      $('progress-fill').style.width = `${Math.min(100, (performance.now() - start) / durationMs * 100)}%`;
    }, 80);
    runTimer = setTimeout(() => {
      if (!playing) return;
      if (singleOnly) { stopRun(); return; }
      selected = (selected + 1) % scenes.length;
      renderList();
      advanceRun();
    }, durationMs);
  }

  function startRun(single = false) {
    stopRun();
    playing = true;
    singleOnly = single;
    $('play-sequence').textContent = single ? '▶ Ver secuencia' : 'Ⅱ Pausar';
    $('play-current').textContent = single ? 'Ⅱ' : '▶';
    advanceRun();
  }

  function setDuration(value) {
    if (value === '' || !Number.isFinite(Number(value))) return;
    scenes[selected].duration = clamp(Math.round(Number(value)), 1, 30);
    $('duration-number').value = scenes[selected].duration;
    $('duration').value = scenes[selected].duration;
    if (videoReady) { updateTrimLabels(scenes[selected], selectedRange(scenes[selected])); setPreviewRate(scenes[selected]); }
    save();
    renderList();
    if (playing) advanceRun();
  }

  $('duration').addEventListener('input', event => setDuration(event.target.value));
  $('duration-number').addEventListener('change', event => setDuration(event.target.value));
  $('transition').addEventListener('change', event => { scenes[selected].transition = Number(event.target.value); save(); canvas.style.setProperty('--preview-transition', `${event.target.value}s`); });
  for (const axis of ['x','y']) {
    $(`focus-${axis}`).addEventListener('input', event => {
      scenes[selected][axis === 'x' ? 'focusX' : 'focusY'] = Number(event.target.value);
      video.style.objectPosition = image.style.objectPosition = `${scenes[selected].focusX}% ${scenes[selected].focusY}%`;
      $(`focus-${axis}-value`).textContent = `${event.target.value}%`;
      save();
    });
  }
  for (const edge of ['start','end']) {
    $(`trim-${edge}`).addEventListener('input', event => {
      const scene = scenes[selected];
      const start = Number($('trim-start').value);
      const end = Number($('trim-end').value);
      if (edge === 'start' && start >= end) event.target.value = Math.max(0, end - .1);
      if (edge === 'end' && end <= start) event.target.value = Math.min(Number(event.target.max), start + .1);
      scene[edge === 'start' ? 'trimStart' : 'trimEnd'] = Number(event.target.value);
      updateTrimLabels(scene, selectedRange(scene));
      video.currentTime = selectedRange(scene).start;
      setPreviewRate(scene);
      save();
    });
  }

  $('play-sequence').addEventListener('click', () => playing && !singleOnly ? stopRun() : startRun(false));
  $('play-current').addEventListener('click', () => playing && singleOnly ? stopRun() : startRun(true));
  $('prev-scene').addEventListener('click', () => select(selected - 1));
  $('next-scene').addEventListener('click', () => select(selected + 1));
  function move(by) {
    const target = selected + by;
    if (target < 0 || target >= scenes.length) return;
    [scenes[selected], scenes[target]] = [scenes[target], scenes[selected]];
    selected = target;
    save();
    renderList();
    showScene();
  }
  $('move-left').addEventListener('click', () => move(-1));
  $('move-right').addEventListener('click', () => move(1));
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
    canvas.classList.toggle('mobile', button.dataset.view === 'mobile');
    document.querySelectorAll('[data-view]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  }));
  $('reset-scene').addEventListener('click', () => {
    const original = defaults.find(item => item.src === scenes[selected].src);
    if (!original) { toast('Esta toma agregada no tiene ajustes iniciales.'); return; }
    scenes[selected] = {...clone(original),focusX:50,focusY:50,trimStart:0,trimEnd:null,transition:1};
    save();
    renderList();
    showScene();
    toast('Toma restablecida.');
  });
  function makeGuide() {
    return {
      duracionTotal: formatTime(scenes.reduce((sum, scene) => sum + scene.duration, 0)),
      tomas: scenes.map((scene, index) => ({
        orden:index + 1,
        archivo:scene.localName || scene.src,
        tipo:scene.type,
        duracionSegundos:scene.duration,
        recorte:scene.type === 'video' ? {desde:scene.trimStart || 0,hasta:scene.trimEnd} : undefined,
        encuadre:{horizontal:scene.focusX,vertical:scene.focusY},
        transicion:scene.transition
      }))
    };
  }
  $('copy-guide').addEventListener('click', async () => {
    const text = JSON.stringify(makeGuide(), null, 2);
    try { await navigator.clipboard.writeText(text); }
    catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.append(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    toast('Guía copiada. Pegala en el chat para publicar este montaje.');
  });
  $('download-guide').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(makeGuide(), null, 2)], {type:'application/json'});
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = 'guia-montaje-motorloz.json';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
    toast('Guía descargada.');
  });
  $('add-media').addEventListener('click', () => $('file-input').click());
  $('file-input').addEventListener('change', event => {
    for (const file of event.target.files) {
      const src = URL.createObjectURL(file);
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      scenes.push({name:file.name.replace(/\.[^.]+$/,''),localName:file.name,type,src,thumb:type === 'image' ? src : 'assets/clips/subaru-home.jpg',duration:type === 'video' ? 10 : 3,focusX:50,focusY:50,trimStart:0,trimEnd:null,transition:1});
    }
    selected = scenes.length - 1;
    save();
    renderList();
    showScene();
    toast('Archivo agregado a esta sesión. Enviá el archivo junto con la guía.');
  });
  $('try-home').addEventListener('click', () => {
    save();
    location.href = 'index.html?montaje=1#inicio';
  });
  renderList();
  showScene();
})();
