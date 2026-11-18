// LIGHT: relighting rigs driven by DAViD normals.   MATERIAL: re-skin the person.
"use strict";
fx("Light", "prism", "Prism Skin", "spin", "room", `
vec3 fx(vec2 t){ vec3 n = N(t); float m = MM(t); vec3 c = C(t);
  float h = atan(n.y, n.x)/TAU + uTime*.05*(.2+uA*3.) + n.z*.3;
  vec3 pr = rainbow(h)*(.35+.65*pow(1.-n.z,1.5))*1.8;
  return mix(c*(.25+uB*.6), c*.35 + pr*(.35+lum(c)*1.6), m); }`);

fx("Light", "orbitrim", "Orbit Rim", "speed", "room", `
vec3 fx(vec2 t){ vec3 n = N(t); float m = MM(t); vec3 c = C(t); float a = uTime*(.6+uA*3.);
  vec3 l1 = vec3(cos(a), sin(a), .25), l2 = vec3(cos(a+PI), sin(a+PI), .25);
  vec3 L = vec3(1.,.2,.5)*pow(lambert(n,l1),2.)*3. + vec3(.1,.7,1.)*pow(lambert(n,l2),2.)*3.;
  float rim = pow(1.-max(n.z,0.), 1.5);
  return c*(.1+uB*.4) + (c*1.5+.03)*L*(.4+rim)*m + c*L*.15*(1.-m); }`);

fx("Light", "disco", "Disco Ball", "dots", "colour", `
vec3 fx(vec2 t){ vec3 n = N(t); float m = MM(t); vec3 c = C(t);
  vec3 r = reflect(vec3(0.,0.,-1.), n); r.xz = rot(uTime*.6)*r.xz;
  vec2 sp = vec2(atan(r.z, r.x), acos(clamp(r.y,-1.,1.)))*(5.+uA*8.);
  vec2 g = fract(sp)-.5; float h = hash(floor(sp));
  float d1 = smoothstep(.2, .0, length(g))*step(.5, h)*(.6+.4*sin(uTime*6.+h*30.));
  vec2 q = rot(uTime*.25)*(AS(t)-vec2(uAspect*.5,.3))*(10.+uA*12.);
  vec2 gq = fract(q)-.5; float hq = hash(floor(q));
  float d2 = smoothstep(.16, 0., length(gq))*step(.62, hq);
  return c*.35 + (c+.05)*hsv(h,.2+uB*.8,1.)*d1*4.*m + hsv(hq,.2+uB*.8,1.)*d2*(1.-m*.5)*(.5+uBass)*.9; }`);

fx("Light", "police", "Police Lights", "speed", "strobe", `
vec3 fx(vec2 t){ vec3 n = N(t); float m = MM(t); vec3 c = C(t); float ph = uTime*(2.+uA*6.);
  float a = step(.5, fract(ph)); float sb = mix(1., step(.5, fract(ph*5.)), uB)*.7+.3;
  vec3 L = vec3(1.,.04,.04)*lambert(n,vec3(-1.,-.2,.5))*a*sb + vec3(.08,.2,1.)*lambert(n,vec3(1.,-.2,.5))*(1.-a)*sb;
  vec3 wash = mix(vec3(.08,.2,1.), vec3(1.,.04,.04), a)*sb*.05;
  return c*.05 + (c*1.7+.02)*L*3.*mix(.35,1.,m) + wash; }`);

fx("Light", "candle", "Candlelight", "flame", "cool fill", `
vec3 fx(vec2 t){ vec3 n = N(t); float m = MM(t); vec3 c = C(t);
  float fl = .75 + .25*noise(vec2(uTime*7., 0.))*(.6+.4*sin(uTime*23.));
  vec3 L = vec3(1.,.5,.15)*lambert(n,vec3(.15,1.,.7))*fl*(2.+uA*3.);
  L += vec3(.15,.22,.45)*lambert(n,vec3(0.,-1.,.3))*uB*1.2;
  float near = smoothstep(.8, .0, length((t-vec2(.5,1.05))*vec2(uAspect,1.)));
  return c*.02 + (c*1.5+.015)*L*mix(.25+near*.6, 1., m); }`);

