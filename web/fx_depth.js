// DEPTH: effects built on DAViD relative depth.   MATTE: silhouette / you-vs-room effects.
"use strict";
fx("Depth", "ctscan", "CT Scan Slices", "speed", "slices", `
vec3 fx(vec2 t){ float d = D(t); float s = fract(uTime*.12*(1.+uA*3.));
  float band = smoothstep(.02,.0,abs(d-s));
  float sl = step(.85, fract(d*(10.+uB*30.)));
  return C(t)*.12 + vec3(.1,.6,1.)*sl*.25*MM(t) + vec3(.6,1.,.9)*band*2. + vec3(1.)*band*edgeN(t,1.)*2.; }`);

fx("Depth", "wiggle", "3D Photo Wiggle", "speed", "amount", `
vec3 fx(vec2 t){ float sp = uTime*(1.+uA*4.);
  vec2 dir = vec2(cos(sp), sin(sp)*.5)*.012*(1.+uB*3.);
  vec2 q = t; for(int i=0;i<4;i++){ q = t - dir*(D(q)-.5); }
  return C(q); }`);

fx("Depth", "anaglyph", "Anaglyph 3D", "depth", "colour", `
vec3 fx(vec2 t){ float s = .01*(1.+uA*2.5); vec2 ql = t, qr = t;
  for(int i=0;i<3;i++){ ql = t + vec2(s*(D(ql)-.5), 0.); qr = t - vec2(s*(D(qr)-.5), 0.); }
  vec3 cl = C(ql), cr = C(qr);
  return mix(vec3(lum(cl), lum(cr), lum(cr)), vec3(cl.r, cr.g, cr.b), uB); }`);

fx("Depth", "contours", "Rainbow Contours", "lines", "photo", `
vec3 fx(vec2 t){ float v = D(t)*(15.+uA*60.) - uTime*1.5;
  float l = abs(fract(v)-.5)/max(fwidth(v),1e-4); float line = 1.-min(l/1.5,1.);
  return rainbow(floor(v)*.07 + uTime*.05)*line*2.2 + C(t)*(.1+uB*.6); }`);

fx("Depth", "relief", "Bas-Relief", "depth", "brass", `
vec3 fx(vec2 t){ float e = 1.5/uAuxSize.x;
  float dz = (D(t+vec2(e,e)) - D(t-vec2(e,e)))*20.*(1.+uA*3.);
  float sh = lambert(N(t), vec3(-.6,-.6,.5))*.8 + dz*.5;
  vec3 stone = vec3(.5,.48,.45)*(.45+sh);
  vec3 brass = mix(vec3(.35,.25,.1), vec3(1.,.8,.45), clamp(.4+sh,0.,1.)) + spec(N(t),vec3(-.6,-.6,.5),30.)*.6;
  return mix(stone, brass, uB); }`);

fx("Depth", "godrays", "God Rays", "length", "room", `
vec3 fx(vec2 t){ vec2 c = vec2(.5+.25*sin(uTime*.3), .18);
  vec2 dv = t - c; float acc = 0.; vec2 q = t; float w = 1.;
  for(int i=0;i<40;i++){ q -= dv*(.02*(1.+uA)); acc += (1.-MM(q))*w; w *= .955; }
  acc /= 18.7;
  float fall = exp(-length(dv*vec2(uAspect,1.))*2.2);
  vec3 rays = vec3(1.,.82,.55)*pow(acc, 6.)*fall*(1.+uBass);
  vec3 sun = vec3(1.,.9,.7)*exp(-length(dv*vec2(uAspect,1.))*9.)*(1.-MM(t));
  return C(t)*mix(.2,.7,uB) + rays*.9 + sun; }`);

fx("Depth", "tiltshift", "Tilt-Shift Miniature", "focus", "blur", `
vec3 fx(vec2 t){ float f = mix(.3,.7,uA); float b = smoothstep(.05,.35,abs(t.y-f));
  vec3 col = blurS(t, b*(.004+uB*.012));
  col = mix(vec3(lum(col)), col, 1.6); return col*1.08; }`);

fx("Depth", "vertigo", "Vertigo Dolly", "zoom", "speed", `
vec3 fx(vec2 t){ float z = 1. + .18*sin(uTime*(.5+uB*2.))*(.4+uA);
  vec2 tb = (t-uBody.xy)/z + uBody.xy;
  return mix(PL(tb)*.95, C(t), MM(t)); }`);

fx("Depth", "ripples", "Depth Ripples", "speed", "glow", `
vec3 fx(vec2 t){ float d = D(t); float ph = d*40. - uTime*(3.+uA*6.);
  vec2 q = t + N(t).xy*sin(ph)*(.006+uBass*.01);
  return C(q) + vec3(.2,.6,1.)*pow(.5+.5*sin(ph),20.)*(.15+uB*.8); }`);

