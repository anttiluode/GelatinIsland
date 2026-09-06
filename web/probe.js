/* Causal geometry intervention, shared by the browser worker and Node. MIT. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./world.js'));
  else root.GelatinProbe=factory(root.Gelatin);
})(globalThis,function(Gelatin){
  'use strict';
  const {World,VERSION}=Gelatin;
  function chooseSource(w){
    let best=-Infinity,index=0;
    for(let y=8;y<w.height-8;y++)for(let x=8;x<w.width-8;x++){
      const i=y*w.width+x;if(w.wall[i]>.5)continue;
      const centrality=1-.45*Math.hypot((x-w.width/2)/w.width,(y-w.height/2)/w.height);
      const score=w.gel[i]*centrality;
      if(score>best){best=score;index=i;}
    }
    return {x:index%w.width,y:Math.floor(index/w.width),material:w.gel[index]};
  }
  function quiet(w){
    w.frozen=true;w.spontaneous=false;w.clearActivity();w.food.fill(.8);w.supply.fill(.8);
    for(let i=0;i<w.size;i++)if(w.wall[i]>.5){w.food[i]=0;w.supply[i]=0;}
    return w;
  }
  function rearrange(w,source,radius=8){
    const indices=[];
    for(let i=0;i<w.size;i++)if(w.wall[i]<.5&&Math.hypot(i%w.width-source.x,Math.floor(i/w.width)-source.y)>radius)indices.push(i);
    for(let k=indices.length-1;k>0;k--){const j=Math.floor(w.random()*(k+1)),a=indices[k],b=indices[j],t=w.gel[a];w.gel[a]=w.gel[b];w.gel[b]=t;}
    return w;
  }
  function measure(w,source,steps=360,includeMap=false){
    const peak=new Float32Array(w.size);let maxDistance=0,integral=0;
    w.brush(source.x,source.y,4,'pulse',1.25);
    for(let t=0;t<steps;t++){
      w.step();
      for(let i=0;i<w.size;i++){
        const u=w.excite[i];if(u>peak[i])peak[i]=u;
        if(Math.hypot(i%w.width-source.x,Math.floor(i/w.width)-source.y)>8)integral+=u;
      }
    }
    let reached=0;
    for(let i=0;i<w.size;i++)if(peak[i]>.5){const d=Math.hypot(i%w.width-source.x,Math.floor(i/w.width)-source.y);maxDistance=Math.max(maxDistance,d);if(d>8)reached++;}
    const result={reached,maxDistance,integratedExcitation:integral,materialMean:w.stats().material};
    if(includeMap)result.peak=Array.from(peak);
    return result;
  }
  function compare(snapshot,{steps=360,includeMap=false}={}){
    const intact=quiet(World.restore(snapshot)),source=chooseSource(intact);
    const shuffled=rearrange(intact.clone(),source);
    return {schema:'gelatin-world/shape-probe-v1',version:VERSION,seed:intact.seed,tick:snapshot.tick,width:intact.width,height:intact.height,steps,source,sourceProtectedRadius:8,food:.8,
      protocol:'Freeze carriers and material; reset excitation, recovery and charging; equalize food; preserve source disk; shuffle gel values elsewhere; apply identical radius-4 pulse. Count cells above 0.5 outside radius 8.',
      intact:measure(intact,source,steps,includeMap),shuffled:measure(shuffled,source,steps,includeMap)};
  }
  return {compare,chooseSource,quiet,rearrange,measure};
});