fx("Light", "pool", "Pool Caustics", "scale", "rays", `
float caus(vec2 p){ float s = 0.; for(int i=0;i<3;i++){ p += vec2(sin(p.y*1.7+uTime*.8+float(i)), cos(p.x*1.3-uTime*.7))*.6; s += .5/(1.+abs(sin(p.x*2.)+sin(p.y*2.3))*6.); } return s; }
vec3 fx(vec2 t){ vec3 n = N(t); float d = D(t); vec3 c = C(t);
  float k = caus(AS(t)*(4.+uA*6.) + n.xy*.8)*.75;
  vec3 water = mix(vec3(0.,.06,.1), vec3(.05,.3,.4), d);
  vec3 col = c*vec3(.4,.75,.9)*(.45+k*1.4*(.5+.5*n.z)) + water*(1.-d)*.35 + vec3(.6,.9,1.)*pow(k,3.)*.25;
  float rays = pow(noise(vec2(t.x*uAspect*7.+t.y*2.5, uTime*.3)), 3.)*(1.-t.y)*(1.-MM(t)*.5);
  return col + vec3(.3,.7,.8)*rays*(.3+uB*2.); }`);

fx("Light", "stained", "Church Window", "panes", "warmth", `
vec3 fx(vec2 t){ vec3 n = N(t); float m = MM(t); vec3 c = C(t);
  vec2 p = AS(t) + (1.-D(t))*vec2(.3,-.1) + vec2(uTime*.01, 0.);
  vec3 v = voro(p*(3.+uA*6.)); vec3 glass = hsv(v.z, .75, 1.)*smoothstep(.0,.05,v.y);
  vec3 L = glass*lambert(n, vec3(-1.,-.5,.6))*3.2;
  vec3 haze = glass*.06*(1.-m);
  return c*mix(vec3(.12,.13,.18), vec3(.2,.15,.1), uB) + (c*1.5+.02)*L*mix(.22,1.,m) + haze; }`);

fx("Light", "storm", "Thunderstorm", "rate", "rain", `
vec3 fx(vec2 t){ vec3 n = N(t); float m = MM(t); vec3 c = C(t);
  float rate = 1.2+uA*3.; float tt = floor(uTime*rate);
  float on = step(.55, hash(vec2(tt,1.)))*exp(-fract(uTime*rate)*5.)*(.55+.45*sin(uTime*90.));
  on = max(on, uBeat);
  float a = hash(vec2(tt,2.))*TAU; vec3 l = vec3(cos(a), -abs(sin(a))-.2, .4);
  vec3 L = vec3(.75,.85,1.)*lambert(n,l)*on*6. + vec3(.05,.07,.13);
  vec2 rp = vec2(t.x*uAspect*90. + t.y*12., t.y*6. - uTime*9.);
  float rain = step(.93, hash(floor(rp)))*smoothstep(.0,.6,fract(rp.y))*uB*.35;
  return (c*1.4+.01)*L*mix(.65,1.,m) + vec3(.6,.7,1.)*on*.05 + rain*vec3(.6,.7,.9)*(1.-m*.6); }`);

fx("Light", "cyber", "Cyberpunk Neon", "hue", "haze", `
vec3 fx(vec2 t){ vec3 n = N(t); float m = MM(t); vec3 c = C(t);
  vec3 ca = hsv(.5+uA*.5, .9, 1.), cb = hsv(.88+uA*.5, .85, 1.);
  vec3 L = ca*pow(lambert(n,vec3(-1.,0.,.3)),1.5)*2.8 + cb*pow(lambert(n,vec3(1.,0.,.3)),1.5)*2.8;
  vec3 haze = mix(ca, cb, t.x)*.06*uB*(1.-m)*(.6+.4*fbm(t*4.+uTime*.1));
  return c*.04 + (c*1.4+.03)*L*mix(.3,1.,m) + vec3(.02,0.,.05) + haze; }`);

fx("Light", "blinds", "Venetian Blinds", "slats", "sway", `
vec3 fx(vec2 t){ vec3 n = N(t); vec3 c = C(t);
  float y = t.y*(10.+uA*20.) + t.x*5. - (1.-D(t))*3. + sin(uTime*.5)*uB*2.;
  float stripe = smoothstep(.3,.45,fract(y))*smoothstep(.95,.8,fract(y));
  vec3 L = vec3(1.,.62,.28)*stripe*lambert(n,vec3(.8,-.5,.6))*3.6;
  return c*.06 + (c*1.5+.02)*L + c*vec3(.2,.25,.4)*.12 + vec3(1.,.6,.3)*stripe*.012; }`);

