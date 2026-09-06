#!/usr/bin/env node
/* Stream exact simulation fields for offline rendering; no browser dependency. */
'use strict';
const {World}=require('../web/world.js');
const seed=Number(process.argv[2]??42),preset=process.argv[3]??'estuary';
const width=288,height=176,w=new World({width,height,seed,preset});
const frames=360,ticksPerFrame=5,preroll=120;w.step(preroll);
process.stdout.write(JSON.stringify({width,height,seed,preset,frames,ticksPerFrame,preroll,fps:30,fields:['gel','excite','recover','food','trail','wall']})+'\n');
for(let f=0;f<frames;f++){
  w.step(ticksPerFrame);const pixels=Buffer.alloc(w.size*6);
  for(let i=0;i<w.size;i++){pixels[i*6]=Math.round(w.gel[i]*255);pixels[i*6+1]=Math.round(w.excite[i]*255);pixels[i*6+2]=Math.round(w.recover[i]*255);pixels[i*6+3]=Math.round(w.food[i]*255);pixels[i*6+4]=Math.round(Math.min(1,w.trail[i]*150/255)*255);pixels[i*6+5]=w.wall[i]>.5?255:0;}
  process.stdout.write(JSON.stringify({tick:w.tick,pixels:pixels.toString('base64'),carriers:Array.from(w.x).map((x,i)=>[Math.round(x*10)/10,Math.round(w.y[i]*10)/10])})+'\n');
}
