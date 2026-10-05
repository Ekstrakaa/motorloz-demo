'use strict';
(() => {
  const photo = (file, alt, clean=false, position='50% 50%') => ({src:`assets/${file.includes('.')?file:`${file}.png`}`,alt,clean,position});
  const pictures = {
    subaruWide:photo('subaru-panoramica-privacy-optimized.webp','Subaru, una pasión que se vive en el taller',true),
    salon:photo('salon-panoramica-optimized.webp','El taller, lleno de historias y vehículos',true),
    classics:photo('subaru-clasicos-optimized.webp','Subaru: una historia que sigue en movimiento',true),
    workshopWide:photo('taller-panoramica-optimized.webp','El taller, desde otra perspectiva',true),
    lifts:photo('elevadores-optimized.webp','Elevadores y espacios de trabajo',true),
    planning:photo('equipo-planificacion-optimized.webp','Atención al detalle, en cada trabajo',true),
    working:photo('herramientas-taller-optimized.webp','Herramientas del taller',true),
    panorama:photo('multimarca-panoramica-optimized.webp','Pasión multimarca, dentro de MOTORLOZ',true),
    localAereo:photo('local-aereo-optimized.webp','El local MOTORLOZ, visto desde arriba',true),
    ferrariWide:photo('ferrari-panoramica-optimized.webp','Ferrari y Subaru en el taller',true),
    reception:photo('recepcion-optimized.webp','La recepción del taller',true),
    ferrari:photo('ferrari-taller-optimized.webp','Ferrari negro en el taller'),
    subaru:photo('autos-japoneses-optimized.webp','Carácter japonés, atención multimarca'),
    toyota:photo('toyota-frente-optimized.webp','Toyota en MOTORLOZ'),
    corvette:photo('corvette-taller-optimized.webp','Corvette en el taller',true),
    space:photo('instalaciones-optimized.webp','Una mirada al interior del taller',true),
    front:photo('local-frente-hires.webp','Exterior del taller MOTORLOZ con varios vehículos de clientes',true),
    inside:photo('taller-interior-overview.webp','Vista amplia del interior del taller MOTORLOZ',true),
    newWorkshop:photo('intro-workshop-cars-optimized.webp','Subaru azul y vehículos atendidos dentro del taller MOTORLOZ',true),
    newOverhead:photo('intro-workshop-overhead-optimized.webp','Vista elevada de los vehículos dentro del taller MOTORLOZ',true),
    ferrariInShop:photo('ferrari-interior-cliente.webp','Ferrari negro atendido dentro del taller MOTORLOZ',true),
    engineRepair:photo('equipo-diagnostico-optimized.webp','Mecánico trabajando con diagnóstico en el taller',true),
    workbench:photo('equipo-planificacion-optimized.webp','Mecánico trabajando en el banco de servicio',true),
    facadeSubaru:photo('fachada-subaru-frente-optimized.webp','Fachada de MOTORLOZ con un Subaru al frente',true),
    diagnostic:photo('equipo-diagnostico-optimized.webp','Tecnología y atención al detalle',false,'56% 45%'),
    tools:photo('herramientas-taller-optimized.webp','Herramientas listas para cada diagnóstico',true),
    subaruFront:photo('subaru-frente-optimized.webp','Subaru y atención especializada',true)
  };
  const groups = {
    hero:{items:[pictures.salon,pictures.workshopWide,pictures.subaruFront,pictures.panorama,pictures.space],interval:5900},
    intro:{items:[pictures.subaruWide,pictures.front,pictures.newWorkshop,pictures.newOverhead],interval:3000},
    vehicles:{items:[pictures.ferrari,pictures.corvette],interval:3000},
    spaces:{items:[pictures.space,pictures.reception,pictures.subaruWide],interval:3000},
    arrival:{items:[pictures.localAereo,pictures.facadeSubaru],interval:3000},
    team:{items:[pictures.engineRepair,pictures.workbench],interval:3000}
  };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('[data-slideshow]').forEach(root => {
    const id=root.dataset.slideshow;const {items,interval}=groups[id];
    const frames=[...root.querySelectorAll('.slide-frame')];const isHero=id==='hero';
    const controlRoot=isHero?document.querySelector('.hero-slide-controls'):root;
    const previous=controlRoot.querySelector(isHero?'[data-hero-prev]':'[data-slide-prev]');
    const next=controlRoot.querySelector(isHero?'[data-hero-next]':'[data-slide-next]');
    const pause=controlRoot.querySelector(isHero?'[data-hero-pause]':'[data-slide-pause]');
    let index=0,active=0,paused=reduced.matches,visible=false,busy=false,timer;
    if(items.length===1){previous.hidden=true;next.hidden=true;pause.hidden=true;root.classList.add('single-slide');}
    const cache=new Map();
    function load(item){if(cache.has(item.src))return cache.get(item.src);const image=new Image();image.src=item.src;const promise=image.decode().then(()=>image).catch(()=>null);cache.set(item.src,promise);return promise;}
    const stage=root.querySelector('.slide-stage');
    function fitPhoto(){/* El encuadre lo define CSS para mantener todas las fotos del carrusel iguales. */}
    function paint(frame,item,image){fitPhoto(image);if(!image.complete)image.addEventListener('load',()=>fitPhoto(image),{once:true});image.alt=item.alt;image.loading='eager';image.decoding='async';image.style.objectPosition=item.position;frame.style.backgroundImage=`url("${item.src}")`;frame.classList.toggle('clean-photo',item.clean);frame.replaceChildren(image);}
    function updateLabels(){root.dataset.slideIndex=String(index);if(isHero){document.querySelector('#hero-counter').textContent=`${String(index+1).padStart(2,'0')} / ${String(items.length).padStart(2,'0')}`;document.querySelector('#hero-photo-label').textContent=items[index].alt;}else{root.querySelector('.slide-number').textContent=`${String(index+1).padStart(2,'0')} / ${String(items.length).padStart(2,'0')}`;root.querySelector('.slide-caption').textContent=items[index].alt;}pause.textContent=paused?'▷':'Ⅱ';pause.setAttribute('aria-pressed',String(paused));pause.setAttribute('aria-label',`${paused?'Reanudar':'Pausar'} fotos de ${isHero?'portada':root.getAttribute('aria-label')}`);root.classList.toggle('slideshow-paused',paused);}
    function schedule(){clearTimeout(timer);if(items.length<2||paused||!visible||document.hidden)return;timer=setTimeout(async()=>{if(!root.matches(':focus-within')&&!controlRoot.matches(':focus-within')&&!document.querySelector('dialog[open]'))await show(1);schedule();},interval);}
    async function show(direction){if(busy)return;busy=true;try{const target=(index+direction+items.length)%items.length;const image=await load(items[target]);if(!image)return;const incoming=1-active;paint(frames[incoming],items[target],image.cloneNode());frames[incoming].classList.add('is-current');frames[incoming].removeAttribute('aria-hidden');frames[active].classList.remove('is-current');frames[active].setAttribute('aria-hidden','true');active=incoming;index=target;updateLabels();if(visible)load(items[(index+1)%items.length]);}finally{busy=false;}}
    previous.addEventListener('click',()=>{show(-1);schedule();});next.addEventListener('click',()=>{show(1);schedule();});pause.addEventListener('click',()=>{paused=!paused;updateLabels();schedule();});
    root.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();show(event.key==='ArrowLeft'?-1:1);schedule();}});
    const firstImage=frames[0].querySelector('img');fitPhoto(firstImage);if(!firstImage.complete)firstImage.addEventListener('load',()=>fitPhoto(firstImage),{once:true});firstImage.src=items[0].src;firstImage.alt=items[0].alt;firstImage.style.objectPosition=items[0].position;frames[0].style.backgroundImage=`url("${items[0].src}")`;frames[0].classList.toggle('clean-photo',items[0].clean);
    new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)load(items[(index+1)%items.length]);schedule();},{threshold:.15}).observe(root);
    document.addEventListener('visibilitychange',schedule);reduced.addEventListener('change',()=>{paused=reduced.matches;updateLabels();schedule();});
    updateLabels();
  });
})();