fx("Light", "gobo", "Data Projector", "density", "colour", `
vec3 fx(vec2 t){ vec3 n = N(t); vec3 c = C(t); float m = MM(t);
  vec2 p = AS(t)*vec2(14.,8.)*(1.+uA) + n.xy*1.6; p.y += uTime*.6;
  vec2 id = floor(p), f = fract(p);
  float b = step(.5, hash(id + floor(uTime*4.)*.13));
  float g = b > .5 ? smoothstep(.1,.0,abs(f.x-.5))*step(abs(f.y-.5),.3) : smoothstep(.09,.0,abs(length((f-.5)*vec2(1.,.8))-.24));
  vec3 L = hsv(.33+uB*.6, .8, 1.)*g*2.6*mix(.25,1.,m)*(.5+.5*n.z);
  return c*.08 + (c+.05)*L*1.8 + L*.1; }`);

fx("Light", "biolum", "Bioluminescence", "cells", "darkness", `
vec3 fx(vec2 t){ vec3 n = N(t); vec3 c = C(t); float m = MM(t);
  vec3 v = voro(AS(t)*(20.+uA*40.) + n.xy*2.);
  float spot = smoothstep(.35,.0,v.x)*step(.45,v.z);
  float pulse = .5+.5*sin(uTime*2.+v.z*20.) + uBass*1.5;
  vec3 g = mix(vec3(0.,1.,.8), vec3(.35,.4,1.), v.z)*spot*pulse*2.2*m;
  return c*(.18-uB*.15) + g + c*g*.3 + vec3(0.,.4,.35)*pow(1.-max(n.z,0.),3.)*m*.4; }`);

fx("Light", "wet", "Wet Look", "gloss", "base", `
vec3 fx(vec2 t){ vec3 n = N(t); vec3 c = C(t);
  vec3 l = vec3(sin(uTime*.4)*.8, -.6, .7);
  float sp = spec(n, l, 60.+uA*250.)*4. + spec(n, vec3(-.7,.3,.8), 40.)*1.5;
  return c*(.45+uB*.6) + vec3(1.)*sp*MM(t); }`);

fx("Light", "rimonly", "Rim Silhouette", "tight", "colour", `
vec3 fx(vec2 t){ vec3 n = N(t); float m = MM(t);
  float rim = pow(1.-max(n.z,0.), 2.+uA*4.);
  vec3 col = mix(hsv(.07+uB*.5,.7,1.), hsv(.58+uB*.5,.7,1.), .5+.5*n.x)*rim*3.5*m;
  return col + C(t)*.025; }`);

fx("Light", "xray", "X-Ray", "glow", "bones", `
vec3 fx(vec2 t){ vec3 n = N(t); float m = MM(t); float l = lum(C(t));
  float f = pow(1.-max(n.z,0.), 1.2);
  vec3 x = vec3(.55,.85,1.)*(f*1.4 + (1.-l)*.25*uB)*m*(1.+uA);
  x += vec3(.4,.7,1.)*edgeN(t,1.5)*.8*m;
  return x + vec3(0.,.01,.03); }`);

fx("Light", "studio", "Studio Portrait", "key side", "backdrop", `
vec3 fx(vec2 t){ vec3 n = N(t); vec3 c = C(t); float sd = mix(-1.,1.,uA);
  vec3 key = vec3(1.,.95,.85)*lambert(n,vec3(sd*.8,-.6,.6))*2.;
  vec3 fill = vec3(.4,.5,.7)*lambert(n,vec3(-sd*.8,-.1,.6))*.5;
  vec3 back = vec3(1.,.8,.6)*pow(1.-max(n.z,0.),3.)*step(0.,n.x*-sd)*2.;
  vec3 bg = mix(hsv(.6+uB*.4,.25,.35), vec3(.015), length((t-vec2(.5,.4))*vec2(uAspect,1.))*1.1);
  return mix(bg, (c*1.5+.02)*(key+fill)+back*.6, MM(t)); }`);

fx("Light", "sunrise", "Sunrise Sweep", "speed", "sky", `
vec3 fx(vec2 t){ vec3 n = N(t); vec3 c = C(t); float m = MM(t);
  float a = fract(uTime*.04*(1.+uA*4.))*PI; vec3 l = vec3(cos(a), -sin(a)*.9, .45);
  float el = sin(a);
  vec3 sun = mix(vec3(1.,.35,.1), vec3(1.,.95,.85), el);
  vec3 sky = mix(vec3(.25,.15,.35), vec3(.35,.55,.9), el)*(.4+uB*.8);
  vec3 L = sun*lambert(n,l)*2.4 + sky*(.5-.5*n.y)*.6;
  return (c*1.5+.02)*L*mix(.6,1.,m) + sky*.04; }`);

