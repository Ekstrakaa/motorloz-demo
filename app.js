'use strict';
const config = window.MOTORLOZ;
document.querySelectorAll('[data-instagram]').forEach(a => a.href = config.instagram);
document.querySelectorAll('[data-maps]').forEach(a => a.href = config.maps);
document.querySelectorAll('[data-directions]').forEach(a => a.href = config.directions);
document.querySelectorAll('[data-whatsapp]').forEach(a => a.href = 'https://wa.me/' + config.whatsapp);
const menuButton = document.querySelector('.menu-toggle');
const mobileNav = document.querySelector('.mobile-nav');
function closeMenu() { mobileNav.hidden = true; menuButton.setAttribute('aria-expanded', 'false'); menuButton.setAttribute('aria-label', 'Abrir menú'); }
menuButton.addEventListener('click', () => { const opening = mobileNav.hidden; mobileNav.hidden = !opening; menuButton.setAttribute('aria-expanded', String(opening)); menuButton.setAttribute('aria-label', opening ? 'Cerrar menú' : 'Abrir menú'); });
mobileNav.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !mobileNav.hidden) { closeMenu(); menuButton.focus(); } });
document.querySelectorAll('.service-list details').forEach(item => item.addEventListener('toggle', () => { if(item.open) document.querySelectorAll('.service-list details').forEach(other => { if(other !== item) other.open = false; }); }));
document.querySelectorAll('[data-service]').forEach(a => a.addEventListener('click', () => { const field = document.querySelector('[name=motivo]'); if (!field.value.trim()) field.value = `Quisiera consultar por ${a.dataset.service.toLowerCase()}.`; }));
document.querySelectorAll('dialog').forEach(dialog => { dialog.querySelector('.dialog-close')?.addEventListener('click', () => dialog.close()); dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if(e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } }); });
const form = document.querySelector('#appointment-form');
const whatsappReady = config.whatsappVerified === true && /^5989\d{7}$/.test(config.whatsapp);
if (whatsappReady) { document.querySelector('.privacy-note').textContent = 'Tus datos se incorporan al mensaje que abrís en WhatsApp. Esta web no los guarda.'; }
function composeMessage(data) { return `🛠️ *MOTORLOZ · SOLICITUD DE TURNO*\n\n*CLIENTE*\n• ${data.nombre} ${data.apellido}\n• Vehículo: ${data.vehiculo}\n\n*QUÉ NECESITA REVISAR*\n${data.motivo}\n\n*COORDINACIÓN*\n• Prioridad: ${data.prioridad || 'Consulta coordinada'}${data.disponibilidad ? `\n• Disponibilidad: ${data.disponibilidad}` : ''}\n\n¿Podemos coordinar día y horario? Gracias.`; }
form.addEventListener('submit', e => { e.preventDefault(); const data = Object.fromEntries([...new FormData(form)].map(([key, value]) => [key, value.trim()])); for (const key of ['nombre', 'apellido', 'vehiculo', 'motivo']) { const field = form.elements[key]; field.setCustomValidity(data[key] ? '' : (document.documentElement.lang==='en'?'Please complete this field.':'Completá este campo.')); if(!field.reportValidity()) return; } const message = composeMessage(data); if(whatsappReady) { window.open(`https://wa.me/${config.whatsapp}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer'); return; } document.querySelector('#prepared-message').value = message; document.querySelector('#copy-status').textContent = ''; document.querySelector('#message-dialog').showModal(); });
function updateFormProgress(){const required=['nombre','apellido','vehiculo','motivo'];const complete=required.filter(name=>form.elements[name].value.trim()).length;const value=Math.round(complete/required.length*100);form.style.setProperty('--form-progress',`${value}%`);const status=document.querySelector('#form-progress-status');if(status)status.textContent=value===100?'Consulta lista para enviar':`${complete} de ${required.length} datos esenciales completos`;}
form.addEventListener('input', e => {e.target.setCustomValidity?.('');updateFormProgress();});
updateFormProgress();
document.querySelector('#copy-message').addEventListener('click', async () => { const message = document.querySelector('#prepared-message'); try { await navigator.clipboard.writeText(message.value); document.querySelector('#copy-status').textContent = 'Mensaje copiado. Pegalo en tu conversación con @motorloz.'; } catch { message.focus(); message.select(); document.querySelector('#copy-status').textContent = 'Seleccionamos el texto: usá Copiar en tu dispositivo.'; } });
document.querySelector('#load-map')?.addEventListener('click', () => { const frame = document.createElement('iframe'); frame.title = 'Ubicación de Taller Pablo Lozano — MOTORLOZ en Montevideo'; frame.src = 'https://maps.google.com/maps?q=-34.8808783,-56.0864906&z=16&output=embed'; frame.referrerPolicy = 'no-referrer-when-downgrade'; frame.allowFullscreen = true; document.querySelector('#map-panel').replaceChildren(frame); });
