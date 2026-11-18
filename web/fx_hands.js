// HANDS: effects driven by the 42 live hand landmarks.   AUDIO: music-reactive.   STYLIZE: looks.
"use strict";
const BONES = `const int BA[21] = int[](0,1,2,3,0,5,6,7,5,9,10,11,9,13,14,15,13,17,18,19,0);
const int BB[21] = int[](1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,17);`;

fx("Hands", "forcefield", "Force Field", "size", "tint", `
vec3 fx(vec2 t){ vec3 col = C(t);
  for(int h=0;h<2;h++){ if(!HON(h)) continue;
    vec2 c = (H(h,0)+H(h,9))*.5; float R = aDist(H(h,9),H(h,0))*1.7*(1.+uA);
    vec2 p = (t-c)*vec2(uAspect,1.); float r = length(p)/R;
    vec3 tint = hsv(.55+uB*.45,.6,1.);
    if(r < 1.){ float z = sqrt(1.-r*r); vec2 q = t - p/vec2(uAspect,1.)*(1.-z)*.6;
      col = C(q)*mix(vec3(1.),tint,.35) + tint*pow(1.-z,4.)*1.5 + spec(vec3(p/R,z), vec3(-.4,-.6,1.), 60.)*2.; }
    col += tint*exp(-pow((r-1.)*30.,2.))*.8; }
  return col; }`);

fx("Hands", "blackhole", "Black Hole", "mass", "spin", `
vec3 fx(vec2 t){ vec2 c = HON(1) ? (H(0,9)+H(1,9))*.5 : (HON(0) ? H(0,9) : uBody.xy);
  float R = .05*(1.+uA*2.) + uBass*.03; vec2 p = (t-c)*vec2(uAspect,1.); float r = length(p);
  float bend = R*R/(r+1e-4)*.9;
  vec2 dir = normalize(p+1e-5); dir = rot(bend*8.*uB)*dir;
  vec2 q = t - dir/vec2(uAspect,1.)*bend;
  vec3 col = C(q)*smoothstep(R*.9, R*1.05, r);
  float disk = exp(-pow((r-R*1.6)*35.,2.))*(.6+.4*sin(atan(p.y,p.x)*6.-uTime*6.));
  return col + vec3(1.,.6,.25)*disk*2.5 + vec3(1.,.7,.4)*exp(-pow((r-R)*120.,2.))*1.5; }`);

fx("Hands", "lasers", "Finger Lasers", "width", "light", `
vec3 fx(vec2 t){ vec3 col = C(t)*.45;
  for(int h=0;h<2;h++){ if(!HON(h)) continue;
    vec2 a = H(h,8); vec2 dir = normalize((H(h,8)-H(h,6))*vec2(uAspect,1.)+1e-5);
    vec2 p = (t-a)*vec2(uAspect,1.); float al = dot(p,dir); float d = abs(dot(p, vec2(-dir.y,dir.x)));
    vec3 lc = h==0 ? vec3(1.,.12,.2) : vec3(.2,.6,1.);
    if(al > 0.){ float w = .003*(1.+uA*3.)*(1.+uBeat);
      float core = exp(-d*d/(w*w)), halo = exp(-d/(w*6.))*.5;
      col += (lc*halo + vec3(1.)*core*1.5 + lc*core)*(1.-exp(-al*30.))*2.;
      col += C(t)*lc*exp(-d*20.)*2.*uB*lambert(N(t), vec3(-dir,.4)); }
    col += lc*exp(-length(p)*60.)*2.; }
  return col; }`);

fx("Hands", "ribbons", "Fingertip Ribbons", "length", "width", `
vec3 fx(vec2 t){ vec3 tr = PV(t)*mix(.92,.99,uA);
  float w = .004 + uB*.01;
  for(int h=0;h<2;h++){ if(!HON(h)) continue;
    for(int k=0;k<5;k++){ float d = aDist(t, H(h,4+k*4));
      tr = max(tr, hsv(float(k)*.2+uTime*.1+float(h)*.5,.8,1.)*exp(-d*d/(w*w))*2.); } }
  keep(tr); return tr + C(t)*.35; }`);

fx("Hands", "firehands", "Fire Hands", "flame", "glow", `
vec3 fx(vec2 t){ vec3 col = C(t)*.5;
  for(int h=0;h<2;h++){ if(!HON(h)) continue;
    for(int k=0;k<5;k++){ vec2 p = (t-H(h,4+k*4))*vec2(uAspect,1.);
      float f = fbm(vec2(p.x*25., p.y*18.+uTime*3.) + float(k)*3.);
      float shape = 1. - length(p*vec2(1.5,.7) + vec2(0., .025))*(14.-uA*6.);
      float flame = smoothstep(0., .9, shape + f*.7 - .3)*step(p.y, .01);
      col += mix(vec3(1.,.12,0.), vec3(1.,.85,.3), flame)*flame*2.5; }
    col += C(t)*vec3(1.,.5,.2)*exp(-aDist(t,H(h,9))*6.)*(1.+uB*2.); }
  return col; }`);

fx("Hands", "frost", "Frost Touch", "melt", "spread", `
vec3 fx(vec2 t){ float fr = PV(t).r;
  float grow = 0.;
  for(int i=0;i<4;i++){ vec2 o = vec2(cos(float(i)*1.5708), sin(float(i)*1.5708))*uTexel*3.; grow = max(grow, PV(t+o).r); }
  fr = max(fr, grow*step(.6-uB*.3, fbm(AS(t)*30.)+.1)*.985);
  for(int h=0;h<2;h++){ if(!HON(h)) continue;
    for(int k=0;k<5;k++) fr = max(fr, smoothstep(.05,.0,aDist(t,H(h,4+k*4)))); }
  fr *= mix(.9995, .99, uA);
  keep(vec3(fr,0.,0.));
  vec3 c = C(t);
  vec3 ice = mix(c, vec3(.7,.9,1.)*(.6+lum(c)), .7) + vec3(.9,.97,1.)*smoothstep(.05,.0,voro(AS(t)*40.).y)*.5;
  return mix(c, ice, smoothstep(.1,.6,fr)); }`);

