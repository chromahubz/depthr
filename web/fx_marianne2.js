// MARIANNE II: the looks the first pass missed, found by checking every cut of the video
// (mostly the rapid flash-cut montages).   (needs MAR_LIB from fx_marianne.js)
"use strict";

const MAR_GLASS = `
float glassMask(vec2 t, out float nearK){ float d0 = D(uBody.xy);
  nearK = clamp((D(t) - d0)*mix(4.,14.,uA) + .35, 0., 1.);
  float soft = mBlur(t,.035)*.6 + mBlur(t,.07)*.4;
  return smoothstep(.2, .8, mix(soft, M(t), nearK)); }
`;

fx("Marianne", "mar_strobecut", "Strobe Cut", "rate", "dark frame", `${MAR_LIB}
vec3 fx(vec2 t){ float on = max(step(.5, fract((floor(uTime*mix(4.,14.,uA)) + uBeatN*3.)*.5)), step(.6, uBeat));
  vec3 c = DS(t); vec3 n = N(t); float m = MM(t);
  vec3 g = mix(vec3(.2,1.,.6), vec3(.4,.4,1.), smoothstep(-.5,.5, mix(t.x*2.-1., n.x, m)));
  g = mix(g, vec3(1.,.15,.3), smoothstep(.1,.35, c.r - c.g));
  vec3 bright = clamp(g*lum(c)*1.8 + c*.4, 0., 1.);
  vec3 dark = mix(vec3(.02,.08,.09), vec3(.1,.3,.3), lum(c))*mix(.3,1.,uB);
  return toLin(mix(dark, bright, on)) + mGrain(t,.03); }`);

fx("Marianne", "mar_frostedglass", "Frosted Glass", "focus", "violet", `${MAR_LIB}${MAR_GLASS}
vec3 fx(vec2 t){ float k; float mm = glassMask(t, k);
  vec3 bg = mix(vec3(1.,.74,.86), vec3(.98,.62,.8), t.y)*(.95 + .05*noise(AS(t)*300.));
  vec3 fig = mix(mix(vec3(.3,.12,.5), vec3(.5,.2,.9), uB*.6), vec3(.05,.03,.2), k) + DS(t)*.08;
  return toLin(clamp(mix(bg, fig, mm),0.,1.)); }`);

fx("Marianne", "mar_glassneg", "Glass Negative", "focus", "glow", `${MAR_LIB}${MAR_GLASS}
vec3 fx(vec2 t){ float k; float mm = glassMask(t, k); float l = lum(DS(t));
  vec3 bg = vec3(.08,.0,.02) + vec3(.15,0.,.03)*fbm(AS(t)*3.);
  vec3 fig = mix(vec3(.6,.08,.12), vec3(1.,.55,.6), k*.7 + l*.5)*(1. + uB*.6);
  fig += vec3(1.,.8,.8)*pow(1.-l, 3.)*k*.3;
  return toLin(clamp(mix(bg, fig, mm),0.,1.)); }`);

fx("Marianne", "mar_graincrowd", "Grain Crowd", "contrast", "ghost", `${MAR_LIB}
vec3 fx(vec2 t){ vec3 c = DS(t); float l = lum(c);
  float g = hash(floor(t*vec2(640.,360.)) + fract(uTime*31.)*53.);
  float v = mix(l, step(g, pow(l, mix(1.4,.8,uA))), .55);
  vec3 col = mix(mix(vec3(.02,.12,.15), vec3(.4,1.,.85), v), vec3(1.,.45,.55), smoothstep(.15,.35, c.r - c.g)*.6);
  vec3 o = toLin(col); o = mix(o, max(o, PV(t)*.9), uB*.6); keep(o); return o; }`);

fx("Marianne", "mar_longexpo", "Spirit Streak", "direction", "length", `${MAR_LIB}
vec3 fx(vec2 t){ vec2 dir = vec2(cos(uA*PI), sin(uA*PI))*vec2(1./uAspect,1.)*.004;
  float l = lum(DS(t));
  vec3 cur = toLin(mix(vec3(.02,.05,.08), mix(vec3(.4,.85,1.), vec3(.85,.75,1.), l), smoothstep(.05,.8,l)));
  vec3 o = max(cur*(MM(t)*.9 + .25), PV(t - dir*(1. + uB*3.))*mix(.9,.975,uB)); keep(o); return o; }`);

