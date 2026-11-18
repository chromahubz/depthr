// DEPTHR FX library core. Every effect is a GLSL snippet that defines `vec3 fx(vec2 t)` (t = source uv,
// y down). It can read the camera, the relit scene, DAViD normals/depth/matte, the clean background plate,
// both hands (42 landmarks), the body anchor, audio, and its own feedback state (MRT: call keep(state)).
"use strict";
const FX = [];          // {id, cat, name, a, b, src}
const FX_CATS = [];
function fx(cat, id, name, a, b, src) { FX.push({ id, cat, name, a: a || "A", b: b || "B", src }); if (!FX_CATS.includes(cat)) FX_CATS.push(cat); }

const FX_HEAD = `
uniform sampler2D uScene, uPrev, uPlate;
uniform float uA, uB, uMix, uBass, uMid, uHigh, uBeat, uBeatN, uUseScene;
uniform vec2 uTexel; uniform vec4 uBody;
uniform vec3 uH[42]; uniform float uHA[2]; uniform int uHN;
const float PI = 3.14159265, TAU = 6.2831853;
vec3 S(vec2 t){ return fbo(uScene, t).rgb; }
vec3 C(vec2 t){ return toLin(texture(uCam, t).rgb); }
vec3 SRC(vec2 t){ return uUseScene > .5 ? S(t) : C(t); }
vec3 PV(vec2 t){ return fbo(uPrev, t).rgb; }
vec3 PL(vec2 t){ return toLin(fbo(uPlate, t).rgb); }
float D(vec2 t){ return depthAt(t); }
float M(vec2 t){ return matteAt(t); }
float MM(vec2 t){ return smoothstep(.25, .75, matteAt(t)); }
vec3 N(vec2 t){ return normalAt(t); }
vec2 AS(vec2 t){ return vec2(t.x*uAspect, t.y); }
float lum(vec3 c){ return dot(c, vec3(.2126,.7152,.0722)); }
vec3 hsv(float h, float s, float v){ vec3 k = clamp(abs(mod(h*6.+vec3(0.,4.,2.),6.)-3.)-1., 0., 1.); return v*mix(vec3(1.), k, s); }
vec3 pal(float x, vec3 a, vec3 b, vec3 c, vec3 d){ return a + b*cos(TAU*(c*x+d)); }
vec3 rainbow(float x){ return pal(x, vec3(.5), vec3(.5), vec3(1.), vec3(0.,.33,.67)); }
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c,-s,s,c); }
float lambert(vec3 n, vec3 l){ return max(dot(n, normalize(l)), 0.); }
float spec(vec3 n, vec3 l, float g){ return pow(max(dot(n, normalize(normalize(l)+vec3(0.,0.,1.))), 0.), g); }
float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa = p-a, ba = b-a; float h = clamp(dot(pa,ba)/max(dot(ba,ba),1e-9), 0., 1.); return length(pa-ba*h); }
vec3 voro(vec2 p){
  vec2 i = floor(p), f = fract(p); float d1 = 8., d2 = 8., id = 0.;
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){
    vec2 g = vec2(x,y); vec2 o = hash2(i+g); float d = length(g+o-f);
    if(d<d1){ d2=d1; d1=d; id=hash(i+g); } else if(d<d2) d2=d;
  }
  return vec3(d1, d2-d1, id);
}
vec4 voroC(vec2 p){ // xy = nearest centre (p space), z = edge distance, w = id
  vec2 i = floor(p), f = fract(p); float d1 = 8., d2 = 8.; vec2 c = vec2(0.); float id = 0.;
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){
    vec2 g = vec2(x,y); vec2 o = hash2(i+g); float d = length(g+o-f);
    if(d<d1){ d2=d1; d1=d; c=i+g+o; id=hash(i+g); } else if(d<d2) d2=d;
  }
  return vec4(c, d2-d1, id);
}
vec3 blurS(vec2 t, float r){
  vec3 s = SRC(t)*.2;
  for(int i=0;i<8;i++){ float a = float(i)*.785398; s += SRC(t + vec2(cos(a)/uAspect, sin(a))*r)*.1; }
  return s;
}
float edgeN(vec2 t, float px){
  vec2 e = vec2(px/uAuxSize.x, px/uAuxSize.y);
  vec3 nx = N(t+vec2(e.x,0.)) - N(t-vec2(e.x,0.)), ny = N(t+vec2(0.,e.y)) - N(t-vec2(0.,e.y));
  float dd = abs(D(t+vec2(e.x,0.))-D(t-vec2(e.x,0.))) + abs(D(t+vec2(0.,e.y))-D(t-vec2(0.,e.y)));
  float mm = abs(M(t+vec2(e.x,0.))-M(t-vec2(e.x,0.))) + abs(M(t+vec2(0.,e.y))-M(t-vec2(0.,e.y)));
  return smoothstep(.45, 1.1, (length(nx)+length(ny))*.8 + dd*10. + mm*1.6);
}
float edgeL(vec2 t, float px){
  vec2 e = uTexel*px;
  float tl = lum(C(t+vec2(-e.x,-e.y))), tc = lum(C(t+vec2(0.,-e.y))), tr = lum(C(t+vec2(e.x,-e.y)));
  float ml = lum(C(t+vec2(-e.x,0.))), mr = lum(C(t+vec2(e.x,0.)));
  float bl = lum(C(t+vec2(-e.x,e.y))), bc = lum(C(t+vec2(0.,e.y))), br = lum(C(t+vec2(e.x,e.y)));
  float gx = (tr+2.*mr+br)-(tl+2.*ml+bl), gy = (bl+2.*bc+br)-(tl+2.*tc+tr);
  return smoothstep(.08, .35, sqrt(gx*gx+gy*gy));
}
float mBlur(vec2 t, float r){
  float s = M(t)*.2;
  for(int i=0;i<8;i++){ float a = float(i)*.785398; s += M(t + vec2(cos(a)/uAspect, sin(a))*r)*.1; }
  return s;
}
vec2 H(int h, int i){ return uH[h*21+i].xy; }
float HZ(int h, int i){ return uH[h*21+i].z; }
bool HON(int h){ return h < uHN && uHA[h] > .3; }
float aDist(vec2 a, vec2 b){ return length((a-b)*vec2(uAspect,1.)); }
float EXPO = 1.;                       // set in main from the camera's mip average
vec3 CN(vec2 t){ return C(t)*EXPO; }  // exposure-normalised camera for luminance-driven looks
float LN(vec2 t){ return clamp(lum(CN(t)), 0., 1.); }
vec3 STATE = vec3(0.); bool HAS_STATE = false;
void keep(vec3 s){ STATE = s; HAS_STATE = true; }
`;

function fxShader(src) {
  return `#version 300 es
${SH_COMMON}
${FX_HEAD}
in vec2 uv;
layout(location=0) out vec4 o;
layout(location=1) out vec4 st;
${src}
void main(){
  float avg = lum(toLin(textureLod(uCam, vec2(.5), 12.).rgb));
  EXPO = clamp(.22/max(avg, .005), .7, 8.);
  vec3 r = fx(uv);
  r = max(r, 0.);
  o = vec4(mix(SRC(uv), r, uMix), 1.);
  st = vec4(HAS_STATE ? STATE : r, 1.);
}`;
}
