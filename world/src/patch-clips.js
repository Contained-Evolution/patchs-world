// Every clip in patch.glb. Durations are in seconds. Hanging clips record where
// the hands sit relative to Patch's feet ([forward, up] in metres, at the start
// and end of the clip) and how far the clip itself carries him sideways, so the
// island can put his hands exactly on a ledge, branch or rope.
export const CLIPS = {
 idle:{label:'Breathing idle',group:'Ground',duration:239/24,use:'Standing around camp and thinking'},
 'look-around':{label:'Look around',group:'Ground',duration:103/24,use:'Looking out from the lookout and pausing while he explores'},
 walk:{label:'Walk',group:'Ground',duration:25/24,use:'Walking between places'},
 run:{label:'Run',group:'Ground',duration:16/24,use:'Running when he is very hungry'},
 sit:{label:'Sit on a seat',group:'Ground',duration:28/24,use:'Sitting on a chair, bench, driftwood or the fishing stump'},
 'sit-ground':{label:'Sit on the ground',group:'Ground',duration:247/24,use:'Sitting where there is no seat, and watching the sky in the meadow'},
 'pick-fruit':{label:'Pick fruit',group:'Ground',duration:192/24,use:'Eating in the banana grove, facing a banana tree'},
 'sit-to-type':{label:'Sit to type',group:'Devices',duration:29/24,use:'Reaching for the keys at the coconut computer'},
 typing:{label:'Typing',group:'Devices',duration:396/24,use:'Answering letters, searching and writing at the coconut computer'},
 'type-to-sit':{label:'Type to sit',group:'Devices',duration:23/24,use:'Sitting back from the coconut computer'},
 texting:{label:'Texting',group:'Devices',duration:445/24,use:'Standing with his tablet: looking things up and writing his journal'},
 'walk-texting':{label:'Walking while texting',group:'Devices',duration:96/24,use:'Wandering about with his tablet in both hands'},
 swim:{label:'Swim',group:'Water',duration:109/24,use:'Swimming in the pond'},
 tread:{label:'Tread water',group:'Water',duration:72/24,use:'Treading water'},
 sleep:{label:'Sleep on side',group:'Sleep',duration:165/24,use:'Sleeping on his side in the hammock'},
 'sleep-roll':{label:'Roll over in sleep',group:'Sleep',duration:423/24,use:'Rolling over now and then while he sleeps on his side'},
 'sleep-lay':{label:'Sleep on back',group:'Sleep',duration:41/24,use:'Sleeping on his back in the hammock'},
 'swing-start':{label:'Start swinging',group:'Trees',duration:49/24,use:'Pulling himself up into the tall trees'},
 swing:{label:'Swing',group:'Trees',duration:48/24,use:'Between holds while he swings through the trees'},
 'rope-swing':{label:'Rope swing',group:'Trees',duration:107/24,use:'Swinging on a rope in the tall trees'},
 'rope-climb':{label:'Climbing a rope',group:'Trees',duration:2.6,hands:[[.072,1.605]],use:'Climbing a rope to its canopy branch'},
 'swing-land':{label:'Swing to land',group:'Trees',duration:1.9,use:'Landing on the canopy branch before lying down'},
 'rope-to-ground':{label:'Rope to ground',group:'Trees',duration:104/24,use:'Coming down from the trees'},
 hang:{label:'Free hang',group:'Free hang',duration:113/24,hands:[[.065,1.585]],use:'Hanging from a branch in the tall trees'},
 'hang-shimmy-left':{label:'Free hang shimmy left',group:'Free hang',duration:33/24,hands:[[.01,1.62]],shift:.21,use:'Along a branch, toward the trunk'},
 'hang-shimmy-right':{label:'Free hang shimmy right',group:'Free hang',duration:34/24,hands:[[.01,1.62]],shift:-.23,use:'Along a branch, back toward its tip'},
 'hang-drop':{label:'Free hang drop',group:'Free hang',duration:32/24,hands:[[.01,1.715],null],use:'A free-hang drop; only where the ground is within reach'},
 'rope-hang':{label:'Hang from rope',group:'Free hang',duration:63/24,hands:[[.06,1.43]],use:'Holding a rope in the tall trees'},
 'braced-hang':{label:'Jump to braced hang',group:'Braced hang',duration:31/24,hands:[null,[.43,1.505]],use:'Jumping up onto the climbing rock at the lookout'},
 'braced-idle':{label:'Braced hang',group:'Braced hang',duration:56/24,hands:[[.32,1.37]],use:'Hanging with his feet on the climbing rock'},
 'braced-shimmy-left':{label:'Braced shimmy left',group:'Braced hang',duration:28/24,hands:[[.31,1.63]],shift:.33,use:'Along the climbing rock’s ledge'},
 'braced-shimmy-right':{label:'Braced shimmy right',group:'Braced hang',duration:28/24,hands:[[.315,1.63]],shift:-.32,use:'Along the climbing rock’s ledge'},
 'braced-hop-up':{label:'Braced hop up',group:'Braced hang',duration:40/24,hands:[[.32,1.25],[.31,1.69]],use:'From the rock’s lip up to its top edge'},
 'braced-drop':{label:'Braced drop',group:'Braced hang',duration:40/24,hands:[[.31,1.68],null],use:'Dropping off the climbing rock'},
};

// The moves each kind of hang allows. A braced hang needs a flat wall for his
// feet; a free hang is a branch with nothing behind him; a rope only lets him hold on.
export const HANG_CLIPS = {
 braced:{grab:'braced-hang',idle:'braced-idle',left:'braced-shimmy-left',right:'braced-shimmy-right',up:'braced-hop-up',drop:'braced-drop'},
 free:{idle:'hang',left:'hang-shimmy-left',right:'hang-shimmy-right',drop:'hang-drop'},
 rope:{idle:'rope-hang',drop:'hang-drop'},
};
// How far his hands rise in a hop up, and the furthest a drop clip can land.
export const HOP_RISE=.44, DROP_REACH=2.4;
