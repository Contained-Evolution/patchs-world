// Every clip in patch.glb. Durations are in seconds. Hanging clips record where
// the hands sit relative to Patch's feet ([forward, up] in metres, at the start
// and end of the clip) and how far the clip itself carries him sideways, so the
// island can put his hands exactly on a ledge, branch or rope.
// `posture` is how his body is held and `arms` what his hands are doing: relaxed (fine
// with something in one hand), free (they must be empty), hold (gripping a ledge,
// branch or rope) or the prop the clip is animated around. patch-beats.js uses both
// to keep a clip out of any moment it would collide with. `once` clips play through
// and stop, `quiet` clips wait while he is talking, and `spare` clips are in the
// model with nothing on the island that plays them. `seat` is how far behind his
// feet a seated clip puts his hips, so each one lands on the same seat, and `lift`
// is how far above the ground a lying clip holds him.
export const CLIPS = {
 'climb-top':{label:'Climb to top',group:'Trees',duration:4,posture:'hang',arms:'hold',use:'Pulling onto the canopy after climbing the rope'},
 yawn:{label:'Yawn',group:'Sleep',duration:8.3333,posture:'stand',arms:'free',once:true,quiet:true,use:'Yawning before sleep and while tired'},
 'jump-down':{label:'Jump down',group:'Trees',duration:2.6667,posture:'air',arms:'free',use:'Deliberately jumping down from a height'},
 jump:{label:'Jump',group:'Ground',duration:1.6667,posture:'stand',arms:'free',once:true,use:'Jumping while exploring'},
 'open-lid':{label:'Open a lid',group:'Foraging',duration:8.9333,posture:'stand',arms:'basket',use:'Opening the banana store to unload his basket'},
 fall:{label:'Fall',group:'Trees',duration:11.3667,posture:'air',arms:'free',use:'Falling when an elevated activity loses its support'},
 'pick-up':{label:'Pick up',group:'Foraging',duration:9.5667,posture:'stand',arms:'basket',use:'Picking up and setting down his banana basket'},
 'carry-walk':{label:'Walk carrying basket',group:'Foraging',duration:2.8667,posture:'move',arms:'basket',use:'Walking with his food basket'},
 'carry-run':{label:'Run carrying basket',group:'Foraging',duration:1.2667,posture:'move',arms:'basket',use:'Running with his food basket'},
 'carry-jog':{label:'Jog carrying basket',group:'Foraging',duration:0.7667,posture:'move',arms:'basket',use:'Jogging with his food basket'},
 'carry-stop':{label:'Stop carrying basket',group:'Foraging',duration:4.9,posture:'stand',arms:'basket',use:'Stopping before setting down his basket'},

 idle:{label:'Breathing idle',group:'Ground',duration:239/24,posture:'stand',arms:'relaxed',use:'Standing around camp and thinking'},
 'look-around':{label:'Look around',group:'Ground',duration:103/24,posture:'stand',arms:'relaxed',once:true,use:'Looking out from the lookout and pausing while he explores'},
 walk:{label:'Walk',group:'Ground',duration:25/24,posture:'move',arms:'relaxed',use:'Walking between places'},
 run:{label:'Run',group:'Ground',duration:16/24,posture:'move',arms:'relaxed',use:'Running when he is very hungry'},
 sit:{label:'Sit on a seat',group:'Sitting',duration:28/24,posture:'seat',arms:'relaxed',seat:.12,use:'Sitting still on a seat for a while'},
 'sit-ground':{label:'Sit on the ground',group:'Sitting',duration:247/24,posture:'ground',arms:'relaxed',use:'Sitting where there is no seat, and watching the sky in the meadow'},
 'pick-fruit':{label:'Pick fruit',group:'Ground',duration:192/24,posture:'stand',arms:'free',once:true,use:'Eating in the banana grove, facing a banana tree'},
 'sit-to-type':{label:'Sit to type',group:'Devices',duration:29/24,posture:'seat',arms:'keys',use:'Reaching for the keys at the coconut computer'},
 typing:{label:'Typing',group:'Devices',duration:396/24,posture:'seat',arms:'keys',use:'Answering letters, searching and writing at the coconut computer'},
 'type-to-sit':{label:'Type to sit',group:'Devices',duration:23/24,posture:'seat',arms:'keys',use:'Sitting back from the coconut computer'},
 texting:{label:'Texting',group:'Devices',duration:445/24,posture:'stand',arms:'tablet',once:true,use:'Using the tablet with one hand between two-handed stretches'},
 // His hand brings the tablet up at `out` seconds and both hands hold it from `held`; the rest loops.
 'tablet-stand':{label:'Texting while standing',group:'Devices',duration:566/24,out:42/24,held:53/24,posture:'stand',arms:'tablet',use:'Pulling out his tablet, then reading and writing on it standing up'},
 'walk-texting':{label:'Walking while texting',group:'Devices',duration:96/24,posture:'move',arms:'tablet',use:'Wandering about with his tablet in both hands'},
 swim:{label:'Swim',group:'Water',duration:109/24,posture:'water',arms:'free',use:'Swimming in the pond'},
 tread:{label:'Tread water',group:'Water',duration:72/24,posture:'water',arms:'free',use:'Treading water'},
 sleep:{label:'Sleep on side',group:'Sleep',duration:165/24,posture:'lie',arms:'relaxed',use:'Sleeping on his side in the hammock'},
 'sleep-roll':{label:'Roll over in sleep',group:'Sleep',duration:423/24,posture:'lie',arms:'relaxed',use:'Rolling over now and then while he sleeps on his side'},
 'sleep-lay':{label:'Sleep on back',group:'Sleep',duration:41/24,posture:'lie',arms:'relaxed',lift:.63,use:'Sleeping on his back in the hammock or on the ground'},
 'swing-start':{label:'Start swinging',group:'Trees',duration:49/24,posture:'hang',arms:'hold',use:'Pulling himself up into the tall trees'},
 swing:{label:'Swing',group:'Trees',duration:48/24,posture:'hang',arms:'hold',use:'Between holds while he swings through the trees'},
 'rope-swing':{label:'Rope swing',group:'Trees',duration:107/24,posture:'hang',arms:'hold',use:'Swinging on a rope in the tall trees'},
 'rope-climb':{label:'Climbing a rope',group:'Trees',duration:2.6,hands:[[.072,1.605]],posture:'hang',arms:'hold',use:'Climbing a rope to its canopy branch'},
 'swing-land':{label:'Swing to land',group:'Trees',duration:1.9,posture:'hang',arms:'hold',spare:true,use:'Landing on the canopy branch before lying down'},
 'rope-to-ground':{label:'Rope to ground',group:'Trees',duration:104/24,posture:'hang',arms:'hold',spare:true,use:'Coming down from the trees'},
 hang:{label:'Free hang',group:'Free hang',duration:113/24,hands:[[.065,1.585]],posture:'hang',arms:'hold',use:'Hanging from a branch in the tall trees'},
 'hang-shimmy-left':{label:'Free hang shimmy left',group:'Free hang',duration:33/24,hands:[[.01,1.62]],shift:.21,posture:'hang',arms:'hold',use:'Along a branch, toward the trunk'},
 'hang-shimmy-right':{label:'Free hang shimmy right',group:'Free hang',duration:34/24,hands:[[.01,1.62]],shift:-.23,posture:'hang',arms:'hold',use:'Along a branch, back toward its tip'},
 'hang-drop':{label:'Free hang drop',group:'Free hang',duration:32/24,hands:[[.01,1.715],null],posture:'hang',arms:'hold',use:'A free-hang drop; only where the ground is within reach'},
 'rope-hang':{label:'Hang from rope',group:'Free hang',duration:63/24,hands:[[.06,1.43]],posture:'hang',arms:'hold',use:'Holding a rope in the tall trees'},
 'braced-hang':{label:'Jump to braced hang',group:'Braced hang',duration:31/24,hands:[null,[.43,1.505]],posture:'hang',arms:'hold',use:'Jumping up onto the climbing rock at the lookout'},
 'braced-idle':{label:'Braced hang',group:'Braced hang',duration:56/24,hands:[[.32,1.37]],posture:'hang',arms:'hold',use:'Hanging with his feet on the climbing rock'},
 'braced-shimmy-left':{label:'Braced shimmy left',group:'Braced hang',duration:28/24,hands:[[.31,1.63]],shift:.33,posture:'hang',arms:'hold',use:'Along the climbing rock’s ledge'},
 'braced-shimmy-right':{label:'Braced shimmy right',group:'Braced hang',duration:28/24,hands:[[.315,1.63]],shift:-.32,posture:'hang',arms:'hold',use:'Along the climbing rock’s ledge'},
 'braced-hop-up':{label:'Braced hop up',group:'Braced hang',duration:40/24,hands:[[.32,1.25],[.31,1.69]],posture:'hang',arms:'hold',use:'From the rock’s lip up to its top edge'},
 'braced-drop':{label:'Braced drop',group:'Braced hang',duration:40/24,hands:[[.31,1.68],null],posture:'hang',arms:'hold',use:'Dropping off the climbing rock'},
 'happy-idle':{label:'Happy idle',group:'Feelings',duration:61/30,posture:'stand',arms:'free',use:'Bouncing on the spot when he feels good'},
 'happy-walk':{label:'Happy walk',group:'Feelings',duration:34/30,posture:'move',arms:'relaxed',use:'Walking with a spring in his step when he feels good'},
 angry:{label:'Angry',group:'Feelings',duration:19.2,posture:'stand',arms:'free',once:true,quiet:true,use:'Grumbling when a need has run very low or a storm has caught him outside'},
 'angry-point':{label:'Angry point',group:'Feelings',duration:74/30,posture:'stand',arms:'free',once:true,use:'Jabbing a finger at whatever has annoyed him'},
 'tree-climb':{label:'Climbing a tree',group:'Trees',duration:3,posture:'hang',arms:'hold',use:'Climbing a trunk to the first branch before he swings'},
 'bow-idle':{label:'Bow idle',group:'Archery',duration:154/30,posture:'stand',arms:'bow',use:'Standing with his bow between shots'},
 'bow-examine':{label:'Examine bow',group:'Archery',duration:154/30,posture:'stand',arms:'bow',once:true,use:'Looking his bow over between shots'},
 'bow-look':{label:'Bow look',group:'Archery',duration:151/30,posture:'stand',arms:'bow',once:true,use:'Looking for his mark with the bow raised'},
 'bow-draw':{label:'Draw arrow',group:'Archery',duration:32/30,posture:'stand',arms:'bow',once:true,use:'Drawing the bow for a shot'},
 'bow-aim':{label:'Aim at full draw',group:'Archery',duration:3.8,posture:'stand',arms:'bow',use:'Holding his aim before he lets go'},
 'happy-idle-2':{label:'Happy idle 2',group:'Feelings',duration:89/30,posture:'stand',arms:'free',use:'Wriggling happily on the spot'},
 'happy-swing':{label:'Happy arm swing',group:'Feelings',duration:301/30,posture:'stand',arms:'free',once:true,use:'Swinging his arms when he feels good'},
 excited:{label:'Excited',group:'Feelings',duration:6.6,posture:'stand',arms:'free',once:true,use:'Bursting with excitement, and greeting someone'},
 'sit-cheer':{label:'Sitting cheer',group:'Sitting',duration:169/30,posture:'seat',arms:'free',once:true,seat:0,use:'Cheering from a seat when he feels good'},
 flip:{label:'Forward flip',group:'Feelings',duration:34/30,posture:'stand',arms:'free',once:true,use:'Flipping for fun while he explores and dances'},
 dance:{label:'Dance',group:'Dancing',duration:244/30,posture:'stand',arms:'free',once:true,use:'Dancing'},
 'dance-arms':{label:'Arms hip hop dance',group:'Dancing',duration:22,posture:'stand',arms:'free',once:true,use:'Dancing'},
 'dance-hip-hop':{label:'Hip hop dance',group:'Dancing',duration:184/30,posture:'stand',arms:'free',once:true,use:'Dancing'},
 'dance-hip-hop-2':{label:'Hip hop dance 2',group:'Dancing',duration:461/30,posture:'stand',arms:'free',once:true,use:'Dancing'},
 'dance-hip-hop-3':{label:'Hip hop dance 3',group:'Dancing',duration:518/30,posture:'stand',arms:'free',once:true,use:'Dancing'},
 'dance-swing':{label:'Swing dance',group:'Dancing',duration:628/30,posture:'stand',arms:'free',once:true,use:'Dancing'},
 backflip:{label:'Backflip',group:'Feelings',duration:2.2,posture:'stand',arms:'free',once:true,use:'Flipping backwards for fun while he dances or feels good'},
 'stand-to-sit':{label:'Stand to sit',group:'Sitting',duration:134/30,posture:'seat',arms:'relaxed',seat:.26,use:'Lowering himself onto a seat'},
 'seat-idle':{label:'Seated idle',group:'Sitting',duration:4.2,posture:'seat',arms:'relaxed',seat:.01,use:'Sitting on a chair, bench, driftwood or the fishing stump'},
 'sit-scared':{label:'Sitting to scared',group:'Sitting',duration:10.1,posture:'seat',arms:'free',once:true,seat:-.03,use:'Starting up from his seat when he is on edge'},
 'sit-idle-2':{label:'Sit on the ground 2',group:'Sitting',duration:327/30,posture:'ground',arms:'relaxed',use:'Shifting how he sits on the ground'},
 'sit-idle-3':{label:'Sit on the ground 3',group:'Sitting',duration:10.3,posture:'ground',arms:'relaxed',use:'Shifting how he sits on the ground'},
 'lay-pose':{label:'Laying pose',group:'Sitting',duration:2/30,posture:'lie',arms:'relaxed',use:'Lying on his front, propped on his elbows'},
 lay:{label:'Laying',group:'Sitting',duration:131/30,posture:'lie',arms:'relaxed',use:'Leaning back on his elbows on the ground'},
 'sky-watch':{label:'Sky watching',group:'Sitting',duration:376/30,posture:'lie',arms:'relaxed',use:'Lying on his back with his hands behind his head, watching the sky'},
 'sleep-lay-2':{label:'Sleep on back 2',group:'Sleep',duration:41/24,posture:'lie',arms:'relaxed',lift:.63,spare:true,use:'The same motion as Sleep on back'},
 'dance-swing-2':{label:'Swing dance 2',group:'Dancing',duration:2.5,posture:'stand',arms:'free',use:'Keeping the beat between dances, and a little jig when he feels good'},
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
