export const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const mix=(a,b,t)=>a+(b-a)*t;
export function seededRandom(seed){let s=(Math.abs(Math.trunc(seed))||1)%2147483647;return()=>{s=s*16807%2147483647;return(s-1)/2147483646;};}
export function ribbonProfile(t,open,p){
  const start=.77, q=clamp((t-start)/(1-start)),a=q*p.curl;
  const arc=p.length*(1-start)/p.curl;
  const length=t<start?p.length*t:p.length*start+Math.sin(a)*arc;
  const roll=(1-Math.cos(a))*arc;
  const budR=.11+p.length*.36*Math.sin(t*Math.PI*.92)+Math.sin(a)*.08;
  const budZ=p.z+p.length*.69*(1-Math.cos(t*Math.PI))*.5-roll*.55;
  const openR=.12+length;
  // The middle crown is raised; outer ribbons sweep back toward the calyx.
  const openZ=p.z+Math.sin(t*Math.PI*.86)*p.cup+roll+p.rake*t;
  return {r:mix(budR,openR,open),z:mix(budZ,openZ,open)};
}
export function petalParameters(config,layer,index,seed,disorder){
  const rand=seededRandom(seed+layer*941+index*7919),noise=()=>rand()*2-1;
  return {layer,index,
    angle:index/config.count*Math.PI*2+layer*.187+noise()*.16*disorder,
    length:config.length*(1+noise()*.19*disorder),
    width:config.width*(1+noise()*.2*disorder),
    curl:2.05+noise()*1.05*disorder,
    twist:noise()*.78*disorder,skew:noise()*.16*disorder,
    cup:config.cup+noise()*.17*disorder,rake:config.rake+noise()*.18*disorder,
    phase:rand()*Math.PI*2,delay:rand()*.035*disorder,
    z:config.z+noise()*.06*disorder,disorder
  };
}

// Front, edge-on and rear views all use a camera-facing interaction surface.
// The actual petal plane is unsuitable for picking an edge-on flower.
export function interactionRadius(bloom){return .98+clamp(bloom)*1.32;}
