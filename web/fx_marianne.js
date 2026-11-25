// MARIANNE: looks pulled frame-by-frame from a neon, gel-lit psychedelic music video.
// Grading is done in display space (DS) and converted back to linear on return.
"use strict";

const MAR_LIB = `
vec3 DS(vec2 t){ return clamp(toSrgb(CN(t)), 0., 1.); }
float mGrain(vec2 t, float k){ return (hash(t*vec2(1931.,1277.) + fract(uTime*13.1)*91.) - .5)*k; }
float mVig(vec2 t, float k){ vec2 q = (t-.5)*vec2(uAspect/1.78, 1.); return clamp(1. - k*dot(q,q)*2., 0., 1.); }
vec3 mBloom(vec2 t, float r){ vec3 s = vec3(0.);
  for(int i=0;i<12;i++){ float a = float(i)*.5236; float rr = r*(.5 + .5*float(i%2)); s += max(DS(t + vec2(cos(a)/uAspect, sin(a))*rr) - .45, 0.); }
  return s/12.*2.; }
`;

fx("Marianne", "mar_neonhaze", "Neon Haze", "haze", "smear", `${MAR_LIB}
vec3 fx(vec2 t){ vec3 c = DS(t); float l = lum(c); vec3 n = N(t); float m = MM(t);
  float s = mix(sin(AS(t).x*2. + uTime*.3), n.x*1.5, m);
  vec3 g = mix(vec3(.15,.5,1.), vec3(1.,.12,.6), smoothstep(-.6,.6,s));
  vec3 col = g*pow(l,.8)*1.5 + c*.2;
  col += lum(mBloom(t,.04))*g*1.6*uA + vec3(.35,.08,.45)*fbm(AS(t)*2. + uTime*.1)*.35*uA;
  vec3 o = toLin(clamp(col,0.,1.));
  o = mix(o, max(o, PV(t + vec2(.003*sin(uTime*2.), 0.))*.96), .7*uB); keep(o);
  return o*mVig(t,.6) + mGrain(t,.02); }`);

fx("Marianne", "mar_liquid", "Cyan Melt", "melt", "speed", `${MAR_LIB}
vec3 fx(vec2 t){ vec2 p = AS(t); float tm = uTime*.15*(1.+uB*3.);
  vec2 w = vec2(fbm(p*2.5 + tm), fbm(p*2.5 + 7.3 - tm)) - .5;
  vec2 q = t + w*mix(.03,.22,uA)*(.4 + MM(t));
  vec3 c = DS(q); float l = lum(c);
  vec3 col = mix(mix(vec3(0.,.16,.24), vec3(.12,.85,.9), smoothstep(0.,.55,l)), vec3(.9,1.,1.), smoothstep(.55,.95,l));
  col = mix(col, vec3(.95,.18,.5), smoothstep(.04,.3, c.r - c.b)*.85);
  col += vec3(.6,1.,1.)*pow(clamp(abs(w.x+w.y)*2.,0.,1.), 3.)*.25;
  return toLin(clamp(col,0.,1.)); }`);

fx("Marianne", "mar_gelportrait", "Gel Portrait", "key side", "magenta", `${MAR_LIB}
vec3 fx(vec2 t){ vec3 n = N(t); float m = MM(t); float l = lum(DS(t));
  float key = lambert(n, vec3(mix(-1.,1.,uA), -.3, .8)), fill = lambert(n, vec3(-mix(-1.,1.,uA), .1, .4));
  vec3 face = (vec3(.2,.45,1.)*(.25 + key*1.1) + vec3(.95,.2,.85)*fill*uB*1.6)*(.3 + l*1.3);
  vec3 bg = mix(vec3(.04,.03,.15), vec3(.4,.1,.5), fbm(AS(t)*2. + uTime*.05))*(.3 + l*.9);
  return toLin(clamp(mix(bg, face, m),0.,1.))*mVig(t,.5) + mGrain(t,.015); }`);

fx("Marianne", "mar_redroom", "Red Room", "bloom", "magenta", `${MAR_LIB}
vec3 fx(vec2 t){ float l = smoothstep(.04, .9, lum(DS(t)));
  vec3 col = vec3(1.,.08,.18)*pow(l,.9) + vec3(1.,.6,.6)*pow(l,4.)*.6;
  col += lum(mBloom(t,.05))*vec3(1.,.15,.25)*uA*1.5;
  col = mix(col, col*vec3(1.,.35,1.2), uB*smoothstep(.3,.8,t.x));
  return toLin(clamp(col,0.,1.))*mVig(t,.7) + mGrain(t,.02); }`);

