// SPY TITLES II: more spy-film title, gadget and casino looks.
"use strict";

fx("Spy Titles", "spy_barreldots", "Opening Dots", "iris", "pace", `
vec3 fx(vec2 t){ float ph = fract(uTime/mix(8.,3.,uB));
  vec2 c = uBody.xy; vec2 p = (t-c)*vec2(uAspect,1.); vec3 col = vec3(0.);
  float dx = (ph/.45)*(uAspect+.4) - .2 - c.x*uAspect;
  for(int i=0;i<6;i++) col += vec3(1.)*smoothstep(.045,.04,length(p - vec2(dx - float(i)*.18, 0.)))*step(ph,.45);
  float R = max(smoothstep(.45,.6,ph)*mix(.25,.42,uA), 1e-3), r = length(p);
  vec3 inside = mix(vec3(.92), vec3(lum(C(t)))*1.4, MM(t));
  float groove = .55 + .45*smoothstep(-.3,.3, sin(atan(p.y,p.x)*8. + log(max(r/R,1e-3))*6. - uTime*1.2));
  vec3 wall = vec3(.6)*groove*pow(R/max(r,R), 1.6)*step(.46,ph);
  return max(col, mix(wall, inside, step(r,R))); }`);

fx("Spy Titles", "spy_iriswipe", "Red Iris", "iris", "pulse", `
vec3 fx(vec2 t){ vec2 p = (t-uBody.xy)*vec2(uAspect,1.); float r = length(p);
  float R = mix(.15,.5,uA)*(1. - uBeat*.3*uB);
  vec3 inside = mix(vec3(.95,.93,.9), vec3(.02), MM(t));
  vec3 col = mix(inside, vec3(.6,.02,.02)*(.6+.4*fbm(AS(t)*3.+uTime*.2)), smoothstep(R, R+.004, r));
  return mix(col, vec3(0.), exp(-pow((r-R)*200., 2.))); }`);

fx("Spy Titles", "spy_projgold", "Projected Gold", "lines", "speed", `
vec3 fx(vec2 t){ vec3 n = N(t); float m = MM(t);
  float v = t.y*mix(30.,80.,uA) + n.y*4. + D(t)*6. + uTime*(1.+uB*3.);
  vec3 gold = toLin(vec3(.95,.75,.3));
  float ln = smoothstep(.3, 0., abs(fract(v)-.5));
  return mix(gold*.02, gold*ln*(.4+.8*max(n.z,0.)) + C(t)*.15*vec3(1.,.8,.5), m); }`);

fx("Spy Titles", "spy_kaleido", "Kaleido Titles", "mirrors", "spin", `
vec3 fx(vec2 t){ vec2 p = (t-.5)*vec2(uAspect,1.); float r = length(p), a = atan(p.y,p.x);
  float seg = TAU/floor(mix(4.,12.,uA)); a = mod(a + uTime*.3*uB, seg); a = abs(a - seg*.5);
  vec2 q = vec2(cos(a), sin(a))*r*1.2; vec2 tq = uBody.xy + vec2(q.x/uAspect, q.y);
  vec3 bg = pal(r*2. - uTime*.2 + a, vec3(.5), vec3(.5), vec3(1.), vec3(0.,.1,.2)); bg *= bg;
  return mix(bg, vec3(.01) + bg*.15, MM(tq)); }`);

fx("Spy Titles", "spy_inkwater", "Ink in Water", "linger", "hue", `
vec3 fx(vec2 t){ vec2 p = AS(t);
  vec2 fl = vec2(fbm(p*3.+uTime*.2)-.5, fbm(p*3.+5.-uTime*.2)-.5)*.006 + vec2(0.,.0015);
  vec3 ink = PV(t+fl)*mix(.97,.995,uA);
  float ed = 1. - smoothstep(0., .3, abs(M(t)-.5));
  ink = max(ink, hsv(uB + .15*sin(uTime*.3) + t.x*.2, .9, 1.)*ed*.6*(1.+uBeat));
  keep(ink);
  return mix(ink*1.3, vec3(.003), MM(t)); }`);

