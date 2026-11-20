// ART: Mondrian and other modern-art looks driven by your silhouette.   SPY TITLES: 60s-to-now spy-film title looks.
"use strict";

// Recursive Mondrian split of t (0..1). Returns x = cell id, y = distance to the nearest line (aspect units),
// zw = cell centre; lo/hi = cell bounds.
const ART_LIB = `
vec4 bsp(vec2 p, float seed, float lv, out vec2 lo, out vec2 hi){
  lo = vec2(0.); hi = vec2(1.); float id = fract(seed*.1031)+.17, e = 9.;
  for(int i=0;i<7;i++){ if(float(i) >= lv) break;
    vec2 sz = (hi-lo)*vec2(uAspect,1.); if(min(sz.x,sz.y) < .09) break;
    float h = hash(vec2(id, float(i)*7.3+seed)), r = .28 + .44*hash(vec2(id*3.1, seed+float(i)));
    bool vx = sz.x > sz.y*1.2 ? h < .8 : (sz.y > sz.x*1.2 ? h < .2 : h < .5);
    if(vx){ float s = mix(lo.x,hi.x,r); e = min(e, abs(p.x-s)*uAspect);
      if(p.x < s){ hi.x = s; id = hash(vec2(id*17.,1.)); } else { lo.x = s; id = hash(vec2(id*17.,2.)); } }
    else { float s = mix(lo.y,hi.y,r); e = min(e, abs(p.y-s));
      if(p.y < s){ hi.y = s; id = hash(vec2(id*17.,3.)); } else { lo.y = s; id = hash(vec2(id*17.,4.)); } } }
  return vec4(id, e, (lo+hi)*.5); }
const vec3 CREAM = vec3(.94,.92,.86), MRED = vec3(.80,.10,.10), MBLUE = vec3(.08,.20,.62), MYEL = vec3(.96,.80,.10);
vec3 mPal(float h){ return h < .4 ? MRED : h < .68 ? MBLUE : h < .9 ? MYEL : vec3(.05); }
`;

fx("Art", "destijl", "De Stijl", "splits", "shuffle", `${ART_LIB}
vec3 fx(vec2 t){ float seed = floor(uTime*uB*1.5) + uBeatN*step(.5,uB);
  vec2 lo, hi; vec4 b = bsp(t, seed, 3.+uA*4., lo, hi);
  float on = step(.4, MM(b.zw)*.6 + MM(t)*.4);
  vec3 c = mix(hash(vec2(b.x,9.)) < .15 ? vec3(.82,.81,.78) : CREAM, mPal(b.x), on);
  float lw = .007 + .005*uBass;
  c = mix(c, vec3(.03), smoothstep(lw, lw*.6, b.y));
  return toLin(c); }`);

fx("Art", "mondrianpaint", "Mondrian Portrait", "splits", "shuffle", `${ART_LIB}
vec3 fx(vec2 t){ vec2 lo, hi; vec4 b = bsp(t, floor(uTime*uB*1.5), 4.+uA*3., lo, hi);
  vec3 a = vec3(0.);
  for(int i=0;i<5;i++){ vec2 o = i==0 ? vec2(.5) : .15+.7*hash2(vec2(float(i), b.x*9.)); a += clamp(toSrgb(CN(mix(lo,hi,o))),0.,1.); }
  a /= 5.; a = clamp(mix(vec3(lum(a)), a, 2.6), 0., 1.);
  const vec3 P[5] = vec3[](MRED, MBLUE, MYEL, vec3(.05), CREAM);
  vec3 c = P[4]; float bd = 9.;
  for(int i=0;i<5;i++){ float d = distance(a, P[i]); if(d < bd){ bd = d; c = P[i]; } }
  c = mix(c, vec3(.03), smoothstep(.008, .005, b.y));
  return toLin(c); }`);