fx("Depth", "pinart", "Pin Art", "pins", "shine", `
vec3 fx(vec2 t){ float sc = mix(80.,30.,uA);
  vec2 p = AS(t)*sc; vec2 id = floor(p)+.5, f = fract(p)-.5;
  vec2 tc = vec2(id.x/sc/uAspect, id.y/sc); float h = D(tc);
  float r = length(f); float head = smoothstep(.43,.37,r);
  vec3 nn = normalize(vec3(f*2., sqrt(max(0.,1.-dot(f*2.,f*2.)))));
  float hh = smoothstep(.15, .98, h);
  vec3 col = mix(vec3(.25,.27,.32), vec3(.95,.93,.88), hh)*(.15+.85*hh)*(.25+lambert(nn,vec3(-.5,-.6,.7)))*head + spec(nn,vec3(-.5,-.6,.7),30.)*hh*head*(.5+uB);
  return col + (1.-head)*vec3(.015); }`);

fx("Depth", "lidar", "LiDAR Sweep", "dots", "decay", `
vec3 fx(vec2 t){ float sc = mix(160.,60.,uA);
  vec2 p = AS(t)*sc; vec2 f = fract(p)-.5, id = floor(p);
  vec2 tc = vec2((id.x+.5)/sc/uAspect, (id.y+.5)/sc); float d = D(tc);
  float age = fract(fract(uTime*.25) - (1.-tc.y));
  float dm = smoothstep(.24,.1,length(f));
  float dm2 = smoothstep(.34,.12,length(f)); vec3 col = mix(vec3(1.,.25,.1), vec3(.1,.7,1.), d)*dm2*(1.2+5.*exp(-age*mix(10.,2.,uB)));
  return col*(.4+MM(tc)*.9) + C(t)*.03; }`);

fx("Depth", "hypso", "Hypsometric Map", "contours", "shading", `
vec3 fx(vec2 t){ float d = D(t);
  vec3 tint = d < .2 ? mix(vec3(.04,.12,.35), vec3(.2,.5,.8), d*5.) :
              d < .5 ? mix(vec3(.25,.55,.25), vec3(.85,.8,.45), (d-.2)/.3) :
              d < .8 ? mix(vec3(.85,.8,.45), vec3(.55,.35,.2), (d-.5)/.3) : mix(vec3(.55,.35,.2), vec3(1.), (d-.8)/.2);
  float hill = lambert(N(t), vec3(-.6,-.6,.5));
  float v = d*(10.+uA*40.); float l = abs(fract(v)-.5)/max(fwidth(v),1e-4); float line = 1.-min(l,1.);
  return tint*mix(1., .45+.75*hill, uB*.5+.5)*(1.-line*.5); }`);

fx("Depth", "echo", "Depth Echo", "spread", "colour", `
vec3 fx(vec2 t){ vec3 col = C(t)*.6; float m = MM(t);
  for(int i=5;i>=1;i--){ float fi = float(i);
    vec2 off = vec2(sin(uTime*.7+fi), cos(uTime*.5+fi*.7))*.025*fi*(.5+uA);
    vec2 q = t - off; float mq = MM(q);
    col = mix(col, mix(C(q), hsv(fi*.17+uTime*.1,.7,1.)*lum(C(q))*1.8, uB), mq*(1.-m)*(1.-fi*.12)); }
  return mix(col, C(t), m); }`);

fx("Depth", "coderain", "Code Rain", "columns", "photo", `
vec3 fx(vec2 t){ float nc = mix(110.,45.,uA);
  vec2 g = vec2(t.x*nc, t.y*nc*.55/uAspect); vec2 id = floor(g), f = fract(g);
  float sp = .4 + hash(vec2(id.x,3.))*.9; float head = fract(uTime*sp*.25 + hash(vec2(id.x,7.)));
  float dy = fract(head - t.y); float trail = exp(-dy*7.);
  float glyph = step(.45, hash(id + floor(uTime*8.*hash(id))))*step(abs(f.x-.5),.32)*step(abs(f.y-.5),.38);
  float m = MM(t); float dens = mix(.2, 1., m);
  vec3 col = vec3(.2,1.,.4)*glyph*trail*dens*1.8 + vec3(.8,1.,.85)*glyph*smoothstep(.02,0.,dy)*2.;
  return col + C(t)*vec3(.1,.5,.2)*(m*.3+uB*.5); }`);

fx("Depth", "sonar", "Sonar Ping", "rate", "depth bend", `
vec3 fx(vec2 t){ vec2 c = HON(0) ? H(0,8) : uBody.xy;
  float r = fract(uTime*(.3+uA*.8))*1.4; float dd = aDist(t,c) + (1.-D(t))*.3*uB;
  float ring = exp(-pow((dd-r)*40.,2.));
  return C(t)*vec3(.05,.2,.15) + vec3(.2,1.,.6)*ring*(.25+MM(t)*1.6) + vec3(.1,.6,.4)*edgeN(t,1.)*ring*3.; }`);

