(function(){
  try{
    const draft=sessionStorage.getItem('motorloz-assistant-draft');
    if(!draft)return;
    sessionStorage.removeItem('motorloz-assistant-draft');
    const field=document.querySelector('#appointment-form [name="motivo"]');
    if(!field)return;
    field.value=draft;
    field.dispatchEvent(new Event('input',{bubbles:true}));
    requestAnimationFrame(function(){
      document.getElementById('turno')?.scrollIntoView({behavior:'smooth',block:'start'});
      field.focus({preventScroll:true});
    });
  }catch(error){}
})();
