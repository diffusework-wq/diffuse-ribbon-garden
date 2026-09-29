import test from 'node:test';
import assert from 'node:assert/strict';
import { layerProgress, springStep, petalCenter } from '../src/motion.js';

test('outer ribbons lead the inner crown and all layers close fully',()=>{
  assert.ok(layerProgress(.4,0)>layerProgress(.4,1));
  assert.ok(layerProgress(.4,1)>layerProgress(.4,2));
  for(let layer=0;layer<3;layer++){assert.equal(layerProgress(0,layer,.05),0);assert.equal(layerProgress(1,layer,.05),1);}
});
test('spring settles after pointer leaves at multiple frame rates',()=>{
  for(const hz of [20,30,60,120]){const s={value:0,velocity:0};for(let i=0;i<hz;i++)springStep(s,.6,1/hz);assert.ok(s.value>.5);for(let i=0;i<hz*3;i++)springStep(s,0,1/hz);assert.ok(Math.abs(s.value)<.001);assert.ok(Math.abs(s.velocity)<.01);}
});
test('every animation stage has finite geometry; bud has volume and bloom spreads',()=>{
  const p={length:2.4,curl:1.2,z:0,layer:0};
  for(let b=0;b<=20;b++)for(let i=0;i<=100;i++){const c=petalCenter(i/100,b/20,p);assert.ok(Number.isFinite(c.r)&&Number.isFinite(c.z));assert.ok(c.r>-.1);}
  assert.ok(petalCenter(.5,0,p).r>petalCenter(1,0,p).r);
  assert.ok(petalCenter(.7,1,p).r>petalCenter(.7,0,p).r*1.5);
  assert.ok(petalCenter(1,0,p).z>petalCenter(1,1,p).z);
});