fx("Light", "uvlight", "Blacklight", "glow", "flicker", `
vec3 fx(vec2 t){ vec3 c = C(t); float m = MM(t);
  vec3 s = toSrgb(c); float white = smoothstep(.55,.9,min(s.r,min(s.g,s.b)));
  float sat = max(s.r,max(s.g,s.b)) - min(s.r,min(s.g,s.b));
  vec3 glow = mix(vec3(.6,.2,1.), vec3(.2,1.,.9), step(.5,fract(sat*3.)))*(white*1.6+sat*1.3)*(1.+uA*2.);
  float fl = 1. - uB*.3*step(.8, hash(vec2(floor(uTime*20.),1.)));
  return (c*vec3(.15,.05,.35)*.6 + glow*(.4+lum(c)) )*fl; }`);

fx("Light", "fireplace", "Fireside", "heat", "dance", `
vec3 fx(vec2 t){ vec3 n = N(t); vec3 c = C(t); float m = MM(t);
  float f1 = noise(vec2(uTime*4.,1.)), f2 = noise(vec2(uTime*6.,9.));
  vec3 l = vec3(-1.+f1*.4*uB, .3+f2*.3*uB, .5);
  vec3 L = vec3(1.,.42,.1)*lambert(n,l)*(1.6+uA*2.)*(.7+.3*f1) + vec3(.1,.12,.25)*lambert(n,vec3(1.,-.3,.4))*.3;
  return c*.02 + (c*1.5+.01)*L*mix(.35+(1.-t.x)*.4,1.,m); }`);

fx("Light", "aurora_lit", "Aurora Light", "speed", "sky", `
vec3 fx(vec2 t){ vec3 n = N(t); vec3 c = C(t); float m = MM(t);
  float w = fbm(vec2(t.x*3.+uTime*.1*(1.+uA*3.), uTime*.05));
  vec3 au = mix(vec3(.1,1.,.5), vec3(.6,.2,1.), w);
  float band = smoothstep(.6,.0,abs(t.y - (.25+.15*sin(t.x*4.+uTime*.3+w*3.))))*(1.-m);
  vec3 L = au*(.5-.5*n.y)*1.8 + au*.3;
  vec3 sky = vec3(.01,.02,.05) + au*band*(.8+uB*1.5);
  return mix(sky + c*.05, (c*1.5+.02)*L*.9, m); }`);

// ---------------------------------------------------------------- MATERIAL
fx("Material", "marble", "Marble Statue", "veins", "pedestal light", `
vec3 fx(vec2 t){ vec3 n = N(t);
  float v = fbm(AS(t)*3. + n.xy*.6);
  float vein = pow(abs(sin((AS(t).x + AS(t).y*.6 + v*3.)*(4.+uA*8.))), .15);
  vec3 alb = mix(vec3(.3,.29,.28), vec3(.95,.94,.92), vein);
  vec3 l = vec3(-.5,-.7,.6);
  vec3 statue = (alb*(.15+lambert(n,l)*.85 + uB*lambert(n,vec3(0.,1.,.4))*.5) + spec(n,l,40.)*.3)*.46;
  return mix(C(t)*.25, statue, MM(t)); }`);

fx("Material", "porcelain", "Porcelain / Kintsugi", "cracks", "gold", `
vec3 fx(vec2 t){ vec3 n = N(t);
  vec3 v = voro(AS(t)*(6.+uA*16.) + n.xy*.5);
  float crack = smoothstep(.04, .0, v.y);
  vec3 l = vec3(-.4,-.6,.7);
  vec3 por = (vec3(.92,.94,.97)*(.18+lambert(n,l)*.8) + vec3(.1,.2,.6)*pow(1.-n.z,3.)*.4)*.45 + spec(n,l,80.)*.8;
  por *= 1. - crack*(1.-uB)*.75;
  por += vec3(1.,.72,.2)*crack*uB*(1.8+spec(n,l,20.)*3.);
  return mix(C(t)*.25, por, MM(t)); }`);

