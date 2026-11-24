// St Peter's Basilica interior, in metres. Origin: centre of the crossing at floor level; +z towards the entrance, -z towards the apse.
import * as THREE from 'three';
import * as T from './textures.js?v=57';
const V=(x,y,z)=>new THREE.Vector3(x,y,z),PI=Math.PI;
export const D={NHW:13,ENTR:126,CROSS:20.75,PIER:31,BAY:23.75,ARCH_HW:6.5,ARCH_SPR:15,SPR:33.5,DOME_R:20.75,APSE_C:-47,TRANS_C:55.5,AISLE0:19,AISLE1:31,AISLE_H:22};
export const archCentres=[0,1,2,3].map(k=>D.PIER+D.BAY*(k+.5));
// photo camera fitted to "Vatikan Petersdom 045.jpg" (B. Mücke, CC BY-SA 4.0) so its pixels can be projected onto the dome, drum and pendentives
const PC={zc:20.9881,h:1.6,a:1.1763,f:3704.19,yaw:0.0879,cx:1835.83,cy:2849.43,k1:0.2922,W:3840,H:5760};
function photoUV(x,y,z){const X=x,Y=y-PC.h,Z=z-PC.zc,cy=Math.cos(PC.yaw),sy=Math.sin(PC.yaw),x2=cy*X-sy*Z,z2=sy*X+cy*Z,ca=Math.cos(PC.a),sa=Math.sin(PC.a);
  const fw=Y*sa-z2*ca,up=Y*ca+z2*sa,u=x2/fw,w=up/fw,d=1+PC.k1*(u*u+w*w);const corr=82*Math.min(1,Math.max(0,(y-50)/58)); // residual of the fit at the oculus
  return [(PC.cx+PC.f*u*d-corr)/PC.W,1-(PC.cy-PC.f*w*d)/PC.H]}
// parametric surface helper: fn(u,v)->Vector3, uv = (u*su, v*sv)
function surf(fn,nu,nv,su=1,sv=1){const p=[],uv=[],idx=[];for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){const u=i/nu,v=j/nv,q=fn(u,v);p.push(q.x,q.y,q.z);uv.push(u*su,v*sv)}
  for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=j*(nu+1)+i,b=a+1,c=a+nu+1,d=c+1;idx.push(a,c,b,b,c,d)}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g}
// project photo UVs per triangle; rot180: copy the well-seen far half of the dome onto the near half (the dome is 16-fold symmetric)
function projectUV(g,rot180){g=g.toNonIndexed();const P=g.attributes.position,uv=new Float32Array(P.count*2);
  for(let t=0;t<P.count;t+=3){let cx=0,cz=0;for(let k=0;k<3;k++){cx+=P.getX(t+k);cz+=P.getZ(t+k)}const near=rot180&&cz>0;
    for(let k=0;k<3;k++){let x=P.getX(t+k),z=P.getZ(t+k);if(near){x=-x;z=-z}const [u,v]=photoUV(x,P.getY(t+k),z);uv[(t+k)*2]=u;uv[(t+k)*2+1]=v}}
  g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.computeVertexNormals();return g}
// The near pair of pendentives is a 180° copy of the far pair, which would repeat two Evangelists. Triangles of the near copies that fall
// inside a far medallion are split off and re-mapped onto a separate photo of the right Evangelist (ellipse-to-ellipse in photo pixels).
const MED=[ // far medallion in "Vatikan Petersdom 045": centre and inner radii (px); replacement photo: centre and radii as fractions
  {c:[3221,4469],r:[341,319],src:{c:[.479,.528],r:[.215,.258]},name:'Mark'},   // near-left copy of far-right (St John) -> St Mark
  {c:[538,4392],r:[288,360],src:{c:[.479,.526],r:[.278,.297]},name:'Matthew'}]; // near-right copy of far-left (St Luke) -> St Matthew
function medSplit(g,k=1.45){const P=g.attributes.position,U=g.attributes.uv,keep=[],parts=MED.map(()=>[]);
  for(let t=0;t<P.count;t+=3){let cz=0,pu=0,pv=0;for(let j=0;j<3;j++){cz+=P.getZ(t+j);pu+=U.getX(t+j);pv+=U.getY(t+j)}const px=pu/3*PC.W,py=(1-pv/3)*PC.H;let hit=-1;
    if(cz>0)MED.forEach((m,i)=>{const nx=(px-m.c[0])/m.r[0],ny=(py-m.c[1])/m.r[1];if(nx*nx+ny*ny<k*k)hit=i});(hit<0?keep:parts[hit]).push(t)}
  const build=(tris,map)=>{const p=new Float32Array(tris.length*9),uv=new Float32Array(tris.length*6);tris.forEach((t,n)=>{for(let j=0;j<3;j++){p.set([P.getX(t+j),P.getY(t+j),P.getZ(t+j)],(n*3+j)*3);
      const [a,b]=map(U.getX(t+j),U.getY(t+j));uv[(n*3+j)*2]=a;uv[(n*3+j)*2+1]=b}});const o=new THREE.BufferGeometry();o.setAttribute('position',new THREE.BufferAttribute(p,3));o.setAttribute('uv',new THREE.BufferAttribute(uv,2));o.computeVertexNormals();return o};
  return {main:build(keep,(a,b)=>[a,b]),meds:parts.map((tr,i)=>{const m=MED[i];return build(tr,(a,b)=>{const nx=(a*PC.W-m.c[0])/m.r[0],ny=((1-b)*PC.H-m.c[1])/m.r[1];return [m.src.c[0]+nx*m.src.r[0],1-(m.src.c[1]+ny*m.src.r[1])]})})}}
// a vertical planar shape in world space: pts are [s,y] in the plane; map(s,y)->Vector3. UVs in metres / tile.
function wallShape(outer,holes,map,tile=[4,4]){const sh=new THREE.Shape(outer.map(([a,b])=>new THREE.Vector2(a,b)));
  for(const h of holes)sh.holes.push(new THREE.Path(h.map(([a,b])=>new THREE.Vector2(a,b))));
  const g=new THREE.ShapeGeometry(sh,24),P=g.attributes.position,U=g.attributes.uv;
  for(let i=0;i<P.count;i++){const s=P.getX(i),y=P.getY(i),q=map(s,y);P.setXYZ(i,q.x,q.y,q.z);U.setXY(i,s/tile[0],y/tile[1])}
  g.computeVertexNormals();return g}
const archPts=(c,hw,spr,y0=0,n=20)=>{const a=[[c-hw,y0]];for(let i=0;i<=n;i++){const t=PI-i*PI/n;a.push([c+Math.cos(t)*hw,spr+Math.sin(t)*hw])}a.push([c+hw,y0]);return a};
const ell=(cx,cz,rx,rz,n=40)=>{const a=[];for(let i=0;i<n;i++){const t=i/n*2*PI;a.push([cx+Math.cos(t)*rx,cz+Math.sin(t)*rz])}return a};
const archOutline=(hw,spr,top)=>{const a=[[-hw,0],[hw,0]];for(let i=0;i<=24;i++){const t=i*PI/24;a.push([Math.cos(t)*hw,spr+Math.sin(t)*hw])}return a}; // section of a vaulted arm, counter-clockwise

