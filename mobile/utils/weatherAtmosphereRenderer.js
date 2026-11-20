// The approved atmospheric shader is shared unchanged by native Expo GL and WebGL.
export const atmosphereFragment = `
precision highp float;
uniform vec2 resolution;
uniform float time;
uniform float weather;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float n=0.,a=.5;mat2 r=mat2(.8,.6,-.6,.8);for(int i=0;i<5;i++){n+=a*noise(p);p=r*p*2.03+17.2;a*=.5;}return n;}
float clouds(vec2 p,float t){vec2 warp=vec2(fbm(p*.68+vec2(t*.025,5.)),fbm(p*.63-vec2(t*.018,0.)));return fbm(p+warp*1.9);}
vec3 sky(vec2 uv){
  vec2 p=vec2(uv.x,uv.y*resolution.y/resolution.x);
  float t=time;
  if(weather<.5){
    vec3 c=mix(vec3(.67,.82,.91),vec3(.89,.95,.95),smoothstep(0.,1.,uv.y));
    vec2 light=vec2(1.19,-.19);vec2 d=p-light;
    float distance=length(d), angle=atan(d.y,d.x);
    // Spatially varying phases deform individual rays around the fixed light source.
    float age=t-12.;
    float phase=angle*13.7;
    float rate=.24+.10*sin(angle*9.3+1.4);
    float drift=.032*(sin(age*rate+phase)-sin(phase));
    float breathe=.045*(sin(age*.37+angle*20.1)-sin(angle*20.1));
    float rayAngle=angle+drift+breathe;
    float density=fbm(vec2(rayAngle*11.2+fbm(vec2(rayAngle*3.1,t*.006))*1.4,t*.015+3.+age*(.065+.025*sin(angle*6.2))));
    float wide=fbm(vec2(rayAngle*4.3,t*.009+16.));
    float fade=.065*(sin(age*.29+angle*17.3)-sin(angle*17.3));
    float rays=smoothstep(.37+fade,.74+fade,density)*(.42+.58*wide);
    float attenuation=exp(-distance*.82);
    float haze=exp(-distance*distance*1.35);
    c=mix(c,vec3(1.,.979,.902),haze*.57);
    c+=vec3(.12,.10,.058)*rays*attenuation;
    float veil=clouds(p*vec2(1.9,1.1)+vec2(-t*.003,2.4),t);
    c=mix(c,vec3(.965,.976,.974),smoothstep(.59,.85,veil)*.12);
    return c;
  }
  if(weather<2.5){
    bool rainy=weather>1.5;
    vec3 upper=rainy?vec3(.48,.57,.61):vec3(.60,.67,.70);
    vec3 lower=rainy?vec3(.76,.81,.81):vec3(.88,.90,.88);
    vec3 c=mix(upper,lower,smoothstep(0.,1.,uv.y));
    vec2 q=p*vec2(2.35,1.7);
    float far=clouds(q+vec2(-t*.011,1.6),t);
    float near=clouds(q*1.65+vec2(-t*.024,6.2),t+31.);
    float shadow=clouds(q+vec2(-t*.011,.18),t);
    float cloud=smoothstep(.27,.72,far);
    float edge=clamp((far-shadow)*1.1,-.15,.15);
    c=mix(c,vec3(.91,.92,.89)+edge,cloud*.58);
    c-=vec3(.17,.175,.175)*smoothstep(.37,.73,near)*(1.-uv.y*.58);
    float mist=clouds(p*vec2(1.7,3.5)+vec2(-t*.037,22.),t*.5);
    float belt=exp(-pow((uv.y-.21)*3.1,2.));
    c=mix(c,vec3(.91,.94,.93),smoothstep(.32,.70,mist)*belt*.29);
    if(rainy){
      for(int j=0;j<2;j++){
        float layer=float(j);vec2 r=p*vec2(56.+layer*32.,4.4+layer*2.);
        r.x+=r.y*.10;r.y-=t*(2.7+layer*1.9);
        vec2 cell=floor(r);vec2 f=fract(r);float h=hash(vec2(cell.x,layer+3.));
        float streak=(1.-smoothstep(.009,.031,abs(f.x-(.18+h*.66))))*smoothstep(.0,.15,f.y)*(1.-smoothstep(.20+h*.28,.38+h*.30,f.y));
c+=vec3(.075,.09,.10)*streak*step(.52,h)*(layer*.25+.6);
      }
    }
    return c;
  }
  vec3 c=mix(vec3(.035,.065,.12),vec3(.11,.18,.235),smoothstep(0.,1.,uv.y));
  c+=vec3(.012,.02,.029)*fbm(p*2.+vec2(1.8,7.));
  vec2 moon=vec2(.88,.34),m=(p-moon)/.046;
  float r2=dot(m,m), dist=length(p-moon);
  c+=vec3(.22,.19,.12)*exp(-dist*dist/ .014)*.28;
  if(r2<1.){
    vec3 normal=vec3(m.x,-m.y,sqrt(1.-r2));
    vec3 light=normalize(vec3(.94,.20,.25));
    float lambert=dot(normal,light);
    float lit=smoothstep(-.018,.045,lambert);
    float surface=.82+.18*fbm(m*9.8+11.);
    vec3 lunar=vec3(1.,.94,.72)*surface*(.84+.16*max(0.,lambert));
    c=mix(c,lunar,lit*(1.-smoothstep(.92,1.,r2)));
  }
  for(int i=0;i<18;i++){
    float k=float(i);vec2 s=vec2(hash(vec2(k,1.)),hash(vec2(k,7.))*2.25);
    float size=mix(.0009,.0017,hash(vec2(k,3.)));
    float d=length(p-s);
    float star=exp(-d*d/(size*size));
    c+=vec3(.65,.70,.72)*star*(.42+.12*sin(t*.30+k*4.));
  }
  float wisp=clouds(p*vec2(2.1,2.8)+vec2(-t*.007,24.5),t*.3);
  c=mix(c,vec3(.20,.25,.29),smoothstep(.49,.78,wisp)*.18);
  return c;
}
void main(){vec2 uv=gl_FragCoord.xy/resolution;uv.y=1.-uv.y;gl_FragColor=vec4(clamp(sky(uv),0.,1.),1.);}`;