fx("Marianne", "mar_heatmelt", "Heat Melt", "melt", "cycle", `${MAR_LIB}
vec3 fx(vec2 t){ vec2 p = AS(t); float tm = uTime*.15;
  vec2 w = vec2(fbm(p*2.5 + tm), fbm(p*2.5 + 7.3 - tm)) - .5;
  vec2 q = t + w*mix(.02,.15,uA)*(.4 + MM(t)); float l = lum(DS(q));
  float h = fract(l*1.6 + (w.x+w.y)*.6 + uTime*.05*uB);
  vec3 col = mix(vec3(.05,.2,.3), vec3(.2,.9,.6), smoothstep(0.,.3,h)); col = mix(col, vec3(1.,.95,.3), smoothstep(.3,.5,h));
  col = mix(col, vec3(.95,.1,.05), smoothstep(.5,.7,h)); col = mix(col, vec3(.3,0.,0.), smoothstep(.75,.95,h));
  return toLin(col*smoothstep(.02,.1,l)); }`);

fx("Marianne", "mar_mirrordemon", "Mirror Demon", "width", "red eyes", `${MAR_LIB}
vec3 fx(vec2 t){ vec2 q = vec2(uBody.z - abs(t.x - .5)*mix(.7,1.3,uA), t.y); float l = lum(DS(q));
  vec3 col = mix(vec3(0.,.08,.25), vec3(.1,.9,.85), smoothstep(.05,.45,l)); col = mix(col, vec3(.85,1.,.95), smoothstep(.6,.9,l));
  col = mix(col, vec3(.9,.05,.25), smoothstep(.22,.35,l)*smoothstep(.5,.35,l)*clamp(uB*1.5,0.,1.));
  col = mix(col, vec3(.1,.05,.4), smoothstep(.12,0.,l)) + vec3(.3,1.,.6)*exp(-abs(t.x-.5)*80.)*.3;
  return toLin(clamp(col,0.,1.)); }`);

fx("Marianne", "mar_quadmirror", "Quad Mirror", "copies", "fluid", `${MAR_LIB}
vec3 fx(vec2 t){ float n = floor(mix(2.,4.,uA) + .5); float u = fract(t.x*n*.5)*2.; u = u > 1. ? 2.-u : u;
  vec2 q = vec2(uBody.x + (u-.5)*.5, t.y); float l = lum(DS(q)); float m = MM(q);
  vec3 bg = mix(vec3(.05,.05,.35), vec3(.3,.2,.8), fbm(AS(t)*3. + uTime*.2)) + vec3(.6,.3,1.)*uB*.3*fbm(AS(t)*6. - uTime*.3);
  vec3 fig = mix(vec3(.1,.6,.3), vec3(1.,1.,.55), smoothstep(.2,.8,l)) + vec3(.3,1.,.4)*edgeN(q,2.)*.5;
  return toLin(clamp(mix(bg, fig, max(m, mBlur(q,.02)*.6)),0.,1.)); }`);

fx("Marianne", "mar_mirrorsil", "Mirror Silhouette", "spread", "rim", `${MAR_LIB}
vec3 fx(vec2 t){ vec2 q = vec2(uBody.x - abs(t.x - .5)*mix(1.,1.6,uA), t.y);
  float bl = lum(clamp(toSrgb(blurS(q,.025)*EXPO),0.,1.));
  float lg = smoothstep(.3,.52, fbm(vec2(q.x*4., t.y*1.5 + uTime*.2)))*smoothstep(.9,.3,abs(t.y-.5)*2.); bl = max(bl, lg*.95);
  vec3 bg = mix(vec3(.08,.3,.35), vec3(.4,.7,.75), min(bl,.45)) + vec3(.9,.35,.2)*smoothstep(.4,.75,bl) + vec3(.6,.3,.45)*smoothstep(.75,.98,bl);
  bg += vec3(.1,.3,.3)*noise(vec2(q.x*200., uTime*2.))*.3;
  float m = MM(q), mr = MM(q + vec2(.01,0.));
  vec3 col = mix(bg, vec3(1.,.2,.1), clamp(mr - m, 0., 1.)*uB*1.5);
  return toLin(clamp(mix(col, vec3(.02,.02,.03), m),0.,1.)) + mGrain(t,.03); }`);

