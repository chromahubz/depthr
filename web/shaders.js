// DEPTHR shader suite. All passes work in "source space": t = (0,0) top-left of the camera frame,
// world coords x right (aspect units), y down, z toward the viewer (DAViD depth, near = 1).
"use strict";
const MAXL = 16;

const SH_VS = `#version 300 es
in vec2 p; out vec2 uv; void main(){ uv = vec2(p.x*.5+.5, .5-p.y*.5); gl_Position = vec4(p,0,1); }`;

const SH_COMMON = `
precision highp float; precision highp int;
uniform sampler2D uCam, uAux;
uniform vec2 uAuxSize; uniform float uAspect, uTime, uCut; uniform vec3 uFlip;
vec2 cy(vec2 t){ return vec2(t.x, clamp(t.y, .5/uAuxSize.y, 1.-.5/uAuxSize.y)); }
vec4 auxTop(vec2 t){ t = cy(t); return texture(uAux, vec2(t.x, t.y*.5)); }
vec4 auxBot(vec2 t){ t = cy(t); return texture(uAux, vec2(t.x, .5 + t.y*.5)); }
float depthAt(vec2 t){ vec4 b = auxBot(t); return (b.r*65280. + b.g*255.)/65535.; }
float matteAt(vec2 t){ return auxTop(t).a; }
vec3 normalAt(vec2 t){ return normalize((auxTop(t).rgb*2.-1.)*uFlip + 1e-5); }
vec3 toLin(vec3 c){ return pow(max(c,0.), vec3(2.2)); }
vec3 toSrgb(vec3 c){ return pow(max(c,0.), vec3(1./2.2)); }
vec4 fbo(sampler2D s, vec2 t){ return texture(s, vec2(t.x, 1.-t.y)); }
float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
vec2 hash2(vec2 p){ return vec2(hash(p), hash(p+19.19)); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*noise(p); p=p*2.03+7.1; a*=.5; } return s; }
`;