fx("Material", "wood", "Carved Wood", "rings", "polish", `
vec3 fx(vec2 t){ vec3 n = N(t);
  float r = D(t)*(25.+uA*50.) + fbm(AS(t)*vec2(2.,12.))*2.;
  float ring = .5+.5*sin(r);
  vec3 alb = mix(vec3(.3,.15,.06), vec3(.72,.47,.25), ring*.8 + fbm(AS(t)*30.)*.2);
  vec3 l = vec3(-.6,-.6,.6);
  return mix(C(t)*.25, alb*(.18+lambert(n,l)*.95)*.8 + spec(n,l,30.)*uB*.6, MM(t)); }`);

fx("Material", "lava", "Lava Skin", "flow", "heat", `
vec3 fx(vec2 t){ vec3 n = N(t);
  vec3 v = voro(AS(t)*8. + n.xy + vec2(0., -uTime*.1*(1.+uA*3.)));
  float crack = smoothstep(.13, .0, v.y);
  float heat = crack*(.6+.4*sin(uTime*3.+v.z*10.)) + uBass*crack;
  vec3 crust = vec3(.06,.05,.05)*(.3+lambert(n,vec3(-.5,-.6,.6))*1.2);
  vec3 glow = mix(vec3(1.,.15,0.), vec3(1.,.85,.3), heat)*heat*(3.+uB*4.);
  float m = MM(t);
  float halo = mBlur(t,.03)*(1.-m);
  return mix(C(t)*.12, crust+glow, m) + vec3(1.,.25,0.)*halo*.35; }`);

fx("Material", "ice", "Frozen", "frost", "clarity", `
vec3 fx(vec2 t){ vec3 n = N(t);
  float f = pow(1.-max(n.z,0.), 2.); vec3 v = voro(AS(t)*25.);
  float frost = fbm(AS(t)*20.+n.xy)*.6*(.5+uA) + smoothstep(.05,.0,v.y)*.5*uA;
  vec3 l = vec3(-.4,-.7,.6);
  vec3 ice = (mix(vec3(.4,.62,.85), vec3(.85,.95,1.), f)*(.22+lambert(n,l)*.7) + frost*.25)*.55;
  ice = mix(ice, PL(t+n.xy*.04)*vec3(.7,.9,1.2), (.15+uB*.5)*(1.-f));
  ice += spec(n,l,120.)*2.;
  return mix(C(t)*vec3(.5,.6,.75)*.6, ice, MM(t)); }`);

fx("Material", "voxel", "Voxels", "size", "whole frame", `
vec3 fx(vec2 t){ float bs = mix(70.,16.,uA);
  vec2 cell = (floor(AS(t)*bs)+.5)/bs; vec2 ct = vec2(cell.x/uAspect, cell.y);
  vec3 nb = N(ct); vec3 cb = C(ct); float mb = MM(ct);
  vec2 f = fract(AS(t)*bs); float bev = smoothstep(0., .14, min(min(f.x,f.y), min(1.-f.x,1.-f.y)));
  float top = smoothstep(.14,.0,f.y)*.25 - smoothstep(.86,1.,f.y)*.2;
  vec3 vox = cb*(.45+lambert(nb,vec3(-.5,-.6,.6))*1.1)*(.7+.3*bev) + top*cb;
  return mix(C(t)*.3, vox, max(mb, uB)); }`);

fx("Material", "circuit", "Circuit Skin", "density", "pulse", `
vec3 fx(vec2 t){ vec3 n = N(t);
  vec2 p = AS(t)*(16.+uA*30.); vec2 id = floor(p), f = fract(p); float h = hash(id);
  float tr = h < .5 ? smoothstep(.08,.0,abs(f.x-.5)) : smoothstep(.08,.0,abs(f.y-.5));
  tr = max(tr, smoothstep(.2,.12,length(f-.5))*step(.8,h));
  float ph = fract(-uTime*(.4+uB*1.5) + (id.x+id.y)*.05 + h);
  float pulse = smoothstep(.0,.06,ph)*smoothstep(.25,.06,ph);
  vec3 base = vec3(.02,.1,.07)*(.3+lambert(n,vec3(-.5,-.6,.6)));
  return mix(C(t)*.2, base + vec3(.1,1.,.6)*tr*(.25+pulse*2.6+uBeat), MM(t)); }`);