fx("Spy Titles", "spy_cctv", "CCTV", "noise", "box", `
vec3 fx(vec2 t){ vec3 c = C(t + vec2((hash(vec2(floor(t.y*240.), floor(uTime*20.)))-.5)*.002*uA, 0.));
  vec3 col = vec3(lum(c)*EXPO)*vec3(.85,1.,.85);
  col *= .8 + .2*sin(t.y*900.); col += (hash(t*97.+fract(uTime*7.))-.5)*.08*(1.+uA*2.);
  col *= 1. - .6*length((t-.5)*vec2(1.2,1.));
  col = mix(col, vec3(1.,0.,0.), smoothstep(.014,.01,length((t-vec2(.06,.08))*vec2(uAspect,1.)))*step(.5,fract(uTime)));
  vec2 tid = floor((t - vec2(.62,.06))*vec2(60.,40.));
  if(abs(tid.y) < .5 && tid.x >= 0. && tid.x < 18. && mod(tid.x,3.) < 1.5) col = mix(col, vec3(.9), step(.3, hash(tid + floor(uTime*mix(1.,10.,step(15.,tid.x)))))*.8);
  vec2 hb = abs((t-uBody.zw)*vec2(uAspect,1.)); float bs = .09*(1.+uB);
  float frame = step(abs(max(hb.x,hb.y) - bs), .002)*step(bs*.6, min(hb.x,hb.y));
  return mix(col, vec3(.2,1.,.3), frame); }`);

fx("Spy Titles", "spy_targetlock", "Target Lock", "ring", "spin", `
vec3 fx(vec2 t){ vec3 cy = vec3(.2,.9,1.);
  vec3 c = C(t)*vec3(.5,.7,1.)*.7 + cy*(1. - smoothstep(0., .15, abs(M(t)-.5)))*.8;
  vec2 p = (t-uBody.zw)*vec2(uAspect,1.); float r = length(p), a = atan(p.y,p.x);
  float R = .1*(1. + .15*sin(uTime*3.))*(1.+uA);
  float ring = step(abs(r-R), .003)*step(.5, fract(a/TAU*4. + uTime*.3*(1.+uB*3.)));
  float ring2 = step(abs(r-R*1.3), .002)*step(.7, fract(a/TAU*12. - uTime*.5));
  c = mix(c, mix(cy, vec3(1.,.2,.2), step(.5, fract(uTime*.25))), max(ring, ring2));
  if(t.x > .9 && t.x < .97 && t.y > .2 && t.y < .8){ float row = floor(t.y*30.);
    c = mix(c, cy*.8, step((t.x-.9)/.07, hash(vec2(row, floor(uTime*4.))))*step(.3, fract(t.y*30.))); }
  return c + cy*.04*(step(fract(AS(t).x*20.), .03) + step(fract(t.y*20.), .03)); }`);

fx("Spy Titles", "spy_satmap", "Tactical Map", "contours", "sweep", `
vec3 fx(vec2 t){ float v = D(t)*mix(15.,40.,uA); float fv = fract(v);
  float cont = 1. - smoothstep(0., 1.5*fwidth(v) + 1e-4, min(fv, 1.-fv));
  vec2 p = AS(t); float grid = step(fract(p.x*10.), .02) + step(fract(p.y*10.), .02);
  vec3 col = vec3(.005,.03,.015) + vec3(.1,.6,.25)*cont*.5 + vec3(.05,.3,.12)*grid*.3;
  col += vec3(.2,1.,.4)*exp(-abs(t.x - fract(uTime*.15*(1.+uB*3.)))*80.)*.5;
  return mix(col, vec3(1.,.4,.1)*(.5+.5*sin(uTime*4.))*(.4+.6*lum(CN(t))), MM(t)*.7); }`);

