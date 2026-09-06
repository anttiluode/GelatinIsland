#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {World,VERSION,PRESETS}=require('../web/world.js'),{compare}=require('../web/probe.js');
function args(){const a=process.argv.slice(2),out={seeds:'42,7,19,73,101,2026',preset:'estuary',out:'artifacts/spatial',steps:'1200'};for(let i=0;i<a.length;i+=2){if(!a[i]?.startsWith('--')||a[i+1]===undefined)throw new Error('Use --seeds 42,7 --preset estuary --out folder --steps 1200');out[a[i].slice(2)]=a[i+1];}return out;}
const options=args(),seeds=options.seeds.split(',').map(Number),growth=Number(options.steps);
if(!seeds.length||seeds.length>64||seeds.some(s=>!Number.isInteger(s)||s<0||s>4294967295)||!PRESETS[options.preset]||!Number.isInteger(growth)||growth<100||growth>20000)throw new Error('Invalid experiment configuration');
const engineSHA256=crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../web/world.js'))).digest('hex');
fs.mkdirSync(options.out,{recursive:true});const rows=[];
for(const seed of seeds){
  const w=new World({width:216,height:128,preset:options.preset,seed});w.step(growth);const state=w.snapshot();World.restore(state);
  const r=compare(state,{includeMap:seed===42}),stats=w.stats();
  if(Math.abs(r.intact.materialMean-r.shuffled.materialMean)>1e-10)throw new Error('Shuffle changed material amount');
  fs.writeFileSync(path.join(options.out,`seed-${seed}.json`),JSON.stringify({...r,growthStats:stats,engineSHA256},null,2));
  const row={seed,preset:w.preset,growthTicks:growth,meanMaterial:stats.material,gelFraction:stats.gelFraction,spontaneousLaunches:stats.launches,thresholdCrossings:stats.firings,intactReached:r.intact.reached,shuffledReached:r.shuffled.reached,intactDistance:r.intact.maxDistance,shuffledDistance:r.shuffled.maxDistance,difference:r.intact.reached-r.shuffled.reached};rows.push(row);console.log(JSON.stringify(row));
}
const median=values=>{const a=[...values].sort((a,b)=>a-b),m=a.length>>1;return a.length%2?a[m]:(a[m-1]+a[m])/2;};
const report={schema:'gelatin-world/seed-sweep-v1',version:VERSION,engineSHA256,preset:options.preset,width:216,height:128,growthTicks:growth,probeTicks:360,seeds,developmentSeed:42,boundary:'Exploratory shape intervention. Seed 42 informed development; additional seeds were not used for parameter tuning. A strong pixel-shuffle null tests spatial correlation, not optimality or biological validity.',summary:{count:rows.length,grownGreater:rows.filter(r=>r.difference>0).length,shuffledGreater:rows.filter(r=>r.difference<0).length,tied:rows.filter(r=>r.difference===0).length,medianGrownReached:median(rows.map(r=>r.intactReached)),medianShuffledReached:median(rows.map(r=>r.shuffledReached)),medianDifference:median(rows.map(r=>r.difference))},rows};
fs.writeFileSync(path.join(options.out,'summary.json'),JSON.stringify(report,null,2));
const md=['# Spatial shape intervention','',report.boundary,'',`Engine: ${engineSHA256}. Habitat: ${report.preset}; lattice ${report.width} × ${report.height}; grow ${growth}, probe 360 ticks.`,'','The source disk, gel histogram, walls, initial fast state and food are matched. “Reached” is the count of cells beyond radius 8 whose peak excitation exceeds 0.5. All requested seeds are shown.','','| Seed | Grown shape: reached | Rearranged: reached | Difference |','|---:|---:|---:|---:|',...rows.map(r=>`| ${r.seed} | ${r.intactReached} | ${r.shuffledReached} | ${r.difference} |`),'',`Grown greater in ${report.summary.grownGreater}/${rows.length}; shuffled greater in ${report.summary.shuffledGreater}/${rows.length}; tied in ${report.summary.tied}/${rows.length}.`,'','This is a causal effect of arrangement in the specified model and probe protocol. It does not establish a useful learned task, intelligence, novelty, or a biological neuron.',''].join('\n');
fs.writeFileSync(path.join(options.out,'REPORT.md'),md);console.log(JSON.stringify(report.summary));