export class Basilica{
  constructor(scene,renderer,{mobile,onProgress}={}){this.s=scene;this.r=renderer;this.mobile=mobile;this.casters=[];this.hot=[];this.windows=[];this.onProgress=onProgress||(()=>{})}
  async build(){
    const L=async n=>T.loadImg('assets/tex/'+n);
    const names=['m_white.jpg','m_grey.jpg','m_brown.jpg','m_verde.jpg','m_giallo.jpg','m_red.jpg','rosette.jpg'];
    const im=await Promise.all(names.map(L));const M=this.M={white:im[0],grey:im[1],brown:im[2],verde:im[3],giallo:im[4],red:im[5],rosette:im[6]};
    this.onProgress('Marble and gold…');
    const an=this.r.capabilities.getMaxAnisotropy();
    const std=(map,o={})=>new THREE.MeshStandardMaterial(Object.assign({map,roughness:.62,metalness:0,side:THREE.DoubleSide},o));
    this.mat={
      trav:std(T.tex(T.travertine(M),{aniso:an})),
      travWarm:std(T.tex(T.travertine(M,{tint:'rgba(232,200,150,.5)'}),{aniso:an})),
      flute:std(T.tex(T.fluted(M),{aniso:an})),
      coffer:(()=>{const c=T.coffers(M),t=T.tex(c,{aniso:an}),b=T.tex(c,{srgb:false});return std(t,{roughness:.5,metalness:.2,bumpMap:b,bumpScale:4})})(),
      cofferRed:std(T.tex(T.coffers(M,{red:true}),{aniso:an}),{roughness:.5,metalness:.15}),
      floor:new THREE.MeshStandardMaterial({map:T.tex(T.floorBase(M),{aniso:an}),roughness:.16,metalness:0}),
      gold:new THREE.MeshStandardMaterial({color:0xe0b45a,metalness:1,roughness:.26}),
      bronze:new THREE.MeshStandardMaterial({color:0x4a3524,metalness:.9,roughness:.34}),
      dark:std(null,{color:0x2a1e16,roughness:.8}),
      marbleW:new THREE.MeshStandardMaterial({color:0xf2ede4,roughness:.2}),
    };
    // one shared atlas: nave south, nave north, dome drum, apse Latin, blank (transepts — wording not assigned; left/right sources conflict)
    this.friezeRows=[
      {text:'EGO ROGAVI PRO TE O PETRE VT NON DEFICIAT FIDES TVA ET TV ALIQVANDO CONVERSVS CONFIRMA FRATRES TVOS',ink:'#1c1a16',fit:'spread'},
      {text:'QVODCVMQVE LIGAVERIS SVPER TERRAM ERIT LIGATVM ET IN COELIS ET QVODCVMQVE SOLVERIS SVPER TERRAM ERIT SOLVTVM ET IN COELIS',ink:'#1c1a16',fit:'spread'},
      {text:'TV ES PETRVS ET SVPER HANC PETRAM AEDIFICABO ECCLESIAM MEAM ET TIBI DABO CLAVES REGNI CAELORVM ·',ink:'#1a2a6a',fit:'spread'},
      {text:'O PASTOR ECCLESIAE TV OMNES CHRISTI PASCIS AGNOS ET OVES',ink:'#1c1a16',fit:'left'},
      {text:''}
    ];
    this.friezeN=this.friezeRows.length;
    this.friezeTex=T.tex(T.friezeAtlas(this.friezeRows,{w:this.mobile?2048:4096,rowH:this.mobile?64:128}),{aniso:an});
    this.friezeTex.wrapT=THREE.ClampToEdgeWrapping;
    this.friezeMat=()=>new THREE.MeshStandardMaterial({map:this.friezeTex,roughness:.4,metalness:.28,emissive:0x3a2a10,emissiveIntensity:.12,side:THREE.DoubleSide});
    this._floor();this._nave();this._aisles();this._crossing();this._arms();
    this.onProgress('Michelangelo’s dome…');
    const LS=n=>T.loadImg('assets/statues/'+n);
    const [dome,apse,entr,panel,lanternGod]=await Promise.all(['dome.jpg','apse.jpg','entrance.jpg','pier_panel.jpg','lantern_god.jpg'].map(L));this._niches();
    this.medImgs=await Promise.all(['ev_mark.jpg','ev_matthew.jpg'].map(L));this.medCol=[[1.5,1.36,1.16],[1.5,1.36,1.16]];
    {const names=[...new Set((this.domes||[]).map(d=>d.img).filter(Boolean))],ims=await Promise.all(names.map(L)),o={};
     names.forEach((n,i)=>{if(ims[i])o[n]=T.tex(ims[i],{wrap:false,aniso:this.r.capabilities.getMaxAnisotropy()})});this._smallDomes(o);}
    {const A={sacr:['alt_sacr.jpg',[0,0,1,1],[1.15,1.1,1.05]],greg:['alt_greg.jpg',[0,0,1,1]],clem:['alt_clem.jpg',[0,0,1,1]]},ks=Object.keys(A),ims=await Promise.all(ks.map(k=>L(A[k][0]))),o={};
     ks.forEach((k,i)=>{if(ims[i])o[k]={img:ims[i],crop:A[k][1],col:A[k][2]}});this._altars(o);}
    {const A=['transfig','jerome','sebastian','baptism','choir','present','leo','alex7','clem13','pius7'],ims=await Promise.all(A.map(k=>L('art_'+k+'.jpg'))),o={};A.forEach((k,i)=>{if(ims[i])o[k]=ims[i]});this._artworks(o);}
    this._dome(dome,lanternGod);this._apsePhoto(apse);this._entrance();this._piers(panel);
    this._baldacchino();this._confessio();this._peter();
    this.onProgress('The statues…');
    await Promise.all([this._statues(),this._saints()]);
    this.onProgress('The Pietà…');
    await this._pieta();
    this._beams();
  }
  add(g,m,{cast=false,recv=true}={}){const o=new THREE.Mesh(g,m);o.castShadow=cast;o.receiveShadow=recv;this.s.add(o);if(cast)this.casters.push(o);return o}
  box(w,h,d,x,y,z,m,o){const b=this.add(new THREE.BoxGeometry(w,h,d),m,o);b.position.set(x,y,z);return b}
  // ---------- floor ----------
  _floor(){const M=this.M;
    const sh=new THREE.Shape([V(-72,-64),V(72,-64),V(72,130),V(-72,130)].map(v=>new THREE.Vector2(v.x,v.y)));
    // confessio opening in front of the altar (horseshoe)
    const h=new THREE.Path();h.moveTo(-5.2,3.2);h.lineTo(-5.2,9.5);h.absarc(0,9.5,5.2,PI,0,true);h.lineTo(5.2,3.2);h.lineTo(-5.2,3.2);sh.holes.push(h);
    const g=new THREE.ShapeGeometry(sh,32),P=g.attributes.position,U=g.attributes.uv;
    for(let i=0;i<P.count;i++){const x=P.getX(i),z=P.getY(i);P.setXYZ(i,x,0,z);U.setXY(i,x/4,z/4)}g.computeVertexNormals();
    const f=this.add(g,this.mat.floor);f.material.side=THREE.DoubleSide;
    // decals: nave bay inlays, porphyry roundel, crossing rings
    const dec=(c,w,d,x,z,rot=0,o={})=>{const m=new THREE.MeshStandardMaterial(Object.assign({map:T.tex(c,{wrap:false}),roughness:.16,transparent:true,polygonOffset:true,polygonOffsetFactor:-2},o));
      const q=this.add(new THREE.PlaneGeometry(w,d).rotateX(-PI/2),m);q.position.set(x,.005,z);q.rotation.y=rot;return q};
    const inlay=[T.naveInlay(M,0),T.naveInlay(M,1)];
    archCentres.forEach((zc,k)=>dec(inlay[k%2],10,20,0,zc,k%2?PI:0));
    dec(T.porphyry(M),2.6,2.6,0,122.4);
    dec(T.crossingFloor(M),42,42,0,0,0);
    // aisles: grey bands under each arcade
    for(const s of [-1,1])archCentres.forEach(zc=>dec(T.naveInlay(M,2),5,9,s*25,zc,0,{opacity:.9}));
  }
  // map a 0–1 uv mesh onto one row of the inscription atlas (optional u-range for a continuous run)
  _friezeUV(geo,row,u0=0,u1=1,flipU=false){const U=geo.attributes.uv,n=this.friezeN,v0=(n-row-1)/n,v1=(n-row)/n,pad=(v1-v0)*.08;
    for(let i=0;i<U.count;i++){const u=U.getX(i),v=U.getY(i);U.setXY(i,u0+(flipU?1-u:u)*(u1-u0),v0+pad+v*(v1-v0-2*pad))}U.needsUpdate=true;return geo}
  // semicircular barrel: spring line exactly on the entablature top (y = SPR), radius the nave half-width
  // so the vault meets the wall and the crossing arch with no gap. Coffers: 4 along each bay, 7 across the arc.
  _barrelGeo(z0,z1){const {NHW,SPR,PIER,BAY}=D,R=NHW,y0=SPR;
    const g=surf((u,v)=>V(Math.cos(u*PI)*R,y0+Math.sin(u*PI)*R,z0+v*(z1-z0)),72,64);
    const P=g.attributes.position,U=g.attributes.uv;
    for(let i=0;i<P.count;i++){const x=P.getX(i),z=P.getZ(i),u=Math.acos(Math.max(-1,Math.min(1,x/R)))/PI;
      U.setXY(i,u*3.5,(z-PIER)/BAY*2)}
    U.needsUpdate=true;g.computeVertexNormals();return g}
  _vaultRib(z){const {NHW,SPR}=D,R=NHW-.05,y0=SPR,h=1.3;
    const g=surf((u,v)=>V(Math.cos(u*PI)*R,y0+Math.sin(u*PI)*R,z-h+v*2*h),72,2);
    const U=g.attributes.uv;for(let i=0;i<U.count;i++)U.setXY(i,U.getX(i)*3.5,.02+U.getY(i)*.045);U.needsUpdate=true;return g}
  // ---------- nave: arcades, pilasters, entablature, coffered barrel vault, lunette windows ----------
  _nave(){const {NHW,ENTR,PIER,SPR,ARCH_HW,ARCH_SPR}=D,m=this.mat,NY=9.6;
    for(const s of [-1,1]){
      const holes=archCentres.map(zc=>archPts(zc,ARCH_HW,ARCH_SPR));
      for(let k=1;k<4;k++)holes.push(archPts(PIER+D.BAY*k,1.5,NY+4.8,NY,16)); // founder-saint niches
      const outer=[[PIER,0],[ENTR,0],[ENTR,SPR],[PIER,SPR]];
      this.add(wallShape(outer,holes,(a,y)=>V(s*NHW,y,a)),m.trav);
      // arch soffits through the piers (to the aisle) and jambs
      for(const zc of archCentres){
        this.add(surf((u,v)=>V(s*(NHW+v*6),ARCH_SPR+Math.sin(u*PI)*ARCH_HW,zc+Math.cos(u*PI)*ARCH_HW),24,1,3,1),m.cofferRed);
        for(const e of [-1,1])this.add(new THREE.PlaneGeometry(6,ARCH_SPR).translate(0,ARCH_SPR/2,0).rotateY(0),m.trav).position.set(s*(NHW+3),0,zc+e*ARCH_HW);
        // archivolt: gilded moulding round the arch
        const t=new THREE.Mesh(new THREE.TorusGeometry(ARCH_HW+.35,.22,6,32,PI),m.gold);t.rotation.y=PI/2;t.position.set(s*(NHW-.05),ARCH_SPR,zc);this.s.add(t);
      }
      // giant Corinthian pilasters in pairs on every pier, with capitals
      for(let k=0;k<=4;k++){const zp=PIER+D.BAY*k;for(const o of [-3.6,3.6]){const z=zp+o;if(z<PIER+.5||z>ENTR-.5)continue;
        const p=this.box(.5,26,2.3,s*(NHW-.25),13,z,m.flute,{cast:false});
        this.box(.7,1.2,2.7,s*(NHW-.35),.6,z,m.trav);
        const cap=this.box(.9,2.4,2.8,s*(NHW-.45),27.2,z,m.travWarm);
        this.add(new THREE.CylinderGeometry(.75,.45,1.8,12,1,false,0,PI).rotateZ(s>0?PI/2:-PI/2),m.gold).position.set(s*(NHW-.35),26.8,z);}
        // niche with a founder-saint statue between the pilasters (above the arcade, as in the nave piers)
        if(k>0&&k<4){const nm=m.travWarm;this.add(new THREE.CylinderGeometry(1.5,1.5,4.8,20,1,true,0,PI).rotateY(s>0?0:PI),nm).position.set(s*NHW,NY+2.4,zp);
          this.add(new THREE.SphereGeometry(1.5,20,8,PI/2,PI,0,PI/2).rotateY(s>0?0:PI),nm).position.set(s*NHW,NY+4.8,zp);
          this.add(new THREE.PlaneGeometry(1.5,3).rotateX(-PI/2),nm).position.set(s*(NHW+.75),NY,zp);
          this.box(.3,.3,3.4,s*(NHW-.1),NY-.15,zp,m.travWarm);this.add(new THREE.TorusGeometry(1.62,.1,6,24,PI).rotateY(PI/2),m.gold).position.set(s*(NHW-.02),NY+4.8,zp);
          (this.saintSpots=this.saintSpots||[]).push([V(s*(NHW+.2),NY,zp),s>0?-PI/2:PI/2])}}
      // entablature: architrave, inscribed frieze, cornice
      this.box(1.2,1.4,ENTR-PIER,s*(NHW-.6),28.7,(ENTR+PIER)/2,m.travWarm);
      const fr=this.add(this._friezeUV(new THREE.PlaneGeometry(ENTR-PIER,1.7),s>0?1:0),this.friezeMat());
      fr.rotation.y=s>0?-PI/2:PI/2;fr.position.set(s*(NHW-1.21),30.3,(ENTR+PIER)/2);
      this.box(1.25,.1,ENTR-PIER,s*(NHW-.6),29.4,(ENTR+PIER)/2,m.gold);
      this.box(2.0,1.4,ENTR-PIER,s*(NHW-1.0),32.4,(ENTR+PIER)/2,m.travWarm,{cast:false});
      this.box(2.3,.4,ENTR-PIER,s*(NHW-1.15),33.3,(ENTR+PIER)/2,m.gold);
    }
    // barrel vault springs on the cornice; coffers and transverse ribs register to the pilasters
    this.add(this._barrelGeo(PIER,ENTR),m.coffer);
    for(let k=1;k<=3;k++)this.add(this._vaultRib(PIER+D.BAY*k),m.cofferRed);
  }
  _window(p,w,h,rot,arched){ // bright glass (blooms) in a stucco frame
    const sh=new THREE.Shape();sh.moveTo(-w/2,-h/2);sh.lineTo(w/2,-h/2);if(arched){sh.lineTo(w/2,h/2-w/2);sh.absarc(0,h/2-w/2,w/2,0,PI,false)}else sh.lineTo(w/2,h/2),sh.lineTo(-w/2,h/2);sh.lineTo(-w/2,-h/2);
    const m=new THREE.MeshBasicMaterial({color:new THREE.Color(1.6,1.5,1.32),toneMapped:false,side:THREE.DoubleSide});
    const o=this.add(new THREE.ShapeGeometry(sh,16),m,{recv:false});o.position.copy(p);o.rotation.y=rot;
    // leading (window bars)
    const bars=new THREE.MeshBasicMaterial({color:0x6a6050});for(let i=-2;i<=2;i++){const b=new THREE.Mesh(new THREE.PlaneGeometry(.06,h),bars);b.position.set(i*w/5,0,.02);o.add(b)}
    for(let j=-2;j<=2;j++){const b=new THREE.Mesh(new THREE.PlaneGeometry(w,.06),bars);b.position.set(0,j*h/6,.02);o.add(b)}
    this.windows.push(o);return o}
  // ---------- aisles ----------
  _aisles(){const {AISLE0:A0,AISLE1:A1,AISLE_H:AH,PIER,ENTR,ARCH_HW,ARCH_SPR}=D,m=this.mat;
    for(const s of [-1,1]){
      const holes=archCentres.map(zc=>archPts(zc,ARCH_HW,ARCH_SPR));
      this.add(wallShape([[PIER,0],[ENTR,0],[ENTR,AH],[PIER,AH]],holes,(a,y)=>V(s*A0,y,a)),m.trav);
      // outer wall with chapel arches; the first chapel on the right (s=+1, nearest the door) is the Pietà chapel
      const ch=archCentres.map(zc=>archPts(zc,5,13));
      this.add(wallShape([[PIER,0],[ENTR,0],[ENTR,AH],[PIER,AH]],ch,(a,y)=>V(s*A1,y,a)),m.trav);
      archCentres.forEach((zc,k)=>{const pieta=s>0&&k===3,sacr=s>0&&k===1,deep=pieta||sacr,dep=deep?10:2.2,x1=A1+dep;
        this.add(surf((u,v)=>V(s*(A1+v*dep),13+Math.sin(u*PI)*5,zc+Math.cos(u*PI)*5),20,1,2,1),m.coffer);
        for(const e of [-1,1])this.add(new THREE.PlaneGeometry(dep,13).translate(0,6.5,0),m.trav).position.set(s*(A1+dep/2),0,zc+e*5);
        if(sacr){(this.chapels=this.chapels||[]).push({kind:'sacr',x:s*(x1-.05),z:zc,rot:s>0?-PI/2:PI/2})}
        if(deep){ // chapel back and sides, a small dome above
          this.add(wallShape([[zc-5,0],[zc+5,0],[zc+5,18],[zc-5,18]],[],(a,y)=>V(s*x1,y,a)),m.travWarm);
          this.add(wallShape([[A1,zc-5],[x1,zc-5],[x1,zc+5],[A1,zc+5]],[],(a,b)=>V(s*a,18,b)),m.cofferRed);
          for(const e of [-1,1])this.add(new THREE.PlaneGeometry(dep,5).translate(0,15.5,0),m.trav).position.set(s*(A1+dep/2),0,zc+e*5);
        }else{ // shallow altar recess; its mosaic altarpiece and gilded frame (shaped to the picture) are added in _artworks
          this.add(new THREE.PlaneGeometry(10,18).translate(0,9,0).rotateY(s>0?-PI/2:PI/2),m.travWarm).position.set(s*x1,0,zc);
          this.box(1.2,1.1,3.4,s*(x1-.7),.55,zc,m.marbleW,{cast:true});(this.recess=this.recess||[]).push({s,k,x:s*(x1-.34),z:zc,rot:s>0?-PI/2:PI/2});}
      });
      // Aisle ceilings, from the real Maderno bays: six elliptical cupolas (three per aisle, k=1,2,3)
      // sit on pendentives and a gilt coffered frame, flush at a gold cornice, and are lit by a lantern.
      // The crossing-end bay (k=0) is not one of those six: a plain coffered vault, no invented cupola.
      const ax=(A1-A0)/2, az=7.8, cxAisle=s*(A0+A1)/2;
      this.add(wallShape([[A0,PIER],[A1,PIER],[A1,PIER+D.BAY],[A0,PIER+D.BAY]],[],(a,b)=>V(s*a,AH,b)),m.coffer);
      // hole slightly smaller than the pendentive rectangle so the frame tucks under the coffered slab
      const hx=ax-0.08, hz=az-0.08;
      const rect= (zc)=>[[cxAisle/s-hx,zc-hz],[cxAisle/s+hx,zc-hz],[cxAisle/s+hx,zc+hz],[cxAisle/s-hx,zc+hz]];
      this.add(wallShape([[A0,PIER+D.BAY],[A1,PIER+D.BAY],[A1,ENTR],[A0,ENTR]],archCentres.slice(1).map(rect),(a,b)=>V(s*a,AH,b)),m.coffer);
      // Unique mosaics for the six elliptical aisle cupolas. k=3 is nearest the entrance (Pietà / Baptistery).
      const aisleImgs=s>0?[null,'sd_sacrament.jpg','sd_sebastian.jpg','sd_pieta.jpg']:[null,'sd_choir.jpg','sd_presentation.jpg','sd_baptistery.jpg'];
      const aisleNames=s>0?[null,'sacrament','sebastian','pieta']:[null,'choir','presentation','baptistery'];
      // uvCornice is the gold cornice in the looking-up photo (measured on the crop). frameMap uses the same photo on the pendentives.
      const aisleUV={sacrament:{uvInner:.08,uvCornice:.38,uvFrame:.48,frameMap:true},sebastian:{uvInner:.12,uvCornice:.38,uvFrame:.48,frameMap:false},pieta:{uvInner:.12,uvCornice:.40,uvFrame:.48,frameMap:false},choir:{uvInner:.08,uvCornice:.44,uvFrame:.495,frameMap:true},presentation:{uvInner:.08,uvCornice:.45,uvFrame:.495,frameMap:true},baptistery:{uvInner:.10,uvCornice:.48,uvFrame:.50,frameMap:true}};
      archCentres.forEach((zc,k)=>{if(k===0)return;(this.domes=this.domes||[]).push({cx:cxAisle,cz:zc,rx:5.2,rz:6.4,ax,az,y:AH,img:aisleImgs[k],kind:'oval',name:aisleNames[k],drop:0,rise:2.4,...(aisleUV[aisleNames[k]]||{})})});
      this.add(new THREE.PlaneGeometry(A1-A0,AH).translate(0,AH/2,0),m.trav).position.set(s*(A0+A1)/2,0,ENTR);
      // the aisle ends in an arch into the corner chapel under a minor dome (Gregorian Chapel on the right, Clementine Chapel on the left)
      this.add(wallShape([[A0,0],[A1,0],[A1,AH],[A0,AH]],[archPts((A0+A1)/2,4.6,12.5)],(a,y)=>V(s*a,y,PIER),[4,4]),m.trav);
      this.add(surf((u,v)=>V(s*((A0+A1)/2+Math.cos(u*PI)*4.6),12.5+Math.sin(u*PI)*4.6,PIER-v*1.2),20,1,2,1),m.cofferRed);
      this._cornerChapel(s);this._westCornerChapel(s);
      // piers' aisle-side pilasters
      for(let k=0;k<=4;k++){const z=PIER+D.BAY*k;if(k>0&&k<4)this.box(.4,AH,2.2,s*(A0+.2),AH/2,z,m.flute)}
    }
  }
  // corner chapel (12 m square) at the end of each aisle, against the crossing pier
  _cornerChapel(s){const {AISLE0:A0,AISLE1:A1,AISLE_H:AH,PIER}=D,m=this.mat,Z0=19,cx=s*(A0+A1)/2,cz=(Z0+PIER)/2;
    this.add(new THREE.PlaneGeometry(A1-A0,AH).translate(0,AH/2,0),m.travWarm).position.set(cx,0,Z0);
    for(const x of [A0,A1])this.add(new THREE.PlaneGeometry(PIER-Z0,AH).translate(0,AH/2,0).rotateY(PI/2),m.trav).position.set(s*x,0,cz);
    (this.domes=this.domes||[]).push({cx,cz,rx:5.2,rz:5.2,ax:(A1-A0)/2,az:(A1-A0)/2,y:AH,img:s>0?'sd_greg.jpg':'sd_clem.jpg',kind:'corner',vaultY:42,name:s>0?'gregorian':'clementine',uvInner:.07,uvCornice:.40,uvFrame:.48,frameMap:false});
    // paired pilasters in the corners and a gilded cornice
    for(const x of [A0+.6,A1-.6])this.box(1.0,AH-2,.4,s*x,(AH-2)/2,Z0+.2,m.flute);
    this.box(A1-A0,.6,.6,cx,AH-1.2,Z0+.3,m.travWarm);this.box(A1-A0,.12,.7,cx,AH-.85,Z0+.35,m.gold);
    (this.chapels=this.chapels||[]).push({kind:s>0?'greg':'clem',x:cx,z:Z0+.05,rot:0});
  }
  // western corner chapels against the crossing, between each transept and the apse (Madonna of the Column, south; Sts Michael & Petronilla, north)
  _westCornerChapel(s){const {AISLE0:A0,AISLE1:A1,AISLE_H:AH,PIER}=D,m=this.mat,Z1=-19,cx=s*(A0+A1)/2,cz=(Z1-PIER)/2;
    this.add(new THREE.PlaneGeometry(A1-A0,AH).translate(0,AH/2,0),m.travWarm).position.set(cx,0,Z1);
    for(const x of [A0,A1])this.add(new THREE.PlaneGeometry(PIER+Z1,AH).translate(0,AH/2,0).rotateY(PI/2),m.trav).position.set(s*x,0,cz);
    // Madonna of the Column (south, s=-1) has a Commons looking-up photo. Sts Michael & Petronilla (north) does not: gilt coffers, mosaic unconfirmed.
    // Solid back wall at z=-PIER: there is no west aisle, so an arch here would open to the exterior and leak the walk grid.
    (this.domes=this.domes||[]).push({cx,cz,rx:5.2,rz:5.2,ax:(A1-A0)/2,az:(A1-A0)/2,y:AH,img:s>0?null:'sd_madonna.jpg',kind:'corner',vaultY:42,name:s>0?'petronilla':'madonna',uvInner:.06,uvCornice:.38,uvFrame:.48,frameMap:false});
    for(const x of [A0+.6,A1-.6])this.box(1.0,AH-2,.4,s*x,(AH-2)/2,Z1-.2,m.flute);
    this.box(A1-A0,.6,.6,cx,AH-1.2,Z1-.3,m.travWarm);this.box(A1-A0,.12,.7,cx,AH-.85,Z1-.35,m.gold);
    this.add(new THREE.PlaneGeometry(A1-A0,AH).translate(0,AH/2,0),m.travWarm).position.set(cx,0,-PIER);
  }
  // altarpiece mosaics and papal monuments from openly licensed photos (see ASSETS.md), each in its real place in the plan
  _artworks(im){const m=this.mat,mk=(img,w,h)=>{const t=T.tex(img,{wrap:false});return new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:t,emissiveMap:t,emissive:new THREE.Color(.32,.3,.28),roughness:.55,color:new THREE.Color(1.05,1.03,1)}))};
    const fit=(img,W,H)=>{const a=img.width/img.height;return a>W/H?[W,W/a]:[H*a,H]};
    // aisle altars (mosaic copies of the paintings): left aisle Transfiguration (by the Clementine Chapel) and Baptism (Baptistery), right aisle St Jerome and St Sebastian
    // left aisle also has the Choir Chapel (Immaculate Conception) and the Chapel of the Presentation; arch = arched-top height as a fraction of the picture
    const R={transfig:[-1,0,.229],choir:[-1,1,.316],present:[-1,2,.252],baptism:[-1,3,.317],jerome:[1,0,.299],sebastian:[1,2,.267]};
    const arch=(w,h,a,e=0)=>{const ry=a*h+e,sh=new THREE.Shape();sh.moveTo(-w/2-e,-e);sh.lineTo(w/2+e,-e);sh.lineTo(w/2+e,h-a*h);sh.absellipse(0,h-a*h,w/2+e,ry,0,PI,false);sh.lineTo(-w/2-e,-e);return sh};
    for(const k in R){const img=im[k],r=(this.recess||[]).find(q=>q.s===R[k][0]&&q.k===R[k][1]);if(!r)continue;
      const g=new THREE.Group();g.position.set(r.x,0,r.z);g.rotation.y=r.rot;this.s.add(g);const y0=3.8;
      if(!img){const b=new THREE.Mesh(new THREE.BoxGeometry(3.8,6.4,.25),new THREE.MeshStandardMaterial({color:0x3a2c22,roughness:.5}));b.position.set(0,7,-.14);g.add(b);continue}
      const [w,h]=fit(img,3.8,6.6),a=R[k][2],geo=new THREE.ShapeGeometry(arch(w,h,a),24),P=geo.attributes.position,U=geo.attributes.uv;
      for(let i=0;i<P.count;i++)U.setXY(i,P.getX(i)/w+.5,P.getY(i)/h);
      const o=mk(img,1,1);o.geometry.dispose();o.geometry=geo;o.position.set(0,y0,.02);g.add(o);
      const fs=arch(w,h,a,.22);fs.holes.push(arch(w,h,a,0));const fr=new THREE.Mesh(new THREE.ExtrudeGeometry(fs,{depth:.16,bevelEnabled:false,curveSegments:24}),m.gold);fr.position.set(0,y0,-.06);g.add(fr)}
    // monuments and relief altars as photographed panels set in marble surrounds
    const wall=(k,x,z,rot,H,W=8,ar=0)=>{const img=im[k];if(!img)return;const [w,h]=fit(img,W,H),g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;this.s.add(g);
      const o=mk(img,w,h);if(ar){const geo=new THREE.ShapeGeometry(arch(w,h,ar),24),P=geo.attributes.position,U=geo.attributes.uv;for(let i=0;i<P.count;i++)U.setXY(i,P.getX(i)/w+.5,P.getY(i)/h);geo.translate(0,-h/2,0);o.geometry.dispose();o.geometry=geo}
      o.position.set(0,.6+h/2,.08);g.add(o);
      const f=(bw,bh,bx,by)=>{const b=new THREE.Mesh(new THREE.BoxGeometry(bw,bh,.35),m.travWarm);b.position.set(bx,by,.1);g.add(b)};
      if(ar){const fs=arch(w,h,ar,.45);fs.holes.push(arch(w,h,ar,0));const fr=new THREE.Mesh(new THREE.ExtrudeGeometry(fs,{depth:.35,bevelEnabled:false,curveSegments:24}),m.travWarm);fr.position.set(0,.6,-.08);g.add(fr);f(w+.9,.6,0,.3);return}
      f(w+.9,.45,0,.6+h+.22);f(.45,h+.6,-(w/2+.22),.6+h/2);f(.45,h+.6,w/2+.22,.6+h/2);f(w+.9,.6,0,.3)};
    wall('alex7',-37.7,-12.95,0,9.5,6.4);       // Bernini, south (left) transept passage
    wall('leo',-48.8,-12.95,0,8.6,5.4,.29);         // Algardi's relief, Altar of St Leo the Great
    wall('clem13',37.7,-12.95,0,10,6.4);        // Canova, north (right) transept passage
    wall('pius7',-30.95,25,PI/2,7.5,7);         // Thorvaldsen, Clementine Chapel
  }
  // Minor cupolas as real 3D architecture. Aisle ovals (Maderno): mosaic shell flush with
  // pendentives and a coffered frame at a gold cornice, lit by a 3D lantern — no drum sitting in a flat slab.
  _smallDomes(imgs){(this.domes||[]).forEach(d=>{(d.kind==='corner'?this._cornerMinorDome:this._ovalMinorDome).call(this,d,imgs)});}
  // circular-section gold moulding along an ellipse (a scaled torus stretches the tube and scallops the rim)
  _ellipseMolding(cx,y,cz,rx,rz,tube=.08,seg=48){
    const n=Math.max(64,seg*2);
    if(Math.abs(rx-rz)<.02){const o=new THREE.Mesh(new THREE.TorusGeometry(rx,tube,8,n),this.mat.gold);o.rotation.x=PI/2;o.position.set(cx,y,cz);this.s.add(o);return o}
    const pts=[];for(let i=0;i<n;i++){const t=i/n*2*PI;pts.push(new THREE.Vector3(Math.cos(t)*rx,0,Math.sin(t)*rz))}
    const g=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts,true),n,tube,8,true);
    const o=new THREE.Mesh(g,this.mat.gold);o.position.set(cx,y,cz);this.s.add(o);return o}
  // Planar-from-below UVs. On the cupola, a circle of radius uvCornice is the gold cornice.
  // Outside it, each ray is interpolated from that circle to a rectangular frame of half-size uvFrame,
  // so the pendentive photograph stays unsmeared when the frame sits in the vault plane.
  _vaultUV(g,d,rOcc){const inner=d.uvInner??.08,corn=d.uvCornice??(d.uvOuter??.34),frame=d.uvFrame??.48;
    const P=g.attributes.position,U=g.attributes.uv,prOcc=rOcc/Math.min(d.rx,d.rz);
    const ax=d.ax||d.rx*1.15,az=d.az||d.rz*1.15,AX=ax/d.rx,AZ=az/d.rz;
    for(let k=0;k<P.count;k++){const sx=(P.getX(k)-d.cx)/d.rx,sz=(P.getZ(k)-d.cz)/d.rz,pr=Math.hypot(sx,sz)||1e-6;
      const c=sx/pr,s=sz/pr;
      if(pr<=1){const texR=inner+(corn-inner)*(pr-prOcc)/Math.max(1e-6,1-prOcc);U.setXY(k,.5+texR*c,.5+texR*s)}
      else{const rMax=1/Math.max(Math.abs(c)/AX,Math.abs(s)/AZ,1e-6),v=(pr-1)/Math.max(1e-6,rMax-1);
        const iU=corn*c,iV=corn*s,kR=1/Math.max(Math.abs(c)/frame,Math.abs(s)/frame,1e-6);
        U.setXY(k,.5+iU+v*(kR*c-iU),.5+iV+v*(kR*s-iV))}}
    U.needsUpdate=true;return g}
  _ovalBayPendentives(d,imgs){const seg=this.mobile?28:40,ax=d.ax||6,az=d.az||7.8,drop=d.drop??0,y=d.y;
    const eC=(ax/d.rx)**2+(az/d.rz)**2,y0=y-0.02;
    const g=surf((u,v)=>{const t=u*2*PI,AX=ax/d.rx,AZ=az/d.rz;
      const rMax=1/Math.max(Math.abs(Math.cos(t)/AX),Math.abs(Math.sin(t)/AZ),1e-6),rr=1+(rMax-1)*v;
      const X=Math.cos(t)*rr,Z=Math.sin(t)*rr,e=X*X+Z*Z,yP=y0-drop*Math.max(0,e-1)/Math.max(1e-6,eC-1);
      return V(d.cx+X*d.rx,yP,d.cz+Z*d.rz)},seg,8);
    const map=d.frameMap&&d.img&&imgs[d.img];
    if(map)this._vaultUV(g,d,d.rOcc||1.05);
    else{const P=g.attributes.position,U=g.attributes.uv;for(let k=0;k<P.count;k++)U.setXY(k,P.getX(k)/4,P.getZ(k)/4);U.needsUpdate=true}
    const mat=map?new THREE.MeshStandardMaterial({map,roughness:.55,metalness:.05,side:THREE.DoubleSide}):new THREE.MeshStandardMaterial({map:T.tex(T.coffers(this.M,{red:false})),roughness:.45,metalness:.15,side:THREE.DoubleSide});
    this.add(g,mat,{recv:true})}
  // Shallow elliptical cap whose rim lies in the vault plane. The real aisle cupolas are saucers in
  // the ceiling, not half-ellipsoids standing on their equator (which left the gold ring floating).
  _ovalMinorDome(d,imgs){const seg=this.mobile?32:48,H=d.rise||2.4,rOcc=d.rOcc||1.05,y=d.y;
    this._ovalBayPendentives(d,imgs);
    this._ellipseMolding(d.cx,y+0.05,d.cz,d.rx,d.rz,.07,seg);
    const rMin=Math.min(d.rx,d.rz),prOcc=rOcc/rMin,Rs=(rMin*rMin+H*H)/(2*H);
    const g=surf((u,v)=>{const a=u*2*PI,pr=1-(1-prOcc)*v,rho=pr*rMin,h=Math.sqrt(Math.max(0,Rs*Rs-rho*rho))-(Rs-H);
      return V(d.cx+Math.cos(a)*d.rx*pr,y+h,d.cz+Math.sin(a)*d.rz*pr)},seg,12);
    this._vaultUV(g,d,rOcc);
    const map=d.img&&imgs[d.img],mat=map?new THREE.MeshStandardMaterial({map,roughness:.55,metalness:.05,side:THREE.DoubleSide}):new THREE.MeshStandardMaterial({map:T.tex(T.minorCoffers()),roughness:.4,metalness:.25,side:THREE.DoubleSide});
    this.add(g,mat,{recv:false});
    this._smallLantern(d.cx,y+H,d.cz,rOcc);
  }
  // the four crossing-corner chapels: coffered pendentives, a round drum with windows and a cupola (interior height about 42 m). The looking-up photo is mapped on the cupola only, so the 3D drum is not doubled.
  _cornerMinorDome(d,imgs){const m=this.mat,seg=this.mobile?32:48,r=d.rx,y0=d.y,drumH=8,yCorn=y0+drumH,yVault=d.vaultY||42,rOcc=d.rOcc||1.15;
    const stucco=new THREE.MeshStandardMaterial({color:0xf3eadc,roughness:.42,metalness:0,side:THREE.DoubleSide});
    this._ovalBayPendentives({...d,drop:d.drop||6.7,ax:d.ax||r*1.15,az:d.az||r*1.15},imgs);
    this._ellipseMolding(d.cx,y0,d.cz,r+.02,r+.02,.1,seg);
    {const drum=new THREE.Mesh(new THREE.CylinderGeometry(r*.98,r*.98,drumH,seg,1,true),stucco);drum.position.set(d.cx,y0+drumH/2,d.cz);this.s.add(drum)}
    const glow=new THREE.MeshBasicMaterial({color:new THREE.Color(1.12,1.06,.95),toneMapped:false,side:THREE.DoubleSide});
    const panes=[],dummy=new THREE.Object3D(),yC=y0+drumH*.5,winH=drumH*.55;
    for(let i=0;i<8;i++){const a=(i+.5)*PI/4;
      panes.push(o=>{o.position.set(d.cx+Math.cos(a)*r*.97,yC,d.cz+Math.sin(a)*r*.97);o.lookAt(d.cx,yC,d.cz)})}
    {const mesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(1.6,winH),glow,panes.length);
      panes.forEach((fn,i)=>{fn(dummy);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix)});mesh.instanceMatrix.needsUpdate=true;this.s.add(mesh)}
    this._ellipseMolding(d.cx,yCorn,d.cz,r,r,.1,seg);
    const capH=Math.max(6,yVault-2-yCorn);
    const g=new THREE.LatheGeometry(Array.from({length:13},(_,i)=>{const th=i/12*Math.acos(rOcc/r);return new THREE.Vector2(r*Math.cos(th),yCorn+capH*Math.sin(th))}),seg);
    g.translate(d.cx,0,d.cz);this._vaultUV(g,d,rOcc);
    const map=d.img&&imgs[d.img],mat=map?new THREE.MeshStandardMaterial({map,roughness:.55,metalness:.05,side:THREE.DoubleSide}):new THREE.MeshStandardMaterial({map:T.tex(T.minorCoffers()),roughness:.4,metalness:.25,side:THREE.DoubleSide});
    this.add(g,mat,{recv:false});
    this._smallLantern(d.cx,yCorn+capH*Math.sin(Math.acos(rOcc/r)),d.cz,rOcc);
  }
  _smallLantern(x,y,z,r){const m=this.mat,h=Math.max(1.6,r*.9),seg=this.mobile?16:24;
    const stucco=new THREE.MeshStandardMaterial({color:0xf3eadc,roughness:.42,metalness:0,side:THREE.DoubleSide});
    {const t=new THREE.Mesh(new THREE.TorusGeometry(r,.07,6,seg*2),m.gold);t.rotation.x=PI/2;t.position.set(x,y,z);this.s.add(t)}
    {const c=new THREE.Mesh(new THREE.CylinderGeometry(r*.92,r,h,seg,1,true),stucco);c.position.set(x,y+h/2,z);this.s.add(c)}
    const glow=new THREE.MeshBasicMaterial({color:new THREE.Color(1.25,1.16,1.0),toneMapped:false,side:THREE.DoubleSide});
    const dummy=new THREE.Object3D(),panes=[];
    for(let i=0;i<8;i++){const a=(i+.5)*PI/4;
      panes.push(o=>{o.position.set(x+Math.cos(a)*r*.9,y+h/2,z+Math.sin(a)*r*.9);o.lookAt(x,y+h/2,z)})}
    {const mesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(r*.55,h*.75),glow,8);
      panes.forEach((fn,i)=>{fn(dummy);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix)});mesh.instanceMatrix.needsUpdate=true;this.s.add(mesh)}
    {const t=new THREE.Mesh(new THREE.TorusGeometry(r*.92,.06,6,seg*2),m.gold);t.rotation.x=PI/2;t.position.set(x,y+h,z);this.s.add(t)}
    const cap=new THREE.LatheGeometry(Array.from({length:8},(_,i)=>{const th=i/7*PI/2;return new THREE.Vector2(r*.92*Math.cos(th),y+h+Math.max(.9,r*.5)*Math.sin(th))}),seg);
    cap.translate(x,0,z);
    this.add(cap,new THREE.MeshStandardMaterial({color:0xe2b45c,roughness:.35,metalness:.65,side:THREE.DoubleSide}),{recv:false});
  }
  // chapel altars: the real altar wall from an openly licensed photo, with the altar table, steps, candlesticks and (Clementine) St Gregory's sarcophagus in 3D
  _altars(imgs){const m=this.mat;
    for(const c of this.chapels||[]){const im=imgs[c.kind];if(!im)continue;const crop=im.crop,W=c.kind==='sacr'?8.2:c.kind==='clem'?5.6:6.2,H=W*(crop[3]*im.img.height)/(crop[2]*im.img.width);
      const t=T.tex(im.img,{wrap:false});t.repeat.set(crop[2],crop[3]);t.offset.set(crop[0],1-crop[1]-crop[3]);
      const g=new THREE.Group();g.position.set(c.x,0,c.z);g.rotation.y=c.rot;this.s.add(g);
      const ph=new THREE.Mesh(new THREE.PlaneGeometry(W,H),new THREE.MeshBasicMaterial({map:t,color:new THREE.Color(...(im.col||[1.2,1.16,1.1]))}));ph.position.set(0,1.45+H/2,.05);g.add(ph);
      // marble aedicule round the altar wall: coloured columns with gilded capitals, entablature, and veined marble panels either side
      const cm=this.chapelCol||(this.chapelCol=[this.M.verde,this.M.red,this.M.brown].map(im=>new THREE.MeshStandardMaterial({map:T.tex(im),roughness:.22,metalness:0})));
      const mk=cm[{sacr:2,greg:0,clem:1}[c.kind]],yT=1.45+H;
      for(const sx of [-1,1]){const col=new THREE.Mesh(new THREE.CylinderGeometry(.34,.38,yT-.6,20),mk);col.position.set(sx*(W/2+.55),.6+(yT-.6)/2,.45);col.castShadow=true;g.add(col);
        const b=new THREE.Mesh(new THREE.BoxGeometry(1.0,.6,1.0),m.marbleW);b.position.set(sx*(W/2+.55),.3,.45);g.add(b);
        const cp=new THREE.Mesh(new THREE.CylinderGeometry(.55,.36,.6,16),m.gold);cp.position.set(sx*(W/2+.55),yT+.3,.45);g.add(cp);
        if(c.kind!=='sacr'){const pn=new THREE.Mesh(new THREE.PlaneGeometry(1.6,yT*.8),cm[2]);pn.position.set(sx*(W/2+2.0),yT*.5,.03);g.add(pn);
        const pf=new THREE.Mesh(new THREE.BoxGeometry(1.8,yT*.8+.2,.04),m.gold);pf.position.set(sx*(W/2+2.0),yT*.5,.0);g.add(pf)}}
      const en=new THREE.Mesh(new THREE.BoxGeometry(W+2.4,.8,1.1),m.travWarm);en.position.set(0,yT+1.0,.5);g.add(en);
      const fr=new THREE.Mesh(new THREE.BoxGeometry(W+2.7,.22,1.25),m.gold);fr.position.set(0,yT+1.5,.55);g.add(fr);
      {const sh=new THREE.Shape();const R=(W+2.6)/2/Math.sin(.7);sh.absarc(0,-R*Math.cos(.7),R,PI/2+.7,PI/2-.7,true);sh.absarc(0,-R*Math.cos(.7),R-.6,PI/2-.7,PI/2+.7,false);
       const pd=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:1.0,bevelEnabled:false,curveSegments:24}),m.travWarm);pd.position.set(0,yT+1.6,0);g.add(pd)}
      const pfr=new THREE.Mesh(new THREE.BoxGeometry(W+.3,H+.3,.06),m.gold);pfr.position.set(0,1.45+H/2,0);g.add(pfr);
      const st=new THREE.Mesh(new THREE.BoxGeometry(5.2,.3,2.6),m.marbleW);st.position.set(0,.15,1.4);st.receiveShadow=true;g.add(st);
      const al=new THREE.Mesh(new THREE.BoxGeometry(3.2,1.05,1.1),new THREE.MeshStandardMaterial({map:T.tex(T.travertine(this.M,{tint:'rgba(250,240,225,.25)',joints:false})),roughness:.3}));al.position.set(0,.3+.52,.9);al.castShadow=true;g.add(al);
      const mt=new THREE.Mesh(new THREE.BoxGeometry(3.4,.1,1.25),m.marbleW);mt.position.set(0,1.4,.9);g.add(mt);
      const ant=new THREE.Mesh(new THREE.BoxGeometry(2.2,.7,.04),new THREE.MeshStandardMaterial({color:0x7a1e22,roughness:.6}));ant.position.set(0,.85,1.46);g.add(ant);
      if(c.kind==='clem'){const sa=new THREE.Mesh(new THREE.BoxGeometry(2.6,.6,.04),m.gold);sa.position.set(0,.85,1.48);g.add(sa)}
      for(const x of [-1.3,-.8,.8,1.3]){const cs=new THREE.Mesh(new THREE.LatheGeometry([[0,0],[.1,0],[.05,.08],[.035,.5],[.07,.54],[.025,.56],[.025,.82],[0,.82]].map(([r,y])=>new THREE.Vector2(r,y)),10),m.gold);cs.position.set(x,1.45,.7);g.add(cs);
        const fl=new THREE.Sprite(new THREE.SpriteMaterial({map:T.tex(T.glowSprite('255,190,90')),blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false,color:new THREE.Color(2,1.6,1)}));fl.scale.set(.16,.26,1);fl.position.set(x,2.36,.7);g.add(fl)}
      const lt=new THREE.PointLight(0xffe2b0,4,14,1.6);lt.position.set(0,5,4);g.add(lt);
      if(c.kind==='sacr'){ // gilded railing before the Blessed Sacrament, where the faithful kneel in prayer
        for(let i=0;i<15;i++){const b=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,1.0,6),m.gold);b.position.set(-3.5+i*.5,.5,4.2);g.add(b)}
        const rl=new THREE.Mesh(new THREE.BoxGeometry(7.4,.08,.12),m.gold);rl.position.set(0,1.02,4.2);g.add(rl)}}}
  // ---------- crossing: piers with Bernini's loggias, arches, pendentives ----------
  _crossing(){const {CROSS:C,PIER}=D,m=this.mat,AR=12,ASPR=34.3;
    // four arch tunnels (nave, apse, two transepts): walls and coffered soffits
    for(let q=0;q<4;q++){const rot=q*PI/2,g=new THREE.Group();g.rotation.y=rot;this.s.add(g);
      const add=(geo,mat)=>{const o=new THREE.Mesh(geo,mat);o.receiveShadow=true;g.add(o);return o};
      for(const s of [-1,1])add(new THREE.PlaneGeometry(PIER-C,ASPR).translate(0,ASPR/2,0).rotateY(PI/2),m.flute).position.set(s*AR,0,(C+PIER)/2);
      add(surf((u,v)=>V(Math.cos(u*PI)*AR,ASPR+Math.sin(u*PI)*AR,C+v*(PIER-C)),48,6,8,2),m.coffer);
      // step face between the tunnel and the wider arm (at z=PIER)
      add(wallShape(archOutline(13,D.SPR),[archOutline(AR,ASPR)],(a,y)=>V(a,y,PIER),[4,4]),m.trav);
      // gilded archivolt on the crossing face
      const t=new THREE.Mesh(new THREE.TorusGeometry(AR+.3,.35,8,48,PI),m.gold);t.position.set(0,ASPR,C-.05);g.add(t);
    }
    // diagonal pier faces with a statue niche (Longinus, Helena, Veronica, Andrew) and a relic loggia with Solomonic columns
    for(let q=0;q<4;q++){const a=PI/4+q*PI/2,d=(AR+C)/Math.SQRT2,w=Math.SQRT2*(C-AR),cx=Math.sin(a)*d,cz=Math.cos(a)*d,face=new THREE.Group();
      face.position.set(cx,0,cz);face.rotation.y=a+PI;this.s.add(face);
      const ad=(geo,mat,x,y,z)=>{const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);o.receiveShadow=true;face.add(o);return o};
      {const NH=9.6,R=3.2,hole=[[-R,0],[R,0]];for(let i=0;i<=20;i++){const t=i*PI/20;hole.push([Math.cos(t)*R,NH-R+Math.sin(t)*R])}
       const lg=[[-1.9*1.35,15.5+1.4*1.35],[1.9*1.35,15.5+1.4*1.35],[1.9*1.35,15.5+7.6*1.35],[-1.9*1.35,15.5+7.6*1.35]];const wg=wallShape([[-w/2,0],[w/2,0],[w/2,ASPR],[-w/2,ASPR]],[hole,lg],(a,y)=>V(a,y,0));const o=new THREE.Mesh(wg,m.trav);o.receiveShadow=true;face.add(o)}
      this.niches=this.niches||[];this.niches.push(face);
      this._loggia(face,ad);
      for(const s of [-1,1])ad(new THREE.BoxGeometry(1.6,ASPR-2,.4),m.flute,s*(w/2-1),(ASPR-2)/2,.2);
      ad(new THREE.BoxGeometry(w,2.2,1.4),m.travWarm,0,ASPR-1.1,.7);
    }
    // pendentives: loft from the crossing octagon (arch intrados / diagonal faces) up to the drum circle; photo projected
    const yTop=47.3;
    const oct=th=>{ // distance and base height of the octagon boundary at azimuth th (x=sin, z=cos)
      const sx=Math.sin(th),cz=Math.cos(th),ax=Math.abs(sx),az=Math.abs(cz);let t=Math.min(C/Math.max(ax,1e-6),C/Math.max(az,1e-6));
      const diag=(AR+C)/((ax+az)||1);t=Math.min(t,diag);const x=sx*t,z=cz*t,lat=Math.abs(ax>az?z:x),onAxis=t<diag-1e-6;
      return {t,y:onAxis&&lat<AR?ASPR+Math.sqrt(AR*AR-lat*lat):ASPR}};
    const pg=surf((u,v)=>{const th=u*2*PI,o=oct(th),r=C+(o.t-C)*Math.cos(v*PI/2),y=o.y+(yTop-o.y)*v;return V(Math.sin(th)*r,y,Math.cos(th)*r)},this.mobile?200:320,40);
    this.domeGeo=[pg];
  }
  // Bernini's relic loggia above each statue niche: projecting balcony with balustrade on consoles, a recessed opening framed by two pairs
  // of twisted marble columns (re-used from the old basilica), a carved relief panel with angels' cartouche, entablature and segmental pediment
  _loggia(face0,ad0){const LS=1.35,LY=15.5,face=new THREE.Group();face.position.set(0,LY,0);face.scale.setScalar(LS);face0.add(face);
    const ad=(geo,mat,x,y,z)=>{const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);o.receiveShadow=true;face.add(o);return o};
    const m=this.mat,Y=0,OW=3.8,OH=6.2,col=this.loggiaCol||(this.loggiaCol=new THREE.MeshStandardMaterial({map:T.tex(T.travertine(this.M,{tint:'rgba(250,244,232,.35)',joints:false})),roughness:.32,color:0xfaf4ea}));
    // recess (opening) with a relief panel at the back
    const relief=this.loggiaRelief||(this.loggiaRelief=new THREE.MeshStandardMaterial({map:T.tex(T.reliefPanel(this.M),{wrap:false}),roughness:.55}));
    ad(new THREE.PlaneGeometry(OW,OH),relief,0,Y+1.4+OH/2,-1.4);
    for(const s of [-1,1])ad(new THREE.PlaneGeometry(1.4,OH).rotateY(s>0?-PI/2:PI/2),m.travWarm,s*OW/2,Y+1.4+OH/2,-.7);
    ad(new THREE.PlaneGeometry(OW,1.4).rotateX(PI/2),m.travWarm,0,Y+1.4+OH,-.7);
    ad(new THREE.PlaneGeometry(OW,1.4).rotateX(-PI/2),m.travWarm,0,Y+1.4,-.7);
    // balcony slab, consoles and balustrade
    ad(new THREE.BoxGeometry(6.8,.45,1.9),col,0,Y+1.2,.75);ad(new THREE.BoxGeometry(7.0,.18,2.05),m.gold,0,Y+1.47,.78);
    for(const x of [-2.6,-.9,.9,2.6]){const c=ad(new THREE.BoxGeometry(.45,1.6,1.4),col,x,Y+.2,.55);c.scale.set(1,1,1)}
    const bal=this.balGeo||(this.balGeo=new THREE.LatheGeometry([[0,0],[.13,0],[.13,.06],[.07,.12],[.15,.35],[.09,.62],[.07,.68],[.12,.74],[.12,.8],[0,.8]].map(([r,y])=>new THREE.Vector2(r,y)),10));
    for(let i=0;i<13;i++){const b=new THREE.Mesh(bal,col);b.position.set(-2.9+i*.483,Y+1.56,1.55);face.add(b)}
    for(const s of [-1,1]){const b=new THREE.Mesh(bal,col);b.position.set(s*3.2,Y+1.56,1.1);face.add(b)}
    ad(new THREE.BoxGeometry(6.6,.16,.36),col,0,Y+2.44,1.55);
    // two pairs of twisted columns on pedestals
    const cg=this._solomonic(.26,5.0,2.6),cm=this.loggiaColM||(this.loggiaColM=new THREE.MeshStandardMaterial({color:0xf3ebdc,roughness:.35}));
    for(const s of [-1,1])for(const k of [0,1]){const x=s*(OW/2+.45+k*.75);ad(new THREE.BoxGeometry(.7,.6,.7),col,x,Y+1.75,.25+k*.0);const c=new THREE.Mesh(cg,cm);c.position.set(x,Y+2.05,.25);c.castShadow=true;face.add(c);
      ad(new THREE.CylinderGeometry(.42,.28,.55,10),m.travWarm,x,Y+7.3,.25)}
    // entablature and segmental pediment
    ad(new THREE.BoxGeometry(7.2,.9,1.1),col,0,Y+8.0,.3);ad(new THREE.BoxGeometry(7.6,.22,1.3),m.gold,0,Y+8.5,.35);
    {const sh=new THREE.Shape();const R=5,ang=.75;sh.absarc(0,-R*Math.cos(ang)+.0,R,PI/2+ang,PI/2-ang,true);sh.absarc(0,-R*Math.cos(ang)+.0,R-.7,PI/2-ang,PI/2+ang,false);
     const pg=new THREE.ExtrudeGeometry(sh,{depth:1.1,bevelEnabled:false,curveSegments:24});pg.translate(0,0,-.25);ad(pg,col,0,Y+8.6,0)}
    // gilded cartouche with the relic's emblem on the pediment
    ad(new THREE.CircleGeometry(.55,20),m.gold,0,Y+9.35,.9);
  }
  _dome(img,godImg){const t=T.tex(img,{wrap:false,aniso:this.r.capabilities.getMaxAnisotropy()});t.generateMipmaps=true;
    const mat=new THREE.MeshBasicMaterial({map:t,side:THREE.DoubleSide,color:new THREE.Color(1.3,1.25,1.2)});
    const R=D.DOME_R,seg=this.mobile?96:160;
    // pendentives (4-fold symmetric: near pair copied from far pair)
    {const sp=medSplit(projectUV(this.domeGeo[0],true));this.add(sp.main,mat,{recv:false});
     (this.medImgs||[]).forEach((im,i)=>{if(!im)return;const t=T.tex(im,{wrap:false});this.add(sp.meds[i],new THREE.MeshBasicMaterial({map:t,side:THREE.DoubleSide,color:new THREE.Color(...this.medCol[i])}),{recv:false})})}
    // inscription frieze: legible canvas lettering on the drum ring (photo projection is not readable)
    const lathe=(pts,n)=>new THREE.LatheGeometry(pts.map(([r,y])=>new THREE.Vector2(r,y)),n);
    this.add(this._friezeUV(lathe([[R-.05,47.3],[R-.05,50.0]],seg),2,0,1,true),this.friezeMat(),{recv:false});
    // drum, attic and cupola (photo). Stop just outside the oculus so the warped
    // inscription and smeared lantern are not projected; the lantern is modelled in 3D.
    const pr=[[R,50],[R-.8,50.4],[R-.8,51.0],[R,51.3],[R,64],[R-.9,64.6],[R-.9,65.4],[R,66],[R,71]];
    const thEnd=Math.acos(7.90/R);
    for(let i=1;i<=40;i++){const th=i/40*thEnd;pr.push([R*Math.cos(th),71+37*Math.sin(th)])}
    this.add(projectUV(lathe(pr,seg),true),mat,{recv:false});
    this._lantern(godImg);
    // drum windows glow (for bloom) — thin bright panes just inside the photographed windows
    const wm=new THREE.MeshBasicMaterial({color:new THREE.Color(1.5,1.42,1.25),toneMapped:false,transparent:true,opacity:.0});
    this.drumWindows=[];for(let i=0;i<16;i++){const a=(i+.5)*PI/8,o=new THREE.Mesh(new THREE.PlaneGeometry(2.6,6.5),wm);o.position.set(Math.sin(a)*(R-.15),58.6,Math.cos(a)*(R-.15));o.lookAt(0,58.6,0);this.s.add(o);this.drumWindows.push(o)}
  }
  // 3D lantern above the oculus: star field, Sixtus V inscription, 16 paired rib-ends,
  // inner drum with 16 windows, and the God the Father vault. Official inner height to
  // the lantern vault is 117.57 m (Vatican). The guidebook figure of an "18 m lantern"
  // is taken as the exterior lantern (roof to the ball), which is not modelled here.
  _lantern(godImg){const R=D.DOME_R,seg=this.mobile?64:96,m=this.mat,yOff=-.1;
    const lathe=pts=>new THREE.LatheGeometry(pts.map(([r,y])=>new THREE.Vector2(r,y)),seg);
    const sph=th=>({r:R*Math.cos(th),y:71+37*Math.sin(th)+yOff});
    const thStar=Math.acos(8.10/R),thGold=Math.acos(5.35/R),thLip=Math.acos(4.20/R);
    const pts=(a,b,n)=>{const p=[];for(let i=0;i<=n;i++){const s=sph(a+(b-a)*i/n);p.push([s.r,s.y])}return p};
    // gold moulding at the outer edge of the star field
    {const s=sph(thStar),t=new THREE.Mesh(new THREE.TorusGeometry(s.r,.07,6,seg),m.gold);t.rotation.x=PI/2;t.position.y=s.y;this.s.add(t)}
    // large stars sit in the bays between the 16 dome ribs (shift 1/2 bay vs the photo ribs)
    const starTex=T.tex(T.oculusStars({w:this.mobile?1024:2048,h:this.mobile?128:256}),{wrap:true,aniso:4});starTex.offset.x=1/32;
    this.add(lathe(pts(thStar,thGold,16)),new THREE.MeshStandardMaterial({map:starTex,roughness:.45,metalness:.12,side:THREE.DoubleSide}),{recv:false});
    // inscription: dark letters on gold, same canvas method as the drum "Tu es Petrus".
    // Letter tops point outward (V flipped). U is left unflipped so the text reads
    // clockwise around the ring when looking up, as in the real oculus.
    const insTex=T.tex(T.frieze('S. PETRI GLORIAE SIXTVS PP. V. A. MDXC PONTIF. V.',{w:this.mobile?2048:4096,h:this.mobile?64:128,ink:'#1c1a16'}),{wrap:true,aniso:8});
    const insGeo=lathe(pts(thGold,thLip,8));
    {const U=insGeo.attributes.uv;for(let i=0;i<U.count;i++)U.setXY(i,U.getX(i),1-U.getY(i));U.needsUpdate=true}
    this.add(insGeo,new THREE.MeshStandardMaterial({map:insTex,roughness:.4,metalness:.28,emissive:0x3a2a10,emissiveIntensity:.12,side:THREE.DoubleSide}),{recv:false});
    const lip=sph(thLip);
    {const t=new THREE.Mesh(new THREE.TorusGeometry(lip.r,.06,6,seg),m.gold);t.rotation.x=PI/2;t.position.y=lip.y;this.s.add(t)}
    // 16 paired cream-and-gold rib-ends in the plane of the oculus (visible from below
    // as the "teeth" at the inner lip), on the dome-rib meridians. Instanced to keep draw calls down.
    const col=new THREE.MeshStandardMaterial({color:0xeee6d4,roughness:.35});
    const dummy=new THREE.Object3D();
    const inst=(geo,mat,place)=>{const mesh=new THREE.InstancedMesh(geo,mat,place.length);place.forEach((fn,i)=>{fn(dummy);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix)});mesh.instanceMatrix.needsUpdate=true;this.s.add(mesh);return mesh};
    const teeth=[],toothCaps=[];
    for(let i=0;i<16;i++){const a=(i+.5)*PI/8;
      for(const d of[-.13,.13]){const ang=a+d,rr=lip.r+.12,yc=lip.y-.1;
        teeth.push(o=>{o.position.set(Math.sin(ang)*rr,yc,Math.cos(ang)*rr);o.lookAt(0,yc,0)});
        toothCaps.push(o=>{o.position.set(Math.sin(ang)*(lip.r-.2),yc,Math.cos(ang)*(lip.r-.2));o.lookAt(0,yc,0)})}}
    inst(new THREE.BoxGeometry(.16,.22,.7),col,teeth);
    inst(new THREE.BoxGeometry(.2,.16,.16),m.gold,toothCaps);
    // inner drum: official vault height 117.57 m
    const y0=lip.y+.08,rIn=3.95,yWin0=y0+1.15,yWinH=4.4,yCorn=yWin0+yWinH+.35,yVault=117.57;
    const stucco=new THREE.MeshStandardMaterial({color:0xf3eadc,roughness:.42,metalness:0,side:THREE.DoubleSide});
    this.add(lathe([[lip.r,lip.y],[rIn,y0]]),stucco);
    // continuous cream drum so there are no dark gaps between windows
    {const drum=new THREE.Mesh(new THREE.CylinderGeometry(rIn+.08,rIn+.08,yCorn-y0,16,1,true),stucco);drum.position.y=(y0+yCorn)/2;this.s.add(drum)}
    const glow=new THREE.MeshBasicMaterial({color:new THREE.Color(1.28,1.2,1.05),toneMapped:false,side:THREE.DoubleSide});
    const panes=[],pilasters=[],pilCaps=[];
    for(let i=0;i<16;i++){
      const a=i*PI/8,yC=yWin0+yWinH/2; // windows in the bays between the ribs
      panes.push(o=>{o.position.set(Math.sin(a)*(rIn+.01),yC,Math.cos(a)*(rIn+.01));o.lookAt(0,yC,0)});
      for(const d of[-.55,.55]){const ang=a+d,px=Math.sin(ang)*(rIn+.1),pz=Math.cos(ang)*(rIn+.1);
        pilasters.push(o=>{o.position.set(px,(y0+yCorn)/2,pz);o.rotation.set(0,0,0)});
        pilCaps.push(o=>{o.position.set(px,yCorn-.1,pz);o.rotation.set(0,0,0)})}}
    this.lanternWindows=inst(new THREE.PlaneGeometry(.95,yWinH),glow,panes);
    inst(new THREE.CylinderGeometry(.08,.09,yCorn-y0,8),stucco,pilasters);
    inst(new THREE.CylinderGeometry(.11,.08,.16,8),m.gold,pilCaps);
    {const t=new THREE.Mesh(new THREE.TorusGeometry(rIn+.05,.1,6,seg),m.gold);t.rotation.x=PI/2;t.position.y=yCorn;this.s.add(t)}
    // vault: God the Father mosaic, or a gilt cap if the image failed to load
    const vH=yVault-yCorn,vR=rIn,vPts=[];for(let i=0;i<=12;i++){const th=i/12*PI/2;vPts.push([vR*Math.cos(th),yCorn+vH*Math.sin(th)])}
    const vg=lathe(vPts),U=vg.attributes.uv,P=vg.attributes.position;
    for(let i=0;i<P.count;i++)U.setXY(i,.5+P.getX(i)/(2*vR),.5+P.getZ(i)/(2*vR));U.needsUpdate=true;
    if(godImg){const gt=T.tex(godImg,{wrap:false,aniso:this.r.capabilities.getMaxAnisotropy()});this.add(vg,new THREE.MeshStandardMaterial({map:gt,roughness:.55,metalness:.05,side:THREE.DoubleSide}),{recv:false})}
    else this.add(vg,new THREE.MeshStandardMaterial({color:0xe2b45c,roughness:.35,metalness:.7,side:THREE.DoubleSide}),{recv:false});
    const L=new THREE.PointLight(0xfff0d0,8,22,1.2);L.position.set(0,(y0+yCorn)/2,0);this.s.add(L);
  }
  // the four great statues in the crossing piers' niches (photos by Gary Todd, public domain), wrapped onto concave niches
  // the four great statues' niches in the crossing piers: concave marble shells (the statues are modelled, see _statues)
  _niches(){const nm=new THREE.MeshStandardMaterial({map:T.tex(T.travertine(this.M,{tint:'rgba(200,190,175,.35)',joints:true})),roughness:.4,color:new THREE.Color(.86,.83,.79),side:THREE.DoubleSide});
    this.niches.forEach((face,q)=>{const W=6.4,H=9.6,R=3.2,yc=H-R;
    const g=surf((u,v)=>{const a=-PI/2+u*PI;const y=v*H;let r=R,yy=y;if(y>yc){const e=Math.asin(Math.min(1,(y-yc)/R));r=R*Math.cos(e)}return V(Math.sin(a)*r,y,-Math.cos(a)*r*.75)},40,40);
    const o=new THREE.Mesh(g,nm);o.position.set(0,0,.02);o.receiveShadow=true;face.add(o);
    const fr=new THREE.Mesh(new THREE.TorusGeometry(R+.15,.22,8,32,PI),this.mat.travWarm);fr.position.set(0,yc,.1);face.add(fr);
    const pl=new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.6,.45,32),this.mat.marbleW);pl.position.set(0,.22,-1.15);pl.scale.z=.75;pl.receiveShadow=true;face.add(pl)})}
  // ---------- transepts and apse ----------
  _arms(){const {NHW,PIER,SPR,APSE_C,TRANS_C}=D,m=this.mat;
    const arm=(rot,end,kind)=>{const g=new THREE.Group();g.rotation.y=rot;this.s.add(g);const add=(geo,mat)=>{const o=new THREE.Mesh(geo,mat);o.receiveShadow=true;g.add(o);return o};
      const len=end-PIER; // arm runs from z=PIER to z=end (local +z away from crossing)
      const run=2*len+Math.PI*NHW; // continuous tribune length (two sides + semicircle)
      for(const s of [-1,1]){add(wallShape([[PIER,0],[end,0],[end,SPR],[PIER,SPR]],[],(a,y)=>V(s*NHW,y,a)),m.trav);
        for(const z of [PIER+2.6,end-2.6]){const p=new THREE.Mesh(new THREE.BoxGeometry(.5,26,2.3),m.flute);p.position.set(s*(NHW-.25),13,z);g.add(p)}
        const n=new THREE.Mesh(new THREE.CylinderGeometry(1.6,1.6,7,16,1,true,0,PI),m.dark);n.rotation.y=s>0?0:PI;n.position.set(s*(NHW+.05),8,(PIER+end)/2);g.add(n);
        const e=new THREE.Mesh(new THREE.BoxGeometry(2,1.4,len),m.travWarm);e.position.set(s*(NHW-1),32.4,PIER+len/2);g.add(e);
        const lip=new THREE.Mesh(new THREE.BoxGeometry(2.3,.4,len),m.gold);lip.position.set(s*(NHW-1.15),33.3,PIER+len/2);g.add(lip);
        const u0=kind==='apse'?(s>0?0: (len+Math.PI*NHW)/run):0,u1=kind==='apse'?(s>0?len/run:1):1;
        const fr=new THREE.Mesh(this._friezeUV(new THREE.PlaneGeometry(len,1.7),kind==='apse'?3:4,u0,u1),this.friezeMat());fr.rotation.y=s>0?-PI/2:PI/2;fr.position.set(s*(NHW-.02),30.3,PIER+len/2);g.add(fr);}
      add(this._barrelGeo(PIER,end),m.coffer);
      add(this._vaultRib(PIER+2.6),m.cofferRed);add(this._vaultRib(end-2.6),m.cofferRed);
      // semicircular apse end: wall + coffered half dome
      const wallM=m.trav,apse=add(surf((u,v)=>{const a=-PI/2+u*PI;return V(Math.sin(a)*NHW,v*SPR,end+Math.cos(a)*NHW)},48,8,8,SPR/4),wallM);
      add(surf((u,v)=>{const a=-PI/2+u*PI,e=v*PI/2;return V(Math.sin(a)*NHW*Math.cos(e),SPR+NHW*Math.sin(e),end+Math.cos(a)*NHW*Math.cos(e))},48,16,6,3),m.coffer);
      if(kind==='apse'){const cg=surf((u,v)=>{const a=PI/2-u*PI;return V(Math.sin(a)*(NHW-.06),29.45+v*1.7,end+Math.cos(a)*(NHW-.06))},64,1);
        add(this._friezeUV(cg,3,len/run,(len+Math.PI*NHW)/run),this.friezeMat())}
      return {g,apse}};
    this.apseArm=arm(PI,-APSE_C,'apse');arm(PI/2,TRANS_C,'trans');arm(-PI/2,TRANS_C,'trans');
  }
  _apsePhoto(img){ // the apse wall with Bernini's Cathedra Petri: frontal photo (V. Muratov, CC BY-SA 3.0) wrapped onto the half-cylinder
    const t=T.tex(img,{wrap:false,aniso:this.r.capabilities.getMaxAnisotropy()});const H=29.4,R=D.NHW,Z=D.APSE_C;
    const g=surf((u,v)=>{const a=-PI/2+u*PI;return V(Math.sin(a)*(R-.05),v*H,Z-Math.cos(a)*(R-.05))},64,24);
    const P=g.attributes.position,U=g.attributes.uv;for(let i=0;i<P.count;i++){const x=P.getX(i),y=P.getY(i);U.setXY(i,(1410+x*81.5)/2800,1-(2400-y*81.5)/2420)}
    const m=new THREE.MeshBasicMaterial({map:t,side:THREE.DoubleSide,color:new THREE.Color(1.25,1.2,1.15)});this.add(g,m,{recv:false});
    // the alabaster window of the Holy Spirit glows (bloom)
    const s=new THREE.Sprite(new THREE.SpriteMaterial({map:T.tex(T.glowSprite('255,206,120')),color:new THREE.Color(1.8,1.5,1.0),blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false,transparent:true,opacity:.75}));
    s.position.set(.35,15.75,Z-R+.6);s.scale.set(5.5,5.5,1);this.s.add(s);this.gloria=s;
    // apse altar & steps in 3D
    this.box(7,.5,4,0,.25,Z-R+3.4,this.mat.marbleW);this.box(4.2,1.05,1.4,0,1.0,Z-R+3.0,this.mat.marbleW,{cast:true});
  }
  // counter-facade: real masonry, three doors (central Filarete door the largest), centred thermal window
  _entrance(){const {NHW,ENTR,SPR}=D,m=this.mat,zFace=ENTR,depth=.9;
    const doors=[{x:0,w:5.2,h:8.6,bronze:true},{x:-7.45,w:3.2,h:6.6,bronze:false},{x:7.45,w:3.2,h:6.6,bronze:false}];
    const cw=(x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
    const holes=doors.map(d=>cw(d.x-d.w/2,.15,d.x+d.w/2,d.h));
    holes.push(archPts(0,4.2,20.55,15.35).slice().reverse());
    const sh=new THREE.Shape(archOutline(NHW,SPR).map(([a,b])=>new THREE.Vector2(a,b)));
    for(const h of holes)sh.holes.push(new THREE.Path(h.map(([a,b])=>new THREE.Vector2(a,b))));
    const geo=new THREE.ExtrudeGeometry(sh,{depth,bevelEnabled:false,curveSegments:20});geo.translate(0,0,zFace);
    const P=geo.attributes.position,U=geo.attributes.uv;for(let i=0;i<P.count;i++)U.setXY(i,P.getX(i)/4,P.getY(i)/4);U.needsUpdate=true;geo.computeVertexNormals();
    this.add(geo,m.trav,{recv:true});
    const wood=new THREE.MeshStandardMaterial({color:0x7a4e32,roughness:.55,metalness:.08});
    const filarete=new THREE.MeshStandardMaterial({color:0xc4924e,metalness:.72,roughness:.34});
    for(const d of doors){const leaf=d.bronze?filarete:wood,zLeaf=zFace+.2,t=.46;
      this.box(d.w+t*2,t,.34,d.x,d.h+t/2,zFace-.12,m.travWarm);
      this.box(t,d.h,.34,d.x-(d.w+t)/2,d.h/2,zFace-.12,m.travWarm);
      this.box(t,d.h,.34,d.x+(d.w+t)/2,d.h/2,zFace-.12,m.travWarm);
      this.box(d.w+t*2,.16,.4,d.x,d.h+t+.08,zFace-.16,m.gold);
      this.box(d.w-.18,d.h-.22,.12,d.x,(d.h+.12)/2,zLeaf,leaf,{cast:true});
      const rows=d.bronze?6:4,cols=2,pw=(d.w-.85)/cols,ph=(d.h-1.05)/rows;
      for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const px=d.x-d.w/2+.42+pw*(c+.5),py=.55+ph*(r+.5);
        this.box(pw-.14,ph-.14,.05,px,py,zLeaf-.07,d.bronze?m.gold:m.travWarm);}}
    const ring=new THREE.Mesh(new THREE.TorusGeometry(4.2,.22,8,40,PI),m.travWarm);ring.position.set(0,20.55,zFace-.05);this.s.add(ring);
    this.box(9.1,.28,.32,0,15.2,zFace-.1,m.travWarm);
    this._window(V(0,20.15,zFace+.06),7.5,8.7,0,true);
    // entablature returned across the counter-facade, flush with the nave cornice (top at SPR)
    this.box(NHW*2-.5,1.4,.55,0,32.4,zFace-.3,m.travWarm);
    this.box(NHW*2-.2,.4,.62,0,33.3,zFace-.34,m.gold);
    const lamp=new THREE.PointLight(0xffe4c2,26,55,1.5);lamp.position.set(0,18,zFace-9);this.s.add(lamp);
  }
  _piers(panel){const t=T.tex(panel,{wrap:false}),m=new THREE.MeshStandardMaterial({map:t,roughness:.5,side:THREE.DoubleSide});
    // putti & papal medallion panels on the arcade jambs (photo of the real nave pier panels)
    for(const s of [-1,1])for(const zc of archCentres)for(const e of [-1,1]){const p=this.add(new THREE.PlaneGeometry(2.6,13).translate(0,7.6,0),m);p.position.set(s*(D.NHW+3),0,zc+e*(D.ARCH_HW-.02));if(e>0)p.rotation.y=PI}
  }
  // ---------- Bernini's baldacchino ----------
  _solomonic(r,h,turns=3){ // twisted column: shaft whose axis spirals, with 6 helical ridges on the lower third
    const g=new THREE.CylinderGeometry(r,r,h,this.mobile?24:36,this.mobile?90:150,false);g.translate(0,h/2,0);const P=g.attributes.position;
    for(let i=0;i<P.count;i++){let x=P.getX(i),y=P.getY(i),z=P.getZ(i);const t=y/h,ph=t*turns*2*PI,ang=Math.atan2(z,x);
      let rr=r*(1-.08*t);if(t<.33)rr*=1+.06*Math.cos(8*(ang-ph));else rr*=1+.025*Math.cos(14*ang+y*9);const ex=r*.2,ox=Math.cos(ph)*ex,oz=Math.sin(ph)*ex;
      const L=Math.hypot(x,z)||1;P.setXYZ(i,x/L*rr+ox,y,z/L*rr+oz)}
    g.computeVertexNormals();return g}
  _baldacchino(){const m=this.mat,g=new THREE.Group();this.s.add(g);this.bald=g;
    const cm=new THREE.MeshStandardMaterial({map:T.tex(T.columnBronze()),metalness:.75,roughness:.4,color:0xffffff});
    const sh=o=>{o.traverse?.(c=>{if(c.isMesh){c.castShadow=true;c.receiveShadow=true;this.casters.push(c)}});return o};
    const X=5.6,PED=3.0,COL0=3.7,SH=12.6,CAP=1.4,ENT=COL0+SH+CAP; // column top ~18.6 m
    const ped=new THREE.MeshStandardMaterial({map:T.tex(T.travertine(this.M,{tint:'rgba(240,225,200,.3)',joints:false})),roughness:.3});
    for(const sx of [-1,1])for(const sz of [-1,1]){
      const p=new THREE.Mesh(new THREE.BoxGeometry(2.8,PED,2.8),ped);p.position.set(sx*X,PED/2,sz*X);g.add(sh(p));
      const pan=new THREE.Mesh(new THREE.BoxGeometry(2.86,1.4,1.6),new THREE.MeshStandardMaterial({map:T.tex(T.porphyry(this.M)),roughness:.25}));pan.position.set(sx*X,1.6,sz*X);g.add(pan);
      const b=new THREE.Mesh(new THREE.CylinderGeometry(1.0,1.15,.7,24),m.bronze);b.position.set(sx*X,PED+.35,sz*X);g.add(sh(b));
      const c=new THREE.Mesh(this._solomonic(.78,SH,3),cm);c.position.set(sx*X,COL0,sz*X);g.add(sh(c));
      const cap=new THREE.Mesh(new THREE.CylinderGeometry(1.05,.7,CAP,16),m.gold);cap.position.set(sx*X,COL0+SH+CAP/2,sz*X);g.add(sh(cap));
      const ab=new THREE.Mesh(new THREE.BoxGeometry(2.3,.4,2.3),m.bronze);ab.position.set(sx*X,ENT+.2,sz*X);g.add(sh(ab));
      // gilded bronze angel standing over each column, holding up a garland towards the canopy
      const an=this._angel(m.gold);an.scale.setScalar(1.12);an.position.set(sx*X,ENT+.4,sz*X);an.rotation.y=Math.atan2(sx,sz);g.add(sh(an));(this.angelSlots=this.angelSlots||[]).push(an);
    }
    // entablature frame with bronze valance (lambrequins) hanging between the columns
    const E=ENT+.4;
    for(const [w,d,x,z] of [[2*X+2.4,1.6,0,X],[2*X+2.4,1.6,0,-X],[1.6,2*X,X,0],[1.6,2*X,-X,0]]){
      const e=new THREE.Mesh(new THREE.BoxGeometry(w,1.5,d),m.bronze);e.position.set(x,E+.75,z);g.add(sh(e));
      const gb=new THREE.Mesh(new THREE.BoxGeometry(w+.05,.22,d+.05),m.gold);gb.position.set(x,E+1.55,z);g.add(gb);
      // scalloped valance
      const n=9,len=Math.max(w,d)-2.4,along=w>d;for(let i=0;i<n;i++){const f=-len/2+(i+.5)*len/n;const v=new THREE.Mesh(new THREE.CylinderGeometry(len/n/2,len/n/2,.12,12,1,false,0,PI),m.gold);
        v.rotation.x=PI/2;v.rotation.z=along?0:PI/2;if(along){v.position.set(f,E-.05,z+Math.sign(z)*.82);v.rotation.set(PI/2,0,PI)}else{v.position.set(x+Math.sign(x)*.82,E-.05,f);v.rotation.set(PI/2,0,PI/2)}g.add(v)}
    }
    // underside of the canopy: the Dove in glory
    const gl=new THREE.Mesh(new THREE.PlaneGeometry(2*X,2*X).rotateX(PI/2),new THREE.MeshStandardMaterial({map:T.tex(T.glory()),metalness:.5,roughness:.4,side:THREE.DoubleSide}));gl.position.y=E+.1;g.add(gl);
    // four great volutes (dolphin-back ribs) rising to the crowning orb and cross
    for(const sx of [-1,1])for(const sz of [-1,1]){const pts=[V(sx*X*.92,E+2.2,sz*X*.92),V(sx*X*.95,E+4.2,sz*X*.95),V(sx*X*.55,E+5.6,sz*X*.55),V(sx*X*.28,E+6.2,sz*X*.28),V(sx*.9,E+6.8,sz*.9)];
      const cu=new THREE.CatmullRomCurve3(pts);const tb=new THREE.Mesh(new THREE.TubeGeometry(cu,40,.62,12),m.bronze);g.add(sh(tb));
      const tb2=new THREE.Mesh(new THREE.TubeGeometry(cu,40,.3,8),m.gold);tb2.position.y=.5;g.add(tb2);
      const sc=new THREE.Mesh(new THREE.TorusGeometry(.75,.28,8,20),m.bronze);sc.position.set(sx*X*.92,E+3.0,sz*X*.92);sc.rotation.y=Math.atan2(sx,sz)+PI/2;g.add(sh(sc));}
    const top=E+7.0;const base=new THREE.Mesh(new THREE.CylinderGeometry(.9,1.3,.8,16),m.bronze);base.position.y=top;g.add(sh(base));
    const orb=new THREE.Mesh(new THREE.SphereGeometry(.85,24,16),m.gold);orb.position.y=top+1.2;g.add(sh(orb));
    const cr=new THREE.Group();const a=new THREE.Mesh(new THREE.BoxGeometry(.22,1.7,.22),m.gold);a.position.y=.85;cr.add(a);const b=new THREE.Mesh(new THREE.BoxGeometry(1.0,.22,.22),m.gold);b.position.y=1.15;cr.add(b);cr.position.y=top+2.0;g.add(sh(cr));
    this.baldTop=top+3.7; // ~28.7 m
    // the Papal Altar on its steps
    for(let i=0;i<3;i++){const st=new THREE.Mesh(new THREE.BoxGeometry(8.2-i*1.2,.3,6.2-i*1.2),m.marbleW);st.position.y=.15+i*.3;st.receiveShadow=true;g.add(st)}
    const al=new THREE.Mesh(new THREE.BoxGeometry(3.6,1.1,1.9),new THREE.MeshStandardMaterial({map:T.tex(T.travertine(this.M,{tint:'rgba(250,240,225,.25)',joints:false})),roughness:.3}));al.position.y=.9+.55;g.add(sh(al));
    const ct=new THREE.Mesh(new THREE.BoxGeometry(3.9,.12,2.1),m.marbleW);ct.position.y=2.06;g.add(ct);
    const cross=new THREE.Group();const c1=new THREE.Mesh(new THREE.BoxGeometry(.07,1.1,.07),m.gold);c1.position.y=.55;cross.add(c1);const c2=new THREE.Mesh(new THREE.BoxGeometry(.5,.07,.07),m.gold);c2.position.y=.82;cross.add(c2);cross.position.set(0,2.12,0);g.add(cross);
    for(let i=0;i<6;i++){const x=-1.6+i*.64+(i>2?.0:0);if(Math.abs(x)<.3)continue;const cs=new THREE.Mesh(new THREE.LatheGeometry([[0,0],[.12,0],[.06,.1],[.04,.6],[.08,.65],[.03,.66],[.03,1.0],[0,1.0]].map(([r,y])=>new THREE.Vector2(r,y)),10),m.gold);cs.position.set(x,2.12,-.5);g.add(cs);
      const fl=new THREE.Sprite(new THREE.SpriteMaterial({map:T.tex(T.glowSprite('255,190,90')),blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false,color:new THREE.Color(2,1.6,1)}));fl.scale.set(.18,.28,1);fl.position.set(x,3.2,-.5);g.add(fl)}
  }
  // a standing angel (about 3.4 m): flowing robe with deep folds, torso, head with curls, raised arm with a garland, two feathered wings
  _angel(mat){const g=new THREE.Group(),fold=(geo,amp,n)=>{const P=geo.attributes.position;for(let i=0;i<P.count;i++){const x=P.getX(i),y=P.getY(i),z=P.getZ(i),a=Math.atan2(z,x),r=Math.hypot(x,z),k=1+amp*Math.sin(n*a+y*1.7)*Math.min(1,(3-y)/2.4);P.setXYZ(i,x*k+Math.sin(y*2.1)*.05,y,z*k)}geo.computeVertexNormals();return geo};
    const robe=new THREE.LatheGeometry([[0,0],[.62,.02],[.66,.25],[.52,.9],[.4,1.6],[.33,2.05],[.36,2.35],[.3,2.62],[.16,2.72],[0,2.74]].map(([r,y])=>new THREE.Vector2(r,y)),40);
    const rb=new THREE.Mesh(fold(robe,.09,9),mat);rb.scale.z=.72;g.add(rb);
    // billowing drapery sash across the body
    const sash=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(-.5,.6,.3),V(-.1,1.4,.42),V(.3,1.9,.32),V(.45,2.4,.1),V(.7,2.2,-.25)]),30,.11,8),mat);g.add(sash);
    const hd=new THREE.Mesh(new THREE.SphereGeometry(.2,18,14),mat);hd.position.set(0,2.97,.04);hd.scale.set(1,1.15,1);g.add(hd);
    for(let i=0;i<9;i++){const c=new THREE.Mesh(new THREE.SphereGeometry(.075,8,6),mat);const a=-1.3+i*.33;c.position.set(Math.sin(a)*.19,3.05+Math.cos(a)*.13,-.05+Math.cos(a)*.06);g.add(c)}
    const nk=new THREE.Mesh(new THREE.CylinderGeometry(.08,.1,.18,10),mat);nk.position.y=2.78;g.add(nk);
    const arm=(p0,p1,r=.075)=>{const v=p1.clone().sub(p0),L=v.length(),c=new THREE.Mesh(new THREE.CapsuleGeometry(r,L,4,8),mat);c.position.copy(p0).addScaledVector(v,.5);c.quaternion.setFromUnitVectors(V(0,1,0),v.normalize());g.add(c)};
    arm(V(.28,2.6,0),V(.5,3.15,.2));arm(V(.5,3.15,.2),V(.42,3.7,.35),.065); // raised right arm
    arm(V(-.28,2.6,0),V(-.48,2.15,.28));arm(V(-.48,2.15,.28),V(-.3,1.85,.5),.065); // lowered left arm
    // garland of laurel held up from the raised hand
    const gp=[];for(let i=0;i<=16;i++){const t=i/16;gp.push(V(.42-t*1.0,3.7-Math.sin(t*PI)*.9-t*1.5,.4+t*.2))}
    const gl=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(gp),40,.07,6),mat);g.add(gl);
    for(let i=1;i<16;i+=1){const l=new THREE.Mesh(new THREE.SphereGeometry(.09,6,4),mat);l.position.copy(gp[i]);l.scale.set(1,.6,1.4);g.add(l)}
    // wings: scalloped feather outline, extruded thin and curved back
    const wsh=new THREE.Shape();wsh.moveTo(0,0);wsh.bezierCurveTo(.4,.7,1.0,1.5,1.25,2.2);
    for(let i=0;i<7;i++){const t=i/6,x=1.25-t*1.1,y=2.2-t*2.6;wsh.quadraticCurveTo(x+.25,y-.12,x-.06,y-.36)}wsh.lineTo(0,0);
    const wg=new THREE.ExtrudeGeometry(wsh,{depth:.05,bevelEnabled:true,bevelThickness:.03,bevelSize:.03,bevelSegments:1,curveSegments:10});
    {const P=wg.attributes.position;for(let i=0;i<P.count;i++){const x=P.getX(i),y=P.getY(i);P.setZ(i,P.getZ(i)-x*x*.35-Math.max(0,y)*.12)}wg.computeVertexNormals()}
    for(const sd of [-1,1]){const w=new THREE.Mesh(wg,mat);w.scale.set(sd,1,1);w.position.set(sd*.12,2.35,-.22);w.rotation.y=sd*-.5;w.rotation.z=sd*-.08;g.add(w)}
    return g}
  // ---------- Confessio: sunken horseshoe before the altar, ringed by oil lamps ----------
  _confessio(){const m=this.mat,g=new THREE.Group();this.s.add(g);const Y=-2.4;
    const sh=new THREE.Shape();sh.moveTo(-5.2,3.2);sh.lineTo(-5.2,9.5);sh.absarc(0,9.5,5.2,PI,0,true);sh.lineTo(5.2,3.2);sh.lineTo(-5.2,3.2);
    const fl=new THREE.Mesh(new THREE.ShapeGeometry(sh,24).rotateX(PI/2),new THREE.MeshStandardMaterial({map:T.tex(T.naveInlay(this.M,1),{wrap:false}),roughness:.3,side:THREE.DoubleSide}));fl.position.y=Y;g.add(fl);
    const wall=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:-Y,bevelEnabled:false,curveSegments:24}).rotateX(PI/2),new THREE.MeshStandardMaterial({color:0x6a3a2a,roughness:.4,side:THREE.BackSide}));wall.position.y=0;g.add(wall);
    // gilded niche of the Pallia (front of the confessio) and bronze doors
    this.box(3.0,2.2,.3,0,Y+1.1,3.35,m.gold);this.box(1.5,1.7,.35,0,Y+.95,3.3,new THREE.MeshStandardMaterial({color:0x221810,metalness:.6,roughness:.5}));
    // balustrade with lamps
    const bal=new THREE.MeshStandardMaterial({color:0xe9e1d0,roughness:.35}),lampM=new THREE.SpriteMaterial({map:T.tex(T.glowSprite('255,180,80')),blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false,color:new THREE.Color(2.2,1.7,1)});
    const path=[];for(let i=0;i<=12;i++)path.push(V(-5.4,0,3.2+i*6.3/12));for(let i=1;i<40;i++){const a=PI-i*PI/40;path.push(V(Math.cos(a)*5.4,0,9.5+Math.sin(a)*5.4))}for(let i=12;i>=0;i--)path.push(V(5.4,0,3.2+i*6.3/12));
    for(let i=0;i<path.length-1;i++){const a=path[i],b=path[i+1],mid=a.clone().add(b).multiplyScalar(.5),len=a.distanceTo(b);const r=new THREE.Mesh(new THREE.BoxGeometry(len+.02,.14,.36),bal);r.position.set(mid.x,1.05,mid.z);r.lookAt(b.x,1.05,b.z);r.rotateY(PI/2);g.add(r);
      const p=new THREE.Mesh(new THREE.CylinderGeometry(.07,.09,.95,6),bal);p.position.set(mid.x,.5,mid.z);g.add(p);
      if(i%1===0){const l=new THREE.Mesh(new THREE.SphereGeometry(.09,8,6),m.gold);l.position.set(a.x,1.45,a.z);g.add(l);const st=new THREE.Mesh(new THREE.CylinderGeometry(.015,.015,.3,4),m.gold);st.position.set(a.x,1.25,a.z);g.add(st);
        const f=new THREE.Sprite(lampM);f.scale.set(.32,.4,1);f.position.set(a.x,1.6,a.z);g.add(f)}}
  }
  // ---------- bronze St Peter (Arnolfo di Cambio, attrib.) against the pier of St Longinus ----------
  _peter(){const g=new THREE.Group();this.s.add(g);const x=D.NHW-.5,z=D.PIER+6.0; // nave side of the right crossing pier
    g.position.set(x,0,z);g.rotation.y=-PI/2;
    const ped=new THREE.MeshStandardMaterial({map:T.tex(T.travertine(this.M,{tint:'rgba(235,225,205,.25)',joints:false})),roughness:.3});
    const p=new THREE.Mesh(new THREE.BoxGeometry(2.4,1.7,1.4),ped);p.position.set(0,.85,.4);p.castShadow=p.receiveShadow=true;g.add(p);this.casters.push(p);
    const fr=new THREE.Mesh(new THREE.BoxGeometry(3.3,4.6,.3),this.mat.travWarm);fr.position.set(0,3.6,-.25);g.add(fr);
    // red-and-gold brocade panel behind the statue (the real one is a mosaic imitating a hanging)
    const bc=document.createElement('canvas');bc.width=256;bc.height=384;{const c=bc.getContext('2d');c.fillStyle='#6e1a16';c.fillRect(0,0,256,384);c.strokeStyle='rgba(214,170,90,.55)';c.lineWidth=3;
      for(let y=0;y<384;y+=64)for(let x0=0;x0<256;x0+=64){const cx=x0+(y/64%2)*32+16,cy=y+32;c.beginPath();c.ellipse(cx,cy,14,22,0,0,6.3);c.stroke();c.beginPath();c.moveTo(cx,cy-30);c.lineTo(cx,cy+30);c.stroke()}
      c.strokeStyle='#c9a24e';c.lineWidth=10;c.strokeRect(5,5,246,374)}
    const ph=new THREE.Mesh(new THREE.PlaneGeometry(2.3,3.4),new THREE.MeshStandardMaterial({map:T.tex(bc,{wrap:false}),roughness:.6}));ph.position.set(0,1.7+1.75,-.09);g.add(ph);this.peterG=g;
    // marble throne
    const S=1.3,tz=.35,th=this.mat.marbleW;this.peterS=S;
    const bx=(w,h,d,x0,y0,z0,m=th)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x0,y0,z0);o.castShadow=o.receiveShadow=true;g.add(o);return o};
    bx(.86*S,.44*S,.62*S,0,1.7+.22*S,tz-.13*S);bx(.86*S,.95*S,.1*S,0,1.7+.9*S,tz-.47*S);
    for(const sx of[-1,1]){bx(.07*S,.06*S,.5*S,sx*.45*S,1.7+.66*S,tz-.2*S);bx(.06*S,.22*S,.06*S,sx*.45*S,1.7+.53*S,tz+.02*S);const k=new THREE.Mesh(new THREE.SphereGeometry(.06*S,12,8),this.mat.gold);k.position.set(sx*.44*S,1.7+1.4*S,tz-.47*S);g.add(k)}
    const halo=new THREE.Mesh(new THREE.TorusGeometry(.2*S,.012*S,8,48),this.mat.gold);halo.position.set(0,1.7+1.31*S,tz-.19*S);g.add(halo);
    const hd=new THREE.Mesh(new THREE.CircleGeometry(.2*S,48),new THREE.MeshStandardMaterial({color:0x8a6a32,metalness:.6,roughness:.5,transparent:true,opacity:.35}));hd.position.copy(halo.position);hd.position.z-=.01;g.add(hd);
    const arch=new THREE.Mesh(new THREE.TorusGeometry(1.4,.12,6,24,PI),this.mat.gold);arch.position.set(0,4.9,-.05);g.add(arch);
    {const L=new THREE.PointLight(0xffe2b8,9,7,1.5);L.position.set(0,3.4,3.2);g.add(L);const L2=new THREE.PointLight(0xfff0dc,4,6,1.6);L2.position.set(-1.6,2.4,2.2);g.add(L2)}
    this.peterPos=new THREE.Vector3(x,3.2,z);
  }
  // ---------- modelled statues (tools/sculpt): bronze St Peter, the four crossing statues, six founder saints ----------
  // Each figure is sculpted as a signed-distance model (anatomy, drapery folds, faces, hands, attributes), meshed at ~5 mm,
  // decimated, and carries its own baked tangent-space normal map and ambient-occlusion map (meshopt-compressed GLB).
  async _sculpt(k){this._sc=this._sc||{};if(this._sc[k])return this._sc[k];
    const {GLTFLoader,MeshoptDecoder}=await import('three');const lo=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const dir=this.mobile?'assets/statues/lo/':'assets/statues/',tl=(f,srgb)=>T.loadImg(dir+f).then(im=>{if(!im)return null;const t=new THREE.Texture(im);t.flipY=false;t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;t.anisotropy=4;t.needsUpdate=true;return t}).catch(()=>null);
    const bronze=k==='peter'||k==='angel',photo=k!=='angel'; // photo: colour map projected from real photographs (tools/photoproj)
    return this._sc[k]=Promise.all([lo.loadAsync(dir+k+'.glb'),tl(k+'_n.jpg',false),tl(k+'_ao.jpg',false),photo?tl(k+'_c.jpg',true):null]).then(([gl,n,ao,c])=>{
      let node=null;gl.scene.updateMatrixWorld(true);gl.scene.traverse(o=>{if(o.isMesh&&!node)node=o});
      node.removeFromParent();node.matrix.copy(node.matrixWorld);node.matrix.decompose(node.position,node.quaternion,node.scale);
      const opt={normalMap:n,normalScale:new THREE.Vector2(1,-1),aoMap:ao,aoMapIntensity:bronze?.8:(c?.45:.6)};
      const mat=k==='peter'?new THREE.MeshStandardMaterial({...opt,map:c,color:new THREE.Color(.95,.88,.8),metalness:.42,roughness:.42,envMapIntensity:1.3})
        :k==='angel'?new THREE.MeshStandardMaterial({...opt,color:0xe2b45c,metalness:.95,roughness:.3,envMapIntensity:1.4})
        :new THREE.MeshStandardMaterial({...opt,...(c?{map:c,color:new THREE.Color(1.02,1.0,.97)}:{color:0xf1ebdf}),roughness:.46,metalness:0,envMapIntensity:.7,emissive:0x221f1a});
      node.material=mat;node.castShadow=!this.mobile;node.receiveShadow=true;const box=new THREE.Box3().setFromObject(node);return {node,box,mat}})}
  _place(r,parent,height,x0,y0,z0,rot=0,scl=0,cx=true){const b=r.box,s=scl||height/(b.max.y-b.min.y),o=new THREE.Group(),m=r.node.clone();o.add(m);
    o.scale.setScalar(s);o.position.set(x0-(cx?(b.min.x+b.max.x)/2*s:0),y0-b.min.y*s,z0);o.rotation.y=rot;parent.add(o);this.casters.push(m);return o}
  async _statues(){const names=['longinus','helena','veronica','andrew'];
    const pe=this._sculpt('peter').then(r=>{const S=this.peterS,o=new THREE.Group(),m=r.node.clone();o.add(m);o.scale.setScalar(S);o.position.set(0,1.7,.35);this.peterG.add(o);this.casters.push(m)});
    const an=this._sculpt('angel').then(r=>(this.angelSlots||[]).forEach((slot,i)=>{slot.updateWorldMatrix(true,true);const b=new THREE.Box3().setFromObject(slot),h=(b.max.y-b.min.y)/slot.getWorldScale(new THREE.Vector3()).y;slot.clear();
      const o=this._place(r,slot,h*1.2,0,.6,-.1);if(i%2)o.scale.x*=-1}));
    await Promise.all([pe,an,...this.niches.map((f,q)=>this._sculpt(names[q]).then(r=>this._place(r,f,0,0,.45,-1.2,0,2.75)))].map(p=>p.catch(e=>console.warn('statue',e))));}
  async _saints(){const ks=['f_teresa','f_vincent','f_neri','f_ignatius','f_paola','f_benedict'];
    const rs=await Promise.all(ks.map(k=>this._sculpt(k).catch(e=>{console.warn('saint',k,e);return null})));
    (this.saintSpots||[]).forEach(([p,rot],i)=>{const r=rs[i%rs.length];if(!r)return;const w=new THREE.Group();w.position.copy(p);w.rotation.y=rot;this.s.add(w);this._place(r,w,0,0,0,-.8,0,2.15,false)})}
  async _pieta(){ // 3D scan of the Statens Museum for Kunst plaster cast (public domain, via Wikimedia Commons), decimated to 70k triangles
    const {GLTFLoader}=await import('three');const cz=archCentres[3],x=D.AISLE1+7.6;
    // pedestal, chapel decoration and protective glass
    const ped=this.box(2.6,1.9,1.6,x,.95,cz,new THREE.MeshStandardMaterial({map:T.tex(T.travertine(this.M,{tint:'rgba(250,230,210,.2)',joints:false})),roughness:.25}),{cast:true});
    this.box(.3,5.2,4.4,x+1.9,4.6,cz,this.mat.gold);this.box(.35,4.8,4.0,x+1.85,4.6,cz,new THREE.MeshStandardMaterial({map:T.tex(this.M.brown),roughness:.45}));this.box(.3,3.0,.26,x+1.65,8.9,cz,this.mat.gold);this.box(.3,.26,1.7,x+1.65,9.6,cz,this.mat.gold);
    this.box(.2,.6,8,D.AISLE1+1.6,.3,cz,this.mat.trav);
    const glass=new THREE.Mesh(new THREE.PlaneGeometry(9.6,9),new THREE.MeshPhysicalMaterial({color:0xe8f0f0,roughness:.05,metalness:0,transparent:true,opacity:.1,side:THREE.DoubleSide,depthWrite:false}));glass.position.set(D.AISLE1+1.6,4.5,cz);glass.rotation.y=PI/2;this.s.add(glass);
    const spot=new THREE.SpotLight(0xfff0dc,22,24,.45,.7,1.2);spot.castShadow=true;spot.shadow.mapSize.set(1024,1024);spot.position.set(D.AISLE1+1,9,cz+2);spot.target.position.set(x,2.6,cz);this.s.add(spot,spot.target);
    this.pietaPos=new THREE.Vector3(x,2.7,cz);
    try{const gl=await new GLTFLoader().loadAsync('assets/models/pieta.glb');const o=gl.scene;
      const mm=new THREE.MeshPhysicalMaterial({color:0xe9e2d6,roughness:.55,metalness:0,sheen:.3,sheenColor:new THREE.Color(0xfff6e8)});
      o.traverse(c=>{if(c.isMesh){c.material=mm;c.castShadow=c.receiveShadow=true;c.geometry.computeVertexNormals()}});
      const b=new THREE.Box3().setFromObject(o),sz=b.getSize(new THREE.Vector3()),s=1.74/sz.y;o.scale.setScalar(s);
      const c=b.getCenter(new THREE.Vector3());o.position.set(-c.x*s,-b.min.y*s,-c.z*s);
      const wrap=new THREE.Group();wrap.add(o);wrap.position.set(x,1.9,cz);wrap.rotation.y=this.pietaRot??-PI/2;this.s.add(wrap);this.pieta=wrap;
    }catch(e){console.warn('Pietà model failed',e)}
  }
  // soft shafts of sunlight from the drum and nave windows
  _beams(){const m=new THREE.MeshBasicMaterial({map:T.tex(T.gradientBeam(),{wrap:false}),transparent:true,opacity:.045,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
    const beam=(from,to,w)=>{const len=from.distanceTo(to),o=new THREE.Mesh(new THREE.PlaneGeometry(w,len).translate(0,-len/2,0),m);o.position.copy(from);o.lookAt(to);o.rotateX(-PI/2);
      const o2=o.clone();o2.rotateY(PI/2);this.s.add(o,o2)};
    for(const a of [-2.4,-2.0,-1.6]){const f=V(Math.sin(a)*20,60,Math.cos(a)*20);beam(f,V(-f.x*.15+6,0,-f.z*.15+4),2.6)}
    for(const zc of archCentres.slice(1))beam(V(-12.5,34,zc),V(2,6,zc-7),3.5);
  }
}