fx("Marianne", "mar_oilslick", "Oil Slick", "body flow", "speed", `${MAR_LIB}
vec3 fx(vec2 t){ vec2 p = AS(t); float tm = uTime*.1*(1. + uB*3.);
  vec2 w = p + vec2(fbm(p*1.5 + tm), fbm(p*1.5 - tm + 5.))*1.4;
  float f = fbm(w*1.2 + (MM(t)*.8 + lum(DS(t))*.6)*uA);
  vec3 col = mix(vec3(.05,.1,.5), rainbow(f*3. + tm), smoothstep(.35,.55,f));
  col = mix(col, vec3(.3,.95,.85), smoothstep(.3,.4,f)*smoothstep(.45,.4,f)*.9);
  col = mix(col, vec3(.98,.88,.9), smoothstep(.72,.78,f));
  return toLin(clamp(col,0.,1.)); }`);

fx("Marianne", "mar_infrared", "Infrared Halo", "head heat", "scan", `${MAR_LIB}
vec3 fx(vec2 t){ float mb = mBlur(t,.02)*.4 + mBlur(t,.05)*.35 + mBlur(t,.1)*.25; float l = lum(DS(t));
  float h = clamp(mb*.7 + l*.35*mb + exp(-aDist(t, uBody.zw)*mix(9.,4.,uA))*.4, 0., 1.);
  vec3 col = mix(vec3(.05,.05,.35), vec3(.3,.1,.7), smoothstep(0.,.3,h)); col = mix(col, vec3(.9,.1,.5), smoothstep(.3,.5,h));
  col = mix(col, vec3(1.,.5,0.), smoothstep(.5,.65,h)); col = mix(col, vec3(1.,.95,.2), smoothstep(.65,.8,h)); col = mix(col, vec3(1.), smoothstep(.85,1.,h));
  col *= 1. - uB*.15*step(.5, fract(t.y*180.));
  return toLin(clamp(col,0.,1.)) + mGrain(t,.03); }`);

fx("Marianne", "mar_heartxray", "Heart X-Ray", "size", "pulse", `${MAR_LIB}
vec3 fx(vec2 t){ vec2 ch = mix(uBody.xy, uBody.zw, .4); float sc = max(aDist(uBody.xy, uBody.zw), .08)*mix(1.5,2.6,uA);
  vec2 p = (t-ch)*vec2(uAspect,1.)/sc;
  float spine = smoothstep(.06,.02, abs(p.x))*step(-1.,p.y)*step(p.y,1.2)*(.6 + .4*step(.5, fract(p.y*8.)));
  float ribs = 0.;
  for(int i=0;i<8;i++){ float fi = float(i); float yy = -.8 + fi*.2 + .45*p.x*p.x + .05*abs(p.x); float w = mix(.035,.02,fi/7.);
    ribs = max(ribs, smoothstep(w, w*.3, abs(p.y-yy))*step(abs(p.x), .8 - fi*.03)*step(.07, abs(p.x))); }
  float pulse = 1. + (uBeat*.25 + .06*sin(uTime*7.))*uB*2.;
  vec2 hp = (p - vec2(.14, .1))/(.3*pulse); float hx = hp.x, hy = -hp.y + .2;
  float hv = pow(hx*hx + hy*hy - 1., 3.) - hx*hx*hy*hy*hy;
  float heart = smoothstep(.05, -.08, hv), hglow = 1./(1. + max(hv,0.)*30.);
  float body = smoothstep(.1,.5, mBlur(t,.02));
  vec3 base = mix(vec3(.02,.03,.08), vec3(.1,.25,.45), lum(DS(t))*.7)*(.5 + .5*body);
  vec3 col = base + vec3(.5,.85,1.)*(ribs + spine)*body*.9 + vec3(1.,.55,.35)*hglow*.5*body;
  col = mix(col, vec3(1.,.96,.85), heart*body);
  return toLin(clamp(col,0.,1.)) + mGrain(t,.02); }`);