fx("Spy Titles", "spy_dossier", "Classified Dossier", "halftone", "stamp", `
vec3 fx(vec2 t){ vec2 p = AS(t); vec3 c = vec3(.9,.85,.72)*(.92 + .08*fbm(p*20.));
  vec2 fr0 = vec2(.08,.12), fr1 = vec2(.58,.88);
  if(t.x > fr0.x && t.x < fr1.x && t.y > fr0.y && t.y < fr1.y){ vec2 q = (t-fr0)/(fr1-fr0);
    float l = LN(vec2(.15,0.) + q*vec2(.7,1.)); vec2 hp = rot(.785)*p*mix(140.,70.,uA);
    c = mix(vec3(.85,.78,.62), vec3(.25,.18,.12), step(length(fract(hp)-.5), (1.-l)*.6));
    c = mix(c, vec3(.98,.96,.9), step(min(min(q.x,1.-q.x), min(q.y,1.-q.y)), .02)); }
  if(t.x > .64 && t.x < .94 && t.y > .15 && t.y < .85){ float row = floor(t.y*40.), wd = floor((t.x-.64)*120.), fy = fract(t.y*40.);
    float on = step(.25,fy)*step(fy,.6)*step(.25, hash(vec2(wd,row)))*step((t.x-.64)/.3, .4+.6*hash(vec2(row,1.)));
    float redact = step(.8, hash(vec2(floor(wd/6.),row)))*step(.15,fy)*step(fy,.75);
    c = mix(c, vec3(.15,.13,.12), max(on*.8, redact)); }
  vec2 sp = rot(-.25)*(p - vec2(uAspect*.72, .82));
  float st = step(abs(sp.x),.16)*step(abs(sp.y),.045)*(1. - step(abs(sp.x),.145)*step(abs(sp.y),.032));
  st = max(st, step(abs(sp.x),.12)*step(abs(sp.y),.012));
  c = mix(c, vec3(.75,.1,.1), st*(.7+.3*noise(p*80.))*min(.6+.4*uB+uBeat*.3, 1.));
  return toLin(c); }`);

fx("Spy Titles", "spy_casino", "Casino Lights", "bulbs", "chase", `
vec3 fx(vec2 t){ vec2 p = AS(t); vec3 col = vec3(.25,.01,.03)*(.6 + .4*fbm(vec2(p.x*40., p.y*3.)));
  float sc = mix(22.,40.,uA); vec2 g = p*sc; vec2 id = floor(g), f = fract(g)-.5;
  float chase = step(.5, fract((id.x+id.y)*.25 - uTime*(1.+uB*4.)));
  vec3 warm = vec3(1.,.8,.4);
  float border = step(min(min(t.x,1.-t.x)*uAspect, min(t.y,1.-t.y)), .04);
  vec2 cc = (id+.5)/sc; float ce = 1. - smoothstep(0., .25, abs(M(vec2(cc.x/uAspect, cc.y))-.5));
  col += warm*(exp(-length(f)*6.)*border + exp(-length(f)*5.)*ce*(1.+uBeat))*(.3 + 1.5*chase);
  return mix(col, C(t)*vec3(1.,.85,.6)*1.2, MM(t)*.85); }`);

fx("Spy Titles", "spy_roulette", "Roulette", "wheel", "spin", `
vec3 fx(vec2 t){ vec2 p = (t-uBody.xy)*vec2(uAspect,1.); float r = length(p);
  float a = atan(p.y,p.x) + uTime*(.3+uB*2.); float u = a/TAU*37.; float seg = floor(u);
  float R = mix(.35,.6,uA), Ri = R*.62; vec3 col = vec3(.01,.06,.03);
  if(r < R && r > Ri){ col = mod(seg,2.) > .5 ? vec3(.55,.03,.03) : vec3(.02);
    if(mod(seg,37.) < 1.) col = vec3(0.,.35,.1);
    if(min(fract(u), 1.-fract(u)) < .05) col = vec3(.6,.5,.25); }
  if(r <= Ri) col = vec3(.25,.15,.06)*(.6 + .4*sin(a*8.));
  col = mix(col, vec3(.7,.55,.25), clamp(step(abs(r-R),.008) + step(abs(r-Ri),.006), 0., 1.));
  float ba = -uTime*(1.5+uB*3.); col = mix(col, vec3(1.), smoothstep(.015,.01, length(p - vec2(cos(ba),sin(ba))*R*.9)));
  return mix(col, C(t)*1.1, MM(t)); }`);