fx("Art", "boogie", "Boogie Woogie", "grid", "traffic", `${ART_LIB}
float laneD(float x, float s, out float lid){ float c = floor(x), best = 9.; lid = 0.;
  for(int k=-1;k<=1;k++){ float i = c+float(k); float d = abs(x - (i+.5+(hash(vec2(i,s))-.5)*.5)); if(d < best){ best = d; lid = i; } }
  return best; }
vec3 boogie(float s, float lid){ float h = hash(vec2(floor(s), lid));
  return h < .14 ? MRED : h < .26 ? MBLUE : h < .36 ? vec3(.72,.72,.70) : MYEL; }
vec3 fx(vec2 t){ float sc = 4.+uA*4.; vec2 p = AS(t)*sc;
  float lx, ly; float dx = laneD(p.x, 1., lx), dy = laneD(p.y, 2., ly);
  float w = .07, sp = 1. + uB*4. + uBass*4.;
  vec2 q = floor(p*2.); vec2 qc = (q+.5)/2.; vec2 tc = vec2(qc.x/sc/uAspect, qc.y/sc);
  float hq = hash(q + floor(uBeatN*.25));
  vec3 c = CREAM;
  if(MM(tc) > .5){ c = hq < .35 ? MRED : hq < .6 ? MBLUE : hq < .8 ? vec3(.72,.72,.70) : MYEL;
    vec2 f = fract(p*2.); if(max(abs(f.x-.5), abs(f.y-.5)) < .18) c = hq < .5 ? MYEL : CREAM; }
  if(dx < w) c = boogie(p.y*7. - uTime*sp*(hash(vec2(lx,5.)) < .5 ? -1. : 1.), lx);
  if(dy < w) c = boogie(p.x*7. - uTime*sp*(hash(vec2(ly,6.)) < .5 ? -1. : 1.), ly+50.);
  return toLin(c); }`);

fx("Art", "bauhaus", "Bauhaus", "tiles", "spin", `
vec3 fx(vec2 t){ float sc = mix(16.,6.,uA); vec2 p = AS(t)*sc; vec2 id = floor(p), f = fract(p)-.5;
  vec2 tc = vec2((id.x+.5)/sc/uAspect, (id.y+.5)/sc);
  float m = MM(tc), h = hash(id), h2 = hash(id+7.);
  f = rot(floor(h2*4. + uBeatN*uB)*1.5708)*f;
  vec3 P[4] = vec3[](vec3(.85,.15,.1), vec3(.1,.2,.6), vec3(.95,.75,.1), vec3(.08));
  int i = min(int(h*4.),3), j = (i + 1 + min(int(h2*3.),2)) % 4;
  vec3 bg = m > .5 ? P[i] : vec3(.93,.9,.83), fg = m > .5 ? P[j] : mix(bg, P[j], .22);
  float s = fract(h*13.)*5., d;
  if(s < 1.) d = length(f) - .4;
  else if(s < 2.) d = length(f - vec2(0.,.5)) - .5;
  else if(s < 3.) d = length(f - vec2(-.5,.5)) - 1.;
  else if(s < 4.) d = f.x - f.y;
  else d = abs(length(f)-.3) - .1;
  return toLin(mix(bg, fg, smoothstep(.02, -.02, d))); }`);

fx("Art", "suprematism", "Suprematism", "bars", "tilt", `
vec3 fx(vec2 t){ vec2 p = AS(t); vec3 c = vec3(.92,.89,.82);
  vec2 q = p - vec2(uAspect*(.2+.05*sin(uTime*.1)), .28); c = mix(c, vec3(.8,.12,.1), smoothstep(.13,.125,length(q)));
  vec2 k = rot(.3+uTime*.02)*(p - vec2(uAspect*.82, .7)); c = mix(c, vec3(.06), step(max(abs(k.x),abs(k.y)), .1));
  float ang = -.35 + uB*.7; vec2 o = vec2(uAspect*.5, .5);
  vec2 cs = vec2(.22, .05)*(1.6-uA); vec2 g = (rot(ang)*(p-o))/cs;
  float sh = hash(vec2(floor(g.y),3.))*3.; g.x += sh; vec2 id = floor(g), f = fract(g);
  vec2 cc = rot(-ang)*((id+.5-vec2(sh,0.))*cs) + o; vec2 tc = vec2(cc.x/uAspect, cc.y);
  float h = hash(id);
  bool bar = f.y > .15 && f.y < .85 && f.x > .05 && f.x < .45+.5*h;
  if(bar && MM(tc) > .5) c = h < .3 ? vec3(.06) : h < .5 ? vec3(.8,.12,.1) : h < .65 ? vec3(.1,.22,.6) : h < .8 ? vec3(.95,.78,.15) : vec3(.55,.5,.45);
  return toLin(c); }`);

