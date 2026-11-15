// Canvas textures built at runtime from small openly licensed photo swatches (see ASSETS.md).
import * as THREE from 'three';
export const loadImg=src=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>{console.warn('missing',src);r(null)};i.src=src});
export const cv=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return [c,c.getContext('2d')]};
export function tex(c,{srgb=true,wrap=true,aniso=8}={}){const t=c instanceof HTMLImageElement?new THREE.Texture(c):new THREE.CanvasTexture(c);
  t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;if(wrap)t.wrapS=t.wrapT=THREE.RepeatWrapping;else t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;t.anisotropy=aniso;t.needsUpdate=true;return t}
let seed=11;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
// fill a path/rect region with a marble swatch (pattern, randomly offset/rotated so repeats don't line up)
function marble(g,img,scale=1,rot=0){const p=g.createPattern(img,'repeat');const m=new DOMMatrix();m.rotateSelf(rot);m.scaleSelf(scale,scale);m.translateSelf(rnd()*500,rnd()*250);p.setTransform(m);return p}
// travertine / white marble wall: warm tinted photo marble with faint ashlar joints. One tile = 4 m x 4 m.
export function travertine(M,{tint='rgba(226,206,170,.42)',joints=true,size=1024}={}){const [c,g]=cv(size,size);
  g.fillStyle=marble(g,M.white,2.2,90);g.fillRect(0,0,size,size);g.fillStyle=tint;g.fillRect(0,0,size,size);
  // horizontal bedding streaks typical of travertine
  for(let i=0;i<260;i++){const y=rnd()*size,w=20+rnd()*220,x=rnd()*size;g.fillStyle=`rgba(${120+rnd()*40|0},${100+rnd()*30|0},${70+rnd()*20|0},${.04+rnd()*.07})`;g.fillRect(x,y,w,1+rnd()*2.5)}
  if(joints){g.strokeStyle='rgba(90,72,50,.28)';g.lineWidth=2;for(let r=0;r<4;r++){const y=r*size/4;g.beginPath();g.moveTo(0,y);g.lineTo(size,y);g.stroke();
    const off=(r%2)*size/4;for(let k=0;k<2;k++){const x=off+k*size/2;g.beginPath();g.moveTo(x,y);g.lineTo(x,y+size/4);g.stroke()}}}
  return c}
// fluted pilaster face (one tile = pilaster width x 4 m)
export function fluted(M){const [c,g]=cv(256,512);g.drawImage(travertine(M,{joints:false,size:512}),0,0,256,512);
  const n=7;for(let i=0;i<n;i++){const x0=18+i*(220/n),w=220/n-6;const gr=g.createLinearGradient(x0,0,x0+w,0);
    gr.addColorStop(0,'rgba(60,45,30,.35)');gr.addColorStop(.35,'rgba(255,248,230,.18)');gr.addColorStop(.7,'rgba(60,45,30,.08)');gr.addColorStop(1,'rgba(40,30,20,.4)');g.fillStyle=gr;g.fillRect(x0,0,w,512)}
  return c}
// gilded coffers for the barrel vaults; centre of each coffer is the photographed rosette coffer from the nave vault
export function coffers(M,{red=false}={}){const S=1024,[c,g]=cv(S,S);
  g.fillStyle=red?'#a8735a':'#d8c08a';g.fillRect(0,0,S,S);
  const cell=S/2;
  for(let i=0;i<2;i++)for(let j=0;j<2;j++){const x=i*cell,y=j*cell;
    // white stucco ribs between coffers
    g.fillStyle='#eadfc8';g.fillRect(x,y,cell,cell);
    const gr=g.createLinearGradient(x,y,x+cell,y+cell);gr.addColorStop(0,'#f6ecd4');gr.addColorStop(1,'#b9a582');g.fillStyle=gr;g.fillRect(x+18,y+18,cell-36,cell-36);
    // gilded frame and recessed panel
    g.fillStyle='#c9a04c';g.fillRect(x+34,y+34,cell-68,cell-68);
    g.fillStyle=red?'#93583e':'#a07a3a';g.fillRect(x+52,y+52,cell-104,cell-104);
    const sh=g.createLinearGradient(x,y+52,x,y+cell-52);sh.addColorStop(0,'rgba(0,0,0,.35)');sh.addColorStop(.25,'rgba(0,0,0,0)');sh.addColorStop(1,'rgba(255,230,170,.15)');g.fillStyle=sh;g.fillRect(x+52,y+52,cell-104,cell-104);
    if(M.rosette){g.save();g.beginPath();const r=(cell-120)/2,cx=x+cell/2,cy=y+cell/2;for(let k=0;k<8;k++){const a=Math.PI/8+k*Math.PI/4;g.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r)}g.closePath();g.clip();
      g.filter=red?'hue-rotate(-12deg) saturate(1.1)':'none';g.drawImage(M.rosette,cx-r*1.25,cy-r,r*2.5,r*2);g.restore();g.filter='none'}
    // egg-and-dart hint: small gold beads round the panel
    g.fillStyle='rgba(255,226,150,.7)';for(let k=0;k<24;k++){const t=k/24;for(const [px,py] of [[x+44+t*(cell-88),y+44],[x+44+t*(cell-88),y+cell-44],[x+44,y+44+t*(cell-88)],[x+cell-44,y+44+t*(cell-88)]]){g.beginPath();g.arc(px,py,3,0,7);g.fill()}}
  }
  return c}