fx("Depth", "dhalftone", "Depth Halftone", "dots", "depth/light", `
vec3 fx(vec2 t){ vec2 p = rot(.4)*AS(t)*mix(110.,45.,uA); vec2 f = fract(p)-.5;
  float v = mix(LN(t), D(t), uB); float r = sqrt(clamp(1.-v,0.,1.))*.55;
  float dt = smoothstep(r+.05, r-.05, length(f));
  return toLin(mix(vec3(.96,.92,.84), mix(vec3(.08,.07,.18), vec3(.75,.05,.3), uB), dt)); }`);

fx("Depth", "shatter", "Shatter", "force", "shards", `
vec3 fx(vec2 t){ float sc = mix(5.,14.,uB);
  float amt = (.5+.5*sin(uTime*.8))*(.4+uA) + uBeat*.5;
  vec4 v = voroC(AS(t)*sc); vec2 tc = vec2(v.x/sc/uAspect, v.y/sc);
  vec2 dir = normalize(tc - uBody.xy + 1e-4); float h = hash(v.xy);
  vec2 q = t - dir*amt*.06*(.5+h);
  float mq = MM(q); vec3 shard = C(q)*(1.+.35*(h-.5));
  float edge = smoothstep(.0, .05, v.z);
  return mix(PL(t)*.5, shard*edge + vec3(.6,.8,1.)*(1.-edge)*mq*.5, mq); }`);

fx("Depth", "paperlayers", "Paper Layers", "layers", "colour", `
vec3 fx(vec2 t){ float L = floor(mix(4.,12.,uA));
  float d = floor(D(t)*L)/L;
  float e = 2./uAuxSize.y; float above = floor(D(t+vec2(-e,-e)*2.)*L)/L;
  float shadow = step(d+.001, above)*.45;
  vec3 col = toLin(mix(hsv(.62+uB*.6,.75,.35), hsv(.08+uB*.6,.65,1.), d));
  col *= (1.-shadow)*(.9+.1*fbm(AS(t)*60.));
  return col; }`);

fx("Depth", "bokeh", "Bokeh Night", "size", "colour", `
vec3 fx(vec2 t){ float m = MM(t); vec3 bg = vec3(0.);
  for(int i=0;i<24;i++){ float fi = float(i);
    vec2 c = vec2(hash(vec2(fi,1.)), hash(vec2(fi,2.))) + vec2(sin(uTime*.1+fi), cos(uTime*.13+fi))*.03;
    float r = (.03+.05*hash(vec2(fi,3.)))*(1.+uA);
    float d = aDist(t, c);
    float disk = smoothstep(r, r*.85, d)*(.6+.4*smoothstep(r*.7,r,d));
    bg += hsv(hash(vec2(fi,4.))*.3+uB, .6, 1.)*disk*.35*(.7+.3*sin(uTime+fi)); }
  vec3 person = C(t)*1.1;
  return mix(bg + blurS(t,.012)*.25, person, m); }`);

fx("Depth", "groundfog", "Ground Fog", "height", "beams", `
vec3 fx(vec2 t){ float d = D(t); float m = MM(t);
  float h = mix(.55,.85,uA);
  float fogN = fbm(vec2(t.x*uAspect*3.+uTime*.15, t.y*6.)) ;
  float fog = smoothstep(h-.25, 1., t.y + fogN*.25)*(1.-d*.6);
  vec2 lc = vec2(.5, -.1); vec2 dv = t-lc; float ang = atan(dv.x, dv.y);
  float beams = pow(abs(sin(ang*7.+uTime*.2)), 6.)*uB*(1.-m*.6);
  vec3 col = C(t)*mix(.35,.8,m) + vec3(.75,.8,.9)*fog*.9 + vec3(.9,.85,.7)*beams*.25*(1.-t.y);
  return col; }`);

fx("Depth", "rainwindow", "Rain on Glass", "drops", "blur", `
vec3 fx(vec2 t){ vec2 p = AS(t)*vec2(1.,.6)*(10.+uA*10.); vec2 id = floor(p); vec2 f = fract(p)-.5;
  float h = hash(id); float y = fract(uTime*(.05+h*.15) + h);
  vec2 dp = vec2(f.x + (h-.5)*.4, f.y*1. + (y-.5)*1.8); float drop = smoothstep(.12,.08,length(dp*vec2(1.,1.4)));
  float trail = smoothstep(.04,.0,abs(f.x+(h-.5)*.4))*smoothstep(.0,.5,f.y-(y-.5)*1.8+.0)*step(.5,h)*.5;
  vec2 off = dp*drop*.08;
  vec3 bg = blurS(t, .004+uB*.012);
  vec3 sharp = C(t + off*2.);
  return mix(bg*vec3(.85,.9,1.), sharp*1.15, max(drop,trail)) + vec3(1.)*drop*smoothstep(.0,-.08,dp.y+.05)*.15; }`);