fx("Marianne", "mar_irisportal", "Iris Portal", "size", "iris hue", `${MAR_LIB}
vec3 fx(vec2 t){ vec2 c = uBody.zw + vec2(0., .06); vec2 p = (t-c)*vec2(uAspect,1.); float r = length(p), a = atan(p.y,p.x);
  float R = mix(.18,.34,uA)*(1. + uBeat*.06), Ri = R*2.2;
  float fib = fbm(vec2(a*14., r*6. - uTime*.1))*.6 + .4*noise(vec2(a*60., r*20.));
  vec3 ic = hsv(fract(.07 + (uB-.5)*1.2), .85, 1.);
  vec3 iris = mix(ic*.35, ic, fib)*mix(1.3, .5, smoothstep(R, Ri, r));
  iris = mix(iris, vec3(.08,.04,.02), smoothstep(Ri*.85, Ri, r));
  vec3 sclera = mix(vec3(.75,.8,.92), vec3(.2,.3,.6), smoothstep(Ri, Ri*2.4, r))*(.85 + .15*noise(p*30.));
  sclera = mix(sclera, vec3(.7,.2,.25), step(.8, noise(vec2(a*8., r*3.)))*.3*smoothstep(Ri, Ri*1.6, r));
  vec3 col = r < Ri ? iris : sclera;
  col *= 1. - .85*smoothstep(Ri*1.5, Ri*3., r);
  vec2 q = c + (t-c)*(1. - .2*(r/R)*(r/R));
  vec3 cam = DS(q)*vec3(.9,1.05,1.05)*1.25*(1. - .45*smoothstep(R*.8, R, r));
  col = mix(cam, col, smoothstep(R*.98, R*1.02, r));
  col += vec3(1.)*smoothstep(.06,.0, length(p - vec2(.45,-.45)*R*1.6))*.7;
  return toLin(clamp(col,0.,1.)); }`);

fx("Marianne", "mar_demon", "Demon Glow", "bands", "dark bg", `${MAR_LIB}
vec3 fx(vec2 t){ float l = lum(DS(t)); float lb = clamp(lum(toSrgb(blurS(t,.012)*EXPO)), 0., 1.);
  float B = mix(3.,7.,uA); float k = floor(mix(l, lb, .6)*B)/B;
  vec3 col = k < .2 ? mix(vec3(.05,0.,.02), vec3(.5,0.,.05), k*5.) : mix(vec3(.9,.05,.12), vec3(1.,.78,.82), (k-.2)/.8);
  col += vec3(1.,.3,.4)*edgeL(t,2.)*.6;
  col = mix(col, vec3(.12,0.,.02) + col*.25, (1.-MM(t))*uB);
  return toLin(clamp(col,0.,1.))*mVig(t,.8); }`);

fx("Marianne", "mar_thermal", "Heat Camera", "body heat", "bands", `${MAR_LIB}
vec3 th(float h){ vec3 c = mix(vec3(.02,0.,.12), vec3(.35,0.,.6), smoothstep(0.,.25,h)); c = mix(c, vec3(.9,.05,.15), smoothstep(.25,.5,h));
  c = mix(c, vec3(1.,.55,0.), smoothstep(.5,.72,h)); c = mix(c, vec3(1.,1.,.4), smoothstep(.72,.9,h)); return mix(c, vec3(1.), smoothstep(.9,1.,h)); }
vec3 fx(vec2 t){ float tear = step(.93, hash(vec2(floor(t.y*30.), floor(uTime*6.))));
  vec2 q = t + vec2((hash(vec2(floor(t.y*240.), floor(uTime*12.))) - .5)*.012*tear, 0.);
  float lb = clamp(lum(toSrgb(blurS(q,.006)*EXPO)), 0., 1.);
  float h = clamp(mix(lb, .2 + .45*mBlur(q,.015) + .4*lb, uA), 0., 1.);
  h += (hash(floor(t*vec2(640.,360.)) + floor(uTime*15.)) - .5)*.08;
  float nb = mix(40.,7.,uB); h = floor(h*nb)/nb;
  vec3 col = th(h)*(.85 + .15*sin(t.y*700.));
  return toLin(clamp(col,0.,1.)); }`);

