# Combine Patch.fbx (Meshy model, Mixamo-named rig) and the Mixamo clip FBXs into one GLB.
# blender -b -P tools/combine-patch.py -- art/animations world/assets/patch.glb
import bpy, sys, os
args = sys.argv[sys.argv.index('--')+1:]
art, out = args[0], args[1]
CLIPS = {'Breathing Idle': 'idle', 'Walking': 'walk', 'Running': 'run', 'Hanging Idle': 'hang', 'Start Swinging': 'swing-start',
         'Climbing A Rope': 'rope-climb', 'Swing To Land': 'swing-land',
         'Swinging': 'swing', 'Rope Swinging': 'rope-swing', 'Swimming': 'swim', 'Treading Water': 'tread', 'Sitting': 'sit',
         'Sleeping Idle': 'sleep', 'Laying Sleeping': 'sleep-lay', 'Sleeping roll over': 'sleep-roll', 'Pick Fruit': 'pick-fruit',
         'Left Shimmy': 'hang-shimmy-left', 'Right Shimmy': 'hang-shimmy-right', 'Freehang Drop': 'hang-drop',
         'Hanging from rope idle': 'rope-hang', 'Braced Hang': 'braced-hang', 'Braced Hang Idle': 'braced-idle',
         'Braced Hang Shimmy left': 'braced-shimmy-left', 'Braced Hang Shimmy right': 'braced-shimmy-right',
         'Braced Hang Hop Up': 'braced-hop-up', 'Braced Hang Drop': 'braced-drop',
         'Sitting Idle': 'sit-ground', 'Typing': 'typing', 'Sit To Type': 'sit-to-type', 'Type To Sit': 'type-to-sit',
         'Texting': 'texting', 'Walking While Texting': 'walk-texting', 'Texting While Standing': 'tablet-stand',
         'Climbing To Top': 'climb-top', 'Yawn': 'yawn', 'Jumping Down': 'jump-down', 'Jump': 'jump',
         'Opening A Lid': 'open-lid', 'Falling': 'fall', 'Picking Up': 'pick-up',
         'Walking carry box': 'carry-walk', 'running carry box': 'carry-run',
         'jogging carry box': 'carry-jog', 'Walking carry box and stop': 'carry-stop',
         'Happy Idle': 'happy-idle', 'Happy Walk': 'happy-walk', 'Angry': 'angry', 'Angry Point': 'angry-point',
         'Climbing tree': 'tree-climb', 'archery Idle 01': 'bow-idle', 'archery Idle 03 Examine': 'bow-examine',
         'archery Aim Idle 02 Looking': 'bow-look', 'Standing Draw Arrow': 'bow-draw', 'Standing Aim Overdraw': 'bow-aim',
         'Happy Idle 2': 'happy-idle-2', 'Happy arm swing': 'happy-swing', 'Excited': 'excited', 'Sitting Victory': 'sit-cheer',
         'Running Forward Flip': 'flip', 'Dancing': 'dance', 'Arms Hip Hop Dance': 'dance-arms', 'Hip Hop Dancing': 'dance-hip-hop',
         'Hip Hop Dancing 2': 'dance-hip-hop-2', 'Hip Hop Dancing (3)': 'dance-hip-hop-3', 'Swing Dancing': 'dance-swing',
         'Swing Dancing 2': 'dance-swing-2', 'Backflip': 'backflip', 'stand to sit': 'stand-to-sit', 'sitting to scared': 'sit-scared',
         'Seated Idle': 'seat-idle', 'Sitting Idle 2': 'sit-idle-2', 'Sitting Idle (3)': 'sit-idle-3', 'Male Laying Pose': 'lay-pose',
         'Laying': 'lay', 'sky watching': 'sky-watch', 'Laying Sleeping 2': 'sleep-lay-2'}
MESHY = {'Idle_03': 'look-around', 'Swing_on_Rope_to_Ground': 'rope-to-ground'}
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=os.path.join(art, 'Patch.fbx'))
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
arm.name = 'Patch'
keep = []
for action in list(bpy.data.actions):
    part = action.name.split('|')[1] if '|' in action.name else action.name
    if part in MESHY:
        action.name = MESHY[part]; keep.append(action)
    else:
        bpy.data.actions.remove(action)
for file, clip in CLIPS.items():
    before = set(bpy.data.objects)
    old_actions = set(bpy.data.actions)
    bpy.ops.import_scene.fbx(filepath=os.path.join(art, file + '.fbx'))
    for action in set(bpy.data.actions) - old_actions:
        if 'mixamo.com' in action.name: action.name = clip; keep.append(action)
        else: bpy.data.actions.remove(action)
    for obj in set(bpy.data.objects) - before:
        bpy.data.objects.remove(obj, do_unlink=True)
for m in list(bpy.data.meshes):
    if m.users == 0: bpy.data.meshes.remove(m)
# Each clip becomes an NLA track on Patch's armature so the exporter writes them all.
arm.animation_data_create()
arm.animation_data.action = None
for action in keep:
    track = arm.animation_data.nla_tracks.new()
    track.name = action.name
    strip = track.strips.new(action.name, int(action.frame_range[0]), action)
    print('clip', action.name, [round(x) for x in action.frame_range])
for img in bpy.data.images:
    if img.size[0] > 1024: img.scale(1024, 1024)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animation_mode='NLA_TRACKS',
    export_image_format='JPEG', export_jpeg_quality=88, export_apply=False)
print('wrote', out, os.path.getsize(out))