fx("Art", "opart", "Op Art", "stripes", "colour", `
vec3 fx(vec2 t){ vec2 p = AS(t); float m = MM(t); vec3 n = N(t);
  float f = mix(40.,140.,uA);
  float wy = p.y + (n.y*.05 + D(t)*.06)*m + sin(p.x*6.+uTime)*.01;
  float wx = p.x + n.x*.05*m + sin(p.y*5.-uTime*.7)*.01;
  float v = mix(sin(wy*f), sin(wx*f), m);
  float ink = smoothstep(-.12, .12, v);
  vec3 bandC = mix(vec3(1.), rainbow(floor(mix(wy,wx,m)*f/TAU)*.13 + uTime*.05), uB);
  return toLin(mix(vec3(.02), bandC, ink)); }`);

fx("Art", "kandinsky", "Kandinsky Rings", "tiles", "rings", `
vec3 fx(vec2 t){ float sc = mix(9.,4.,uA); vec2 p = AS(t)*sc; vec2 id = floor(p), f = fract(p)-.5;
  vec2 tc = vec2((id.x+.5)/sc/uAspect, (id.y+.5)/sc); float m = MM(tc), h = hash(id);
  float r = length(f)*(1.-uBass*.3), k = floor(r*mix(6.,10.,uB));
  vec3 c = rainbow(h + k*.27 + hash(id+k)*.3);
  if(r > .45) c = rainbow(h*3.+.5);
  c *= mix(.3, 1., m);
  return toLin(c); }`);

fx("Art", "matisse", "Matisse Cutouts", "leaves", "hue", `
vec3 fx(vec2 t){ vec2 p = AS(t);
  float m = step(.5, M(t) + noise(p*40.)*.12 + noise(p*9.+uTime*.2)*.1 - .1);
  vec3 c = vec3(.96,.94,.89);
  vec2 g = p*mix(3.,6.,uA) + vec2(0., uTime*.05); vec4 v = voroC(g);
  vec2 l = g - v.xy; float a = atan(l.y,l.x);
  float h1 = hash(vec2(v.w,3.)), h2 = hash(vec2(v.w,7.));
  float rad = .26 + .1*sin(a*(3.+floor(h1*4.)) + h1*6.);
  vec3 L[5] = vec3[](vec3(.93,.35,.15), vec3(.97,.78,.15), vec3(.2,.55,.3), vec3(.95,.55,.6), vec3(.08));
  if(v.w > .35 && length(l) < rad) c = L[min(int(h2*5.),4)];
  c = mix(c, hsv(.62+uB*.38, .8, .62), m);
  c *= .96 + .04*noise(p*300.);
  return toLin(c); }`);

fx("Art", "rothko", "Rothko Fields", "hue", "drift", `
vec3 fx(vec2 t){ float hb = uA + uTime*.01 + floor(uBeatN*.25)*.07*uB;
  vec3 c1 = hsv(hb, .75, .62), c2 = hsv(hb+.07, .8, .9), c3 = hsv(hb-.05, .7, .28);
  vec2 p = AS(t); float e = (fbm(p*7.+uTime*.05)-.5)*.04;
  float f1 = smoothstep(.03, -.01, max(abs(t.x-.5)-.42, abs(t.y-.27)-.19) + e);
  float f2 = smoothstep(.03, -.01, max(abs(t.x-.5)-.42, abs(t.y-.71)-.21) + e);
  vec3 c = mix(mix(c3, c1, f1), c2*.85, f2);
  float mb = smoothstep(.2, .8, mBlur(t, .025));
  c = mix(c, c2*1.15 + vec3(.05), mb*.85);
  c *= .9 + .1*fbm(p*40.);
  return toLin(c); }`);