fx("Depth", "snow", "Snowfall", "amount", "wind", `
vec3 fx(vec2 t){ vec3 col = C(t)*vec3(.85,.9,1.); float d = D(t);
  for(int l=0;l<3;l++){ float fl = float(l); float z = .2+fl*.35;
    vec2 p = AS(t)*(18.-fl*5.) + vec2(uTime*(.3+uB)*(1.+fl*.3), -uTime*(1.+fl*.6));
    vec2 id = floor(p); vec2 f = fract(p)-.5; float h = hash(id+fl*13.);
    vec2 o = (hash2(id+fl)-.5)*.6 + vec2(sin(uTime+h*20.)*.15, 0.);
    float flake = smoothstep(.09-fl*.02, .0, length(f-o))*step(1.-(.1+uA*.5), h);
    float vis = step(d, z+.25);                                  // hidden behind the person
    col += vec3(1.)*flake*mix(1., vis, MM(t))*(1.-fl*.15); }
  return col; }`);

fx("Depth", "fireflies", "Fireflies", "count", "colour", `
vec3 fx(vec2 t){ vec3 col = C(t)*.35; float d = D(t);
  for(int i=0;i<36;i++){ float fi = float(i); if(fi > 8.+uA*28.) break;
    vec2 c = vec2(hash(vec2(fi,1.)), hash(vec2(fi,2.)))*vec2(1.,.9) + vec2(sin(uTime*.4+fi*2.), cos(uTime*.31+fi))*.06;
    float z = hash(vec2(fi,5.));
    float bl = .5+.5*sin(uTime*(1.+z*2.)+fi*3.);
    float g = exp(-aDist(t,c)*90.)*bl + exp(-aDist(t,c)*18.)*bl*.15;
    float vis = 1.-smoothstep(.02,.08,d - z);
    col += hsv(.17+uB*.5, .7, 1.)*g*vis*1.6;
    col += C(t)*hsv(.17+uB*.5,.6,1.)*exp(-aDist(t,c)*10.)*bl*.35*vis; }
  return col; }`);

fx("Depth", "heathaze", "Heat Haze", "strength", "warmth", `
vec3 fx(vec2 t){ float m = mBlur(t+vec2(0.,.05), .05);
  float rise = smoothstep(.0,.5,m)*(1.-MM(t)*.5);
  vec2 w = vec2(fbm(AS(t)*12.+vec2(0.,uTime*2.))-.5, fbm(AS(t)*12.+vec2(5.,uTime*2.))-.5)*.02*(.3+uA*1.5)*rise;
  return C(t+w)*mix(vec3(1.), vec3(1.1,.95,.8), uB); }`);

fx("Depth", "bullettime", "Bullet Time", "streak", "tint", `
vec3 fx(vec2 t){ vec2 c = uBody.xy; vec3 acc = vec3(0.); float m = MM(t);
  for(int i=0;i<16;i++){ float f = float(i)/16.; vec2 q = mix(t, c, f*.25*(.3+uA)*(1.-m)); acc += C(q); }
  acc /= 16.;
  vec3 col = mix(acc, C(t), m);
  return mix(col, col*vec3(.75,1.1,.8), uB); }`);

fx("Depth", "prismsplit", "Prism Split", "spread", "rainbow", `
vec3 fx(vec2 t){ vec2 o = N(t).xy*(.008+uA*.03)*(.3+MM(t));
  vec3 c = vec3(C(t+o).r, C(t).g, C(t-o).b);
  return mix(c, c + rainbow(D(t)*3.+uTime*.2)*length(o)*20.*uB, .5); }`);

// ---------------------------------------------------------------- MATTE
fx("Matte", "rings", "Neon Contour Rings", "rings", "keep you", `
vec3 fx(vec2 t){ float mb = mBlur(t,.02)*.5 + mBlur(t,.05)*.3 + mBlur(t,.1)*.2;
  float v = mb*(8.+uA*16.) - uTime*2.; float l = abs(fract(v)-.5)/max(fwidth(v),1e-4);
  float line = (1.-min(l/1.5,1.))*(1.-MM(t))*step(.02, mb);
  return C(t)*.08 + rainbow(floor(v)*.1)*line*2. + C(t)*MM(t)*(.3+uB*.7); }`);

fx("Matte", "clones", "Clone Army", "spacing", "tint", `
vec3 fx(vec2 t){ vec3 col = PL(t); float k = .18+uA*.25;
  for(int i=2;i>=1;i--){ for(int s=-1;s<=1;s+=2){
    vec2 q = t + vec2(float(i*s)*k, 0.);
    float mq = MM(q)*step(0.,q.x)*step(q.x,1.);
    col = mix(col, C(q)*mix(vec3(1.), hsv(float(i*s)*.2+.5,.5,1.), uB)*(1.-float(i)*.12), mq*.97); } }
  return mix(col, C(t), MM(t)); }`);

