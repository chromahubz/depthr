// ART II: more Mondrian variations and other art movements.   (needs ART_LIB from fx_styles.js)
"use strict";

fx("Art", "art_mondiamond", "Mondrian Diamond", "splits", "shuffle", `${ART_LIB}
vec3 fx(vec2 t){ vec2 q = rot(.7854)*((t-.5)*vec2(uAspect,1.)); vec2 u = q/.9 + .5;
  if(any(lessThan(u, vec2(0.))) || any(greaterThan(u, vec2(1.)))) return toLin(vec3(.16,.16,.17)*(.9+.1*noise(AS(t)*200.)));
  vec2 lo, hi; vec4 b = bsp(u, floor(uTime*uB*1.5)+3., 3.+uA*4., lo, hi);
  vec2 ct = (rot(-.7854)*((b.zw-.5)*.9))/vec2(uAspect,1.) + .5;
  vec3 c = mix(CREAM, mPal(b.x), step(.4, MM(ct)*.6 + MM(t)*.4));
  float fr = min(min(u.x,1.-u.x), min(u.y,1.-u.y));
  return toLin(mix(c, vec3(.03), max(smoothstep(.009,.006,b.y), step(fr, .012)))); }`);

fx("Art", "art_mondneon", "Mondrian Neon", "splits", "shuffle", `${ART_LIB}
vec3 fx(vec2 t){ vec2 lo, hi; vec4 b = bsp(t, floor(uTime*uB*1.5), 3.+uA*4., lo, hi);
  float on = MM(b.zw)*.6 + MM(t)*.4;
  vec3 nc = b.x > .9 ? vec3(.9,.95,1.) : mPal(b.x);
  vec3 lc = hsv(.55 + .4*hash(vec2(b.x,2.)), .7, 1.);
  return toLin(nc)*on*.35*(1.+uBeat) + lc*(exp(-b.y*120.)*1.2 + exp(-b.y*25.)*.3)*(.8+uBass) + C(t)*.05; }`);

fx("Art", "art_mondglitch", "Mondrian Glitch", "splits", "glitch", `${ART_LIB}
vec3 fx(vec2 t){ float seed = floor(uTime*(1.+uB*6.)) + uBeatN; vec2 lo, hi; vec4 b = bsp(t, seed, 3.+uA*4., lo, hi);
  vec2 off = (hash2(vec2(b.x, seed))-.5)*.08*(1.+uBeat*2.);
  float h = hash(vec2(b.x,5.));
  vec3 tint = h < .3 ? vec3(1.,.25,.2) : h < .55 ? vec3(.3,.45,1.) : h < .75 ? vec3(1.,.9,.3) : vec3(1.);
  return mix(CN(t+off)*tint, vec3(0.), smoothstep(.006,.004,b.y)); }`);

fx("Art", "art_mondglass", "Mondrian Glass", "splits", "shuffle", `${ART_LIB}
vec3 fx(vec2 t){ vec2 lo, hi; vec4 b = bsp(t, 7.+floor(uTime*uB), 4.+uA*3., lo, hi);
  vec3 g = b.x > .9 ? vec3(.8,.85,.9) : toLin(mPal(b.x));
  vec3 c = CN(t)*g*2.2 + g*.08 + g*MM(t)*.15;
  return mix(c, vec3(.02), smoothstep(.007,.004,b.y)); }`);

fx("Art", "art_mondpulse", "Mondrian Pulse", "splits", "flash", `${ART_LIB}
vec3 fx(vec2 t){ vec2 lo, hi; vec4 b = bsp(t, 11., 3.+uA*4., lo, hi);
  float flash = step(fract((uBeatN + floor(uTime*2.))*.37 + hash(vec2(b.x,8.))), .15+uB*.4);
  float on = step(.4, MM(b.zw)*.6 + MM(t)*.4);
  vec3 c = mix(CREAM, mPal(b.x), max(on, flash*(.6+.4*uBeat)));
  return toLin(mix(c, vec3(.03), smoothstep(.008,.005,b.y))); }`);