// ---------------- SPY TITLES ----------------

fx("Spy Titles", "barrel", "Barrel Sight", "iris", "red", `
vec3 fx(vec2 t){ vec2 c = uBody.xy; vec2 p = (t-c)*vec2(uAspect,1.); float r = length(p), a = atan(p.y,p.x);
  float R = mix(.2,.4,uA) + uBass*.03; float ring = r/R;
  float m = MM(t);
  vec3 inside = mix(vec3(.92), vec3(lum(C(t)))*1.4, m);
  float groove = .55 + .45*smoothstep(-.3, .3, sin(a*8. + log(ring)*6. - uTime*1.2));
  vec3 wall = vec3(.72,.72,.76)*groove*pow(1./max(ring,1.), 1.6);
  vec3 col = mix(inside, wall, smoothstep(.99, 1.01, ring));
  col *= 1. - .8*exp(-pow((ring-1.)*40., 2.));
  float drip = uBeat*uB*1.3 + (fbm(vec2(t.x*12., uTime))-.5)*.15;
  col = mix(col, vec3(.55,0.,0.)*(.6+.4*col), smoothstep(drip, drip-.05, t.y)*step(.01, uB));
  return col; }`);

fx("Spy Titles", "silhouette", "Silhouette Titles", "flow", "palette", `
vec3 fx(vec2 t){ vec2 p = AS(t); float tm = uTime*.15*(1.+uA*2.);
  vec2 w = vec2(fbm(p*2.+tm), fbm(p*2.+vec2(5.2,1.3)-tm));
  float f = fbm(p*2.5 + w*2.5 + uBass);
  vec3 bg = mix(hsv(.62+uB-.5, .9, .25), hsv(.92+uB-.5, .85, .85), smoothstep(.3, .55, f));
  bg = mix(bg, hsv(.07+uB-.5, .9, 1.), smoothstep(.55, .8, f)); bg = toLin(bg);
  float m = MM(t); vec3 n = N(t);
  vec3 sil = vec3(.005) + bg*pow(1.-max(n.z,0.), 3.)*1.6;
  return mix(bg, sil, m); }`);

fx("Spy Titles", "gold", "Molten Gold", "liquid", "shine", `
vec3 fx(vec2 t){ vec2 tw = t + (vec2(noise(AS(t)*14.+uTime), noise(AS(t)*14.-uTime+5.))-.5)*.012*uA;
  float m = MM(tw); vec3 n = N(tw);
  vec3 L = normalize(vec3(sin(uTime*.5)*.6, -.5, .8));
  float df = max(dot(n,L),0.), sp = spec(n, L, mix(20.,120.,uB));
  float env = .5 + .5*sin(n.x*6. + n.y*4. + uTime);
  vec3 gold = vec3(1.,.72,.25);
  vec3 body = gold*(.06 + df*.6 + env*.35) + vec3(1.,.9,.6)*sp*2.;
  float rip = .5 + .5*sin(length(AS(t)-AS(uBody.xy))*60. - uTime*3.);
  vec3 bg = gold*.05*pow(rip, 8.)*(1.+uBass*3.);
  return mix(bg, body, m); }`);

fx("Spy Titles", "echoes", "Silhouette Echoes", "spread", "twist", `
vec3 fx(vec2 t){ vec2 c = uBody.xy; vec3 col = vec3(0.);
  for(int i=6;i>=1;i--){ float k = float(i); float s = 1. + k*mix(.08,.25,uA);
    vec2 q = rot(k*.2*sin(uTime*.4)*uB) * ((t-c)*vec2(uAspect,1.)) / s; q = q/vec2(uAspect,1.) + c;
    vec3 hc = pal(k*.12 + uTime*.05, vec3(.5), vec3(.5), vec3(1.), vec3(0.,.1,.2));
    col = mix(col, hc*hc*(1.3 - k*.12)*(1.+uBeat*.5), MM(q)); }
  float m = MM(t);
  return mix(col, C(t)*.12, m); }`);

