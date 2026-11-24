// Tour engine: renderer, light, bloom, first-person walk (joystick + drag-look + pinch zoom) and free orbit camera.
// The walk/free-cam controls are carried over from "Checkmate in the Sistine" (same eye height, joystick and gestures).
import * as THREE from 'three';
import { RoomEnvironment, EffectComposer, RenderPass, UnrealBloomPass, OutputPass } from 'three';
import { Basilica, D, archCentres } from './basilica.js?v=56';
import { tex, hotspot } from './textures.js?v=56';
const EYE=2.05; // adult eye height, metres (as in the chapel game)
const easeIO=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
export const PLACES=[ // id, name, where to stand, what to look at, info point position
  {id:'entrance',name:'Nave',stand:[0,118],look:[0,14,0],hot:[0,3.2,112],title:'The nave',
   text:'The nave stretches about 186 metres from the entrance to the apse, making St Peter’s one of the largest churches in the world. Carlo Maderno lengthened Michelangelo’s Greek-cross plan into this Latin cross between 1607 and 1615, and the gilded coffered vault rises about 46 metres above the floor. Near the central door lies the red porphyry disc on which, by tradition, Charlemagne knelt to be crowned emperor by Pope Leo III on Christmas Day in the year 800.'},
  {id:'dome',name:'Dome',stand:[0,18],look:[0,100,-1],hot:[0,52,-8],title:'Michelangelo’s dome',
   text:'Michelangelo designed the great dome, and Giacomo della Porta and Domenico Fontana completed it in 1590. It is about 41.5 metres across inside, and its lantern rises about 117 metres above the floor. Around its base, gold mosaic letters nearly two metres high carry Christ’s words to Peter: “Tu es Petrus”, “You are Peter, and on this rock I will build my Church.”'},
  {id:'baldacchino',name:'Baldacchino',stand:[-9,24],look:[0,14,0],hot:[-4.5,8,12],title:'Bernini’s baldacchino',
   text:'Gian Lorenzo Bernini made this bronze canopy between 1623 and 1634 for Pope Urban VIII. It rises about 29 metres over the Papal Altar, and its four twisted columns recall the ancient spiral columns of Old St Peter’s, which tradition linked to the Temple in Jerusalem. Only the Pope, or a priest he delegates, celebrates Mass at this altar.'},
  {id:'confessio',name:'Tomb of St Peter',stand:[0,16.5],look:[0,-1.5,4],hot:[1.2,1.8,10],title:'The Confessio and the tomb of St Peter',
   text:'Directly beneath the Papal Altar, deep below the floor, lies the tomb of St Peter, the Apostle and first Bishop of Rome, who was martyred here on the Vatican Hill in the 60s AD. The sunken Confessio in front of the altar, ringed by oil lamps that are kept burning, leads pilgrims down towards his resting place.'},
  {id:'cathedra',name:'Chair of St Peter',stand:[0,-26],look:[0,13,-60],hot:[2,6,-38],title:'The Chair of St Peter (Cathedra Petri)',
   text:'Bernini’s Chair of St Peter (1657–66) encloses an ancient wooden chair long venerated as the chair of St Peter, a sign of the teaching authority of the Pope as Peter’s successor. Four Doctors of the Church, Ambrose, Augustine, Athanasius and John Chrysostom, uphold it. Above, the alabaster window of the Holy Spirit shines with the Dove amid a glory of gilded rays and angels.'},
  {id:'pieta',name:'Pietà',stand:[25,114],look:[38.6,2.6,114.1],hot:[32.3,4.6,114.6],title:'Michelangelo’s Pietà',
   text:'Michelangelo carved the Pietà from a single block of Carrara marble in 1498–99, when he was about 24. It shows the Virgin Mary holding the body of her Son after He was taken down from the Cross, and it is the only work Michelangelo ever signed, on the sash across Mary’s breast. It has been protected behind glass since 1972. (The 3D model here is a public-domain scan of a plaster cast.)'},
  {id:'sacrament',name:'Blessed Sacrament',stand:[25.5,66.6],look:[41,4.2,66.6],hot:[36.5,4.4,64.4],title:'The Chapel of the Blessed Sacrament',
   text:'Here the Blessed Sacrament is reserved, and the chapel is kept for silent prayer before Christ present in the Eucharist. Bernini’s gilded bronze tabernacle (1674), modelled on Bramante’s Tempietto, is flanked by two kneeling angels in adoration. Behind it hangs Pietro da Cortona’s Holy Trinity, one of the very few paintings in the basilica that was never replaced by a mosaic.'},
  {id:'gregorian',name:'Gregorian Chapel',stand:[25,34],look:[25,6.5,19],hot:[27.2,4.6,21.5],title:'The Gregorian Chapel',
   text:'Designed by Michelangelo and completed by Giacomo della Porta in 1583 for Pope Gregory XIII, this chapel sits beneath one of the basilica’s minor domes. Over its altar is the Madonna del Soccorso, Our Lady of Succour, a venerated 12th-century image brought from the old basilica. Beneath the altar rest the relics of St Gregory of Nazianzus, Doctor of the Church.'},
  {id:'clementine',name:'Clementine Chapel',stand:[-25,34],look:[-25,6.5,19],hot:[-22.8,4.6,21.5],title:'The Clementine Chapel',
   text:'Named after Pope Clement VIII, who had it decorated with marbles and mosaics for the Jubilee of 1600, this chapel keeps the remains of Pope St Gregory the Great (590–604) beneath its altar. The mosaic altarpiece (1772), after Andrea Sacchi, shows the miracle of the cloth from the tomb of the martyrs that bled when Gregory pierced it. On the left wall is Thorvaldsen’s monument to Pope Pius VII.'},
  {id:'peter',name:'St Peter statue',stand:[4.5,37],look:[12.5,3.0,37],hot:[10.4,4.0,37.4],title:'The bronze statue of St Peter',
   text:'This bronze of St Peter enthroned, holding the keys of the Kingdom and raising his hand in blessing, is attributed to Arnolfo di Cambio in the late 13th century. For centuries pilgrims have touched and kissed its right foot, wearing it smooth. On the Solemnity of Saints Peter and Paul, 29 June, the statue is vested in papal robes.'},
];
const P2=(x,z)=>new THREE.Vector3(x,0,z);
export class Tour{
  constructor(host,{onPlace,onInfo,onStatus}={}){
    this.host=host;this.onInfo=onInfo||(()=>{});this.onStatus=onStatus||(()=>{});
    const mobile=this.mobile=/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)||Math.min(screen.width,screen.height)<700;
    const r=this.renderer=new THREE.WebGLRenderer({antialias:!mobile,powerPreference:'high-performance',preserveDrawingBuffer:true});
    r.setPixelRatio(Math.min(window.devicePixelRatio||1,mobile?1.5:2));r.shadowMap.enabled=true;r.shadowMap.type=mobile?THREE.PCFShadowMap:THREE.PCFSoftShadowMap; // lighter quality path on phones
    if(mobile)r.shadowMap.autoUpdate=false; // the sun and building are static: phones redraw the shadow map only every 45 frames
    r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1.0;r.outputColorSpace=THREE.SRGBColorSpace;host.appendChild(r.domElement);
    const sc=this.scene=new THREE.Scene();sc.background=new THREE.Color(0x2a2016);
    const pm=new THREE.PMREMGenerator(r);sc.environment=pm.fromScene(new RoomEnvironment(),0.04).texture;sc.environmentIntensity=.3;
    this.camera=new THREE.PerspectiveCamera(70,1,0.25,450);this.camera.rotation.order='YXZ';
    // light: warm sky fill, low afternoon sun through the south windows, soft fill lamps
    sc.add(new THREE.HemisphereLight(0xfff0d8,0x6a5440,.55));
    const sun=this.sun=new THREE.DirectionalLight(0xffdcae,1.5);sun.position.set(-45,80,30);sun.target.position.set(0,0,0);sc.add(sun,sun.target);
    sun.castShadow=true;const S=sun.shadow;S.mapSize.set(mobile?1024:2048,mobile?1024:2048);Object.assign(S.camera,{left:-30,right:30,top:30,bottom:-30,near:20,far:200});S.bias=-.0005;S.normalBias=.04;S.radius=4;
    for(const [x,y,z,i] of [[0,40,100,260],[0,40,60,260],[0,30,0,420],[0,30,-40,260],[42,25,0,200],[-42,25,0,200],[25,19,80,90],[-25,19,80,90],[36,14,114,60]]){const p=new THREE.PointLight(0xffd9a8,i*.12,90,1);p.position.set(x,y,z);sc.add(p)}
    // bloom on the bright windows only
    this.composer=new EffectComposer(r);this.composer.addPass(new RenderPass(sc,this.camera));
    this.bloom=new UnrealBloomPass(new THREE.Vector2(256,256),.4,.5,1.0);this.composer.addPass(this.bloom);this.composer.addPass(new OutputPass());
    this.basilica=new Basilica(sc,r,{mobile,onProgress:s=>this.onStatus(s)});
    this.walk={pos:P2(0,118),vel:new THREE.Vector3(),yaw:0,yawT:0,pitch:.08,pitchT:.08,fov:70,fovTo:70,phase:0,glide:null};
    this.speedMul=6;
    this.mode='Walk';this.keys=new Set();this.joy={x:0,y:0,id:null};this.look={};this.ray=new THREE.Raycaster();
    this._buildUI();this._bindInput();addEventListener('resize',()=>this.resize());this.resize();
    const loop=t=>{requestAnimationFrame(loop);this._tick(t)};requestAnimationFrame(loop);
  }
  async init(){await this.basilica.build();this._envFromBasilica();this._hotspots();try{this._walkGrid()}catch(e){console.warn('walk grid',e)}this._seatPlaces();this.ready=true}
  // image-based light baked from the finished interior (one cube render from the nave near the crossing), so marble and gilding reflect the real church
  _envFromBasilica(){try{const sc=this.scene,pm=new THREE.PMREMGenerator(this.renderer),old=sc.environment;sc.position.set(0,-9,-34);sc.updateMatrixWorld(true);
      const rt=pm.fromScene(sc,0.015,0.5,320);sc.position.set(0,0,0);sc.updateMatrixWorld(true);sc.environment=rt.texture;sc.environmentIntensity=this.mobile?.75:.85;old?.dispose?.();pm.dispose()}catch(e){console.warn('env',e)}}
  // ---------- floor plan: where a pilgrim can stand ----------
  inside(x,z,m=.45){const {NHW,ENTR,PIER,CROSS:C,AISLE0:A0,AISLE1:A1,APSE_C,TRANS_C}=D,R=(x0,x1,z0,z1)=>x>x0+m&&x<x1-m&&z>z0+m&&z<z1-m;
    if(R(-NHW,NHW,PIER-.5,ENTR))return true; // nave
    for(const s of [-1,1]){if(R(s>0?A0:-A1,s>0?A1:-A0,PIER,ENTR))return true;
      for(const zc of archCentres)if(R(s>0?NHW-1:-A0,s>0?A0:-NHW+1,zc-D.ARCH_HW,zc+D.ARCH_HW))return true; // arcades
      if(s>0&&R(A1-1,A1+1.6,archCentres[3]-5,archCentres[3]+5))return true; // in front of the Pietà glass
      if(s>0&&R(A1-1,A1+9.6,archCentres[1]-5,archCentres[1]+5))return true; // Chapel of the Blessed Sacrament
      if(R(s>0?A0:-A1,s>0?A1:-A0,19,PIER+1))return true; // Gregorian / Clementine corner chapels
      if(R(s>0?A0:-A1,s>0?A1:-A0,-PIER-1,-19))return true;} // Madonna of the Column / Sts Michael & Petronilla
    if(Math.abs(x)<C-m&&Math.abs(z)<C-m&&Math.abs(x)+Math.abs(z)<12+C-m*1.4)return true; // crossing octagon
    if(R(-12,12,-PIER,C+1)||R(-PIER,PIER,-12,12))return true; // arch tunnels
    if(R(-NHW,NHW,APSE_C,-PIER+.5)||Math.hypot(x,z-APSE_C)<NHW-m&&z<APSE_C)return true; // apse arm
    for(const s of [-1,1]){const xx=s*x;if(xx>PIER-.5&&xx<TRANS_C&&Math.abs(z)<NHW-m||xx>=TRANS_C&&Math.hypot(xx-TRANS_C,z)<NHW-m)return true}
    return false}
  blocked(x,z){const r=.4,b=(x0,x1,z0,z1)=>x>x0-r&&x<x1+r&&z>z0-r&&z<z1+r;
    for(const sx of [-1,1])for(const sz of [-1,1])if(b(sx*5.6-1.4,sx*5.6+1.4,sz*5.6-1.4,sz*5.6+1.4))return true; // baldacchino pedestals
    if(b(-4.1,4.1,-3.1,3.1))return true; // altar steps
    if(b(-5.6,5.6,3,15))return true; // confessio balustrade
    if(b(D.NHW-1.8,D.NHW,D.PIER+4.6,D.PIER+7.4))return true; // St Peter pedestal
    if(b(-3.5,3.5,D.APSE_C-D.NHW+1,D.APSE_C-D.NHW+5.5))return true; // apse altar
    for(const s of [-1,1])if(b(s*25-2.7,s*25+2.7,19,22))return true; // corner chapel altars
    if(b(D.AISLE1+5.6,D.AISLE1+10,archCentres[1]-3.8,archCentres[1]+3.8))return true; // Blessed Sacrament altar and railing
    return false}
  // walkable floor taken from the built geometry: everything solid between ankle and head height (walls, piers, columns, altars, railings, pedestals)
  // is sliced into a 20 cm grid, grown by the body radius, then flood-filled from the door so only floor inside the church is reachable
  _walkGrid(){const t0=performance.now(),S=.2,X0=-72,Z0=-64,W=720,H=Math.ceil((D.ENTR+.2-Z0)/S),occ=new Uint8Array(W*H),ys=[.3,1,1.75];
    const mark=(x,z)=>{const i=Math.floor((x-X0)/S),j=Math.floor((z-Z0)/S);if(i>=0&&j>=0&&i<W&&j<H)occ[j*W+i]=1};
    const seg=(ax,az,bx,bz)=>{const n=Math.max(1,Math.ceil(Math.hypot(bx-ax,bz-az)/(S*.5)));for(let k=0;k<=n;k++)mark(ax+(bx-ax)*k/n,az+(bz-az)*k/n)};
    const vis=o=>{for(let q=o;q;q=q.parent)if(!q.visible)return false;return true};
    const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),M=new THREE.Matrix4(),box=new THREE.Box3();let tris=0;
    this.scene.updateMatrixWorld(true);
    this.scene.traverse(o=>{if(!o.isMesh||!vis(o))return;const mt=Array.isArray(o.material)?o.material[0]:o.material;if(!mt||mt.depthWrite===false||mt.blending===THREE.AdditiveBlending||mt.opacity<.05)return;
      const g=o.geometry,P=g.attributes.position;if(!P)return;if(!g.boundingBox)g.computeBoundingBox();const n=o.isInstancedMesh?o.count:1;
      for(let q=0;q<n;q++){M.copy(o.matrixWorld);if(o.isInstancedMesh){const im=new THREE.Matrix4();o.getMatrixAt(q,im);M.multiply(im)}
        box.copy(g.boundingBox).applyMatrix4(M);if(box.min.y>ys[2]||box.max.y<ys[0])continue;
        const I=g.index,nt=(I?I.count:P.count)/3;
        if(nt>20000){for(let x=box.min.x;x<=box.max.x;x+=S)for(let z=box.min.z;z<=box.max.z;z+=S)mark(x,z);continue} // detailed statues: their footprint
        tris+=nt;
        for(let t=0;t<nt;t++){const i0=I?I.getX(3*t):3*t,i1=I?I.getX(3*t+1):3*t+1,i2=I?I.getX(3*t+2):3*t+2;
          a.fromBufferAttribute(P,i0).applyMatrix4(M);b.fromBufferAttribute(P,i1).applyMatrix4(M);c.fromBufferAttribute(P,i2).applyMatrix4(M);
          const lo=Math.min(a.y,b.y,c.y),hi=Math.max(a.y,b.y,c.y);
          for(const y of ys){if(y<lo||y>hi)continue;const p=[];for(const [u,v] of [[a,b],[b,c],[c,a]]){if((u.y-y)*(v.y-y)<=0&&u.y!==v.y){const f=(y-u.y)/(v.y-u.y);p.push(u.x+(v.x-u.x)*f,u.z+(v.z-u.z)*f)}}
            if(p.length>=4)seg(p[0],p[1],p[2],p[3]);else if(p.length===2)mark(p[0],p[1])}}}});
    // grow by the body radius (about 40 cm)
    const R=2,dil=new Uint8Array(W*H);for(let j=0;j<H;j++)for(let i=0;i<W;i++)if(occ[j*W+i])for(let dj=-R;dj<=R;dj++)for(let di=-R;di<=R;di++){if(di*di+dj*dj>R*R+1)continue;const ii=i+di,jj=j+dj;if(ii>=0&&jj>=0&&ii<W&&jj<H)dil[jj*W+ii]=1}
    // flood fill from the entrance; stop at the floor's edge so nobody can leave the building
    const reach=new Uint8Array(W*H),st=[],seed=(x,z)=>{const i=Math.floor((x-X0)/S),j=Math.floor((z-Z0)/S),k=j*W+i;if(!dil[k]&&!reach[k]){reach[k]=1;st.push(k)}};
    seed(this.walk.pos.x,this.walk.pos.z);let edge=false;
    while(st.length){const k=st.pop(),i=k%W,j=(k-i)/W;if(i<=1||j<=1||i>=W-2||j>=H-2){edge=true;continue}
      for(const d of [1,-1,W,-W]){const m=k+d;if(!dil[m]&&!reach[m]){reach[m]=1;st.push(m)}}}
    let cnt=0;for(let k=0;k<W*H;k++)cnt+=reach[k];
    this.grid={S,X0,Z0,W,H,reach,edge,cnt,tris,ms:Math.round(performance.now()-t0)};if(edge)console.warn('walk grid reached the floor edge');}
  ok(x,z){const G=this.grid;if(!G||G.edge)return this.inside(x,z)&&!this.blocked(x,z);
    const i=Math.floor((x-G.X0)/G.S),j=Math.floor((z-G.Z0)/G.S);if(i<0||j<0||i>=G.W||j>=G.H||!G.reach[j*G.W+i])return false;
    return !this.blocked(x,z)}
  // nearest cell a pilgrim can actually stand on (used when a glide ends inside a balustrade or pier)
  _nearestOk(x,z){if(this.ok(x,z))return {x,z};const G=this.grid;
    if(G&&!G.edge){const i0=Math.floor((x-G.X0)/G.S),j0=Math.floor((z-G.Z0)/G.S);
      for(let r=1;r<=56;r++){let best=null,bd=1e9;for(let dj=-r;dj<=r;dj++)for(let di=-r;di<=r;di++){if(Math.max(Math.abs(di),Math.abs(dj))!==r)continue;
        const i=i0+di,j=j0+dj;if(i<1||j<1||i>=G.W-1||j>=G.H-1)continue;if(!G.reach[j*G.W+i])continue;
        const cx=G.X0+(i+.5)*G.S,cz=G.Z0+(j+.5)*G.S;if(this.blocked(cx,cz))continue;const d=(cx-x)**2+(cz-z)**2;if(d<bd){bd=d;best={x:cx,z:cz}}}
        if(best)return best}}
    for(let r=1;r<=36;r++)for(let k=0;k<20;k++){const a=k/20*Math.PI*2,cx=x+Math.cos(a)*r*.45,cz=z+Math.sin(a)*r*.45;if(this.ok(cx,cz))return {x:cx,z:cz}}
    return null}
  _unstick(w){if(this.ok(w.pos.x,w.pos.z))return;const n=this._nearestOk(w.pos.x,w.pos.z);if(!n)return;w.pos.x=n.x;w.pos.z=n.z;w.vel.set(0,0,0)}
  // every place button must finish on a walkable cell, never inside the confessio or a pier
  _seatPlaces(){for(const p of PLACES){if(this.ok(p.stand[0],p.stand[1]))continue;const n=this._nearestOk(p.stand[0],p.stand[1]);if(n)p.stand=[n.x,n.z]}}
  ceiling(x,z){if(Math.hypot(x,z)<21)return 105;if(Math.abs(x)<13||Math.abs(z)<13)return 32+Math.sqrt(Math.max(0,169-Math.min(x*x,z*z)));return 21}
  // ---------- UI: joystick, zoom, info points ----------
  _buildUI(){const h=this.host;
    const z=this.zoomUI=document.createElement('div');z.className='zoomui';z.innerHTML='<button aria-label="Zoom in" data-z="0.7">+</button><button aria-label="Zoom out" data-z="1.43">−</button><button class="spd" data-s="1" aria-label="Walk speed 1 times">1×</button><button class="spd" data-s="3" aria-label="Walk speed 3 times">3×</button><button class="spd" data-s="6" aria-label="Walk speed 6 times">6×</button>';
    z.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.z)this.zoom(+b.dataset.z);else if(b.dataset.s)this.setSpeed(+b.dataset.s)});h.appendChild(z);
    const j=this.joyUI=document.createElement('div');j.className='joy';j.innerHTML='<div class="knob"></div>';h.appendChild(j);
    const J=this.joy,R=70,knob=j.firstChild;
    const setK=(dx,dy)=>{const l=Math.hypot(dx,dy),s=l>R?R/l:1;dx*=s;dy*=s;knob.style.transform=`translate(${dx}px,${dy}px)`;let x=dx/R,y=dy/R;const m=Math.hypot(x,y);if(m<.15){x=y=0}else{const k=(m-.15)/.85/m;x*=k;y*=k}J.x=x;J.y=y};
    const centre=()=>{const r=j.getBoundingClientRect();J.cx=r.left+r.width/2;J.cy=r.top+r.height/2};
    j.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();if(J.id!=null&&J.id!==e.pointerId)return;try{j.setPointerCapture(e.pointerId)}catch(_){}J.id=e.pointerId;centre();setK(e.clientX-J.cx,e.clientY-J.cy);this.walk.glide=null});
    j.addEventListener('pointermove',e=>{if(e.pointerId===J.id){e.preventDefault();setK(e.clientX-J.cx,e.clientY-J.cy)}});
    const end=e=>{if(e.pointerId!==J.id)return;J.id=null;setK(0,0)};['pointerup','pointercancel','lostpointercapture'].forEach(t=>j.addEventListener(t,end));
    j.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});this.resetJoy=()=>{J.id=null;setK(0,0)};this.setSpeed(6);
  }
  setSpeed(m){this.speedMul=m;[...this.zoomUI.querySelectorAll('[data-s]')].forEach(b=>b.classList.toggle('on',+b.dataset.s===m))}
  _hotspots(){const m=new THREE.SpriteMaterial({map:tex(hotspot()),depthTest:false,transparent:true,toneMapped:false});this.hots=[];
    for(const p of PLACES){const s=new THREE.Sprite(m);s.position.set(...p.hot);s.scale.set(1,1,1);s.renderOrder=10;s.userData.place=p.id;this.scene.add(s);this.hots.push(s)}}
  zoom(f){if(this.mode==='Free')return this._dolly(f);this.walk.fovTo=THREE.MathUtils.clamp(this.walk.fovTo*f,15,75)}
  // ---------- go to a place ----------
  goTo(id){const p=PLACES.find(q=>q.id===id);if(!p)return;if(this.mode==='Free'){this._freeTo(p);return}
    const w=this.walk,to=P2(...p.stand),L=new THREE.Vector3(...p.look),dx=L.x-to.x,dz=L.z-to.z,hd=Math.hypot(dx,dz);
    let yaw=Math.atan2(-dx,-dz),pitch=Math.atan2(L.y-EYE,hd);pitch=Math.min(pitch,THREE.MathUtils.degToRad(89));let dy=yaw-w.yawT;dy=Math.atan2(Math.sin(dy),Math.cos(dy));yaw=w.yawT+dy;
    const path=this._route(w.pos,to),Ls=[0];for(let i=1;i<path.length;i++)Ls.push(Ls[i-1]+path[i].distanceTo(path[i-1]));const len=Ls[Ls.length-1];
    w.glide={path,L:Ls,len,t0:performance.now(),dur:THREE.MathUtils.clamp(900+len*14,900,4200),y0:w.yawT,y1:yaw,p0:w.pitchT,p1:pitch,f0:w.fovTo,f1:p.id==='dome'?75:p.id==='pieta'?38:p.id==='peter'?45:65};this.current=id}
  _route(a,b){ // via the nave centreline / crossing so the glide never cuts through piers
    const hub=[P2(0,a.z>D.PIER?Math.min(a.z,D.ENTR-4):0)],pts=[a.clone()];
    const zone=p=>p.z>D.PIER-1&&Math.abs(p.x)>D.NHW?'aisle':p.z>D.PIER-1?'nave':'cross';
    if(zone(a)==='aisle')pts.push(P2(Math.sign(a.x)*16,a.z),P2(0,a.z));
    const bz=zone(b);if(zone(a)!=='cross'&&bz==='cross')pts.push(P2(0,22));
    if(zone(a)==='cross'&&bz!=='cross')pts.push(P2(0,22));
    if(bz==='aisle')pts.push(P2(0,b.z),P2(Math.sign(b.x)*16,b.z));
    pts.push(b.clone());
    // skip the baldacchino/altar block when crossing the crossing
    const out=[pts[0]];for(let i=1;i<pts.length;i++){const A=out[out.length-1],B=pts[i];if((A.z>0)!==(B.z>0)&&Math.abs(A.x+B.x)/2<9&&(A.z<-3||B.z<-3)){const s=A.x+B.x>=0?1:-1;out.push(P2(s*10.5,Math.max(A.z,-2)>0?16:A.z),P2(s*10.5,B.z<0?Math.max(B.z,-15):16))}out.push(B)}
    return out}
  // ---------- per-frame walk ----------
  _walkStep(now,dt){const w=this.walk,c=this.camera;
    if(w.glide){const g=w.glide,t=Math.min(1,Math.max(0,(now-g.t0)/g.dur)),e=easeIO(t),s=e*g.len;let i=1;while(i<g.L.length-1&&g.L[i]<s)i++;
      const seg=g.L[i]-g.L[i-1]||1;w.pos.lerpVectors(g.path[i-1],g.path[i],Math.min(1,(s-g.L[i-1])/seg));w.yawT=g.y0+(g.y1-g.y0)*e;w.pitchT=g.p0+(g.p1-g.p0)*e;w.fovTo=g.f0+(g.f1-g.f0)*e;w.vel.set(0,0,0);if(t>=1)w.glide=null}
    if(!w.glide&&!this.ok(w.pos.x,w.pos.z))this._unstick(w);
    const K=this.keys,has=(...a)=>a.some(k=>K.has(k));
    let ix=this.joy.x+(has('KeyD','ArrowRight')?1:0)-(has('KeyA','ArrowLeft')?1:0),iz=this.joy.y+(has('KeyS','ArrowDown')?1:0)-(has('KeyW','ArrowUp')?1:0);const il=Math.hypot(ix,iz);if(il>1){ix/=il;iz/=il}
    if(il>.01)w.glide=null;
    if(!w.glide){const mul=this.speedMul||6,sp=4.6*mul*(has('ShiftLeft','ShiftRight')?2:1),sy=Math.sin(w.yaw),cy=Math.cos(w.yaw),tx=(cy*ix+sy*iz)*sp,tz=(-sy*ix+cy*iz)*sp,k=1-Math.exp(-dt*9);
      w.vel.x+=(tx-w.vel.x)*k;w.vel.z+=(tz-w.vel.z)*k;
      const dist=Math.hypot(w.vel.x,w.vel.z)*dt,n=Math.max(1,Math.ceil(dist/.5)),sx=w.vel.x*dt/n,sz=w.vel.z*dt/n;
      for(let s=0;s<n;s++){const nx=w.pos.x+sx,nz=w.pos.z+sz;
        if(this.ok(nx,nz)){w.pos.x=nx;w.pos.z=nz}
        else if(this.ok(nx,w.pos.z)){w.pos.x=nx;w.vel.z*=.5;break}
        else if(this.ok(w.pos.x,nz)){w.pos.z=nz;w.vel.x*=.5;break}
        else{const near=this._nearestOk(w.pos.x,w.pos.z);if(near){const d0=(w.pos.x-near.x)**2+(w.pos.z-near.z)**2,d1=(nx-near.x)**2+(nz-near.z)**2;if(d1<d0-1e-4){w.pos.x=nx;w.pos.z=nz;continue}}w.vel.set(0,0,0);break}}}
    const lk=1-Math.exp(-dt*20);w.yaw+=(w.yawT-w.yaw)*lk;w.pitch+=(w.pitchT-w.pitch)*lk;w.fov+=(w.fovTo-w.fov)*(1-Math.exp(-dt*12));
    const spd=Math.hypot(w.vel.x,w.vel.z),base=4.6*(this.speedMul||6),amt=Math.min(.65,spd/base);w.phase+=dt*(spd/base)*4.6*1.15;
    c.position.set(w.pos.x,EYE+Math.sin(w.phase*2)*.025*amt,w.pos.z);c.rotation.set(w.pitch,w.yaw,0,'YXZ');if(Math.abs(c.fov-w.fov)>.01){c.fov=w.fov;c.updateProjectionMatrix()}
    this._where()}
  _where(){const p=this.walk.pos;let n='The nave';if(p.z<D.PIER&&p.z>-D.PIER&&Math.abs(p.x)<D.PIER)n='Under the dome';else if(p.z<-D.PIER)n='The apse';else if(Math.abs(p.x)>D.PIER&&p.z<D.PIER)n='The transept';else if(p.z<-19&&p.z>-D.PIER&&Math.abs(p.x)>D.AISLE0)n=p.x>0?'The Chapel of Sts Michael and Petronilla':'The Chapel of Our Lady of the Column';else if(Math.abs(p.x)>D.NHW)n=p.x>0&&p.z>100?'The Pietà chapel':'The side aisle';
    if(n!==this._wn){this._wn=n;this.onStatus(n)}}
  // ---------- Free cam: steady orbit around a work of art ----------
  setMode(m){if(m===this.mode)return;this.mode=m;const c=this.camera;
    if(m==='Free'){const fw=new THREE.Vector3();c.getWorldDirection(fw);const t=c.position.clone().addScaledVector(fw,14);t.y=Math.max(1,Math.min(t.y,30));
      const off=c.position.clone().sub(t),d=off.length();this.free={t,tT:t.clone(),yaw:Math.atan2(off.x,off.z),pitch:Math.asin(THREE.MathUtils.clamp(off.y/d,-1,1)),dist:d};Object.assign(this.free,{yawT:this.free.yaw,pitchT:this.free.pitch,distT:d});c.fov=50;c.updateProjectionMatrix();this.joyUI.hidden=true}
    else{this.free=null;this.joyUI.hidden=false;this.walk.fov=this.walk.fovTo=70}}
  _freeTo(p){const F=this.free,L=new THREE.Vector3(...p.look),S=P2(...p.stand);S.y=EYE;const off=S.clone().sub(L),d=off.length();
    F.tT.copy(L);F.yawT=Math.atan2(off.x,off.z);F.pitchT=Math.asin(THREE.MathUtils.clamp(off.y/d,-1,1));F.distT=Math.min(d,p.id==='dome'?40:30);this.current=p.id}
  _dolly(f){const F=this.free;F.distT=THREE.MathUtils.clamp(F.distT*f,2,90)}
  _freeStep(dt){const F=this.free,c=this.camera,k=1-Math.exp(-dt*8);F.pitchT=THREE.MathUtils.clamp(F.pitchT,-1.5,1.5);
    F.t.lerp(F.tT,k);let dy=F.yawT-F.yaw;F.yaw+=dy*k;F.pitch+=(F.pitchT-F.pitch)*k;F.dist+=(F.distT-F.dist)*k;
    const d=new THREE.Vector3(Math.cos(F.pitch)*Math.sin(F.yaw),Math.sin(F.pitch),Math.cos(F.pitch)*Math.cos(F.yaw));
    let r=F.dist;for(let s=1;s<=F.dist;s+=.5){const q=F.t.clone().addScaledVector(d,s);if(!this.inside(q.x,q.z,.3)||q.y<.4||q.y>this.ceiling(q.x,q.z)-.5){r=Math.max(.8,s-.5);break}}
    c.position.copy(F.t).addScaledVector(d,r);c.lookAt(F.t)}
  // ---------- input ----------
  _bindInput(){const el=this.renderer.domElement,pts=new Map(),L=this.look;let down=null;
    const pd=()=>{const a=pts.get(L.id),b=pts.get(L.pinch);return a&&b?Math.hypot(a.x-b.x,a.y-b.y):0};
    el.addEventListener('pointerdown',e=>{if(e.isPrimary)pts.clear();pts.set(e.pointerId,{x:e.clientX,y:e.clientY});down=pts.size>1?null:{x:e.clientX,y:e.clientY,t:performance.now(),id:e.pointerId};
      try{el.setPointerCapture(e.pointerId)}catch(_){}this.walk.glide=null;
      if(L.id==null||!pts.has(L.id)){L.id=e.pointerId;L.pinch=null}else if(L.pinch==null){L.pinch=e.pointerId;L.d0=pd();L.f0=this.mode==='Free'?this.free.distT:this.walk.fovTo}});
    el.addEventListener('pointermove',e=>{const p=pts.get(e.pointerId);if(!p)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
      if(L.pinch!=null){if(L.d0>0){const d=pd();if(d>0){if(this.mode==='Free')this.free.distT=THREE.MathUtils.clamp(L.f0*L.d0/d,2,90);else this.walk.fovTo=THREE.MathUtils.clamp(L.f0*L.d0/d,15,75)}}return}
      if(e.pointerId!==L.id)return;
      if(this.mode==='Free'){const F=this.free;F.yawT-=dx*.006;F.pitchT=THREE.MathUtils.clamp(F.pitchT+dy*.006,-1.5,1.5);return}
      const w=this.walk,k=.0052*(w.fov/70);w.yawT-=dx*k;w.pitchT=THREE.MathUtils.clamp(w.pitchT-dy*k,THREE.MathUtils.degToRad(-80),THREE.MathUtils.degToRad(89))});
    const up=e=>{pts.delete(e.pointerId);if(e.pointerId===L.pinch)L.pinch=null;else if(e.pointerId===L.id){L.id=L.pinch!=null?L.pinch:null;L.pinch=null}};
    el.addEventListener('pointerup',e=>{up(e);if(down&&down.id===e.pointerId&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<10&&performance.now()-down.t<600)this._tap(e.clientX,e.clientY);down=null});
    el.addEventListener('pointercancel',e=>{up(e);down=null});
    el.addEventListener('wheel',e=>{e.preventDefault();const dy=e.deltaMode===1?e.deltaY*33:e.deltaY,f=Math.exp(THREE.MathUtils.clamp(dy,-300,300)*.0022);this.zoom(f)},{passive:false});
    el.addEventListener('contextmenu',e=>e.preventDefault());
    const MOVE=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'];
    addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey||/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName||''))return;if(MOVE.includes(e.code)){this.keys.add(e.code);if(e.code.startsWith('Arrow'))e.preventDefault()}else if(e.key==='+'||e.key==='=')this.zoom(.8);else if(e.key==='-')this.zoom(1.25)});
    addEventListener('keyup',e=>this.keys.delete(e.code));addEventListener('blur',()=>this.keys.clear())}
  _tap(cx,cy){if(!this.hots)return;const rc=this.renderer.domElement.getBoundingClientRect();this.ray.setFromCamera(new THREE.Vector2((cx-rc.left)/rc.width*2-1,-(cy-rc.top)/rc.height*2+1),this.camera);
    const h=this.ray.intersectObjects(this.hots,false);if(h.length)this.onInfo(PLACES.find(p=>p.id===h[0].object.userData.place))}
  hotScreen(id){const s=this.hots.find(h=>h.userData.place===id),v=s.position.clone().project(this.camera),rc=this.renderer.domElement.getBoundingClientRect();return {x:rc.left+(v.x+1)/2*rc.width,y:rc.top+(1-v.y)/2*rc.height,vis:v.z<1}}
  resize(){const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h,false);this.renderer.domElement.style.width=w+'px';this.renderer.domElement.style.height=h+'px';
    this.composer.setSize(w,h);const pr=this.renderer.getPixelRatio();this.bloom.resolution.set(w*pr/(this.mobile?4:2),h*pr/(this.mobile?4:2));this.camera.aspect=w/h;this.camera.updateProjectionMatrix()}
  _tick(now){const dt=Math.min(.05,(now-(this._lt||now))/1000);this._lt=now;
    if(this.mode==='Free'&&this.free)this._freeStep(dt);else this._walkStep(now,dt);
    if(this.hots){const c=this.camera.position;for(const s of this.hots){const d=c.distanceTo(s.position);s.scale.setScalar(THREE.MathUtils.clamp(d*.045,.55,3.2)*(1+.06*Math.sin(now*.004)))}}
    if(this.basilica.gloria)this.basilica.gloria.material.opacity=.7+.08*Math.sin(now*.0015);
    if(this.mobile&&((this._sf=(this._sf||0)+1)%45===1))this.renderer.shadowMap.needsUpdate=true;
    this.composer.render()}
}