fx("Hands", "graffiti", "Light Graffiti", "fade", "brush", `
vec3 fx(vec2 t){ vec3 st = PV(t)*mix(.99,.9998,1.-uA);
  float w = .004 + uB*.012;
  for(int h=0;h<2;h++){ if(!HON(h)) continue;
    float d = aDist(t, H(h,8));
    st = max(st, hsv(uTime*.15+float(h)*.4,.9,1.)*exp(-d*d/(w*w))*2.); }
  keep(st); return C(t)*.25 + st + st*st*.4; }`);

fx("Hands", "strings", "Puppet Strings", "sway", "bar", `
vec3 fx(vec2 t){ vec3 col = C(t)*.6; vec2 pt = AS(t);
  for(int h=0;h<2;h++){ if(!HON(h)) continue;
    vec2 bar = vec2(H(h,9).x, -.02);
    for(int k=0;k<5;k++){ vec2 a = H(h,4+k*4);
      vec2 b = vec2(bar.x + (float(k)-2.)*.03 + sin(uTime+float(k))*.01*(1.+uA*3.), bar.y);
      float d = sdSeg(pt, AS(a), AS(b)); col += vec3(.9,.85,.7)*exp(-d*d/(.0011*.0011))*.9; }
    float db = sdSeg(pt, AS(vec2(bar.x-.08, .03)), AS(vec2(bar.x+.08,.03)));
    col = mix(col, vec3(.35,.2,.1), smoothstep(.012,.008,db)*uB); }
  return col; }`);

fx("Hands", "magnifier", "Pinch Magnifier", "lens", "zoom", `
vec3 fx(vec2 t){ vec3 col = C(t);
  for(int h=0;h<2;h++){ if(!HON(h)) continue;
    vec2 c = (H(h,4)+H(h,8))*.5; float R = .1*(1.+uA*1.5); float r = aDist(t,c);
    if(r < R){ float z = mix(3.+uB*3., 1.3, clamp(aDist(H(h,4),H(h,8))*5.,0.,1.));
      col = C(c + (t-c)/z)*1.05*(1.-.3*smoothstep(R*.8,R,r)); }
    col += vec3(1.)*exp(-pow((r-R)*200.,2.))*.6; }
  return col; }`);

fx("Hands", "kamehameha", "Energy Ball", "size", "colour", `
vec3 fx(vec2 t){ vec3 col = C(t)*.6; vec3 ec = hsv(.58+uB*.5,.7,1.);
  if(HON(0) && HON(1)){
    vec2 c = (H(0,9)+H(1,9))*.5; float sep = aDist(H(0,9),H(1,9)); float R = sep*.25*(1.+uA) + .02;
    vec2 p = (t-c)*vec2(uAspect,1.); float r = length(p); float n = fbm(p*20.+uTime*3.);
    float core = exp(-r*r/(R*R*.4)); float shell = exp(-pow((r-R)*25.,2.))*(.5+n);
    float spikes = pow(max(0., sin(atan(p.y,p.x)*9.+uTime*8.+n*4.)), 12.)*exp(-r/R*1.5);
    col += ec*(shell*1.5+spikes*1.2) + vec3(.9,.95,1.)*core*3.;
    col += C(t)*ec*exp(-r*4.)*3.*lambert(N(t), vec3(-p,.3));
  } else if(HON(0)){ col += ec*exp(-aDist(t,H(0,9))*25.)*1.5; }
  return col; }`);

fx("Hands", "bones", "Hand X-Ray", "glow", "body xray", `
${BONES}
vec3 fx(vec2 t){ vec3 n = N(t);
  vec3 col = mix(C(t)*.25, vec3(.4,.7,1.)*pow(1.-max(n.z,0.),1.3)*MM(t)*.9, uB);
  vec2 pt = AS(t);
  for(int h=0;h<2;h++){ if(!HON(h)) continue;
    for(int i=0;i<21;i++){ float d = sdSeg(pt, AS(H(h,BA[i])), AS(H(h,BB[i])));
      col += vec3(.85,.95,1.)*(smoothstep(.006,.003,d) + exp(-d*90.)*.35*(1.+uA*2.)); }
    for(int i=0;i<21;i++){ float d = length(pt-AS(H(h,i))); col += vec3(.6,.85,1.)*smoothstep(.009,.005,d)*.6; } }
  return col; }`);

fx("Hands", "swirl", "Swirl Warp", "twist", "radius", `
vec3 fx(vec2 t){ vec2 q = t;
  for(int h=0;h<2;h++){ if(!HON(h)) continue;
    vec2 c = H(h,8); vec2 p = (q-c)*vec2(uAspect,1.); float r = length(p);
    float a = (1.+uA*4.)*exp(-r*mix(12.,4.,uB))*(h==0 ? 1. : -1.)*(1.+uBass);
    p = rot(a)*p; q = c + p/vec2(uAspect,1.); }
  return C(q); }`);