fx("Art", "art_monddepth", "Mondrian Relief", "splits", "shuffle", `${ART_LIB}
vec3 fx(vec2 t){ vec2 lo, hi; vec4 b = bsp(t, 5.+floor(uTime*uB), 4.+uA*3., lo, hi);
  float m = MM(b.zw), d = D(b.zw);
  vec3 c = mix(CREAM*.8, mPal(b.x), m)*(.55 + .7*d*m + .35*(1.-m));
  vec2 f = (t-lo)/max(hi-lo, 1e-4);
  c *= .75 + .25*smoothstep(0., .08, min(f.x, f.y)) + .15*smoothstep(.92, 1., max(f.x, f.y))*0.;
  return toLin(mix(c, vec3(.03), smoothstep(.007,.004,b.y))); }`);

fx("Art", "art_mondlines", "Mondrian Lines", "density", "shuffle", `${ART_LIB}
vec3 fx(vec2 t){ float l = clamp(lum(blurS(t,.02))*EXPO*1.5, 0., 1.);
  vec2 lo, hi; vec4 b = bsp(t, 21.+floor(uTime*uB), 2. + (1.-l)*(3.+uA*3.) + MM(t)*1.5, lo, hi);
  float h = hash(vec2(b.x,4.)); vec3 lc = h < .15 ? MRED : h < .25 ? MBLUE : vec3(.03);
  return toLin(mix(CREAM, lc, smoothstep(.005,.003,b.y))); }`);

fx("Art", "art_doesburg", "Counter-Composition", "grid", "shuffle", `${ART_LIB}
vec3 fx(vec2 t){ vec2 o = vec2(uAspect*.5,.5); float sc = mix(4.,9.,uA);
  vec2 g = rot(.7854)*(AS(t)-o)*sc; vec2 id = floor(g), f = fract(g);
  vec2 cc = rot(-.7854)*((id+.5)/sc) + o; vec2 tc = vec2(cc.x/uAspect, cc.y);
  float h = hash(id + floor(uBeatN*.25)*step(.01,uB) + floor(uTime*uB*.5));
  vec3 c = MM(tc) > .5 ? mPal(h) : (h > .85 ? vec3(.8,.79,.75) : CREAM);
  return toLin(mix(c, vec3(.03), step(min(min(f.x,1.-f.x), min(f.y,1.-f.y)), .05))); }`);

fx("Art", "art_cubism", "Cubist Facets", "facets", "shift", `
vec3 fx(vec2 t){ float sc = mix(5.,12.,uA); vec4 v = voroC(AS(t)*sc);
  float h1 = hash(vec2(v.w,1.)), h2 = hash(vec2(v.w,2.));
  vec2 ctr = vec2(v.x/sc/uAspect, v.y/sc);
  vec2 q = ctr + (rot((h1-.5)*uB*1.2)*((t-ctr)*vec2(uAspect,1.)))/vec2(uAspect,1.)*(.85+.3*h2);
  vec3 c = clamp(toSrgb(CN(q)), 0., 1.);
  c = mix(mix(vec3(.35,.3,.22), vec3(.85,.75,.55), lum(c)), c, .35)*(.8+.4*h2);
  c *= .7 + .3*smoothstep(0., .08, v.z);
  return toLin(c); }`);

fx("Art", "art_futurism", "Futurism", "trail", "speed", `
vec3 fx(vec2 t){ vec3 col = PV(t + vec2(.004*(1.+uB*3.), 0.))*mix(.85,.97,uA);
  vec3 cur = clamp(toSrgb(CN(t)), 0., 1.);
  col = max(col, toLin(mix(vec3(.15,.12,.1), vec3(.95,.6,.2), lum(cur)))*MM(t));
  keep(col);
  vec3 bg = toLin(vec3(.9,.86,.76))*(1.-.35*fbm(AS(t)*30.));
  return mix(bg, col + toLin(vec3(.2,.3,.6))*lum(col)*.3, clamp(lum(col)*3., 0., 1.)); }`);

