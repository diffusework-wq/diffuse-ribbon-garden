// Outer ribbons open first; the inner crown follows. Closing reverses this.
export function layerProgress(bloom,layer,delay=0){
  const x=Math.max(0,Math.min(1,(bloom-layer*.105-delay)/.72));
  return x*x*(3-2*x);
}

// Substeps keep the spring stable on slow frames and touch devices.
export function springStep(state,target,dt,stiffness=65,damping=8){
  const steps=Math.max(1,Math.ceil(dt/.008)),h=dt/steps;
  for(let i=0;i<steps;i++){state.velocity+=(stiffness*(target-state.value)-damping*state.velocity)*h;state.value+=state.velocity*h;}
  return state.value;
}

export function petalCenter(t,open,p){
  const budR=.10+p.length*.37*Math.sin(t*Math.PI*.88);
  const budZ=p.z+p.length*.77*(1-Math.cos(t*Math.PI))*.5;
  const curlStart=.68+open*.08,q=Math.max(0,(t-curlStart)/(1-curlStart));
  const curlAngle=q*Math.PI*p.curl,arc=p.length*(1-curlStart)/(Math.PI*p.curl);
  const along=t<curlStart?p.length*t:p.length*curlStart+Math.sin(curlAngle)*arc;
  const rolled=(1-Math.cos(curlAngle))*arc;
  const spread=.12+along*.98;
  const cup=p.z+.16+Math.sin(t*Math.PI)*(.38+p.layer*.045)+rolled;
  return {r:budR*(1-open)+spread*open+Math.sin(curlAngle)*.16*(1-open),z:budZ*(1-open)+cup*open-rolled*.9*(1-open)};
}