// gold frieze with Latin inscription (dark letters on gold mosaic, as in the nave)
export function frieze(text,{w=4096,h=160,ink='#20305a',gold=['#d9b25a','#b98a32']}={}){const [c,g]=cv(w,h);
  const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,gold[0]);gr.addColorStop(1,gold[1]);g.fillStyle=gr;g.fillRect(0,0,w,h);
  for(let i=0;i<3000;i++){g.fillStyle=`rgba(255,240,190,${rnd()*.18})`;g.fillRect(rnd()*w,rnd()*h,4,4)} // mosaic tesserae glitter
  g.fillStyle=ink;g.font=`bold ${h*.62}px "Times New Roman",Georgia,serif`;g.textBaseline='middle';
  const tw=g.measureText(text).width,sp=(w-tw)/Math.max(1,text.length);let x=sp/2;
  for(const ch of text){g.fillText(ch,x,h*.53);x+=g.measureText(ch).width+sp}
  g.fillStyle='rgba(80,50,20,.6)';g.fillRect(0,0,w,6);g.fillRect(0,h-6,w,6);return c}
// floor: white marble slabs (2 m) with thin grey joints
export function floorBase(M){const S=1024,[c,g]=cv(S,S);
  for(let i=0;i<2;i++)for(let j=0;j<2;j++){g.save();g.beginPath();g.rect(i*S/2,j*S/2,S/2,S/2);g.clip();g.fillStyle=marble(g,M.white,1.6,(i+j)%2?90:0);g.fillRect(i*S/2,j*S/2,S/2,S/2);
    g.fillStyle=`rgba(255,250,240,${.05+rnd()*.08})`;g.fillRect(i*S/2,j*S/2,S/2,S/2);g.restore()}
  g.strokeStyle='rgba(110,110,110,.45)';g.lineWidth=3;for(let k=0;k<=2;k++){g.beginPath();g.moveTo(k*S/2,0);g.lineTo(k*S/2,S);g.stroke();g.beginPath();g.moveTo(0,k*S/2);g.lineTo(S,k*S/2);g.stroke()}
  return c}
// one nave bay's central inlay (10 m x 20 m): coloured marble panels like the real nave pavement
export function naveInlay(M,variant=0){const W=1024,H=2048,[c,g]=cv(W,H),k=W/10; // k px per metre
  const rect=(x,y,w,h,img,rot=0,sc=1.2)=>{g.fillStyle=marble(g,img,sc,rot);g.fillRect(x*k,y*k,w*k,h*k)};
  const line=(x,y,w,h,col='#f4efe6')=>{g.fillStyle=col;g.fillRect(x*k,y*k,w*k,h*k)};
  rect(0,0,10,20,M.grey,0,1.4); line(.25,.25,9.5,19.5); rect(.45,.45,9.1,19.1,M.giallo,90,1.3);
  // brown field with a four-pointed star of grey, outlined in white
  rect(1,2.5,8,7,M.brown,0,1.1);
  const star=(cx,cy,R,r)=>{g.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4-Math.PI/2,rr=i%2?r:R;g.lineTo((cx+Math.cos(a)*rr*(i%4===2||i%4===0?.9:1.25))*k,(cy+Math.sin(a)*rr)*k)}g.closePath()};
  g.save();star(5,6,3.3,1.0);g.lineWidth=.35*k;g.strokeStyle='#f4efe6';g.stroke();g.clip();rect(0,0,10,20,M.grey,30,1.2);g.restore();
  // verde squares in the corners
  for(const [x,y] of [[1.2,.9],[7.4,.9],[1.2,10.6],[7.4,10.6]])rect(x,y,1.4,1.2,M.verde,variant*30,1);
  // lower panel: rectangle frame and roundel of red marble
  rect(1,12.2,8,6.8,M.grey,0,1.3);line(1.4,12.6,7.2,6,'#f4efe6');rect(1.6,12.8,6.8,5.6,M.brown,90,1);
  g.save();g.beginPath();g.arc(5*k,15.6*k,2.2*k,0,7);g.fillStyle='#f4efe6';g.fill();g.beginPath();g.arc(5*k,15.6*k,1.9*k,0,7);g.clip();rect(0,12,10,8,M.red,0,1.6);g.fillStyle='rgba(120,20,30,.28)';g.fillRect(0,0,W,H);g.restore();
  return c}
