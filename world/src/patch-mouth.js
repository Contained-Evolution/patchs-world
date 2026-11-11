import { estimateTiming, mouthAt } from '../../shared/speech.js';

// The mouth follows the line's timing: its recording's when there is one, otherwise one spread over the text.
// Sampling it at the shared clock keeps late arrivals and polling from restarting the mouth.
export function speechMouth(speech, timing, now, sleeping = false) {
  const start = Date.parse(speech?.at), end = Date.parse(speech?.until);
  if (sleeping || !speech?.text?.trim() || !Number.isFinite(start) || !Number.isFinite(end) || now < start || now >= end) return { open: 0, round: 0, wide: 0 };
  return mouthAt(timing || estimateTiming(speech.text, end - start), now - start);
}

// How fast each part of the mouth moves toward its shape. Lips shut faster than they open, so m, b and p land.
const RATES = { open: [26, 40], round: [16, 16], wide: [16, 16] };

export function createPatchMouth(model) {
  const uniforms = { patchMouthOpening: { value: 0 }, patchMouthRound: { value: 0 }, patchMouthWide: { value: 0 } };
  model.traverse(node => {
    if (!node.isSkinnedMesh) return;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      const compile = material.onBeforeCompile;
      const cacheKey = material.customProgramCacheKey.bind(material);
      const previousKey = cacheKey();
      material.onBeforeCompile = shader => {
        compile.call(material,shader);
        Object.assign(shader.uniforms, uniforms);
        const head = 'uniform float patchMouthOpening;\nuniform float patchMouthRound;\nuniform float patchMouthWide;\nvarying vec3 patchMouthRest;\n';
        shader.vertexShader = head + shader.vertexShader;
        // Rounding draws the lips in and pushes them forward; spreading pulls the corners out.
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          patchMouthRest = position;
          float smileY = 1.252 + 1.6 * position.x * position.x;
          float lips = (1.0-smoothstep(.14,.23,abs(position.x))) * smoothstep(1.06,1.16,position.y)
            * (1.0-smoothstep(1.31,1.37,position.y)) * smoothstep(.12,.20,position.z);
          transformed.x *= 1.0 + lips * (patchMouthWide * .03 - patchMouthRound * .16);
          transformed.z += lips * patchMouthRound * .010 * (1.0-smoothstep(0.0,.16,abs(position.x)));
          float jaw = (1.0-smoothstep(.13,.23,abs(position.x))) * smoothstep(1.03,1.13,position.y)
            * (1.0-smoothstep(smileY-.025,smileY+.01,position.y)) * smoothstep(.12,.20,position.z);
          transformed.y -= patchMouthOpening * .035 * jaw;
        `);
        shader.fragmentShader = head + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
          if (patchMouthOpening > .001 && patchMouthRest.z > .20) {
            float halfWidth = .145 * (1.0 - patchMouthWide * .08 - patchMouthRound * .34);
            float mouthX = patchMouthRest.x / halfWidth;
            float smileY = 1.252 + 1.6 * patchMouthRest.x * patchMouthRest.x;
            float width = 1.0-smoothstep(.78,1.0,abs(mouthX));
            // A rounded mouth is an O; a spread one a flatter slot.
            float profile = mix(max(0.0,1.0-mouthX*mouthX), sqrt(max(0.0,1.0-mouthX*mouthX)), patchMouthRound);
            float depth = patchMouthOpening * .026 * (1.0 + patchMouthRound * .25 - patchMouthWide * .35) * profile;
            float inside = (1.0-smoothstep(smileY-.001,smileY+.003,patchMouthRest.y))
              * smoothstep(smileY-depth-.002,smileY-depth+.002,patchMouthRest.y) * width;
            vec3 cavity = mix(vec3(.035,.008,.006),vec3(.15,.028,.025),smoothstep(smileY-depth,smileY,patchMouthRest.y)*.3);
            // Upper teeth show at the top of a wide-open mouth.
            float teeth = smoothstep(smileY-.006,smileY-.002,patchMouthRest.y) * smoothstep(.45,.8,patchMouthOpening)
              * (1.0-smoothstep(.45,.75,abs(mouthX))) * (1.0-patchMouthRound);
            cavity = mix(cavity, vec3(.86,.82,.74), teeth * .8);
            diffuseColor.rgb = mix(diffuseColor.rgb,cavity,inside);
          }
        `);
      };
      material.customProgramCacheKey = () => previousKey + '-talking-mouth';
      material.needsUpdate = true;
    }
  });
  const ease = (uniform, target, [up, down], dt) => { uniform.value += (target - uniform.value) * (1 - Math.exp(-Math.max(0, dt) * (target > uniform.value ? up : down))); };
  return {
    update(speech, timing, now, sleeping, dt) {
      const shape = speechMouth(speech, timing, now, sleeping);
      ease(uniforms.patchMouthOpening, shape.open, RATES.open, dt);
      ease(uniforms.patchMouthRound, shape.round, RATES.round, dt);
      ease(uniforms.patchMouthWide, shape.wide, RATES.wide, dt);
    },
  };
}