fx("Marianne", "mar_hyperburst", "Hyperspace Burst", "intensity", "speed", `${MAR_LIB}
vec3 fx(vec2 t){ vec2 p = (t-uBody.xy)*vec2(uAspect,1.); float r = length(p), a = atan(p.y,p.x); vec3 acc = vec3(0.);
  for(int i=0;i<3;i++){ float fi = float(i), n = 90. + fi*70.; float u = (a/TAU + .5)*n; float id = floor(u); float h = hash(vec2(id, fi));
    float fa = abs(fract(u) - .5);
    float seg = fract(log(r + .02)*1.2 - uTime*(.6 + h*1.5)*(1. + uB*3.) - h*10.); float len = .35 + .4*h;
    float s = smoothstep(.18, 0., fa)*step(seg, len)*(seg/len)*step(.5, h);
    vec3 sc = h < .7 ? vec3(1.,.45,.1) : h < .85 ? vec3(1.,.2,.7) : vec3(.3,.6,1.);
    acc += sc*s*(.4 + r*1.6); }
  acc *= mix(.6,1.8,uA)*(1. + uBeat); acc += vec3(.6,.2,.8)*exp(-r*3.)*.25;
  return toLin(clamp(mix(acc, DS(t)*vec3(.85,1.05,1.)*1.1, MM(t)),0.,1.)); }`);

fx("Marianne", "mar_acidheat", "Acid Heat", "fold", "crackle", `${MAR_LIB}
vec3 fx(vec2 t){ float l0 = lum(DS(t)); float l = fract(l0*mix(1.,2.2,uA));
  vec3 col = mix(vec3(.6,0.,0.), vec3(1.,.3,0.), smoothstep(.15,.4,l)); col = mix(col, vec3(.95,.9,.1), smoothstep(.4,.6,l));
  col = mix(col, vec3(.3,1.,.2), smoothstep(.6,.85,l)); col *= smoothstep(.02,.12,l0);
  float crack = step(.58, fbm(AS(t)*8. + uTime*.3))*step(.2, l0);
  vec3 bg = col*crack*uB*.9;
  return toLin(clamp(mix(bg, col, MM(t)),0.,1.)); }`);

fx("Marianne", "mar_cyanritual", "Cyan Ritual", "bloom", "pink accents", `${MAR_LIB}
vec3 fx(vec2 t){ vec3 c = DS(t); float l = lum(c);
  vec3 col = mix(vec3(0.,.04,.18), vec3(.1,.6,1.), smoothstep(0.,.5,l)); col = mix(col, vec3(.85,1.,1.), smoothstep(.5,.95,l));
  float warm = smoothstep(0., .25, c.r - max(c.g,c.b)*.8);
  col = mix(col, vec3(1.,.15,.75)*(.6 + l), clamp(warm*uB*1.6, 0., 1.));
  col += lum(mBloom(t,.04))*vec3(.3,.8,1.)*uA*2.;
  return toLin(clamp(col,0.,1.))*mVig(t,.5); }`);

fx("Marianne", "mar_fringehalo", "Fringe Halo", "spikes", "speed", `${MAR_LIB}
vec3 fx(vec2 t){ vec2 p = (t-uBody.xy)*vec2(uAspect,1.); float a = atan(p.y,p.x), r = length(p); float m = MM(t);
  float near = mBlur(t,.03)*.35 + mBlur(t,.08)*.35 + mBlur(t,.16)*.3;
  float sp = noise(vec2(a*40., uTime*2.))*noise(vec2(a*13. + 3., uTime*.7));
  float ray = pow(sp, .8)*near*(1.-m)*mix(2.,6.,uA)*(1. + uBeat);
  ray *= .4 + .8*noise(vec2(a*300., r*4. - uTime*(1. + uB*3.)));
  vec3 rc = rainbow(a/TAU*2. + r*2. - uTime*.2)*.7 + vec3(1.,.9,.8)*.3;
  vec3 bg = mix(vec3(.3,.06,.22), vec3(.05,0.,.08), clamp(r*1.5,0.,1.)) + rc*near*(1.-m)*.45;
  vec3 sil = DS(t)*.15 + vec3(.02,0.,.03);
  return toLin(clamp(mix(bg + rc*ray, sil, m), 0., 1.)) + mGrain(t,.03); }`);

