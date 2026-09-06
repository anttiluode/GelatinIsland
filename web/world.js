/* Gelatin Island — deterministic spatial substrate, shared by browser and Node.
 * MIT. Units are lattice cells and simulation ticks, not biological units.
 * No assigned scout roles, destination search, edge list, or Train/Neuron class.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Gelatin = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = '2.0.0';
  const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
  const smooth = (a, b, x) => { const q = clamp((x - a) / (b - a)); return q * q * (3 - 2 * q); };
  const FIELDS = ['trail', 'gel', 'excite', 'recover', 'food', 'charge', 'supply', 'wall'];
  const PRESETS = {
    estuary: { name: 'Estuary', description: 'Branching routes, slow consolidation, wandering fronts.', sensor: 6.5, turn: .48, speed: .72, diffusion: .16, decay: .035, deposit: .115, density: .14, drive: .85, growth: .005, erosion: .0018, feedback: .012 },
    lace: { name: 'Lace', description: 'Long sensing distances draw open loops and fine filaments.', sensor: 9.5, turn: .32, speed: .85, diffusion: .13, decay: .045, deposit: .13, density: .115, drive: .60, growth: .005, erosion: .0018, feedback: .016 },
    bloom: { name: 'Bloom', description: 'Shorter sensing and richer food gather thick, restless bodies.', sensor: 4.8, turn: .65, speed: .57, diffusion: .20, decay: .029, deposit: .13, density: .16, drive: 1.15, growth: .008, erosion: .0015, feedback: .012 }
  };

  class World {
    constructor(options = {}) {
      this.width = options.width ?? 216; this.height = options.height ?? 128;
      if (!Number.isInteger(this.width) || !Number.isInteger(this.height) || this.width < 24 || this.height < 24 || this.width * this.height > 300000) throw new Error('Invalid world dimensions');
      this.size = this.width * this.height;
      this.seed = (options.seed ?? 42) >>> 0; this.rng = this.seed || 1;
      this.preset = PRESETS[options.preset] ? options.preset : 'estuary';
      this.params = { ...PRESETS[this.preset], ...options.params };
      this.tick = 0; this.frozen = false; this.spontaneous = true; this.writing = true;
      this.firings = 0; this.pacemakers = 0;
      for (const f of FIELDS) this[f] = new Float32Array(this.size);
      this.next = Object.fromEntries(['trail','gel','excite','recover','food','charge'].map(f => [f,new Float32Array(this.size)]));
      this.deposits = new Float32Array(this.size); this.consumption = new Float32Array(this.size);
      this.conductance = new Float32Array(this.size); this.occupancy = new Uint16Array(this.size);
      this.agentCount = options.agentCount ?? Math.round(this.size * this.params.density);
      if (!Number.isInteger(this.agentCount) || this.agentCount < 0 || this.agentCount > this.size) throw new Error('Invalid carrier count');
      this.x = new Float32Array(this.agentCount); this.y = new Float32Array(this.agentCount);
      this.angle = new Float32Array(this.agentCount); this.sensorScale = new Float32Array(this.agentCount);
      // Initial conditions: broad nutrient geography; no planted routes or bodies.
      const spots = Array.from({length:7}, () => [this.random()*this.width, this.random()*this.height, 12+this.random()*24]);
      for (let y=0; y<this.height; y++) for (let x=0; x<this.width; x++) {
        const i=y*this.width+x;
        let s=.42;
        for (const [sx,sy,r] of spots) s += .20*Math.exp(-((sx-x)**2+(sy-y)**2)/(2*r*r));
        this.supply[i]=clamp(s); this.food[i]=this.supply[i];
        this.charge[i]=this.random()*.32;
      }
      for(let a=0; a<this.agentCount; a++) {
        this.x[a]=1+this.random()*(this.width-3); this.y[a]=1+this.random()*(this.height-3);
        this.angle[a]=this.random()*Math.PI*2; this.sensorScale[a]=.8+this.random()*.4;
      }
    }
    random() {
      let t = this.rng += 0x6D2B79F5; this.rng >>>= 0;
      t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
    sample(field,x,y) {
      x=clamp(x,0,this.width-1.001); y=clamp(y,0,this.height-1.001);
      const ix=x|0, iy=y|0, fx=x-ix, fy=y-iy, i=iy*this.width+ix;
      return field[i]*(1-fx)*(1-fy)+field[i+1]*fx*(1-fy)+field[i+this.width]*(1-fx)*fy+field[i+this.width+1]*fx*fy;
    }
    sense(x,y) {
      if(x<1||y<1||x>=this.width-1||y>=this.height-1) return -10;
      const i=(y|0)*this.width+(x|0);
      if(this.wall[i]>.5) return -10;
      return this.trail[i] + .18*this.gel[i] + 1.1*this.food[i] - 1.2*this.recover[i];
    }
    step(count = 1) {
      for (let s=0;s<count;s++) this.advance();
      return this;
    }
    advance() {
      const w=this.width,h=this.height,n=this.size,p=this.params;
      const T=this.trail,M=this.gel,U=this.excite,V=this.recover,N=this.food,Q=this.charge,B=this.wall;
      const d=this.deposits,c=this.consumption,occ=this.occupancy,K=this.conductance;
      d.fill(0);c.fill(0);occ.fill(0);
      if(!this.frozen) {
        for(let a=0;a<this.agentCount;a++) occ[(this.y[a]|0)*w+(this.x[a]|0)]++;
        for(let a=0;a<this.agentCount;a++) {
          let x=this.x[a],y=this.y[a],ang=this.angle[a];
          const dist=p.sensor*this.sensorScale[a], spread=.58;
          const f=this.sense(x+Math.cos(ang)*dist,y+Math.sin(ang)*dist);
          const l=this.sense(x+Math.cos(ang-spread)*dist,y+Math.sin(ang-spread)*dist);
          const r=this.sense(x+Math.cos(ang+spread)*dist,y+Math.sin(ang+spread)*dist);
          const noise=this.random()-.5;
          if(f<l&&f<r) ang += (noise<0?-1:1)*p.turn;
          else if(l>r&&l>f) ang-=p.turn;
          else if(r>l&&r>f) ang+=p.turn;
          ang+=noise*.18;
          const i=(y|0)*w+(x|0);
          const speed=p.speed*(.72+.50*N[i])*(1-.25*M[i])*(1+.6*U[i]);
          let nx=x+Math.cos(ang)*speed, ny=y+Math.sin(ang)*speed;
          if(nx<1||nx>w-2) {ang=Math.PI-ang;nx=clamp(nx,1,w-2);}
          if(ny<1||ny>h-2) {ang=-ang;ny=clamp(ny,1,h-2);}
          let ni=(ny|0)*w+(nx|0);
          if(B[ni]>.5 || occ[ni]>3) {ang+=noise*3+Math.PI*.65;nx=x;ny=y;ni=i;}
          else {if(occ[i]) occ[i]--;occ[ni]++;}
          this.x[a]=nx;this.y[a]=ny;this.angle[a]=ang % (2*Math.PI);
          if(B[ni]<.5) {
            d[ni]+=p.deposit*(.6+.4*N[ni])*(1+.7*U[ni]);
            c[ni]+=.006;
          }
        }
      }
      for(let i=0;i<n;i++) K[i]=B[i]>.5 ? 0 : .015+1.35*smooth(.045,.28,M[i]);
      const nt=this.next.trail,nm=this.next.gel,nu=this.next.excite,nv=this.next.recover,nn=this.next.food,nq=this.next.charge;
      let firings=0,launches=0;
      for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
        const i=y*w+x, left=x?i-1:i, right=x<w-1?i+1:i, up=y?i-w:i, down=y<h-1?i+w:i;
        if(B[i]>.5) {nt[i]=nm[i]=nu[i]=nv[i]=nn[i]=nq[i]=0;continue;}
        const t=T[i],m=M[i],u=U[i],v=V[i],food=N[i];
        const lapT=T[left]+T[right]+T[up]+T[down]-4*t;
        const lapM=M[left]+M[right]+M[up]+M[down]-4*m;
        const lapN=N[left]+N[right]+N[up]+N[down]-4*food;
        nt[i]=this.frozen?t:clamp((t+p.diffusion*lapT)*(1-p.decay)+d[i],0,5);
        // Carrier traffic builds gel. Excitation can additionally consolidate it.
        const growth=(p.growth*Math.max(0,t-.10)+(this.writing?p.feedback*u*t:0))*(1-m)*food;
        nm[i]=this.frozen?m:clamp(m+growth-p.erosion*m+.018*lapM);
        const gate=smooth(.045,.28,m);
        const threshold=.115+.64*v+.10*(1-food)+.40*(1-gate);
        // Symmetric, variable-conductance flux. Walls have zero-flux faces.
        let flux=0;
        for(const j of [left,right,up,down]) {
          const face=B[j]>.5?0:2*K[i]*K[j]/(K[i]+K[j]);
          flux+=face*(U[j]-u);
        }
        let newU=clamp(u+.52*u*(1-u)*(u-threshold)+.145*flux);
        nv[i]=clamp(v+.026*(u-v));
        nn[i]=clamp(food+.06*lapN+.0030*(this.supply[i]-food)-c[i]-.004*u*food-(this.frozen?0:Math.max(0,growth)*.15));
        // A local charging/recovery rule, identical everywhere. Nutrient-rich
        // domains can launch without a metronome or selected launcher coordinates.
        let q;
        if(Q[i]>1) {
          // A finite local emission plateau lets a launcher recruit its nearest
          // neighbours instead of disappearing in a single diffusion step.
          q=Q[i]-.01;newU=Math.max(newU,.96);if(q<=1)q=0;
        } else {
          q=Q[i]*.9995+(this.spontaneous?p.drive:0)*.0036*gate*food*(1-v);
          if(q>.72 && gate>.25 && v<.12 && food>.22) {newU=.96;q=1.2;launches++;nn[i]=Math.max(0,nn[i]-.06);}
        }
        if(u<.5&&newU>=.5) {firings++;if(q<=1)q=0;}
        nu[i]=newU;nq[i]=clamp(q,0,1.2);
      }
      for(const f of ['trail','gel','excite','recover','food','charge']) {const old=this[f];this[f]=this.next[f];this.next[f]=old;}
      this.firings+=firings;this.pacemakers+=launches;this.tick++;
    }
    brush(x,y,radius,mode='pulse',strength=1) {
      if(![x,y,radius,strength].every(Number.isFinite)||radius<=0) return;
      const w=this.width;
      for(let yy=Math.max(0,Math.floor(y-radius));yy<=Math.min(this.height-1,Math.ceil(y+radius));yy++)
        for(let xx=Math.max(0,Math.floor(x-radius));xx<=Math.min(w-1,Math.ceil(x+radius));xx++) {
          const r=Math.hypot(xx-x,yy-y)/radius;if(r>1) continue;
          const i=yy*w+xx,a=(1-r*r)*strength;
          if(mode==='cut') {this.gel[i]*=1-clamp(a);this.trail[i]*=1-clamp(a);this.excite[i]=0;this.charge[i]=0;}
          else if(mode==='wall') {this.wall[i]=1;for(const f of ['gel','trail','excite','recover','charge','food']) this[f][i]=0;}
          else if(mode==='heal') this.wall[i]=0;
          else if(this.wall[i]<.5) {
            if(mode==='pulse') this.excite[i]=Math.max(this.excite[i],clamp(a));
            if(mode==='feed') {this.supply[i]=clamp(this.supply[i]+a*.6);this.food[i]=clamp(this.food[i]+a*.6);}
          }
        }
    }
    eraseMemory() {this.gel.fill(0);this.trail.fill(0);}
    clearActivity() {this.excite.fill(0);this.recover.fill(0);this.charge.fill(0);this.firings=0;this.pacemakers=0;}
    stats() {
      let gel=0,active=0,food=0,material=0,peak=0;
      for(let i=0;i<this.size;i++) {gel+=this.gel[i]>.20;active+=this.excite[i]>.5;food+=this.food[i];material+=this.gel[i];peak=Math.max(peak,this.excite[i]);}
      return {tick:this.tick,carriers:this.agentCount,gelFraction:gel/this.size,activeCells:active,meanFood:food/this.size,material:material/this.size,peak,firings:this.firings,launches:this.pacemakers};
    }
    snapshot() {
      const state={schema:'gelatin-world/v2',version:VERSION,width:this.width,height:this.height,seed:this.seed,rng:this.rng,preset:this.preset,params:{...this.params},tick:this.tick,agentCount:this.agentCount,frozen:this.frozen,spontaneous:this.spontaneous,writing:this.writing,firings:this.firings,pacemakers:this.pacemakers};
      for(const f of [...FIELDS,'x','y','angle','sensorScale']) state[f]=Array.from(this[f]);
      return state;
    }
    static restore(s) {
      if(!s||s.schema!=='gelatin-world/v2') throw new Error('This is not a Gelatin Island world.');
      const world=new World({width:s.width,height:s.height,seed:s.seed,preset:s.preset,agentCount:s.agentCount});
      for(const [k,v] of Object.entries(s.params??{})) {
        if(typeof world.params[k]==='number' && (!Number.isFinite(v)||v<0||v>12)) throw new Error('Invalid world parameters');
      }
      for(const f of [...FIELDS,'x','y','angle','sensorScale']) {
        if(!Array.isArray(s[f])||s[f].length!==world[f].length||!s[f].every(Number.isFinite)) throw new Error('Invalid field: '+f);
        world[f].set(s[f]);
      }
      for(let i=0;i<world.size;i++) for(const f of FIELDS) {
        const max=f==='trail'?5:f==='charge'?1.2:1;
        if(world[f][i]<0||world[f][i]>max+1e-6) throw new Error('Field out of bounds: '+f);
      }
      for(let i=0;i<world.agentCount;i++) if(world.x[i]<0||world.x[i]>=world.width-1||world.y[i]<0||world.y[i]>=world.height-1||world.sensorScale[i]<=0||world.sensorScale[i]>3) throw new Error('Invalid carrier');
      for(const k of ['tick','firings','pacemakers','rng']) if(!Number.isSafeInteger(s[k])||s[k]<0) throw new Error('Invalid counter');
      world.params={...world.params,...s.params};
      for(const k of ['tick','firings','pacemakers','rng']) world[k]=s[k];
      for(const k of ['frozen','spontaneous','writing']) world[k]=Boolean(s[k]);
      return world;
    }
    clone() {return World.restore(this.snapshot());}
  }
  return {World,PRESETS,VERSION,clamp,smooth};
});
