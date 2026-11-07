// A pack is awarded once by the caller. This module only presents those cards.
export function presentPack({modal, set, pulled, pack, card, tone, foilSound, onClose}) {
  const controller = new AbortController();
  const {signal} = controller;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let phase = 'sealed', index = 0, locked = false, startX;
  const back = () => '<span class="back-mark">▱</span><strong>SUNDAY<br>CARDS</strong><small>THE FIRST EDITION</small>';
  modal.className = 'pack-opening-modal';
  modal.setAttribute('aria-labelledby', 'opening-title');
  modal.innerHTML = `
    <button class="close opening-close" aria-label="Close opening">×</button>
    <div class="opening-heading"><span class="eyebrow">${set.name} · FIVE LITTLE DISCOVERIES</span>
      <h2 id="opening-title">A little anticipation.</h2><p id="opening-instruction">Pull the foil seam, then see what’s inside.</p></div>
    <div class="physical-stage" data-phase="sealed">
      <div class="opened-pile" aria-hidden="true"></div>
      <div class="physical-stack" aria-hidden="true"></div>
      <div class="foil-wrapper">
        <div class="foil-inside"></div>
        <div class="foil-sleeve">${pack(set)}</div>
        <div class="foil-cap">${pack(set)}</div>
        <div class="foil-glint"></div>
      </div>
      <div class="tear-cue" aria-hidden="true"><span>← pull the seam →</span><i></i></div>
    </div>
    <div class="opening-controls"><span class="opening-progress" role="status" aria-live="polite">Sealed pack · 5 cards inside</span>
      <button class="primary physical-next">Tear open pack <span aria-hidden="true">→</span></button>
      <span class="opening-save-note">Your cards are already saved. Take your time.</span></div>`;
  const stage=modal.querySelector('.physical-stage');
  const stack=modal.querySelector('.physical-stack');
  const pile=modal.querySelector('.opened-pile');
  const wrapper=modal.querySelector('.foil-wrapper');
  const next=modal.querySelector('.physical-next');
  const title=modal.querySelector('#opening-title');
  const instruction=modal.querySelector('#opening-instruction');
  const progress=modal.querySelector('.opening-progress');
  const listen=(el,event,fn)=>el.addEventListener(event,fn,{signal});
  const close=()=>modal.close();
  listen(modal.querySelector('.opening-close'),'click',close);
  modal.addEventListener('close',()=>{controller.abort();modal.removeAttribute('aria-labelledby');onClose();},{once:true});
  function backs(){stack.innerHTML=Array.from({length:pulled.length-index},(_,i)=>`<div class="physical-card stack-back" style="--depth:${i};z-index:${10-i}">${back()}</div>`).reverse().join('');}
  backs();
  async function animate(el,frames,duration=600){
    if(signal.aborted)throw new DOMException('Closed','AbortError');
    const animation=el.animate(frames,{duration:reduced?0:duration,easing:'cubic-bezier(.22,.7,.25,1)',fill:'forwards'});
    const cancel=()=>animation.cancel();signal.addEventListener('abort',cancel,{once:true});
    try{await animation.finished;if(signal.aborted)throw new DOMException('Closed','AbortError');}
    finally{signal.removeEventListener('abort',cancel);}
  }
  function update(newPhase){phase=newPhase;stage.dataset.phase=phase;}
  async function tear(){
    foilSound();update('tearing');title.textContent='That first little rip.';instruction.textContent='Breaking the seal. A little adventure inside.';
    progress.textContent='Opening the foil wrapper…';
    await Promise.all([
      animate(modal.querySelector('.foil-cap'),[{transform:'translate(0,0) rotate(0deg)'},{transform:'translate(15px,-8px) rotate(-5deg)',offset:.25},{transform:'translate(160px,-75px) rotate(32deg)',opacity:0}],1000),
      animate(modal.querySelector('.foil-sleeve'),[{transform:'scaleX(1)'},{transform:'scaleX(.95) rotate(-3deg)',offset:.3},{transform:'scaleX(1) rotate(0deg)'}],950)
    ]);
    update('extracting');title.textContent='Five stories, waiting.';instruction.textContent='Sliding the cards onto your desk.';
    await Promise.all([
      animate(stack,[{transform:'translate(-50%, 45px) rotate(-4deg)',opacity:0},{transform:'translate(-50%, -90px) rotate(-2deg)',opacity:1,offset:.6},{transform:'translate(-50%, 0px) rotate(0deg)',opacity:1}],1100),
      animate(wrapper,[{transform:'translate(-50%,0) rotate(-4deg)'},{transform:'translate(-110%,85px) rotate(-24deg) scale(.78)',opacity:.65}],1100)
    ]);
    update('stack');stack.removeAttribute('aria-hidden');title.textContent='One card at a time.';instruction.textContent='Tap the stack to turn over your first card.';
    progress.textContent='0 / 5 revealed';next.textContent='Reveal first card';
  }
  async function reveal(){
    const c=pulled[index];
    update('revealing');
    const top=stack.querySelector('[style*="z-index:10"]');
    const flipper=document.createElement('button');flipper.className='physical-card flip-card';
    flipper.setAttribute('aria-label','Turning over card');flipper.disabled=true;
    flipper.innerHTML=`<span class="flip-inner"><span class="flip-back">${back()}</span><span class="flip-face">${card(c)}</span></span>`;
    top.replaceWith(flipper);
    await animate(flipper,[{transform:'translate(0,0) rotate(0deg)'},{transform:'translate(0,-22px) rotate(-3deg)',offset:.45},{transform:'translate(0,-8px) rotate(0deg)'}],700);
    await animate(flipper.querySelector('.flip-inner'),[{transform:'rotateY(0deg)'},{transform:'rotateY(180deg)'}],650);
    tone(index);index++;
    update('face');flipper.disabled=false;flipper.setAttribute('aria-label',index===5?'Finish opening pack':'Set this card aside and reveal the next card');
    title.textContent=c.name;instruction.textContent=`${c.rarity} · ${set.name}`;
    progress.textContent=`${index} / 5 revealed`;
    next.textContent=index===5?'Finish opening':'Set aside & reveal next';
  }
  async function setAside(){
    const face=stack.querySelector('.flip-card');
    await animate(face,[{transform:'translate(0,-8px) rotate(0deg)'},{transform:'translate(-145%,35px) rotate(-12deg) scale(.72)',opacity:.9}],550);
    pile.innerHTML=`<div class="set-aside-card" style="--pile-rotation:${-12+index*2}deg">${card(pulled[index-1])}</div>`;
    backs();
  }
  function summary(){
    update('complete');title.textContent='A lovely little discovery.';instruction.textContent='All five cards are safely tucked into your collection.';
    stage.innerHTML=`<div class="opening-summary">${pulled.map(c=>`<div>${card(c)}</div>`).join('')}</div>`;
    next.textContent='Back to your desk';
    const collection=document.createElement('button');collection.className='secondary';collection.textContent='View collection';collection.dataset.view='collection';
    next.after(collection);progress.textContent='5 / 5 revealed · Added to your collection';
  }
  async function advance(){
    if(locked||signal.aborted)return;
    if(phase==='complete'){close();return;}
    locked=true;next.disabled=true;
    try{
      if(phase==='sealed')await tear();
      else if(phase==='stack')await reveal();
      else if(phase==='face'){await setAside();if(index===5)summary();else await reveal();}
    }catch(e){if(e.name!=='AbortError')console.error(e);}
    finally{locked=false;if(!signal.aborted){next.disabled=false;next.focus({preventScroll:true});}}
  }
  listen(next,'click',advance);
  listen(stage,'click',e=>{if(e.target.closest('.foil-wrapper,.physical-stack')&&['sealed','stack','face'].includes(phase))advance();});
  // A swipe tears the seam; tapping or the focused button works equally well.
  listen(stage,'pointerdown',e=>{startX=e.target.closest('.foil-wrapper')?e.clientX:undefined;});
  listen(stage,'pointerup',e=>{if(phase==='sealed'&&startX!==undefined&&Math.abs(e.clientX-startX)>45)advance();startX=undefined;});
  listen(stage,'pointercancel',()=>{startX=undefined;});
  modal.showModal();next.focus();
}
