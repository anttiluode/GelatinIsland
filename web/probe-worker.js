'use strict';
importScripts('world.js','probe.js');
onmessage=event=>{
  try {postMessage({ok:true,result:GelatinProbe.compare(event.data,{includeMap:true})});}
  catch(error){postMessage({ok:false,error:error.message});}
};
