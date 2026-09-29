import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {RibbonFlower} from './flower-model.js';
import {PALETTES,createFlowerMaterials,applyMaterialSettings} from './flower-materials.js';
import {seededRandom,interactionRadius} from './botanical-math.js';
import './style.css';
import './garden.css';
import './diffuse-light.css';
import './minimal.css';
import './sculpture.css';

const $=s=>document.querySelector(s),stage=$('#stage');
let noticeTimer;
function message(text){$('#notice').textContent=text;$('#notice').classList.remove('hidden');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('#notice').classList.add('hidden'),3000);}
try{init();}catch(error){console.error(error);message('3D 畫面無法啟動，請開啟瀏覽器硬體加速後重新整理。');}

function init(){
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const backdrop=document.createElement('canvas');backdrop.className='light-backdrop';backdrop.setAttribute('aria-hidden','true');stage.append(backdrop,renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.1,100),controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;controls.dampingFactor=.065;controls.enablePan=false;controls.minDistance=6;controls.maxDistance=28;controls.minPolarAngle=.25;controls.maxPolarAngle=Math.PI-.25;
  const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;room.dispose();pmrem.dispose();
  const ambient=new THREE.HemisphereLight('#e8f3ff','#50638d',.55);scene.add(ambient);
  function light(color,intensity,pos){const l=new THREE.DirectionalLight(color,intensity);l.position.set(...pos);scene.add(l);return l;}
  const key=light('#f5f9ff',2.65,[-4,6,7]),fill=light('#aecfff',1.0,[5,1,4]),rim=light('#e2f0ff',2.25,[1,5,-5]);
  key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:.5,far:30});key.shadow.bias=-.00015;key.shadow.normalBias=.018;key.shadow.radius=3;
  const defaults={ambient:.55,environment:.65,exposure:.98,key:2.65,keyColor:'#f5f9ff',azimuth:-32,elevation:42,fill:1,fillColor:'#aecfff',rim:2.25,rimColor:'#e2f0ff',roughness:.43,metalness:.04,clearcoat:.12,sheen:.62,anisotropy:.32,texture:.3,translucency:.35,background:'#f3f7fc',response:1.15,pull:1.3};
  const settings={...defaults},materials=createFlowerMaterials(renderer);
  const garden=new THREE.Group();scene.add(garden);
  let flowers=[],selectedId=1,nextId=1,palette='electric',maxBloom=.98,breathing=!reducedMotion,inspect=false,elapsed=0,last=performance.now(),poseSeed=302;

  function paintBackdrop(){
    backdrop.width=renderer.domElement.width;backdrop.height=renderer.domElement.height;const ctx=backdrop.getContext('2d'),w=backdrop.width,h=backdrop.height;ctx.fillStyle=settings.background;ctx.fillRect(0,0,w,h);
    const gradient=ctx.createRadialGradient(w*.5,h*.55,0,w*.5,h*.55,Math.min(w*.50,h*.57));gradient.addColorStop(0,'rgba(32,115,226,.14)');gradient.addColorStop(.46,'rgba(76,156,240,.09)');gradient.addColorStop(1,'rgba(130,195,255,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
  }
  function addFlower(config={}){
    if(flowers.length>=9)return message('此版最多同時顯示 9 朵花。');
    const f=new RibbonFlower(nextId++,materials,config);garden.add(f);flowers.push(f);
    f.label=document.createElement('span');f.label.className='flower-state';f.label.dataset.flower=String(f.flowerId);stage.appendChild(f.label);f.setPalette(palette);return f;
  }
  addFlower({seed:71,yaw:-8,pitch:-9,roll:-3,disorder:.25});
  addFlower({seed:231,yaw:32,pitch:-13,roll:4,disorder:.38});
  addFlower({seed:589,yaw:-22,pitch:6,roll:-5,disorder:.31});
  function arrange(){
    const n=flowers.length;
    flowers.forEach((f,i)=>{
      if(n<=3){const positions=n===1?[[0,0,.2]]:n===2?[[-1.65,.25,0],[1.65,.1,.2]]:[[-2.60,.40,-.18],[0,-.44,.40],[2.58,.52,-.28]];f.position.set(...positions[i]);f.scale.setScalar(n===1?1.05:n===2?.92:.80);}
      else{const columns=n===4?2:3,rows=Math.ceil(n/columns),row=Math.floor(i/columns),col=i%columns,rowCount=Math.min(columns,n-row*columns),step=n>6?2.6:3.1;f.position.set((col-(rowCount-1)/2)*(n>6?2.7:3.1),(rows-1)*step*.5-row*step+.2,row*.25);f.scale.setScalar(n>6?.47:.60);}
    });resize();
  }
  function resetCamera(){camera.position.set(0,.7,13.8);controls.target.set(0,-.22,0);controls.update();}
  function resize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();garden.scale.setScalar(Math.min(1,camera.aspect/1.02));paintBackdrop();}
  arrange();resetCamera();new ResizeObserver(resize).observe(stage);

  const shapePanel=document.createElement('section');shapePanel.className='shape-panel';shapePanel.innerHTML=`
    <div class="shape-heading"><span>花朵造型</span><span>SCULPTURE</span></div>
    <div class="flower-selector"><label for="flower-select">編輯花朵</label><select id="flower-select" aria-label="編輯花朵"></select></div>
    <div class="view-buttons" aria-label="選定花朵朝向"><button data-view="front">正面</button><button data-view="side">側面</button><button data-view="back">背面</button></div>
    <div id="pose-fields"></div>
    <div class="shape-buttons"><button id="random-shape">換一種花瓣排列 ↻</button><button id="random-poses">全體自然朝向 ↗</button></div>
    <label class="inspect-switch"><input id="inspect-open" type="checkbox" autocomplete="off">保持盛開，檢查造型</label>
    <button id="three-views" class="three-views">正面・側面・背面展示</button>
    <div class="flower-actions"><button id="add-flower">＋ 增加一朵</button><button id="remove-flower">移除選定</button></div>
    <p class="shape-note">每朵花保留自己的角度與凌亂程度。關閉「保持盛開」即可恢復滑鼠開合。</p>`;
  $('.studio-heading').after(shapePanel);
  // Every new visit starts closed; inspection is an explicit, session-only choice.
  $('#inspect-open').checked=false;
  const poseFields=[['yaw','左右朝向',-180,180,1],['pitch','俯仰傾斜',-65,65,1],['roll','花盤旋轉',-90,90,1],['disorder','凌亂程度',0,1,.01]];
  function selected(){return flowers.find(f=>f.flowerId===selectedId)||flowers[0];}
  function settingRow(name,label,min,max,step,value,callback,prefix='setting'){
    const row=document.createElement('label');row.className='setting';row.htmlFor=`${prefix}-${name}`;
    const isColor=min==='color';row.innerHTML=`<span>${label}</span><output>${isColor?'':Number(value).toFixed(step===1?0:2)}</output><input id="${prefix}-${name}" aria-label="${label}" type="${isColor?'color':'range'}" ${isColor?'':`min="${min}" max="${max}" step="${step}"`} value="${value}">`;
    row.querySelector('input').addEventListener('input',e=>{const v=isColor?e.target.value:Number(e.target.value);row.querySelector('output').textContent=isColor?'':v.toFixed(step===1?0:2);callback(v);});return row;
  }
  for(const [name,label,min,max,step]of poseFields)$('#pose-fields').appendChild(settingRow(name,label,min,max,step,selected().config[name],value=>{const f=selected();if(name==='disorder')f.setShape({disorder:value});else f.setPose({[name]:value});},'pose'));
  function syncSelection(){
    const select=$('#flower-select');select.replaceChildren();for(const f of flowers){const option=document.createElement('option');option.value=f.flowerId;option.textContent=`花朵 ${String(f.flowerId).padStart(2,'0')}`;select.appendChild(option);}select.value=selectedId;
    for(const [name,,, ,step]of poseFields){const input=$(`#pose-${name}`);input.value=selected().config[name];input.previousElementSibling.textContent=selected().config[name].toFixed(step===1?0:2);}
    $('#remove-flower').disabled=flowers.length===1;$('#add-flower').disabled=flowers.length>=9;
    flowers.forEach(f=>{f.label.classList.toggle('selected',f.flowerId===selectedId);});
  }
  $('#flower-select').addEventListener('change',e=>{selectedId=Number(e.target.value);syncSelection();});
  document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{selected().setPose({yaw:{front:0,side:90,back:180}[button.dataset.view],pitch:-5,roll:0});inspect=true;$('#inspect-open').checked=true;syncSelection();}));
  $('#random-shape').addEventListener('click',()=>{const f=selected();f.setShape({seed:f.config.seed+137});});
  $('#random-poses').addEventListener('click',()=>{const random=seededRandom(++poseSeed);flowers.forEach(f=>f.setPose({yaw:Math.round((random()-.5)*125),pitch:Math.round((random()-.5)*46),roll:Math.round((random()-.5)*32)}));syncSelection();});
  $('#inspect-open').addEventListener('change',e=>{inspect=e.target.checked;});
  $('#three-views').addEventListener('click',()=>{flowers.forEach((f,i)=>f.setPose({yaw:[0,80,180][i%3],pitch:0,roll:0}));inspect=true;$('#inspect-open').checked=true;setMaxBloom(1);resetCamera();syncSelection();message('正面、側面與背面同時展示');});
  $('#add-flower').addEventListener('click',()=>{const f=addFlower({...selected().config,seed:selected().config.seed+577,yaw:selected().config.yaw+18});if(!f)return;selectedId=f.flowerId;arrange();syncSelection();});
  $('#remove-flower').addEventListener('click',()=>{if(flowers.length===1)return;const f=selected();flowers=flowers.filter(x=>x!==f);f.dispose();selectedId=flowers[0].flowerId;arrange();syncSelection();});syncSelection();

  const fields=[
    ['環境 / ENVIRONMENT',[['ambient','環境光',0,2,.01],['environment','環境反射',0,2,.01],['exposure','曝光',.2,1.8,.01],['background','背景色','color']]],
    ['燈光 / LIGHTING',[['key','主光強度',0,6,.05],['keyColor','主光顏色','color'],['azimuth','主光方向',-180,180,1],['elevation','主光高度',-20,85,1],['fill','補光強度',0,5,.05],['fillColor','補光顏色','color'],['rim','輪廓光',0,6,.05],['rimColor','輪廓光顏色','color']]],
    ['花瓣材質 / MATERIAL',[['roughness','粗糙度',.06,1,.01],['metalness','金屬感',0,1,.01],['clearcoat','表面亮膜',0,1,.01],['sheen','緞面光澤',0,1,.01],['anisotropy','絲緞反光方向感',0,1,.01],['texture','纖維紋理',0,1,.01],['translucency','背光柔透感',0,1,.01]]],
    ['動態 / MOTION',[['response','開合速度',.4,2,.05],['pull','牽引力度',0,2,.05]]]
  ];
  for(const [title,items]of fields){const section=document.createElement('details');section.open=title.startsWith('花瓣');section.innerHTML=`<summary>${title}</summary>`;for(const [name,label,min,max,step]of items)section.appendChild(settingRow(name,label,min,max,step,settings[name],v=>{settings[name]=v;applySettings();}));$('#studio-fields').appendChild(section);}
  function applySettings(){
    ambient.intensity=settings.ambient;scene.environmentIntensity=settings.environment;renderer.toneMappingExposure=settings.exposure;
    key.intensity=settings.key;key.color.set(settings.keyColor);fill.intensity=settings.fill;fill.color.set(settings.fillColor);rim.intensity=settings.rim;rim.color.set(settings.rimColor);
    const a=THREE.MathUtils.degToRad(settings.azimuth),e=THREE.MathUtils.degToRad(settings.elevation);key.position.set(Math.sin(a)*Math.cos(e)*10,Math.sin(e)*10,Math.cos(a)*Math.cos(e)*10);
    applyMaterialSettings(materials,settings);$('#app').style.setProperty('--garden-color',settings.background);paintBackdrop();
  }
  applySettings();$('#reset-studio').addEventListener('click',()=>{Object.assign(settings,defaults);for(const [,items]of fields)for(const [name,,min,,step]of items){const input=$(`#setting-${name}`);input.value=settings[name];input.previousElementSibling.textContent=min==='color'?'':settings[name].toFixed(step===1?0:2);}applySettings();});
  const slider=$('#bloom');
  function setMaxBloom(value){maxBloom=value;slider.value=Math.round(value*100);$('#bloom-value').textContent=`${Math.round(value*100)}%`;slider.style.background=`linear-gradient(to right,#0033cc ${value*100}%,#174aac24 ${value*100}%)`;}
  setMaxBloom(.98);slider.addEventListener('input',()=>setMaxBloom(Number(slider.value)/100));
  document.querySelectorAll('.swatch').forEach(button=>button.addEventListener('click',()=>{palette=button.dataset.palette;flowers.forEach(f=>f.setPalette(palette));document.querySelectorAll('.swatch').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});$('#palette-name').textContent=PALETTES[palette].name;}));
  function updateMotion(){$('#motion').setAttribute('aria-pressed',String(breathing));$('#motion-icon').textContent=breathing?'Ⅱ':'▷';}
  updateMotion();$('#motion').addEventListener('click',()=>{breathing=!breathing;updateMotion();});

  const pointer=new THREE.Vector2(9,9),raycaster=new THREE.Raycaster(),sphere=new THREE.Sphere(),worldCenter=new THREE.Vector3(),worldScale=new THREE.Vector3(),point=new THREE.Vector3(),plane=new THREE.Plane(),viewNormal=new THREE.Vector3();
  let pointerInside=false,dragging=false;
  function setPointer(e){const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);pointerInside=true;}
  function release(){dragging=false;controls.enabled=true;}
  renderer.domElement.addEventListener('pointermove',setPointer);
  renderer.domElement.addEventListener('pointerdown',e=>{setPointer(e);const hit=flowers.find(f=>f.hovered),touch=e.pointerType==='touch'||Boolean(hit);controls.enabled=!touch;dragging=!touch;if(hit){selectedId=hit.flowerId;syncSelection();}},true);
  window.addEventListener('pointerup',e=>{release();if(e.pointerType==='touch')pointerInside=false;});
  renderer.domElement.addEventListener('pointerleave',()=>{pointerInside=false;release();});renderer.domElement.addEventListener('pointercancel',()=>{pointerInside=false;release();});window.addEventListener('blur',()=>{pointerInside=false;release();});
  $('#reset').addEventListener('click',()=>{resetCamera();inspect=false;$('#inspect-open').checked=false;setMaxBloom(.98);pointerInside=false;flowers.forEach((f,i)=>{f.setPose({yaw:[-8,32,-22][i%3],pitch:[-9,-13,6][i%3],roll:0});f.bloom=0;});syncSelection();});
  $('#capture').addEventListener('click',()=>{renderer.render(scene,camera);const out=document.createElement('canvas');out.width=renderer.domElement.width;out.height=renderer.domElement.height;const ctx=out.getContext('2d');ctx.drawImage(backdrop,0,0);ctx.drawImage(renderer.domElement,0,0);out.toBlob(blob=>{if(!blob)return message('圖片儲存失敗，請再試一次。');const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`diffuse-flowers-${palette}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);message('已保存目前的花朵造型');});});

  const projected=new THREE.Vector3();let labelTick=0;
  renderer.setAnimationLoop(now=>{
    const dt=Math.min((now-last)/1000,.05);last=now;elapsed+=dt;controls.update();scene.updateMatrixWorld(true);raycaster.setFromCamera(pointer,camera);camera.getWorldDirection(viewNormal);
    let active=null,nearest=Infinity;
    if(pointerInside&&!dragging)for(const f of flowers){worldCenter.set(0,0,.45*(1-f.bloom)).applyMatrix4(f.head.matrixWorld);f.head.getWorldScale(worldScale);sphere.set(worldCenter,interactionRadius(f.bloom)*worldScale.x);if(raycaster.ray.intersectSphere(sphere,point)){const depth=point.distanceToSquared(raycaster.ray.origin);if(depth<nearest){active=f;nearest=depth;}}}
    for(const f of flowers){
      const wasHover=f.hovered;f.hovered=f===active;
      f.bloom=THREE.MathUtils.damp(f.bloom,(inspect||f.hovered)?maxBloom:0,(reducedMotion?7:2.7)*settings.response,dt);
      if(f.hovered){worldCenter.set(0,0,.35).applyMatrix4(f.head.matrixWorld);plane.setFromNormalAndCoplanarPoint(viewNormal,worldCenter);if(raycaster.ray.intersectPlane(plane,point)){f.local.copy(point);f.head.worldToLocal(f.local);}if(!wasHover)f.last.set(f.local.x,f.local.y);f.speed.set(f.local.x-f.last.x,f.local.y-f.last.y).clampLength(0,.22);f.last.set(f.local.x,f.local.y);}else f.speed.multiplyScalar(.8);
      f.update(dt,elapsed,{pull:settings.pull,breathing,reducedMotion});
      if(labelTick%5===0){projected.copy(f.position).add(new THREE.Vector3(0,-1.05,0)).applyMatrix4(garden.matrixWorld).project(camera);f.label.style.left=`${(projected.x*.5+.5)*stage.clientWidth}px`;f.label.style.top=`${(-projected.y*.5+.5)*stage.clientHeight}px`;f.label.textContent=`${String(f.flowerId).padStart(2,'0')} / ${inspect?'造型展示':f.hovered?'正在綻放':f.bloom>.06?'慢慢收攏':'等待靠近'}`;f.label.dataset.bloom=f.bloom.toFixed(3);f.label.dataset.pull=Math.hypot(...f.petals.map(p=>p.x.value+p.y.value)).toFixed(3);f.label.dataset.yaw=f.config.yaw;f.label.dataset.disorder=f.config.disorder;f.label.classList.toggle('awake',f.hovered);}
    }
    labelTick++;$('#phase').textContent=inspect?'FORM STUDY':active?'UNFOLDING':'WAITING';renderer.render(scene,camera);
  });
  message('新版花萼與緞帶造型，可在右側切換正面、側面與背面');
}