// ------------------------------------------------------------------ scene (uber) pass
const SH_SCENE = `#version 300 es
${SH_COMMON}
in vec2 uv; out vec4 o;
uniform sampler2D uPlate; uniform highp sampler2D uSpell;
uniform int uMat, uN, uWorld, uScan, uSpellN;
uniform vec3 uTint;
uniform float uAmb, uAlb, uSpec, uGloss, uWrap, uBg, uDepth, uShadow, uLong, uRim, uBands, uInk, uBlack, uSoft;
uniform vec3 uLP[${MAXL}]; uniform vec4 uLD[${MAXL}], uLC[${MAXL}], uLX[${MAXL}];
uniform float uSunOn; uniform vec3 uSunDir, uSunCol, uSkyCol; uniform float uSkyAmt;
uniform float uScanPos, uScanW, uContours; uniform vec3 uScanCol;
uniform float uFog; uniform vec3 uFogCol;
uniform float uBass, uBeat;

// heights used by shadow marching; with a virtual world only the person occludes
float hgt(vec2 q){ float d = depthAt(q); return (uWorld>0 ? d*smoothstep(.3,.7,matteAt(q)) : d)*uDepth; }
float shadowMarch(vec2 a, vec3 P, vec3 L){
  vec2 b = vec2(L.x/uAspect, L.y);
  int steps = uLong>.5 ? 30 : 12;
  float occ = 0.;
  for(int k=1;k<=30;k++){
    if(k>steps) break;
    float f = float(k)/float(steps+1);
    vec2 q = mix(a,b,f);
    if(q.x<0.||q.x>1.||q.y<0.||q.y>1.) break;
    float rz = mix(P.z, L.z, f);
    occ = max(occ, smoothstep(.004, .03, hgt(q) - rz - .004) * (1.-f*(uLong>.5 ? .15 : .6)));
  }
  return 1. - occ*uShadow;
}

vec3 gDif, gSpe;
void lightAll(vec2 t, vec3 P, vec3 N, float w, float gloss){
  gDif = vec3(0); gSpe = vec3(0);
  vec3 V = vec3(0,0,1);
  for(int i=0;i<${MAXL};i++){
    if(i>=uN) break;
    vec3 tl = P - uLP[i]; float dist = length(tl); vec3 ld = tl/max(dist,1e-4);
    float cosO = uLD[i].w;
    float spot = cosO < -1.5 ? 1. : smoothstep(cosO, mix(cosO,1.,uSoft), dot(ld, uLD[i].xyz));
    if(spot <= 0.) continue;
    float ndl = dot(N,-ld);
    float diff = max((ndl+uWrap)/(1.+uWrap), 0.);
    float att = 1./(1. + pow(dist/uLC[i].w, 2.)*6.);
    vec3 H = normalize(-ld + V);
    float sp = pow(max(dot(N,H),0.), gloss) * step(0., ndl);
    float sh = (uShadow>0. && uLX[i].z<.5) ? shadowMarch(t, P, uLP[i]) : 1.;
    vec3 c = uLC[i].rgb*spot*att*sh*w;
    gDif += c*diff; gSpe += c*sp;
  }
  if(uSunOn>.5){
    vec3 Ls = normalize(uSunDir);
    float ndl = dot(N,Ls);
    float diff = max((ndl+uWrap)/(1.+uWrap), 0.);
    float sh = uShadow>0. ? shadowMarch(t, P, P + Ls*1.2) : 1.;
    vec3 H = normalize(Ls+V);
    float sp = pow(max(dot(N,H),0.), gloss)*step(0., ndl);
    gDif += uSunCol*diff*sh*w; gSpe += uSunCol*sp*sh*w;
    gDif += uSkyCol*uSkyAmt*(.5-.5*N.y)*w;   // y down: -N.y faces the sky
  }
}

vec3 studio(vec3 R){
  float up = -R.y;
  vec3 sky = mix(vec3(.5,.58,.72), vec3(1.05), smoothstep(0.,.8,up));
  vec3 gnd = mix(vec3(.04,.035,.03), vec3(.22,.18,.15), smoothstep(-.9,-.05,up));
  vec3 c = up>0. ? sky : gnd;
  c += smoothstep(.03,0.,abs(up-.01))*.8;
  c += (smoothstep(.07,0.,abs(R.x-.55))*smoothstep(-.1,.4,up) + smoothstep(.05,0.,abs(R.x+.6))*smoothstep(0.,.5,up))*3.;
  return c;
}
vec3 thermalPal(float x){
  x = clamp(x,0.,1.);
  vec3 c = vec3(smoothstep(.15,.6,x), smoothstep(.45,.9,x), smoothstep(.0,.25,x)*(1.-smoothstep(.35,.6,x))*.9 + smoothstep(.85,1.,x));
  return toLin(c*vec3(1.,.95,1.)) * 1.3 + vec3(.02,0.,.04);
}

// ---------------- worlds (emissive backdrops)
vec3 wStars(vec2 t){
  vec2 p = vec2(t.x*uAspect, t.y);
  vec3 c = vec3(.002,.003,.012);
  c += vec3(.22,.06,.32)*pow(fbm(p*2.2+vec2(uTime*.01,0.)),3.)*1.6 + vec3(.04,.12,.3)*pow(fbm(p*1.6-3.),4.)*2.4;
  for(int l=0;l<3;l++){
    float sc = 45. + float(l)*55.;
    vec2 g = p*sc + vec2(uTime*(.4+float(l)*.6), 0.);
    vec2 id = floor(g), f = fract(g)-.5;
    float h = hash(id + float(l)*17.);
    if(h>.9){
      vec2 of = (hash2(id+3.1)-.5)*.6;
      float tw = .55 + .45*sin(uTime*(1.5+h*5.) + h*40.);
      c += vec3(.8,.86,1.)*smoothstep(.14,0.,length(f-of))*tw*(h-.9)*16.;
    }
  }
  return c;
}
vec3 wDesert(vec2 t){
  vec2 p = vec2(t.x*uAspect, t.y);
  float hz = .62;
  vec3 c = mix(vec3(.015,.015,.06), vec3(.95,.4,.18), pow(clamp(t.y/hz,0.,1.),3.2));
  vec2 mc = vec2(.74*uAspect, .2); float md = length(p-mc);
  c += vec3(1.,.92,.78)*smoothstep(.052,.047,md) + vec3(.7,.45,.3)*.12/(1.+md*25.);
  vec2 g = p*80.; float h = hash(floor(g));
  c += vec3(.9)*step(.985,h)*smoothstep(.3,0.,length(fract(g)-.5))*(1.-t.y/hz)*(.6+.4*sin(uTime*2.+h*30.));
  float y1 = hz + .04*sin(p.x*3.+1.) + .025*sin(p.x*7.3);
  float y2 = hz + .11 + .05*sin(p.x*2.1+2.) + .02*sin(p.x*9.);
  float y3 = hz + .24 + .07*sin(p.x*1.4+4.);
  if(t.y>y1) c = mix(vec3(.42,.14,.08), vec3(.12,.04,.05), clamp((t.y-y1)*7.,0.,1.));
  if(t.y>y2) c = mix(vec3(.26,.08,.06), vec3(.05,.02,.035), clamp((t.y-y2)*5.,0.,1.));
  if(t.y>y3) c = vec3(.025,.01,.018) + vec3(.16,.05,.03)*smoothstep(.08,0.,t.y-y3);
  return c;
}
vec3 wCrystal(vec2 t){
  vec2 p = vec2(t.x*uAspect, t.y)*5.;
  vec2 i = floor(p), f = fract(p); float d1 = 8., d2 = 8.; vec2 cid = vec2(0);
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){
    vec2 g = vec2(x,y); vec2 of = hash2(i+g); of = .5+.4*sin(uTime*.3 + 6.2831*of);
    float d = length(g+of-f);
    if(d<d1){ d2=d1; d1=d; cid=i+g; } else if(d<d2) d2=d;
  }
  float e = d2-d1, h = hash(cid);
  vec3 base = mix(vec3(.04,.015,.12), vec3(0.,.1,.16), h)*(1.-d1*.6);
  vec3 glow = mix(vec3(.15,.85,1.), vec3(.75,.25,1.), h)*smoothstep(.07,0.,e)*(.55+.45*sin(uTime*1.5+h*20.))*(1.+uBass*2.);
  float sp = pow(hash(cid*1.7+floor(uTime*3.)), 40.)*3.*smoothstep(.3,0.,d1);
  return base*.7 + glow + sp*vec3(.8,.9,1.);
}
vec3 wSynth(vec2 t){
  float hz = .56; vec2 p = vec2(t.x*uAspect, t.y);
  vec3 c;
  if(t.y<hz){
    c = mix(vec3(.02,0.,.07), vec3(.55,.04,.38), pow(t.y/hz,2.2));
    vec2 sc = vec2(.5*uAspect, hz-.16); float r = length(p-sc);
    float stripes = t.y < sc.y ? 1. : step(fract((t.y-sc.y)*34.), .7 - (t.y-sc.y)*3.2);
    vec3 sunc = mix(vec3(1.,.9,.25), vec3(1.,.15,.55), clamp((t.y-(sc.y-.15))/.3,0.,1.));
    c = mix(c, sunc*1.3, smoothstep(.152,.148,r)*stripes);
    c += vec3(1.,.25,.6)*.08/(1.+r*7.);
  } else {
    float y = t.y-hz; float z = .1/max(y,.002); float x = (p.x-.5*uAspect)*z;
    vec2 g = vec2(x*1.6, z*.8 - uTime*(1.1+uBass*2.5));
    vec2 gd = abs(fract(g-.5)-.5)/max(fwidth(g),1e-4);
    float line = 1.-min(min(gd.x,gd.y),1.);
    c = vec3(.025,0.,.05) + vec3(1.,.18,.85)*line*(1.2+uBeat*2.)*exp(-z*.06) + vec3(.6,.1,.5)*.25*exp(-y*25.);
  }
  return c;
}
vec3 wVoid(vec2 t){ vec2 p = vec2(t.x*uAspect,t.y); return vec3(.004,.005,.01) + vec3(.02,.015,.04)*fbm(p*3.+uTime*.05); }
vec3 world(vec2 t){
  if(uWorld==1) return wStars(t);
  if(uWorld==2) return wDesert(t);
  if(uWorld==3) return wCrystal(t);
  if(uWorld==4) return wSynth(t);
  return wVoid(t);
}

// ---------------- surfaces
float inkAt(vec2 t){
  vec2 e = vec2(1.5/uAuxSize.x, 1.5/uAuxSize.y);
  vec3 nx = normalAt(t+vec2(e.x,0.)) - normalAt(t-vec2(e.x,0.));
  vec3 ny = normalAt(t+vec2(0.,e.y)) - normalAt(t-vec2(0.,e.y));
  float dd = abs(depthAt(t+vec2(e.x,0.))-depthAt(t-vec2(e.x,0.))) + abs(depthAt(t+vec2(0.,e.y))-depthAt(t-vec2(0.,e.y)));
  float mm = abs(matteAt(t+vec2(e.x,0.))-matteAt(t-vec2(e.x,0.))) + abs(matteAt(t+vec2(0.,e.y))-matteAt(t-vec2(0.,e.y)));
  return smoothstep(.55, 1.1, ((length(nx)+length(ny))*.8 + dd*10. + mm*1.6)*uInk);
}
vec3 photo(vec2 t, vec3 cam, vec3 N, vec3 P, float w, float amb){
  lightAll(t, P, N, w, uGloss);
  vec3 alb = mix(vec3(.22), cam*1.7+.02, uAlb);
  return cam*amb + alb*gDif + gSpe*uSpec;
}
vec3 person(vec2 t, vec3 cam, vec3 N, vec3 P, float d, float w, float amb){
  vec3 V = vec3(0,0,1);
  float fres = pow(1.-max(N.z,0.), 3.);
  vec3 R = reflect(-V, N);
  if(uMat==0) return photo(t, cam, N, P, w, amb);
  if(uMat==5){ // anime ink
    lightAll(t, P, N, w, uGloss);
    vec3 alb = toLin(floor(toSrgb(cam)*4.+.5)/4.)*1.8 + .02;
    vec3 L = vec3(amb*1.4) + gDif;
    float li = dot(L, vec3(.3,.59,.11));
    float q = floor(li*uBands + .35)/uBands;
    vec3 c = alb*(L/max(li,1e-3))*q + step(.35, dot(gSpe,vec3(.33)))*uSpec*.6;
    return c*(1.-inkAt(t));
  }
  if(uMat==1 || uMat==2){ // chrome / gold
    lightAll(t, P, N, w, max(uGloss,60.));
    vec3 tint = uMat==2 ? vec3(1.,.7,.3) : uTint;
    vec3 env = mix(studio(R), toLin(texture(uCam, t - N.xy*.12).rgb)*2., .3);
    return tint*(env*(amb*1.4+.12)*(.35+.65*fres) + gDif*.25) + gSpe*(2.+uSpec*2.)*mix(vec3(1.),tint,.5);
  }
  if(uMat==3){ // glass: refract the clean plate behind you
    lightAll(t, P, N, w, 140.);
    vec3 behind = toLin(fbo(uPlate, t + N.xy*.07).rgb);
    return behind*uTint*.92 + studio(R)*fres*.45*(amb+.25) + gSpe*3. + gDif*.06;
  }
  if(uMat==4){ // clay render
    lightAll(t, P, N, w, 12.);
    vec3 hemi = mix(vec3(.22,.2,.18), vec3(.58,.6,.68), .5-.5*N.y);
    return uTint*(hemi*amb*1.4 + gDif) + gSpe*.12;
  }
  if(uMat==6){ // predator cloak
    lightAll(t, P, N, w, 60.);
    vec3 behind = toLin(fbo(uPlate, t + N.xy*.035 + sin(t.yx*60.+uTime*3.)*.0015).rgb);
    return behind*(1.+fres*.25) + fres*vec3(.35,.7,1.)*.22*(1.+uBeat) + gSpe*.6;
  }
  // thermal
  lightAll(t, P, N, w, uGloss);
  float heat = clamp(d*.7 + (.5+.5*N.z)*.3 + dot(gDif, vec3(.15)), 0., 1.);
  return thermalPal(heat)*(.45+amb*1.5) + gDif*.25;
}

// ---------------- emissive extras
vec3 spells(vec2 t, float dS){
  vec3 acc = vec3(0);
  vec2 p = vec2(t.x*uAspect, t.y);
  vec4 prev = texelFetch(uSpell, ivec2(0,0), 0);
  for(int i=1;i<256;i++){
    if(i>=uSpellN) break;
    vec4 cur = texelFetch(uSpell, ivec2(i,0), 0);
    if(cur.w > 0. && prev.w != 0.){
      vec2 a = vec2(prev.x*uAspect, prev.y), b = vec2(cur.x*uAspect, cur.y);
      vec2 ab = b-a; float h = clamp(dot(p-a,ab)/max(dot(ab,ab),1e-9), 0., 1.);
      float dist = length(p-a-ab*h);
      if(dist < .08){
        float z = mix(prev.z, cur.z, h);
        float vis = 1. - smoothstep(.02, .07, dS - z);
        float life = min(abs(prev.w), cur.w);
        vec3 hue = .55 + .45*cos(6.2831*(float(i)*.007 + uTime*.07 + vec3(0.,.33,.67)));
        float core = exp(-dist*dist/(.0028*.0028));
        float halo = exp(-dist/.016)*.55;
        acc = max(acc, (hue*halo + vec3(1.)*core*1.6 + hue*core)*life*vis*2.2);
      }
    }
    prev = cur;
  }
  return acc;
}
vec3 orbs(vec2 t, float dS){
  vec3 acc = vec3(0);
  vec2 p = vec2(t.x*uAspect, t.y);
  for(int i=0;i<${MAXL};i++){
    if(i>=uN) break;
    float s = uLX[i].x; if(s<=0.) continue;
    float dist = length(p - uLP[i].xy);
    float vis = 1. - smoothstep(.02, .07, dS - uLX[i].y);
    vec3 c = uLC[i].rgb/max(max(uLC[i].r,max(uLC[i].g,uLC[i].b)),1e-3);
    acc += (c*exp(-dist/s)*.9 + vec3(1.)*exp(-dist*dist/(s*s*.06))*2.5)*vis*min(1., length(uLC[i].rgb)*.4);
  }
  return acc;
}
vec3 scanFx(vec2 t, float d, float m){
  if(uScan==0) return vec3(0);
  float e = 0.;
  if(uScan==1){ float x = (d-uScanPos)/uScanW; e = exp(-x*x)*(.35+.65*m) + exp(-max(x,0.)*2.)*step(0.,x)*.06*m; }
  else if(uScan==2){ float x = (t.y - (1.-d)*.06 - uScanPos)/(uScanW*.5); e = exp(-x*x)*(.15+.85*m) + exp(-abs(x)*.08)*.05*m; }
  else { float v = d*uContours - uScanPos*4.; float c = fract(v); float lw = fwidth(v)*1.3; e = (1.-smoothstep(0., lw, min(c,1.-c)))*(.2+.8*m); }
  return uScanCol*e*2.2*(1.+uBeat);
}

void main(){
  vec2 t = uv;
  vec3 cam = toLin(texture(uCam, t).rgb);
  vec3 N = normalAt(t);
  float m = matteAt(t);
  float d = depthAt(t);
  vec3 P = vec3(t.x*uAspect, t.y, d*uDepth);
  float amb = uAmb*(1.-uBlack);
  vec3 col;
  float mm = smoothstep(.15, .85, m);
  if(uWorld>0){
    vec3 wc = world(t)*(1.-uBlack*.8);
    vec3 wcol = wc;
    if(mm < .99){
      vec3 Pw = vec3(t.x*uAspect, t.y, 0.);
      lightAll(t, Pw, vec3(0,0,1), 1., 16.);
      wcol = wc + (wc*.5 + .1)*gDif;
    }
    vec3 pc = mm > .01 ? person(t, cam, N, P, d, 1., amb) : vec3(0);
    col = mix(wcol, pc, mm);
  } else if(uMat==0){
    col = photo(t, cam, N, P, mix(uBg,1.,m), amb);
  } else {
    vec3 pc = mm > .01 ? person(t, cam, N, P, d, 1., amb) : vec3(0);
    vec3 bc;
    if(uMat==7) bc = thermalPal(d*.35)*.5;
    else if(mm < .99) bc = photo(t, cam, N, P, uBg, amb);
    col = mix(bc, pc, mm);
  }
  // rim light from the average light colour, swollen by bass
  if(uRim > 0.){
    vec3 avg = uSunOn>.5 ? uSunCol : vec3(0); float n = uSunOn>.5 ? 1. : 0.;
    for(int i=0;i<${MAXL};i++){ if(i>=uN) break; avg += uLC[i].rgb; n += 1.; }
    if(n < .5){ avg = vec3(.6,.7,1.); n = 1.; }
    col += avg/n*pow(1.-max(N.z,0.),3.)*m*uRim*(.5+uBass*1.5);
  }
  col += scanFx(t, d, m);
  if(uFog > 0.) col = mix(col, uFogCol, clamp(pow(1.-d,1.6)*uFog,0.,1.));
  if(uCut > .5) col *= smoothstep(.12, .55, matteAt(t));   // cutout: room/world gone, glowing magic stays
  if(uSpellN > 1) col += spells(t, d);
  col += orbs(t, d);
  o = vec4(col, 1.);
}`;