fx("Hands", "handgrade", "Hand Colour Grade", "exposure", "contrast", `
vec3 fx(vec2 t){ vec3 c = C(t); if(!HON(0)) return c; vec2 p = H(0,9);
  vec3 s = toSrgb(c);
  mat3 toY = mat3(.299,.596,.211, .587,-.274,-.523, .114,-.322,.312); mat3 fromY = inverse(toY);
  vec3 y = toY*s; y.yz = rot((p.x-.5)*TAU)*y.yz; y.yz *= mix(2.2, 0., p.y);
  vec3 o = clamp(fromY*y, 0., 1.); o = mix(vec3(.5), o, .7+uB*.8);
  return toLin(clamp(o,0.,1.))*(.8+uA*.8); }`);

fx("Hands", "interference", "Interference", "frequency", "glow", `
vec3 fx(vec2 t){ float s = 0.; int n = 0;
  for(int h=0;h<2;h++){ if(!HON(h)) continue;
    for(int k=1;k<5;k++){ s += sin(aDist(t,H(h,4+k*4))*(80.+uA*120.) - uTime*8.); n++; } }
  if(n == 0){ s = sin(aDist(t,uBody.xy)*120.-uTime*8.); n = 1; }
  s /= float(n);
  return C(t + N(t).xy*s*.004)*(.7+.3*s) + vec3(.2,.6,1.)*pow(max(s,0.),6.)*(.2+uB*1.2); }`);

fx("Hands", "constellation", "Constellation", "lines", "stars", `
vec3 fx(vec2 t){ vec3 col = C(t)*.3; vec2 P[10]; int n = 0;
  for(int h=0;h<2;h++){ if(!HON(h)) continue; for(int k=0;k<5;k++){ P[n] = AS(H(h,4+k*4)); n++; } }
  vec2 pt = AS(t);
  for(int i=0;i<10;i++){ if(i>=n) break; float d = length(pt-P[i]);
    col += vec3(1.,.95,.8)*(exp(-d*d/.00002)*3. + .0012/(d+.002)*(.1+uB*.3));
    for(int j=0;j<10;j++){ if(j<=i) continue; if(j>=n) break;
      float l = sdSeg(pt, P[i], P[j]); col += vec3(.5,.7,1.)*exp(-l*l/(.0014*.0014))*(.3+uA*.6); } }
  float st = step(.996, hash(floor(pt*300.)))*(.5+.5*sin(uTime*3.+hash(floor(pt*300.))*40.));
  return col + st*.4; }`);

fx("Hands", "shield", "Hex Shield", "size", "pulse", `
vec3 fx(vec2 t){ vec3 col = C(t);
  for(int h=0;h<2;h++){ if(!HON(h)) continue;
    vec2 c = H(h,9); float R = .15*(1.+uA); vec2 p = (t-c)*vec2(uAspect,1.); float r = length(p);
    if(r > R*1.15) continue;
    vec2 q = p*28./(1.+uA); vec2 hs = vec2(1.,1.732);
    vec2 a = mod(q,hs)-hs*.5, b = mod(q-hs*.5,hs)-hs*.5; vec2 g = dot(a,a)<dot(b,b) ? a : b;
    float hx = max(abs(g.x)*.866+abs(g.y)*.5, abs(g.y));
    float line = smoothstep(.06,.0,abs(hx-.47));
    float fade = smoothstep(R, R*.55, r); float pulse = .6+.4*sin(r*60.-uTime*(4.+uB*8.));
    col = mix(col, col*vec3(.7,.9,1.3), fade*.6) + vec3(.2,.8,1.)*(line*pulse*fade*1.5 + exp(-pow((r-R)*80.,2.))); }
  return col; }`);

fx("Hands", "reveal", "Shadow Realm", "radius", "dark tint", `
vec3 fx(vec2 t){ vec3 c = C(t); vec3 dark = vec3(lum(c))*hsv(.6+uB*.4,.5,.4)*.3;
  float lit = 0.;
  for(int h=0;h<2;h++){ if(!HON(h)) continue; lit = max(lit, smoothstep(.2*(1.+uA*1.5), .04, aDist(t,H(h,9)))); }
  return mix(dark, c*1.3, lit); }`);

fx("Hands", "timebubble", "Time Bubble", "size", "edge", `
vec3 fx(vec2 t){ vec3 c = C(t); vec3 prev = PV(t); if(lum(prev) < .0005) prev = c; float inb = 0., ring = 0.;
  for(int h=0;h<2;h++){ if(!HON(h)) continue; float R = .18*(1.+uA); float r = aDist(t,H(h,9));
    inb = max(inb, smoothstep(R, R*.94, r)); ring += exp(-pow((r-R)*90.,2.)); }
  vec3 col = mix(c, prev, inb); keep(col);
  return mix(col, col*vec3(.75,.85,1.1), inb*.6) + vec3(.6,.8,1.)*ring*(.3+uB); }`);

fx("Hands", "sparks", "Spark Fountain", "gravity", "amount", `
vec3 fx(vec2 t){ vec2 jit = (vec2(hash(t*200.+uTime), hash(t*200.-uTime))-.5)*.004;
  vec3 st = PV(t - vec2(0., .004+uA*.008) + jit)*.93;
  for(int h=0;h<2;h++){ if(!HON(h)) continue;
    for(int k=1;k<5;k++){ float d = aDist(t, H(h,4+k*4));
      st += vec3(1.,.65,.25)*step(.9-uB*.15, hash(t*500.+uTime+float(k)))*exp(-d*d/(.018*.018))*3.; } }
  keep(st); return C(t)*.5 + st; }`);

fx("Hands", "webs", "Spider Web", "silk", "dew", `
vec3 fx(vec2 t){ vec3 col = C(t)*.55; vec2 pt = AS(t);
  if(HON(0) && HON(1)){
    for(int k=0;k<5;k++){ for(int j=0;j<5;j++){
      vec2 a = AS(H(0,4+k*4)), b = AS(H(1,4+j*4));
      float l = sdSeg(pt, a, b); float w = .0009*(1.+uA);
      col += vec3(.9,.92,1.)*exp(-l*l/(w*w))*(.25+.25*float(k==j));
      vec2 ab = b-a; float h = clamp(dot(pt-a,ab)/dot(ab,ab),0.,1.);
      float dew = step(.8, fract(h*10.+float(k+j)))*exp(-l*l/(.003*.003))*uB;
      col += vec3(1.)*dew*.8; } } }
  return col; }`);