fx("Spy Titles", "spy_alpine", "Alpine Chase", "snow", "white-out", `
vec3 fx(vec2 t){ vec3 c = C(t)*EXPO; float l = lum(c);
  vec3 col = mix(mix(vec3(.05,.08,.15), vec3(.85,.92,1.), clamp(l*1.2,0.,1.)), c*vec3(.8,.9,1.1), .35);
  col = mix(col, mix(col, vec3(.8,.85,.95), .5), (1.-MM(t))*uB);
  for(int i=0;i<3;i++){ float fi = float(i), sc = 20.+fi*25.;
    vec2 g = AS(t)*sc + vec2(sin(uTime*.5+fi)*2., -uTime*(2.+fi)*(1.+uA*2.)); vec2 id = floor(g), f = fract(g)-.5;
    col += vec3(1.)*smoothstep(.12-fi*.02, 0., length(f - (hash2(id)-.5)*.6))*step(.75, hash(id+fi*7.))*(.6-fi*.12); }
  return col; }`);

fx("Spy Titles", "spy_underwater", "Underwater Titles", "ripple", "caustics", `
vec3 fx(vec2 t){ vec2 p = AS(t);
  vec2 w = vec2(sin(p.y*20.+uTime*2.), cos(p.x*15.+uTime*1.7))*.003*(1.+uA*2.);
  vec3 col = C(t+w)*EXPO*vec3(.3,.8,.9)*1.2 + vec3(0.,.05,.08);
  float c1 = 1. - smoothstep(0., .12, voro(p*6. + uTime*.3).y), c2 = 1. - smoothstep(0., .12, voro(p*9. - uTime*.25).y);
  col += vec3(.5,.9,1.)*pow((c1+c2)*.5, 2.)*.4*(1.+MM(t))*(.5+uB);
  vec2 g = vec2(p.x*12., p.y*6. + uTime*1.5); vec2 id = floor(g), f = fract(g)-.5;
  col += vec3(.7,.95,1.)*smoothstep(.02, 0., abs(length(f - (hash2(id)-.5)*.5) - .12))*step(.8, hash(id))*.6;
  col += vec3(.2,.5,.6)*pow(max(0., sin(p.x*7. + t.y*3. + uTime*.3)), 20.)*(1.-t.y)*.3;
  return col; }`);

fx("Spy Titles", "spy_fire", "Fire Titles", "blaze", "rim", `
vec3 fx(vec2 t){ vec2 p = AS(t); float y = 1.-t.y;
  float f = fbm(vec2(p.x*4., p.y*3. + uTime*(1.+uA*2.)));
  f = fbm(vec2(p.x*3., p.y*2. + uTime*1.5) + f*2.);
  float heat = clamp(f*1.6 - y*.9 + .2 + uBass*.3, 0., 1.);
  vec3 fire = heat < .4 ? mix(vec3(0.), vec3(.6,.05,0.), heat/.4) : heat < .75 ? mix(vec3(.6,.05,0.), vec3(1.,.5,.05), (heat-.4)/.35) : mix(vec3(1.,.5,.05), vec3(1.,.95,.7), (heat-.75)/.25);
  vec3 n = N(t);
  vec3 sil = vec3(.004) + toLin(vec3(1.,.5,.1))*pow(1.-max(n.z,0.), 3.)*(1.+uB*2.);
  return mix(toLin(fire)*1.3, sil, MM(t)); }`);