// red porphyry roundel (Rota Porfiretica) near the central door
export function porphyry(M){const S=512,[c,g]=cv(S,S);g.fillStyle='#f0ece4';g.beginPath();g.arc(S/2,S/2,S/2,0,7);g.fill();
  g.save();g.beginPath();g.arc(S/2,S/2,S/2-18,0,7);g.clip();g.fillStyle=marble(g,M.red,1.4,0);g.fillRect(0,0,S,S);g.fillStyle='rgba(110,14,28,.55)';g.fillRect(0,0,S,S);
  for(let i=0;i<1600;i++){g.fillStyle=`rgba(240,200,200,${rnd()*.35})`;g.fillRect(rnd()*S,rnd()*S,1.5,1.5)}g.restore();return c}
// crossing pavement under the dome: concentric rings and rays of coloured marble (40 m across)
export function crossingFloor(M){const S=2048,[c,g]=cv(S,S),k=S/42,C=S/2;
  const ring=(r0,r1,img,rot=0)=>{g.save();g.beginPath();g.arc(C,C,r1*k,0,7);g.arc(C,C,r0*k,0,7,true);g.clip();g.fillStyle=marble(g,img,1.5,rot);g.fillRect(0,0,S,S);g.restore()};
  ring(19.2,20.6,M.grey);ring(18.8,19.2,M.white);ring(17.4,18.8,M.brown);ring(17,17.4,M.white);
  // 16 rays echoing the 16 ribs of the dome
  for(let i=0;i<16;i++){const a=i*Math.PI/8;g.save();g.beginPath();g.moveTo(C+Math.cos(a-.035)*9.5*k,C+Math.sin(a-.035)*9.5*k);g.lineTo(C+Math.cos(a)*16.8*k,C+Math.sin(a)*16.8*k);g.lineTo(C+Math.cos(a+.035)*9.5*k,C+Math.sin(a+.035)*9.5*k);g.closePath();g.clip();g.fillStyle=marble(g,i%2?M.grey:M.giallo,1.2,a*57);g.fillRect(0,0,S,S);g.restore()}
  ring(9,9.5,M.grey);ring(8.6,9,M.white);
  const a=g.getImageData(0,0,S,S);return c}
// the dove of the Holy Spirit in a glory of rays (canopy underside of the baldacchino), drawn as simple ornament
export function glory(){const S=512,[c,g]=cv(S,S),C=S/2;g.fillStyle='#4a3216';g.fillRect(0,0,S,S);
  for(let i=0;i<48;i++){const a=i*Math.PI/24;g.strokeStyle=i%2?'#e7c46a':'#b88c34';g.lineWidth=i%2?6:3;g.beginPath();g.moveTo(C+Math.cos(a)*40,C+Math.sin(a)*40);g.lineTo(C+Math.cos(a)*(i%2?240:200),C+Math.sin(a)*(i%2?240:200));g.stroke()}
  const gr=g.createRadialGradient(C,C,5,C,C,70);gr.addColorStop(0,'#fff6d8');gr.addColorStop(1,'rgba(255,220,140,0)');g.fillStyle=gr;g.beginPath();g.arc(C,C,70,0,7);g.fill();
  g.fillStyle='#fffdf5';g.beginPath();g.ellipse(C,C,10,26,0,0,7);g.fill();g.beginPath();g.moveTo(C,C-6);g.quadraticCurveTo(C-60,C-30,C-92,C+4);g.quadraticCurveTo(C-50,C+2,C,C+8);g.fill();
  g.beginPath();g.moveTo(C,C-6);g.quadraticCurveTo(C+60,C-30,C+92,C+4);g.quadraticCurveTo(C+50,C+2,C,C+8);g.fill();g.beginPath();g.arc(C,C-30,8,0,7);g.fill();return c}
// gilded bronze helix stripes for the Solomonic columns (u = around, v = up)
export function columnBronze(){const W=256,H=1024,[c,g]=cv(W,H);g.fillStyle='#2b1d12';g.fillRect(0,0,W,H);
  for(let i=0;i<9000;i++){g.fillStyle=`rgba(${70+rnd()*40|0},${45+rnd()*25|0},${20+rnd()*15|0},.5)`;g.fillRect(rnd()*W,rnd()*H,2,2)}
  // upper two thirds: gilded laurel sprays; lower third: gilded spiral fluting
  g.strokeStyle='#d6a743';for(let y=0;y<H*.66;y+=6){if(rnd()<.55)continue;const x=rnd()*W;g.lineWidth=1+rnd()*2.5;g.beginPath();g.ellipse(x,y,6+rnd()*6,2+rnd()*2,rnd()*3,0,7);g.stroke()}
  g.fillStyle='rgba(214,167,67,.85)';for(let k=0;k<6;k++){const x=k*W/6;g.fillRect(x,H*.67,W/24,H*.33)}
  g.fillStyle='#c99a3e';g.fillRect(0,H*.655,W,10);return c}
