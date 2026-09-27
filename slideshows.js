'use strict';
(() => {
  const photo = (file, alt, clean=false, position='50% 50%') => ({src:`assets/${file.includes('.')?file:`${file}.png`}`,alt,clean,position});
  const pictures = {
    subaruWide:photo('subaru-panoramica','Subaru, una pasión que se vive en el taller',true),
    salon:photo('salon-panoramica','El taller, lleno de historias y vehículos',true),
    classics:photo('subaru-clasicos','Subaru: una historia que sigue en movimiento',true),
    workshopWide:photo('taller-panoramica','El taller, desde otra perspectiva',true),
    lifts:photo('elevadores','Elevadores y espacios de trabajo',true),
    planning:photo('equipo-planificacion','Atención al detalle, en cada trabajo',true),
    working:photo('mecanica-subaru','El equipo en acción',true),
    panorama:photo('multimarca-panoramica','Pasión multimarca, dentro de MOTORLOZ',true),
    localAereo:photo('local-aereo','El local MOTORLOZ, visto desde arriba',true),
    ferrariWide:photo('ferrari-panoramica','Ferrari y Subaru en el taller',true),
    reception:photo('recepcion','La recepción del taller',true),
    ferrari:photo('ferrari-taller','Ferrari negro en el taller'),
    subaru:photo('autos-japoneses','Carácter japonés, atención multimarca'),
    toyota:photo('toyota-frente','Toyota en MOTORLOZ'),
    corvette:photo('corvette-taller','Corvette en el taller',true),
    space:photo('instalaciones','Una mirada al interior del taller',true),
    front:photo('fachada-vehiculos','Puertas abiertas a la pasión por los autos',true),
    mechanic:photo('equipo-mecanica','Mecánico revisando un motor en MOTORLOZ',true,'50% 38%'),
    diagnostic:photo('equipo-diagnostico','Tecnología y atención al detalle',false,'56% 45%'),
    tools:photo('herramientas-taller','Herramientas listas para cada diagnóstico',true),
    subaruFront:photo('subaru-frente','Subaru y atención especializada',true)
  };
  const groups = {
    hero:{items:[pictures.salon,pictures.workshopWide,pictures.subaruFront,pictures.panorama,pictures.space],interval:5900},
    intro:{items:[pictures.subaruWide,pictures.front],interval:3000},
    vehicles:{items:[pictures.ferrari,pictures.corvette],interval:3000},
    spaces:{items:[pictures.space,pictures.reception,pictures.subaruWide],interval:3000},
    arrival:{items:[pictures.workshopWide],interval:5000},
    team:{items:[pictures.planning,pictures.mechanic],interval:3000}
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
    const firstImage=frames[0].querySelector('img');fitPhoto(firstImage);if(!firstImage.complete)firstImage.addEventListener('load',()=>fitPhoto(firstImage),{once:true});firstImage.alt=items[0].alt;firstImage.style.objectPosition=items[0].position;frames[0].style.backgroundImage=`url("${items[0].src}")`;frames[0].classList.toggle('clean-photo',items[0].clean);
    new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)load(items[(index+1)%items.length]);schedule();},{threshold:.15}).observe(root);
    document.addEventListener('visibilitychange',schedule);reduced.addEventListener('change',()=>{paused=reduced.matches;updateLabels();schedule();});
    root.querySelector('.slide-expand')?.addEventListener('click',()=>{const dialog=document.querySelector('#photo-dialog');const container=dialog.querySelector('.lightbox-photo');container.className='lightbox-photo slideshow-lightbox';const frame=document.createElement('div');frame.className='slide-frame is-current';const image=new Image();image.src=items[index].src;paint(frame,items[index],image);container.replaceChildren(frame);container.setAttribute('role','img');container.setAttribute('aria-label',items[index].alt);document.querySelector('#photo-caption').textContent=items[index].alt+' · MOTORLOZ';dialog.showModal();});
    updateLabels();
  });
})();