fx("Marianne", "mar_sparks", "Grinder Sparks", "density", "speed", `${MAR_LIB}
float sparks(vec2 t, vec2 e, float dir){ vec2 p = (t-e)*vec2(uAspect,1.); float r = length(p); float a = atan(-p.y, p.x*dir);
  if(a < .12 || a > 1.65) return 0.;
  float u = a/PI*240.; float id = floor(u); float h = hash(vec2(id, dir)); float fa = abs(fract(u) - .5);
  float s = fract(r*1.5 - uTime*(1.2 + h*2.)*(1. + uB*2.) - h*7.); float len = .08 + .18*h;
  return smoothstep(len, 0., s)*step(mix(.75,.15,uA), h)*smoothstep(.28/max(r*3.,.3), 0., fa)*smoothstep(1.3, .1, r); }
vec3 fx(vec2 t){ vec2 e = vec2(uBody.z, 1.02);
  vec3 col = DS(t)*vec3(.6,.75,1.)*.9;
  float s = sparks(t, e + vec2(-.04,0.), -1.) + sparks(t, e + vec2(.04,0.), 1.);
  col += mix(vec3(1.,.8,.45), vec3(.8,.9,1.), hash(floor(t*200.)))*s*(2.5 + uBeat);
  col += vec3(.9,.9,1.)*exp(-length((t-e)*vec2(uAspect,1.))*5.)*.7;
  return toLin(clamp(col,0.,1.)); }`);

fx("Marianne", "mar_blowngrain", "Blown Grain", "exposure", "violet", `${MAR_LIB}
vec3 fx(vec2 t){ float l = clamp((lum(DS(t)) - .12)*mix(1.6,3.2,uA), 0., 1.) + (hash(floor(t*vec2(960.,540.)) + fract(uTime*24.)*77.) - .5)*.35;
  l = smoothstep(0., 1., clamp(l,0.,1.));
  vec3 col = mix(vec3(.1,.06,.32), mix(vec3(.2,.45,1.), vec3(.6,.25,1.), uB), smoothstep(.1,.5,l));
  col = mix(col, vec3(.95,.98,1.), smoothstep(.55,.9,l));
  return toLin(col); }`);

fx("Marianne", "mar_corridor", "Night Corridor", "vignette", "wall gels", `${MAR_LIB}
vec3 fx(vec2 t){ vec3 c = DS(t); float l = lum(c);
  vec3 tone = l < .5 ? mix(vec3(.05,.12,.18), vec3(.35,.45,.2), l*2.) : mix(vec3(.35,.45,.2), vec3(.95,.8,.9), (l-.5)*2.);
  vec3 col = mix(c, tone, .65)*vec3(.9,1.05,.95) + vec3(.03,.03,.05);
  col += vec3(.25,0.,.3)*smoothstep(.5,0.,t.x)*uB*.6 + vec3(0.,.2,.25)*smoothstep(.5,1.,t.x)*uB*.5;
  col += mBloom(t,.02)*vec3(1.,.4,.3)*.5;
  return toLin(clamp(col,0.,1.))*mVig(t, mix(.5,1.3,uA)) + mGrain(t,.05); }`);

fx("Marianne", "mar_fenceghost", "Fence Ghost", "fence", "stipple", `${MAR_LIB}
vec3 fx(vec2 t){ vec2 p = AS(t); vec2 g = rot(.785)*p*mix(14.,32.,uA); vec2 fg = fract(g);
  float fw = min(min(fg.x, 1.-fg.x), min(fg.y, 1.-fg.y)); float wire = smoothstep(.07, .02, fw);
  float l = lum(DS(t)); float m = MM(t);
  float st = step(1. - clamp(l*1.6 + .15, 0., 1.)*m, hash(floor(p*mix(320.,150.,uB)) + floor(uTime*20.)*.37));
  float glow = mBlur(t,.01)*.5 + mBlur(t,.03)*.3; vec3 cy = vec3(.4,.95,1.);
  vec3 col = vec3(0.,.02,.03) + cy*wire*(.2 + .7*fbm(p*2. - uTime*.05))*(1.-m) + cy*glow*.35 + vec3(.85,1.,1.)*st + cy*edgeN(t,1.5)*m*.6;
  return toLin(clamp(col,0.,1.)); }`);

