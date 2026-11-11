// Eye regions use the exported Patch mesh's rest coordinates, before skinning.
// Keeping the lids in the material makes them follow every head and sleep pose.
export function eyeClosure(time, sleeping) {
  if (sleeping) return 1;
  const cycle = Math.floor(Math.max(0,time) / 5.3);
  const at = Math.max(0,time) % 5.3;
  const start = 2.1 + Math.sin(cycle * 12.9898) * .9;
  const blink = t => t < 0 || t > .28 ? 0 : t < .06 ? t / .06 : t < .11 ? 1 : 1 - (t - .11) / .17;
  return Math.max(blink(at-start), cycle % 4 === 2 ? blink(at-start-.34) : 0);
}

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
  let sleepClosure = 0;
  return { update(time, sleeping, dt) {
    sleepClosure += (Number(sleeping)-sleepClosure) * (1-Math.exp(-Math.max(0,dt)*12));
    closure.value = Math.max(sleepClosure, sleeping ? 0 : eyeClosure(time, false));
  } };
}

