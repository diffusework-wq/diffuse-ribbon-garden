import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {petalParameters,ribbonProfile,seededRandom,mix,clamp} from './botanical-math.js';
import {layerProgress,springStep} from './motion.js';
import {PALETTES} from './flower-materials.js';

export const PETAL_LAYERS=[
  {count:20,length:2.56,width:.64,z:-.06,cup:.22,rake:.18},
  {count:18,length:2.19,width:.56,z:.035,cup:.60,rake:.38},
  {count:15,length:1.52,width:.42,z:.12,cup:.90,rake:.60},
  {count:11,length:.88,width:.28,z:.16,cup:.72,rake:.70}
];
export const DEFAULT_FLOWER={seed:71,yaw:0,pitch:-12,roll:0,disorder:.32};
const ROWS=56,COLS=8,SIDE=(ROWS+1)*(COLS+1);
const center=new THREE.Vector3(),tangent=new THREE.Vector3(),across=new THREE.Vector3(),normal=new THREE.Vector3();

function shellGeometry(rows,cols){
  const side=(rows+1)*(cols+1),indices=[],uv=new Float32Array(side*4);
  for(let s=0;s<2;s++)for(let i=0;i<=rows;i++)for(let j=0;j<=cols;j++){
    const v=s*side+i*(cols+1)+j;uv[v*2]=j/cols;uv[v*2+1]=i/rows;
    if(i<rows&&j<cols){const a=v,b=v+1,c=v+cols+1,d=v+cols+2;indices.push(...(s?[a,b,c,b,d,c]:[a,c,b,b,c,d]));}
  }
  for(let i=0;i<rows;i++)for(const j of [0,cols]){const a=i*(cols+1)+j,b=a+cols+1;indices.push(a,b,a+side,b,b+side,a+side);}
  for(const i of [0,rows])for(let j=0;j<cols;j++){const a=i*(cols+1)+j,b=a+1;indices.push(a,a+side,b,b,a+side,b+side);}
  const geo=new THREE.BufferGeometry();geo.setIndex(indices);geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(side*6),3).setUsage(THREE.DynamicDrawUsage));geo.setAttribute('color',new THREE.BufferAttribute(new Float32Array(side*6),3));geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));return geo;
}

function ribbonShape(p,open){
  const arr=new Float32Array(SIDE*6),ca=Math.cos(p.angle),sa=Math.sin(p.angle);
  for(let i=0;i<=ROWS;i++){
    const t=i/ROWS,c=ribbonProfile(t,open,p),a=ribbonProfile(Math.max(0,t-.001),open,p),b=ribbonProfile(Math.min(1,t+.001),open,p);
    center.set(c.r*ca,c.r*sa,c.z);tangent.set((b.r-a.r)*ca,(b.r-a.r)*sa,b.z-a.z).normalize();
    across.set(-sa,ca,0).applyAxisAngle(tangent,p.twist*t*t*(.3+open*.7));normal.crossVectors(tangent,across).normalize();
    const width=p.width*(.20+.80*Math.pow(Math.sin(t*Math.PI*.5),.52));
    for(let s=0;s<2;s++)for(let j=0;j<=COLS;j++){
      const u=j/COLS*2-1;
      // A cupped cross section, lengthwise pleats and uneven rolled lips.
      const cupping=u*u*(.045+.075*Math.pow(t,3));
      const ribs=Math.cos(u*Math.PI*5)*.0045*Math.sin(Math.PI*t);
      const lip=Math.sin(u*4.2+p.phase)*Math.pow(t,12)*(.013+p.disorder*.026);
      const skin=(s?-.009:.009)*(1-.45*t);
      const d=cupping+ribs+lip+skin,lateral=u*width*.5+p.skew*t*t;
      const idx=(s*SIDE+i*(COLS+1)+j)*3;
      arr[idx]=center.x+across.x*lateral+normal.x*d;
      arr[idx+1]=center.y+across.y*lateral+normal.y*d;
      arr[idx+2]=center.z+across.z*lateral+normal.z*d;
    }
  }
  return arr;
}

