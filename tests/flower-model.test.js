import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {RibbonFlower,PETAL_LAYERS} from '../src/flower-model.js';
import {petalParameters,ribbonProfile,interactionRadius} from '../src/botanical-math.js';

const materials=Object.fromEntries(['petal','stem','sepal','veins','core'].map(name=>[name,new THREE.MeshPhysicalMaterial()]));
const options={pull:1.3,breathing:false,reducedMotion:false};

test('shape variation is stable, seed-dependent and controlled by disorder',()=>{
  const p=()=>petalParameters(PETAL_LAYERS[0],0,4,71,.6);
  assert.deepEqual(p(),p());
  const changed=petalParameters(PETAL_LAYERS[0],0,4,208,.6);
  assert.notEqual(p().length,changed.length);
  for(let index=0;index<20;index++){
    const uniform=petalParameters(PETAL_LAYERS[0],0,index,71,0);
    assert.equal(uniform.length,PETAL_LAYERS[0].length);
    assert.equal(uniform.twist,0);
  }
  for(let seed=1;seed<30;seed++)for(let layer=0;layer<4;layer++){
    const p=petalParameters(PETAL_LAYERS[layer],layer,seed%10,seed,1);
    for(let t=0;t<=100;t++)for(const bloom of [0,.25,.5,.75,1]){
      const point=ribbonProfile(t/100,bloom,p);
      assert.ok(Number.isFinite(point.r)&&Number.isFinite(point.z));
      assert.ok(point.r>0,'the profile must not fold through its central axis');
    }
  }
});

test('front, side and rear poses keep the stem inserted into the calyx',()=>{
  const flower=new RibbonFlower(1,materials,{seed:71});
  for(const yaw of [-180,-90,0,90,180])for(const pitch of [-65,0,65]){
    flower.setPose({yaw,pitch});
    const expected=new THREE.Vector3(0,0,-.48).applyQuaternion(flower.head.quaternion).add(flower.head.position);
    assert.ok(flower.stemCurve.getPoint(1).distanceTo(expected)<1e-6);
    const position=flower.stem.geometry.attributes.position;
    for(const x of position.array)assert.ok(Number.isFinite(x));
    // Tube rings remain round even when the flower turns away from the camera.
    for(let ring=0;ring<=84;ring+=7){
      const center=flower.stemCurve.getPointAt(ring/84);
      const radius=new THREE.Vector3().fromBufferAttribute(position,ring*17).distanceTo(center);
      assert.ok(radius>.075&&radius<.12);
    }
  }
  flower.dispose();
});

test('real meshes remain valid through morphs, tugging and a maximum-disorder rebuild',()=>{
  const flower=new RibbonFlower(2,materials,{seed:589,disorder:1});
  assert.equal(flower.petals.length,64);
  assert.equal(flower.leaves.children.length,3);
  assert.ok(flower.structure.children.length>=14,'back includes sepals, veins and a receptacle');
  for(const bloom of [0,.25,.5,.75,1]){
    flower.bloom=bloom;flower.hovered=true;flower.local.set(.9,.6,0);flower.speed.set(.1,-.1);
    for(let n=0;n<20;n++)flower.update(1/60,n/60,options);
    flower.traverse(mesh=>{
      if(!mesh.geometry)return;
      for(const attrName of ['position','normal']){
        const attr=mesh.geometry.getAttribute(attrName);
        assert.ok(attr,attrName);
        for(const x of attr.array)assert.ok(Number.isFinite(x),attrName+' must be finite');
      }
    });
  }
  flower.hovered=false;flower.bloom=0;
  for(let n=0;n<240;n++)flower.update(1/60,n/60,options);
  assert.ok(flower.petals.every(p=>Math.abs(p.x.value)<.001&&Math.abs(p.y.value)<.001));
  const first=Array.from(flower.petals[0].mesh.geometry.attributes.position.array);
  flower.setShape({seed:726,disorder:.5});flower.update(0,0,options);
  assert.notDeepEqual(Array.from(flower.petals[0].mesh.geometry.attributes.position.array),first);
  const underside=flower.petals[0].mesh.geometry.attributes.color;
  assert.ok(underside.getX(underside.count-1)>.7,'back petal tips retain the pearl gradient');
  flower.dispose();
});

test('adding and removing instances does not dispose shared materials',()=>{
  let sharedDisposed=0;
  const listener=()=>sharedDisposed++;
  materials.petal.addEventListener('dispose',listener);
  const a=new RibbonFlower(3,materials),b=new RibbonFlower(4,materials,{yaw:90,disorder:.8});
  const before=b.config.yaw;a.setPose({yaw:180});assert.equal(b.config.yaw,before);
  let geometryDisposed=0;a.petals[0].mesh.geometry.addEventListener('dispose',()=>geometryDisposed++);
  a.dispose();assert.equal(geometryDisposed,1);assert.equal(sharedDisposed,0);
  b.bloom=1;b.update(1/60,1,options);b.dispose();
  assert.equal(sharedDisposed,0);materials.petal.removeEventListener('dispose',listener);
  assert.ok(interactionRadius(1)>interactionRadius(0));
});