fx("Matte", "kaleido", "Kaleidoscope", "mirrors", "spin", `
vec3 fx(vec2 t){ vec2 p = (t-uBody.xy)*vec2(uAspect,1.);
  float a = atan(p.y,p.x), r = length(p); float seg = TAU/floor(mix(3.,12.,uA)+.5);
  a = mod(a + uTime*.15*uB, seg); a = abs(a - seg*.5);
  vec2 q = vec2(cos(a), sin(a))*r; return SRC(q/vec2(uAspect,1.) + uBody.xy)*1.08; }`);

fx("Matte", "doubleexp", "Double Exposure", "landscape", "contrast", `
vec3 fx(vec2 t){ vec2 p = AS(t);
  float hz = .55 + .08*sin(p.x*3.+uA*6.) + .04*sin(p.x*9.);
  vec3 sky = mix(vec3(.95,.6,.35), vec3(.22,.28,.55), clamp(t.y*1.4,0.,1.));
  float tr = hz - .14*pow(abs(sin(p.x*25.)), 8.)*(.6+hash(vec2(floor(p.x*25./PI),0.)));
  vec3 land = mix(sky, vec3(.04,.06,.09), step(tr, t.y));
  float l = pow(LN(t), mix(1.,.6,uB)); float m = MM(t);
  vec3 dex = mix(land, vec3(.96,.94,.92), smoothstep(.15, .85, l));
  return toLin(mix(vec3(.96,.94,.92), dex, m)); }`);

fx("Matte", "warhol", "Warhol 4-Up", "palette", "posterize", `
vec3 fx(vec2 t){ vec2 q = fract(t*2.); vec2 id = floor(t*2.); float k = id.x + id.y*2. + floor(uA*4.);
  float l = lum(C(q)); float m = MM(q);
  vec3 c1 = hsv(k*.25+.05,.9,1.), c2 = hsv(k*.25+.55,.9,.85);
  float lv = floor(l*mix(3.,6.,uB)*1.8)/mix(3.,6.,uB);
  vec3 col = mix(c2, c1*(.4+lv*.9), m);
  return toLin(mix(col, vec3(.05), (1.-step(.06,l))*m)); }`);

fx("Matte", "puppet", "Shadow Puppet", "offset", "lamp", `
vec3 fx(vec2 t){ vec3 paper = vec3(1.,.8,.5)*(.8+.2*fbm(AS(t)*6.))*(1.-length((t-vec2(.5,.45))*vec2(uAspect,1.))*mix(.6,1.,uB));
  float m = mBlur(t + vec2(.012,.006)*uA*2., .004);
  return toLin(mix(paper, vec3(.03,.01,0.), smoothstep(.4,.6,m))); }`);

fx("Matte", "comic", "Comic Book", "colour", "dots", `
vec3 fx(vec2 t){ vec3 c = C(t); vec3 q = floor(toSrgb(c)*4.+.5)/4.; vec3 col = toLin(q)*1.2;
  float ink = max(edgeN(t,1.5), edgeL(t,1.2)*.8);
  vec2 g = rot(.6)*AS(t)*(60.+uB*80.); float dots = smoothstep(.32,.26,length(fract(g)-.5));
  vec3 bg = toLin(mix(vec3(1.,.85,.2), vec3(1.,.3,.25), dots*.6));
  col = mix(mix(bg, col, uA), col, MM(t));
  return col*(1.-clamp(ink*1.2,0.,1.)); }`);

fx("Matte", "melt", "Liquid Melt", "drip", "viscosity", `
vec3 fx(vec2 t){ vec3 prev = PV(t - vec2(sin(t.x*60.+uTime)*.0006, .003*(1.+uA*3.)));
  float m = MM(t);
  vec3 st = max(prev*mix(.97,.995,uB), C(t)*m*1.05);
  keep(st);
  return max(st, PL(t)*.55*(1.-m)) ; }`);

fx("Matte", "snap", "Disintegrate", "cycle", "drift", `
vec3 fx(vec2 t){ float th = fract(uTime*(.06+uA*.15))*1.3;
  float m = MM(t); float n0 = fbm(AS(t)*8.) + (1.-t.x)*.25;
  float alive = step(th, n0);
  vec2 jit = (vec2(noise(t*30.+uTime), noise(t*30.-uTime))-.5)*.004;
  vec3 dust = PV(t - vec2(.003,-.0015)*(1.+uB*2.) + jit)*.94;
  vec3 emit = C(t)*m*(1.-alive)*vec3(1.2,.8,.5)*(step(.6, hash(t*400.+uTime)));
  vec3 st = max(dust, emit); keep(st);
  return mix(PL(t)*.6, C(t), m*alive) + st; }`);