fx("Marianne", "mar_sepiaburn", "Sepia Burn", "dot size", "burn", `${MAR_LIB}
vec3 fx(vec2 t){ float l = lum(DS(t)); vec2 p = rot(.5)*AS(t)*mix(220.,110.,uA);
  float ht = step(length(fract(p)-.5), sqrt(l)*.62);
  vec3 col = mix(vec3(.2,.06,.02), mix(vec3(.85,.35,.12), vec3(1.,.85,.55), smoothstep(.5,.9,l)), ht);
  col = mix(col, vec3(1.,.95,.8), smoothstep(.85,1.,l)) + lum(mBloom(t,.03))*vec3(1.,.6,.2)*uB*1.5;
  return toLin(clamp(col*mVig(t,.6),0.,1.)) + mGrain(t,.04); }`);

fx("Marianne", "mar_contours", "Psychedelic Contours", "rings", "flow", `${MAR_LIB}
vec3 fx(vec2 t){ float l = lum(clamp(toSrgb(blurS(t,.008)*EXPO),0.,1.)); float v = l*mix(4.,10.,uA) + uTime*.3*uB;
  float fv = fract(v), id = floor(v), w = fwidth(v)*2.5 + .02;
  float k = mod(id, 3.); vec3 rc = rainbow(id*.17 + .55);
  vec3 col = k < 1. ? vec3(.08,.1,.45) : k < 2. ? rc : mix(vec3(.95,.95,.85), rc, .3);
  return toLin(col*smoothstep(0.,w,fv)*smoothstep(1.,1.-w,fv)); }`);

fx("Marianne", "mar_negscream", "Negative Scream", "split", "magenta", `${MAR_LIB}
vec3 fx(vec2 t){ float s = mix(.002,.012,uA); vec3 c = DS(t);
  float l = 1. - lum(c), lr = 1. - lum(DS(t + vec2(s,0.)));
  vec3 col = mix(vec3(.04,.1,.04), vec3(.4,1.,.2), smoothstep(.1,.6,l)); col = mix(col, vec3(.95,1.,.9), smoothstep(.7,.95,l));
  col = mix(col, vec3(1.,.1,.55), clamp(smoothstep(.1,.3, c.r - c.g)*1.2 + smoothstep(.25,0.,l)*uB, 0., 1.));
  col.r = mix(col.r, lr, .35);
  return toLin(clamp(col,0.,1.)) + mGrain(t,.03); }`);

fx("Marianne", "mar_smokeface", "Smoke Face", "disperse", "drift", `${MAR_LIB}
vec3 fx(vec2 t){ vec2 p = AS(t); float tm = uTime*.3*(1. + uB*2.);
  vec2 w = (vec2(fbm(p*4. + tm), fbm(p*4. - tm + 3.)) - .5)*mix(.02,.12,uA);
  vec2 q = t + w*(1. - MM(t)*.6); float l = lum(DS(q)); float m = mBlur(q,.01);
  vec3 cur = toLin(mix(vec3(0.,.03,.05), mix(vec3(.1,.7,.8), vec3(.85,1.,1.), smoothstep(.4,.9,l)), smoothstep(.08,.6,l)*(.25 + .75*m)));
  vec3 o = max(cur, PV(t + vec2(0.,.004) + w*.1)*.95); keep(o); return o; }`);