fx("Material", "mosaic", "Mosaic", "tile size", "grout", `
vec3 fx(vec2 t){ float sc = mix(80.,20.,uA);
  vec4 v = voroC(AS(t)*sc); vec2 tc = vec2(v.x/sc/uAspect, v.y/sc);
  vec3 col = C(tc)*1.15*(.6+.6*lambert(N(tc),vec3(-.5,-.6,.6)));
  float g = smoothstep(.02, .06+uB*.1, v.z);
  return mix(vec3(.04), col, g) + spec(N(tc),vec3(-.5,-.6,.6),30.)*g*.25; }`);

fx("Material", "bubble", "Soap Film", "film", "clarity", `
vec3 fx(vec2 t){ vec3 n = N(t);
  float f = 1.-max(n.z,0.); float th = fbm(AS(t)*4.+uTime*.1)*2. + f*3.;
  vec3 irid = .5+.5*cos(TAU*(th*(1.+uA*2.) + vec3(0.,.33,.67)));
  vec3 bub = PL(t+n.xy*.05)*mix(.35,.9,uB) + irid*(.2+f*1.3) + spec(n,vec3(-.5,-.6,1.),90.)*2.;
  return mix(C(t), bub, MM(t)); }`);

fx("Material", "lowpoly", "Low Poly", "facets", "outline", `
vec3 fx(vec2 t){ float sc = mix(45.,10.,uA);
  vec2 p = AS(t)*sc; vec2 q = vec2(p.x - p.y*.57735, p.y*1.1547);
  vec2 id = floor(q), f = fract(q); float up = step(f.x+f.y, 1.);
  vec2 cen = id + (up > .5 ? vec2(1./3.) : vec2(2./3.));
  vec2 pc = vec2(cen.x + cen.y*.5, cen.y*.866)/sc; vec2 tc = vec2(pc.x/uAspect, pc.y);
  vec3 col = CN(tc)*(.5+1.3*lambert(N(tc),vec3(-.5,-.7,.6)));
  float e = min(min(f.x,f.y), abs(1.-f.x-f.y));
  col *= 1. - smoothstep(.04,.0,e)*uB*.7;
  return mix(C(t)*.4, col, MM(tc)); }`);

fx("Material", "foil", "Holo Foil", "bands", "sparkle", `
vec3 fx(vec2 t){ vec3 n = N(t);
  float h = dot(n.xy, vec2(.8,.6))*2. + t.x*1.5 + t.y + uTime*.1;
  vec3 foil = rainbow(h*(1.+uA*2.))*(.5+.8*(1.-n.z));
  float sp = pow(hash(floor(AS(t)*300.)+floor(uTime*10.)), 60.)*3.*uB*2.;
  return mix(C(t)*.4, foil*(.45+lum(C(t))*1.6) + sp, MM(t)); }`);

fx("Material", "wire", "Neon Wireframe", "mesh", "ghost", `
vec3 fx(vec2 t){ vec3 n = N(t); float d = D(t);
  vec2 v = n.xy*(5.+uA*10.) + vec2(d*6.);
  vec2 g = abs(fract(v-.5)-.5)/max(fwidth(v), vec2(1e-4));
  float line = 1. - min(min(g.x,g.y), 1.);
  return vec3(0.,.9,1.)*line*2.2*MM(t) + vec3(1.,.2,.8)*edgeN(t,1.5)*1.6 + C(t)*(.03+uB*.3); }`);

fx("Material", "golem", "Stone Golem", "rocks", "runes", `
vec3 fx(vec2 t){ vec3 n = N(t);
  vec3 v = voro(AS(t)*(6.+uA*10.) + n.xy*.3); float crack = smoothstep(.06,.0,v.y);
  float r1 = fbm(AS(t)*40.), r2 = fbm(AS(t)*40.+7.);
  vec3 nb = normalize(n + vec3(r1-.5, r2-.5, 0.)*.8);
  vec3 alb = mix(vec3(.24,.23,.21), vec3(.5,.48,.44), v.z)*(.7+r1*.5);
  vec3 col = alb*(.15+lambert(nb,vec3(-.5,-.7,.6))*1.)*(1.-crack*.8)*.8;
  col += vec3(.2,.8,1.)*crack*uB*3.*(.6+.4*sin(uTime*2.+v.z*6.)+uBeat);
  return mix(C(t)*.25, col, MM(t)); }`);