fx("Matte", "teleport", "Teleporter", "speed", "beam", `
vec3 fx(vec2 t){ float ph = fract(uTime*(.12+uA*.3)); float y = mix(1.1,-.1,ph); float m = MM(t);
  float vis = step(y, t.y); float band = exp(-pow((t.y-y)*60.,2.));
  float col1 = abs(t.x - uBody.x)*uAspect;
  vec3 beam = vec3(.3,.7,1.)*smoothstep(.25,.0,col1)*.25*uB*(.6+.4*sin(t.y*80.-uTime*20.));
  vec3 spark = vec3(.4,.8,1.)*step(.97, hash(floor(AS(t)*120.)+floor(uTime*20.)))*smoothstep(.15,.0,abs(t.y-y))*m;
  vec3 ghost = vec3(.3,.7,1.)*m*.15*(.5+.5*sin(t.y*300.+uTime*20.));
  return mix(PL(t)*.6, C(t)*vis + ghost*(1.-vis), m) + vec3(.4,.8,1.)*band*(m*2.+.2) + spark*3. + beam; }`);

fx("Matte", "bodyglitch", "Body Glitch", "rate", "split", `
vec3 fx(vec2 t){ float m = MM(t);
  float bl = floor(t.y*40.) + floor(uTime*12.); float g = step(.9-uBeat*.3-uA*.4, hash(vec2(bl,3.)));
  vec2 q = t + vec2((hash(vec2(bl,1.))-.5)*.08*g, 0.)*m;
  float s = .005*(1.+uB*4.)*(g+.25);
  vec3 c = vec3(C(q+vec2(s,0.)).r, C(q).g, C(q-vec2(s,0.)).b);
  c = mix(c, vec3(step(.5, hash(floor(AS(t)*vec2(60.,30.))+uTime))), g*step(.93,hash(vec2(bl,9.)))*m);
  return mix(C(t), c, max(m, g*.25)); }`);

fx("Matte", "nightvision", "Night Vision", "gain", "IR glow", `
vec3 fx(vec2 t){ float l = lum(C(t))*(3.+uA*5.); float nz = hash(AS(t)*500.+fract(uTime*30.))*.25;
  vec3 g = vec3(.15,1.,.3)*(l+nz)*(.85+.15*sin(t.y*900.));
  float vig = smoothstep(.85,.3,length((t-.5)*vec2(uAspect,1.)));
  g += vec3(.6,1.,.6)*pow(1.-max(N(t).z,0.),4.)*MM(t)*uB*1.5;
  return g*vig; }`);

fx("Matte", "sticker", "Sticker", "border", "pattern", `
vec3 fx(vec2 t){ float m = MM(t); float mo = smoothstep(.15,.4, mBlur(t, .01+uA*.02)*1.6);
  float sh = smoothstep(.1,.5, mBlur(t-vec2(.012,.018), .02)*1.5);
  vec2 p = AS(t)*12.; float pat = step(.5, fract((p.x+p.y)*.5 + uTime*.1));
  vec3 bg = mix(hsv(.93+uB*.5,.45,1.), hsv(.93+uB*.5,.25,1.), pat)*(1.-sh*.35);
  return mix(mix(toLin(bg), vec3(1.), mo), C(t)*1.15, m); }`);

fx("Matte", "halo", "Saint Halo", "size", "rays", `
vec3 fx(vec2 t){ vec2 c = uBody.zw + vec2(0., -.03);
  vec2 p = (t-c)*vec2(uAspect,1.); p.y *= 2.6; float r = length(p); float R = .08*(1.+uA);
  float ring = exp(-pow((r-R)*60.,2.)); float glow = exp(-r*10.)*.6;
  float rays = pow(max(0., sin(atan(p.y,p.x)*16.+uTime)), 8.)*exp(-r*5.)*uB*1.5;
  vec3 gold = vec3(1.,.8,.35);
  float occ = MM(t)*step(c.y, t.y);
  return C(t)*(1.+glow*.4) + gold*(ring*2.5+glow+rays)*(1.-occ); }`);

fx("Matte", "wings", "Energy Wings", "span", "flap", `
vec3 fx(vec2 t){ vec2 c = uBody.xy + vec2(0., -.06); vec2 p = (t-c)*vec2(uAspect,1.);
  vec2 q = vec2(abs(p.x), p.y); float acc = 0.;
  for(int i=0;i<8;i++){ float fi = float(i);
    float ang = -1.05 + fi*.24 + sin(uTime*(1.+uB*3.))*.1*(1.+uBass*3.);
    vec2 dir = vec2(cos(ang), sin(ang)); float len = (.3+.06*fi)*(.8+uA*.8);
    float d = sdSeg(q, vec2(.04,0.), vec2(.04,0.)+dir*len); acc += exp(-d*80.)*(1.-fi*.07); }
  vec3 wing = mix(vec3(.3,.8,1.), vec3(1.,.4,.9), .5+.5*sin(uTime+q.y*4.))*acc*1.5;
  return C(t) + wing*(1.-MM(t)); }`);