export const glassFragment = `
precision highp float;
uniform sampler2D background;
uniform vec2 resolution;
uniform vec2 logicalSize;
uniform vec4 card;
uniform float rain;
uniform float dark;
uniform float night;
uniform float gridTest;
uniform float lensEnabled;
vec3 backdrop(vec2 p) {
  if(gridTest>.5) return vec3(mod(floor(p.x/8.)+floor(p.y/8.),2.));
  vec3 skyColor=texture2D(background,vec2(p.x/logicalSize.x,1.-p.y/logicalSize.y)).rgb;
  return mix(skyColor,vec3(.035,.065,.085),dark*(1.-night)*.76);
}
vec3 glass(vec2 p) {
  vec3 c=backdrop(p)*.24;
  c+=backdrop(p+vec2(5.,0.))*.12+backdrop(p-vec2(5.,0.))*.12;
  c+=backdrop(p+vec2(0.,5.))*.12+backdrop(p-vec2(0.,5.))*.12;
  c+=backdrop(p+vec2(4.,4.))*.07+backdrop(p-vec2(4.,4.))*.07;
  c+=backdrop(p+vec2(4.,-4.))*.07+backdrop(p-vec2(4.,-4.))*.07;
  if(gridTest>.5) return backdrop(p);
  return mix(c,mix(vec3(.965,.98,.98),vec3(.065,.12,.15),dark),mix(.28,.36,dark));
}
float cap(vec2 p,vec2 radius) {
  vec2 n=p/radius;
  float q=n.x*n.x*(1.+.12*clamp(n.y,-1.,1.))+n.y*n.y;
  return radius.x*.51*pow(max(0.,1.-q),.58);
}
vec3 droplet(vec3 base,vec2 p,vec2 center,vec2 radius) {
  vec2 local=p-center;
  float h=cap(local,radius);
  if(h<=0. || lensEnabled<.5) return base;
  float dx=(cap(local+vec2(.2,0.),radius)-cap(local-vec2(.2,0.),radius))/.4;
  float dy=(cap(local+vec2(0.,.2),radius)-cap(local-vec2(0.,.2),radius))/.4;
  vec3 normal=normalize(vec3(-dx,-dy,1.));
  vec3 ray=refract(vec3(0.,0.,-1.),normal,1./1.333);
  vec2 exitRay=ray.xy*1.333;
  float exitZ=sqrt(max(.001,1.-dot(exitRay,exitRay)));
  vec2 source=p+ray.xy*h/max(.001,-ray.z)+exitRay*3./exitZ;
  vec3 water=glass(source);
  // shortcut: DOM text is intentionally above the optical surface, not refracted.
  if(gridTest<.5) {
    float fresnel=.02+.98*pow(1.-normal.z,5.);
    float shine=pow(max(0.,dot(normal,normalize(vec3(-.45,-.55,1.)))),48.);
    water=mix(water,vec3(.91,.97,1.),fresnel*.30)+shine*.32;
  }
  return mix(base,water,smoothstep(0.,.6,h));
}
void main() {
  vec2 p=vec2(gl_FragCoord.x/resolution.x,1.-gl_FragCoord.y/resolution.y)*logicalSize;
  vec3 c=backdrop(p);
  vec2 center=card.xy+card.zw*.5;
  vec2 q=abs(p-center)-(card.zw*.5-vec2(23.));
  float edge=length(max(q,0.))+min(max(q.x,q.y),0.)-23.;
  if(rain>.5 && card.z>0. && edge<0.) {
    c=glass(p);
    c=droplet(c,p,card.xy+card.zw*vec2(.91,.16),vec2(4.2,5.4));
    c=droplet(c,p,card.xy+card.zw*vec2(.07,.39),vec2(3.1,4.0));
    c=droplet(c,p,card.xy+card.zw*vec2(.50,.45),vec2(5.1,6.4));
    c=droplet(c,p,card.xy+card.zw*vec2(.78,.76),vec2(3.5,4.3));
    c=droplet(c,p,card.xy+card.zw*vec2(.29,.78),vec2(2.6,3.2));
  }
  gl_FragColor=vec4(clamp(c,0.,1.),1.);
}`;