fx("Hands", "pinchzoom", "Pinch Zoom", "max zoom", "smooth", `
vec3 fx(vec2 t){ if(!HON(0)) return C(t);
  vec2 c = (H(0,4)+H(0,8))*.5; float sp = aDist(H(0,4),H(0,8));
  float z = mix(1.+uA*3., 1., clamp(sp*4.,0.,1.));
  return C(c + (t-c)/z); }`);

fx("Hands", "orbiters", "Orbiting Moons", "count", "speed", `
vec3 fx(vec2 t){ vec3 col = C(t)*.5;
  for(int h=0;h<2;h++){ if(!HON(h)) continue; vec2 c = H(h,9);
    for(int i=0;i<8;i++){ float fi = float(i); if(fi > 2.+uA*6.) break;
      float a = uTime*(1.+uB*3.)*(1.+fi*.2) + fi*2.4; float R = .07+fi*.012;
      vec2 o = c + vec2(cos(a), sin(a)*.6)*R/vec2(uAspect,1.);
      float d = aDist(t, o); vec3 mc = hsv(fi*.13+.55,.6,1.);
      col += mc*(exp(-d*200.)*2. + exp(-d*30.)*.25);
      col += C(t)*mc*exp(-d*12.)*.5; } }
  return col; }`);

// ---------------------------------------------------------------- AUDIO
fx("Audio", "eqbody", "EQ Body", "gain", "bars", `
vec3 fx(vec2 t){ float nb = floor(mix(12.,48.,uB)); float x = floor(t.x*nb); float f = x/nb;
  float lv = f < .33 ? uBass : f < .66 ? uMid : uHigh;
  lv = lv*(.6+.4*hash(vec2(x, floor(uTime*8.)))) + .12 + .08*sin(uTime*3.+x);
  float bar = step(1.-lv*(1.+uA*1.5), t.y)*step(.1, fract(t.x*nb));
  vec3 col = rainbow(f+uTime*.05)*bar*1.5;
  return mix(C(t)*.25, col + C(t)*.2, MM(t)) + col*(1.-MM(t))*.15; }`);

fx("Audio", "basszoom", "Bass Punch", "zoom", "split", `
vec3 fx(vec2 t){ float z = 1. + uBeat*.06*(1.+uA*2.) + uBass*.02;
  vec2 q = (t-uBody.xy)/z + uBody.xy; float s = uBeat*(.004+uB*.02);
  return vec3(C(q+vec2(s,0.)).r, C(q).g, C(q-vec2(s,0.)).b)*(1.+uBeat*.4); }`);

fx("Audio", "strobe", "Beat Strobe", "flash", "room", `
vec3 fx(vec2 t){ vec3 k = hsv(fract(uBeatN*.37 + floor(uTime*.5)*.11*(1.-step(.5,uBeatN))), .9, 1.);
  float m = MM(t); float fl = .4 + uBeat*(1.+uA*2.);
  return mix(C(t)*uB*.3 + k*.05, k*fl*(.5+lum(C(t))), m) + vec3(1.)*uBeat*.05*uA; }`);

fx("Audio", "speaker", "Speaker Cone", "push", "ring", `
vec3 fx(vec2 t){ vec2 c = uBody.xy; vec2 p = (t-c)*vec2(uAspect,1.); float r = length(p);
  float push = (uBeat + .3*sin(uTime*4.)*(1.-step(.01,uBass+uBeat)))*.04*(1.+uA)*exp(-r*4.);
  vec2 q = t - p/vec2(uAspect,1.)/max(r,1e-3)*push;
  float rr = (1.-uBeat)*.6;
  return C(q) + vec3(.6,.3,1.)*exp(-pow((r-rr)*20.,2.))*(uBeat+.15)*(.5+uB*1.5); }`);

fx("Audio", "crown", "Spectrum Crown", "height", "colour", `
vec3 fx(vec2 t){ vec2 c = uBody.zw + vec2(0., -.02); vec2 p = (t-c)*vec2(uAspect,1.);
  float a = atan(p.y,p.x); float r = length(p);
  float seg = floor((a+PI)/TAU*48.); float f = seg/48.;
  float lv = mix(uBass, uHigh, abs(f-.5)*2.)*(.6+.4*hash(vec2(seg, floor(uTime*10.)))) + .08 + .05*sin(uTime*2.+seg);
  float bar = step(.1, r)*step(r, .1 + lv*.18*(1.+uA))*step(.25, fract((a+PI)/TAU*48.));
  return C(t) + hsv(f+uTime*.1+uB, .7, 1.)*bar*1.6*(1.-MM(t)*.7); }`);

fx("Audio", "scope", "Oscilloscope", "drape", "thickness", `
vec3 fx(vec2 t){ float y0 = .5 + (D(t)-.5)*.25*(1.+uA*2.);
  float w = sin(t.x*40.+uTime*10.)*(uBass*.08+.02) + sin(t.x*97.-uTime*7.)*(uHigh*.04+.01);
  float d = abs(t.y-(y0+w)); float th = .0015*(1.+uB*3.);
  return C(t)*.3 + vec3(.2,1.,.5)*(exp(-d*d/(th*th)) + exp(-d/.012)*.3)*2.; }`);