fx("Matte", "rainbowecho", "Rainbow Echo", "length", "drift", `
vec3 fx(vec2 t){ vec3 prev = PV(t + vec2(0., -.002*uB));
  vec3 cur = hsv(fract(uTime*.2), .8, 1.)*MM(t)*1.2;
  vec3 tr = max(prev*mix(.9,.985,uA), cur); keep(tr);
  return mix(tr*.9 + C(t)*.12, C(t), MM(t)*.85); }`);

fx("Matte", "slitscan", "Slit Scan", "slit", "line", `
vec3 fx(vec2 t){ float y0 = mix(.5,.95,uA);
  vec3 hist = PV(t + vec2(0., .004)); if(lum(hist) < .0005) hist = C(t);
  vec3 col = t.y > y0 ? C(t) : hist;
  keep(col);
  return col + vec3(1.,.2,.3)*smoothstep(.004,0.,abs(t.y-y0))*uB*2.; }`);

fx("Matte", "timewarp", "Time Warp Scan", "speed", "vertical", `
vec3 fx(vec2 t){ float p = fract(uTime*.06*(1.+uA*2.))*1.1;
  bool vert = uB > .5; float pos = vert ? t.x : t.y;
  vec3 hist = PV(t); if(lum(hist) < .0005) hist = C(t);
  vec3 col = pos < p ? hist : C(t);
  keep(col);
  return col + vec3(.2,.6,1.)*smoothstep(.004,0.,abs(pos-p))*2.; }`);

fx("Matte", "cubism", "Cubism", "cuts", "jitter", `
vec3 fx(vec2 t){ vec2 p = t*vec2(6.,4.)*(1.+uA*2.);
  float sh = hash(vec2(floor(p.y),1.))*.5; vec2 id = floor(p+vec2(sh,0.)); vec2 f = fract(p+vec2(sh,0.));
  vec2 off = (hash2(id+floor(uTime*(.3+uB)))-.5)*.06; float sc = 1. + (hash(id)-.5)*.2;
  vec2 q = (t-.5)*sc + .5 + off; vec3 c = C(q);
  float edge = smoothstep(0.,.02,min(min(f.x,f.y),min(1.-f.x,1.-f.y)));
  c = mix(vec3(lum(c))*vec3(.9,.8,.6), c, .6+hash(id)*.4);
  return c*(.6+.4*edge); }`);

fx("Matte", "pixelsort", "Pixel Drip", "length", "threshold", `
vec3 fx(vec2 t){ vec3 c = C(t);
  vec3 prev = PV(t - vec2(0., .005*(1.+uA*2.)));
  vec3 st = max(c, prev*.975*step(.3-uB*.25, lum(prev)));
  keep(st); return st; }`);

fx("Matte", "mirrorfloor", "Mirror Floor", "floor", "ripple", `
vec3 fx(vec2 t){ float fy = mix(.7,.95,uA); vec3 col = C(t);
  if(t.y > fy){
    vec2 q = vec2(t.x + sin(t.y*120.+uTime*3.)*.003*(t.y-fy)*20.*uB, 2.*fy - t.y);
    float fade = clamp(.6-(t.y-fy)*2., 0., 1.);
    col = vec3(.015,.015,.02) + C(q)*MM(q)*fade + PL(q)*(1.-MM(q))*fade*.25;
  }
  return col; }`);

fx("Matte", "portal", "Portal Body", "world", "fire rim", `
vec3 fx(vec2 t){ vec2 p = AS(t) - uTime*vec2(.02,.01);
  vec3 w1 = vec3(.4,.1,.6)*pow(fbm(p*3.),3.)*1.6 + vec3(.1,.4,.9)*pow(fbm(p*2.+5.),4.)*1.8 + vec3(1.)*step(.993,hash(floor(p*240.)))*.8;
  vec3 w2 = mix(vec3(1.,.5,.2), vec3(.3,.05,.2), t.y)*(.5+fbm(p*2.)) ;
  vec3 world = mix(w1, w2, uA);
  float m = MM(t); float rim = smoothstep(.95,.4,mBlur(t,.015))*m;
  return mix(C(t), world, m) + vec3(1.,.5,.1)*rim*3.*(.4+uB); }`);

