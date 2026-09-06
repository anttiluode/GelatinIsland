/* The interface owns timing and interventions; world.js owns all dynamics. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id),{World,PRESETS}=Gelatin;
  const canvas=$('world'),params=new URLSearchParams(location.search);
  let world,renderer,paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let speed=1,accumulator=0,previous=0,lastStats=-1,frames=0,fpsTime=0,tool='pulse',dragging=false,lastPoint=null;
  let history=[],probeWorker=null,probeTimer=null,recording=null,recordTimer=null,recordStream=null;
  const status=text=>{$('status').textContent=text;};
  const hints={pulse:'Touch a route to send a pulse. Space pauses.',feed:'Paint a food source. Nearby carriers can sense its local gradient.',cut:'Drag across a route to erase it. Watch whether it regrows.',wall:'Draw a dam. Material and signals cannot cross it.',heal:'Drag over a dam to open the sea again.'};
  function download(blob,name){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
  function syncPause(){ $('pause').textContent=paused?'Resume':'Pause';$('pause').setAttribute('aria-pressed',String(paused));accumulator=0; }
  function newWorld(){
    cancelProbe();
    const seed=Number($('seed').value);
    if(!Number.isInteger(seed)||seed<0||seed>4294967295){status('Choose a whole-number seed from 0 to 4294967295.');return;}
    const small=matchMedia('(max-width: 700px)').matches;
    world=new World({seed,preset:$('preset').value,width:small?192:288,height:small?128:176});
    world.spontaneous=$('spontaneous').checked;world.writing=$('writing').checked;world.frozen=$('freeze').checked;
    history=[];lastStats=-1;accumulator=0;$('scene-name').textContent=PRESETS[world.preset].name;
    $('test-card').hidden=true;status('Growing from scattered carriers. Give it a few seconds.');
    try{const url=new URL(location.href);url.searchParams.set('seed',String(seed));url.searchParams.set('habitat',world.preset);window.history.replaceState(null,'',url);}catch{}
    updateStats();
  }
  function updateStats(){
    const s=world.stats();$('clock').textContent=s.tick.toLocaleString()+' ticks';
    $('stat-carriers').textContent=s.carriers.toLocaleString();$('stat-active').textContent=s.activeCells.toLocaleString();
    $('stat-gel').textContent=(s.gelFraction*100).toFixed(1)+'%';$('stat-food').textContent=(s.meanFood*100).toFixed(0)+'%';
    if(lastStats!==world.tick){history.push({tick:world.tick,value:s.activeCells/world.size});history=history.filter(p=>p.tick>world.tick-1800);}
    lastStats=world.tick;
    const cc=$('activity-chart').getContext('2d');cc.clearRect(0,0,240,45);cc.strokeStyle='#ffbc71';cc.lineWidth=1.4;cc.beginPath();
    const max=Math.max(.04,...history.map(p=>p.value));history.forEach((p,i)=>{const x=240-(world.tick-p.tick)/1800*240,y=43-p.value/max*39;i?cc.lineTo(x,y):cc.moveTo(x,y);});cc.stroke();
    if(world.tick>190&&world.tick<210)status('The material is forming. Pulse a route, or let local charging launch signals.');
  }
  function loop(now){
    const elapsed=previous?Math.min(100,now-previous):16;previous=now;
    if(!document.hidden&&!paused){
      accumulator+=elapsed/1000*30*speed;
      // Cap the work in one frame; never let a slow device accumulate an endless backlog.
      const count=Math.min(6,Math.floor(accumulator));if(count){world.step(count);accumulator=Math.min(6,accumulator-count);}
    }
    if(!document.hidden){renderer.render(world);frames++;if(now-fpsTime>1000){$('performance').textContent=`${Math.round(frames*1000/(now-fpsTime))} fps · ${world.width} × ${world.height} · ${renderer.backend}`;frames=0;fpsTime=now;}
      if(world.tick-lastStats>=12||lastStats<0)updateStats();}
    requestAnimationFrame(loop);
  }
  function point(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*world.width,y:(e.clientY-r.top)/r.height*world.height};}
  function brushRadius(){return tool==='feed'?10:tool==='pulse'?5:3.5;}
  function brush(p){
    const r=brushRadius();
    if(lastPoint&&tool!=='pulse'){const d=Math.hypot(p.x-lastPoint.x,p.y-lastPoint.y),steps=Math.ceil(d/(r*.45));for(let i=1;i<=steps;i++)world.brush(lastPoint.x+(p.x-lastPoint.x)*i/steps,lastPoint.y+(p.y-lastPoint.y)*i/steps,r,tool,tool==='cut'?2:1);}
    else world.brush(p.x,p.y,r,tool,tool==='cut'?2:tool==='pulse'?1.25:1);
    lastPoint=p;updateStats();
  }
  canvas.addEventListener('pointerdown',e=>{e.preventDefault();canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);dragging=true;lastPoint=null;brush(point(e));});
  canvas.addEventListener('pointermove',e=>{const p=point(e),r=canvas.getBoundingClientRect(),c=$('cursor');c.style.display='block';c.style.left=(p.x/world.width*r.width)+'px';c.style.top=(p.y/world.height*r.height)+'px';c.style.width=(2*brushRadius()/world.width*r.width)+'px';c.style.height=(2*brushRadius()/world.height*r.height)+'px';if(dragging)brush(p);});
  const endDrag=()=>{dragging=false;lastPoint=null;};canvas.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);canvas.addEventListener('lostpointercapture',endDrag);canvas.addEventListener('pointerleave',()=>{$('cursor').style.display='none';});
  document.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>{tool=b.dataset.tool;document.querySelectorAll('[data-tool]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));$('hint').textContent=hints[tool];}));
  $('pause').onclick=()=>{paused=!paused;syncPause();};
  function cinema(on){document.body.classList.toggle('cinema',on);requestAnimationFrame(()=>renderer.resize());}
  $('cinema').onclick=()=>cinema(true);$('exit-cinema').onclick=()=>cinema(false);
  document.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA','BUTTON'].includes(document.activeElement?.tagName))return;if(e.code==='Space'){e.preventDefault();paused=!paused;syncPause();}if(e.key==='Escape')cinema(false);if(e.key.toLowerCase()==='f')cinema(!document.body.classList.contains('cinema'));if(e.key.toLowerCase()==='p')world.brush(world.width/2,world.height/2,5,'pulse',1.25);});
  $('about-link').onclick=()=>{$('notes').open=true;};
  $('new-world').onclick=newWorld;$('preset').onchange=newWorld;
  $('speed').oninput=e=>{speed=Number(e.target.value);$('speed-value').textContent=speed+'×';};
  $('lens').onchange=e=>{renderer.lens=Number(e.target.value);};
  $('palette').onchange=e=>{renderer.palette=Number(e.target.checked);};
  $('carriers').onchange=e=>{renderer.carriers=e.target.checked;};
  $('spontaneous').onchange=e=>{world.spontaneous=e.target.checked;status(e.target.checked?'Local charging can launch new signals.':'Local charging is off. Existing emission plateaus finish within 21 ticks.');};
  $('freeze').onchange=e=>{world.frozen=e.target.checked;status(e.target.checked?'Structure is held still. Signals and recovery continue.':'Carriers and material are moving again.');};
  $('writing').onchange=e=>{world.writing=e.target.checked;status(e.target.checked?'Signals can reinforce the gel.':'Signal reinforcement is off; carrier trails still build material.');};
  $('save').onclick=()=>{download(new Blob([JSON.stringify(world.snapshot())],{type:'application/json'}),`gelatin-${world.seed}-${world.tick}.json`);status('Saved the full world, including its material and random state.');};
  $('load').onclick=()=>{$('load-world').click();};
  $('load-world').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>24*1024*1024)throw new Error('World file is too large (24 MB maximum).');const loaded=World.restore(JSON.parse(await f.text()));cancelProbe();world=loaded;history=[];lastStats=-1;$('seed').value=world.seed;$('preset').value=world.preset;$('spontaneous').checked=world.spontaneous;$('freeze').checked=world.frozen;$('writing').checked=world.writing;$('scene-name').textContent=PRESETS[world.preset].name;$('test-card').hidden=true;updateStats();status('World restored. It continues from the saved state.');}catch(error){status('Could not load: '+error.message);}finally{e.target.value='';}};
  function cancelProbe(){if(probeWorker)probeWorker.terminate();probeWorker=null;clearTimeout(probeTimer);$('probe').disabled=false;$('probe').textContent='Does the shape matter?';}
  $('probe').onclick=()=>{
    if(world.stats().material<.025){status('Let more material grow before testing the shape.');return;}
    try{
      $('probe').disabled=true;$('probe').textContent='Sending the same pulse…';status('Testing two frozen copies. Your live world keeps running.');
      probeWorker=new Worker('web/probe-worker.js');
      probeWorker.onmessage=e=>{cancelProbe();if(!e.data.ok){status('Shape test: '+e.data.error);return;}showProbe(e.data.result);};
      probeWorker.onerror=()=>{cancelProbe();status('The background test could not start. Use the hosted page, or run the Node experiment from the repository.');};
      probeWorker.postMessage(world.snapshot());probeTimer=setTimeout(()=>{cancelProbe();status('The shape test took too long on this device. The world is still available.');},60000);
    }catch(error){cancelProbe();status('Shape test unavailable: '+error.message);}
  };
  function showProbe(r){
    const card=$('test-card');card.hidden=false;card.replaceChildren();
    const title=document.createElement('strong');title.textContent='Same material. Different arrangement.';card.append(title);
    const desc=document.createElement('p');desc.textContent=`Snapshot at tick ${r.tick}. One ${r.steps}-tick probe, source (${r.source.x}, ${r.source.y}). Fast state reset; food matched; source neighbourhood preserved.`;card.append(desc);
    const table=document.createElement('table');table.innerHTML='<thead><tr><th>Frozen world</th><th>Cells reached</th><th>Farthest reach</th></tr></thead>';
    const body=document.createElement('tbody');for(const [key,label] of [['intact','Grown geometry'],['shuffled','Rearranged material']]){const tr=document.createElement('tr');for(const v of [label,r[key].reached.toLocaleString(),r[key].maxDistance.toFixed(1)+' cells']){const td=document.createElement('td');td.textContent=v;tr.append(td);}body.append(tr);}table.append(body);card.append(table);
    const maps=document.createElement('div');maps.style.cssText='display:flex;gap:12px;flex-wrap:wrap';
    for(const key of ['intact','shuffled']){const fig=document.createElement('figure');fig.style.cssText='margin:0;flex:1;min-width:170px';const map=document.createElement('canvas');map.width=r.width;map.height=r.height;map.style.cssText='width:100%;border:1px solid #26333f;border-radius:6px';const cx=map.getContext('2d'),im=cx.createImageData(r.width,r.height);for(let i=0;i<r[key].peak.length;i++){const u=r[key].peak[i];im.data[i*4]=6+u*249;im.data[i*4+1]=12+u*170;im.data[i*4+2]=20+u*74;im.data[i*4+3]=255;}cx.putImageData(im,0,0);const caption=document.createElement('figcaption');caption.className='small';caption.textContent=(key==='intact'?'Grown':'Rearranged')+' · peak excitation';fig.append(map,caption);maps.append(fig);}card.append(maps);
    const note=document.createElement('p');const difference=r.intact.reached-r.shuffled.reached;note.textContent=`“Reached” counts cells outside the protected source disk that crossed 0.5 excitation. ${difference>0?'The grown arrangement carried this pulse to more cells.':difference<0?'The rearranged material carried this pulse to more cells.':'This probe found no difference in the number of cells reached.'} This tests routing in this snapshot; it is not an intelligence score.`;card.append(note);
    const save=document.createElement('button');save.textContent='Save this receipt';save.onclick=()=>download(new Blob([JSON.stringify(r,null,2)],{type:'application/json'}),`gelatin-probe-${r.seed}-${r.tick}.json`);card.append(save);status('Shape test finished. The comparison is below the world.');
  }
  function finishRecording(){if(recording&&recording.state!=='inactive')recording.stop();}
  $('record').onclick=()=>{
    if(recording){finishRecording();return;}
    if(!canvas.captureStream||typeof MediaRecorder==='undefined'){status('This browser cannot record the canvas. Try a current Chrome, Edge, or Firefox browser.');return;}
    try{
      const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm','video/mp4'].find(m=>MediaRecorder.isTypeSupported(m));
      recordStream=canvas.captureStream(30);recording=new MediaRecorder(recordStream,mime?{mimeType:mime,videoBitsPerSecond:8000000}:{});
      const chunks=[],recordSeed=world.seed,recordTick=world.tick;recording.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      recording.onstop=()=>{clearTimeout(recordTimer);const type=recording.mimeType;recording=null;recordStream.getTracks().forEach(t=>t.stop());recordStream=null;$('record').textContent='Record 20s';download(new Blob(chunks,{type}),`gelatin-${recordSeed}-${recordTick}.${type.includes('mp4')?'mp4':'webm'}`);status('Video saved. It contains the simulation, without the controls.');};
      recording.onerror=()=>{status('Recording failed in this browser.');finishRecording();};recording.start();recordTimer=setTimeout(finishRecording,20000);$('record').textContent='Stop recording';paused=false;syncPause();status('Recording 20 seconds of the canvas. Keep this tab visible.');
    }catch(error){if(recordStream)recordStream.getTracks().forEach(t=>t.stop());recordStream=null;recording=null;status('Could not record: '+error.message);}
  };
  document.addEventListener('visibilitychange',()=>{previous=0;accumulator=0;if(document.hidden&&recording)finishRecording();});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();paused=true;syncPause();status('Graphics context lost. Reload the page to restart the renderer. You can still save the world.');});
  try{
    $('seed').value=/^\d+$/.test(params.get('seed')||'')?params.get('seed'):42;
    if(PRESETS[params.get('habitat')])$('preset').value=params.get('habitat');
    renderer=new GelatinRenderer(canvas);newWorld();syncPause();
    new ResizeObserver(()=>renderer.resize()).observe($('stage'));renderer.resize();
    if(paused)status('Paused for your reduced-motion preference. Press Resume when ready.');
    requestAnimationFrame(loop);
  }catch(error){status('Could not start the world: '+error.message);$('hint').textContent='The world could not start. See the message beside the controls.';console.error(error);}
})();