fx("Art", "art_haring", "Street Pop", "hue", "rays", `
vec3 fx(vec2 t){ float mb = mBlur(t, .01), fill = step(.5, M(t)), ol = step(.12, mb)*step(mb, .88);
  vec2 p = (t-uBody.xy)*vec2(uAspect,1.); float a = atan(p.y,p.x), r = length(p);
  float near = step(.02, mBlur(t, .07))*(1.-fill);
  float rays = step(.82, fract(a/TAU*22.))*step(.55, fract(r*5. - uTime*(.4+uB*2.) - uBeatN*.25))*near;
  vec3 c = mix(hsv(uA,.8,.95), hsv(uA+.5,.85,.95), fill);
  return toLin(mix(c, vec3(.03), max(ol, rays))); }`);

fx("Art", "art_klimt", "Golden Mosaic", "tiles", "shimmer", `
vec3 fx(vec2 t){ vec2 p = AS(t)*mix(20.,45.,uA); vec2 id = floor(p), f = fract(p)-.5; float h = hash(id);
  vec3 gold = vec3(.85,.65,.2); float pat; float r = length(f);
  if(h < .4) pat = step(.5, fract(r*6. - atan(f.y,f.x)/TAU))*step(r, .45);
  else if(h < .7) pat = step(max(abs(f.x),abs(f.y)), .3) - step(max(abs(f.x),abs(f.y)), .18);
  else pat = step(r, .25);
  vec3 tile = mix(gold*(.7+.4*hash(id+1.)), h < .4 ? vec3(.1,.08,.05) : h < .7 ? vec3(.15,.25,.6) : vec3(.7,.15,.1), pat*.85);
  tile *= 1. + .25*sin(uTime*2. + h*20.)*uB;
  vec3 bg = mix(vec3(.25,.2,.08), gold*.6, fbm(AS(t)*12.));
  float m = MM(t), face = smoothstep(.12, .05, aDist(t, uBody.zw));
  vec3 c = mix(bg, tile, m);
  c = mix(c, clamp(toSrgb(CN(t)),0.,1.)*vec3(1.,.92,.8), face*m);
  return toLin(c); }`);

fx("Art", "art_vangogh", "Swirl Brush", "swirl", "flow", `
vec3 fx(vec2 t){ vec2 p = AS(t); float sc = mix(3.,7.,uA), tm = uTime*.2*uB, e = .01;
  float n0 = fbm(p*sc + tm);
  vec2 gr = vec2(fbm(p*sc+vec2(e,0.)+tm)-n0, fbm(p*sc+vec2(0.,e)+tm)-n0)/e;
  vec2 dir = normalize(vec2(-gr.y, gr.x) + 1e-5);
  float stroke = noise(vec2(dot(p,dir)*40., dot(p,vec2(-dir.y,dir.x))*260.));
  vec3 cam = clamp(toSrgb(CN(t + dir*.004)), 0., 1.); cam = clamp(mix(vec3(lum(cam)), cam, 1.6), 0., 1.);
  vec3 sky = mix(vec3(.08,.15,.45), vec3(.35,.55,.85), n0) + vec3(.95,.85,.3)*smoothstep(.62,.7,n0);
  vec3 c = mix(sky, cam, MM(t))*(.75 + .5*stroke);
  return toLin(clamp(c, 0., 1.)); }`);