fx("Spy Titles", "spy_shatter", "Shattered Glass", "shards", "break", `
vec3 fx(vec2 t){ vec4 v = voroC(AS(t)*mix(4.,10.,uA)); float h1 = hash(vec2(v.w,1.)), h2 = hash(vec2(v.w,2.));
  vec2 off = (vec2(h1,h2)-.5)*.06*(uBeat*.6 + uB*.4);
  vec3 c = C(t+off)*EXPO*(.85 + .3*h1);
  return c + vec3(.9,.95,1.)*(1. - smoothstep(0., .04, v.z))*.6 + vec3(1.)*pow(h2,30.)*.3; }`);

fx("Spy Titles", "spy_mirrormaze", "Mirror Maze", "mirrors", "fade", `
vec3 fx(vec2 t){ vec2 c = uBody.xy; float n = mix(2.,4.,uA);
  vec2 g = (t-c)*vec2(uAspect,1.)*n + .5; vec2 id = floor(g), f = fract(g);
  f = mix(f, 1.-f, mod(id, 2.));
  vec2 tq = c + (f-.5)*vec2(.5,.9);
  vec3 col = C(tq)*EXPO*vec3(.85,.95,.95)*exp(-length(id)*.4*(1.-uB*.7));
  return mix(col, vec3(.05), step(min(min(f.x,1.-f.x), min(f.y,1.-f.y)), .01)); }`);

fx("Spy Titles", "spy_gogo", "Go-Go 60s", "dots", "shake", `
vec3 fx(vec2 t){ vec2 p = AS(t); float sh = sin(uTime*2.)*.06*(1.+uB*2.) + uBeat*.03;
  vec3 bg = mix(vec3(1.,.85,.3), vec3(1.,.4,.6), step(.5, fract((p.x+p.y)*4. + uTime*.2)));
  bg = mix(bg, vec3(1.), step(length(fract(p*mix(8.,16.,uA))-.5), .18)*.6);
  vec3 c = mix(bg, vec3(.1,.7,.8), MM(t+vec2(sh,0.)));
  c = mix(c, vec3(.95,.3,.1), MM(t-vec2(sh,0.)));
  return toLin(mix(c, vec3(.05), MM(t))); }`);

fx("Spy Titles", "spy_hypno", "Hypno Spiral", "arms", "speed", `
vec3 fx(vec2 t){ vec2 p = (t-uBody.xy)*vec2(uAspect,1.); float r = length(p), a = atan(p.y,p.x);
  float s = fract(a/TAU*floor(mix(1.,5.,uA)) + log(r+1e-3)*1.5 - uTime*(.3+uB*1.5));
  vec3 c = mix(vec3(.02), mix(vec3(.95), hsv(r*.5+uTime*.05,.8,1.), uB), step(.5, s));
  return toLin(mix(c, 1.-c, MM(t))); }`);

fx("Spy Titles", "spy_noir", "Venetian Noir", "blinds", "smoke", `
vec3 fx(vec2 t){ float l = smoothstep(.05, .75, pow(LN(t), 1./2.2)); vec2 p = AS(t); vec3 n = N(t); float m = MM(t);
  float y = (rot(-.35)*p).y + n.y*.03*m + D(t)*.05*m;
  float lit = mix(.25, 1.3, smoothstep(.45, .55, fract(y*mix(12.,30.,uA))));
  return toLin(vec3(l*lit + fbm(p*3.+uTime*.05)*.15*uB)); }`);

fx("Spy Titles", "spy_rainnoir", "Neon Rain", "rain", "streaks", `
vec3 fx(vec2 t){ vec2 p = AS(t); vec3 n = N(t); float m = MM(t);
  vec3 c = C(t)*EXPO*vec3(.4,.5,.8)*.6;
  c += (vec3(1.,.2,.6)*max(-n.x,0.) + vec3(.2,.8,1.)*max(n.x,0.))*pow(1.-max(n.z,0.), 1.5)*m*1.2;
  float rain = 0.;
  for(int i=0;i<2;i++){ float fi = float(i);
    vec2 g = vec2(p.x*(80.+fi*60.), p.y*(4.+fi*2.) - uTime*(6.+fi*4.)*(1.+uA)); vec2 id = floor(g);
    rain += step(.92, hash(id+fi*13.))*smoothstep(.5, 0., abs(fract(g.x)-.5))*fract(g.y)*.5; }
  return c + vec3(.6,.7,.9)*rain*(.5+uB); }`);