// ------------------------------------------------------------------ clean background plate
const SH_PLATE = `#version 300 es
${SH_COMMON}
in vec2 uv; out vec4 o;
uniform sampler2D uPrev; uniform float uInit;
void main(){
  vec3 cam = texture(uCam, uv).rgb;
  float m = matteAt(uv);
  float k = uInit>.5 ? 1. : (1.-smoothstep(.04,.35,m))*.05;
  o = vec4(mix(fbo(uPrev, uv).rgb, cam, k), 1.);
}`;

// ------------------------------------------------------------------ ghost trails (feedback)
const SH_GHOST = `#version 300 es
${SH_COMMON}
in vec2 uv; out vec4 o;
uniform sampler2D uPrev, uScene; uniform float uDecay; uniform vec2 uDrift; uniform vec3 uGhostTint;
void main(){
  vec3 prev = fbo(uPrev, uv + uDrift).rgb*uDecay;
  vec3 now = fbo(uScene, uv).rgb*smoothstep(.3,.8,matteAt(uv));
  now = mix(vec3(dot(now,vec3(.33))), now, .4)*uGhostTint;
  o = vec4(max(prev, now), 1.);
}`;

// ------------------------------------------------------------------ bloom
const SH_BRIGHT = `#version 300 es
${SH_COMMON}
in vec2 uv; out vec4 o;
uniform sampler2D uScene; uniform float uThresh;
void main(){
  vec3 c = fbo(uScene, uv).rgb;
  float l = max(c.r, max(c.g, c.b));
  o = vec4(c*max(l-uThresh, 0.)/max(l, 1e-4), 1.);
}`;
const SH_BLUR = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D uSrc; uniform vec2 uDir;
void main(){
  vec2 t = vec2(uv.x, 1.-uv.y);
  vec3 c = texture(uSrc, t).rgb*.2270;
  c += (texture(uSrc, t+uDir*1.385).rgb + texture(uSrc, t-uDir*1.385).rgb)*.3162;
  c += (texture(uSrc, t+uDir*3.231).rgb + texture(uSrc, t-uDir*3.231).rgb)*.0703;
  o = vec4(c, 1.);
}`;

// ------------------------------------------------------------------ post (to screen)
const SH_POST = `#version 300 es
${SH_COMMON}
in vec2 uv; out vec4 o;
uniform sampler2D uScene, uGhost, uBloom;
uniform int uView; uniform bool uMirror; uniform float uHolo, uFxOn;
uniform float uDof, uFocus, uAura, uAuraPulse, uGhostAmt, uBloomAmt, uChroma, uVig, uGrain, uFlash, uExpo;
uniform vec3 uAuraCol; uniform vec4 uWaves[4]; uniform vec2 uTexel;
vec3 sc(vec2 t){ return fbo(uScene, t).rgb; }
vec3 tone(vec3 c){ c = max(c, 0.); return c*(2.51*c+.03)/(c*(2.43*c+.59)+.14); }
void main(){
  vec2 t = uv; int v = uView;
  if(uView==4){ if(t.y<.5){ t.y*=2.; v=0; } else { t.y=(t.y-.5)*2.; v=1; } }
  if(uMirror) t.x = 1.-t.x;
  if(v==1){ o = vec4(auxTop(t).rgb, 1.); return; }
  if(v==2){ o = vec4(vec3(pow(depthAt(t),1.2)), 1.); return; }
  if(v==3){ o = vec4(mix(texture(uCam,t).rgb*.25, vec3(1.), matteAt(t)), 1.); return; }
  if(v==5){ o = vec4(texture(uCam,t).rgb, 1.); return; }

  // shockwaves bend space
  vec2 off = vec2(0); float ring = 0.;
  for(int i=0;i<4;i++){
    vec4 w = uWaves[i]; if(w.w <= 0.) continue;
    vec2 dv = (t - w.xy)*vec2(uAspect,1.); float dl = length(dv);
    float x = (dl - w.z*1.1)/.06; float g = exp(-x*x)*w.w;
    off += dv/max(dl,1e-4)*g*.04*vec2(1./uAspect,1.); ring += g;
  }
  vec2 ts = t - off;
  vec3 col;
  if(uDof > 0. && uHolo < .5){
    float coc = smoothstep(.06, .45, abs(depthAt(ts) - uFocus))*uDof;
    vec2 rad = uTexel*coc*10.*max(1., 1./(uTexel.y*720.));
    col = sc(ts); float wsum = 1.;
    for(int i=0;i<20;i++){
      float a = float(i)*2.39996, r = sqrt((float(i)+.5)/20.);
      col += sc(ts + vec2(cos(a),sin(a))*r*rad); wsum += 1.;
    }
    col /= wsum;
  } else col = sc(ts);
  float ca = uChroma*.006 + ring*.012;
  if(ca > 0.){ vec2 dir = (ts-.5); col.r = mix(col.r, sc(ts + dir*ca).r, .9); col.b = mix(col.b, sc(ts - dir*ca).b, .9); }
  float m = uHolo > .5 ? 0. : matteAt(ts);
  if(uGhostAmt > 0.) col += fbo(uGhost, ts).rgb*(1.-smoothstep(.2,.7,m))*uGhostAmt;
  if(uAura > 0. && uHolo < .5){
    float mb = 0.;
    for(int i=0;i<12;i++){
      float a = float(i)*.5236 + uTime*.7;
      vec2 dir = vec2(cos(a)/uAspect, sin(a));
      mb += matteAt(ts + dir*.018) + matteAt(ts + dir*.045)*.8 + matteAt(ts + dir*(.08 + .04*sin(uTime*2.+float(i))))*.5;
    }
    mb /= 12.*2.3;
    float flick = .75 + .25*fbm(ts*vec2(uAspect,1.)*6. + vec2(0., uTime*1.5));
    col += uAuraCol*smoothstep(.02,.6,mb)*(1.-smoothstep(.3,.7,m))*uAura*flick*(1.+uAuraPulse*2.)*1.6;
  }
  col += fbo(uBloom, ts).rgb*uBloomAmt;
  col += ring*vec3(.55,.8,1.)*.5;
  col += uFlash;
  col = tone(col*uExpo);
  float glowLin = max(col.r, max(col.g, col.b));
  col = toSrgb(col);
  vec2 q = uv - .5; col *= 1. - uVig*dot(q,q)*1.8;
  float alpha = 1.;
  if(uCut > .5){
    // only the character: alpha = body matte, plus anything glowing around it (aura, wings, particles, points)
    float body = uHolo > .5 ? 0. : smoothstep(.15, .6, matteAt(ts));
    // library effects paint their own backgrounds, so brightness can't tell "glow" from "room": use the body only
    float glow = uFxOn > .5 ? 0. : smoothstep(.006, .2, glowLin);
    alpha = max(body, glow);
  } else col += (hash(uv*vec2(1920.,1080.) + fract(uTime)*100.) - .5)*uGrain*.12;
  o = vec4(col, alpha);
}`;

// ------------------------------------------------------------------ hologram point cloud
const SH_HOLO_VS = `#version 300 es
${SH_COMMON}
// one renderer, many 3D looks (uStyle): 0 hologram · 1 ridgelines · 2 voxel statue · 3 particle storm · 4 sand sculpture
// 5 digital rain · 6 lidar sweep · 7 star body · 8 depth slices · 9 hologram trio (3 instances)
uniform ivec2 uGrid; uniform float uDepthH, uYaw, uPitch, uBeat, uBass, uTint, uHoloBg, uPx;
uniform int uStyle; uniform vec3 uHandP;
out vec3 vCol; out float vA; flat out int vSq;
vec3 turbo(float x){ x = clamp(x,0.,1.); return clamp(vec3(.13572+x*(4.6154+x*(-42.66+x*(132.13+x*(-152.95+x*59.29)))),
  .0914+x*(2.1942+x*(4.8430+x*(-14.19+x*(4.2773+x*2.8296)))), .1066+x*(12.642+x*(-60.58+x*(110.36+x*(-89.90+x*27.348))))), 0., 1.); }