fx("Material", "plasma", "Plasma Body", "speed", "room", `
vec3 fx(vec2 t){ vec3 n = N(t); vec2 p = AS(t)*4.; float tt = uTime*(.5+uA*2.);
  float v = sin(p.x*2.+tt) + sin(p.y*2.3-tt*1.3) + sin((p.x+p.y)*1.7+tt*.7) + sin(length(p-1.)*4.-tt*2.);
  vec3 pl = rainbow(v*.25 + tt*.05 + D(t)*.5)*1.4;
  vec3 body = pl*(.4+.8*lambert(n,vec3(-.4,-.6,.7))) + pow(1.-n.z,2.)*pl*1.5;
  return mix(C(t)*(.1+uB*.5), body, MM(t)); }`);

fx("Material", "galaxy", "Galaxy Body", "parallax", "room", `
vec3 fx(vec2 t){ vec3 n = N(t); vec2 p = AS(t) + n.xy*.05*(1.+uA*4.);
  vec3 neb = vec3(.3,.08,.5)*pow(fbm(p*3.+uTime*.02),2.5)*3. + vec3(.05,.25,.6)*pow(fbm(p*2.-4.),3.)*3.;
  float st = 0.;
  for(int l=0;l<3;l++){ vec2 g = p*(60.+float(l)*50.)+float(l)*7.; vec2 f = fract(g)-.5; float h = hash(floor(g));
    st += step(.93,h)*smoothstep(.15,0.,length(f))*(.5+.5*sin(uTime*3.+h*50.)); }
  vec3 gal = neb + vec3(st)*2. + vec3(.5,.7,1.)*pow(1.-n.z,3.)*1.2;
  return mix(C(t)*(.15+uB*.8), gal, MM(t)); }`);

fx("Material", "waterbody", "Water Body", "ripple", "tint", `
vec3 fx(vec2 t){ vec3 n = N(t);
  vec2 off = n.xy*.08 + vec2(sin(t.y*30.+uTime*3.), cos(t.x*30.+uTime*2.))*.003*(1.+uA*3.);
  vec3 r = PL(t+off)*mix(vec3(1.), vec3(.55,.85,1.), .4+uB*.6);
  float k = pow(.5+.5*sin(AS(t).x*20.+sin(AS(t).y*15.+uTime*2.)*2.), 8.);
  vec3 w = r + vec3(.6,.9,1.)*pow(1.-n.z,3.)*.8 + k*.25 + spec(n,vec3(-.5,-.7,1.),100.)*2.;
  return mix(C(t), w, MM(t)); }`);

fx("Material", "smoke", "Smoke Form", "wisps", "density", `
vec3 fx(vec2 t){ vec3 n = N(t);
  vec2 p = AS(t)*3.; p.y += uTime*.4;
  float f = fbm(p + fbm(p*1.5+uTime*.2)*1.5);
  float mb = mBlur(t, .02+uA*.06);
  float dens = smoothstep(.15, .9, mb*(.55+f*.9)*(.7+uB*.6));
  vec3 smoke = mix(vec3(.03,.03,.04), vec3(.4,.42,.47), f)*dens*(.35+lambert(n,vec3(-.4,-.7,.6))*.6);
  return C(t)*.1*(1.-dens) + smoke; }`);

fx("Material", "firebody", "Burning Man", "height", "body glow", `
vec3 fx(vec2 t){
  float f = fbm(AS(t)*vec2(4.,3.) + vec2(0., uTime*1.6));
  float mb = 0.;
  for(int i=1;i<=7;i++) mb = max(mb, M(t + vec2(0., float(i)*.016*(1.+uA*1.5)))*(1.-float(i)/8.));
  float fire = smoothstep(.15, .95, mb*f*1.45);
  vec3 fc = mix(vec3(.9,.08,0.), vec3(1.,.85,.4), fire)*fire*1.6;
  float m = MM(t);
  vec3 body = C(t)*vec3(1.,.55,.35)*(.4+uB*.8) + vec3(1.,.3,0.)*pow(1.-max(N(t).z,0.),2.)*.5;
  return C(t)*.08*(1.-m) + body*m + fc*(1.-m*.5); }`);