fx("Marianne", "mar_possession", "Blue Possession", "cyan clip", "eyes", `${MAR_LIB}
vec3 fx(vec2 t){ vec3 c = DS(t); float l = lum(c); float m = MM(t); vec3 n = N(t);
  vec3 fig = mix(vec3(.02,.05,.25), vec3(.15,.55,1.), smoothstep(.05,.55,l)); fig = mix(fig, vec3(.7,1.,1.), smoothstep(mix(.8,.4,uA), .9, l));
  fig += vec3(.2,.8,1.)*pow(1. - max(n.z,0.), 2.)*.5;
  vec3 bg = mix(vec3(.08,.02,.18), vec3(.55,.02,.2), smoothstep(.1,.6,l)) + vec3(1.,.05,.25)*smoothstep(.55,.9,l)*.8;
  vec2 g = AS(t)*vec2(7.,5.); vec2 id = floor(g), f = fract(g); float h = hash(id); vec2 e = vec2(.35 + .2*h, .4 + .2*hash(id + 1.));
  float eyes = smoothstep(.035, 0., length((f-e)*vec2(1.,1.4))) + smoothstep(.035, 0., length((f - e - vec2(.13,0.))*vec2(1.,1.4)));
  bg += vec3(.4,.9,1.)*eyes*step(.55, h)*step(.12, fract(uTime*.3 + h))*uB*1.6;
  return toLin(clamp(mix(bg, fig, m),0.,1.))*mVig(t,.6); }`);

fx("Marianne", "mar_pinkflood", "Pink Flood", "bloom", "lime side", `${MAR_LIB}
vec3 fx(vec2 t){ vec3 c = DS(t); float l = lum(c); vec3 n = N(t); float m = MM(t);
  float side = clamp(mix(smoothstep(.75,.2, t.x + .1*sin(t.y*3.)), smoothstep(.2,.8,-n.x), m)*uB*1.5, 0., 1.);
  vec3 pink = mix(vec3(.45,0.,.12), vec3(1.,.2,.45), smoothstep(0.,.6,l)); pink = mix(pink, vec3(1.,.82,.9), smoothstep(.65,1.,l));
  vec3 lime = mix(vec3(.1,.3,0.), vec3(.6,1.,.2), smoothstep(0.,.7,l));
  vec3 col = mix(mix(pink, lime, side*.85), c, .15) + mBloom(t,.03)*vec3(1.,.5,.7)*uA*1.5;
  return toLin(clamp(col,0.,1.)) + mGrain(t,.02); }`);

fx("Marianne", "mar_toxic", "Toxic Split", "swap", "bloom", `${MAR_LIB}
vec3 fx(vec2 t){ vec3 n = N(t); float m = MM(t); float l = lum(DS(t));
  float k = mix(smoothstep(-.3,.3,(t.x-.5)*2.), smoothstep(-.4,.4,n.x), m);
  vec3 a = vec3(.15,1.,.3), b = vec3(.85,.1,1.);
  vec3 tint = mix(mix(a,b,k), mix(b,a,k), uA);
  vec3 col = (tint*pow(l,.85)*1.4 + vec3(0.,.02,.05))*smoothstep(.02,.15,l) + lum(mBloom(t,.04))*tint*uB;
  return toLin(clamp(col,0.,1.))*mVig(t,.6); }`);

fx("Marianne", "mar_pinkinferno", "Pink Inferno", "columns", "speed", `${MAR_LIB}
vec3 fx(vec2 t){ vec2 p = AS(t);
  float f = fbm(vec2(p.x*6., p.y*2. + uTime*(1.2 + uB*2.))); f = fbm(vec2(p.x*5. + f*1.5, p.y*3. + uTime*1.5));
  float cols = .5 + .5*sin(p.x*mix(8.,22.,uA) + f*3.);
  float band = smoothstep(.1,.45,t.y)*smoothstep(1.,.75,t.y);
  float I = clamp(f*1.6*cols*band + band*.25 - .2, 0., 1.)*(1. + uBass*.5);
  vec3 fl = mix(vec3(.6,.1,.4), vec3(1.,.55,.85), smoothstep(.1,.5,I)); fl = mix(fl, vec3(1.,.96,1.), smoothstep(.5,.85,I))*smoothstep(0.,.15,I);
  vec3 sil = vec3(.02,0.,.03) + vec3(.9,.4,.8)*edgeN(t,2.)*.4;
  return toLin(clamp(mix(fl, sil, MM(t)),0.,1.)); }`);

