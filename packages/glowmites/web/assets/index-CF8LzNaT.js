(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e=`#version 300 es
out vec2 vUv;
void main() {
  // one big triangle, no vertex buffer
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;function t(e,t,n,r){let i=(t,n)=>{let i=e.createShader(t);if(e.shaderSource(i,n),e.compileShader(i),!e.getShaderParameter(i,e.COMPILE_STATUS)){let t=e.getShaderInfoLog(i),a=n.split(`
`).map((e,t)=>`${t+1}: ${e}`).join(`
`);throw Error(`${r}: ${t}\n${a}`)}return i},a=e.createProgram();if(e.attachShader(a,i(e.VERTEX_SHADER,t)),e.attachShader(a,i(e.FRAGMENT_SHADER,n)),e.linkProgram(a),!e.getProgramParameter(a,e.LINK_STATUS))throw Error(`${r} link: ${e.getProgramInfoLog(a)}`);let o={},s=e.getProgramParameter(a,e.ACTIVE_UNIFORMS);for(let t=0;t<s;t++){let n=e.getActiveUniform(a,t),r=n.name.replace(/\[0\]$/,``);o[r]=e.getUniformLocation(a,n.name)}return{p:a,u:o}}function n(e,t,n,r,i,a,o,s=null){let c=e.createTexture();return e.bindTexture(e.TEXTURE_2D,c),e.texImage2D(e.TEXTURE_2D,0,r,t,n,0,i,a,s),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,o),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,o),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),c}function r(e,t,r,i,a=!1){let o=e.createFramebuffer();e.bindFramebuffer(e.FRAMEBUFFER,o);let s=i.map((i,a)=>{let o=n(e,t,r,i.internal,i.format,i.type,i.filter);return e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+a,e.TEXTURE_2D,o,0),o});if(a){let n=e.createRenderbuffer();e.bindRenderbuffer(e.RENDERBUFFER,n),e.renderbufferStorage(e.RENDERBUFFER,e.DEPTH_COMPONENT24,t,r),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.DEPTH_ATTACHMENT,e.RENDERBUFFER,n)}e.drawBuffers(i.map((t,n)=>e.COLOR_ATTACHMENT0+n));let c=e.checkFramebufferStatus(e.FRAMEBUFFER);if(c!==e.FRAMEBUFFER_COMPLETE)throw Error(`framebuffer incomplete `+c);return e.bindFramebuffer(e.FRAMEBUFFER,null),{fb:o,tex:s,w:t,h:r}}function i(e,t,n,r){e.activeTexture(e.TEXTURE0+t),e.bindTexture(e.TEXTURE_2D,n),e.uniform1i(r,t)}function a(e,t,n,r,i){let a=1/Math.tan(t/2),o=1/(r-i);e.fill(0),e[0]=a/n,e[5]=a,e[10]=(i+r)*o,e[11]=-1,e[14]=2*i*r*o}function o(e,t,n,r,i,a,o){let s=t-i,c=n-a,l=r-o,u=Math.hypot(s,c,l);s/=u,c/=u,l/=u;let d=l,f=0,p=-s;u=Math.hypot(d,f,p)||1,d/=u,f/=u,p/=u;let m=c*p-l*f,h=l*d-s*p,g=s*f-c*d;e[0]=d,e[1]=m,e[2]=s,e[3]=0,e[4]=f,e[5]=h,e[6]=c,e[7]=0,e[8]=p,e[9]=g,e[10]=l,e[11]=0,e[12]=-(d*t+f*n+p*r),e[13]=-(m*t+h*n+g*r),e[14]=-(s*t+c*n+l*r),e[15]=1}function s(e,t,n){for(let r=0;r<4;r++)for(let i=0;i<4;i++)e[i*4+r]=t[r]*n[i*4]+t[4+r]*n[i*4+1]+t[8+r]*n[i*4+2]+t[12+r]*n[i*4+3]}function c(e,t){let n=t[0],r=t[1],i=t[2],a=t[3],o=t[4],s=t[5],c=t[6],l=t[7],u=t[8],d=t[9],f=t[10],p=t[11],m=t[12],h=t[13],g=t[14],_=t[15],ee=n*s-r*o,v=n*c-i*o,y=n*l-a*o,te=r*c-i*s,b=r*l-a*s,x=i*l-a*c,S=u*h-d*m,ne=u*g-f*m,C=u*_-p*m,w=d*g-f*h,re=d*_-p*h,T=f*_-p*g,E=ee*T-v*re+y*w+te*C-b*ne+x*S;E&&(E=1/E,e[0]=(s*T-c*re+l*w)*E,e[1]=(i*re-r*T-a*w)*E,e[2]=(h*x-g*b+_*te)*E,e[3]=(f*b-d*x-p*te)*E,e[4]=(c*C-o*T-l*ne)*E,e[5]=(n*T-i*C+a*ne)*E,e[6]=(g*y-m*x-_*v)*E,e[7]=(u*x-f*y+p*v)*E,e[8]=(o*re-s*C+l*S)*E,e[9]=(r*C-n*re-a*S)*E,e[10]=(m*b-h*y+_*ee)*E,e[11]=(d*y-u*b-p*ee)*E,e[12]=(s*ne-o*w-c*S)*E,e[13]=(n*w-r*ne+i*S)*E,e[14]=(h*v-m*te-g*ee)*E,e[15]=(u*te-d*v+f*ee)*E)}function l(e){"@babel/helpers - typeof";return l=typeof Symbol==`function`&&typeof Symbol.iterator==`symbol`?function(e){return typeof e}:function(e){return e&&typeof Symbol==`function`&&e.constructor===Symbol&&e!==Symbol.prototype?`symbol`:typeof e},l(e)}function u(e,t){if(l(e)!=`object`||!e)return e;var n=e[Symbol.toPrimitive];if(n!==void 0){var r=n.call(e,t||`default`);if(l(r)!=`object`)return r;throw TypeError(`@@toPrimitive must return a primitive value.`)}return(t===`string`?String:Number)(e)}function d(e){var t=u(e,`string`);return l(t)==`symbol`?t:t+``}function f(e,t,n){return(t=d(t))in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}var p=[{scale:1,bloom:5},{scale:.85,bloom:5},{scale:.72,bloom:4},{scale:.62,bloom:3},{scale:.52,bloom:3}],m=class{constructor(){f(this,`tier`,1),f(this,`budget`,1e3/60),f(this,`hist`,new Float32Array(240)),f(this,`sorted`,new Float32Array(60)),f(this,`i`,0),f(this,`calm`,0),f(this,`cool`,0),f(this,`drift`,0),f(this,`frames`,0)}setRefresh(e){this.budget=1e3/Math.min(120,Math.max(60,e))}push(e){this.hist[this.i]=e,this.i=(this.i+1)%this.hist.length,this.frames++}p90(){for(let e=0;e<60;e++)this.sorted[e]=this.hist[(this.i-1-e+this.hist.length)%this.hist.length];return this.sorted.sort(),this.sorted[54]}update(e){if(this.frames<30)return;this.cool-=e;let t=this.p90();this.drift+=(t-this.drift)*Math.min(1,e*.2),this.cool>0||(t>this.budget*1.08&&this.tier<p.length-1?(this.tier++,this.cool=.6,this.calm=0):(t<this.budget*.62?this.calm+=e:this.calm=0,this.calm>4&&this.tier>0&&this.drift<this.budget*.7&&(this.tier--,this.cool=2,this.calm=0)))}graph(e,t){let n=e.canvas.width,r=e.canvas.height;e.clearRect(0,0,n,r),e.fillStyle=`rgba(0,0,0,0.45)`,e.fillRect(0,0,n,r);let i=r-34-6,a=i/(this.budget*2);e.strokeStyle=`rgba(255,255,255,0.35)`,e.beginPath(),e.moveTo(0,34+i-this.budget*a),e.lineTo(n,34+i-this.budget*a),e.stroke();let o=this.hist.length;for(let t=0;t<o;t++){let r=this.hist[(this.i+t)%o],s=Math.min(i,r*a);e.fillStyle=r>this.budget*1.5?`#ff5a5a`:r>this.budget*1.05?`#ffd35a`:`#5affb0`,e.fillRect(t*n/o,34+i-s,Math.ceil(n/o),s)}e.fillStyle=`#fff`,e.font=`12px monospace`,e.fillText(t,6,14),e.fillText(`p90 ${this.p90().toFixed(1)} ms  budget ${this.budget.toFixed(1)}  tier ${this.tier}`,6,28)}},h=`#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform vec2 uTexel, uScale;
uniform float uThreshold;
in vec2 vUv;
out vec4 o;
void main() {
  vec2 uv = vUv * uScale;
  vec3 c = texture(uSrc, uv + uTexel * vec2(-1, -1)).rgb + texture(uSrc, uv + uTexel * vec2(1, -1)).rgb
         + texture(uSrc, uv + uTexel * vec2(-1, 1)).rgb + texture(uSrc, uv + uTexel * vec2(1, 1)).rgb;
  c *= 0.25;
  if (uThreshold > 0.0) { float l = max(c.r, max(c.g, c.b)); c *= smoothstep(uThreshold, uThreshold * 2.0, l); }
  o = vec4(c, 1.0);
}`,g=`#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform vec2 uTexel;
uniform float uGain;
in vec2 vUv;
out vec4 o;
void main() {
  vec3 c = texture(uSrc, vUv + uTexel * vec2(-1, 0)).rgb + texture(uSrc, vUv + uTexel * vec2(1, 0)).rgb
         + texture(uSrc, vUv + uTexel * vec2(0, -1)).rgb + texture(uSrc, vUv + uTexel * vec2(0, 1)).rgb;
  o = vec4(c * 0.25 * uGain, 1.0);
}`,_=`#version 300 es
precision highp float;
uniform sampler2D uScene, uBloom;
uniform vec2 uScale;
uniform float uTime;
in vec2 vUv;
out vec4 o;
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main() {
  vec3 c = texture(uScene, vUv * uScale).rgb + texture(uBloom, vUv).rgb * 0.7;
  c = aces(c * 1.1);
  vec2 q = vUv - 0.5;
  c *= 1.0 - dot(q, q) * 0.7;
  float g = fract(sin(dot(vUv * 913.0 + uTime, vec2(12.9898, 78.233))) * 43758.5453);
  c += (g - 0.5) * 0.018;
  o = vec4(pow(c, vec3(1.0 / 1.1)), 1.0);
}`,ee=class{constructor(n){f(this,`scene`,void 0),f(this,`chain`,[]),f(this,`down`,void 0),f(this,`up`,void 0),f(this,`comp`,void 0),f(this,`vao`,void 0),f(this,`w`,0),f(this,`h`,0),f(this,`gl`,void 0),this.gl=n,this.down=t(n,e,h,`down`),this.up=t(n,e,g,`up`),this.comp=t(n,e,_,`comp`),this.vao=n.createVertexArray()}resize(e,t){let n=this.gl;if(e===this.w&&t===this.h)return;this.w=e,this.h=t;let i={internal:n.RGBA16F,format:n.RGBA,type:n.HALF_FLOAT,filter:n.LINEAR};this.scene=r(n,e,t,[i],!0),this.chain=[];let a=e>>1,o=t>>1;for(let e=0;e<5;e++)this.chain.push(r(n,Math.max(1,a),Math.max(1,o),[i])),a>>=1,o>>=1}begin(e){let t=this.gl;t.bindFramebuffer(t.FRAMEBUFFER,this.scene.fb),t.viewport(0,0,Math.round(this.w*e),Math.round(this.h*e)),t.clearColor(0,0,0,1),t.clear(t.COLOR_BUFFER_BIT|t.DEPTH_BUFFER_BIT)}end(e,t,n,r,a){let o=this.gl;o.bindVertexArray(this.vao),o.disable(o.DEPTH_TEST),o.disable(o.BLEND),o.useProgram(this.down.p);let s=this.scene.tex[0],c=this.w,l=this.h,u=e,d=e;for(let e=0;e<n;e++){let t=this.chain[e];o.bindFramebuffer(o.FRAMEBUFFER,t.fb),o.viewport(0,0,t.w,t.h),i(o,0,s,this.down.u.uSrc),o.uniform2f(this.down.u.uTexel,1/c,1/l),o.uniform2f(this.down.u.uScale,u,d),o.uniform1f(this.down.u.uThreshold,e===0?.9:0),o.drawArrays(o.TRIANGLES,0,3),s=t.tex[0],c=t.w,l=t.h,u=1,d=1}o.useProgram(this.up.p),o.enable(o.BLEND),o.blendFunc(o.ONE,o.ONE);for(let e=n-1;e>0;e--){let t=this.chain[e],n=this.chain[e-1];o.bindFramebuffer(o.FRAMEBUFFER,n.fb),o.viewport(0,0,n.w,n.h),i(o,0,t.tex[0],this.up.u.uSrc),o.uniform2f(this.up.u.uTexel,1/t.w,1/t.h),o.uniform1f(this.up.u.uGain,1),o.drawArrays(o.TRIANGLES,0,3)}o.disable(o.BLEND),o.bindFramebuffer(o.FRAMEBUFFER,null),o.viewport(0,0,r,a),o.useProgram(this.comp.p),i(o,0,this.scene.tex[0],this.comp.u.uScene),i(o,1,this.chain[0].tex[0],this.comp.u.uBloom),o.uniform2f(this.comp.u.uScale,e,e),o.uniform1f(this.comp.u.uTime,t%100),o.drawArrays(o.TRIANGLES,0,3)}},v=[[0,0,0],[.93,.87,.74],[.42,.27,.16],[.74,.28,.18],[.35,.62,.92],[.52,.32,.18],[.6,.58,.54],[.4,.27,.17],[.27,.62,.22],[.48,.78,.3],[1,.62,.8],[.9,.76,.36],[.66,.3,.22],[1,.82,.35],[.24,.4,.82],[.74,.2,.14],[.95,.95,.9],[.5,.5,.47],[1,.6,.15],[.3,.48,.22],[.86,.16,.14],[.98,.95,.88],[.92,.86,.72],[.95,.97,1],[.12,.38,.22],[.7,.45,1],[.16,.13,.18],[.36,.42,.52]],y=`const vec3 MAT[${v.length}] = vec3[${v.length}](${v.map(e=>`vec3(${e.map(e=>e.toFixed(3)).join(`,`)})`).join(`,`)});`,te=-.7,b=58,x={k:0,a:0};function S(e){return 1-x.a*(1-Math.cos(x.k*(e+Math.PI/2)))/2}var ne=class{constructor(e){f(this,`h`,new Float32Array(65536)),f(this,`tex`,void 0),f(this,`pond`,{x:0,z:0,r:0}),f(this,`pond2`,{x:0,z:0,r:0}),f(this,`r0`,[0,0]),f(this,`amp`,2),f(this,`gl`,void 0),f(this,`h0`,new Float32Array(65536)),f(this,`dirty`,[256,256,-1,-1]),this.gl=e,this.tex=e.createTexture(),e.bindTexture(e.TEXTURE_2D,this.tex),e.texImage2D(e.TEXTURE_2D,0,e.R16F,256,256,0,e.RED,e.FLOAT,null),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE)}raw(e,t,n){let r=n*.37,i=1.7*Math.sin(e*.065+r)*Math.sin(t*.058+r*1.7)+.9*Math.sin(e*.12-t*.1+r*2.3)+.45*Math.sin(e*.23+t*.19+r),a=Math.hypot(e,t)/S(Math.atan2(t,e));i*=this.amp*C(6,16,a)*(1-C(48,b,a));let o=1,s=0;for(let n of[this.pond,this.pond2])if(n.r>0){let r=Math.hypot(e-n.x,t-n.z)/n.r;o*=C(.7,1.5,r),s+=3.4*Math.exp(-r*r*1.3)}return i=Math.max(i,-.35)*o-s,i}plan(e){let t=e*7919+13,n=()=>(t=t*16807%2147483647,t/2147483647),r=n()*Math.PI*2,i=26+n()*10,a=14+n()*4,o=Math.min(i,58*S(r)-a-2);this.pond={x:Math.cos(r)*o,z:Math.sin(r)*o,r:a};let s=r+Math.PI*(.8+n()*.4),c=11+n()*3,l=Math.min(26+n()*10,58*S(s)-c-2);return this.pond2={x:Math.cos(s)*l,z:Math.sin(s)*l,r:c},this.r0=[a,c],this.pond}build(e,t){let n=this.h,r=160/256;for(let t=0;t<256;t++)for(let i=0;i<256;i++)n[t*256+i]=this.raw((i+.5)*r-80,(t+.5)*r-80,e);let i=t.map(t=>Math.max(-.39999999999999997,this.raw(t.x,t.z,e)));t.forEach((e,t)=>{let a=i[t],o=Math.max(0,Math.floor((e.x-e.half-4+80)/r)),s=Math.min(255,Math.ceil((e.x+e.half+4+80)/r)),c=Math.max(0,Math.floor((e.z-e.half-4+80)/r)),l=Math.min(255,Math.ceil((e.z+e.half+4+80)/r));for(let t=c;t<=l;t++)for(let i=o;i<=s;i++){let o=(i+.5)*r-80,s=(t+.5)*r-80,c=1-C(0,4,Math.max(Math.abs(o-e.x),Math.abs(s-e.z))-e.half);n[t*256+i]=n[t*256+i]*(1-c)+a*c}}),this.h0.set(n),this.dirty=[256,256,-1,-1];let a=this.gl;return a.bindTexture(a.TEXTURE_2D,this.tex),a.texSubImage2D(a.TEXTURE_2D,0,0,0,256,256,a.RED,a.FLOAT,n),i}dig(e,t,n,r,i){let a=160/256,o=this.h,s=this.h0,c=Math.max(1,Math.floor((e-n+80)/a)),l=Math.min(254,Math.ceil((e+n+80)/a)),u=Math.max(1,Math.floor((t-n+80)/a)),d=Math.min(254,Math.ceil((t+n+80)/a)),f=!1;for(let p=u;p<=d;p++)for(let u=c;u<=l;u++){let c=(u+.5)*a-80,l=(p+.5)*a-80,d=Math.hypot(c-e,l-t)/n;if(d>=1)continue;let m=p*256+u,h=Math.max(-.58,s[m]-1.3);o[m]<=h||i(c,l)||(o[m]=Math.max(h,o[m]-r*(1-d*d)),f=!0)}if(f){let e=this.dirty;e[0]=Math.min(e[0],c),e[1]=Math.min(e[1],u),e[2]=Math.max(e[2],l),e[3]=Math.max(e[3],d)}}flush(){let e=this.dirty;if(e[2]<0)return;let t=this.gl,n=e[2]-e[0]+1;t.bindTexture(t.TEXTURE_2D,this.tex),t.pixelStorei(t.UNPACK_ROW_LENGTH,256),t.texSubImage2D(t.TEXTURE_2D,0,e[0],e[1],n,e[3]-e[1]+1,t.RED,t.FLOAT,this.h,e[1]*256+e[0]),t.pixelStorei(t.UNPACK_ROW_LENGTH,0),e[0]=256,e[1]=256,e[2]=-1,e[3]=-1}at(e,t){let n=160/256,r=(e+80)/n-.5,i=(t+80)/n-.5,a=Math.floor(r),o=Math.floor(i),s=r-a,c=i-o,l=(e,t)=>this.h[Math.min(255,Math.max(0,t))*256+Math.min(255,Math.max(0,e))];return(l(a,o)*(1-s)+l(a+1,o)*s)*(1-c)+(l(a,o+1)*(1-s)+l(a+1,o+1)*s)*c}floor(e,t){let n=this.at(e,t);if(n>=-.7)return n;for(let n of[this.pond,this.pond2])if(n.r>.5&&Math.hypot(e-n.x,t-n.z)<n.r*1.2)return te;return n}};function C(e,t,n){let r=Math.min(1,Math.max(0,(n-e)/(t-e)));return r*r*(3-2*r)}var w=`
float groundH(vec2 xz) { vec2 uv = xz / uWorld + 0.5; return (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) ? texture(uHeight, uv).r : 0.0; }
const float WATER = ${te.toFixed(2)};
`,re=v.length,T=98304,E=27306,ie=[0,1,2,3,4,5,6].map(e=>e===0?0:T+(e-1)*E),ae=[0,1,2,3,4,5,6].map(e=>e===0?T:E),oe=`
int teamOf(float id) { return id < ${T}.0 ? 0 : min(6, 1 + int((id - ${T}.0) / ${E}.0)); }
float teamStart(int t) { return t == 0 ? 0.0 : 98304.0 + float(t - 1) * 27306.0; }
const vec3 TEAMC[7] = vec3[7](vec3(1.0, 0.75, 0.35), vec3(0.35, 0.65, 1.0), vec3(1.0, 0.3, 0.35), vec3(0.45, 1.0, 0.45), vec3(0.85, 0.45, 1.0), vec3(0.3, 1.0, 0.95), vec3(1.0, 0.55, 0.85));
`,se=`
float h11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
vec3 h31(float p) { vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xxy + p3.yzz) * p3.zyx); }
`,ce=.28,le=`#version 300 es
precision highp float;
uniform sampler2D uPos, uVel, uDen, uGrid, uAtlas, uHeight;
uniform vec4 uBirth; // the materials new mites are born with (what the swarm has been eating)
uniform float uShape, uShapeScale, uReset, uOpen; // uOpen: the north gate is open (leaving the land) // 0..1: the swarm gathers into a shape when left alone
uniform vec3 uShapePos;
uniform vec4 uPa[24], uPb[24];
uniform float uPw[24];
uniform int uNP;
uniform vec4 uB[64];
uniform vec4 uB2[64];
uniform vec4 uS2[64];
uniform vec4 uShock; // x, z, radius, strength (a stomp)
uniform vec3 uLeaders[7], uLeaderVels[7];
uniform float uActiveT[7], uRadiusT[7], uSpeedT[7];
uniform float uDt, uTime, uS, uWorld, uRep, uLift;
vec3 uLeader, uLeaderVel; float uActive, uRadius, uSpeed;
uniform vec2 uDenTexel;
layout(location = 0) out vec4 oPos;
layout(location = 1) out vec4 oVel;
${se}
float den(vec2 xz) { return texture(uDen, xz / uWorld + 0.5).r; }
${oe}
${w}
// a point on the shape this mite belongs to (spheres, capsules and boxes, picked by area)
vec3 shapePoint(float id) {
  vec3 r1 = h31(id * 1.37 + 5.0), r2 = h31(id * 2.71 + 9.0);
  int k = 0;
  for (int i = 0; i < 24; i++) if (i < uNP - 1 && r1.x > uPw[i]) k = i + 1;
  vec4 A = uPa[k], B = uPb[k];
  vec3 dir = normalize(r2 - 0.5 + 1e-4), p;
  if (A.w < 0.5) p = A.xyz + dir * B.xyz * (0.82 + 0.18 * r1.y);
  else if (A.w < 1.5) p = mix(A.xyz, B.xyz, r1.y) + dir * B.w * (0.8 + 0.2 * r1.z);
  else {
    p = A.xyz + (r2 * 2.0 - 1.0) * B.xyz;
    int ax = int(r1.y * 2.999);
    p[ax] = A[ax] + (r2[ax] > 0.5 ? 1.0 : -1.0) * B[ax];
  }
  return uShapePos + p * uShapeScale;
}

