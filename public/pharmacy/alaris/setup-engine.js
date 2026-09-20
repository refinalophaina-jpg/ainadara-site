// Deliberately simplified primary-bag rehearsal. Not a device/set IFU.
// Ordering reference: manufacturer v12.1 user manual, printed pp. 64–70.
export const SETUP_STEPS = [
  ['bag','Choose the prepared bag','Select the prepared infusion bag on the supply tray. No compounding is simulated.'],
  ['inspect','Inspect the container','Rehearse the order, label, integrity and expiry check. This trainer cannot verify a real product.'],
  ['set','Choose the primary set','Select the compatible primary pump set. Compatibility must be verified against the actual equipment IFU.'],
  ['clamp','Close the roller clamp','Close the clamp before connecting the set to the container.'],
  ['spike','Connect set to container','Select the bag port to rehearse spiking. Aseptic technique is not assessed by clicking.'],
  ['hang','Hang the bag','Select the pole hook to hang the connected bag. Position is schematic, not a measurement.'],
  ['chamber','Fill the drip chamber','Select the chamber to rehearse filling it. The illustration represents the reference two-thirds fill.'],
  ['prime','Prime the line','Open the roller clamp to prime the disconnected set. Watch fluid displace air. Animation time is arbitrary, not a priming specification.'],
  ['clamp','Close the primed set','Close the roller clamp after the visual priming demonstration.'],
  ['inspect-line','Inspect the primed line','Select the distal line. Rehearse checking for air and confirming flow has stopped. Patient connection is not simulated.'],
  ['door','Open the module door','Open the door with the primed line clamped.'],
  ['upper','Seat the upper fitment','Place the upper fitment in the illustrated module recess.'],
  ['safety','Seat the safety-clamp fitment','Place the safety-clamp fitment in its recess. Detailed set mechanics are simplified.'],
  ['sensor','Seat tubing in the air-in-line detector','Place tubing in the detector. Rehearse checking alignment without stretching or twisting.'],
  ['door','Close and latch the door','Close the module door after all three placements.'],
  ['clamp','Open the roller clamp','Open the clamp with the set secured inside the module.'],
  ['no-flow','Verify no free flow','Select the drip chamber to confirm there is no flow before starting the programmed infusion.'],
];
export const initialSetup = () => ({step:0,priming:0,busy:false,events:[],feedback:''});
export const setupReady = s => s.step === SETUP_STEPS.length && !s.busy;
export function setupTransition(state, action) {
  if(action.type==='tick') {
    if(!state.busy || !Number.isFinite(action.seconds) || action.seconds<=0)return state;
    const priming=Math.min(1,state.priming+action.seconds/4);
    return {...state,priming,busy:priming<1,step:priming===1?state.step+1:state.step,feedback:priming===1?'The schematic line is filled. Close the clamp, then inspect the line.':state.feedback};
  }
  if(action.type!=='act')return state;
  const expected=SETUP_STEPS[state.step];
  if(!expected)return state;
  const accepted=!state.busy&&action.target===expected[0];
  const detail=state.busy?'Priming demonstration in progress.':accepted?expected[1]:`Not yet. ${expected[1]}.`;
  const events=[...state.events,{at:new Date().toISOString(),step:state.step+1,target:action.target,accepted,detail}];
  if(!accepted)return {...state,events,feedback:detail};
  return {...state,events,feedback:detail,busy:action.target==='prime',step:action.target==='prime'?state.step:state.step+1};
}
