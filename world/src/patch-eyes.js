// Eye regions use the exported Patch mesh's rest coordinates, before skinning.
// Keeping the lids in the material makes them follow every head and sleep pose.

// One blink: a quick close, a short hold and a slower open, in seconds.
export function blinkShape(t) {
  return t < 0 || t > .28 ? 0 : t < .06 ? t / .06 : t < .11 ? 1 : 1 - (t - .11) / .17;
}

// Blinks are each viewer's own, as people's are. They come about every four seconds, less often while
// he reads or types and more often while he talks, and often when he shifts what he's doing.
// Some are half blinks and some come in pairs.
export function createBlinker(random = Math.random) {
  let wait = 1 + random() * 3, at = -1, depth = 1, pair = false, since = 9;
  const begin = () => { at = 0; since = 0; depth = random() < .15 ? .55 : 1; pair = depth === 1 && random() < .12; };
  return {
    update(dt, { rate = 1, shift = false } = {}) {
      since += dt;
      if (at >= 0) {
        at += dt;
        if (pair && at > .34) { pair = false; at = 0; }
        else if (!pair && at > .28) at = -1;
      } else {
        wait -= dt * rate;
        if (wait <= 0 || (shift && since > .8 && random() < .7)) { begin(); wait = 1.6 + random() * 5; }
      }
      return at < 0 ? 0 : blinkShape(at) * depth;
    },
  };
}

// Reading slows blinking; talking quickens it.
export const blinkRate = (action, talking) => talking ? 1.5 : ['computer', 'research', 'write'].includes(action) ? .55 : 1;
// Heavy lids when he's tired: about a third closed as his energy runs out.
export const drowsiness = energy => Number.isFinite(energy) ? Math.max(0, Math.min(1, (.35 - energy) / .3)) * .35 : 0;

export function createPatchEyes(model) {
  const closure = { value: 0 };
  model.traverse(node => {
    if (!node.isSkinnedMesh) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      material.onBeforeCompile = shader => {
        shader.uniforms.patchEyeClosure = closure;
        shader.vertexShader = 'uniform float patchEyeClosure;\nvarying vec3 patchRestPosition;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\npatchRestPosition = position;');
        shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
          vec2 lid = vec2((abs(position.x)-.112)/.069,(position.y-1.406)/.062);
          float lidBlend = (1.0-smoothstep(.85,1.12,length(lid))) * step(.14,position.z) * patchEyeClosure;
          vec3 lidNormal = normalize(vec3((position.x-sign(position.x)*.112)*3.0,(position.y-1.406)*3.0,1.0));
          objectNormal = normalize(mix(objectNormal,lidNormal,lidBlend));
        `);
        shader.fragmentShader = 'uniform float patchEyeClosure;\nvarying vec3 patchRestPosition;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
          if (patchEyeClosure > 0.0 && patchRestPosition.z > .14) {
            vec2 eye = vec2((abs(patchRestPosition.x) - .112) / .069, (patchRestPosition.y - 1.406) / .062);
            float region = 1.0 - smoothstep(.91, 1.08, length(eye));
            float crease = -.43 + .20 * eye.x * eye.x;
            float top = mix(1.12, crease, patchEyeClosure);
            float bottom = mix(-1.12, crease, patchEyeClosure);
            float cover = max(smoothstep(top-.025,top+.025,eye.y), 1.0-smoothstep(bottom-.025,bottom+.025,eye.y));
            if (patchEyeClosure > .999) cover = 1.0;
            vec3 skin = texture2D(map, vec2(.7813,.9283)).rgb;
            skin *= .94 + .06 * smoothstep(-1.0,1.0,eye.y);
            float seam = (1.0-smoothstep(.018,.05,abs(eye.y-crease))) * smoothstep(.85,1.0,patchEyeClosure);
            skin = mix(skin, vec3(.12,.035,.018), seam * .85 * (1.0-smoothstep(.75,1.0,abs(eye.x))));
            diffuseColor.rgb = mix(diffuseColor.rgb, skin, region * cover);
          }
        `);
      };
      material.customProgramCacheKey = () => 'patch-eyelids';
      material.needsUpdate = true;
    }
  });
  let sleepClosure = 0, droop = 0;
  const blinker = createBlinker();
  return { update(dt, sleeping, { rate, shift, drowsy = 0 } = {}) {
    sleepClosure += (Number(sleeping)-sleepClosure) * (1-Math.exp(-Math.max(0,dt)*12));
    droop += (drowsy-droop) * (1-Math.exp(-Math.max(0,dt)*1.5));
    const blink = blinker.update(Math.max(0,dt), { rate, shift });
    closure.value = Math.max(sleepClosure, sleeping ? 0 : Math.max(blink, droop));
  } };
}