fx("Audio", "stage", "Stage Beams", "spread", "haze", `
vec3 fx(vec2 t){ vec3 col = C(t)*.22;
  for(int i=0;i<5;i++){ float fi = float(i);
    vec2 src = vec2((fi+.5)/5., -.05);
    float ang = sin(uTime*(.6+fi*.13)+fi*2.)*.5 + uBass*.3*sin(fi*1.7);
    vec2 dir = vec2(sin(ang), cos(ang));
    vec2 p = (t-src)*vec2(uAspect,1.); float al = dot(p,dir); float pe = abs(dot(p, vec2(-dir.y,dir.x)));
    float cone = smoothstep(.02+al*.15*(1.+uA), 0., pe)*step(0., al);
    vec3 lc = hsv(fi*.2+uTime*.03, .7, 1.);
    float haze = (.25+.75*fbm(t*vec2(4.,2.)+uTime*.1))*(1.-MM(t)*.7)*(.4+uB);
    col += lc*cone*haze*.5*(1.+uBeat) + C(t)*lc*cone*2.*MM(t)*lambert(N(t), vec3(-dir,.6)); }
  return col; }`);

fx("Audio", "confetti", "Confetti", "amount", "fall", `
vec3 fx(vec2 t){ vec2 jit = vec2(sin(t.y*50.+uTime*3.)*.001, 0.);
  vec3 st = PV(t - vec2(0., .003+uB*.006) + jit)*.997;
  float trig = max(step(.9, uBeat), step(.985, fract(uTime*.4)));
  vec2 g = floor(AS(t)*vec2(160.,100.));
  float spawn = trig*step(.992-uA*.02, hash(g+floor(uTime*10.)))*step(t.y,.35);
  st = max(st, hsv(hash(g+3.),.8,1.)*spawn*1.5);
  keep(st); return C(t)*.8 + st; }`);

fx("Audio", "beatglitch", "Beat Glitch", "chaos", "blocks", `
vec3 fx(vec2 t){ float g = uBeat*(.5+uA) + step(.97, hash(vec2(floor(uTime*8.),1.)))*.5;
  vec2 b = floor(t*vec2(8.,12.)*(1.+uB*2.)); float h = hash(b+floor(uTime*20.));
  vec2 q = t + (vec2(h, hash(b+5.))-.5)*.1*g*step(.6,h);
  vec3 c = vec3(C(q+vec2(.01*g,0.)).r, C(q).g, C(q-vec2(.01*g,0.)).b);
  return mix(c, 1.-c, step(.95, h)*g); }`);

fx("Audio", "pulsegrid", "Pulse Grid", "cells", "colour", `
vec3 fx(vec2 t){ vec2 p = AS(t)*(12.+uA*20.); vec2 id = floor(p), f = fract(p);
  vec2 tc = (id+.5)/(12.+uA*20.)/vec2(uAspect,1.);
  float l = LN(tc); float d = D(tc);
  float wave = .5+.5*sin(length(id - vec2(12.,6.))*.6 - uTime*4.);
  float sz = clamp(l*1.3 + uBass*.6*wave + uBeat*.3, 0., 1.)*.48;
  float sq = step(max(abs(f.x-.5),abs(f.y-.5)), sz);
  return hsv(d*.6+uTime*.05+uB, .7, 1.)*sq*(.4+l*1.5); }`);

fx("Audio", "kaleibeat", "Kaleido Beat", "mirrors", "spin", `
vec3 fx(vec2 t){ vec2 p = (t-uBody.xy)*vec2(uAspect,1.);
  float a = atan(p.y,p.x), r = length(p);
  float segs = 4. + mod(uBeatN, 6.)*2. + floor(uA*6.);
  float seg = TAU/segs; a = mod(a + uTime*.2*(.3+uB), seg); a = abs(a-seg*.5);
  r *= 1. - uBeat*.08;
  return SRC(vec2(cos(a),sin(a))*r/vec2(uAspect,1.) + uBody.xy)*(1.+uBeat*.3); }`);

// ---------------------------------------------------------------- STYLIZE
fx("Stylize", "oil", "Oil Paint", "brush", "texture", `
vec3 fx(vec2 t){ vec2 r = uTexel*mix(2.,6.,uA);
  vec3 bestM = vec3(0.); float bestV = 1e9;
  for(int q=0;q<4;q++){ vec2 s = vec2(q==0||q==2 ? -1. : 1., q<2 ? -1. : 1.);
    vec3 m = vec3(0.), m2 = vec3(0.);
    for(int j=0;j<3;j++) for(int i=0;i<3;i++){ vec3 c = C(t + s*vec2(float(i),float(j))*r); m += c; m2 += c*c; }
    m /= 9.; m2 /= 9.; float v = dot(m2 - m*m, vec3(1.));
    if(v < bestV){ bestV = v; bestM = m; } }
  float brush = fbm(rot(atan(N(t).y,N(t).x))*AS(t)*vec2(200.,20.));
  return bestM*(.9 + brush*.2*(.5+uB)); }`);

fx("Stylize", "pencil", "Pencil Sketch", "hatch", "paper", `
vec3 fx(vec2 t){ float l = LN(t); vec2 p = AS(t)*mix(160.,80.,uA);
  float h1 = step(fract((p.x+p.y)*.5), .3)*step(l, .6);
  float h2 = step(fract((p.x-p.y)*.5), .3)*step(l, .35);
  float h3 = step(fract(p.x*.5+.25), .3)*step(l, .15);
  float ink = max(max(h1,h2),h3)*.55 + clamp(edgeN(t,1.2)+edgeL(t,1.)*.8, 0., 1.);
  vec3 paper = mix(vec3(.95,.93,.88), vec3(.85,.78,.62), uB)*(.92+.08*noise(AS(t)*400.));
  return paper*(1.-ink*.85); }`);