fx("Marianne", "mar_backlit", "Backlit Smear", "smear", "rim", `${MAR_LIB}
vec3 fx(vec2 t){ vec2 d = t - uBody.xy; vec3 acc = vec3(0.);
  for(int i=0;i<10;i++) acc += DS(t - d*float(i)/9.*mix(.05,.3,uA)); acc /= 10.;
  float l = lum(acc), sm = mBlur(t,.02);
  float lg = smoothstep(.3,.52, fbm(vec2(AS(t).x*3., t.y*1.5 + uTime*.2)))*smoothstep(.9,.4,abs(t.y-.55)*2.);
  vec3 bg = mix(vec3(.04,.08,.12), vec3(.3,.45,.55), l) + vec3(1.,.5,.35)*smoothstep(.35,.7,max(l,lg*.9))*1.2 + vec3(1.,.7,.9)*smoothstep(.6,.9,max(l,lg));
  vec3 col = mix(bg, vec3(.03,.02,.02), smoothstep(.3,.8,sm)) + vec3(1.,.4,.2)*smoothstep(.2,.4,sm)*smoothstep(.7,.4,sm)*uB;
  return toLin(clamp(col,0.,1.)) + mGrain(t,.04); }`);

fx("Marianne", "mar_plasma", "Plasma Arcs", "energy", "magenta", `${MAR_LIB}
float ridge(vec2 p){ return 1. - abs(noise(p)*2. - 1.); }
vec3 fx(vec2 t){ vec2 p = (t-uBody.zw)*vec2(uAspect,1.); float r = length(p), a = atan(p.y,p.x); float tm = uTime*(.5 + uA*2.);
  vec2 q = vec2(a*3., r*4. - tm) + vec2(fbm(p*3. + tm), fbm(p*3. - tm))*1.2;
  float arc = pow(ridge(q*2.), 12.)*.8 + pow(ridge(q*4. + 3.), 18.)*.5;
  float env = clamp(mBlur(t,.08)*1.5 + exp(-r*3.)*.5, 0., 1.)*(1. + uBeat);
  vec3 ac = mix(vec3(.35,.55,1.), vec3(1.,.3,.9), uB);
  vec3 col = (ac*arc*2. + vec3(1.)*pow(arc,3.))*env;
  float l = lum(DS(t)); vec3 fig = mix(vec3(.01,.01,.05), ac*.6, l*.6) + vec3(1.)*smoothstep(.7,1.,l)*.5;
  return toLin(clamp(mix(col, fig + col*.3, MM(t)),0.,1.)); }`);

fx("Marianne", "mar_glitter", "Glitter Body", "grain size", "twinkle", `${MAR_LIB}
vec3 fx(vec2 t){ float m = MM(t); float l = lum(DS(t));
  vec3 fig = mix(vec3(.7,.25,.2), vec3(1.,.7,.6), smoothstep(.1,.8,l))*m*(.7 + .3*fbm(AS(t)*20.));
  vec2 p = AS(t)*mix(150.,70.,uA); vec2 id = floor(p), f = fract(p) - .5;
  float sp = step(.93, hash(id + floor(uTime*mix(2.,12.,uB))))*smoothstep(.25,0.,length(f))*(mBlur(t,.03)*1.6 + m*.4);
  return toLin(clamp(fig + vec3(1.,.5,.8)*sp*1.5, 0., 1.)); }`);

fx("Marianne", "mar_whiteout", "White-Out Flash", "exposure", "random flash", `${MAR_LIB}
vec3 fx(vec2 t){ float fl = clamp(uBeat*1.2 + step(.97, hash(vec2(floor(uTime*8.),3.)))*uB, 0., 1.);
  vec3 c = DS(t); vec3 col = 1. - exp(-c*mix(1.5,5.,uA)*(1. + fl*2.));
  col = mix(col, vec3(1.,1.,.96), smoothstep(.5,1.,lum(col))*.7); col = mix(col, col*vec3(.85,1.05,.9), .5);
  col += (hash(t*vec2(900.,500.) + fract(uTime*30.)) - .5)*.12 - vec3(.4)*edgeL(t,1.5)*(1. - fl*.5);
  return toLin(clamp(col,0.,1.)); }`);