vec3 hue(float h){ return clamp(abs(mod(h*6.+vec3(0.,4.,2.),6.)-3.)-1., 0., 1.); }
void main(){
  int id = gl_VertexID; int gx = id % uGrid.x, gy = id / uGrid.x;
  vSq = 0; vA = 1.;
  gl_Position = vec4(2.,2.,2.,1.); gl_PointSize = 0.;                                   // = culled unless set below
  if(uStyle==1 && gy % 5 != 0) return;
  if(uStyle==2 && (gx % 4 != 0 || gy % 4 != 0)) return;
  if(uStyle==5 && gx % 2 != 0) return;
  vec2 cell = vec2(gx,gy);
  vec2 t = (cell + (uStyle==2 ? 2. : .5))/vec2(uGrid);
  float d = depthAt(t), m = matteAt(t);
  bool bg = m < .45;
  if(bg && uHoloBg < .5) return;
  float h = hash(cell*.371 + 3.7);
  if(uStyle==7 && h > .5) return;                                                       // stars: sparser
  vec3 p = vec3((t.x-.5)*uAspect, -(t.y-.5), (d-.55)*uDepthH);
  vec3 cam = texture(uCam, t).rgb;
  float lum = dot(cam, vec3(.3,.59,.11));
  vec3 col; float sz = 1., yaw = uYaw;
  if(uStyle==1){                                   // ridgelines: one glowing line per few rows, depth = height
    p.z *= 1.7; sz = .75;
    col = mix(vec3(.85,.95,1.), cam*1.6, .35*(1.-uTint))*(.35+.65*smoothstep(.15,.75,d)) + uBeat*.25;
  } else if(uStyle==2){                            // voxel statue: blocky, quantised depth + palette, lit by normals
    p.z = floor(p.z*12.)/12.; vec3 n = normalAt(t);
    float sh = .35 + .65*max(dot(n, normalize(vec3(-.5,.55,.7))), 0.);
    vec3 c = pow(cam, vec3(.75))*1.15 + .04;
    col = mix(c, floor(c*4.+.5)/4., .6)*sh*1.9; vSq = 1; sz = 4.7;
  } else if(uStyle==3){                            // particle storm: points blow off the body, hand + kicks push harder
    float hd = uHandP.z > .5 ? length((t - uHandP.xy)*vec2(uAspect,1.)) : 9.;
    float push = smoothstep(.3, 0., hd)*.7 + uBeat*.45 + (.5+.5*sin(uTime*.7))*.06;
    vec3 dir = normalize(vec3(hash2(cell*.13)*2.-1., hash(cell*.29+1.)-.25) + 1e-4);
    p += dir*push*(.25 + h*.9);
    p.y += (noise(t*6. + uTime*.8)-.5)*.06*push;
    float heat = min(push*2.5*h, 1.);
    col = mix(cam*1.2, mix(vec3(1.,.35,.08), vec3(1.,.9,.6), h)*(.5+lum*1.5), heat); sz = .8 + h*.9;
  } else if(uStyle==4){                            // sand sculpture: crumbles top-down into a pile, then reforms
    float ph = fract(uTime/8.);
    float s = smoothstep(.12, .5, ph)*(1. - smoothstep(.68, .96, ph));
    float order = (1.-t.y)*.75 + h*.25;
    float fall = clamp((s*1.35 - order)/.25, 0., 1.);
    p.y -= fall*fall*1.3; p.x += (h-.5)*fall*.35; p.z += (hash(cell+9.)-.5)*fall*.4;
    p.y = max(p.y, -.52 + h*.04*fall);
    col = mix(vec3(1.,.78,.45), cam*1.3, .3*(1.-fall))*(.35+lum*1.1)*(1.+uBeat*.4); sz = .9;
  } else if(uStyle==5){                            // digital rain: falling bright streaks down every column
    float sp = .4 + hash(vec2(cell.x, 1.))*1.1;
    float b = pow(fract(-t.y*1.7 + uTime*sp*.45 + hash(vec2(cell.x, 2.))), 5.);
    col = vec3(.15,1.,.35)*(.08 + b*1.8)*(.45 + lum*1.4);
    col = mix(col, vec3(.85,1.,.9), smoothstep(.85,1.,b)); vSq = 1; sz = 1.15;
  } else if(uStyle==6){                            // lidar: turbo depth colours, a white plane sweeps through you
    float plane = fract(uTime*.3)*1.8 - .9;
    float sw = exp(-pow((p.x - plane)*16., 2.));
    col = turbo(1.15 - d*1.2)*(.25 + .35*lum + uBeat*.3) + vec3(1.)*sw*1.3; sz = .85;
  } else if(uStyle==7){                            // star body: you as a galaxy, twinkling, swirling on the bass
    float ang = (h-.5)*(.35 + .25*sin(uTime*.4)) + (h-.5)*uBass*.5;
    float c = cos(ang), s = sin(ang); p.xz = mat2(c,-s,s,c)*p.xz;
    float tw = .35 + .65*pow(hash(cell + floor(uTime*7.)), 3.);
    col = mix(vec3(.55,.65,1.), vec3(1.,.55,.9), hash(cell+5.))*(.5 + lum)*tw*1.4;
    sz = .55 + 2.6*pow(h*2., 12.);
  } else if(uStyle==8){                            // depth slices: you as 7 stacked glass layers, pulled apart
    float L = 7., k = floor(d*L), fr = fract(d*L);
    p.z = (k/L - .55)*uDepthH*1.25;
    col = mix(cam*1.1, hue(k/L*.8 + .5)*(.3 + lum), .55*uTint);
    col += vec3(.6,.9,1.)*smoothstep(.1, 0., min(fr, 1.-fr))*.7;
  } else if(uStyle==9){                            // trio: three holograms side by side, each turned
    float ins = float(gl_InstanceID) - 1.;
    p *= .6; yaw += ins*.6;
    vec3 tint = ins < -.5 ? vec3(1.,.3,.8) : ins > .5 ? vec3(1.,.75,.25) : vec3(.25,.85,1.);
    col = mix(cam, tint*(lum*1.4+.15), uTint)*(.65 + .35*step(.5, fract(t.y*float(uGrid.y)*.25 - uTime*3.)));
  } else {                                         // 0 classic hologram (row glitch on kicks, scanlines)
    float row = floor(t.y*60.);
    p.x += (hash(vec2(row, floor(uTime*14.))) - .5)*.12*uBeat*step(.7, hash(vec2(row*3.1, floor(uTime*14.))));
    vec3 holo = vec3(.25,.85,1.)*(lum*1.4+.15);
    float scan = .65 + .35*step(.5, fract(t.y*float(uGrid.y)*.25 - uTime*3.));
    col = mix(cam, holo, uTint)*scan;
    vA = .55 + .45*hash(vec2(float(id), floor(uTime*20.)))*.3;
  }
  float cy = cos(yaw), sy = sin(yaw), cp = cos(uPitch), sp = sin(uPitch);
  p = vec3(cy*p.x + sy*p.z, p.y, -sy*p.x + cy*p.z);
  p = vec3(p.x, cp*p.y - sp*p.z, sp*p.y + cp*p.z);
  if(uStyle==9) p.x += (float(gl_InstanceID) - 1.)*.5*uAspect;
  vec3 q = p - vec3(0., 0., 1.9);
  float f = 1.75;
  gl_Position = vec4(q.x*f/uAspect, q.y*f, 0., -q.z);
  gl_PointSize = max(1., uPx*1.9*sz/(-q.z));
  vCol = col*(bg ? .35 : 1.);
}`;
const SH_HOLO_FS = `#version 300 es
precision highp float;
in vec3 vCol; in float vA; flat in int vSq; out vec4 o;
void main(){
  vec2 c = gl_PointCoord-.5;
  if(vSq == 1){ float e = max(abs(c.x), abs(c.y)); o = vec4(vCol*vA*(e > .4 ? .55 : 1.), 1.); return; }
  float r = dot(c,c); if(r > .25) discard; o = vec4(vCol*vA*(1.-r*2.), 1.);
}`;