ivec2 atlasTexel(int b, ivec3 v) { return ivec2((b % 8) * 256 + (v.z % 8) * 32 + v.x, (b / 8) * 128 + (v.z / 8) * 32 + v.y); }
float solidAt(int b, ivec3 v) {
  if (any(lessThan(v, ivec3(0))) || any(greaterThan(v, ivec3(31)))) return 0.0;
  return texelFetch(uAtlas, atlasTexel(b, v), 0).r;
}
float matAt(int b, ivec3 v) {
  if (any(lessThan(v, ivec3(0))) || any(greaterThan(v, ivec3(31)))) return 0.0;
  vec4 t = texelFetch(uAtlas, atlasTexel(b, v), 0);
  return t.r > 0.5 ? t.b : 0.0;
}
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  float id = float(c.y) * uS + float(c.x);
  vec4 p = texelFetch(uPos, c, 0);
  vec4 v = texelFetch(uVel, c, 0);
  vec3 r = h31(id);
  // which swarm this mite belongs to: its leader, its size, its body radius
  int team = teamOf(id);
  uLeader = uLeaders[team]; uLeaderVel = uLeaderVels[team]; uActive = uActiveT[team]; uRadius = uRadiusT[team]; uSpeed = uSpeedT[team];
  float shapeOn = team == 0 ? uShape : 0.0;
  if (id - teamStart(team) >= uActive) {
    // dormant: waits inside the seed, so it is born right where the swarm is
    oPos = vec4(uLeader + (r - 0.5) * vec3(1.5, 0.4, 1.5), 0.0);
    oVel = vec4(0.0, 0.0, 0.0, r.x);
    return;
  }
  vec3 pos = p.xyz, vel = v.xyz;
  float mat = floor(v.w), phase = fract(v.w);
  if (p.w < 0.5 || uReset > 0.5) {
    // born of what was eaten: it carries that colour
    float pick = h11(id * 0.77 + floor(uTime));
    mat = pick < 0.25 ? uBirth.x : pick < 0.5 ? uBirth.y : pick < 0.75 ? uBirth.z : uBirth.w;
    // just born: a little burst out of the seed
    vec3 q = h31(id + floor(uTime * 60.0)) - 0.5;
    pos = uLeader + vec3(q.x, 0.4 + abs(q.y), q.z) * 2.0;
    vel = normalize(vec3(q.x, 0.6, q.z) + 1e-4) * (4.0 + 6.0 * r.y) + uLeaderVel;
  }
  // 1. seek the seed: every mite heads for the finger, arriving softly (so the swarm moves as one liquid body)
  vec3 rel = pos - uLeader;
  float dist = length(rel.xz);
  vec3 inward = dist > 1e-3 ? -vec3(rel.x, 0.0, rel.z) / dist : vec3(0.0);
  float vmaxSeek = uSpeed * (1.15 + 0.3 * r.z);
  // each mite keeps its own place inside a body whose size grows with the swarm (sqrt: an even disc)
  float home = uRadius * sqrt(r.y) * 0.95;
  vec3 seek = inward * clamp((dist - home) * 4.5, -vmaxSeek * 0.3, vmaxSeek);
  // 2. a gentle mill around the seed when it rests (life, not chaos)
  vec3 tang = vec3(-inward.z, 0.0, inward.x) * (r.x < 0.5 ? 1.0 : -0.7);
  float calm = 1.0 - min(1.0, length(uLeaderVel) / max(uSpeed * 0.5, 1.0));
  vec3 mill = tang * min(dist, uRadius) * (0.15 + 0.35 * calm);
  // 3. curl noise, small: shimmer inside the body of the swarm
  vec3 q = pos * 0.11;
  float t = uTime * 0.25;
  const vec3 k1 = vec3(1.0, 0.6, 0.3), k2 = vec3(-0.4, 1.1, 0.8), k3 = vec3(0.7, -0.3, 1.2), k4 = vec3(1.3, 0.9, -0.6);
  vec3 g1 = k1 * cos(dot(k1, q) + t) + k2 * cos(dot(k2, q) * 1.7 + 1.3 * t) * 0.6;
  vec3 g2 = k3 * cos(dot(k3, q) - 0.7 * t) + k4 * cos(dot(k4, q) * 1.9 + 0.5 * t) * 0.6;
  vec3 flow = cross(g1, g2) * (0.9 + 0.04 * uRadius) * (0.6 + 0.6 * r.z);
  // 4. away from crowding: the density gradient
  vec2 e = uDenTexel * uWorld;
  float c0 = den(pos.xz);
  vec2 g = vec2(den(pos.xz + vec2(e.x, 0.0)) - den(pos.xz - vec2(e.x, 0.0)), den(pos.xz + vec2(0.0, e.y)) - den(pos.xz - vec2(0.0, e.y)));
  vec3 rep = -vec3(g.x, 0.0, g.y) * uRep;
  vec3 want = uLeaderVel + seek + mill + flow;
  // left alone, the swarm gathers into a shape (and bursts back into a swarm at the next touch)
  if (shapeOn > 0.0) {
    vec3 sw = (shapePoint(id) - pos) * 6.0;
    float sl = length(sw), sm = uSpeed * 4.0 + 22.0;
    if (sl > sm) sw *= sm / sl;
    want = mix(want, sw, shapeOn);
    rep *= 1.0 - 0.8 * shapeOn;
  }
  vel += ((want - vel) * (4.0 + 6.0 * shapeOn) + rep) * uDt;
  // 5. height: a soft floor, a soft ceiling that grows with the swarm, and the flow lifts sheets into the air
  float gy = max(groundH(pos.xz), WATER);
  float cap = 1.5 + uRadius * 0.45 * uLift + shapeOn * 200.0;
  float hy = pos.y - gy;
  vel.y += (max(0.0, 0.4 - hy) * 12.0 - max(0.0, hy - cap) * 4.0 - 0.6 * (1.0 - shapeOn)) * uDt;
  // a stomp: everything close is thrown up and away
  if (uShock.w > 0.0) {
    vec2 dv = pos.xz - uShock.xy; float dd = length(dv);
    if (dd < uShock.z) vel += vec3(dv / max(dd, 0.5), 1.2) * uShock.w * (1.0 - dd / uShock.z) * (0.6 + 0.8 * r.y);
  }
  // 6. stone: mites bore into buildings like termites, eating the voxel they are in
  float w = 1.0;
  // which volume is here: up to four share a cell (a giant's legs, body and head stack); take the one at this height
  vec4 ids = texture(uGrid, pos.xz / uWorld + 0.5) * 255.0;
  float gi = 0.0;
  for (int k = 0; k < 4; k++) {
    float id4 = ids[k];
    if (id4 > 0.5 && gi < 0.5) {
      int bb = int(id4 + 0.5) - 1;
      float y0 = uS2[bb].y, y1 = y0 + 32.0 * ${ce.toFixed(3)} * uS2[bb].x;
      if (pos.y > y0 - 0.6 && pos.y < y1 + 0.6) gi = id4;
    }
  }
  if (gi > 0.5) {
    int b = int(gi + 0.5) - 1;
    vec4 B = uB[b], B2 = uB2[b];
    if (B.w >= 0.0) {
      vec3 lp = (pos - vec3(B.x, uS2[b].y, B.y)) / (${ce.toFixed(3)} * uS2[b].x) + vec3(16.0, 0.0, 16.0);
      float here = solidAt(b, ivec3(floor(lp)));
      float above = solidAt(b, ivec3(floor(lp + vec3(0.0, 1.0, 0.0))));
      vec3 hd = length(vel) > 0.1 ? normalize(vel) : vec3(0.0, -1.0, 0.0);
      float ahead = solidAt(b, ivec3(floor(lp + hd * 1.2)));
      if (here > 0.5) {
        w = 2.0 + float(b);
        if (h11(id * 0.31 + uTime * 7.0) < 0.3) { float m = matAt(b, ivec3(floor(lp))); if (m > 0.5) mat = m; }
        // chewing through stone slows a mite down; the swarm behind keeps pushing, so tunnels open up
        vel *= exp(-3.5 * uDt);
        vel.y += (above > 0.5 ? 2.0 : 4.0) * uDt;
      } else if (ahead > 0.5) {
        // stone right in front: bite it (w + 0.5 tells the eat pass to take the voxel ahead) and climb
        w = 2.5 + float(b);
        if (h11(id * 0.31 + uTime * 7.0) < 0.3) { float m = matAt(b, ivec3(floor(lp + hd * 1.2))); if (m > 0.5) mat = m; }
        vel.xz *= exp(-2.0 * uDt);
        vel.y += 3.5 * uDt;
      } else if (solidAt(b, ivec3(floor(lp - vec3(0.0, 1.2, 0.0)))) > 0.5) {
        // stone underneath: chew down into it (so low rocks, rubble and the last layer get eaten too)
        w = 2.25 + float(b);
        vel.y -= 1.5 * uDt;
        if (h11(id * 0.31 + uTime * 7.0) < 0.3) { float m = matAt(b, ivec3(floor(lp - vec3(0.0, 1.2, 0.0)))); if (m > 0.5) mat = m; }
      } else {
        vel.y += 1.0 * uDt;
      }
    }
  }
  // the mist at the edge of the land: nobody gets through
  float rw = length(pos.xz);
  bool gateway = uOpen > 0.5 && abs(pos.x) < 4.5 && pos.z < 0.0;
  if (rw > 61.0 && !gateway) vel.xz -= pos.xz / rw * (rw - 61.0) * 30.0 * uDt;
  float sp = length(vel);
  float vmax = uSpeed * 1.8 + 6.0;
  if (sp > vmax) vel *= vmax / sp;
  pos += vel * uDt;
  float rw2 = length(pos.xz);
  if (rw2 > 63.5 && !gateway) { pos.xz *= 63.5 / rw2; vel.xz *= 0.3; } // the wall is solid
  float fy = max(groundH(pos.xz), WATER) + 0.08;
  if (pos.y < fy) { pos.y = fy; vel.y = abs(vel.y) * 0.3; }
  oPos = vec4(pos, w);
  oVel = vec4(vel, mat + phase);
}`,ue=`#version 300 es
precision highp float;
uniform sampler2D uPos;
uniform float uS, uWorld;
void main() {
  int i = gl_VertexID;
  vec4 p = texelFetch(uPos, ivec2(i % int(uS), i / int(uS)), 0);
  if (p.w < 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
  gl_Position = vec4(p.xz / uWorld * 2.0, 0.0, 1.0);
  gl_PointSize = 1.0;
}`,de=`#version 300 es
precision mediump float;
out vec4 o;
void main() { o = vec4(1.0); }`,fe=`#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform vec2 uDir;
in vec2 vUv;
out vec4 o;
void main() {
  vec4 s = texture(uSrc, vUv) * 0.227027;
  s += (texture(uSrc, vUv + uDir * 1.3846) + texture(uSrc, vUv - uDir * 1.3846)) * 0.3162162;
  s += (texture(uSrc, vUv + uDir * 3.2308) + texture(uSrc, vUv - uDir * 3.2308)) * 0.0702703;
  o = s;
}`,pe=`#version 300 es
precision highp float;
uniform sampler2D uPos, uVel;
uniform mat4 uVP;
uniform vec3 uCamR, uCamU;
uniform float uS, uSize, uTime, uMinPx, uPxScale;
uniform vec4 uTint0; // the player's swarm evolves: a tint (rgb, amount); amount < 0 means rainbow
in vec2 aCorner;
out vec2 vUv;
out vec3 vCol;
out float vBright;
${se}
${y}
${oe}
void main() {
  int i = gl_InstanceID;
  ivec2 c = ivec2(i % int(uS), i / int(uS));
  vec4 p = texelFetch(uPos, c, 0);
  if (p.w < 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec4 v = texelFetch(uVel, c, 0);
  vec3 r = h31(float(i) + 7.0);
  vec4 clip = uVP * vec4(p.xyz, 1.0);
  // never smaller than a pixel or two: far mites become glowing points, near ones are little winged sprites
  float size = max(uSize * (0.7 + 0.6 * r.x), uMinPx * clip.w * uPxScale);
  float flap = 0.55 + 0.45 * sin(uTime * (28.0 + 10.0 * r.y) + v.w * 6.2831);
  // stretch along the motion (seen from the camera): the flow becomes visible as streaks of light
  vec2 sv = vec2(dot(v.xyz, uCamR), dot(v.xyz, uCamU));
  float spd = length(sv);
  vec2 ax = spd > 1e-3 ? sv / spd : vec2(1.0, 0.0);
  vec2 ay = vec2(-ax.y, ax.x);
  float stretch = 1.0 + min(spd * 0.09, 2.2);
  vec2 k = ax * aCorner.x * stretch * (1.0 + 0.3 * flap) + ay * aCorner.y * (1.0 - 0.25 * flap);
  vec3 wp = p.xyz + (uCamR * k.x + uCamU * k.y) * size;
  gl_Position = uVP * vec4(wp, 1.0);
  vUv = aCorner;
  // gold to warm white, a few cyan sparks
  vCol = r.z < 0.12 ? vec3(0.45, 1.0, 1.0) : mix(vec3(1.0, 0.62, 0.18), vec3(1.0, 0.92, 0.6), r.y);
  // a mite that ate something carries its colour (brightened to a glowing pastel, a touch of gold left)
  int m = int(floor(v.w));
  if (m > 0 && m < ${re}) { vec3 mc = MAT[m]; mc = mc / max(max(mc.r, mc.g), max(mc.b, 0.05)); vCol = mc * 0.92 + 0.06; }
  // rival swarms glow in their own colour, so every swarm is told apart at a glance
  int tm = teamOf(float(i));
  if (tm > 0) vCol = mix(TEAMC[tm], vCol, 0.18);
  else if (uTint0.a > 0.0) vCol = mix(vCol, uTint0.rgb, uTint0.a);
  else if (uTint0.a < 0.0) { float hu = fract(r.x + uTime * 0.15); vCol = mix(vCol, clamp(abs(fract(hu + vec3(0.0, 0.667, 0.333)) * 6.0 - 3.0) - 1.0, 0.0, 1.0) * 1.1 + 0.15, -uTint0.a); }
  vBright = 0.7 + 0.6 * flap;
}`,me=`#version 300 es
precision mediump float;
in vec2 vUv;
in vec3 vCol;
in float vBright;
out vec4 o;
void main() {
  // a firefly, seen from above: x runs along its flight (front = +x)
  vec2 q = vUv;
  float body = (q.x * q.x) / 0.85 + (q.y * q.y) / 0.12;
  vec2 wl = vec2(q.x + 0.05, abs(q.y) - 0.42);
  float wing = (wl.x * wl.x) / 0.22 + (wl.y * wl.y) / 0.09;
  if (body > 1.0 && wing > 1.0) discard;
  vec3 c;
  if (body <= 1.0) {
    float tail = smoothstep(0.1, -0.6, q.x);               // the glowing abdomen behind
    float head = smoothstep(0.45, 0.8, q.x);
    c = mix(vCol * 0.55, vCol * 2.6 * vBright, tail) * (1.0 - head * 0.45);
  } else {
    c = mix(vec3(0.45, 0.60, 0.70), vCol, 0.4) * (0.22 + 0.25 * vBright); // thin wings
  }
  o = vec4(c, 1.0);
}`,he=`#version 300 es
precision highp float;
uniform sampler2D uPos, uAtlas;
uniform mat4 uVP;
uniform vec3 uCamR, uCamU, uLeaders[7];
uniform vec4 uB[64];
uniform vec4 uS2[64];
uniform float uS, uTime;
in vec2 aCorner;
out vec2 vUv;
out float vA;
out float vKind;
out vec3 vCol;
${se}
${y}
${oe}
ivec2 atlasTexel(int b, ivec3 v) { return ivec2((b % 8) * 256 + (v.z % 8) * 32 + v.x, (b / 8) * 128 + (v.z / 8) * 32 + v.y); }
void main() {
  int i = gl_InstanceID;
  vec4 p = texelFetch(uPos, ivec2(i % int(uS), i / int(uS)), 0);
  if (p.w < 1.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec3 r = h31(float(i) * 3.1);
  // what is being bitten: the material of the voxel at the bite (its true colour)
  int b = int(floor(p.w - 2.0));
  vec3 lp = (p.xyz - vec3(uB[b].x, uS2[b].y, uB[b].y)) / (${ce.toFixed(3)} * uS2[b].x) + vec3(16.0, 0.0, 16.0);
  ivec3 v = clamp(ivec3(floor(lp)), ivec3(0), ivec3(31));
  vec4 vox = texelFetch(uAtlas, atlasTexel(b, v), 0);
  vCol = vox.b > 0.5 ? MAT[int(vox.b + 0.5)] : vec3(0.42, 0.40, 0.38);
  // each bite throws a crumb that arcs into the swarm's heart and feeds it
  float ph = fract(uTime * (0.9 + r.x * 0.8) + r.y);
  vec3 to = uLeaders[teamOf(float(i))] + vec3(r.x - 0.5, 1.2 + r.z, r.y - 0.5) * 2.0;
  vec3 cp = mix(p.xyz, to, ph * ph) + vec3(0.0, sin(ph * 3.14159) * (1.5 + 2.0 * r.z), 0.0);
  bool dust = r.z > 0.7;
  float size = dust ? 0.3 + 0.5 * ph : 0.07 + 0.06 * r.x;
  vKind = dust ? 1.0 : 0.0;
  vA = dust ? (1.0 - ph) * 0.15 : 1.0 - smoothstep(0.75, 1.0, ph);
  vec3 wp = (dust ? p.xyz + vec3(0.0, ph * 1.2, 0.0) : cp) + (uCamR * aCorner.x + uCamU * aCorner.y) * size * (dust ? 1.0 : 1.0 - ph * 0.5);
  vUv = aCorner;
  gl_Position = uVP * vec4(wp, 1.0);
}`,ge=`#version 300 es
precision mediump float;
in vec2 vUv;
in float vA;
in float vKind;
in vec3 vCol;
out vec4 o;
void main() {
  float r2 = dot(vUv, vUv);
  if (r2 > 1.0) discard;
  vec3 c = vKind > 0.5 ? mix(vec3(0.55, 0.52, 0.50), vCol, 0.4) : vCol * 1.3 + vec3(0.25, 0.15, 0.05) * (1.0 - r2);
  float a = vKind > 0.5 ? vA * (1.0 - r2) : vA;
  o = vec4(c * a, a);
}`,_e=class{constructor(n){f(this,`pos`,void 0),f(this,`cur`,0),f(this,`den`,void 0),f(this,`denA`,void 0),f(this,`denB`,void 0),f(this,`upd`,void 0),f(this,`splat`,void 0),f(this,`blur`,void 0),f(this,`mite`,void 0),f(this,`chip`,void 0),f(this,`quad`,void 0),f(this,`empty`,void 0),f(this,`gl`,void 0),f(this,`shock`,new Float32Array(4)),f(this,`L`,new Float32Array(21)),f(this,`LV`,new Float32Array(21)),f(this,`A`,new Float32Array(7)),f(this,`R`,new Float32Array(7)),f(this,`SP`,new Float32Array(7).fill(10)),f(this,`AV`,new Float32Array(7)),f(this,`drawCap`,1e9),f(this,`tint0`,new Float32Array([1,1,1,0])),f(this,`birth`,new Float32Array([0,0,0,0])),f(this,`open`,!1),f(this,`reset`,!1),f(this,`shape`,{blend:0,scale:1,pos:new Float32Array(3),pa:new Float32Array(96),pb:new Float32Array(96),pw:new Float32Array(24),n:1}),this.gl=n;let i={internal:n.RGBA32F,format:n.RGBA,type:n.FLOAT,filter:n.NEAREST};this.pos=[r(n,512,512,[i,i]),r(n,512,512,[i,i])];let a={internal:n.R16F,format:n.RED,type:n.HALF_FLOAT,filter:n.LINEAR};this.den=r(n,256,256,[a]),this.denA=r(n,256,256,[a]),this.denB=r(n,256,256,[a]),this.upd=t(n,e,le,`update`),this.splat=t(n,ue,de,`splat`),this.blur=t(n,e,fe,`blur`),this.mite=t(n,pe,me,`mite`),this.chip=t(n,he,ge,`chips`),this.empty=n.createVertexArray(),this.quad=n.createVertexArray(),n.bindVertexArray(this.quad);let o=n.createBuffer();n.bindBuffer(n.ARRAY_BUFFER,o),n.bufferData(n.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),n.STATIC_DRAW);let s=n.getAttribLocation(this.mite.p,`aCorner`);n.enableVertexAttribArray(s),n.vertexAttribPointer(s,2,n.FLOAT,!1,0,0),n.bindVertexArray(null)}get state(){return this.pos[this.cur]}get light(){return this.denB.tex[0]}span(){let e=this.AV;for(let t=0;t<7;t++)e[t]=Math.min(this.A[t],ae[t],this.drawCap);let t=e[0];for(let n=1;n<7;n++)e[n]>0&&(t=ie[n]+e[n]+1024);return Math.min(262144,Math.max(t,e[0]+1024))}step(e,t,n,r,a,o,s){let c=this.gl,l=this.pos[this.cur],u=this.pos[1-this.cur];c.disable(c.BLEND),c.disable(c.DEPTH_TEST),c.bindFramebuffer(c.FRAMEBUFFER,u.fb),c.viewport(0,0,512,512);let d=this.upd.u;c.useProgram(this.upd.p),i(c,0,l.tex[0],d.uPos),i(c,1,l.tex[1],d.uVel),i(c,2,this.denB.tex[0],d.uDen),i(c,3,s.grid,d.uGrid),i(c,4,s.atlas,d.uAtlas),c.uniform4fv(d.uB,s.b),c.uniform4fv(d.uB2,s.b2),c.uniform4fv(d.uS2,s.s2),c.uniform4fv(d.uShock,this.shock),this.L.set(n,0),this.LV.set(r,0),this.A[0]=a,this.SP[0]=o;for(let e=0;e<7;e++)this.AV[e]=Math.min(this.A[e],ae[e],this.drawCap),this.R[e]=3+Math.sqrt(Math.min(this.A[e],131072))*.05;c.uniform3fv(d.uLeaders,this.L),c.uniform3fv(d.uLeaderVels,this.LV),c.uniform1fv(d.uActiveT,this.AV),c.uniform1fv(d.uRadiusT,this.R),c.uniform1fv(d.uSpeedT,this.SP),c.uniform1f(d.uDt,e),c.uniform1f(d.uTime,t),c.uniform1f(d.uS,512),c.uniform1f(d.uWorld,160),c.uniform1f(d.uRep,1),c.uniform1f(d.uLift,1.7),i(c,5,s.height,d.uHeight),c.uniform4fv(d.uBirth,this.birth),c.uniform1f(d.uReset,+!!this.reset),c.uniform1f(d.uOpen,+!!this.open),this.reset=!1;let f=this.shape;c.uniform1f(d.uShape,f.blend),c.uniform1f(d.uShapeScale,f.scale),c.uniform3fv(d.uShapePos,f.pos),c.uniform4fv(d.uPa,f.pa),c.uniform4fv(d.uPb,f.pb),c.uniform1fv(d.uPw,f.pw),c.uniform1i(d.uNP,f.n),c.uniform2f(d.uDenTexel,1/256,1/256),c.bindVertexArray(this.empty);let p=Math.min(512,Math.ceil((this.span()+1024)/512));c.enable(c.SCISSOR_TEST),c.scissor(0,0,512,p),c.drawArrays(c.TRIANGLES,0,3),c.disable(c.SCISSOR_TEST),this.cur=1-this.cur,c.bindFramebuffer(c.FRAMEBUFFER,this.den.fb),c.viewport(0,0,256,256),c.clearColor(0,0,0,0),c.clear(c.COLOR_BUFFER_BIT),c.enable(c.BLEND),c.blendFunc(c.ONE,c.ONE),c.useProgram(this.splat.p),i(c,0,this.state.tex[0],this.splat.u.uPos),c.uniform1f(this.splat.u.uS,512),c.uniform1f(this.splat.u.uWorld,160),c.drawArrays(c.POINTS,0,this.span()),c.disable(c.BLEND),c.useProgram(this.blur.p);let m=(e,t,n,r)=>{c.bindFramebuffer(c.FRAMEBUFFER,t.fb),i(c,0,e,this.blur.u.uSrc),c.uniform2f(this.blur.u.uDir,n/256,r/256),c.drawArrays(c.TRIANGLES,0,3)};m(this.den.tex[0],this.denA,1,0),m(this.denA.tex[0],this.denB,0,1),m(this.denB.tex[0],this.denA,2,0),m(this.denA.tex[0],this.denB,0,2)}draw(e,t,n,r,a,o,s,c){let l=this.gl,u=this.mite.u;l.useProgram(this.mite.p),i(l,0,this.state.tex[0],u.uPos),i(l,1,this.state.tex[1],u.uVel),l.uniformMatrix4fv(u.uVP,!1,e),l.uniform3fv(u.uCamR,t),l.uniform3fv(u.uCamU,n),l.uniform1f(u.uS,512),l.uniform1f(u.uSize,.13),l.uniform1f(u.uTime,r),l.uniform1f(u.uMinPx,1.15),l.uniform1f(u.uPxScale,o),l.uniform4fv(u.uTint0,this.tint0),l.enable(l.DEPTH_TEST),l.depthMask(!0),l.bindVertexArray(this.quad),l.drawArraysInstanced(l.TRIANGLE_STRIP,0,4,this.span());let d=this.chip.u;l.useProgram(this.chip.p),i(l,0,this.state.tex[0],d.uPos),i(l,1,c.atlas,d.uAtlas),l.uniform3fv(d.uLeaders,this.L),l.uniform4fv(d.uB,c.b),l.uniform4fv(d.uS2,c.s2),l.uniformMatrix4fv(d.uVP,!1,e),l.uniform3fv(d.uCamR,t),l.uniform3fv(d.uCamU,n),l.uniform1f(d.uS,512),l.uniform1f(d.uTime,r),l.enable(l.BLEND),l.blendFunc(l.ONE,l.ONE_MINUS_SRC_ALPHA),l.depthMask(!1),l.drawArraysInstanced(l.TRIANGLE_STRIP,0,4,this.span()),l.depthMask(!0),l.disable(l.BLEND)}},ve=`#version 300 es
precision highp float;
uniform mat4 uInvVP;
uniform vec3 uCam;
uniform vec3 uSkyLow, uSkyTop, uHorizon;
in vec2 vUv;
out vec4 o;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec4 w = uInvVP * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
  vec3 dir = normalize(w.xyz / w.w - uCam);
  float y = dir.y;
  vec3 c = mix(uSkyLow, uSkyTop, smoothstep(-0.05, 0.6, y));
  c += uHorizon * exp(-abs(y) * 14.0) * 0.6; // the glow on the horizon
  // a few stars
  vec2 sp = dir.xz / max(0.15, y + 0.2) * 60.0;
  float s = step(0.996, h(floor(sp))) * smoothstep(0.1, 0.5, y);
  o = vec4(c + s * 0.8, 1.0);
}`,ye=192,be=`#version 300 es
precision highp float;
uniform mat4 uVP;
uniform float uSize, uWorld, uGrid;
uniform sampler2D uHeight;
out vec3 vW;
out vec3 vN;
${w}
void main() {
  if (uGrid > 0.5) {
    int cell = gl_VertexID / 6, c = gl_VertexID % 6;
    int ci = cell % ${ye}, cj = cell / ${ye};
    ivec2 o = c == 0 ? ivec2(0, 0) : c == 1 ? ivec2(1, 0) : c == 2 ? ivec2(1, 1) : c == 3 ? ivec2(0, 0) : c == 4 ? ivec2(1, 1) : ivec2(0, 1);
    vec2 xz = (vec2(ci + o.x, cj + o.y) / float(${ye}) - 0.5) * uWorld;
    float e = uWorld / float(${ye});
    vN = normalize(vec3(groundH(xz - vec2(e, 0.0)) - groundH(xz + vec2(e, 0.0)), 2.0 * e, groundH(xz - vec2(0.0, e)) - groundH(xz + vec2(0.0, e))));
    vW = vec3(xz.x, groundH(xz), xz.y);
  } else {
    vec2 q = vec2(float((gl_VertexID & 1)), float((gl_VertexID >> 1) & 1)) * 2.0 - 1.0;
    vW = vec3(q.x * uSize, -0.01, q.y * uSize);
    vN = vec3(0.0, 1.0, 0.0);
  }
  gl_Position = uVP * vec4(vW, 1.0);
}`,xe=`#version 300 es
precision highp float;
uniform sampler2D uLight, uColor;
uniform float uWorld, uGrid;
uniform vec3 uCam;
uniform vec3 uStoneA, uStoneB, uFog, uGrassA, uGrassB;
uniform vec4 uHint; // x, z, radius, strength: a pulsing ring that says "eat this" (onboarding)
uniform float uTime, uWall;
uniform vec2 uShape; // lobes, depth
uniform vec3 uNextA, uNextB, uPrevGrass; // the land ahead (north) and the land behind (south, already alive)
uniform float uPrevOn;
in vec3 vW;
in vec3 vN;
out vec4 o;
const float WATER = ${te.toFixed(2)};
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec2 p = vW.xz;
  if (uGrid < 0.5 && abs(p.x) < uWorld * 0.5 - 0.3 && abs(p.y) < uWorld * 0.5 - 0.3) discard; // the hill grid covers this
  // petrified ground: irregular stone slabs (voronoi) with dark cracks and grit
  vec2 gp = p / 2.2, gi = floor(gp), gf = fract(gp);
  float d1 = 9.0, d2 = 9.0; vec2 cell = gi;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 o2 = vec2(float(i), float(j)), pt = o2 + vec2(h(gi + o2), h(gi + o2 + 17.0)) * 0.9;
    float dd = length(gf - pt);
    if (dd < d1) { d2 = d1; d1 = dd; cell = gi + o2; } else if (dd < d2) d2 = dd;
  }
  float crack = smoothstep(0.0, 0.08, d2 - d1);
  float n = vn(p * 0.35) * 0.5 + vn(p * 1.7) * 0.25 + h(cell) * 0.16 + vn(p * 6.0) * 0.08;
  vec3 stone = mix(uStoneA, uStoneB, n) * mix(0.55, 1.0, crack);
  // the swarm's own light, from the blurred density field
  vec2 uv = p / uWorld + 0.5;
  float d = (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) ? texture(uLight, uv).r : 0.0;
  float glow = 1.0 - exp(-d * 0.012);
  // colour coming back: grass and flowers where the swarm has been
  float rest = (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) ? clamp(texture(uColor, uv).r, 0.0, 1.0) : 0.0;
  // living ground seen from afar: meadow colours that vary (clover, dry patches, flower drifts)
  float m1 = vn(p * 0.12), m2 = vn(p * 0.5 + 7.0), m3 = vn(p * 2.3);
  vec3 grass = mix(uGrassA, uGrassB, m1);
  grass = mix(grass, vec3(0.62, 0.66, 0.30), smoothstep(0.62, 0.85, m2) * 0.6);
  grass *= 0.82 + 0.3 * m3;
  grass = mix(grass, vec3(0.95, 0.82, 0.35), smoothstep(0.8, 0.95, vn(p * 1.1 + 3.0)) * 0.35);
  grass = mix(grass, vec3(0.92, 0.55, 0.80), smoothstep(0.82, 0.97, vn(p * 1.3 + 11.0)) * 0.3);
  float flower = step(0.985, h(floor(p * 2.0)));
  grass = mix(grass, mix(vec3(1.0, 0.85, 0.3), vec3(1.0, 0.45, 0.7), h(floor(p * 2.0) + 3.1)), flower);
  // the edge of the colour is ragged and alive, like paint soaking into stone
  float edge = smoothstep(0.0, 1.0, rest * 1.6 - (vn(p * 0.9) * 0.6 + vn(p * 3.1) * 0.3));
  vec3 ground = mix(stone, grass * mix(0.75, 1.0, crack), edge);
  rest = edge;
  vec3 lit = ground * (0.45 + 1.6 * glow) * mix(1.0, 1.25, rest) + vec3(1.0, 0.5, 0.15) * glow * 0.4;
  // the onboarding ring: a soft pulse around the first thing to eat
  if (uHint.w > 0.0) {
    float dh = length(p - uHint.xy), ph = fract(uTime * 0.8);
    float ring = exp(-pow((dh - uHint.z * (0.7 + ph * 0.6)) * 2.2, 2.0)) * (1.0 - ph);
    lit += vec3(1.0, 0.8, 0.35) * ring * uHint.w * 1.4;
  }
  // hills catch the light (strong, so the land reads as land); the pond's floor is dark silt
  float sun = max(0.0, dot(normalize(vN), normalize(vec3(0.4, 1.0, 0.3))));
  lit *= 0.38 + 0.8 * sun;
  if (vW.y < WATER) lit *= mix(0.45, 0.85, smoothstep(WATER - 2.0, WATER, vW.y));
  // beyond the wall: ahead (north) the next land in its own stone, behind (south) the land you freed, green
  float an = atan(p.y, p.x), wf = 1.0 - uShape.y * (1.0 - cos(uShape.x * (an + 1.5708))) * 0.5;
  float rr = length(p) / wf;
  vec3 nextC = mix(uNextA, uNextB, n) * mix(0.6, 1.0, crack) * (0.55 + 0.7 * sun);
  vec3 prevC = mix(uPrevGrass * 0.8, uPrevGrass * 1.1, m1) * mix(0.75, 1.0, crack) * (0.45 + 0.6 * sun);
  vec3 outC = mix(nextC, mix(stone * (0.35 + 0.6 * sun), prevC, uPrevOn), smoothstep(-25.0, 25.0, p.y));
  lit = mix(lit, outC, smoothstep(uWall + 1.0, uWall + 3.0, rr));
  float dist = length(vW - uCam);
  lit = mix(lit, uFog, smoothstep(90.0, 260.0, dist));
  o = vec4(lit, 1.0);
}`,Se=`#version 300 es
precision highp float;
uniform mat4 uVP;
uniform vec4 uPond; // x, z, half size
out vec3 vW;
void main() {
  vec2 q = vec2(float((gl_VertexID & 1)), float((gl_VertexID >> 1) & 1)) * 2.0 - 1.0;
  vW = vec3(uPond.x + q.x * uPond.z, ${te.toFixed(2)}, uPond.y + q.y * uPond.z);
  gl_Position = uVP * vec4(vW, 1.0);
}`,Ce=`#version 300 es
precision highp float;
uniform sampler2D uColor, uHeight, uLight;
uniform vec4 uPond;
uniform float uWorld, uTime, uLiquid; // 0 water, 1 ice, 2 lava
uniform vec2 uSwarm;
uniform vec3 uCam, uFog, uSkyLow;
in vec3 vW;
out vec4 o;
${w}
float hh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hh(i), hh(i + vec2(1, 0)), f.x), mix(hh(i + vec2(0, 1)), hh(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += vn(p) * a; p = p * 2.03 + 7.1; a *= 0.5; } return s; }
void main() {
  float depth = WATER - groundH(vW.xz);
  if (depth < 0.0 || length(vW.xz - uPond.xy) > uPond.z * 0.8) discard;
  vec2 uv = vW.xz / uWorld + 0.5;
  float rest = clamp(texture(uColor, uv).r * 1.3, 0.0, 1.0);
  float glow = 1.0 - exp(-texture(uLight, uv).r * 0.012);
  vec3 v = normalize(vW - uCam);
  vec2 w = vW.xz * 0.9 + vec2(uTime * 0.4, uTime * 0.25);
  vec3 n = normalize(vec3(sin(w.x) * 0.08 + sin(w.y * 1.7 + 1.0) * 0.05, 1.0, cos(w.y) * 0.08 + sin(w.x * 1.3) * 0.05));
  float fres = pow(1.0 - max(0.0, dot(-v, n)), 3.0);
  vec3 deep = mix(vec3(0.10, 0.22, 0.36), mix(vec3(0.05, 0.25, 0.45), vec3(0.10, 0.55, 0.65), smoothstep(1.5, 0.0, depth)), rest);
  vec3 sky = mix(vec3(0.45, 0.55, 0.68), vec3(0.6, 0.8, 0.95), rest * 0.6);
  vec3 c = mix(deep, sky, 0.25 + fres * 0.7) + vec3(1.0, 0.6, 0.25) * glow * 0.6;
  c += smoothstep(0.25, 0.0, depth) * vec3(0.5, 0.55, 0.6) * 0.5; // a pale rim where it meets the shore
  float spark = pow(max(0.0, sin(w.x * 3.1) * sin(w.y * 2.7)), 30.0) * (0.35 + 0.65 * rest);
  // the swarm on the surface: splashes, foam and rings where it flies low over the water
  float swd = 1.0 - exp(-texture(uLight, uv).r * 0.03);
  float ringS = 0.5 + 0.5 * sin(length(vW.xz - uSwarm) * 3.0 - uTime * 9.0);
  float foam = swd * (0.55 + 0.45 * vn(vW.xz * 4.0 + uTime * 2.0)) + swd * ringS * 0.5 * smoothstep(30.0, 2.0, length(vW.xz - uSwarm));
  c = mix(c, vec3(0.92, 0.97, 1.0), clamp(foam, 0.0, 1.0) * 0.9);
  // a ring of froth at the shrinking edge, where the water is being drunk
  c += vec3(0.8, 0.9, 1.0) * smoothstep(0.85, 1.0, length(vW.xz - uPond.xy) / (uPond.z * 0.8)) * 0.6;
  float rip = smoothstep(0.92, 1.0, sin(length(vW.xz - uPond.xy) * 2.2 - uTime * 1.6)) * 0.18; // slow rings across the pond
  c += rip;
  c += spark * 0.8;
  float a = clamp(0.55 + depth * 0.4, 0.0, 0.92) * smoothstep(0.0, 0.12, depth);
  if (uLiquid > 1.5) { // lava: a glowing crust that cracks open, bright whatever the colour
    // slow-flowing molten rock: dark cooled plates drifting on a glowing flood, hot seams pulsing between them
    vec2 q = vW.xz * 0.35;
    vec2 warp = vec2(fbm(q + uTime * 0.05), fbm(q + 5.2 - uTime * 0.04));
    float f = fbm(q * 1.6 + warp * 1.8 + vec2(uTime * 0.08, 0.0));
    float plate = smoothstep(0.48, 0.62, f);
    float seam = 1.0 - smoothstep(0.0, 0.08, abs(f - 0.5));
    float pulse = 0.75 + 0.25 * sin(uTime * 2.0 + f * 12.0);
    vec3 hot = mix(vec3(2.6, 0.7, 0.12), vec3(3.6, 2.2, 0.6), fbm(q * 4.0 - uTime * 0.2)) * pulse;
    vec3 crustC = vec3(0.10, 0.05, 0.05) + vec3(0.5, 0.12, 0.03) * (1.0 - plate) * 0.6;
    plate *= 1.0 - swd * 0.9; // the crust breaks where the swarm skims it: bright lava bursts up
    c = mix(hot, crustC, plate) + vec3(3.0, 1.4, 0.3) * seam * 0.8 + vec3(3.0, 1.2, 0.2) * swd * ringS;
    c *= smoothstep(0.0, 0.5, depth) * 0.6 + 0.4;
    a = smoothstep(0.0, 0.08, depth);
  } else if (uLiquid > 0.5) { // ice: pale, opaque, with white cracks
    float crack = smoothstep(0.96, 1.0, abs(sin(vW.x * 0.9 + sin(vW.z * 0.7) * 2.0)));
    c = mix(vec3(0.55, 0.60, 0.66), vec3(0.75, 0.90, 1.0), rest) * (0.85 + 0.25 * fres) + crack * 0.4 + vec3(1.0, 0.6, 0.25) * glow * 0.5;
    c += vec3(0.7, 0.9, 1.0) * swd * (0.4 + 0.6 * step(0.9, vn(vW.xz * 6.0 + floor(uTime * 6.0)))); // frost sparkles under the swarm
    a = smoothstep(0.0, 0.08, depth);
  }
  c = mix(c, uFog, smoothstep(70.0, 230.0, length(vW - uCam)));
  o = vec4(c * a, a);
}`,we=`#version 300 es
precision highp float;
uniform mat4 uVP;
layout(location = 0) in vec4 aA; // x, y, z, yaw
layout(location = 1) in vec4 aB; // half sizes, kind
out vec3 vW;
out vec3 vN;
flat out float vKind;
out float vY;
void main() {
  int f = gl_VertexID / 6, c = gl_VertexID % 6;
  int k = c == 0 ? 0 : c == 1 ? 1 : c == 2 ? 2 : c == 3 ? 0 : c == 4 ? 2 : 3;
  vec2 q = vec2(k == 1 || k == 2 ? 1.0 : -1.0, k >= 2 ? 1.0 : -1.0);
  vec3 n = f == 0 ? vec3(1, 0, 0) : f == 1 ? vec3(-1, 0, 0) : f == 2 ? vec3(0, 1, 0) : f == 3 ? vec3(0, -1, 0) : f == 4 ? vec3(0, 0, 1) : vec3(0, 0, -1);
  vec3 t1 = abs(n.y) > 0.5 ? vec3(1, 0, 0) : vec3(0, 1, 0), t2 = cross(n, t1);
  vec3 p = n + t1 * q.x + t2 * q.y;
  // roofs are wedges, trees and mountains taper to a point
  if (aB.w > 1.5 && aB.w < 2.5 && p.y > 0.0) p.z *= 0.04;
  if ((aB.w > 2.5 && aB.w < 3.5 || aB.w > 5.5 && aB.w < 6.5 || aB.w > 7.5) && p.y > 0.0) p.xz *= 0.06;
  vY = p.y * 0.5 + 0.5;
  vec3 lp = p * aB.xyz;
  float cs = cos(aA.w), sn = sin(aA.w);
  vec3 wp = vec3(lp.x * cs - lp.z * sn, lp.y, lp.x * sn + lp.z * cs) + aA.xyz;
  vec3 wn = n;
  if (aB.w > 1.5 && aB.w < 2.5 && n.y > 0.5) wn = vec3(0.0, 0.7, 0.7);
  vN = vec3(wn.x * cs - wn.z * sn, wn.y, wn.x * sn + wn.z * cs);
  vW = wp; vKind = aB.w;
  gl_Position = uVP * vec4(wp, 1.0);
}`,Te=`#version 300 es
precision highp float;
uniform vec3 uCam, uFog, uStoneA, uStoneB;
in vec3 vW;
in vec3 vN;
flat in float vKind;
in float vY;
out vec4 o;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec3 base = mix(uStoneA, uStoneB, 0.55);
  int k = int(vKind + 0.5);
  if (k == 0 || k == 5) { // wall stone: courses of blocks
    vec2 b = vec2(dot(vW.xz, normalize(vec2(-vW.z, vW.x) + 1e-4)) * 1.1, vW.y * 2.2);
    b.x += floor(b.y) * 0.5;
    float m = step(0.08, fract(b.x)) * step(0.1, fract(b.y));
    base = mix(uStoneA, uStoneB, 0.35 + 0.4 * h(floor(b))) * mix(0.6, 1.0, m);
  }
  if (k == 1) base *= 1.05;                 // house walls, slightly paler
  if (k == 2) base *= 0.7;                  // roofs, darker
  if (k == 3) base *= 0.8 + 0.2 * vY;       // grey petrified trees
  if (k == 4) base *= 0.6;                  // trunks
  if (k == 6) base = mix(base * 0.7, base * 1.4, smoothstep(0.65, 0.9, vY)); // far mountains with pale tops
  // the next land shows beyond the wall (still grey, but its shapes and a hint of its colours)
  if (k == 7) base = mix(base, vec3(0.62, 0.30, 0.28), 0.45);             // mushroom caps
  if (k == 8) base = mix(base, vec3(0.85, 0.88, 0.95), 0.6 * smoothstep(0.3, 0.8, vY)); // snowy pines
  if (k == 9) base = mix(base, vec3(0.55, 0.42, 0.80), 0.5) * (1.0 + 0.6 * vY); // crystals
  float sun = max(0.0, dot(normalize(vN), normalize(vec3(0.4, 1.0, 0.3))));
  vec3 c = base * (0.45 + 0.6 * sun);
  c = mix(c, uFog, smoothstep(70.0, 240.0, length(vW - uCam)));
  o = vec4(c, 1.0);
}`;function Ee(e,t){return 64*S(Math.atan2(t,e))}var De=class{constructor(n,r){f(this,`pal`,void 0),f(this,`nextPal`,void 0),f(this,`prevPal`,void 0),f(this,`hint`,new Float32Array(4)),f(this,`sky`,void 0),f(this,`ground`,void 0),f(this,`water`,void 0),f(this,`box`,void 0),f(this,`vao`,void 0),f(this,`boxVao`,void 0),f(this,`boxBuf`,void 0),f(this,`boxN`,0),f(this,`gl`,void 0),f(this,`terrain`,void 0),f(this,`liquid`,0),f(this,`swarmXZ`,[0,0]),this.gl=n,this.terrain=r,this.sky=t(n,e,ve,`sky`),this.ground=t(n,be,xe,`ground`),this.water=t(n,Se,Ce,`water`),this.box=t(n,we,Te,`boxes`),this.vao=n.createVertexArray(),this.boxVao=n.createVertexArray(),this.boxBuf=n.createBuffer(),n.bindVertexArray(this.boxVao),n.bindBuffer(n.ARRAY_BUFFER,this.boxBuf),n.enableVertexAttribArray(0),n.vertexAttribPointer(0,4,n.FLOAT,!1,32,0),n.vertexAttribDivisor(0,1),n.enableVertexAttribArray(1),n.vertexAttribPointer(1,4,n.FLOAT,!1,32,16),n.vertexAttribDivisor(1,1),n.bindVertexArray(null)}scenery(e,t,n=-1){let r=e*48271+11,i=()=>(r=r*16807%2147483647,r/2147483647),a=[],o=(e,t,n,r,i,o,s,c)=>a.push(e,t+o,n,r,i,o,s,c),s=66.2,c=t,l=e=>Math.abs(Math.cos(e))<.06,u=e=>[Math.cos(e)*s*S(e),Math.sin(e)*s*S(e)];for(let e=0;e<112;e++){let t=(e+.5)/112*Math.PI*2;if(l(t))continue;let[n,r]=u(e/112*Math.PI*2),[i,a]=u((e+1)/112*Math.PI*2),s=(n+i)/2,c=(r+a)/2,d=Math.hypot(i-n,a-r),f=-Math.atan2(a-r,i-n);o(s,0,c,f,d/2+.15,2.6,1,0);let p=Math.cos(t)*.75,m=Math.sin(t)*.75;o(s-p,5.2,c-m,f,.7,.45,.25,5)}for(let e=0;e<16;e++){let t=(e+.5)/16*Math.PI*2,[n,r]=u(t);o(n,0,r,t,2.2,4.2,2.2,5),o(n,8.4,r,t+.785,2.7,.35,2.7,5),o(n,9.1,r,t,2.4,2.6,2.4,3)}for(let e of[-1,1])for(let t of[-1,1]){let n=t*6.2,r=e*Math.sqrt(s*s-38);o(n,0,r,0,2.4,5.2,2.4,5),o(n,10.4,r,.785,2.9,.4,2.9,5),o(n,11.2,r,0,2.6,3.2,2.6,3)}for(let e=0;e<900;e++){let e=i()*Math.PI*2,r=s*S(e)+5+i()**.8*120,a=Math.cos(e)*r,l=Math.sin(e)*r,u=i()*Math.PI;if(t=l<0?c:n>=0?n:c,!(Math.abs(a)<7&&Math.abs(l)>64.2&&Math.abs(l)<106.2)){if(t===1&&i()<.55){let e=1.5+i()*3;o(a,0,l,u,.45,e,.45,4),o(a,e*2,l,u,1.6+i()*1.6,.5,1.6+i()*1.6,7)}else if(t===3&&i()<.6){let e=2+i()*3;o(a,0,l,u,.25,.7,.25,4),o(a,1,l,u,1.2+i()*.6,e,1.2+i()*.6,8)}else if(t===4&&i()<.5){let e=3+i()*6;o(a,0,l,u,.7+i()*.6,e,.7+i()*.6,9)}else if(t===2&&i()<.5){let e=1.6+i(),t=3+i()*3;o(a,0,l,u,e,t,e,1),o(a,t*2,l,u,e+.2,1.2,e+.2,2)}else if(i()<.42){let e=1.4+i()*1.4,t=1.2+i()*1.2,n=1.2+i()*(r>110?3.5:1.6);o(a,0,l,u,e,n,t,1),o(a,n*2,l,u,e+.2,.9+i()*.6,t+.25,2)}else{let e=1.6+i()*2.4;o(a,0,l,u,.25,.8,.25,4),o(a,1.2,l,u,1.1+i()*.8,e,1.1+i()*.8,3)}}}for(let e=0;e<40;e++){let t=e/40*Math.PI*2+i()*.1,n=215+i()*30;o(Math.cos(t)*n,-2,Math.sin(t)*n,i()*3,18+i()*20,14+i()*22,18+i()*20,6)}let d=this.gl;d.bindBuffer(d.ARRAY_BUFFER,this.boxBuf),d.bufferData(d.ARRAY_BUFFER,new Float32Array(a),d.STATIC_DRAW),this.boxN=a.length/8}draw(e,t,n,r,a,o){let s=this.pal,c=this.gl;c.bindVertexArray(this.vao),c.disable(c.DEPTH_TEST),c.useProgram(this.sky.p),c.uniformMatrix4fv(this.sky.u.uInvVP,!1,t),c.uniform3fv(this.sky.u.uCam,n),c.uniform3fv(this.sky.u.uSkyLow,s.skyLow),c.uniform3fv(this.sky.u.uSkyTop,s.skyTop),c.uniform3fv(this.sky.u.uHorizon,s.horizon),c.drawArrays(c.TRIANGLES,0,3),c.enable(c.DEPTH_TEST);let l=this.ground.u;c.useProgram(this.ground.p),c.uniformMatrix4fv(l.uVP,!1,e),c.uniform1f(l.uSize,400),c.uniform1f(l.uWorld,160),c.uniform3fv(l.uCam,n),c.uniform3fv(l.uStoneA,s.stoneA),c.uniform3fv(l.uStoneB,s.stoneB),c.uniform3fv(l.uFog,s.fog),c.uniform3fv(l.uGrassA,s.grassA),c.uniform3fv(l.uGrassB,s.grassB),c.uniform4fv(l.uHint,this.hint),c.uniform1f(l.uTime,o),c.uniform1f(l.uWall,66.2),c.uniform2f(l.uShape,x.k,x.a);let u=this.nextPal??s;c.uniform3fv(l.uNextA,u.stoneA.map(e=>e*1.25)),c.uniform3fv(l.uNextB,u.stoneB.map(e=>e*1.25)),c.uniform3fv(l.uPrevGrass,(this.prevPal??s).grassA),c.uniform1f(l.uPrevOn,+!!this.prevPal),i(c,0,r,l.uLight),i(c,1,a,l.uColor),i(c,2,this.terrain.tex,l.uHeight),c.uniform1f(l.uGrid,1),c.drawArrays(c.TRIANGLES,0,221184),c.uniform1f(l.uGrid,0),c.drawArrays(c.TRIANGLE_STRIP,0,4);let d=this.box.u;c.useProgram(this.box.p),c.uniformMatrix4fv(d.uVP,!1,e),c.uniform3fv(d.uCam,n),c.uniform3fv(d.uFog,s.fog),c.uniform3fv(d.uStoneA,s.stoneA),c.uniform3fv(d.uStoneB,s.stoneB),c.bindVertexArray(this.boxVao),c.drawArraysInstanced(c.TRIANGLES,0,36,this.boxN),c.bindVertexArray(this.vao)}drawWater(e,t,n,r,a){let o=this.gl,s=this.water.u;o.bindVertexArray(this.vao),o.useProgram(this.water.p),o.uniformMatrix4fv(s.uVP,!1,e),o.uniform1f(s.uWorld,160),o.uniform1f(s.uTime,a),o.uniform3fv(s.uCam,t),o.uniform3fv(s.uFog,this.pal.fog),o.uniform3fv(s.uSkyLow,this.pal.skyLow),o.uniform2f(s.uSwarm,this.swarmXZ[0],this.swarmXZ[1]),i(o,0,r,s.uColor),i(o,1,this.terrain.tex,s.uHeight),i(o,2,n,s.uLight),o.enable(o.BLEND),o.blendFunc(o.ONE,o.ONE_MINUS_SRC_ALPHA),o.depthMask(!1);for(let[e,t]of[[this.terrain.pond,this.liquid],[this.terrain.pond2,0]])e.r<=0||(o.uniform4f(s.uPond,e.x,e.z,e.r*1.5,0),o.uniform1f(s.uLiquid,t),o.drawArrays(o.TRIANGLE_STRIP,0,4));o.depthMask(!0),o.disable(o.BLEND)}},Oe=.28,ke=2048,Ae=1024,je=[0,.86,.93,.9,.85,.92,.84,.95,.965,.965,.965,.8,.86,.85,.9,.92,.9,.9,.9,.9,.95,.95,.95,.8,.965,.88,.86,.9],Me=`const float HOLD[${je.length}] = float[${je.length}](${je.map(e=>e.toFixed(3)).join(`,`)});`,Ne=`
ivec2 atl(int b, ivec3 v) { return ivec2((b % 8) * 256 + (v.z % 8) * 32 + v.x, (b / 8) * 128 + (v.z / 8) * 32 + v.y); }
`,Pe=`#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform float uMark; // 1 in play: pieces that move are marked as fallen (0 while the land settles at load)
uniform ivec3 uDir; // this pass's sliding direction (cycles through the four sides)
out vec4 o;
${Ne}${Me}
int B; ivec3 VV;
vec4 cell(ivec3 v) {
  if (v.y < 0) return vec4(1.0, 1.0, 17.0, 0.0); // the ground: solid, fully holding
  if (any(lessThan(v, ivec3(0))) || any(greaterThan(v, ivec3(31)))) return vec4(0.0);
  return texelFetch(uSrc, atl(B, v), 0);
}
const float THR = 0.3;
// G channel: support 0..1 for held voxels, -1 while falling (a falling voxel ignores walls: it only lands on held ground)
void main() {
  ivec2 fc = ivec2(gl_FragCoord.xy);
  ivec2 tile = ivec2(fc.x / 256, fc.y / 128);
  B = tile.y * 8 + tile.x;
  ivec2 l = fc - tile * ivec2(256, 128);
  ivec3 v = ivec3(l.x % 32, l.y % 32, (l.x / 32) + (l.y / 32) * 8);
  vec4 c = cell(v), up = cell(v + ivec3(0, 1, 0)), dn = cell(v - ivec3(0, 1, 0));
  bool solid = c.r > 0.5, dnSolid = dn.r > 0.5;
  vec4 r = solid ? c : vec4(0.0);
  // straight down first; then loose voxels resting on loose voxels slide down one side (rubble spreads into a heap)
  vec4 src = cell(v - uDir + ivec3(0, 1, 0));                    // the voxel that could slide into this cell
  vec4 srcDn = cell(v - uDir);                                   // what that voxel rests on
  vec4 tgt = cell(v + uDir - ivec3(0, 1, 0));                    // where this voxel could slide to
  vec4 tgtUp = cell(v + uDir);                                   // the cell above that target
  bool upFalls = up.r > 0.5 && up.g < THR;
  if (!solid && upFalls) r = vec4(up.r, -1.0, up.b, fract(up.a) + 2.0 * uMark);                          // drop in from above
  else if (!solid && up.r < 0.5 && src.r > 0.5 && src.g < 0.0 && srcDn.r > 0.5 && srcDn.g < THR && v.y < 31)
    r = vec4(src.r, -1.0, src.b, fract(src.a) + 2.0 * uMark);                                            // slide in diagonally
  else if (solid && c.g < THR && !dnSolid) r = vec4(0.0);                                       // drop out
  else if (solid && c.g < 0.0 && dnSolid && dn.g < THR && tgt.r < 0.5 && tgtUp.r < 0.5 && v.y > 0 && all(greaterThanEqual(v + uDir, ivec3(0))) && all(lessThanEqual(v + uDir, ivec3(31))))
    r = vec4(0.0);                                                                               // slide out diagonally
  if (r.r > 0.5) {
    if (r.g < 0.0) {
      // falling: it lands only on something that is itself held up
      if (dnSolid && dn.g >= THR) r.g = dn.g;
    } else {
      float s = dnSolid ? max(dn.g, 0.0) : 0.0;
      float hold = HOLD[int(r.b + 0.5)];
      vec4 n1 = cell(v + ivec3(1, 0, 0)), n2 = cell(v - ivec3(1, 0, 0)), n3 = cell(v + ivec3(0, 0, 1)), n4 = cell(v - ivec3(0, 0, 1));
      float side = max(max(n1.r > 0.5 ? n1.g : 0.0, n2.r > 0.5 ? n2.g : 0.0), max(n3.r > 0.5 ? n3.g : 0.0, n4.r > 0.5 ? n4.g : 0.0));
      float upS = up.r > 0.5 ? max(up.g, 0.0) * 0.5 : 0.0; // hanging from above helps a little (beams, branches)
      r.g = max(s, max(side, upS) * hold);
      if (r.g < THR) r.g = -1.0; // no longer held: it starts to fall
    }
  }
  o = r;
}`,Fe=`#version 300 es
precision highp float;
uniform mat4 uVP;
uniform vec4 uB[64];
uniform vec4 uS2[64]; // scale, y offset
out vec3 vW;
flat out int vB;
const vec3 P[8] = vec3[8](vec3(0,0,0), vec3(1,0,0), vec3(1,1,0), vec3(0,1,0), vec3(0,0,1), vec3(1,0,1), vec3(1,1,1), vec3(0,1,1));
const int I[36] = int[36](0,2,1, 0,3,2, 4,5,6, 4,6,7, 0,1,5, 0,5,4, 3,7,6, 3,6,2, 0,4,7, 0,7,3, 1,2,6, 1,6,5);
void main() {
  int b = gl_InstanceID;
  vec4 B = uB[b];
  vB = b;
  if (B.w < 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float vs = ${Oe.toFixed(3)} * uS2[b].x;
  vec3 lo = vec3(B.x - 16.0 * vs, uS2[b].y, B.y - 16.0 * vs);
  vW = lo + P[I[gl_VertexID]] * 32.0 * vs;
  gl_Position = uVP * vec4(vW, 1.0);
}`,Ie=`#version 300 es
precision highp float;
uniform sampler2D uAtlas, uColor, uLight;
uniform mat4 uVP;
uniform vec4 uB[64];
uniform vec4 uS2[64];
uniform vec3 uCam, uSun, uFocus;
uniform float uWorld, uShadow;
in vec3 vW;
flat in int vB;
out vec4 o;
${Ne}${y}
int b;
vec4 vox(ivec3 v) {
  if (any(lessThan(v, ivec3(0))) || any(greaterThan(v, ivec3(31)))) return vec4(0.0);
  return texelFetch(uAtlas, atl(b, v), 0);
}
float occ(ivec3 v) { return vox(v).r > 0.5 ? 1.0 : 0.0; }
void main() {
  b = vB;
  vec4 B = uB[b];
  float vs = ${Oe.toFixed(3)} * uS2[b].x;
  vec3 lo = vec3(B.x - 16.0 * vs, uS2[b].y, B.y - 16.0 * vs);
  vec3 ro = (uCam - lo) / vs, rd = normalize(vW - uCam);
  // enter the 32^3 box (or start inside it)
  vec3 inv = 1.0 / rd;
  vec3 t0 = (vec3(0.0) - ro) * inv, t1 = (vec3(32.0) - ro) * inv;
  vec3 tmin = min(t0, t1), tmax = max(t0, t1);
  float tn = max(max(tmin.x, tmin.y), max(tmin.z, 0.0)), tf = min(min(tmax.x, tmax.y), tmax.z);
  if (tn > tf) discard;
  vec3 p = ro + rd * (tn + 1e-3);
  ivec3 cell = clamp(ivec3(floor(p)), ivec3(0), ivec3(31));
  ivec3 stp = ivec3(sign(rd));
  vec3 tDelta = abs(inv);
  vec3 tNext = (vec3(cell) + max(vec3(stp), 0.0) - ro) * inv;
  vec3 nrm = -vec3(stp) * vec3(equal(tmin, vec3(tn)));
  float t = tn;
  vec4 hit = vec4(0.0);
  for (int i = 0; i < 110; i++) {
    hit = vox(cell);
    if (hit.r > 0.5) break;
    if (tNext.x < tNext.y && tNext.x < tNext.z) { t = tNext.x; tNext.x += tDelta.x; cell.x += stp.x; nrm = vec3(-float(stp.x), 0, 0); }
    else if (tNext.y < tNext.z) { t = tNext.y; tNext.y += tDelta.y; cell.y += stp.y; nrm = vec3(0, -float(stp.y), 0); }
    else { t = tNext.z; tNext.z += tDelta.z; cell.z += stp.z; nrm = vec3(0, 0, -float(stp.z)); }
    if (any(lessThan(cell, ivec3(0))) || any(greaterThan(cell, ivec3(31)))) discard;
  }
  if (hit.r < 0.5) discard;
  vec3 hp = ro + rd * t;
  vec3 wp = lo + hp * vs;
  // between the camera and the swarm? then it is see-through (screen-door, no sorting needed)
  {
    vec3 ctr = vec3(B.x, 0.0, B.y);
    vec3 seg = uFocus - uCam;
    float k = clamp(dot(ctr - uCam, seg) / dot(seg, seg), 0.0, 1.0);
    float dd = length((uCam + seg * k - ctr).xz);
    if (k < 0.92 && dd < 16.0 * vs + 2.5 && wp.y > 1.2) {
      ivec2 q = ivec2(gl_FragCoord.xy) & 3;
      if ((q.x + q.y * 2) % 3 != 0) discard;
    }
  }
  vec4 clip = uVP * vec4(wp, 1.0);
  gl_FragDepth = clip.z / clip.w * 0.5 + 0.5;
  // material, with a per-voxel variation and a soft bevel so it reads as many small pieces
  vec3 col = MAT[int(hit.b + 0.5)] * (0.86 + 0.28 * fract(hit.a));
  bool fallen = hit.a >= 2.0; // pieces that came down show their true colours
  vec3 f = fract(hp) - 0.5;
  vec3 fa = abs(f) * (1.0 - abs(nrm));
  float bevel = 1.0 - smoothstep(0.38, 0.5, max(fa.x, max(fa.y, fa.z))) * 0.18;
  // ambient occlusion from the neighbours around the face
  ivec3 n = ivec3(nrm), a = cell + n;
  ivec3 t1v = n.x != 0 ? ivec3(0, 1, 0) : ivec3(1, 0, 0), t2v = n.z != 0 ? ivec3(0, 1, 0) : ivec3(0, 0, 1);
  if (n.y != 0) { t1v = ivec3(1, 0, 0); t2v = ivec3(0, 0, 1); }
  float ao = occ(a + t1v) + occ(a - t1v) + occ(a + t2v) + occ(a - t2v);
  ao += 0.5 * (occ(a + t1v + t2v) + occ(a - t1v + t2v) + occ(a + t1v - t2v) + occ(a - t1v - t2v));
  ao = 1.0 - ao * 0.09;
  // a short shadow ray toward the sun inside the volume
  float sh = 1.0;
  if (uShadow > 0.5 && dot(nrm, uSun) > 0.0) {
    vec3 q = hp + nrm * 0.51;
    for (int k = 1; k < 14; k++) { ivec3 c2 = ivec3(floor(q + uSun * float(k) * 1.3)); if (any(lessThan(c2, ivec3(0))) || any(greaterThan(c2, ivec3(31)))) break; if (occ(c2) > 0.5) { sh = 0.45; break; } }
  }
  float diff = max(dot(nrm, uSun), 0.0) * sh;
  vec2 uv = wp.xz / uWorld + 0.5;
  float rest = fallen ? 1.0 : clamp(texture(uColor, uv).r * 1.4, 0.0, 1.0);
  vec3 grey = vec3(dot(col, vec3(0.3, 0.59, 0.11))) * 0.62 + 0.05;
  vec3 base = mix(grey, col, rest);
  float sw = texture(uLight, uv).r;
  float glow = (1.0 - exp(-sw * 0.012)) * exp(-wp.y * 0.1);
  vec3 sky = mix(vec3(0.30, 0.28, 0.36), vec3(0.55, 0.62, 0.75), rest);
  vec3 sunC = mix(vec3(0.85, 0.72, 0.65), vec3(1.25, 1.12, 0.95), rest);
  vec3 c = base * (sky * (0.55 + 0.45 * nrm.y) * ao + sunC * diff * 0.9) * bevel + base * glow * 1.4 + vec3(1.0, 0.5, 0.15) * glow * 0.25;
  if (int(hit.b + 0.5) == 18) c = vec3(3.0, 1.6, 0.4); // the giant's eyes burn
  if (int(hit.b + 0.5) == 25) c += col * (0.12 + 0.9 * rest) * 0.9; // crystals glow
  float dist = length(wp - uCam);
  c = mix(c, vec3(0.20, 0.16, 0.22), smoothstep(80.0, 240.0, dist));
  o = vec4(c, 1.0);
}`,Le=`#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform float uSeed;
out vec4 o;
float h(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719)) + uSeed) * 43758.5453); }
void main() {
  ivec2 fc = ivec2(gl_FragCoord.xy);
  ivec2 tile = ivec2(fc.x / 256, fc.y / 128);
  ivec2 l = fc - tile * ivec2(256, 128);
  vec3 v = vec3(l.x % 32, l.y % 32, (l.x / 32) + (l.y / 32) * 8);
  vec4 c = texelFetch(uSrc, fc, 0);
  if (c.r > 0.5) {
    // the structure gives way: a share of the base crumbles, everything above comes loose
    if (v.y < 5.0 && h(v) < 0.45) c = vec4(0.0);
    else if (v.y >= 1.0) c.g = -1.0;
  }
  o = c;
}`,Re=`#version 300 es
precision highp float;
uniform sampler2D uPos, uVel;
uniform float uS, uMode;
uniform vec4 uB[64];
uniform vec4 uS2[64];
out float vK;
${Ne}
void main() {
  int i = gl_VertexID;
  vK = 1.0;
  vec4 p = texelFetch(uPos, ivec2(i % int(uS), i / int(uS)), 0);
  gl_PointSize = 1.0;
  if (p.w < 1.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  int b = int(floor(p.w - 2.0 + 0.01));
  float fw = fract(p.w);
  bool ahead = fw > 0.375, below = fw > 0.125 && fw < 0.375; // .5 = the voxel ahead, .25 = the voxel underneath
  vK = uS2[b].z > 0.0 ? uS2[b].z : 1.0;
  vec4 B = uB[b];
  vec3 lp = (p.xyz - vec3(B.x, uS2[b].y, B.y)) / (${Oe.toFixed(3)} * uS2[b].x) + vec3(16.0, 0.0, 16.0);
  if (ahead) { vec3 vel = texelFetch(uVel, ivec2(i % int(uS), i / int(uS)), 0).xyz; lp += (length(vel) > 0.1 ? normalize(vel) : vec3(0.0, -1.0, 0.0)) * 1.2; }
  if (below) lp.y -= 1.2;
  ivec3 v = clamp(ivec3(floor(lp)), ivec3(0), ivec3(31));
  if (uMode < 0.5) gl_Position = vec4((vec2(atl(b, v)) + 0.5) / vec2(${ke}.0, ${Ae}.0) * 2.0 - 1.0, 0.0, 1.0);
  else gl_Position = vec4((float(b) + 0.5) / 64.0 * 2.0 - 1.0, 0.0, 0.0, 1.0);
}`,ze=`#version 300 es
precision highp float;
uniform float uAmount;
in float vK;
out vec4 o;
void main() { o = vec4(uAmount * vK, 0.0, 0.0, 0.0); }`,Be=`#version 300 es
precision highp float;
uniform sampler2D uPos;
uniform float uS, uWorld;
out float vW;
void main() {
  int i = gl_VertexID;
  vec4 p = texelFetch(uPos, ivec2(i % int(uS), i / int(uS)), 0);
  if (p.w < 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
  vW = p.w > 1.5 ? 1.0 : 0.35;
  gl_Position = vec4(p.xz / uWorld * 2.0, 0.0, 1.0);
  gl_PointSize = 8.0; // each mite paints a broad soft spot, so the swarm leaves a wide colourful path
}`,Ve=`#version 300 es
precision highp float;
uniform float uDt;
in float vW;
out vec4 o;
void main() { vec2 q = gl_PointCoord * 2.0 - 1.0; o = vec4(vW * uDt * 1.6 * max(0.0, 1.0 - dot(q, q))); }`,He=class a{constructor(i){f(this,`gl`,void 0),f(this,`atlas`,void 0),f(this,`atlasB`,void 0),f(this,`counter`,void 0),f(this,`color`,void 0),f(this,`grid`,void 0),f(this,`gridData`,new Uint8Array(25600)),f(this,`march`,void 0),f(this,`sim`,void 0),f(this,`eat`,void 0),f(this,`paint`,void 0),f(this,`fillP`,void 0),f(this,`failP`,void 0),f(this,`pass`,0),f(this,`vao`,void 0),f(this,`buildings`,[]),f(this,`bArr`,new Float32Array(256)),f(this,`b2Arr`,new Float32Array(256)),f(this,`s2Arr`,new Float32Array(256)),f(this,`gone`,new Uint8Array(64)),f(this,`active`,new Float32Array(64)),f(this,`pbo`,void 0),f(this,`fence`,null),f(this,`readBuf`,new Float32Array(256)),f(this,`readAt`,0),f(this,`lastCount`,new Float32Array(64)),f(this,`shadows`,!0),f(this,`onEat`,()=>{}),f(this,`boost`,1),f(this,`bloom`,0),f(this,`focus`,new Float32Array(3)),this.gl=i;let a={internal:i.RGBA16F,format:i.RGBA,type:i.HALF_FLOAT,filter:i.NEAREST};this.atlas=r(i,ke,Ae,[a]),this.atlasB=r(i,ke,Ae,[a]),this.counter=r(i,64,1,[{internal:i.RGBA32F,format:i.RGBA,type:i.FLOAT,filter:i.NEAREST}]),this.color=r(i,512,512,[{internal:i.R16F,format:i.RED,type:i.HALF_FLOAT,filter:i.LINEAR}]),this.grid=n(i,80,80,i.RGBA8,i.RGBA,i.UNSIGNED_BYTE,i.NEAREST),this.march=t(i,Fe,Ie,`march`),this.sim=t(i,e,Pe,`sim`),this.failP=t(i,e,Le,`fail`),this.eat=t(i,Re,ze,`eat`),this.paint=t(i,Be,Ve,`paint`),this.fillP=t(i,e,`#version 300 es
precision highp float;
uniform float uAmount;
out vec4 o;
void main() { o = vec4(uAmount); }`,`fill`),this.vao=i.createVertexArray(),this.pbo=i.createBuffer(),i.bindBuffer(i.PIXEL_PACK_BUFFER,this.pbo),i.bufferData(i.PIXEL_PACK_BUFFER,1024,i.STREAM_READ),i.bindBuffer(i.PIXEL_PACK_BUFFER,null)}build(e){let t=this.gl,n=new Float32Array(ke*Ae*4);this.gridData.fill(0),this.buildings=[],e.slice(0,64).forEach((e,t)=>{let r=new Uint8Array(32768),i=Ge(e.seed);We(e.kind,r,i);let a=0,o=0;for(let e=0;e<32;e++)for(let s=0;s<32;s++)for(let c=0;c<32;c++){let l=r[(e*32+s)*32+c];if(!l)continue;let u=t%8*256+e%8*32+c,d=((Math.floor(t/8)*128+Math.floor(e/8)*32+s)*ke+u)*4;n[d]=1,n[d+1]=1,n[d+2]=l,n[d+3]=i(),a++,o=Math.max(o,s)}this.buildings.push({x:e.x,z:e.z,kind:e.kind,seed:e.seed,solid:a,eaten:0,collapseAt:-1,h:o+1});let s=[.45,.7,.4,.45,.5,.06,1,.6,.65,.4,.5];this.s2Arr[t*4]=e.scale??1,this.s2Arr[t*4+1]=e.y??0,this.s2Arr[t*4+2]=s[e.kind];let c=32*Oe*(e.scale??1)/2+1;for(let n=0;n<80;n++)for(let r=0;r<80;r++){let i=(r+.5)/80*160-80,a=(n+.5)/80*160-80;Math.abs(i-e.x)<=c&&Math.abs(a-e.z)<=c&&(this.gridData[(n*80+r)*4]=t+1)}});for(let e of[this.atlas,this.atlasB])t.bindTexture(t.TEXTURE_2D,e.tex[0]),t.texSubImage2D(t.TEXTURE_2D,0,0,0,ke,Ae,t.RGBA,t.FLOAT,n);t.bindTexture(t.TEXTURE_2D,this.grid),t.texSubImage2D(t.TEXTURE_2D,0,0,0,80,80,t.RGBA,t.UNSIGNED_BYTE,this.gridData),t.bindFramebuffer(t.FRAMEBUFFER,this.color.fb),t.clearColor(0,0,0,0),t.clear(t.COLOR_BUFFER_BIT),t.bindFramebuffer(t.FRAMEBUFFER,this.counter.fb),t.clear(t.COLOR_BUFFER_BIT),t.bindFramebuffer(t.FRAMEBUFFER,null),this.lastCount.fill(0),this.gone.fill(0),this.active.fill(0),this.syncUniforms(),this.settle(70)}settle(e){let t=this.gl;t.bindVertexArray(this.vao),t.disable(t.BLEND),t.disable(t.DEPTH_TEST),t.useProgram(this.sim.p),t.uniform1f(this.sim.u.uMark,0);for(let n=0;n<e;n++){let[e,r]=n%2?[this.atlasB,this.atlas]:[this.atlas,this.atlasB];t.bindFramebuffer(t.FRAMEBUFFER,r.fb),t.viewport(0,0,ke,Ae),i(t,0,e.tex[0],this.sim.u.uSrc);let o=a.DIRS[n&3];t.uniform3i(this.sim.u.uDir,o[0],o[1],o[2]),t.drawArrays(t.TRIANGLES,0,3)}t.bindFramebuffer(t.FRAMEBUFFER,null)}fail(e){let t=this.gl;t.bindVertexArray(this.vao),t.disable(t.BLEND),t.disable(t.DEPTH_TEST);let n=e%8*256,r=Math.floor(e/8)*128;t.useProgram(this.failP.p),t.bindFramebuffer(t.FRAMEBUFFER,this.atlasB.fb),t.viewport(n,r,256,128),i(t,0,this.atlas.tex[0],this.failP.u.uSrc),t.uniform1f(this.failP.u.uSeed,e*7.31),t.drawArrays(t.TRIANGLES,0,3),t.useProgram(this.sim.p),t.uniform1f(this.sim.u.uMark,1),t.bindFramebuffer(t.FRAMEBUFFER,this.atlas.fb),t.viewport(n,r,256,128),i(t,0,this.atlasB.tex[0],this.sim.u.uSrc),t.uniform3i(this.sim.u.uDir,1,0,0),t.drawArrays(t.TRIANGLES,0,3),t.bindFramebuffer(t.FRAMEBUFFER,null),this.wake(e,12)}syncUniforms(){this.bArr.fill(0),this.b2Arr.fill(0);for(let e=0;e<64;e++){let t=this.buildings[e];!t||this.gone[e]?(this.bArr[e*4+3]=-1,this.b2Arr[e*4]=-1):(this.bArr[e*4]=t.x,this.bArr[e*4+1]=t.z,this.bArr[e*4+2]=t.kind,this.bArr[e*4+3]=t.seed%97,this.b2Arr[e*4]=-1,this.b2Arr[e*4+1]=t.h,this.s2Arr[e*4]===0&&(this.s2Arr[e*4]=1))}}feed(e,t,n,r,o){let s=this.gl;s.bindVertexArray(this.vao),s.disable(s.DEPTH_TEST),s.enable(s.BLEND),s.useProgram(this.eat.p);let c=this.eat.u;i(s,0,e,c.uPos),i(s,1,t,c.uVel),s.uniform1f(c.uS,512),s.uniform4fv(c.uB,this.bArr),s.uniform4fv(c.uS2,this.s2Arr),s.bindFramebuffer(s.FRAMEBUFFER,this.atlas.fb),s.viewport(0,0,ke,Ae),s.blendEquation(s.FUNC_REVERSE_SUBTRACT),s.blendFunc(s.ONE,s.ONE),s.uniform1f(c.uMode,0),s.uniform1f(c.uAmount,r*2.4*this.boost),s.drawArrays(s.POINTS,0,n),s.bindFramebuffer(s.FRAMEBUFFER,this.counter.fb),s.viewport(0,0,64,1),s.blendEquation(s.FUNC_ADD),s.uniform1f(c.uMode,1),s.uniform1f(c.uAmount,r*2.4*this.boost),s.drawArrays(s.POINTS,0,n),s.bindFramebuffer(s.FRAMEBUFFER,this.color.fb),s.viewport(0,0,512,512),s.useProgram(this.paint.p),i(s,0,e,this.paint.u.uPos),s.uniform1f(this.paint.u.uS,512),s.uniform1f(this.paint.u.uWorld,160),s.uniform1f(this.paint.u.uDt,r),s.drawArrays(s.POINTS,0,n),s.disable(s.BLEND),s.useProgram(this.sim.p),s.uniform1f(this.sim.u.uMark,1);for(let e=0;e<this.buildings.length;e++){if(this.gone[e]||this.active[e]<=0)continue;this.active[e]-=r;let t=e%8*256,n=Math.floor(e/8)*128;for(let[e,r]of[[this.atlas,this.atlasB],[this.atlasB,this.atlas]]){s.bindFramebuffer(s.FRAMEBUFFER,r.fb),s.viewport(t,n,256,128),i(s,0,e.tex[0],this.sim.u.uSrc);let o=a.DIRS[this.pass++&3];s.uniform3i(this.sim.u.uDir,o[0],o[1],o[2]),s.drawArrays(s.TRIANGLES,0,3)}}s.bindFramebuffer(s.FRAMEBUFFER,null),this.readback(o)}wake(e,t=6){this.active[e]=Math.max(this.active[e],t)}readback(e){let t=this.gl;if(this.fence){if(t.clientWaitSync(this.fence,0,0)===t.TIMEOUT_EXPIRED)return;t.deleteSync(this.fence),this.fence=null,t.bindBuffer(t.PIXEL_PACK_BUFFER,this.pbo),t.getBufferSubData(t.PIXEL_PACK_BUFFER,0,this.readBuf),t.bindBuffer(t.PIXEL_PACK_BUFFER,null);for(let e=0;e<this.buildings.length;e++){let t=this.readBuf[e*4],n=t-this.lastCount[e];this.lastCount[e]=t,n>0&&(this.buildings[e].eaten+=n,this.wake(e),this.onEat(e,n))}}e-this.readAt<.15||(this.readAt=e,t.bindFramebuffer(t.FRAMEBUFFER,this.counter.fb),t.bindBuffer(t.PIXEL_PACK_BUFFER,this.pbo),t.readPixels(0,0,64,1,t.RGBA,t.FLOAT,0),t.bindBuffer(t.PIXEL_PACK_BUFFER,null),t.bindFramebuffer(t.FRAMEBUFFER,null),this.fence=t.fenceSync(t.SYNC_GPU_COMMANDS_COMPLETE,0))}flood(e){let t=this.gl;t.bindVertexArray(this.vao),t.bindFramebuffer(t.FRAMEBUFFER,this.color.fb),t.viewport(0,0,512,512),t.disable(t.DEPTH_TEST),t.enable(t.BLEND),t.blendFunc(t.ONE,t.ONE),t.useProgram(this.fillP.p),t.uniform1f(this.fillP.u.uAmount,e),t.drawArrays(t.TRIANGLES,0,3),t.disable(t.BLEND),t.bindFramebuffer(t.FRAMEBUFFER,null)}remove(e){this.gone[e]=1,this.syncUniforms()}add(e,t,n,r=1){let i=this.gl,a=this.buildings.length;if(a>=64)return-1;let o=new Uint8Array(32768),s=Ge(e.seed);We(e.kind,o,s);let c=new Float32Array(131072),l=0;for(let e=0;e<32;e++)for(let t=0;t<32;t++)for(let n=0;n<32;n++){let r=o[(e*32+t)*32+n];if(!r)continue;let i=((Math.floor(e/8)*32+t)*256+e%8*32+n)*4;c[i]=1,c[i+1]=1,c[i+2]=r,c[i+3]=s(),l++}for(let e of[this.atlas,this.atlasB])i.bindTexture(i.TEXTURE_2D,e.tex[0]),i.texSubImage2D(i.TEXTURE_2D,0,a%8*256,Math.floor(a/8)*128,256,128,i.RGBA,i.FLOAT,c);return this.buildings.push({x:e.x,z:e.z,kind:e.kind,seed:e.seed,solid:l,eaten:0,collapseAt:-1,h:32}),this.s2Arr[a*4]=t,this.s2Arr[a*4+1]=n,this.s2Arr[a*4+2]=r,this.syncUniforms(),this.place(a,e.x,e.z,n),a}place(e,t,n,r){let i=this.buildings[e],a=this.s2Arr[e*4]||1,o=32*Oe*a/2+1;for(let t=0;t<this.gridData.length;t++)this.gridData[t]===e+1&&(this.gridData[t]=0);let s=t=>{for(let n=0;n<4;n++)if(this.gridData[t*4+n]===0){this.gridData[t*4+n]=e+1;return}};i.x=t,i.z=n;for(let e=0;e<80;e++)for(let r=0;r<80;r++){let i=(r+.5)/80*160-80,a=(e+.5)/80*160-80;Math.abs(i-t)<=o&&Math.abs(a-n)<=o&&s(e*80+r)}let c=this.gl;c.bindTexture(c.TEXTURE_2D,this.grid),c.texSubImage2D(c.TEXTURE_2D,0,0,0,80,80,c.RGBA,c.UNSIGNED_BYTE,this.gridData),this.bArr[e*4]=t,this.bArr[e*4+1]=n,this.s2Arr[e*4+1]=r}draw(e,t,n){let r=this.gl,a=this.march.u;r.bindVertexArray(this.vao),r.enable(r.DEPTH_TEST),r.depthMask(!0),r.enable(r.CULL_FACE),r.cullFace(r.FRONT),r.useProgram(this.march.p),i(r,0,this.atlas.tex[0],a.uAtlas),i(r,1,this.color.tex[0],a.uColor),i(r,2,n,a.uLight),r.uniformMatrix4fv(a.uVP,!1,e),r.uniform4fv(a.uB,this.bArr),r.uniform4fv(a.uS2,this.s2Arr),r.uniform3fv(a.uCam,t),r.uniform3fv(a.uFocus,this.focus),r.uniform3f(a.uSun,-.45,.78,.43),r.uniform1f(a.uWorld,160),r.uniform1f(a.uShadow,+!!this.shadows),r.drawArraysInstanced(r.TRIANGLES,0,36,this.buildings.length),r.disable(r.CULL_FACE)}};f(He,`DIRS`,[[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]]);var Ue={snow:!1,giant:0,part:0};function We(e,t,n){let r=Ue.snow?23:3,i=(e,n,r,i)=>{e>=0&&n>=0&&r>=0&&e<32&&n<32&&r<32&&(t[(r*32+n)*32+e]=i)},a=(e,n,r)=>e>=0&&n>=0&&r>=0&&e<32&&n<32&&r<32?t[(r*32+n)*32+e]:0;if(e===0){for(let e=0;e<=15;e++)for(let t=7;t<=24;t++)for(let n=5;n<=26;n++){let r=n===5||n===26,a=t===7||t===24;if(!(r||a)&&e>0)continue;let o=1;e<=1?o=6:r&&a||e===8||e===15||a&&(n-5)%7==0||r&&(t-7)%6==0?o=2:(e>=4&&e<=6&&(a&&[3,4,10,11,17,18].includes(n-5)||r&&[4,5,11,12].includes(t-7))||e>=10&&e<=12&&(a&&[4,5,15,16].includes(n-5)||r&&[7,8].includes(t-7)))&&(o=4),t===7&&n>=14&&n<=16&&e>=2&&e<=7&&(o=5),i(n,e,t,o)}for(let e=16;e<=25;e++){let t=10-(e-15-1)*1.05;if(t<0)break;for(let n=4;n<=27;n++)for(let a=0;a<32;a++){let o=Math.abs(a-15.5);o<=t&&o>t-2.2?i(n,e,a,r):o<=t-2.2&&(n===5||n===26)&&i(n,e,a,1)}}for(let e=12;e<=27;e++)for(let t=18;t<=19;t++)for(let n=21;n<=22;n++)i(n,e,t,12)}else if(e===1){let e=15.5,t=15.5,r=14+Math.floor(n()*4);for(let n=0;n<=r;n++){let r=1.9-n*.05+(n<2?.8:0);for(let a=0;a<32;a++)for(let o=0;o<32;o++)(o-e)**2+(a-t)**2<=r*r&&i(o,n,a,7)}let o=[];for(let a=0;a<4;a++){let a=n()*Math.PI*2,s=5+n()*4,c=r-5+n()*3;for(let n=0;n<=s;n+=.4){let r=Math.round(e+Math.cos(a)*n),o=Math.round(c+n*.6),s=Math.round(t+Math.sin(a)*n);for(let e=0;e<=1;e++)for(let t=-1;t<=0;t++)for(let n=-1;n<=0;n++)i(r+n,o+e,s+t,7)}o.push([e+Math.cos(a)*s,c+s*.6+1,t+Math.sin(a)*s,4+n()*2.5])}o.push([e,r+4,t,6+n()*1.5]);for(let[e,t,r,s]of o)for(let o=0;o<32;o++)for(let c=0;c<32;c++)for(let l=0;l<32;l++)Math.sqrt((l-e)**2+(o-t)**2*1.2+(c-r)**2)<=s+(n()-.5)*1.2&&!a(l,o,c)&&i(l,o,c,n()<.04?10:n()<.45?9:8)}else if(e===2){let e=15.5;for(let t=0;t<32;t++)for(let n=0;n<32;n++)for(let r=0;r<32;r++){let a=Math.hypot(r-e,n-e);if(t<=21)a<=7&&a>5.6?i(r,t,n,t%6==3&&(Math.abs(r-e)<1||Math.abs(n-e)<1)?13:6):a<=5.6&&t%7==0&&i(r,t,n,2);else{let e=(31-t)*.85;a<=e&&a>e-1.8&&i(r,t,n,14)}}}else if(e===3){for(let e=0;e<=12;e++)for(let t=8;t<=23;t++)for(let n=3;n<=28;n++){let r=n===3||n===28,a=t===8||t===23;if(!(r||a)&&e>0)continue;let o=(n+t)%3==0?16:15;e===0&&(o=6),(r&&a||e===12)&&(o=16),a&&t===8&&n>=13&&n<=18&&e>=1&&e<=9&&(o=(n+e)%4==0?16:5),i(n,e,t,o)}for(let e=13;e<=21;e++){let t=e-12-1,n=t<4?8.5-t*.4:15/2-.6-(t-4)*1.6;if(n<0)break;for(let t=2;t<=29;t++)for(let a=0;a<32;a++){let o=Math.abs(a-15.5);o<=n&&o>n-1.8?i(t,e,a,r):o<=n-1.8&&(t===3||t===28)&&i(t,e,a,15)}}for(let e=1;e<=5;e++)for(let t=24;t<=30;t++)for(let r=20;r<=29;r++)n()<.85&&(r-24.5)**2+(e*1.6)**2+(t-27)**2<30&&i(r,e,t,11)}else if(e===5){let e=(e,t,n,r,i,a,o,s,c)=>((e-r)/o)**2+((t-i)/s)**2+((n-a)/c)**2<=1,t=(e,t,n,r,i,a,o,s,c,l)=>{let u=o-r,d=s-i,f=c-a,p=u*u+d*d+f*f,m=Math.max(0,Math.min(1,((e-r)*u+(t-i)*d+(n-a)*f)/p));return(e-r-u*m)**2+(t-i-d*m)**2+(n-a-f*m)**2<=l*l},r=Ue.giant%5,a=Ue.part,o=(e,t,n)=>Math.sin(e*1.7+t*.9)*Math.sin(n*1.3-t*1.1)+Math.sin(e*.5+n*.7+t*.3)*.5,s=(e,t,i)=>r===0?o(e,t,i)>.55?6:n()<.1?19:17:r===1?22:r===2?t%6==0?16:27:r===3?n()<.15?16:23:o(e,t,i)>.95?18:26,c=e=>{for(let t=0;t<32;t++)for(let n=0;n<32;n++)for(let r=0;r<32;r++){let a=e(r,t,n);a&&i(r,t,n,a)}},l=r===3?1.2:r===0?.6:0,u=()=>(n()-.5)*l;if(a===4||a===5){let n=r===1?.8:1;c((i,a,o)=>e(i,a,o,15.5,2.6,18.5,7.5,2.8+(r===2?.3:0),10)?r===2||r===4?26:s(i,a,o):r!==1&&a<=3&&o>=26&&(i===11||i===15||i===19)&&e(i,a,o,15.5,2.6,18.5,8,3,11)?r===3||r===4?16:6:t(i,a,o,15.5,31,15.5,15.5,14,15.5,(7.2+u())*n)?s(i,a,o):e(i,a,o,15.5,13,16.5,6.2,3.8,6.2)?r===2?16:r===4?25:s(i,a,o):t(i,a,o,15.5,13,15.5,15.5,3,16.5,(5.8+u())*n)?s(i,a,o):0)}else c(a===1?(i,a,o)=>{if(!e(i,a,o,15.5,15,15.5,14+u(),15.5,10+u()))return r===4&&t(i,a,o,15.5,6,6,15.5,30,2,2.2)&&!(a>>2&1)?25:0;let c=o>=22;if(r===2&&c){let e=i-15.5,t=a-18,n=e*e+t*t;if(n<=30)return Math.abs(e)<.7&&t>0&&t<5||Math.abs(t)<.7&&e>0&&e<4?26:n>24?13:16;if(a>=6&&a<=8)return 12;if((i+a)%7==0)return 13}return r===1&&a>=27?n()<.3?21:22:r===1&&c&&a>=10&&a<=12&&Math.abs(i-15.5)<5?15:r===3&&c&&e(i,a,o,15.5,14,24,8,9,3)?16:r===0&&a>=26&&n()<.5?n()<.2?10:19:s(i,a,o)}:a===2||a===3?(i,a,o)=>e(i,a,o,15.5,27,15.5,8.5,5,8.5)?r===2?14:r===4&&n()<.35?25:r===0&&n()<.4?19:s(i,a,o):r===4&&t(i,a,o,15.5,29,15.5,15.5,31,13,1.6)?25:t(i,a,o,15.5,26,15.5,15.5,15,15.5,4.6+u())?s(i,a,o):t(i,a,o,15.5,15,15.5,15.5,7,17.5,5+u())?r===2?27:s(i,a,o):e(i,a,o,15.5,4.5,18,6.2,4.5,6.2)?o>=23&&a>=6&&i%3==0?r===3||r===4?16:6:r===2?26:s(i,a,o):0:(i,a,o)=>{let c=i-15.5;return r===0?e(i,a,o,15.5,13,15.5,11+u(),11,10+u())?o>=23&&a>=13&&a<=15&&Math.abs(Math.abs(c)-4.5)<=1.6?18:o>=24&&a>=16&&a<=17&&Math.abs(c)<=8?6:o>=23&&a===8&&Math.abs(c)<=4+i%2?26:a>=20&&n()<.65?n()<.15?n()<.5?10:13:19:s(i,a,o):0:r===1?a>=13&&e(i,a,o,15.5,16,15.5,15.5,15,15.5)?a<=14||Math.sin(i*.9)*Math.sin(o*.9+1)*Math.sin(a*.8)>.55?21:20:e(i,a,o,15.5,7.5,16,9,7.5,8.5)?o>=22&&e(i,a,o,15.5+(c<0?-3.5:3.5),9,24,2.2,2.6,2)?Math.abs(i-(c<0?12:19))<=.6&&a>=8&&a<=9?26:16:o>=23&&a===4&&Math.abs(c)<=3||o>=23&&a===5&&Math.abs(c)>=3&&Math.abs(c)<=4?26:o>=22&&a===6&&Math.abs(Math.abs(c)-6)<=1?10:22:0:r===2?Math.abs(c)<=9.5&&a<=22&&o>=6&&o<=25&&(Math.abs(c)<=8.5||a<=20)&&c*c+(a-14)*(a-14)*.4<120?o>=24&&a>=12&&a<=13&&Math.abs(c)<=7?18:o>=24&&Math.abs(c)<=.6&&a<12&&a>3||(a===3||a===21)&&i%3==0?13:27:Math.abs(c)<=1.2&&o>=4&&o<=26&&a>=22&&a<=22+6*Math.sin((o-4)/22*Math.PI)?15:0:r===3?t(i,a,o,7,18,15,2,25,13,2.2)||t(i,a,o,2,25,13,4,30,17,1.6)||t(i,a,o,24,18,15,29,25,13,2.2)||t(i,a,o,29,25,13,27,30,17,1.6)?6:e(i,a,o,15.5,13,15.5,11+u(),12+u(),10+u())?o>=21&&e(i,a,o,15.5,11,25,7,7,3)?a>=13&&a<=14&&Math.abs(Math.abs(c)-3.5)<=1?18:a>=6&&a<=7&&Math.abs(c)<=4?a===6&&Math.abs(c)>=2.5?16:26:17:23:0:[[-7,3],[-3.5,6],[0,8],[3.5,6],[7,3]].some(([e,n])=>t(i,a,o,15.5+e,18,15.5,15.5+e*1.25,19+n+4,14,1.5))?25:Math.abs(c)+Math.abs(a-11)*.6<=10&&Math.abs(o-15.5)<=9&&a<=19?o>=24&&a>=11&&a<=12+ +(Math.abs(c)>4)&&Math.abs(c)>=2&&Math.abs(c)<=6?18:s(i,a,o):0})}else if(e===7){let e=15.5,t=18+Math.floor(n()*4);for(let n=0;n<t;n++)for(let t=0;t<32;t++)for(let r=0;r<32;r++)(r-e)**2+(t-e)**2<=(3.2-n*.04)**2&&i(r,n,t,22);for(let r=t;r<32;r++)for(let a=0;a<32;a++)for(let o=0;o<32;o++)Math.hypot(o-e,a-e)<=13.5*Math.sqrt(Math.max(0,1-((r-t)/(32-t))**2))&&i(o,r,a,r<t+2?22:n()<.1?21:20)}else if(e===8){let e=15.5;for(let t=0;t<8;t++)for(let n=0;n<32;n++)for(let r=0;r<32;r++)(r-e)**2+(n-e)**2<=2.2&&i(r,t,n,7);for(let t=6;t<32;t++){let r=(t-6)%7,a=Math.max(.6,(10-(t-6)*.32)*(1-r/9));for(let o=0;o<32;o++)for(let s=0;s<32;s++){let c=Math.hypot(s-e,o-e);c<=a+(n()-.5)*.8&&i(s,t,o,Ue.snow&&r<=1&&c>a-2?23:24)}}}else if(e===9){for(let e=0;e<=22;e++)for(let t=8;t<=23;t++)for(let n=8;n<=23;n++){let r=n===8||n===23,a=t===8||t===23;if(!(r||a)&&e%7!=0)continue;let o=e<6?6:1;(r&&a||e%7==0)&&(o=e<6?6:2),e%7>=2&&e%7<=4&&(a&&(n-8)%4==2||r&&(t-8)%4==2)&&(o=4),t===8&&n>=14&&n<=16&&e>=1&&e<=4&&(o=5),i(n,e,t,o)}for(let e=23;e<32;e++){let t=8.5-(e-22-1)*1.1;if(t<0)break;for(let n=0;n<32;n++)for(let r=7;r<=24;r++){let a=Math.abs(n-15.5);a<=t&&a>t-2?i(r,e,n,Ue.snow?23:27):a<=t-2&&(r===8||r===23)&&i(r,e,n,1)}}}else if(e===10){let e=15.5;for(let t=0;t<5;t++)for(let r=0;r<32;r++)for(let a=0;a<32;a++)(a-e)**2+(r-e)**2<60-t*8+(n()-.5)*6&&i(a,t,r,26);for(let t=0;t<4;t++){let t=n()*6.28,r=.15+n()*.25,a=e+Math.cos(t)*2,o=e+Math.sin(t)*2,s=18+n()*13;for(let e=2;e<s;e++){let n=2.6*(1-(e-2)/s)+.4,c=a+Math.cos(t)*e*r,l=o+Math.sin(t)*e*r;for(let t=0;t<32;t++)for(let r=0;r<32;r++)Math.abs(r-c)+Math.abs(t-l)<=n&&i(r,Math.round(e),t,25)}}}else if(e===6){let e=15.5;for(let t=0;t<22;t++)for(let r=0;r<32;r++)for(let a=0;a<32;a++)Math.sqrt((a-e)**2+((t-6)*1.25)**2+(r-e)**2)<12+(n()-.5)*2.5&&t<18&&i(a,t,r,n()<.16?10:n()<.08?13:n()<.5?9:8);for(let e=0;e<4;e++)for(let t=14;t<=17;t++)for(let n=14;n<=17;n++)i(n,e,t,7)}else for(let e=0;e<3;e++){let e=8+n()*16,t=8+n()*16,r=4+n()*4;for(let a=0;a<32;a++)for(let o=0;o<32;o++)for(let s=0;s<32;s++)Math.sqrt((s-e)**2+(a*1.3)**2+(o-t)**2)<r+(n()-.5)&&i(s,a,o,17)}}function Ge(e){return()=>{e|=0,e=e+1831565813|0;let t=Math.imul(e^e>>>15,1|e);return t=t+Math.imul(t^t>>>7,61|t)^t,((t^t>>>14)>>>0)/4294967296}}var Ke=()=>window.PokiSDK,qe=!1,Je={init:()=>new Promise(e=>{let t=()=>{try{(Ke()?.init()??Promise.resolve()).catch(()=>void 0).then(()=>e())}catch{e()}};if(Ke())return t();let n=document.createElement(`script`);n.src=`https://game-cdn.poki.com/scripts/v2/poki-sdk.js`,n.onload=t,n.onerror=()=>e(),setTimeout(e,3e3),document.head.appendChild(n)}),loadingFinished:()=>{try{Ke()?.gameLoadingFinished()}catch{}},gameplayStart:()=>{if(!qe){qe=!0;try{Ke()?.gameplayStart()}catch{}}},gameplayStop:()=>{if(qe){qe=!1;try{Ke()?.gameplayStop()}catch{}}},commercialBreak:()=>{Je.gameplayStop();try{let e=Ke();return e?e.commercialBreak().catch(()=>void 0):Promise.resolve()}catch{return Promise.resolve()}},rewardedBreak:()=>{Je.gameplayStop();try{let e=Ke();return e?e.rewardedBreak().catch(()=>!1):Promise.resolve(!0)}catch{return Promise.resolve(!1)}}},Ye=.24,Xe=`#version 300 es
precision highp float;
uniform sampler2D uColor, uDen, uHeight;
uniform mat4 uVP;
uniform vec2 uOrigin, uCamXZ, uShape;
uniform float uTime, uWorld;
out vec3 vCol;
out float vTip;
out vec3 vW;
float h11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
${w}
void main() {
  int i = gl_InstanceID;
  vec2 cell = vec2(float(i % 260), float(i / 260));
  vec2 world = uOrigin + cell * ${Ye.toFixed(3)};
  // a stable jitter per world cell (the patch scrolls with the camera, the blades stay put)
  vec2 key = floor(world / ${Ye.toFixed(3)} + 0.5);
  float r1 = h11(key.x * 12.9898 + key.y * 78.233), r2 = h11(key.x * 39.346 + key.y * 11.135), r3 = h11(key.x * 73.156 + key.y * 52.235);
  world += (vec2(r1, r2) - 0.5) * ${Ye.toFixed(3)} * 1.4;
  vec2 uv = world / uWorld + 0.5;
  float rest = clamp(texture(uColor, uv).r * 1.6 - (r3 * 0.5), 0.0, 1.0);
  float gy = groundH(world);
  // far blades shrink away (and the square patch fades at its rim), so no dark speckle shows from afar
  vec2 rim = abs(cell / float(260) - 0.5) * 2.0;
  float far = (1.0 - smoothstep(0.6, 0.95, max(rim.x, rim.y))) * (1.0 - smoothstep(20.0, 31.0, length(world - uCamXZ)));
  float h = rest < 0.04 || gy < WATER + 0.05 || length(world) > 63.5 * (1.0 - uShape.y * (1.0 - cos(uShape.x * (atan(world.y, world.x) + 1.5708))) * 0.5) ? 0.0 : mix(0.05, 0.42 + 0.55 * r2, rest) * far;
  // the blade: 5 vertices (a tapering strip), bent by wind and pushed by the swarm
  int k = gl_VertexID;
  float t = float(k / 2) / 2.0;
  float side = (k % 2 == 0 ? -1.0 : 1.0) * (1.0 - t) * 0.035 * (0.7 + r1);
  if (k == 4) side = 0.0;
  float ang = r3 * 6.2831;
  vec2 dir = vec2(cos(ang), sin(ang));
  vec2 e = vec2(1.0 / 256.0) * uWorld;
  float d0 = texture(uDen, uv).r;
  vec2 g = vec2(texture(uDen, uv + vec2(e.x, 0) / uWorld).r - texture(uDen, uv - vec2(e.x, 0) / uWorld).r,
                texture(uDen, uv + vec2(0, e.y) / uWorld).r - texture(uDen, uv - vec2(0, e.y) / uWorld).r);
  vec2 push = -g * 0.02 + vec2(sin(uTime * 1.7 + world.x * 0.4 + world.y * 0.2), cos(uTime * 1.3 + world.y * 0.5)) * 0.12 * rest;
  push *= 1.0 + min(d0 * 0.02, 2.0);
  vec3 p = vec3(world.x, 0.0, world.y) + vec3(-dir.y, 0.0, dir.x) * side;
  p.y = gy + t * h;
  p.xz += push * t * t * h * 2.5;
  vW = p;
  vTip = t;
  // stubble is grey stone; living grass goes from deep green at the root to sunlit yellow-green, some flowers
  vec3 g0 = mix(vec3(0.16, 0.38, 0.10), vec3(0.20, 0.45, 0.12), r1), g1 = mix(vec3(0.55, 0.80, 0.25), vec3(0.75, 0.85, 0.35), r2);
  vec3 c = mix(g0, g1, t);
  if (r3 > 0.985 && t > 0.9) c = mix(vec3(1.0, 0.85, 0.30), vec3(1.0, 0.45, 0.75), r1);
  vCol = mix(vec3(0.30, 0.29, 0.33) * (0.7 + 0.5 * t), c, smoothstep(0.1, 0.6, rest));
  if (h < 0.02) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  gl_Position = uVP * vec4(p, 1.0);
}`,Ze=`#version 300 es
precision highp float;
uniform sampler2D uLight;
uniform float uWorld;
uniform vec3 uCam;
in vec3 vCol;
in float vTip;
in vec3 vW;
out vec4 o;
void main() {
  float sw = texture(uLight, vW.xz / uWorld + 0.5).r;
  float glow = 1.0 - exp(-sw * 0.012);
  vec3 c = vCol * (0.55 + 0.6 * vTip + glow * 1.4) + vec3(1.0, 0.5, 0.15) * glow * 0.3 * vTip;
  o = vec4(c, 1.0);
}`,Qe=class{constructor(e){f(this,`gl`,void 0),f(this,`prog`,void 0),f(this,`vao`,void 0),this.gl=e,this.prog=t(e,Xe,Ze,`grass`),this.vao=e.createVertexArray()}draw(e,t,n,r,a,o,s,c,l,u){let d=this.gl,f=this.prog.u;d.bindVertexArray(this.vao),d.enable(d.DEPTH_TEST),d.depthMask(!0),d.disable(d.CULL_FACE),d.useProgram(this.prog.p),i(d,0,o,f.uColor),i(d,1,s,f.uDen),i(d,2,c,f.uLight),i(d,3,u,f.uHeight),d.uniformMatrix4fv(f.uVP,!1,e);let p=260*Ye/2;d.uniform2f(f.uOrigin,Math.floor((n-p)/Ye)*Ye,Math.floor((r-p)/Ye)*Ye),d.uniform2f(f.uCamXZ,n,r),d.uniform2f(f.uShape,x.k,x.a),d.uniform1f(f.uTime,a),d.uniform1f(f.uWorld,160),d.uniform3fv(f.uCam,t),d.drawArraysInstanced(d.TRIANGLE_STRIP,0,5,Math.floor(67600*l))}},$e=class{constructor(){f(this,`ctx`,null),f(this,`master`,void 0),f(this,`hum`,void 0),f(this,`bandA`,void 0),f(this,`bandB`,void 0),f(this,`noise`,void 0),f(this,`muted`,!1),f(this,`crunchDebt`,0),f(this,`out`,void 0)}start(){if(this.ctx){this.ctx.state===`suspended`&&this.ctx.resume();return}let e=window.AudioContext||window.webkitAudioContext;if(!e)return;let t=this.ctx=new e;this.master=t.createGain(),this.master.gain.value=this.muted?0:.45,this.master.connect(t.destination);let n=t.createDynamicsCompressor();n.threshold.value=-18,n.ratio.value=4,n.connect(this.master),this.noise=t.createBuffer(1,t.sampleRate,t.sampleRate);let r=this.noise.getChannelData(0);for(let e=0;e<r.length;e++)r[e]=Math.random()*2-1;let i=t.createBufferSource();i.buffer=this.noise,i.loop=!0,this.bandA=t.createBiquadFilter(),this.bandA.type=`bandpass`,this.bandA.frequency.value=320,this.bandA.Q.value=2.2,this.bandB=t.createBiquadFilter(),this.bandB.type=`bandpass`,this.bandB.frequency.value=1900,this.bandB.Q.value=5,this.hum=t.createGain(),this.hum.gain.value=0,i.connect(this.bandA),i.connect(this.bandB),this.bandA.connect(this.hum),this.bandB.connect(this.hum),this.hum.connect(n),i.start(),this.out=n}setMuted(e){this.muted=e,this.ctx&&this.master.gain.setTargetAtTime(e?0:.45,this.ctx.currentTime,.05)}swarm(e,t){let n=this.ctx;if(!n)return;let r=Math.min(1,Math.log10(Math.max(10,e))/5.3),i=n.currentTime;this.hum.gain.setTargetAtTime(.03+.16*r*(.7+Math.min(t,25)/60),i,.3),this.bandA.frequency.setTargetAtTime(180+260*r+t*6,i,.3),this.bandB.frequency.setTargetAtTime(1500+900*r+t*25,i,.3)}eat(e){let t=this.ctx;if(!t)return;this.crunchDebt+=Math.min(e,40)*.25;let n=Math.min(4,Math.floor(this.crunchDebt));this.crunchDebt-=n;for(let e=0;e<n;e++)this.click(t.currentTime+Math.random()*.2,.02+Math.random()*.03)}click(e,t){let n=this.ctx,r=n.createBufferSource();r.buffer=this.noise;let i=n.createBiquadFilter();i.type=`highpass`,i.frequency.value=2200+Math.random()*3e3;let a=n.createGain();a.gain.setValueAtTime(t,e),a.gain.exponentialRampToValueAtTime(5e-4,e+.035),r.connect(i),i.connect(a),a.connect(this.out),r.start(e,Math.random()*.9,.05)}thump(e){let t=this.ctx;if(!t)return;let n=t.currentTime,r=t.createOscillator();r.type=`sine`,r.frequency.setValueAtTime(90,n),r.frequency.exponentialRampToValueAtTime(32,n+.5);let i=t.createGain();i.gain.setValueAtTime(1e-4,n),i.gain.exponentialRampToValueAtTime(.55*e,n+.02),i.gain.exponentialRampToValueAtTime(5e-4,n+.9),r.connect(i),i.connect(this.out),r.start(n),r.stop(n+1);let a=t.createBufferSource();a.buffer=this.noise;let o=t.createBiquadFilter();o.type=`lowpass`,o.frequency.setValueAtTime(1400,n),o.frequency.exponentialRampToValueAtTime(200,n+1.2);let s=t.createGain();s.gain.setValueAtTime(.25*e,n),s.gain.exponentialRampToValueAtTime(5e-4,n+1.3),a.connect(o),o.connect(s),s.connect(this.out),a.start(n,0,1.3)}chime(e){let t=this.ctx;if(!t)return;let n=[0,2,4,7,9,12,14,16,19,21],r=t.currentTime;[0,4,7].forEach((i,a)=>{let o=t.createOscillator();o.type=`sine`,o.frequency.value=440*2**((n[e%n.length]+i-9)/12);let s=t.createGain();s.gain.setValueAtTime(1e-4,r+a*.06),s.gain.exponentialRampToValueAtTime(.05,r+a*.06+.01),s.gain.exponentialRampToValueAtTime(5e-4,r+a*.06+1.2),o.connect(s),s.connect(this.out),o.start(r+a*.06),o.stop(r+a*.06+1.3)})}},et=[[`S`,[-.24,.72,0],[.27,.27,.16]],[`S`,[.24,.72,0],[.27,.27,.16]],[`C`,[-.36,.6,0],[0,.1,0],.17],[`C`,[.36,.6,0],[0,.1,0],.17],[`C`,[-.15,.6,0],[.15,.6,0],.2]],tt=[0,1,2,3,4].map(e=>{let t=Math.PI/2+e*Math.PI*2/5;return[`C`,[0,.58,0],[Math.cos(t)*.52,.58+Math.sin(t)*.52,0],.075]});tt.push([`S`,[0,.58,0],[.17,.17,.08]]);var nt=[];for(let e of[-1,1])for(let t of[-1,1])nt.push([`C`,[e*.34,0,t*.34],[e*.1,.42,t*.1],.035]),nt.push([`C`,[e*.1,.42,t*.1],[e*.025,1,t*.025],.022]);nt.push([`B`,[0,.2,0],[.25,.018,.25]],[`B`,[0,.42,0],[.12,.016,.12]],[`C`,[0,1,0],[0,1.16,0],.012],[`C`,[-.22,.12,.28],[.22,.12,.28],.02]);var rt=[[`S`,[0,.5,0],[.32,.19,.17]],[`C`,[.22,.58,0],[.4,.76,0],.1],[`S`,[.5,.8,0],[.17,.1,.09]],[`S`,[.56,.73,0],[.12,.04,.07]],[`C`,[-.28,.5,0],[-.62,.42,0],.09],[`C`,[-.62,.42,0],[-.88,.3,0],.045],[`C`,[0,.42,.1],[.04,.03,.12],.07],[`C`,[-.08,.42,-.1],[-.1,.03,-.12],.07],[`C`,[.25,.48,.1],[.33,.4,.13],.025]],it=[[`C`,[0,.2,0],[0,.78,0],.15],[`S`,[0,.84,0],[.15,.22,.15]],[`B`,[.2,.18,0],[.07,.12,.015]],[`B`,[-.2,.18,0],[.07,.12,.015]],[`B`,[0,.18,.2],[.015,.12,.07]],[`S`,[0,.06,0],[.09,.12,.09]],[`S`,[0,.55,.13],[.06,.06,.03]]],at=[[`S`,[0,.42,0],[.5,.22,.24]],[`C`,[-.42,.44,0],[-.72,.56,0],.07],[`B`,[-.78,.6,0],[.05,.02,.2]],[`S`,[.15,.28,.2],[.14,.03,.08]],[`C`,[.22,.63,0],[.22,.92,0],.02],[`S`,[.22,1,0],[.13,.08,.13]]],ot=[[`S`,[0,.55,0],[.42,.42,.3]],[`S`,[-.14,.68,.28],[.07,.09,.05]],[`S`,[.14,.68,.28],[.07,.09,.05]],[`C`,[-.24,.46,.27],[-.1,.36,.31],.035],[`C`,[-.1,.36,.31],[.1,.36,.31],.035],[`C`,[.1,.36,.31],[.24,.46,.27],.035]],st=[[`S`,[0,.5,0],[.38,.31,.28]],[`C`,[-.28,.66,0],[-.32,.95,0],.07],[`C`,[-.14,.74,0],[-.32,.95,0],.05],[`C`,[.28,.66,0],[.32,.95,0],.07],[`C`,[.14,.74,0],[.32,.95,0],.05],[`S`,[-.13,.56,.25],[.06,.07,.04]],[`S`,[.13,.56,.25],[.06,.07,.04]],[`S`,[0,.46,.28],[.04,.03,.03]],[`C`,[-.1,.44,.28],[-.5,.49,.24],.012],[`C`,[-.1,.42,.28],[-.5,.37,.24],.012],[`C`,[.1,.44,.28],[.5,.49,.24],.012],[`C`,[.1,.42,.28],[.5,.37,.24],.012]],ct=[[`S`,[0,.3,0],[.4,.23,.27]],[`S`,[.26,.64,0],[.17,.17,.16]],[`S`,[.46,.6,0],[.13,.04,.08]],[`C`,[-.36,.36,0],[-.52,.5,0],.05],[`S`,[-.03,.36,.22],[.2,.1,.04]],[`S`,[.32,.68,.13],[.03,.03,.02]]],lt=[[`S`,[0,.68,0],[.2,.26,.22]],[`C`,[0,.72,.2],[0,.62,.27],.035],[`S`,[-.2,.68,0],[.04,.07,.05]],[`S`,[.2,.68,0],[.04,.07,.05]],[`S`,[0,.86,-.03],[.23,.12,.23]],[`S`,[-.08,.74,.19],[.03,.02,.02]],[`S`,[.08,.74,.19],[.03,.02,.02]],[`C`,[-.07,.55,.2],[.07,.55,.2],.018],[`C`,[0,.4,0],[0,.5,0],.09],[`S`,[0,.28,0],[.46,.14,.2]]],ut=[];for(let e=0;e<10;e++){let t=e/10*Math.PI*2,n=(e+1)/10*Math.PI*2;ut.push([`C`,[Math.cos(t)*.4,.2,Math.sin(t)*.4],[Math.cos(n)*.4,.2,Math.sin(n)*.4],.07]),e%2==0&&(ut.push([`C`,[Math.cos(t)*.4,.25,Math.sin(t)*.4],[Math.cos(t)*.43,.62,Math.sin(t)*.43],.045]),ut.push([`S`,[Math.cos(t)*.43,.66,Math.sin(t)*.43],[.06,.06,.06]]))}var dt=[[`C`,[0,.25,0],[0,.78,0],.04],[`S`,[0,.82,0],[.06,.06,.06]],[`S`,[-.28,.66,0],[.26,.2,.03]],[`S`,[.28,.66,0],[.26,.2,.03]],[`S`,[-.2,.36,0],[.18,.14,.03]],[`S`,[.2,.36,0],[.18,.14,.03]],[`C`,[0,.84,0],[-.12,1,0],.012],[`C`,[0,.84,0],[.12,1,0],.012]],ft=[[`S`,[0,.2,0],[.24,.22,.24]],[`S`,[0,.56,0],[.18,.17,.18]],[`S`,[0,.84,0],[.13,.13,.13]],[`C`,[0,.84,.12],[0,.82,.26],.025],[`C`,[-.16,.6,0],[-.42,.78,0],.02],[`C`,[.16,.6,0],[.42,.78,0],.02],[`B`,[0,1,0],[.11,.08,.11]],[`B`,[0,.93,0],[.17,.012,.17]]],pt=[[`S`,[0,.5,0],[.42,.24,.1]],[`C`,[-.38,.5,0],[-.62,.72,0],.05],[`C`,[-.38,.5,0],[-.62,.28,0],.05],[`C`,[-.62,.72,0],[-.62,.28,0],.04],[`C`,[-.05,.72,0],[.12,.86,0],.04],[`S`,[.26,.56,.08],[.05,.05,.03]],[`C`,[0,.32,.05],[.12,.22,.05],.03]],mt=[[`S`,[0,.72,0],[.3,.28,.22]],[`C`,[-.3,.7,0],[-.32,.22,0],.03],[`C`,[.3,.7,0],[.32,.22,0],.03],[`S`,[0,.45,0],[.31,.28,.2]],[`S`,[-.2,.2,0],[.1,.08,.15]],[`S`,[0,.18,0],[.1,.08,.15]],[`S`,[.2,.2,0],[.1,.08,.15]],[`S`,[-.1,.78,.2],[.05,.08,.03]],[`S`,[.1,.78,.2],[.05,.08,.03]],[`S`,[0,.6,.2],[.07,.07,.03]],[`C`,[-.28,.6,.05],[-.48,.75,.05],.05],[`C`,[.28,.6,.05],[.48,.75,.05],.05]],ht=[[`C`,[0,0,0],[0,.6,0],.03],[`S`,[-.12,.25,0],[.12,.04,.05]],[`S`,[0,.75,0],[.09,.09,.05]]];for(let e=0;e<7;e++){let t=e/7*Math.PI*2;ht.push([`S`,[Math.cos(t)*.19,.75+Math.sin(t)*.19,0],[.11,.11,.035]])}var gt=[et,rt,ot,st,nt,ct,it,lt,at,ut,tt,dt,ft,pt,mt,ht,[[`C`,[-.5,.5,0],[.5,.5,0],.08],[`S`,[.5,.5,0],[.1,.08,.08]],[`B`,[.05,.5,0],[.12,.015,.55]],[`B`,[-.45,.5,0],[.06,.012,.2]],[`B`,[-.45,.62,0],[.06,.12,.012]],[`C`,[.6,.38,0],[.6,.62,0],.012],[`S`,[.25,.56,.06],[.06,.04,.04]]],[[`C`,[0,0,0],[0,.45,0],.07],[`S`,[0,.62,0],[.32,.22,.3]],[`S`,[-.2,.52,.05],[.2,.15,.2]],[`S`,[.22,.54,-.04],[.2,.16,.2]],[`S`,[0,.82,0],[.2,.16,.2]]]];function _t(e){let t=e;for(;t===e;)t=Math.floor(Math.random()*gt.length);return t}function vt(e,t){let n=gt[e%gt.length],r=n.map(e=>{if(e[0]===`S`){let[t,n,r]=e[2];return 4*Math.PI*(((t*n)**1.6+(t*r)**1.6+(n*r)**1.6)/3)**(1/1.6)}if(e[0]===`C`)return 2*Math.PI*e[3]*Math.hypot(e[2][0]-e[1][0],e[2][1]-e[1][1],e[2][2]-e[1][2])+4*Math.PI*e[3]*e[3];let[t,n,r]=e[2];return 8*(t*n+n*r+t*r)}),i=r.reduce((e,t)=>e+t,0),a=0;t.n=n.length,n.forEach((e,n)=>{a+=r[n]/i,t.pw[n]=a;let o=n*4;e[0]===`S`?(t.pa.set([...e[1],0],o),t.pb.set([...e[2],0],o)):e[0]===`C`?(t.pa.set([...e[1],1],o),t.pb.set([...e[2],e[3]],o)):(t.pa.set([...e[1],2],o),t.pb.set([...e[2],0],o))})}var yt=document.getElementById(`gl`),bt=document.getElementById(`hud`),xt=bt.getContext(`2d`),St=new URLSearchParams(location.search),Ct=St.get(`hud`)===`1`||!1;bt.style.display=Ct?`block`:`none`;var wt=yt.getContext(`webgl2`,{antialias:!1,alpha:!1,depth:!0,powerPreference:`high-performance`,preserveDrawingBuffer:!1});if(!wt||!wt.getExtension(`EXT_color_buffer_float`))throw document.body.insertAdjacentHTML(`beforeend`,`<div style="color:#fff;font:20px sans-serif;position:fixed;inset:0;display:flex;align-items:center;justify-content:center">WebGL2 float targets are not available</div>`),Error(`no float targets`);wt.getExtension(`EXT_float_blend`);var D=new _e(wt),O=new ne(wt),k=new De(wt,O),Tt=new ee(wt),A=new m,Et=St.get(`tier`);Et!==null&&(A.tier=Number(Et));var j=new He(wt),Dt=new Qe(wt),M=new $e,Ot=[{icon:`🌼`,amp:3.4,liquid:0,snow:!1,gap:17,skip:.25,giant:2.4,starter:[6,.38,.15],mix:[[1,.42],[0,.33],[3,.15],[2,.1]],pal:{skyLow:[.2,.13,.22],skyTop:[.03,.04,.1],horizon:[.55,.28,.2],stoneA:[.2,.19,.23],stoneB:[.38,.36,.4],fog:[.12,.08,.13],grassA:[.2,.48,.16],grassB:[.42,.7,.22]}},{icon:`🍄`,amp:3.6,liquid:0,snow:!1,gap:16,skip:.2,giant:2.5,starter:[7,.35,.12],mix:[[7,.42],[1,.3],[0,.18],[4,.1]],pal:{skyLow:[.16,.1,.26],skyTop:[.02,.03,.09],horizon:[.25,.45,.5],stoneA:[.17,.18,.22],stoneB:[.33,.34,.4],fog:[.09,.08,.15],grassA:[.1,.42,.3],grassB:[.3,.66,.38]}},{icon:`🏰`,amp:2,liquid:0,snow:!1,gap:15,skip:.15,giant:2.6,starter:[6,.4,.15],mix:[[9,.5],[2,.16],[1,.2],[0,.14]],pal:{skyLow:[.28,.15,.12],skyTop:[.05,.04,.1],horizon:[.75,.4,.16],stoneA:[.22,.2,.2],stoneB:[.4,.37,.36],fog:[.14,.09,.09],grassA:[.26,.5,.16],grassB:[.5,.72,.24]}},{icon:`❄️`,amp:4.8,liquid:1,snow:!0,gap:16,skip:.2,giant:2.7,starter:[8,.35,.12],mix:[[8,.45],[0,.25],[9,.15],[2,.15]],pal:{skyLow:[.2,.24,.34],skyTop:[.04,.06,.14],horizon:[.5,.6,.75],stoneA:[.3,.32,.38],stoneB:[.55,.57,.63],fog:[.16,.18,.24],grassA:[.22,.5,.3],grassB:[.5,.75,.45]}},{icon:`🌋`,amp:3.8,liquid:2,snow:!1,gap:16,skip:.2,giant:3,starter:[10,.32,.12],mix:[[10,.45],[4,.25],[2,.15],[7,.15]],pal:{skyLow:[.3,.08,.06],skyTop:[.05,.02,.05],horizon:[1,.3,.08],stoneA:[.13,.11,.12],stoneB:[.28,.24,.25],fog:[.16,.06,.05],grassA:[.24,.46,.14],grassB:[.55,.72,.2]}}];function kt(e){return Ot[(e-1)%Ot.length]}var At=[[0,0],[4,.2],[6,.14],[2,.32],[8,.13]];function jt(e,t=e){let n=kt(e);[x.k,x.a]=At[(e-1)%Ot.length];let r=t*101+7,i=()=>(r=r*16807%2147483647,r/2147483647),a=[],o=O.plan(t);for(let e=0;e<9;e++){let t=e/9*Math.PI*2+i(),r=5+i()*30;a.push({x:Math.cos(t)*r,z:Math.sin(t)*r,kind:n.starter[0],seed:Math.floor(i()*1e6),scale:n.starter[1]+i()*n.starter[2]})}let s=Math.floor(54/n.gap);for(let e=-s;e<=s;e++)for(let t=-s;t<=s;t++){if(t===0&&e===0)continue;let r=t*n.gap+(i()-.5)*6,s=e*n.gap+(i()-.5)*6;if(Math.hypot(r,s)>Ee(r,s)-9||i()<n.skip||Math.hypot(r-o.x,s-o.z)<o.r+6||Math.hypot(r-O.pond2.x,s-O.pond2.z)<O.pond2.r+6)continue;let c=i(),l=n.mix[0][0];for(let[e,t]of n.mix){if(c<t){l=e;break}c-=t}a.push({x:r,z:s,kind:l,seed:Math.floor(i()*1e6)})}Ue.snow=n.snow,Ue.giant=(e-1)%Ot.length,k.pal=n.pal,k.scenery(e,e%Ot.length,-1),k.nextPal=n.pal,k.prevPal=void 0,k.liquid=n.liquid,O.amp=n.amp;let c=a.slice(0,64),l=O.build(t,c.map(e=>({x:e.x,z:e.z,half:8.96*(e.scale??1)/2+.6})));return c.forEach((e,t)=>e.y=l[t]-.12),c}var Mt=0,Nt=0;function Pt(){let e=Math.min(2,window.devicePixelRatio||1),t=Math.round(innerWidth*e),n=Math.round(innerHeight*e),r=24e5,i=t*n;if(i>r){let e=Math.sqrt(r/i);t=Math.round(t*e),n=Math.round(n*e)}yt.width=Mt=t,yt.height=Nt=n,Tt.resize(t,n)}Pt(),addEventListener(`resize`,Pt);var Ft={grid:j.grid,atlas:j.atlas.tex[0],height:O.tex,b:j.bArr,b2:j.b2Arr,s2:j.s2Arr},It=new Float32Array(16),Lt=new Float32Array(16),N=new Float32Array(16),Rt=new Float32Array(16),zt=new Float32Array(3),Bt=new Float32Array(3),Vt=new Float32Array(3),P=new Float32Array([0,0,0]),F=new Float32Array(3),I=new Float32Array([0,0,0]),Ht=0,Ut=-9,Wt=0,Gt=0,Kt=Math.floor(Math.random()*1e3)%17,qt=!1,Jt=0,Yt=2.2,Xt=0,Zt=0,Qt=0,L=0,R=new Float32Array(4),z=new Float32Array(4);function $t(e,t){let n=e/innerWidth*2-1,r=1-t/innerHeight*2;R[0]=n,R[1]=r,R[2]=-1,R[3]=1,on(z,Rt,R);let i=z[0]/z[3],a=z[1]/z[3],o=z[2]/z[3];R[2]=1,on(z,Rt,R);let s=z[0]/z[3],c=z[1]/z[3],l=z[2]/z[3],u=0,d=0;for(let e=0;e<4;e++){if(d=(a-u)/(a-c),!(d>0))return;u=O.floor(i+(s-i)*d,o+(l-o)*d)}I[0]=i+(s-i)*d,I[2]=o+(l-o)*d}var en=new Float32Array(2),tn=new Float32Array(2);function nn(e,t,n){let r=e/innerWidth*2-1,i=1-t/innerHeight*2;R[0]=r,R[1]=i,R[2]=-1,R[3]=1,on(z,Rt,R);let a=z[0]/z[3],o=z[1]/z[3],s=z[2]/z[3];R[2]=1,on(z,Rt,R);let c=z[0]/z[3],l=z[1]/z[3],u=z[2]/z[3],d=o/(o-l);return d>0&&(n[0]=a+(c-a)*d,n[1]=s+(u-s)*d,!0)}var rn=[];function an(e,t){for(let n of rn){let r=j.buildings[n],i=8.96*(j.s2Arr[n*4]||1)/2+.9;if(Math.abs(e-r.x)<i&&Math.abs(t-r.z)<i)return!0}return!1}function on(e,t,n){for(let r=0;r<4;r++)e[r]=t[r]*n[0]+t[4+r]*n[1]+t[8+r]*n[2]+t[12+r]*n[3]}var sn=!1,cn=location.hostname.endsWith(`workers.dev`)?`/api/lb`:`https://kidgames.soroosh-ra.workers.dev/api/lb`,B=(()=>{let e=``,t=``;try{e=localStorage.getItem(`glowmites-id`)||``,t=localStorage.getItem(`glowmites-name`)||``}catch{}if(!e){e=Array.from({length:16},()=>`abcdefghijklmnopqrstuvwxyz0123456789`[Math.floor(Math.random()*36)]).join(``);try{localStorage.setItem(`glowmites-id`,e)}catch{}}if(!t){t=`Mite ${1e3+Math.floor(Math.random()*9e3)}`;try{localStorage.setItem(`glowmites-name`,t)}catch{}}return{id:e,name:t}})(),ln=[],un=0;async function dn(e){try{let t=new AbortController,n=setTimeout(()=>t.abort(),5e3),r=await fetch(cn,e?{method:`POST`,headers:{"content-type":`application/json`},body:JSON.stringify({id:B.id,name:B.name,score:Math.round($),land:Rn}),signal:t.signal}:{signal:t.signal});return clearTimeout(n),r.ok?(ln=await r.json(),e&&(un=$),ln):null}catch{return null}}var fn=()=>{let e=ln.findIndex(e=>e.id===B.id.slice(0,6));return e>=0?e+1:0};addEventListener(`visibilitychange`,()=>{document.hidden&&$>un&&dn(!0)});var pn=document.getElementById(`lb`),mn=!1;function hn(){mn=zn,zn=!0;let e=e=>e.toLocaleString(`en`),t=n=>{let r=(n&&n.length?n:[{id:B.id.slice(0,6),n:B.name,s:Math.round($),l:Rn}]).slice(0,30);pn.innerHTML=`<div class="box"><button class="x">✕</button><h2>🏆 Leaderboard</h2>
      <div class="meRow"><input maxlength="16" value="${B.name.replace(/"/g,``)}"/><b>⭐ ${e(Math.round($))}</b></div>
      ${n?``:`<p class="off">offline: only your own score</p>`}
      <div class="list">${r.map((t,n)=>`<div class="r${t.id===B.id.slice(0,6)?` me`:``}"><span>${n<3?[`🥇`,`🥈`,`🥉`][n]:n+1}</span><em>${t.n.replace(/[<>&]/g,``)}</em><i>${In[(t.l-1)%5]??``}</i><b>${e(t.s)}</b></div>`).join(``)}</div></div>`,pn.querySelector(`.x`).addEventListener(`click`,()=>{pn.classList.remove(`show`),zn=mn});let i=pn.querySelector(`input`);i.addEventListener(`change`,()=>{B.name=i.value.trim().slice(0,16)||B.name;try{localStorage.setItem(`glowmites-name`,B.name)}catch{}dn(!0).then(t)})};t(ln.length?ln:null),pn.classList.add(`show`),dn($>un).then(t)}document.getElementById(`lbBtn`).addEventListener(`click`,hn);var gn=!1,V=new Map,_n=!1,vn=0,yn=0,bn=0,xn=0,Sn=document.getElementById(`stick`),Cn=Sn.firstElementChild,wn=0,Tn=1,En=1,Dn=0,On=0,kn=!1;yt.addEventListener(`pointerdown`,e=>{if(M.start(),V.set(e.pointerId,{x:e.clientX,y:e.clientY}),V.size===2){let[e,t]=[...V.values()];wn=Math.hypot(e.x-t.x,e.y-t.y),Tn=En,kn=!1,_n=!1}else sn=!0,kn=!0,Dn=e.clientX,On=e.clientY,Ut=Q,Wt=e.clientX,Gt=e.clientY,e.pointerType!==`mouse`&&(_n=!0,vn=e.clientX,yn=e.clientY,bn=vn,xn=yn);Ht=Q,gn||(gn=!0,or.classList.add(`gone`)),zn||Je.gameplayStart()}),addEventListener(`pointermove`,e=>{let t=V.get(e.pointerId);if(t&&(t.x=e.clientX,t.y=e.clientY),V.size===2&&wn>0){let[e,t]=[...V.values()];En=Math.min(2.6,Math.max(.4,Tn*wn/Math.max(20,Math.hypot(e.x-t.x,e.y-t.y))))}else if(_n&&V.size===1){bn=e.clientX,xn=e.clientY,Ht=Q;let t=bn-vn,n=xn-yn,r=Math.hypot(t,n);r>70&&(vn=bn-t/r*70,yn=xn-n/r*70)}else(sn||e.pointerType===`mouse`)&&(kn=!0,Dn=e.clientX,On=e.clientY,Ht=Q)});var An=e=>{V.size===1&&e.pointerType===`mouse`&&Q-Ut<.28&&Math.hypot(e.clientX-Wt,e.clientY-Gt)<24&&($t(e.clientX,e.clientY),L=Math.max(L,.35),M.thump(.45)),V.delete(e.pointerId),V.size<2&&(wn=0),V.size===0&&(sn=!1,_n=!1)};addEventListener(`pointerup`,An),addEventListener(`pointercancel`,An),yt.addEventListener(`wheel`,e=>{e.preventDefault(),En=Math.min(2.6,Math.max(.4,En*Math.exp(e.deltaY*.0012)))},{passive:!1}),addEventListener(`keydown`,e=>{M.start(),(e.key===` `||e.key.startsWith(`Arrow`))&&e.preventDefault(),(e.key===`+`||e.key===`=`)&&(En=Math.max(.4,En/1.15)),(e.key===`-`||e.key===`_`)&&(En=Math.min(2.6,En*1.15)),e.key===`h`&&(bt.style.display=bt.style.display===`none`?`block`:`none`)});var jn=120,Mn=400,Nn=1.1,Pn=[``,`🦊 Foxy`,`🐸 Ribbit`,`🐙 Inky`,`🦄 Sparkle`,`🐝 Buzz`,`🐲 Draco`],Fn=[`#ffc05a`,`#5aa6ff`,`#ff4d5a`,`#73ff73`,`#d98cff`,`#4dfff0`,`#ff8cd9`],In=[`🌼`,`🍄`,`🏰`,`❄️`,`🌋`],Ln=[`Flower Meadow`,`Mushroom Forest`,`Castle Hills`,`Ice Valley`,`Fire Mountain`],Rn=1+Math.floor(Math.random()*5),H=-3,zn=!0,Bn=!1,U=Number(St.get(`start`)??Mn),Vn=0,Hn=Mn,Un=0,Wn=0,W=0,Gn=0,Kn=0,G={tx:new Float32Array(7),tz:new Float32Array(7),think:new Float32Array(7),dead:new Float32Array(7),meal:new Float32Array(7),aggr:new Float32Array(7),best:new Float32Array(7)},qn=new Float32Array(64),Jn=new Float32Array(64).fill(1),Yn=new Int8Array(64),Xn=new Float32Array(448),K=e=>e===0?U:D.A[e],q=e=>e===0?P[0]:D.L[e*3],J=e=>e===0?P[2]:D.L[e*3+2],Zn=e=>e===0?`You`:Pn[e],Qn=e=>3+Math.sqrt(Math.min(e,98304))*.05,$n=e=>Math.max(5.5,11.5-Math.sqrt(Math.min(e,98304))*.02),er=document.getElementById(`win`),tr=document.getElementById(`intro`),nr=document.getElementById(`combo`),rr=document.getElementById(`timer`),ir=document.getElementById(`board`),ar=document.getElementById(`feed`),or=document.getElementById(`hand`),sr=document.getElementById(`countN`),cr=document.getElementById(`count`);function lr(e,t=`#ffe27a`){nr.style.color=t,nr.textContent=e,nr.classList.remove(`pop`),nr.offsetWidth,nr.classList.add(`pop`)}function ur(e){let t=document.createElement(`div`);for(t.innerHTML=e,ar.prepend(t);ar.children.length>3;)ar.lastChild.remove();setTimeout(()=>t.remove(),4e3)}var dr=e=>`<b style="color:${Fn[e]}">${Zn(e)}</b>`;function fr(e,t){let n=0,r=0,i=-1;for(let t=0;t<16;t++){let t=Math.random()*Math.PI*2,a=(.35+Math.random()*.45)*Ee(Math.cos(t),Math.sin(t)),o=Math.cos(t)*a,s=Math.sin(t)*a,c=1e9;for(let t=0;t<7;t++)t!==e&&K(t)>0&&(c=Math.min(c,Math.hypot(q(t)-o,J(t)-s)));c>i&&(i=c,n=o,r=s)}t[0]=n,t[1]=r}var pr=[0,0];function mr(){Rn=St.has(`map`)?Number(St.get(`map`)):1+Math.floor(Math.random()*5),j.build(jt(Rn,1e3+Math.floor(Math.random()*9e3))),qn.fill(0),Jn.fill(1),xr.fill(1),Cr.fill(0),Yn.fill(-1),Xn.fill(0),wr=0,U=Number(St.get(`start`)??Mn),Vn=0,Hn=U,Un=0,Wn=0,W=0,Gn=0,Y=-1,yr=12,P[0]=0,P[2]=0,I[0]=0,I[2]=0,Xt=0,Zt=0;for(let e=1;e<7;e++){let t=e/6*Math.PI*2+.3,n=.62*Ee(Math.cos(t),Math.sin(t));D.L[e*3]=Math.cos(t)*n,D.L[e*3+2]=Math.sin(t)*n,D.L[e*3+1]=O.floor(D.L[e*3],D.L[e*3+2]),D.LV.fill(0,e*3,e*3+3),D.A[e]=Mn,G.think[e]=0,G.dead[e]=0,G.meal[e]=0,G.best[e]=Mn,G.aggr[e]=.6+Math.random()*.8}D.reset=!0,H=-3,zn=!1,Bn=!0,tr.innerHTML=`<h1>${In[Rn-1]} ${Ln[Rn-1]}</h1><div>3</div><p>Be the biggest swarm in 2 minutes!</p>`,tr.classList.remove(`show`),tr.offsetWidth,tr.classList.add(`show`,`long`),er.classList.remove(`show`),M.chime(2),`${Rn}`}j.build(jt(Rn,1e3+Math.floor(Math.random()*9e3)));function hr(){zn=!0,Je.gameplayStop();let e=[...Array(7).keys()].sort((e,t)=>K(t)-K(e)),t=e.indexOf(0)+1,n=Math.round(U);n>$&&($=n);try{localStorage.setItem(`glowmites-best`,String($))}catch{}let r=[`🥇`,`🥈`,`🥉`],i=e=>e>=1e4?`${(e/1e3).toFixed(1)}k`:String(Math.round(e));if(er.innerHTML=`<div class="card"><div class="t">${t===1?`🏆 You win!`:t<=3?`${r[t-1]} ${t}${[``,`st`,`nd`,`rd`][t]} place`:`${t}th of 7`}</div>
    <div class="list">${e.map((e,t)=>`<div class="r${e===0?` me`:``}"><span>${t<3?r[t]:t+1}</span><em style="color:${Fn[e]}">${Zn(e)}</em><b>${i(K(e))}</b></div>`).join(``)}</div>
    <div class="row">🍴 ate ${Un} swarm${Un===1?``:`s`} · 💀 eaten ${Wn}×</div>
    <div class="row tot">best ever: ${i($)}</div><div class="row rk">🏆 …</div>
    <div class="btns"><button class="lbb">🏆</button><button class="go">▶</button></div></div>`,er.classList.add(`show`),t===1){j.bloom=3;for(let e=0;e<6;e++)setTimeout(()=>M.chime(4+e),e*140)}else M.chime(3);dn(!0).then(e=>{let t=er.querySelector(`.rk`);t&&(t.textContent=e?`🏆 #${fn()||`–`} in the world`:`🏆 offline`)}),er.querySelector(`.lbb`).addEventListener(`click`,hn),er.querySelector(`.go`).addEventListener(`click`,()=>Je.commercialBreak().then(mr)),`${t}${n}${Un}${Wn}${e.map(e=>`${e}:${Math.round(K(e))}`).join(`,`)}`}function gr(){er.innerHTML=`<div class="card story"><div class="t">GLOWMITES</div>
    <div class="st"><span>✨</span><p>You are a glowing swarm. Eat the stone world to grow.</p></div>
    <div class="st"><span>🍴</span><p>Eat any swarm smaller than you. Run from the bigger ones!</p></div>
    <div class="st"><span>⏱</span><p>Two minutes. The biggest swarm wins.</p></div>
    <div class="btns"><button class="go">▶</button></div></div>`,er.classList.add(`show`),er.querySelector(`.go`).addEventListener(`click`,()=>{M.start(),mr()})}var _r=[[3,1,2,4],[8,9,7,10],[6,14,13,6],[15,11,2,16],[6,17,19,6],[17,19,10,6],[10,9,8,13],[20,21,22,20],[24,24,7,23],[27,1,6,4],[25,25,26,25]];function vr(e,t,n){let r=-1,i=1e9;for(let a=0;a<7;a++){let o=K(a);if(o<1)continue;let s=Math.hypot(e-q(a),t-J(a))-Qn(o);s<n&&s<i&&(i=s,r=a)}return r}j.onEat=(e,t)=>{let n=j.buildings[e],r=vr(n.x,n.z,8);if(r===0?Vn+=t*.7:r>0&&(G.meal[r]+=t*.7*(D.A[r]<U?1.25:1)),!j.gone[e]&&n.eaten>n.solid*.88&&(j.remove(e),r===0&&M.thump(.3)),r!==0)return;{let e=_r[n.kind];e&&D.birth.set(e)}M.eat(t);let i=n.kind===1?.3:n.kind===6?.5:.3;n.eaten>n.solid*i&&n.collapseAt<0&&(n.collapseAt=Q,j.fail(e),L=Math.max(L,n.kind===6?.2:.6),M.thump(.6))};var Y=-1,yr=12,br=document.getElementById(`fx`),X=br.getContext(`2d`),xr=new Float32Array(64).fill(1),Sr=new Float32Array(64),Cr=new Uint8Array(64),wr=0,Tr=-9,Er=0,Dr=0,Or=[];function kr(e,t,n,r){let i=N[3]*e+N[7]*t+N[11]*n+N[15];r[0]=((N[0]*e+N[4]*t+N[8]*n+N[12])/i*.5+.5)*Er,r[1]=(.5-(N[1]*e+N[5]*t+N[9]*n+N[13])/i*.5)*Dr,r[2]=i}var Z=new Float32Array(3),Ar=e=>e>=1e4?`${(e/1e3).toFixed(1)}k`:String(Math.round(e));function jr(e){let t=Math.min(2,devicePixelRatio||1),n=Math.round(innerWidth*t),r=Math.round(innerHeight*t);(br.width!==n||br.height!==r)&&(br.width=n,br.height=r),Er=n,Dr=r,X.clearRect(0,0,n,r);for(let i=0;i<j.buildings.length;i++){let a=j.buildings[i];if(j.gone[i]){Cr[i]||(Cr[i]=1,Yn[i]===0&&(wr=Q-Tr<4?wr+1:1,Tr=Q,wr>=2&&(Vn+=25*wr,lr(`×${wr}`),M.chime(Math.min(9,wr+2)))));continue}Cr[i]=0;let o=j.s2Arr[i*4]||1,s=j.s2Arr[i*4+1]+a.h*.28*o+.6,c=Jn[i];if(c<xr[i]-.0015&&(Sr[i]=1),xr[i]=c,Sr[i]=Math.max(0,Sr[i]-e*3.5),kr(a.x,s,a.z,Z),Z[2]<=0||Z[0]<0||Z[0]>n||Z[1]<0||Z[1]>r||(i===Y&&(X.save(),X.textAlign=`center`,X.shadowColor=`#ffd23c`,X.shadowBlur=18*t,X.font=`${Math.round(34*t*(1+.12*Math.sin(Q*7)))}px sans-serif`,X.fillText(`🌟`,Z[0],Z[1]-18*t),X.restore()),c>.999))continue;let l=Math.max(26,Math.min(90,2600/Z[2]))*t*.6,u=(5+4*Sr[i])*t,d=Z[0]-l/2,f=Z[1]-u;X.fillStyle=`rgba(10,10,20,0.65)`,X.fillRect(d-t,f-t,l+2*t,u+2*t),X.fillStyle=`hsl(${Math.round(c*115)},90%,${50+Sr[i]*25}%)`,X.fillRect(d,f,l*c,u)}X.save(),X.textAlign=`center`,X.textBaseline=`middle`;for(let e=0;e<7;e++){let i=K(e);if(i<1||(kr(q(e),(e===0?P[1]:D.L[e*3+1])+3+Qn(i)*.45,J(e),Z),Z[2]<=0))continue;let a=Z[0]>0&&Z[0]<n&&Z[1]>0&&Z[1]<r,o=e>0&&i>=U*Nn,s=e>0&&U>=i*Nn;if(a){X.font=`900 ${Math.round((e===0?17:15)*t)}px system-ui, sans-serif`;let n=`${Zn(e)} ${Ar(i)}`,r=X.measureText(n).width+14*t;X.fillStyle=o?`rgba(140,20,20,0.75)`:s?`rgba(20,110,40,0.75)`:`rgba(10,8,24,0.6)`,X.beginPath(),X.roundRect(Z[0]-r/2,Z[1]-12*t,r,24*t,12*t),X.fill(),X.fillStyle=Fn[e],X.fillText(n,Z[0],Z[1]+t)}else if(e>0&&(o||s)&&Math.hypot(q(e)-P[0],J(e)-P[2])<70){let e=Z[0]-n/2,i=Z[1]-r/2,a=Math.atan2(i,e),s=Math.min((n/2-30*t)/Math.abs(Math.cos(a)||.001),(r/2-(i<0?120:90)*t)/Math.abs(Math.sin(a)||.001));e=n/2+Math.cos(a)*s,i=r/2+Math.sin(a)*s,X.save(),X.translate(e,i),X.rotate(a);let c=16*t;X.fillStyle=o?`#ff4d4d`:`#6dff6d`,X.beginPath(),X.moveTo(c,0),X.lineTo(-c*.7,c*.75),X.lineTo(-c*.3,0),X.lineTo(-c*.7,-c*.75),X.closePath(),X.fill(),X.restore()}}X.restore();for(let n=Or.length-1;n>=0;n--){let r=Or[n];if(r.t+=e,r.t>1.3){Or.splice(n,1);continue}if(kr(r.x,r.y+r.t*3,r.z,Z),Z[2]<=0)continue;let i=(r.big?32:20)*t;X.save(),X.globalAlpha=Math.min(1,(1.3-r.t)*2.5),X.textAlign=`center`,X.font=`900 ${Math.round(i)}px system-ui, sans-serif`,X.lineWidth=4*t,X.strokeStyle=`rgba(40,20,0,0.85)`,X.strokeText(r.txt,Z[0],Z[1]),X.fillStyle=r.big?`#ffe27a`:`#fff3c4`,X.fillText(r.txt,Z[0],Z[1]),X.restore()}}var Mr=document.getElementById(`mini`),Nr=Mr.getContext(`2d`);function Pr(){let e=Math.min(2,devicePixelRatio||1);Mr.width!==104*e&&(Mr.width=104*e,Mr.height=104*e);let t=Nr;t.setTransform(e,0,0,e,0,0),t.clearRect(0,0,104,104);let n=46/64;t.beginPath();for(let e=0;e<=64;e++){let r=e/64*Math.PI*2,i=Ee(Math.cos(r),Math.sin(r))*n,a=52+Math.cos(r)*i,o=52+Math.sin(r)*i;e?t.lineTo(a,o):t.moveTo(a,o)}if(t.closePath(),t.fillStyle=`rgba(90,90,110,0.45)`,t.fill(),t.strokeStyle=`rgba(255,255,255,0.35)`,t.lineWidth=1.5,t.stroke(),Y>=0&&!j.gone[Y]){let e=j.buildings[Y];t.font=`11px sans-serif`,t.textAlign=`center`,t.textBaseline=`middle`,t.fillText(`🌟`,52+e.x*n,52+e.z*n)}for(let e=6;e>=0;e--){let r=K(e);r<1||(t.beginPath(),t.arc(52+q(e)*n,52+J(e)*n,Math.max(2.5,Qn(r)*n),0,Math.PI*2),t.fillStyle=Fn[e],t.fill(),e===0&&(t.strokeStyle=`#fff`,t.lineWidth=1.5,t.stroke()))}}function Fr(e){let t=K(e),n=q(e),r=J(e),i=NaN,a=NaN,o=1e9,s=-1;for(let s=0;s<7;s++){if(s===e)continue;let c=K(s);if(c<1)continue;let l=Math.hypot(q(s)-n,J(s)-r);c>=t*Nn&&l<16+Qn(c)*2&&l<o&&!(e===0&&Gn>0)&&(o=l,i=n+(n-q(s))*2,a=r+(r-J(s))*2)}if(Number.isNaN(i))for(let o=0;o<7;o++){if(o===e)continue;let c=K(o);if(c<1||t<c*Nn||o===0&&Gn>0)continue;let l=Math.hypot(q(o)-n,J(o)-r),u=20+25*(e===0?1:G.aggr[e]),d=c/(l+10);l<u&&d>s&&(s=d,i=q(o),a=J(o))}if(Number.isNaN(i)){let e=-1,t=-1;for(let i=0;i<j.buildings.length;i++){if(j.gone[i])continue;let a=j.buildings[i],o=Math.hypot(a.x-n,a.z-r),s=(a.solid+400)/(o+8)*(i===Y?8:1);s>t&&(t=s,e=i)}e>=0?(i=j.buildings[e].x,a=j.buildings[e].z):(i=(Math.random()-.5)*70,a=(Math.random()-.5)*70)}let c=Math.hypot(i,a),l=Ee(i,a)-6;c>l&&(i*=l/c,a*=l/c),G.tx[e]=i,G.tz[e]=a}var Q=0,Ir=0,Lr=0,Rr=0,$=0;try{$=Number(localStorage.getItem(`glowmites-best`)||0)}catch{}var zr=1/30;function Br(e){requestAnimationFrame(Br);let t=Ir?e-Ir:16.7;Ir=e,Lr<90&&t<40&&(Rr+=t,Lr++,Lr===90&&A.setRefresh(1e3/(Rr/90))),A.push(t);let n=Math.min(zr,t/1e3);Q+=n,Et===null&&A.update(n);let r=p[A.tier],i=Bn&&!zn;if(i){let e=H;if(H+=n,e<0&&Math.ceil(e)!==Math.ceil(H)){let e=Math.ceil(-H),t=tr.querySelector(`div`);t&&(t.textContent=e>0?String(e):`GO!`),M.chime(e>0?3:7),e<=0&&Je.gameplayStart()}H>=jn&&hr()}let l=i&&H>=0;if(Vn>=1){let e=Math.floor(Vn);Vn-=e,U+=e}Hn=Math.max(Hn,U);let u=!sn&&Q-Ht>1&&Q>3&&W<=0,d=D.shape;u&&qt&&d.blend>.95&&(Jt+=n,Jt>5&&(Jt=0,Kt=_t(Kt),vt(Kt,d))),u&&!qt&&(qt=!0,Jt=0,vt(Kt,d),d.pos[0]=P[0],d.pos[2]=P[2],d.pos[1]=O.floor(P[0],P[2])),!u&&qt&&d.blend<.05&&(qt=!1,Kt=_t(Kt)),d.blend=qt&&u?Math.min(1,d.blend+n*2.2):Math.max(0,d.blend-n*3),d.scale=2.4+Math.sqrt(Math.min(U,ae[0]))*.07;let f=1;if(qt&&u)I[0]=P[0],I[2]=P[2];else if(_n){let e=bn-vn,t=xn-yn,n=Math.hypot(e,t);if(n>6){let r=innerWidth/2,i=innerHeight*.55;if(nn(r,i,en)&&nn(r+e/n*60,i+t/n*60,tn)){let e=tn[0]-en[0],t=tn[1]-en[1],r=Math.hypot(e,t)||1;f=Math.min(1,n/55),I[0]=P[0]+e/r*30,I[2]=P[2]+t/r*30}}else I[0]=P[0],I[2]=P[2]}else kn&&(sn||!(`ontouchstart`in window))&&$t(Dn,On);Sn.style.display=_n?`block`:`none`,_n&&(Sn.style.transform=`translate(${vn}px,${yn}px)`,Cn.style.transform=`translate(${bn-vn}px,${xn-yn}px)`);{let e=Math.hypot(I[0],I[2]),t=Ee(I[0],I[2])-4;e>t&&(I[0]*=t/e,I[2]*=t/e)}let m=O.at(P[0],P[2])<te-.05,h=Math.hypot(P[0]-O.pond.x,P[2]-O.pond.z)<O.pond.r*1.3,g=m?h?k.liquid:0:-1;if(g===2&&l&&U>60){let e=U*.05*n;Kn+=e,U=Math.max(60,U-e),Kn>30+U*.02&&(Or.push({x:P[0],y:P[1]+4,z:P[2],t:0,txt:`🔥 -${Math.round(Kn)}`,big:!1}),Kn=0)}let _=$n(U),ee=H>=0&&W<=0,v=I[0]-P[0],y=I[2]-P[2],b=Math.hypot(v,y),x=ee?_*f*(g===0?.65:g===1?1.3:1):0,S=b>.01?v/b*Math.min(b*3.5,x):0,ne=b>.01?y/b*Math.min(b*3.5,x):0,C=Math.min(1,n*(_n?10:7)*(g===1?.2:1));if(F[0]+=(S-F[0])*C,F[2]+=(ne-F[2])*C,P[0]+=F[0]*n,P[2]+=F[2]*n,P[1]=O.floor(P[0],P[2]),k.swarmXZ[0]=P[0],k.swarmXZ[1]=P[2],l){for(let e=0;e<j.buildings.length;e++){if(j.gone[e])continue;let t=j.buildings[e],r=8.96*(j.s2Arr[e*4]||1)/2;for(let i=0;i<7;i++){let a=K(i);if(!(a<1||i===0&&W>0)&&Math.hypot(t.x-q(i),t.z-J(i))<r+Qn(a)*.95){let t=(1.5+(i===0?1.2*Math.min(1.3,Math.hypot(F[0],F[2])/_):.6))*(1+Math.sqrt(Math.min(a,98304))/150);qn[e]+=n*t,Xn[e*7+i]+=n*t}}let i=(.6+t.solid/2500)/Math.max(.2,j.s2Arr[e*4+2])*.5*(e===Y?2.5:1);if(Jn[e]=Math.max(0,Jn[e]-n*.9,1-Math.max(t.eaten/(t.solid*.88),qn[e]/i)),!(Jn[e]>0)){if(t.collapseAt<0)t.collapseAt=Q,j.fail(e),L=Math.max(L,.4);else if(Q-t.collapseAt>.7){let n=0;for(let t=1;t<7;t++)Xn[e*7+t]>Xn[e*7+n]&&(n=t);Yn[e]=n;let r=40+t.solid*.05+(e===Y?1500+K(n)*.1:0);n===0?(Vn+=r,Or.push({x:t.x,y:j.s2Arr[e*4+1]+3,z:t.z,t:0,txt:`+${Math.round(r)}`,big:e===Y}),M.thump(.5)):G.meal[n]+=r,e===Y&&(lr(n===0?`🌟 golden food!`:`🌟 → ${Zn(n)}`,n===0?`#ffe27a`:Fn[n]),Y=-1,yr=H+15),j.remove(e)}}}if(Y<0&&H>yr&&H<110){let e=-1,t=-1;for(let n=0;n<j.buildings.length;n++){if(j.gone[n]||j.buildings[n].collapseAt>=0)continue;let r=(j.buildings[n].solid+500)*(.5+Math.random());r>t&&(t=r,e=n)}e>=0&&(Y=e,M.chime(6),ur(`🌟 golden food appeared!`))}}if(l&&U>0&&W<=0){rn.length=0;let e=Qn(U);for(let t=0;t<j.buildings.length;t++){if(j.gone[t])continue;let n=j.buildings[t];Math.abs(n.x-P[0])<e+8&&Math.abs(n.z-P[2])<e+8&&rn.push(t)}O.dig(P[0],P[2],e*.85,n*(.15+.03*Math.hypot(F[0],F[2])),an),A.frames&1||O.flush()}for(let e=1;e<7;e++){if(!l){D.LV[e*3]=0,D.LV[e*3+2]=0,D.SP[e]=8;continue}if(G.dead[e]>0){if(G.dead[e]-=n,G.dead[e]<=0){fr(e,pr),D.L[e*3]=pr[0],D.L[e*3+2]=pr[1];let t=[...Array(7).keys()].map(K).sort((e,t)=>e-t);D.A[e]=Math.max(Mn,Math.round(t[3]*.3))}continue}if(G.meal[e]>=1){let t=Math.floor(G.meal[e]);G.meal[e]-=t,D.A[e]+=t}G.best[e]=Math.max(G.best[e],D.A[e]),G.think[e]-=n,G.think[e]<=0&&(G.think[e]=.25+Math.random()*.3,Fr(e));let t=D.A[e],r=D.L[e*3],i=D.L[e*3+2],a=$n(t)*.93,o=G.tx[e]-r,s=G.tz[e]-i,c=Math.hypot(o,s),u=c>.01?o/c*Math.min(c*3,a):0,d=c>.01?s/c*Math.min(c*3,a):0;D.LV[e*3]+=(u-D.LV[e*3])*Math.min(1,n*5),D.LV[e*3+2]+=(d-D.LV[e*3+2])*Math.min(1,n*5),D.L[e*3]+=D.LV[e*3]*n,D.L[e*3+2]+=D.LV[e*3+2]*n,D.L[e*3+1]=O.floor(D.L[e*3],D.L[e*3+2]),D.SP[e]=a}if(Gn=Math.max(0,Gn-n),l)for(let e=0;e<7;e++)for(let t=0;t<7;t++){if(e===t)continue;let r=K(e),i=K(t);if(r<1||i<1||r<i*Nn||t===0&&(Gn>0||W>0)||e===0&&W>0||Math.hypot(q(e)-q(t),J(e)-J(t))>(Qn(r)+Qn(i))*.7)continue;let a=Math.min(i,Math.ceil(n*(r*.5+400)));if(t===0?(U-=a,L=Math.max(L,.4)):D.A[t]-=a,e===0?(Vn+=a*.9,M.eat(a*.05)):G.meal[e]+=a*.9,K(t)<40){if(t===0)U=0,W=2.5,Wn++,L=1.2,M.thump(1.2),lr(`💀 ${Zn(e)} ate you!`,Fn[e]),ur(`${dr(e)} ate ${dr(0)}`);else if(D.A[t]=0,G.dead[t]=4,ur(`${dr(e)} ate ${dr(t)}`),e===0){Un++,M.thump(1),lr(`🍴 you ate ${Zn(t)}!`,`#8dff7a`);for(let e=0;e<4;e++)setTimeout(()=>M.chime(6+e),e*100)}}}W>0&&(W-=n,W<=0&&(fr(0,pr),U=Math.round(Mn+Hn*.25),Gn=3,P[0]=pr[0],P[2]=pr[1],I[0]=P[0],I[2]=P[2],Xt=P[0],Zt=P[2],D.reset=!0)),D.step(n,Q,P,F,W>0?0:U,_,Ft),j.boost=(1+2.5*Math.min(1.3,Math.hypot(F[0],F[2])/_))*Math.min(1,Math.sqrt(12e3/Math.max(1,Math.min(U,98304)))),j.feed(D.state.tex[0],D.state.tex[1],D.span(),n,Q),j.bloom>0&&(j.bloom-=n,j.flood(n*.45)),k.hint[3]=0,!gn&&Bn&&H>-1&&or.classList.remove(`gone`);let w=17+Math.sqrt(Math.min(U,ae[0]))*.13+d.blend*d.scale*1.2,re=Math.min(1,Q/3.2),T=re*re*(3-2*re),E=(2.2+(w-2.2)*T)*En;Yt+=(E-Yt)*Math.min(1,n*(Q<3.2?6:3)),Xt+=(P[0]-Xt)*Math.min(1,n*2.2),Zt+=(P[2]-Zt)*Math.min(1,n*2.2);let ie=.3+.52*T;Qt+=(O.floor(Xt,Zt)+d.blend*d.scale*.35-Qt)*Math.min(1,n*2),zt[0]=Xt,zt[1]=Qt+.6+Yt*ie,zt[2]=Zt+Yt*.95;let oe=Mt/Nt;a(It,oe<1?1.05:.85,oe,.3,600),L=Math.max(0,L-n*1.6);let se=L*L*.35;if(o(Lt,zt[0]+Math.sin(Q*61)*se,zt[1]+Math.sin(Q*47)*se,zt[2],Xt,Qt,Zt-Yt*.12),s(N,It,Lt),c(Rt,N),Bt[0]=Lt[0],Bt[1]=Lt[4],Bt[2]=Lt[8],Vt[0]=Lt[1],Vt[1]=Lt[5],Vt[2]=Lt[9],Tt.begin(r.scale),k.draw(N,Rt,zt,D.light,j.color.tex[0],Q),j.focus[0]=P[0],j.focus[1]=P[1]+1.5,j.focus[2]=P[2],j.draw(N,zt,D.light),Dt.draw(N,zt,Xt,Zt-Yt*.1,Q,j.color.tex[0],D.light,D.light,1,O.tex),j.shadows=A.tier<=2,k.drawWater(N,zt,D.light,j.color.tex[0],Q),D.draw(N,Bt,Vt,Q,U,2/(It[5]*Nt*r.scale),P,Ft),Tt.end(r.scale,Q,r.bloom,Mt,Nt),jr(n),!(A.frames&7)){let e=Ar(U);sr.textContent!==e&&(sr.textContent=e,cr.classList.remove(`pop`),cr.offsetWidth,cr.classList.add(`pop`));let t=Math.max(0,Math.ceil(jn-Math.max(0,H)));rr.textContent=Bn?`${Math.floor(t/60)}:${String(t%60).padStart(2,`0`)}`:``,rr.classList.toggle(`hurry`,t<=10&&!zn&&Bn),ir.innerHTML=[...Array(7).keys()].sort((e,t)=>K(t)-K(e)).map((e,t)=>`<div class="${e===0?`me`:``}${K(e)<1?` dead`:``}"><span>${t+1}</span><i style="background:${Fn[e]}"></i><em>${Zn(e)}</em><b>${K(e)<1?`💀`:Ar(K(e))}</b></div>`).join(``)}A.frames&3||Pr(),Ct&&bt.style.display!==`none`&&!(A.frames&3)&&A.graph(xt,`${Math.round(U).toLocaleString()} mites  ${Mt}x${Nt} @${Math.round(r.scale*100)}%`)}requestAnimationFrame(Br),Je.init().then(()=>Je.loadingFinished()),queueMicrotask(()=>{St.has(`go`)?mr():gr()});