fx("Matte", "lightningedge", "Electric Outline", "crackle", "colour", `
vec3 fx(vec2 t){ float mb = mBlur(t, .008); float edge = 1.-abs(mb-.5)*2.;
  float n = fbm(AS(t)*30. + vec2(uTime*8., 0.)); float n2 = fbm(AS(t)*60. - uTime*5.);
  float arc = smoothstep(.75, 1., edge + (n-.5)*1.2*(.5+uA))*step(.08, mb);
  vec3 col = hsv(.6+uB*.4, .6, 1.)*arc*3. + vec3(1.)*pow(arc,3.)*step(.5,n2)*2.;
  return C(t)*.5 + col + C(t)*hsv(.6+uB*.4,.5,1.)*arc*.5; }`);

fx("Matte", "hellbg", "Inferno Backdrop", "flames", "glow", `
vec3 fx(vec2 t){ float m = MM(t);
  vec2 p = AS(t)*vec2(3.,2.) + vec2(0., uTime*1.2);
  float f = fbm(p + fbm(p*2.)*1.2);
  float fire = smoothstep(.2, 1., f*(.6+t.y*(.8+uA)));
  vec3 bg = mix(vec3(.05,0.,0.), mix(vec3(1.,.2,0.), vec3(1.,.85,.35), fire), fire)*1.6;
  vec3 person = C(t)*vec3(1.1,.75,.55) + vec3(1.,.35,.05)*pow(1.-max(N(t).z,0.),2.)*(.5+uB);
  return mix(bg, person, m); }`);

fx("Matte", "aurora", "Aurora Sky", "curtains", "light you", `
vec3 fx(vec2 t){ float m = MM(t); vec2 p = AS(t);
  float c = 0.;
  for(int i=0;i<3;i++){ float fi = float(i);
    float y = .2 + fi*.08 + .08*sin(p.x*(2.+fi) + uTime*(.3+fi*.1)) + .05*fbm(vec2(p.x*3., uTime*.2+fi));
    c += exp(-pow((t.y-y)*(8.+uA*10.),2.))*(.6+.4*fbm(vec2(p.x*20., uTime+fi))); }
  vec3 sky = vec3(.005,.01,.04) + mix(vec3(.1,1.,.5), vec3(.6,.2,1.), fbm(p+uTime*.05))*c*1.2;
  float st = step(.995, hash(floor(p*200.)))*.8; sky += st*(1.-c);
  vec3 lit = C(t)*(.25 + vec3(.2,1.,.6)*(.5-.5*N(t).y)*uB*1.5);
  return mix(sky, lit, m); }`);

fx("Matte", "searchlight", "Searchlight", "beam", "sweep", `
vec3 fx(vec2 t){ float m = MM(t);
  vec2 c = vec2(.5 + .45*sin(uTime*(.3+uB*.8)), .5 + .25*sin(uTime*.37*(1.+uB)));
  float r = aDist(t, c); float R = .12*(1.+uA*1.5);
  float spot = smoothstep(R, R*.75, r);
  vec3 dark = C(t)*vec3(.04,.05,.09);
  vec3 lit = C(t)*1.6 + vec3(1.,.97,.9)*.02;
  return mix(dark, lit, spot) + vec3(.9,.95,1.)*exp(-pow((r-R)*80.,2.))*.15; }`);

fx("Matte", "longexpo", "Long Exposure", "length", "brighten", `
vec3 fx(vec2 t){ vec3 prev = PV(t); vec3 c = C(t);
  vec3 st = mix(prev, c, mix(.15,.015,uA)); keep(st);
  return max(st, c*MM(t)*uB) + max(c - st, 0.)*.6; }`);

fx("Matte", "motionglow", "Motion Glow", "trail", "colour", `
vec3 fx(vec2 t){ vec3 c = C(t); vec3 prevC = PV(t);
  keep(mix(prevC, c, .5));
  float mo = smoothstep(.02, .15, length(c - prevC));
  return c*.35 + hsv(fract(uTime*.1)+uB, .8, 1.)*mo*(1.+uA*3.); }`);

fx("Matte", "feedback", "Feedback Tunnel", "zoom", "twist", `
vec3 fx(vec2 t){ vec2 c = uBody.xy; vec2 q = (t-c);
  q = rot(.01+uB*.05)*q*(1.-.015*(1.+uA*2.)) + c;
  vec3 prev = PV(q)*.96;
  vec3 st = mix(prev*vec3(1.,.97,1.03), C(t), MM(t)); keep(st);
  return st; }`);

fx("Matte", "droste", "Infinite Frame", "scale", "rotate", `
vec3 fx(vec2 t){ vec2 c = uBody.xy; float s = mix(.55,.8,uA);
  vec2 q = t; float m = MM(q); vec3 col = vec3(0.); float w = 1.;
  for(int i=0;i<5;i++){ vec3 here = C(q); float mh = MM(q);
    col += here*mh*w; w *= (1.-mh);
    q = (q - c)/s; q = rot(uB*.3)*q; q = q + c;
    if(w < .01) break; }
  return col + PL(t)*w*.4; }`);