export function gradientBeam(){const [c,g]=cv(64,256);const gr=g.createLinearGradient(0,0,0,256);gr.addColorStop(0,'rgba(255,236,190,1)');gr.addColorStop(.6,'rgba(255,226,170,.45)');gr.addColorStop(1,'rgba(255,220,160,0)');g.fillStyle=gr;g.fillRect(0,0,64,256);
  const s=g.createLinearGradient(0,0,64,0);s.addColorStop(0,'rgba(0,0,0,1)');s.addColorStop(.5,'rgba(0,0,0,0)');s.addColorStop(1,'rgba(0,0,0,1)');g.globalCompositeOperation='destination-out';g.fillStyle=s;g.fillRect(0,0,64,256);return c}
export function glowSprite(col='255,214,130'){const [c,g]=cv(128,128);const gr=g.createRadialGradient(64,64,2,64,64,64);gr.addColorStop(0,`rgba(${col},1)`);gr.addColorStop(.3,`rgba(${col},.45)`);gr.addColorStop(1,`rgba(${col},0)`);g.fillStyle=gr;g.fillRect(0,0,128,128);return c}
export function hotspot(){const [c,g]=cv(128,128);g.fillStyle='rgba(30,18,8,.55)';g.beginPath();g.arc(64,64,40,0,7);g.fill();g.strokeStyle='#ffd98a';g.lineWidth=7;g.beginPath();g.arc(64,64,40,0,7);g.stroke();
  g.fillStyle='#ffe9b8';g.font='bold 56px Georgia,serif';g.textAlign='center';g.textBaseline='middle';g.fillText('i',64,68);return c}
// carved relief panel at the back of a relic loggia: two angels' wings round an oval cartouche, drawn as shallow marble relief (ornament only)
export function reliefPanel(M){const W=512,H=840,[c,g]=cv(W,H);g.drawImage(travertine(M,{joints:false,size:1024,tint:'rgba(236,226,206,.45)'}),0,0,W,H);
  const sh=(f)=>{g.save();g.translate(4,6);g.fillStyle='rgba(60,45,30,.35)';f();g.restore();g.fillStyle='rgba(255,252,244,.55)';f()};
  // oval cartouche with gilded rim
  sh(()=>{g.beginPath();g.ellipse(W/2,H*.42,W*.2,H*.16,0,0,7);g.fill()});
  g.lineWidth=10;g.strokeStyle='#c9a24e';g.beginPath();g.ellipse(W/2,H*.42,W*.2,H*.16,0,0,7);g.stroke();
  g.fillStyle='rgba(70,52,34,.55)';g.beginPath();g.ellipse(W/2,H*.42,W*.15,H*.12,0,0,7);g.fill();
  // wings of the two angels on either side (feathered arcs)
  for(const s of [-1,1])for(let i=0;i<9;i++){const a=-.9+i*.2;sh(()=>{g.beginPath();g.ellipse(W/2+s*W*.32,H*.38+i*H*.025,W*.16-i*4,H*.03,s*a,0,7);g.fill()})}
  // drapery folds below
  for(let i=0;i<7;i++)sh(()=>{g.beginPath();g.moveTo(W*.2+i*W*.1,H*.62);g.quadraticCurveTo(W*.25+i*W*.1,H*.75,W*.18+i*W*.1,H*.92);g.lineTo(W*.22+i*W*.1,H*.92);g.quadraticCurveTo(W*.29+i*W*.1,H*.75,W*.24+i*W*.1,H*.62);g.fill()});
  // shadowed edge of the recess
  const gr=g.createLinearGradient(0,0,W,0);gr.addColorStop(0,'rgba(0,0,0,.35)');gr.addColorStop(.12,'rgba(0,0,0,0)');gr.addColorStop(.88,'rgba(0,0,0,0)');gr.addColorStop(1,'rgba(0,0,0,.35)');g.fillStyle=gr;g.fillRect(0,0,W,H);
  const gt=g.createLinearGradient(0,0,0,H);gt.addColorStop(0,'rgba(0,0,0,.4)');gt.addColorStop(.15,'rgba(0,0,0,0)');g.fillStyle=gt;g.fillRect(0,0,W,H);return c}
