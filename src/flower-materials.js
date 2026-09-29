import * as THREE from 'three';
import {seededRandom} from './botanical-math.js';

export const PALETTES={
  electric:{name:'Diffuse 藍',stops:['#0734bb','#2564dd','#7eb9f6','#f0f8ff'],stem:'#2756ca'},
  ember:{name:'深藍擴散',stops:['#061c72','#205ccd','#72abeb','#d7ebff'],stem:'#163b9f'},
  ice:{name:'霧白擴散',stops:['#2258c4','#76aceb','#c4e1fa','#ffffff'],stem:'#6392df'}
};

export function createFlowerMaterials(renderer){
  const size=256,data=new Uint8Array(size*size*4),rough=new Uint8Array(size*size*4),rand=seededRandom(91);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4;
    // Subtle woven threads crossed by longitudinal satin fibres.
    const nx=Math.sin(x*Math.PI*.5)*.24+Math.sin(x*.19635)*.10;
    const ny=Math.sin(y*Math.PI*.5)*.13+(rand()-.5)*.055;
    data[i]=128+nx*100;data[i+1]=128+ny*100;data[i+2]=252;data[i+3]=255;
    const r=226+Math.sin(x*Math.PI*.5)*9+Math.sin(y*Math.PI*.5)*5+(rand()-.5)*5;
    rough[i]=rough[i+1]=rough[i+2]=r;rough[i+3]=255;
  }
  function texture(bytes){const tex=new THREE.DataTexture(bytes,size,size);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(2,7);tex.generateMipmaps=true;tex.minFilter=THREE.LinearMipmapLinearFilter;tex.magFilter=THREE.LinearFilter;tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());tex.needsUpdate=true;return tex;}
  const normalMap=texture(data),roughnessMap=texture(rough),translucency={value:.35};
  const petal=new THREE.MeshPhysicalMaterial({vertexColors:true,side:THREE.DoubleSide,metalness:.04,roughness:.43,roughnessMap,normalMap,normalScale:new THREE.Vector2(.2,.12),clearcoat:.12,clearcoatRoughness:.6,sheen:.62,sheenColor:'#badbff',sheenRoughness:.72,anisotropy:.32,anisotropyRotation:Math.PI*.5});
  petal.onBeforeCompile=shader=>{
    shader.uniforms.petalTranslucency=translucency;
    shader.fragmentShader='uniform float petalTranslucency;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
      #if NUM_DIR_LIGHTS > 0
        float transmitted = pow(max(dot(-normal, directionalLights[0].direction), 0.0), 2.0);
        outgoingLight += diffuseColor.rgb * directionalLights[0].color * transmitted * petalTranslucency * 0.11;
      #endif
      #include <opaque_fragment>`);
  };
  const stem=new THREE.MeshPhysicalMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.38,metalness:.1,clearcoat:.22,clearcoatRoughness:.5,normalMap,normalScale:new THREE.Vector2(.13,.05)});
  const sepal=new THREE.MeshPhysicalMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.49,metalness:.035,sheen:.35,sheenColor:'#94b6f4',sheenRoughness:.75,normalMap,normalScale:new THREE.Vector2(.3,.08)});
  const veins=new THREE.MeshStandardMaterial({color:'#4976ce',roughness:.61,metalness:.015});
  const core=new THREE.MeshPhysicalMaterial({color:'#1245c7',roughness:.42,metalness:.035,clearcoat:.12});
  return {petal,stem,sepal,veins,core,translucency,normalMap,roughnessMap};
}

export function applyMaterialSettings(materials,s){
  const m=materials.petal;
  for(const key of ['roughness','metalness','clearcoat','sheen'])m[key]=s[key];
  m.anisotropy=s.anisotropy;m.normalScale.set(s.texture*.65,s.texture*.35);
  materials.translucency.value=s.translucency;
}