fx("Art", "art_ukiyoe", "Woodblock Print", "waves", "drift", `
vec3 fx(vec2 t){ float m = MM(t), l = LN(t);
  vec3 paper = vec3(.93,.87,.74);
  vec3 fig = l < .25 ? vec3(.1,.12,.2) : l < .5 ? vec3(.18,.3,.5) : l < .75 ? vec3(.75,.35,.25) : vec3(.95,.88,.75);
  vec2 g = AS(t)*mix(10.,20.,uA) + vec2(uTime*.2*uB, 0.);
  vec2 g2 = vec2(g.x + .5*mod(floor(g.y*2.),2.), g.y*2.); vec2 f2 = fract(g2) - vec2(.5,1.);
  float r = length(f2*vec2(1.,.5));
  vec3 bg = mix(paper, vec3(.2,.32,.55), step(.5, fract(r*5.))*step(r,.5)*.8);
  vec3 c = mix(bg, fig, m);
  c = mix(c, vec3(.05), max(edgeN(t,1.5), edgeL(t,1.2))*m);
  return toLin(c*(.95 + .05*noise(AS(t)*400.))); }`);

fx("Art", "art_vasarely", "Vasarely Bulge", "cells", "colour", `
vec3 fx(vec2 t){ float mb = mBlur(t, .05);
  vec2 g = (AS(t) - AS(uBody.xy))*(1. - mb*.45*(1.+uBass))*mix(12.,30.,uA);
  vec2 f = fract(g)-.5; float chk = mod(floor(g.x)+floor(g.y), 2.);
  float inner = step(length(f), .25 + .2*mb);
  vec3 a = mix(vec3(.05), vec3(.95), chk), b = mix(vec3(.95), vec3(.05), chk);
  vec3 col = mix(a, b, inner);
  vec3 colr = mix(hsv(.6+uTime*.02,.8,.9), hsv(uTime*.02,.8,.9), chk);
  return toLin(mix(col, mix(colr, b, inner), uB)); }`);

fx("Art", "art_constructivist", "Constructivist", "rays", "spin", `
vec3 fx(vec2 t){ vec2 p = (t-uBody.xy)*vec2(uAspect,1.); float a = atan(p.y,p.x);
  vec3 bg = mix(vec3(.92,.85,.7), vec3(.75,.1,.08), step(.5, fract(a/TAU*mix(8.,20.,uA) + uTime*.12*uB)));
  bg = mix(bg, vec3(.05), step(abs(dot(AS(t)-vec2(uAspect*.5,.5), normalize(vec2(1.,-.6)))), .06));
  float l = LN(t); vec2 hp = rot(.6)*AS(t)*90.;
  vec3 fig = mix(vec3(.92,.85,.7), vec3(.05), step(length(fract(hp)-.5), (1.-l)*.6));
  return toLin(mix(bg, fig, MM(t))); }`);

fx("Art", "art_memphis", "Memphis 80s", "shapes", "spin", `
vec3 fx(vec2 t){ vec2 p = AS(t)*mix(5.,10.,uA); vec2 id = floor(p), f = fract(p)-.5; float h = hash(id), h2 = hash(id+3.);
  vec3 P[5] = vec3[](vec3(1.,.45,.6), vec3(.25,.75,.85), vec3(1.,.82,.2), vec3(.1), vec3(.55,.4,.85));
  vec3 bg = vec3(.98,.92,.85);
  f = rot(h*6.28 + uTime*uB)*f; float sh = 0.;
  if(h < .25) sh = step(abs(f.y - .08*sin(f.x*25.)), .03)*step(abs(f.x), .35);
  else if(h < .45) sh = step(-f.y, .2)*step(abs(f.x)*1.73 + f.y, .2);
  else if(h < .6) sh = step(abs(length(f)-.2), .04);
  else if(h < .75) sh = step(length(fract(f*6.)-.5), .2)*step(max(abs(f.x),abs(f.y)), .3);
  vec3 c = mix(bg, P[min(int(h2*5.),4)], sh);
  float l = LN(t), st = step(.5, fract((AS(t).x*.7 + AS(t).y)*40.));
  vec3 fig = l < .4 ? mix(vec3(.08), bg, st) : l < .7 ? P[1] : P[2];
  return toLin(mix(c, fig, MM(t))); }`);