fx("Stylize", "watercolor", "Watercolor", "wobble", "pigment", `
vec3 fx(vec2 t){ vec2 w = (vec2(fbm(AS(t)*6.), fbm(AS(t)*6.+5.))-.5)*.02*(1.+uA*2.);
  vec3 c = blurS(t+w, .004)*EXPO; c = toLin(floor(clamp(toSrgb(c),0.,1.)*6.)/6.);
  c = mix(vec3(lum(c)), c, 1.+uB);
  float e = edgeL(t+w, 2.)*.6 + edgeN(t,2.)*.4;
  vec3 paper = vec3(.97,.95,.9)*(.9+.1*fbm(AS(t)*50.));
  return mix(paper, c*1.1, .85)*(1.-e*.35)*(.95+.1*fbm(AS(t)*15.)); }`);

fx("Stylize", "engrave", "Engraving", "lines", "ink", `
vec3 fx(vec2 t){ float l = LN(t); vec3 n = N(t);
  vec2 p = rot(.6 + n.x*.35)*AS(t)*mix(170.,80.,uA);
  float line = abs(fract(p.y + n.y*1.5 + D(t)*3.)-.5)*2.;
  float th = 1.05 - sqrt(clamp(l, 0., 1.))*1.1;
  float ink = smoothstep(th, th-.15, line);
  return toLin(mix(vec3(.94,.9,.8), mix(vec3(.12,.1,.08), vec3(.05,.25,.2), uB), ink)); }`);

fx("Stylize", "ascii", "ASCII", "cells", "colour", `
float glyph(int k, vec2 f){ vec2 c = f-.5;
  if(k==0) return 0.;
  if(k==1) return step(length(c*vec2(1.,1.8)), .12);
  if(k==2) return step(abs(c.y),.06)*step(abs(c.x),.3);
  if(k==3) return max(step(abs(c.y-.12),.05), step(abs(c.y+.12),.05))*step(abs(c.x),.3);
  if(k==4) return max(step(abs(c.y),.05)*step(abs(c.x),.3), step(abs(c.x),.06)*step(abs(c.y),.3));
  if(k==5) return max(max(step(abs(c.y),.05)*step(abs(c.x),.3), step(abs(c.x),.06)*step(abs(c.y),.3)), step(abs(abs(c.x)-abs(c.y)),.05)*step(length(c),.32));
  if(k==6) return max(step(abs(abs(c.x)-.15),.05)*step(abs(c.y),.35), step(abs(abs(c.y)-.12),.05)*step(abs(c.x),.32));
  return clamp(step(abs(length(c*vec2(1.,.8))-.28),.07) + step(length(c-vec2(.05,0.)),.1), 0., 1.); }
vec3 fx(vec2 t){ float cs = mix(110.,45.,uA); vec2 p = AS(t)*cs/vec2(1.,1.8);
  vec2 id = floor(p), f = fract(p); vec2 tc = (id+.5)*vec2(1.,1.8)/cs; tc.x /= uAspect;
  vec3 c = CN(tc); float l = clamp(pow(lum(c),.5)*1.25, 0., .999);
  float g = glyph(int(l*8.), f);
  return mix(vec3(.25,1.,.45)*(.5+l), c*2., uB)*g; }`);

fx("Stylize", "crt", "CRT Television", "curve", "mask", `
vec3 fx(vec2 t){ vec2 q = t-.5; q *= 1. + dot(q,q)*.2*(.3+uA); vec2 tq = q+.5;
  if(tq.x<0.||tq.y<0.||tq.x>1.||tq.y>1.) return vec3(0.);
  vec3 c = vec3(C(tq+vec2(.0015,0.)).r, C(tq).g, C(tq-vec2(.0015,0.)).b);
  float sl = .7+.3*sin(tq.y/uTexel.y*PI*.5);
  vec3 mask = mix(vec3(1.), vec3(.75)+.25*sin(tq.x/uTexel.x*2.1+vec3(0.,2.1,4.2)), .4+uB*.6);
  float edge = smoothstep(0., .04, min(min(tq.x,tq.y), min(1.-tq.x,1.-tq.y)));
  return c*sl*mask*1.35*edge + vec3(.02,.03,.02)*edge; }`);

fx("Stylize", "vhs", "VHS Tape", "tracking", "noise", `
vec3 fx(vec2 t){ float tr = sin(t.y*8.+uTime*1.3)*.002 + (hash(vec2(floor(t.y*240.), floor(uTime*24.)))-.5)*.004*(1.+uA*3.);
  float jump = step(.985, hash(vec2(floor(uTime*6.),3.)))*.03;
  vec2 q = vec2(t.x+tr, fract(t.y+jump));
  vec3 c = C(q); vec3 cb = (C(q+vec2(.004,0.)) + C(q-vec2(.004,0.)) + C(q+vec2(.008,0.)))/3.;
  vec3 col = vec3(lum(c)) + (cb - vec3(lum(cb)))*1.2;
  col += (hash(AS(t)*vec2(300.,600.)+uTime)-.5)*.025*(1.+uB*2.);
  col *= .9+.1*sin(t.y*600.);
  col = mix(col, vec3(hash(t*700.+uTime)), smoothstep(.96,1.,fract(-uTime*.2+t.y))*.4*uB);
  return max(col,0.)*vec3(1.05,.97,1.06); }`);