export function createWeatherRenderer(gl) {
  const shaders=[], programs=[];
  let buffer, texture, framebuffer, width=0, height=0;
  const dispose=()=>{
    if(buffer) gl.deleteBuffer(buffer);
    if(texture) gl.deleteTexture(texture);
    if(framebuffer) gl.deleteFramebuffer(framebuffer);
    programs.forEach(p=>gl.deleteProgram(p));
    shaders.forEach(s=>gl.deleteShader(s));
  };
  try {
    const compile=(type,source)=>{
      const shader=gl.createShader(type);shaders.push(shader);
      gl.shaderSource(shader,source);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    };
    const vertex=compile(gl.VERTEX_SHADER,'attribute vec2 position;void main(){gl_Position=vec4(position,0.,1.);}');
    const makeProgram=source=>{
      const p=gl.createProgram();programs.push(p);
      gl.attachShader(p,vertex);gl.attachShader(p,compile(gl.FRAGMENT_SHADER,source));gl.linkProgram(p);
      if(!gl.getProgramParameter(p,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const uniforms={};
      ['resolution','time','weather','background','logicalSize','card','rain','dark','night','gridTest','lensEnabled'].forEach(n=>uniforms[n]=gl.getUniformLocation(p,n));
      return {program:p,position:gl.getAttribLocation(p,'position'),uniforms};
    };
    const sky=makeProgram(atmosphereFragment), surface=makeProgram(glassFragment);
    buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    framebuffer=gl.createFramebuffer();
    const use=pass=>{
      gl.useProgram(pass.program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      gl.enableVertexAttribArray(pass.position);gl.vertexAttribPointer(pass.position,2,gl.FLOAT,false,0,0);
      gl.uniform2f(pass.uniforms.resolution,width,height);
    };
    return {
      draw({scene,time=12,dark=false,cardRect=null,width:logicalWidth,height:logicalHeight,gridTest=false,lensEnabled=true}) {
        // Native surface creation can precede its first non-zero layout.
        if (!(logicalWidth>0 && logicalHeight>0 && gl.drawingBufferWidth>0 && gl.drawingBufferHeight>0)) return false;
        // Noise is soft by design; cap its render resolution on high-density phones.
        const ratio=Math.min(1,logicalWidth*1.25/gl.drawingBufferWidth);
        const w=Math.max(1,Math.round(gl.drawingBufferWidth*ratio)),h=Math.max(1,Math.round(gl.drawingBufferHeight*ratio));
        gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);
        if(w!==width||h!==height) {
          width=w;height=h;gl.bindTexture(gl.TEXTURE_2D,texture);
          gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
          gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
          const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
          if(status!==gl.FRAMEBUFFER_COMPLETE) throw new Error(`Weather framebuffer unavailable (${status}; ${width}x${height})`);
        }
        gl.viewport(0,0,width,height);
        use(sky);gl.uniform1f(sky.uniforms.time,time);
        gl.uniform1f(sky.uniforms.weather,({sun:0,cloud:1,rain:2,night:3})[scene]??0);
        gl.drawArrays(gl.TRIANGLES,0,6);
        gl.bindFramebuffer(gl.FRAMEBUFFER,null);use(surface);
        gl.viewport(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight);
        gl.uniform2f(surface.uniforms.resolution,gl.drawingBufferWidth,gl.drawingBufferHeight);
        gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(surface.uniforms.background,0);
        gl.uniform2f(surface.uniforms.logicalSize,logicalWidth,logicalHeight);
        gl.uniform4f(surface.uniforms.card,cardRect?.x??0,cardRect?.y??0,cardRect?.width??0,cardRect?.height??0);
        gl.uniform1f(surface.uniforms.rain,scene==='rain'?1:0);gl.uniform1f(surface.uniforms.dark,dark?1:0);
        gl.uniform1f(surface.uniforms.night,scene==='night'?1:0);
        gl.uniform1f(surface.uniforms.gridTest,gridTest?1:0);gl.uniform1f(surface.uniforms.lensEnabled,lensEnabled?1:0);
        gl.drawArrays(gl.TRIANGLES,0,6);gl.endFrameEXP?.();
      },
      dispose,
    };
  } catch(error) {dispose();throw error;}
}