fx("Spy Titles", "spysmoke", "Smoke & Neon", "linger", "hue", `
vec3 fx(vec2 t){ vec2 adv = vec2((fbm(AS(t)*4.+uTime*.3)-.5)*.004, .0025*(1.+uA*2.));
  vec3 sm = PV(t + adv)*mix(.96, .992, uA);
  float ed = 1. - smoothstep(0., .25, abs(M(t)-.5));
  vec3 neon = hsv(uB + t.y*.3 + uTime*.05, .8, 1.);
  sm = max(sm, neon*ed*(1.+uBeat));
  keep(sm);
  return sm*1.2 + C(t)*MM(t)*.2 + neon*ed*.5; }`);

fx("Spy Titles", "heist", "Laser Heist", "beams", "sweep", `
vec3 fx(vec2 t){ vec2 p = AS(t); float m = MM(t); vec3 col = C(t)*.15*vec3(.6,.7,1.);
  vec3 red = vec3(1.,.05,.03);
  for(int i=0;i<8;i++){ float fi = float(i); if(fi >= 3.+uA*5.) break;
    float ang = (hash(vec2(fi,1.))-.5)*1.4 + sin(uTime*(.2+.3*hash(vec2(fi,2.))) + fi)*.25*(1.+uB*2.);
    vec2 dir = vec2(cos(ang), sin(ang)), o = vec2(uAspect*hash(vec2(fi,3.)), hash(vec2(fi,4.)));
    float d = abs(dot(p-o, vec2(-dir.y,dir.x))), w = .0018;
    float core = exp(-d*d/(w*w));
    col += red*(core + exp(-d/(w*8.))*.25)*mix(1.2, 3., m) + vec3(1.,.6,.5)*exp(-d*d/(w*w*.2))*m*2.; }
  col += vec3(.12,0.,0.)*fbm(p*3.+uTime*.1)*.3;
  return col; }`);

fx("Spy Titles", "sniper", "Sniper Scope", "sway", "zoom", `
vec3 fx(vec2 t){ vec2 c = uBody.zw + vec2(sin(uTime*.7), cos(uTime*.9))*.01*(1.+uA*3.);
  float R = .38; vec2 p = (t-c)*vec2(uAspect,1.); float r = length(p);
  vec2 tz = c + (t-c)/(1.+uB*1.5);
  vec3 img = C(tz); img = mix(vec3(lum(img)), img, .4)*vec3(.9,1.,.85)*1.3;
  img *= 1. - smoothstep(.2, R, r)*.6;
  float lw = .0015, ax = abs(p.x), ay = abs(p.y);
  float xh = step(ax, lw)*step(.02, ay) + step(ay, lw)*step(.02, ax) + step(ax, lw*4.)*step(.22, ay) + step(ay, lw*4.)*step(.22, ax);
  float dv = length(vec2(p.x, (fract(p.y/.04+.5)-.5)*.04)), dh = length(vec2(p.y, (fract(p.x/.04+.5)-.5)*.04));
  xh += (smoothstep(.004,.003,dv)*step(ay,.2) + smoothstep(.004,.003,dh)*step(ax,.2))*step(.03, r);
  vec3 col = mix(img, vec3(0.), clamp(xh, 0., 1.));
  col = mix(col, vec3(1.,0.,0.), smoothstep(.006, .003, r)*(.6+.4*uBeat));
  col *= smoothstep(R+.004, R, r)*(1. - .7*exp(-pow((r-R)*90., 2.)));
  return col; }`);

