/* Rendering reads the world; it never changes the simulation. MIT. */
(function(root){
  'use strict';
  const VERT=`attribute vec2 a_position; varying vec2 uv;
    void main(){uv=a_position*.5+.5;gl_Position=vec4(a_position,0.,1.);}`;
  const FRAG=`precision highp float;
    varying vec2 uv; uniform sampler2D state, detail; uniform vec2 texel;
    uniform float lens, palette;
    vec4 get(vec2 p){return texture2D(state,clamp(p,texel*.5,1.-texel*.5));}
    float heightAt(vec2 p){vec4 s=get(p);return s.r*.72+texture2D(detail,p).r*.28;}
    void main(){
      vec2 p=vec2(uv.x,1.-uv.y);vec4 s=get(p),d=texture2D(detail,p);
      float m=s.r,u=s.g,v=s.b,n=s.a,t=d.r;
      float body=smoothstep(.025,.23,m*.85+t*.26);
      float dx=heightAt(p+vec2(texel.x,0.))-heightAt(p-vec2(texel.x,0.));
      float dy=heightAt(p+vec2(0.,texel.y))-heightAt(p-vec2(0.,texel.y));
      vec3 normal=normalize(vec3(-dx*9.,-dy*9.,.9));
      float diffuse=max(0.,dot(normal,normalize(vec3(-.6,-.8,1.2))));
      float spec=pow(max(0.,dot(normal,normalize(vec3(-.5,-.65,1.8)))),34.);
      float rim=pow(length(vec2(dx,dy))*3.6,.8);
      vec3 sea=vec3(.012,.024,.043);
      vec3 cold=mix(vec3(.025,.30,.39),vec3(.17,.85,.68),clamp(t*.8+m*.2,0.,1.));
      vec3 warm=vec3(1.,.52,.15),memory=vec3(.34,.16,.64);
      if(palette>.5){cold=mix(vec3(.25,.06,.25),vec3(.82,.28,.38),m);warm=vec3(.98,.84,.35);memory=vec3(.22,.25,.67);}
      vec3 color=sea+vec3(.018,.027,.034)*n;
      color+=memory*m*.19;
      color=mix(color,cold*(.16+.43*diffuse)+vec3(.35,.68,.71)*spec*.35,body*.92);
      color+=cold*rim*.17;
      float front=u*(1.-smoothstep(.15,.62,v));
      float halo=(get(p+texel*vec2(2.,0.)).g+get(p-texel*vec2(2.,0.)).g+get(p+texel*vec2(0.,2.)).g+get(p-texel*vec2(0.,2.)).g)*.25;
      color+=warm*(front*.9+u*.23+halo*.10);
      color+=memory*v*body*.65;
      color+=cold*pow(clamp(t,0.,1.),2.)*.3;
      if(lens>0.5&&lens<1.5) color=mix(sea,vec3(.24,.9,.74),m)+vec3(.25,.15,.46)*t*.15;
      if(lens>1.5&&lens<2.5) color=sea+warm*u+vec3(.24,.18,.64)*v*.65;
      if(lens>2.5) color=sea+mix(vec3(.05,.15,.3),vec3(.45,.8,.42),n)*n;
      if(d.b>.5) color=vec3(.065,.077,.09)+.018*step(.5,fract((p.x/texel.x+p.y/texel.y)*.22));
      float edge=smoothstep(0.,.07,p.x)*smoothstep(0.,.07,1.-p.x)*smoothstep(0.,.07,p.y)*smoothstep(0.,.07,1.-p.y);
      color*=.72+.28*edge;
      color=vec3(1.)-exp(-color*1.45); color=pow(color,vec3(.88));
      gl_FragColor=vec4(color,1.);
    }`;
  const POINTV=`attribute vec3 a_carrier;uniform vec2 worldSize;uniform float pointSize;varying float excitation;
    void main(){gl_Position=vec4(a_carrier.x/worldSize.x*2.-1.,1.-a_carrier.y/worldSize.y*2.,0.,1.);gl_PointSize=pointSize;excitation=a_carrier.z;}`;
  const POINTF=`precision mediump float;varying float excitation;void main(){float r=length(gl_PointCoord-.5);float a=exp(-r*r*18.)*.4;gl_FragColor=vec4(mix(vec3(.4,.95,.88),vec3(1.,.72,.3),excitation),a);}`;
  function program(gl,v,f){
    const shaders=[gl.VERTEX_SHADER,gl.FRAGMENT_SHADER].map((type,i)=>{const s=gl.createShader(type);gl.shaderSource(s,i?f:v);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));return s;});
    const p=gl.createProgram();shaders.forEach(s=>gl.attachShader(p,s));gl.linkProgram(p);
    shaders.forEach(s=>gl.deleteShader(s));if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;
  }
  class Renderer{
    constructor(canvas){
      this.canvas=canvas;this.lens=0;this.palette=0;this.carriers=true;this.backend='WebGL';
      const gl=canvas.getContext('webgl',{alpha:false,antialias:false,preserveDrawingBuffer:true});
      if(!gl){this.backend='Canvas';this.ctx=canvas.getContext('2d');this.surface=document.createElement('canvas');this.sctx=this.surface.getContext('2d');return;}
      this.gl=gl;this.main=program(gl,VERT,FRAG);this.points=program(gl,POINTV,POINTF);
      this.quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
      this.pointBuffer=gl.createBuffer();this.textures=[0,1].map(unit=>{const t=gl.createTexture();gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;});
      this.uniforms=Object.fromEntries(['state','detail','texel','lens','palette'].map(n=>[n,gl.getUniformLocation(this.main,n)]));
      this.puniforms=Object.fromEntries(['worldSize','pointSize'].map(n=>[n,gl.getUniformLocation(this.points,n)]));
    }
    resize(){
      const r=this.canvas.getBoundingClientRect(),scale=Math.min(devicePixelRatio||1,1.6);
      const w=Math.max(1,Math.round(r.width*scale)),h=Math.max(1,Math.round(r.height*scale));
      if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
    }
    render(w){
      if(!this.pixels||this.pixels.length!==w.size*4){this.pixels=new Uint8Array(w.size*4);this.detail=new Uint8Array(w.size*4);}
      for(let i=0;i<w.size;i++){
        const k=i*4;this.pixels[k]=w.gel[i]*255;this.pixels[k+1]=w.excite[i]*255;this.pixels[k+2]=w.recover[i]*255;this.pixels[k+3]=w.food[i]*255;
        this.detail[k]=Math.min(255,w.trail[i]*150);this.detail[k+1]=Math.min(255,w.charge[i]*255);this.detail[k+2]=w.wall[i]*255;this.detail[k+3]=255;
      }
      const gl=this.gl;if(!gl){this.fallback(w);return;}
      gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.disable(gl.BLEND);gl.useProgram(this.main);
      gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);const pos=gl.getAttribLocation(this.main,'a_position');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
      [this.pixels,this.detail].forEach((data,i)=>{gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,this.textures[i]);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w.width,w.height,0,gl.RGBA,gl.UNSIGNED_BYTE,data);});
      const un=this.uniforms;gl.uniform1i(un.state,0);gl.uniform1i(un.detail,1);gl.uniform2f(un.texel,1/w.width,1/w.height);gl.uniform1f(un.lens,this.lens);gl.uniform1f(un.palette,this.palette);gl.drawArrays(gl.TRIANGLES,0,6);gl.disableVertexAttribArray(pos);
      if(!this.carriers||this.lens>0)return;
      if(!this.pdata||this.pdata.length!==w.agentCount*3)this.pdata=new Float32Array(w.agentCount*3);
      for(let i=0;i<w.agentCount;i++){this.pdata[i*3]=w.x[i];this.pdata[i*3+1]=w.y[i];this.pdata[i*3+2]=w.excite[(w.y[i]|0)*w.width+(w.x[i]|0)];}
      gl.useProgram(this.points);gl.bindBuffer(gl.ARRAY_BUFFER,this.pointBuffer);gl.bufferData(gl.ARRAY_BUFFER,this.pdata,gl.DYNAMIC_DRAW);
      const ap=gl.getAttribLocation(this.points,'a_carrier');gl.enableVertexAttribArray(ap);gl.vertexAttribPointer(ap,3,gl.FLOAT,false,0,0);
      gl.uniform2f(this.puniforms.worldSize,w.width,w.height);gl.uniform1f(this.puniforms.pointSize,Math.max(1.3,this.canvas.width/w.width*.55));gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.drawArrays(gl.POINTS,0,w.agentCount);gl.disableVertexAttribArray(ap);gl.disable(gl.BLEND);
    }
    fallback(w){
      if(this.surface.width!==w.width||this.surface.height!==w.height){this.surface.width=w.width;this.surface.height=w.height;this.im=this.sctx.createImageData(w.width,w.height);}
      const a=this.im.data;
      for(let i=0;i<w.size;i++){
        const m=w.gel[i],u=w.excite[i],v=w.recover[i],n=w.food[i],t=Math.min(1,w.trail[i]);
        let r=5+30*m+245*u+55*v,g=10+135*m+70*t+125*u,b=18+120*m+45*t+110*v;
        if(this.lens===1){r=5+60*m;g=10+220*m;b=20+180*m;}
        if(this.lens===2){r=5+250*u+50*v;g=8+140*u;b=18+140*v;}
        if(this.lens===3){r=5+100*n;g=10+190*n;b=18+85*n;}
        if(w.wall[i]>.5){r=20;g=25;b=30;}
        a[i*4]=r;a[i*4+1]=g;a[i*4+2]=b;a[i*4+3]=255;
      }
      this.sctx.putImageData(this.im,0,0);this.ctx.imageSmoothingEnabled=true;this.ctx.drawImage(this.surface,0,0,this.canvas.width,this.canvas.height);
    }
  }
  root.GelatinRenderer=Renderer;
})(globalThis);