fx("Marianne", "mar_neural", "Neural Veins", "scale", "green", `${MAR_LIB}
vec3 fx(vec2 t){ vec2 q = AS(t)*mix(3.,7.,uA) + vec2(0., uTime*.05); float v = 0., amp = 1.;
  for(int i=0;i<4;i++){ float fi = float(i); q += vec2(fbm(q + fi*3.1), fbm(q - fi*1.7))*.6;
    v += pow(1. - abs(noise(q*1.7)*2. - 1.), 10. + fi*6.)*amp; q *= 1.9; amp *= .7; }
  vec3 vc = mix(vec3(.35,.5,1.), vec3(.5,1.,.5), uB); float m = MM(t), l = lum(DS(t));
  vec3 bg = (vec3(0.,.02,.06) + vc*v*.9 + vec3(1.)*pow(v,3.)*.6)*.6;
  vec3 fig = vc*.15*l + vc*v*1.6 + vec3(1.)*pow(v,2.)*.8 + vec3(.9,.95,1.)*smoothstep(.7,1.,l)*.3;
  return toLin(clamp(mix(bg, fig, m),0.,1.)); }`);

fx("Marianne", "mar_inkwash", "Ink Wash", "ink", "warm paper", `${MAR_LIB}
vec3 fx(vec2 t){ vec2 p = AS(t);
  float l = lum(clamp(toSrgb(blurS(t + (vec2(fbm(p*6.), fbm(p*6. + 3.)) - .5)*.01, .006)*EXPO),0.,1.));
  float ink = smoothstep(mix(.45,.75,uA), .05, l);
  ink = clamp(ink + (fbm(p*25.)*.3 + noise(vec2(p.x*400., p.y*30.))*.15 - .2)*ink, 0., 1.);
  vec3 paper = vec3(.95,.94,.9) - fbm(p*8.)*.05;
  vec3 col = mix(paper, mix(vec3(.25,.25,.23), vec3(.08,.07,.06), smoothstep(.5,1.,ink)), ink*.95);
  return toLin(mix(col, col*vec3(1.,.93,.8), uB)); }`);

fx("Marianne", "mar_gelcycle", "Gel Cycle", "punch", "rate", `${MAR_LIB}
vec3 fx(vec2 t){ float i = mod(floor(uBeatN) + floor(uTime*mix(.5,4.,uB)), 4.);
  vec3 g = i < 1. ? vec3(.85,.7,.25) : i < 2. ? vec3(1.,.85,.55) : i < 3. ? vec3(1.,.15,.45) : vec3(.95,.35,.75);
  vec3 c = DS(t); float l = lum(c);
  vec3 col = mix(g*pow(l, mix(1.,.6,uA))*1.3 + c*.15, vec3(1.,.97,.9), smoothstep(.75,1.,l)*.5);
  return toLin(clamp(col,0.,1.)) + mGrain(t,.03); }`);

fx("Marianne", "mar_zoomburst", "Zoom Burst", "zoom", "warm", `${MAR_LIB}
vec3 fx(vec2 t){ vec2 c = uBody.zw; vec2 d = t - c; float s = mix(.05,.3,uA)*(1. + uBeat); vec3 acc = vec3(0.);
  for(int i=0;i<12;i++){ float k = float(i)/11.; acc += vec3(DS(c + d*(1. - s*k)).r, DS(c + d*(1. - s*k*.8)).g, DS(c + d*(1. - s*k*.6)).b); }
  vec3 col = clamp((mix(acc/12., DS(t), .25) - .05)*1.4, 0., 1.);
  return toLin(clamp(mix(col, col*vec3(1.2,.9,.6) + vec3(.1,0.,0.), uB),0.,1.)); }`);

fx("Marianne", "mar_lightwings", "Light Wings", "span", "flow", `${MAR_LIB}
float wing(vec2 t, vec2 e, float dir){ vec2 p = (t-e)*vec2(uAspect,1.); p.x *= dir; float r = length(p);
  if(p.x < -.02) return 0.; float a = atan(-p.y, p.x);
  float bend = a + sin(r*6. - uTime*(1. + uB*2.))*.15 + r*.6;
  float s = pow(smoothstep(.55, 1., noise(vec2(bend*60., r*2. - uTime*.5))), 2.);
  return s*smoothstep(0.,.08,r)*smoothstep(.8*mix(.6,1.4,uA), .1, r)*smoothstep(-.3,.3,a)*smoothstep(1.7,1.,a); }
vec3 fx(vec2 t){ vec2 sh = mix(uBody.xy, uBody.zw, .6); float sw = max(aDist(uBody.xy, uBody.zw), .08)*.5/uAspect;
  float w = wing(t, sh - vec2(sw,0.), -1.) + wing(t, sh + vec2(sw,0.), 1.);
  vec3 col = DS(t)*vec3(.35,.5,.8)*(1. - MM(t)*.6) + vec3(.85,.95,1.)*w*2.6 + vec3(1.,.4,.8)*exp(-aDist(t, sh)*6.)*.25;
  return toLin(clamp(col,0.,1.)); }`);