fx("Stylize", "gameboy", "Game Boy", "pixel", "contrast", `
float bay(vec2 p){ int i = int(mod(p.x,4.)) + int(mod(p.y,4.))*4;
  const float B[16] = float[](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.); return B[i]/16.; }
vec3 fx(vec2 t){ float px = mix(2.,6.,uA); vec2 cell = floor(t/uTexel/px);
  vec2 tc = (cell+.5)*uTexel*px; float l = pow(clamp(lum(CN(tc)),0.,1.), mix(.8,.45,uB));
  float lv = floor(l*3. + bay(cell)*.99);
  vec3 c = lv < 1. ? vec3(.06,.22,.06) : lv < 2. ? vec3(.19,.38,.19) : lv < 3. ? vec3(.55,.67,.06) : vec3(.61,.74,.06);
  return toLin(c)*1.2; }`);

fx("Stylize", "cmyk", "CMYK Halftone", "dots", "misregister", `
vec3 fx(vec2 t){ float sc = mix(130.,55.,uA); vec3 ink = vec3(1.);
  for(int ch=0;ch<4;ch++){ vec2 o = vec2(float(ch)-1.5, 0.)*uTexel*uB*6.;
    vec3 c = clamp(toSrgb(CN(t+o)),0.,1.); float k = 1.-max(c.r,max(c.g,c.b)); vec3 cmy = (1.-c-k)/max(1.-k,1e-3);
    vec2 p = rot(.26+float(ch)*.52)*AS(t)*sc; vec2 f = fract(p)-.5;
    float v = ch < 3 ? cmy[ch] : k; float r = sqrt(clamp(v,0.,1.))*.55;
    float dt = smoothstep(r+.06, r-.06, length(f));
    if(ch==0) ink.r *= 1.-dt*.9; else if(ch==1) ink.g *= 1.-dt*.9; else if(ch==2) ink.b *= 1.-dt*.9; else ink *= 1.-dt*.85; }
  return toLin(ink*vec3(.98,.96,.92)); }`);

fx("Stylize", "blueprint", "Blueprint", "lines", "contours", `
vec3 fx(vec2 t){ vec3 bg = vec3(.035,.15,.42); vec2 g = AS(t)*40.; vec2 gl = abs(fract(g)-.5); vec2 gl5 = abs(fract(g/5.)-.5);
  float grid = step(.46, max(gl.x,gl.y))*.25 + step(.49, max(gl5.x,gl5.y))*.35;
  float lines = clamp(edgeN(t,1.5)*1.3 + edgeL(t,1.2)*.5, 0., 1.);
  float v = D(t)*20.; float cont = (1.-min(abs(fract(v)-.5)/max(fwidth(v),1e-4),1.))*.35*MM(t)*uB;
  return bg*(1.+grid) + vec3(.85,.92,1.)*(lines+cont)*(.8+uA); }`);

fx("Stylize", "aerochrome", "Aerochrome IR", "foliage", "skin", `
vec3 fx(vec2 t){ vec3 c = toSrgb(C(t));
  vec3 ir = vec3(c.g*1.1+c.r*.2, c.r*.9, c.b*.9+c.g*.1);
  float veg = smoothstep(0., .12, c.g-max(c.r,c.b))*(.5+uA);
  ir = mix(ir, vec3(1.,.15,.35)*(.5+c.g), clamp(veg,0.,1.));
  ir = mix(ir, ir*vec3(1.,.8,1.15), MM(t)*uB);
  return toLin(clamp(ir,0.,1.))*1.1; }`);

fx("Stylize", "stitch", "Cross-Stitch", "stitches", "fabric", `
vec3 fx(vec2 t){ float sc = mix(95.,40.,uA); vec2 p = AS(t)*sc; vec2 id = floor(p), f = fract(p)-.5;
  vec2 tc = vec2((id.x+.5)/sc/uAspect, (id.y+.5)/sc); vec3 c = toLin(floor(toSrgb(CN(tc))*5.+.5)/5.);
  float th = max(smoothstep(.3,.16,abs(f.x-f.y)), smoothstep(.3,.16,abs(f.x+f.y)))*step(length(f),.62);
  float sh = .75+.25*sin((f.x+f.y)*20.);
  vec3 fabric = mix(vec3(.92,.89,.82), vec3(.2,.25,.35), uB)*(.85+.15*step(.5, fract((p.x+p.y)*2.)));
  return mix(toLin(fabric), c*sh*1.2, th); }`);

fx("Stylize", "glasswin", "Stained Glass", "pieces", "light", `
vec3 fx(vec2 t){ float sc = mix(45.,12.,uA); vec4 v = voroC(AS(t)*sc); vec2 tc = vec2(v.x/sc/uAspect, v.y/sc);
  vec3 c = CN(tc); vec3 g = max(mix(vec3(lum(c)), c, 2.3), 0.)*1.2;
  float lead = smoothstep(.04, .09, v.z);
  float glow = .7+.3*fbm(AS(t)*10.+uTime*.1);
  return (g*glow*lead + vec3(.015)*(1.-lead))*(1.+uB*(1.-t.y)); }`);

fx("Stylize", "neonedge", "Neon Edges", "colour", "photo", `
vec3 fx(vec2 t){ float e = clamp(edgeN(t,1.5)*1.2 + edgeL(t,1.)*.7, 0., 1.);
  return rainbow(t.x*.5+t.y*.3+uTime*.1+D(t)*.5+uA)*e*2.5*(1.+uBeat) + C(t)*.05*uB*4.; }`);

fx("Stylize", "chalk", "Chalkboard", "colour", "shading", `
vec3 fx(vec2 t){ vec3 board = vec3(.05,.1,.075)*(.8+.3*fbm(AS(t)*8.));
  float e = clamp(edgeN(t,1.6)*1.1 + edgeL(t,1.2)*.8, 0., 1.); float l = lum(C(t));
  float hatch = step(fract(AS(t).x*150.+AS(t).y*90.), .3)*smoothstep(.15,.5,LN(t))*MM(t)*.5*uB*2.;
  float chalk = (e+hatch)*(.6+.4*noise(AS(t)*400.));
  vec3 cc = mix(vec3(.95), hsv(t.y+uTime*.02, .4, 1.), uA);
  return board + cc*chalk; }`);