fx("Marianne", "mar_smokeghost", "Smoke Ghost", "smoke", "drift", `${MAR_LIB}
vec3 fx(vec2 t){ vec2 p = AS(t); float tm = uTime*.15*(1. + uB*2.);
  float s = fbm(p*2. + vec2(fbm(p*3. + tm), fbm(p*3. - tm + 4.))*1.5);
  vec3 bg = mix(vec3(1.,.84,.9), vec3(.95,.72,.86), t.y);
  bg = mix(bg, vec3(.15,.1,.25), smoothstep(.55,.75,s)*.65*uA);
  bg = mix(bg, vec3(.9,.25,.5), smoothstep(.68,.71, fbm(p*4. + tm))*.5);
  float soft = mBlur(t,.015);
  vec3 fig = mix(vec3(.04,.07,.25), vec3(.2,.25,.6), lum(DS(t)));
  vec2 g = floor(p*80.); fig += vec3(1.,.7,.9)*step(.985, hash(g))*(.5 + .5*sin(uTime*3. + hash(g + 1.)*20.)) + vec3(.7,.2,.6)*fbm(p*6. + tm)*.4;
  return toLin(clamp(mix(bg, fig, smoothstep(.2,.8,soft)),0.,1.)); }`);

fx("Marianne", "mar_solar", "Solar Scream", "fold", "cycle", `${MAR_LIB}
vec3 fx(vec2 t){ float v = fract(lum(DS(t))*mix(1.,1.8,uA) + uTime*.05*uB);
  vec3 col = mix(vec3(.05,.1,.5), vec3(.1,.8,.85), smoothstep(0.,.25,v)); col = mix(col, vec3(.3,.9,.2), smoothstep(.25,.42,v));
  col = mix(col, vec3(1.,.9,.1), smoothstep(.42,.58,v)); col = mix(col, vec3(1.,.42,.05), smoothstep(.58,.74,v)); col = mix(col, vec3(1.,.97,.86), smoothstep(.74,.92,v));
  return toLin(col) + mGrain(t,.02); }`);

fx("Marianne", "mar_rgbmelt", "RGB Melt", "split", "warp", `${MAR_LIB}
vec3 fx(vec2 t){ float s = mix(.008,.05,uA)*(1. + uBeat); vec2 p = AS(t);
  vec2 wv = vec2(sin(t.y*20. + uTime*2.)*.01 + (fbm(vec2(t.y*8., uTime)) - .5)*.05, 0.)*uB;
  vec3 col = vec3(lum(DS(t + wv + vec2(s,0.))), lum(DS(t + wv))*.8, lum(DS(t + wv - vec2(s,0.))));
  vec3 fig = toLin(clamp(col*1.1, 0., 1.));
  vec3 prev = PV(t + vec2(0.,-.004) + (vec2(fbm(p*4. + uTime*.3), fbm(p*4. - uTime*.3)) - .5)*.012);
  vec3 marble = pal(fbm(p*3. + uTime*.1)*2., vec3(.6,.3,.2), vec3(.4,.3,.2), vec3(1.), vec3(0.,.15,.3));
  float m = MM(t); vec3 o = mix(mix(toLin(clamp(marble,0.,1.))*.7, prev, .7), fig, m);
  o += (vec3(.8,0.,0.)*MM(t + vec2(s*2.,0.)) + vec3(0.,.4,.8)*MM(t - vec2(s*2.,0.)))*(1.-m)*.6;
  keep(o); return o; }`);

fx("Marianne", "mar_xray", "Spectral X-Ray", "edges", "shimmer", `${MAR_LIB}
vec3 fx(vec2 t){ float m = MM(t); float l = lum(DS(t)); vec3 n = N(t); vec2 p = AS(t);
  float e = max(edgeL(t,1.5), edgeN(t,1.5));
  vec3 base = vec3(.02,.12,.15) + vec3(.1,.55,.6)*(1.-l)*m*.8;
  float fib = noise(vec2(p.x*200., p.y*30.));
  vec3 sp = rainbow(n.x*.6 + n.y*.4 + l*1.5 + uTime*.1*(.2 + uB*2.));
  vec3 col = base*(.7 + .4*fib) + sp*e*mix(.6,1.6,uA) + sp*smoothstep(.55,.9,l)*m*.6 + vec3(0.,.08,.1)*(1.-m)*fbm(p*4.);
  return toLin(clamp(col,0.,1.)); }`);