fx("Marianne", "mar_redaura", "Red Aura", "halo", "orbs", `${MAR_LIB}
vec3 fx(vec2 t){ float m = MM(t); float l = lum(DS(t));
  float halo = mBlur(t,.03)*.5 + mBlur(t,.07)*.3 + mBlur(t,.14)*.2;
  vec3 bg = mix(vec3(.05,.25,.25), vec3(.15,.45,.42), l)*(1. - .4*length(t-.5)) + vec3(.9,1.,1.)*smoothstep(0.,.6,halo)*(1.-m)*mix(.6,1.6,uA);
  vec2 g = AS(t)*6. + vec2(0., uTime*.2); vec2 id = floor(g);
  bg += vec3(1.,.35,.3)*smoothstep(.12,0., length(fract(g) - .5 - (hash2(id) - .5)*.6))*step(.8, hash(id + 2.))*uB;
  vec3 fig = mix(vec3(.5,.02,0.), vec3(1.,.35,.1), smoothstep(.05,.7,l)); fig = mix(fig, vec3(1.,.9,.6), smoothstep(.75,1.,l));
  return toLin(clamp(mix(bg, fig, m),0.,1.)); }`);

fx("Marianne", "mar_photocopy", "Photocopy", "threshold", "invert", `${MAR_LIB}
vec3 fx(vec2 t){ float g = hash(floor(t*vec2(800.,450.)) + fract(uTime*12.)*13.); float th = mix(.25,.6,uA);
  float v = smoothstep(th - .15, th + .15, lum(DS(t)) + (g - .5)*.5);
  vec3 col = mix(vec3(.12,.13,.1), vec3(.95,.95,.88), v);
  return toLin(mix(col, vec3(1.07,1.07,.98) - col, step(.5,uB))); }`);

fx("Marianne", "mar_heatstipple", "Heat Stipple", "grain", "blue bg", `${MAR_LIB}
vec3 fx(vec2 t){ float g = hash(floor(t*vec2(640.,360.)*mix(1.,.45,uA)) + floor(uTime*20.));
  float h = clamp(lum(DS(t))*1.3 + (g - .5)*.45, 0., 1.);
  vec3 col = mix(vec3(.25,0.,.35), vec3(.75,.05,.15), smoothstep(.1,.35,h)); col = mix(col, vec3(1.,.5,.05), smoothstep(.35,.6,h));
  col = mix(col, vec3(1.,.95,.4), smoothstep(.65,.9,h));
  return toLin(mix(col, col.bgr*vec3(.6,.8,1.2), (1. - MM(t))*uB*.8)); }`);

fx("Marianne", "mar_tealsil", "Teal Silhouette", "fringe", "detail", `${MAR_LIB}
vec3 fx(vec2 t){ float s = mix(.006,.03,uA);
  float m = smoothstep(.3,.7, mBlur(t,.004)), mr = smoothstep(.3,.7, mBlur(t + vec2(s,0.),.006)), mb = smoothstep(.3,.7, mBlur(t - vec2(s*.6, -s*.3),.006));
  vec3 col = mix(vec3(.1,.55,.5), vec3(.4,.9,.8), lum(DS(t))*.8);
  col = mix(col, vec3(1.,.35,.1), mr*(1.-m)); col = mix(col, vec3(.9,.1,.3), mb*(1.-m)*.8);
  col = mix(col, vec3(.02,.06,.05) + DS(t)*.15*uB, m);
  return toLin(clamp(col,0.,1.)) + mGrain(t,.02); }`);