fx("Spy Titles", "cards", "High Stakes", "suits", "ink", `
float dot2(vec2 v){ return dot(v,v); }
float sdHeart(vec2 p){ p.x = abs(p.x);
  if(p.y+p.x > 1.) return sqrt(dot2(p-vec2(.25,.75))) - .3535534;
  return sqrt(min(dot2(p-vec2(0.,1.)), dot2(p-.5*max(p.x+p.y,0.)))) * sign(p.x-p.y); }
float suit(vec2 f, float k){ vec2 g = f*2.4; float stem = max(abs(f.x)-.03-max(-.18-f.y,0.)*.5, abs(f.y+.27)-.09);
  if(k < 1.) return sdHeart(vec2(g.x, g.y+.5))/2.4;
  if(k < 2.) return (abs(f.x) + abs(f.y)*.75 - .3)*.8;
  if(k < 3.) return min(sdHeart(vec2(g.x, -g.y+.55))/2.4, stem);
  return min(min(length(f-vec2(0.,.12)), min(length(f-vec2(-.12,-.07)), length(f-vec2(.12,-.07)))) - .11, stem); }
vec3 fx(vec2 t){ vec2 g = AS(t)*mix(4.,9.,uA) + vec2(uTime*.2, 0.); vec2 id = floor(g), f = fract(g)-.5;
  float h = hash(id), k = floor(h*4.);
  f = rot(sin(uTime*.8 + h*6.)*.3)*f; f.y = -f.y;
  float d = suit(f*1.15, k);
  vec3 bg = vec3(.02,.13,.07);
  bg = mix(bg, k < 2. ? vec3(.6,.03,.04) : vec3(.62,.54,.33), smoothstep(.01, -.01, d)*.85);
  float m = MM(t), l = LN(t);
  vec3 ink = mix(vec3(.02), vec3(.95,.92,.84), step(.3+uB*.35, l));
  ink = mix(ink, vec3(.75,.05,.06), edgeN(t, 1.5));
  return toLin(mix(bg, ink, m)); }`);

fx("Spy Titles", "diamonds", "Diamond Dust", "facets", "fire", `
vec3 fx(vec2 t){ vec2 p = AS(t); float m = MM(t); vec3 n = N(t);
  vec4 v = voroC(p*mix(25.,60.,uA));
  vec3 fn = normalize(n + vec3(hash2(vec2(v.w,1.))-.5, 0.)*.8);
  float sp = pow(max(dot(fn, normalize(vec3(sin(uTime*.7), cos(uTime*.5), 1.5))), 0.), 40.);
  vec3 face = vec3(.6,.7,.8)*(.1+.3*fn.z) + vec3(1.)*sp*3. + hsv(v.w+uTime*.1,.5,1.)*sp*1.5*uB;
  face *= .75 + .25*smoothstep(0., .05, v.z);
  vec2 g = p*vec2(30.,15.) + vec2(0., -uTime*3.); vec2 id = floor(g), f = fract(g)-.5; float h = hash(id);
  float star = h > .9 ? exp(-length(f)*12.)*(.5+.5*sin(uTime*10.+h*50.)) : 0.;
  star += h > .97 ? exp(-abs(f.x)*60.)*exp(-abs(f.y)*6.) + exp(-abs(f.y)*60.)*exp(-abs(f.x)*6.) : 0.;
  vec3 bg = vec3(.01,.01,.02) + vec3(.9,.95,1.)*star*(.8+uBeat);
  return mix(bg, face*1.2, m); }`);

fx("Spy Titles", "split60s", "Split Screen 60s", "bands", "slide", `
vec3 fx(vec2 t){ float n = floor(mix(3.,9.,uA)); float band = floor(t.y*n); float h = hash(vec2(band, floor(uBeatN*.5)));
  float off = (h-.5)*.4*uB + sin(uTime*.6 + band)*.05;
  vec2 q = vec2(fract(t.x + off), t.y);
  float m = MM(q), l = LN(q);
  const vec3 P[4] = vec3[](vec3(.95,.45,.1), vec3(.05,.45,.5), vec3(.92,.72,.15), vec3(.8,.15,.1));
  int i = min(int(h*4.),3);
  vec3 c = mix(P[i], P[(i+2)%4]*(.35 + .65*step(.4, l)), m);
  c = mix(c, vec3(.03), step(fract(t.y*n), .025));
  return toLin(c); }`);