fx("Material", "glitter", "Glitter Skin", "sparkle", "colour", `
vec3 fx(vec2 t){ vec3 n = N(t);
  vec2 g = floor(AS(t)*420.); float h = hash(g);
  vec3 rn = normalize(n + (vec3(hash(g+1.), hash(g+2.), .5)-.5)*1.3);
  float sp = pow(max(dot(rn, normalize(vec3(sin(uTime*.9), -.6, .8))), 0.), 60.)*step(.5,h)*(4.+uA*8.);
  return mix(C(t), C(t)*.85 + hsv(h,uB,1.)*sp, MM(t)); }`);

fx("Material", "sumi", "Sumi-e Ink", "ink", "keep room", `
vec3 fx(vec2 t){ float l = lum(C(t)); float d = D(t);
  float wash = smoothstep(.12, .7, l)*.8 + d*.2;
  vec3 paper = vec3(.93,.9,.84)*(.9+.1*fbm(AS(t)*20.));
  float ink = edgeN(t,1.5)*.9 + edgeL(t,1.)*.8;
  vec3 col = paper*mix(.22, 1., wash);
  col = mix(col, vec3(.04,.04,.05), clamp(ink*(.6+uA),0.,1.));
  col = mix(col, paper, (1.-MM(t))*.65*(1.-uB));
  vec2 s = abs(AS(t) - vec2(.88*uAspect, .16)); float seal = step(max(s.x,s.y), .035) - step(max(s.x,s.y), .026)*.0;
  return mix(col, vec3(.7,.1,.08), seal*(.75+.25*fbm(AS(t)*90.))); }`);

fx("Material", "chocolate", "Chocolate", "gloss", "milk", `
vec3 fx(vec2 t){ vec3 n = N(t); vec3 l = vec3(-.5,-.7,.6);
  vec3 alb = mix(vec3(.12,.05,.02), vec3(.35,.18,.08), uB);
  vec3 ch = alb*(.3+lambert(n,l)*1.2) + spec(n,l,40.+uA*120.)*1.5 + spec(n,vec3(.7,-.2,.6),20.)*.2;
  return mix(C(t)*.3, ch, MM(t)); }`);

fx("Material", "chrome2", "Mirror Ball Body", "facets", "env", `
vec3 fx(vec2 t){ float sc = mix(70.,25.,uA);
  vec2 cell = (floor(AS(t)*sc)+.5)/sc; vec2 ct = vec2(cell.x/uAspect, cell.y);
  vec3 n = N(ct); vec3 r = reflect(vec3(0.,0.,-1.), n);
  vec3 env = C(fract(vec2(.5,.5) - r.xy*.45 + uTime*vec2(.02,0.)))*1.6;
  env = mix(env, rainbow(r.x+r.y+uTime*.1), uB*.4);
  vec2 f = fract(AS(t)*sc); float gap = smoothstep(.0,.08,min(min(f.x,f.y),min(1.-f.x,1.-f.y)));
  return mix(C(t)*.3, env*gap*(.6+.6*pow(hash(cell*sc+floor(uTime*4.)),8.)), MM(ct)); }`);

fx("Material", "pearl", "Pearlescent", "shift", "luster", `
vec3 fx(vec2 t){ vec3 n = N(t); vec3 l = vec3(-.4,-.6,.7);
  float f = 1.-max(n.z,0.);
  vec3 base = vec3(.7,.68,.67)*(.15+lambert(n,l)*.55);
  vec3 sheen = pal(f*1.5+n.x*.3+uA, vec3(.6), vec3(.25), vec3(1.), vec3(.1,.35,.6));
  return mix(C(t)*.3, base*mix(vec3(1.),sheen,.6) + spec(n,l,60.)*(.6+uB*1.5), MM(t)); }`);

fx("Material", "thermal2", "FLIR Iron", "gain", "edges", `
vec3 fx(vec2 t){ float heat = clamp(lum(C(t))*(.4+uA) + MM(t)*.45 + D(t)*.2 + (1.-max(N(t).z,0.))*-.15*MM(t), 0., 1.);
  vec3 iron = heat < .25 ? mix(vec3(0.,0.,.05), vec3(.2,0.,.45), heat*4.) : heat < .5 ? mix(vec3(.2,0.,.45), vec3(.85,.1,.3), (heat-.25)*4.) :
              heat < .75 ? mix(vec3(.85,.1,.3), vec3(1.,.6,0.), (heat-.5)*4.) : mix(vec3(1.,.6,0.), vec3(1.,1.,.85), (heat-.75)*4.);
  return toLin(iron)*1.2 + vec3(1.)*edgeN(t,1.2)*uB*.6; }`);