fx("Art", "art_swiss", "Swiss Poster", "lines", "ink", `
vec3 fx(vec2 t){ vec2 p = AS(t); vec3 c = vec3(.95,.94,.92);
  c = mix(c, vec3(.85,.1,.1), step(length(p - vec2(uAspect*(.7+.08*sin(uTime*.3)), .45)), .3 + uBass*.03));
  c = mix(c, vec3(.05), max(step(abs(p.x-uAspect*.18), .015), step(abs(p.y-.82), .01)));
  float ln = step(fract(p.y*mix(60.,140.,uA)), 1.-LN(t));
  vec3 fig = mix(vec3(.95,.94,.92), uB > .5 ? vec3(.05) : vec3(.1,.2,.6), ln);
  return toLin(mix(c, fig, MM(t))); }`);

fx("Art", "art_deco", "Art Deco", "fans", "shimmer", `
vec3 fx(vec2 t){ vec2 p = AS(t); float sc = mix(4.,9.,uA);
  vec2 g = vec2(p.x*sc, p.y*sc*1.2); g.x += .5*mod(floor(g.y), 2.); vec2 id = floor(g), f = fract(g) - vec2(.5,1.);
  float r = length(f), a = atan(f.x, -f.y);
  float fan = clamp(step(.9, fract(a/PI*8. + .5)) + step(.88, fract(r*6.)), 0., 1.)*step(r, .55);
  vec3 gold = toLin(vec3(.85,.68,.3));
  vec3 col = vec3(.002,.003,.004) + gold*fan*(.6 + .4*sin(uTime*2. + id.x + id.y)*uB);
  vec3 fig = vec3(.003) + gold*edgeN(t,1.5)*1.5 + gold*.25*lum(CN(t));
  return mix(col, fig, MM(t)); }`);

fx("Art", "art_psych", "Psychedelic Poster", "bands", "flow", `
vec3 fx(vec2 t){ vec2 p = AS(t) - AS(uBody.xy); float r = length(p);
  float v = r*mix(6.,16.,uA) + fbm(p*3.+uTime*.2)*1.8 - uTime*(.5+uB*2.) - uBass;
  vec3 c = pal(v*.15, vec3(.5), vec3(.5), vec3(1.), vec3(0.,.33,.67));
  c = mix(c, 1.-c, step(.5, fract(v))*.5);
  vec3 fig = pal(LN(t)*1.2 + uTime*.1, vec3(.5), vec3(.5), vec3(1.,1.,.5), vec3(.8,.9,.3));
  return toLin(mix(c, fig, MM(t))); }`);

fx("Art", "art_mosaic", "Roman Mosaic", "tiles", "offset", `
vec3 fx(vec2 t){ float sc = mix(110.,45.,uA); vec2 p = AS(t)*sc; float sh = .5*uB;
  p.x += sh*mod(floor(p.y), 2.); vec2 id = floor(p), f = fract(p);
  vec2 cc = (id + .5 + (hash2(id)-.5)*.12); cc.x -= sh*mod(id.y, 2.); vec2 tc = vec2(cc.x/sc/uAspect, cc.y/sc);
  vec3 c = floor(clamp(toSrgb(CN(tc)),0.,1.)*5. + .5)/5.*(.9 + .2*hash(id+2.));
  float gr = step(min(min(f.x,1.-f.x), min(f.y,1.-f.y)), .09 + .04*hash(id+4.));
  return toLin(mix(c, vec3(.6,.57,.5), gr)); }`);