fx("Stylize", "duotone", "Duotone Poster", "hue", "contrast", `
vec3 fx(vec2 t){ float l = smoothstep(.05-uB*.04, .7-uB*.3, LN(t));
  return toLin(mix(hsv(.95+uA,.85,.25), hsv(.12+uA,.6,1.), l)); }`);

fx("Stylize", "benday", "Pop Art Dots", "dots", "levels", `
vec3 fx(vec2 t){ vec3 c = clamp(toSrgb(CN(t)),0.,1.); float lv = mix(2.,5.,uB); vec3 q = floor(c*lv+.5)/lv;
  float ink = clamp(edgeN(t,1.6)*1.3 + edgeL(t,1.4), 0., 1.);
  vec2 p = rot(.785)*AS(t)*mix(90.,45.,uA); float r = (1.-lum(q))*.55;
  float dots = smoothstep(r+.05, r-.05, length(fract(p)-.5));
  return toLin(mix(q, q*.55, dots)*(1.-ink))*1.15; }`);

fx("Stylize", "pico", "PICO-8", "pixel", "dither", `
vec3 fx(vec2 t){ float px = mix(3.,10.,uA); vec2 cell = floor(t/uTexel/px); vec2 tc = (cell+.5)*uTexel*px;
  vec3 c = clamp(toSrgb(CN(tc)),0.,1.) + (hash(cell)-.5)*.12*uB;
  const vec3 P[16] = vec3[](vec3(0.),vec3(.11,.17,.33),vec3(.49,.15,.33),vec3(0.,.53,.32),vec3(.67,.32,.21),vec3(.37,.34,.31),vec3(.76,.76,.78),vec3(1.,.95,.91),vec3(1.,0.,.3),vec3(1.,.64,0.),vec3(1.,.93,.15),vec3(0.,.89,.21),vec3(.16,.68,1.),vec3(.51,.46,.61),vec3(1.,.47,.66),vec3(1.,.8,.67));
  vec3 best = P[0]; float bd = 9.;
  for(int i=0;i<16;i++){ float d = dot(c-P[i], c-P[i]); if(d < bd){ bd = d; best = P[i]; } }
  return toLin(best); }`);

fx("Stylize", "pointillism", "Pointillism", "dots", "jitter", `
vec3 fx(vec2 t){ float sc = mix(110.,45.,uA); vec3 col = vec3(.95,.93,.88);
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){
    vec2 id = floor(AS(t)*sc) + vec2(x,y); vec2 o = hash2(id)*(.6+uB*.4);
    vec2 cp = (id+o)/sc; vec2 tc = vec2(cp.x/uAspect, cp.y);
    vec3 c = clamp(toSrgb(CN(tc)),0.,1.); c = clamp(mix(vec3(lum(c)), c, 1.7) + (hash2(id+3.).x-.5)*.25, 0., 1.);
    float d = length(AS(t)-cp)*sc; float dotm = smoothstep(.8, .65, d);
    col = mix(col, c, dotm); }
  return toLin(col); }`);

fx("Stylize", "mondrian", "Mondrian", "grid", "fill", `
vec3 fx(vec2 t){ vec2 p = t*vec2(5.,4.)*(1.+uA); vec2 id = floor(p), f = fract(p);
  float h = hash(id); vec2 tc = (id+.5)/(vec2(5.,4.)*(1.+uA));
  float m = MM(tc)*.7 + MM(t)*.3;
  vec3 c = h < .33 ? vec3(.85,.1,.1) : h < .55 ? vec3(.1,.2,.7) : h < .7 ? vec3(.95,.8,.1) : vec3(.95,.94,.9);
  c = mix(vec3(.95,.94,.9), c, step(.5-uB*.4, m));
  float line = step(min(min(f.x,f.y),min(1.-f.x,1.-f.y)), .04);
  return toLin(mix(c, vec3(.03), line)); }`);

fx("Stylize", "hologram2d", "Hologram Flat", "flicker", "scan", `
vec3 fx(vec2 t){ float m = MM(t); float l = lum(C(t));
  float fl = 1. - uA*.4*step(.85, hash(vec2(floor(uTime*15.),1.)));
  float sl = .6 + .4*step(.5, fract(t.y*200. - uTime*4.*(1.+uB*3.)));
  vec2 g = vec2(t.x + (hash(vec2(floor(t.y*60.), floor(uTime*10.)))-.5)*.01*step(.9, hash(vec2(floor(uTime*10.),3.))), t.y);
  vec3 h = vec3(.3,.85,1.)*(lum(C(g))*1.5 + pow(1.-max(N(t).z,0.),2.)*.8)*sl*fl;
  return mix(C(t)*.06, h, m) + vec3(.2,.6,1.)*m*.05; }`);

fx("Stylize", "infrared2", "Predator Vision", "heat", "scan", `
vec3 fx(vec2 t){ float h = clamp(MM(t)*(.55+.45*(.5+.5*N(t).z)) + lum(C(t))*.25*(1.+uA), 0., 1.);
  vec3 c = h < .33 ? mix(vec3(0.,0.,.3), vec3(0.,.6,.9), h*3.) : h < .66 ? mix(vec3(0.,.8,.4), vec3(1.,1.,0.), (h-.33)*3.) : mix(vec3(1.,.6,0.), vec3(1.,0.,0.), (h-.66)*3.);
  float sc = .85 + .15*sin(t.y*400. - uTime*20.*uB);
  return toLin(c)*sc; }`);