function mesh(geometry,material){const m=new THREE.Mesh(geometry,material);m.castShadow=true;m.receiveShadow=true;return m;}
function disposeGroup(group){group.traverse(obj=>{obj.geometry?.dispose();});group.clear();}
function paintUniform(geo,color){const c=new THREE.Color(color),a=new Float32Array(geo.attributes.position.count*3);for(let i=0;i<a.length;i+=3){a[i]=c.r;a[i+1]=c.g;a[i+2]=c.b;}geo.setAttribute('color',new THREE.BufferAttribute(a,3));}

export class RibbonFlower extends THREE.Group {
  constructor(id,materials,config={}){
    super();this.flowerId=id;this.materials=materials;this.config={...DEFAULT_FLOWER,...config};
    this.head=new THREE.Group();this.head.position.set(0,.65,0);this.add(this.head);
    this.structure=new THREE.Group();this.head.add(this.structure);this.leaves=new THREE.Group();this.add(this.leaves);
    this.petals=[];this.bloom=0;this.hovered=false;this.local=new THREE.Vector3();this.last=new THREE.Vector2();this.speed=new THREE.Vector2();this.pullX={value:0,velocity:0};this.pullY={value:0,velocity:0};
    this.stem=mesh(new THREE.BufferGeometry(),materials.stem);this.add(this.stem);
    PETAL_LAYERS.forEach((cfg,layer)=>{for(let index=0;index<cfg.count;index++){const geo=shellGeometry(ROWS,COLS),m=mesh(geo,materials.petal);m.frustumCulled=false;this.head.add(m);this.petals.push({mesh:m,layer,index,x:{value:0,velocity:0},y:{value:0,velocity:0}});}});
    this.setShape(this.config);this.setPose(this.config);this.setPalette('electric');this.update(0,0,{pull:0,breathing:false});
  }
  setShape(config){
    Object.assign(this.config,config);this.config.disorder=clamp(this.config.disorder);
    for(const p of this.petals){Object.assign(p,petalParameters(PETAL_LAYERS[p.layer],p.layer,p.index,this.config.seed,this.config.disorder));p.closed=ribbonShape(p,0);p.open=ribbonShape(p,1);p.lastOpen=undefined;}
    this.buildCalyx();if(this.stemCurve)this.buildStem();this.buildLeaves();if(this.palette)this.setPalette(this.palette);
  }
  setPose(config){
    Object.assign(this.config,config);
    while(this.config.yaw>180)this.config.yaw-=360;
    while(this.config.yaw< -180)this.config.yaw+=360;
    this.config.pitch=clamp(this.config.pitch,-65,65);this.config.roll=clamp(this.config.roll,-90,90);
    this.head.rotation.set(THREE.MathUtils.degToRad(this.config.pitch),THREE.MathUtils.degToRad(this.config.yaw),THREE.MathUtils.degToRad(this.config.roll),'YXZ');
    this.buildStem();this.buildLeaves();
  }
  buildStem(){
    const axis=new THREE.Vector3(0,0,1).applyQuaternion(this.head.quaternion),tip=new THREE.Vector3(0,0,-.48).applyQuaternion(this.head.quaternion).add(this.head.position);
    const lean=(seededRandom(this.config.seed)()-.5)*.55;
    this.stemCurve=new THREE.CubicBezierCurve3(new THREE.Vector3(.35+lean,-4.05,-.12),new THREE.Vector3(-.35,-2.45,-.08),tip.clone().addScaledVector(axis,-.6).add(new THREE.Vector3(0,-.85,0)),tip);
    const geo=new THREE.TubeGeometry(this.stemCurve,84,.10,16,false),pos=geo.attributes.position;
    for(let i=0;i<=84;i++){const t=i/84,c=this.stemCurve.getPointAt(t),taper=1.12-.3*t;for(let j=0;j<=16;j++){const n=i*17+j,v=new THREE.Vector3().fromBufferAttribute(pos,n).sub(c).multiplyScalar(taper*(1+.02*Math.cos(j/16*Math.PI*12))).add(c);pos.setXYZ(n,v.x,v.y,v.z);}}
    geo.computeVertexNormals();paintUniform(geo,PALETTES[this.palette||'electric'].stem);this.stem.geometry.dispose();this.stem.geometry=geo;
  }
  buildCalyx(){
    disposeGroup(this.structure);
    // Receptacle: a tapered transition from the stem collar into the flower head.
    const profile=[new THREE.Vector2(.075,-.54),new THREE.Vector2(.12,-.46),new THREE.Vector2(.23,-.32),new THREE.Vector2(.35,-.20),new THREE.Vector2(.40,-.08),new THREE.Vector2(.29,.03)];
    const cup=new THREE.LatheGeometry(profile,40);cup.rotateX(Math.PI/2);paintUniform(cup,'#2859b7');this.structure.add(mesh(cup,this.materials.sepal));
    const veins=[],rand=seededRandom(this.config.seed+432),color=new THREE.Color();
    for(let layer=0;layer<2;layer++)for(let k=0;k<(layer?5:7);k++){
      const angle=k/(layer?5:7)*Math.PI*2+layer*.47+(rand()-.5)*.16*this.config.disorder,L=(layer?.77:1.2)*(1+(rand()-.5)*.2),width=layer?.34:.39;
      const ca=Math.cos(angle),sa=Math.sin(angle),geo=shellGeometry(32,8),a=geo.attributes.position,colors=geo.attributes.color,count=33*9;
      function point(t,u=0){const r=.11+L*t,z=-.42+Math.pow(t,.65)*.44-.1*t*t,w=width*Math.pow(Math.sin(Math.PI*t),.8),ridge=-.11*Math.sin(Math.PI*t)*(1-Math.abs(u))-.013*Math.cos(u*23)*Math.sin(Math.PI*t);return new THREE.Vector3(ca*r-sa*u*w*.5,sa*r+ca*u*w*.5,z+ridge);}
      for(let s=0;s<2;s++)for(let i=0;i<=32;i++)for(let j=0;j<=8;j++){
        const t=i/32,u=j/8*2-1,v=point(t,u),n=s*count+i*9+j;v.z+=(s?-.008:.008);a.setXYZ(n,v.x,v.y,v.z);
        color.set('#1646a8').lerp(new THREE.Color('#709adb'),t*.6+Math.abs(u)*.17);colors.setXYZ(n,color.r,color.g,color.b);
      }
      geo.computeVertexNormals();this.structure.add(mesh(geo,this.materials.sepal));
      for(const offset of [-.46,0,.46]){const points=[];for(let i=0;i<=16;i++){const t=.07+i/16*.84,v=point(t,offset*Math.sin(Math.PI*t));v.z-=.012;points.push(v);}veins.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),20,offset===0?.008:.004,4,false));}
    }
    const merged=mergeGeometries(veins);veins.forEach(g=>g.dispose());const veinMesh=mesh(merged,this.materials.veins);veinMesh.castShadow=false;this.structure.add(veinMesh);
    const core=mesh(new THREE.SphereGeometry(.115,24,16),this.materials.core);core.position.z=.27;core.scale.z=.82;this.structure.add(core);
  }
  buildLeaves(){
    disposeGroup(this.leaves);const rand=seededRandom(this.config.seed+904);
    for(let k=0;k<3;k++){
      const geo=shellGeometry(64,8),pos=geo.attributes.position,colors=geo.attributes.color,count=65*9;
      const side=k%2?-1:1,baseY=-3.3+k*.92,rotation=(rand()-.5)*.65*this.config.disorder,size=1+(rand()-.5)*.28*this.config.disorder;
      // Grow each ribbon from the actual curved stem rather than the world axis.
      let attachment=new THREE.Vector3(0,baseY,0),distance=Infinity;
      if(this.stemCurve)for(let s=0;s<=200;s++){const p=this.stemCurve.getPointAt(s/200),d=Math.abs(p.y-baseY);if(d<distance){distance=d;attachment.copy(p);}}
      for(let i=0;i<=64;i++){
        const t=i/64,a=t*Math.PI*1.86,xx=side*(.10+Math.sin(a)*.58*size+t*.2),yy=baseY+t*.78+(1-Math.cos(a))*.4*size,zz=Math.sin(a)*.14;
        const dx=side*(Math.cos(a)*.58*size*Math.PI*1.86+.2),dy=.78+Math.sin(a)*.4*size*Math.PI*1.86;
        tangent.set(dx,dy,.14*Math.cos(a)*Math.PI*1.86).normalize();across.set(-dy,dx,0).normalize().applyAxisAngle(tangent,.35*Math.sin(a)+rotation);normal.crossVectors(tangent,across).normalize();
        const width=.014+.49*Math.pow(Math.sin(Math.PI*t),.85)*(1-t*.2),base=new THREE.Vector3(xx+attachment.x,yy+attachment.y-baseY,zz+attachment.z);
        for(let s=0;s<2;s++)for(let j=0;j<=8;j++){const u=j/8*2-1,v=base.clone().addScaledVector(across,u*width*.5).addScaledVector(normal,(s?-.008:.008)+u*u*.028);const n=s*count+i*9+j;pos.setXYZ(n,v.x,v.y,v.z);const c=new THREE.Color('#2451c0').lerp(new THREE.Color('#759aee'),.26+.28*Math.sin(Math.PI*t));colors.setXYZ(n,c.r,c.g,c.b);}
      }
      geo.computeVertexNormals();this.leaves.add(mesh(geo,this.materials.stem));
    }
  }
  setPalette(name){
    this.palette=name;const stops=PALETTES[name].stops.map(c=>new THREE.Color(c)),c=new THREE.Color();
    for(const p of this.petals){const a=p.mesh.geometry.attributes.color;for(let s=0;s<2;s++)for(let i=0;i<=ROWS;i++)for(let j=0;j<=COLS;j++){
      const t=i/ROWS,u=j/COLS*2-1;
      const mapped=Math.pow(t,1.05)*3,band=Math.min(2,Math.floor(mapped));c.copy(stops[band]).lerp(stops[band+1],mapped-band);
      // Both surfaces carry the same gradient, with slightly cooler undersides.
      if(s)c.lerp(new THREE.Color('#97baf0'),.055);
      c.multiplyScalar((s?.96:1)*(1-.045*Math.cos(u*Math.PI*2)*Math.sin(t*Math.PI)));
      a.setXYZ(s*SIDE+i*(COLS+1)+j,c.r,c.g,c.b);
    }a.needsUpdate=true;}
    paintUniform(this.stem.geometry,PALETTES[name].stem);
  }
  update(dt,time,options){
    const pull=this.hovered?options.pull*this.bloom:0;
    springStep(this.pullX,this.hovered?this.local.x*.025*pull:0,dt,38,9);springStep(this.pullY,this.hovered?this.local.y*.025*pull:0,dt,38,9);
    // Small neck sway is applied to the complete flower to preserve the joint.
    this.rotation.z=this.pullX.value*.3+(options.breathing?Math.sin(time*.5+this.flowerId)*.009:0);
    for(const p of this.petals){
      const open=layerProgress(this.bloom,p.layer*.70,p.delay),r=p.length*.65*open+.35,px=Math.cos(p.angle)*r,py=Math.sin(p.angle)*r,d=Math.hypot(px-this.local.x,py-this.local.y),weight=this.hovered?Math.exp(-d*d/1.2)*pull:0;
      const tx=clamp(((this.local.x-px)*.2+this.speed.x*2)*weight,-.55,.55),ty=clamp(((this.local.y-py)*.2+this.speed.y*2)*weight,-.55,.55);
      springStep(p.x,tx,dt,65,options.reducedMotion?18:8);springStep(p.y,ty,dt,65,options.reducedMotion?18:8);
      const flutter=options.breathing?Math.sin(time*.9+p.phase)*.009*open:0;
      if(p.lastOpen!==undefined&&Math.abs(open-p.lastOpen)<.00002&&Math.abs(p.x.value-p.lastX)<.00002&&Math.abs(p.y.value-p.lastY)<.00002&&Math.abs(flutter-p.lastFlutter)<.001)continue;
      p.lastOpen=open;p.lastX=p.x.value;p.lastY=p.y.value;p.lastFlutter=flutter;
      const attr=p.mesh.geometry.attributes.position,data=attr.array;
      for(let s=0;s<2;s++)for(let i=0;i<=ROWS;i++){
        const t=i/ROWS,influence=t*t;
        for(let j=0;j<=COLS;j++){const n=(s*SIDE+i*(COLS+1)+j)*3;data[n]=mix(p.closed[n],p.open[n],open)+p.x.value*influence;data[n+1]=mix(p.closed[n+1],p.open[n+1],open)+p.y.value*influence;data[n+2]=mix(p.closed[n+2],p.open[n+2],open)+(flutter+Math.hypot(p.x.value,p.y.value)*.2)*influence;}
      }
      attr.needsUpdate=true;p.mesh.geometry.computeVertexNormals();
    }
  }
  dispose(){this.traverse(obj=>obj.geometry?.dispose());this.label?.remove();this.removeFromParent();}
}