fx("Art", "art_hardedge", "Hard Edge", "hue", "beat", `
vec3 fx(vec2 t){ float hb = uA + floor(uBeatN*.25)*.17*step(.01,uB) + uTime*.01;
  vec2 p = AS(t) - vec2(uAspect*.5,.5);
  float side = step(0., p.x*cos(uTime*.1) + p.y*sin(uTime*.1) + .12*sin(p.y*3.));
  vec3 bg = mix(hsv(hb,.85,.9), hsv(hb+.33,.85,.85), side);
  vec3 fig = mix(hsv(hb+.6,.9,.35), hsv(hb+.15,.9,.95), side);
  return toLin(mix(bg, fig, step(.5, mBlur(t, .004)))); }`);

fx("Art", "art_albers", "Homage Squares", "hue", "spread", `
vec3 fx(vec2 t){ float hb = uA + uTime*.005; float lv = 0.;
  for(int i=0;i<4;i++){ float s = .48 - float(i)*.11; vec2 d = abs(AS(t) - vec2(.5*uAspect, .5 + float(i)*.03)); if(max(d.x,d.y) < s) lv = float(i+1); }
  float hh = hb + lv*.04*(1.+uB*3.);
  vec3 col = hsv(hh, .55 + .1*lv, .35 + .15*lv);
  col = mix(col, hsv(hh + .5, .5, .3 + .15*lv), MM(t)*.6);
  return toLin(col*(.97 + .03*noise(AS(t)*300.))); }`);

fx("Art", "art_rileywave", "Riley Waves", "lines", "wave", `
vec3 fx(vec2 t){ vec2 p = AS(t); float mb = mBlur(t, .03); float f = mix(30.,90.,uA);
  float w = p.y + sin(p.x*12. + uTime*(.5+uB*2.))*.02*(1.+mb*3.) + mb*.04;
  int k = int(mod(floor(w*f), 3.) + .5);
  vec3 lc = k == 0 ? vec3(.85,.2,.15) : k == 1 ? vec3(.15,.55,.6) : vec3(.92,.75,.2);
  return toLin(mix(vec3(.95,.93,.88), lc, step(fract(w*f), .45))); }`);

fx("Art", "art_collage", "Paper Collage", "hue", "ink", `
vec3 fx(vec2 t){ vec2 p = AS(t); vec3 c = vec3(.9,.86,.78);
  for(int i=0;i<5;i++){ float fi = float(i);
    vec2 q = rot((hash(vec2(fi,2.))-.5)*.6)*(p - vec2(uAspect*.5, hash(vec2(fi,1.))));
    float band = step(abs(q.y + (fbm(vec2(p.x*8.+fi*7., fi))-.5)*.08), .06 + .08*hash(vec2(fi,3.)));
    c = mix(c, hsv(hash(vec2(fi,4.)) + uA, .55, .85)*(.9 + .1*noise(p*200.)), band); }
  float paper = step(.5, mBlur(t, .012) + noise(p*60.)*.25 - .1);
  vec3 news = mix(vec3(.9,.88,.83), hsv(uB,.6,.25), step(fract(p.y*120.), 1.-LN(t)));
  c = mix(c, vec3(.97), paper); c = mix(c, news, step(.5, M(t)));
  return toLin(c); }`);

fx("Art", "art_pollock", "Drip Painting", "splats", "colour", `
vec3 fx(vec2 t){ vec3 cv = PV(t);
  if(lum(cv) < .0005) cv = toLin(vec3(.92,.89,.8));
  float ed = 1. - smoothstep(0., .2, abs(M(t)-.5));
  float tk = floor(uTime*8.); vec2 p = AS(t);
  float sp = step(.78 - uBeat*.2, noise(p*mix(20.,60.,uA) + tk*13.1))*ed;
  float ln = step(.9, noise(vec2(p.x*30.+tk, p.y*30.-tk)))*ed;
  vec3 col = toLin(hsv(hash(vec2(tk,1.)), uB > .5 ? .8 : .1, hash(vec2(tk,2.)) < .4 ? .08 : .9));
  cv = mix(cv, col, max(sp, ln)*.9);
  keep(cv);
  return mix(cv, C(t), MM(t)*.25); }`);