fx("Marianne", "mar_drowning", "Drowning Blue", "ripple", "green wash", `${MAR_LIB}
vec3 fx(vec2 t){ vec2 p = AS(t); vec2 w = vec2(sin(p.y*25. + uTime*2.3), cos(p.x*22. + uTime*1.9))*.002*(1. + uA*3.);
  float l = lum(DS(t + w));
  vec3 col = mix(vec3(.03,.02,.25), vec3(.15,.3,1.), smoothstep(0.,.45,l)); col = mix(col, vec3(.75,1.,.3), smoothstep(.5,.9,l)*.8);
  col = mix(col, col*vec3(.6,1.3,.8), smoothstep(.3,.9, fbm(p*2. + uTime*.1))*uB);
  float ca = 1. - smoothstep(0., .1, voro(p*7. + uTime*.4).y); col += vec3(.4,.6,1.)*ca*ca*.25;
  vec2 g = vec2(p.x*14., p.y*8. + uTime*2.); vec2 id = floor(g), f = fract(g) - .5;
  col += vec3(.8,.95,1.)*smoothstep(.03, 0., abs(length(f - (hash2(id) - .5)*.5) - .03 - .08*hash(id + 3.)))*step(.75, hash(id))*.7;
  return toLin(clamp(col,0.,1.)); }`);

fx("Marianne", "mar_uvpaint", "UV Paint", "blob size", "reshuffle", `${MAR_LIB}
vec3 fx(vec2 t){ float l = lum(DS(t)); float m = MM(t); vec2 p = AS(t);
  vec3 base = mix(vec3(.02,.03,.15), vec3(.2,.3,.8), smoothstep(0.,.6,l));
  float seed = floor(uBeatN*.5) + floor(uTime*.5*uB); float k = mix(14.,5.,uA);
  float bl = noise(vec2(p.x*k, p.y*k*.35) + seed*5.3); float pa = smoothstep(.58,.62,bl)*m;
  float hi = noise(p*2.5 + seed*2.1);
  vec3 pc = hi < .4 ? vec3(1.,.95,.1) : hi < .55 ? vec3(1.,.2,.7) : hi < .7 ? vec3(.1,1.,.9) : vec3(1.,.5,.05);
  vec3 col = mix(base, pc*(.6 + .6*l), pa) + pc*smoothstep(.5,.58,bl)*m*.25*(1.-pa);
  return toLin(clamp(col,0.,1.)); }`);

fx("Marianne", "mar_ghostdance", "Ghost Dance", "trail", "pink edge", `${MAR_LIB}
vec3 fx(vec2 t){ vec3 c = DS(t); float l = lum(c);
  vec3 cur = toLin(clamp(mix(mix(vec3(.1,.35,.4), vec3(.75,1.,.95), smoothstep(.05,.8,l)), c, .25), 0., 1.));
  vec3 prev = PV(t + vec2(.002*sin(uTime*1.3), .001));
  vec3 col = max(mix(cur, prev, mix(.5,.92,uA)), cur*.7); keep(col);
  return col + toLin(vec3(.9,.4,.7))*smoothstep(.1,.35, length(prev - cur))*.25*uB + mGrain(t,.03); }`);

fx("Marianne", "mar_curtainproj", "Curtain Projection", "zoom", "magenta", `${MAR_LIB}
vec3 fx(vec2 t){ vec2 q = uBody.zw + (t - vec2(.5,.45))/mix(2.5,4.5,uA);
  float fold = .5 + .5*sin(AS(t).x*75. + sin(t.y*3.)*.5);
  float pl = lum(DS(q + vec2((fold-.5)*.004, 0.)));
  vec3 bg = mix(vec3(.05,.02,.25), mix(vec3(.2,.5,1.), vec3(1.,.3,.8), uB), smoothstep(0.,.7,pl))*(.55 + .45*fold) + vec3(.05,0.,.1);
  return toLin(clamp(mix(bg, DS(t)*vec3(.7,.75,1.1), MM(t)),0.,1.))*mVig(t,.7); }`);