fx("Spy Titles", "spy_bullets", "Bullet Glass", "cracks", "rate", `
vec3 fx(vec2 t){ vec2 p = AS(t); vec3 c = C(t)*EXPO; float crack = 0., hole = 0.;
  float cnt = uBeatN + floor(uTime*mix(.3,2.,uB));
  for(int i=0;i<8;i++){ float k = cnt - float(i);
    vec2 d = p - vec2(hash(vec2(k,1.))*uAspect, hash(vec2(k,2.))); float r = length(d), a = atan(d.y,d.x);
    hole = max(hole, smoothstep(.012, .008, r));
    float ad = abs(fract(a/TAU*9. + hash(vec2(k,3.))) - .5);
    crack = max(crack, smoothstep(.002, 0., ad*.7*r)*smoothstep(.25*(.6+uA), 0., r));
    crack = max(crack, smoothstep(.003, 0., abs(r - .04 - .02*hash(vec2(k,4.))))*smoothstep(.1, 0., r)*.7); }
  c = mix(c, vec3(.8,.85,.9)*(.5+c), crack*.8);
  return mix(c, vec3(0.), hole); }`);

fx("Spy Titles", "spy_chrome", "Chrome Agent", "ripple", "colour", `
vec3 fx(vec2 t){ vec3 n = N(t); vec3 R = reflect(vec3(0.,0.,-1.), n);
  vec3 env = mix(vec3(.05,.04,.04), vec3(.9,.95,1.), smoothstep(-.2, .3, -R.y));
  env += vec3(1.)*pow(max(dot(R, normalize(vec3(sin(uTime*.6), -.6, .5))), 0.), 60.)*3.;
  env += hsv(R.x*.3 + uTime*.05, .6, 1.)*uB*.4*smoothstep(0., .3, abs(R.x));
  env *= .8 + .2*sin(R.x*20.*uA + uTime);
  return mix(mix(vec3(.02), vec3(.08,.09,.12), t.y), env, MM(t)); }`);

fx("Spy Titles", "spy_radar", "Radar Sweep", "rings", "speed", `
vec3 fx(vec2 t){ vec2 p = (t-.5)*vec2(uAspect,1.); float r = length(p), a = atan(p.y,p.x);
  float da = mod(mod(uTime*(1.+uB*3.), TAU) - a, TAU);
  vec3 g = vec3(.2,1.,.4); float inR = step(r, .48);
  float fr = fract(r*mix(5.,10.,uA));
  vec3 col = vec3(0.,.03,.01) + g*exp(-da*2.5)*.35*inR;
  col += g*.35*inR*clamp(step(min(fr,1.-fr), .02) + step(abs(p.x), .002) + step(abs(p.y), .002), 0., 1.);
  float m = MM(t)*inR; col += g*m*(exp(-da)*1.5 + lum(C(t))*EXPO*.25);
  return mix(vec3(.04,.045,.05), col, smoothstep(.49, .48, r)); }`);

fx("Spy Titles", "spy_stripes60s", "Ribbon Titles", "ribbons", "wave", `
vec3 fx(vec2 t){ vec2 p = AS(t); float w = p.x + sin(p.y*4. + uTime*.8)*.15*(1.+uB);
  float k = w*mix(6.,16.,uA) - uTime*.5; float id = floor(k), fk = fract(k);
  vec3 col = hsv(fract(id*.13+.55), .8, .9)*(.8 + .2*smoothstep(0.,.1,fk)*smoothstep(1.,.9,fk));
  return toLin(mix(col, hsv(fract(id*.13+.05), .85, .25), MM(t))); }`);
