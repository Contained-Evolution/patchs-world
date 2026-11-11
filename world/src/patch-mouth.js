// Speech is visible for eight seconds, ending at the server's speechUntil.
// Sampling that window keeps late arrivals and polling from restarting the mouth.
export function speechMouth(says, speechUntil, now, sleeping = false) {
  const end = Date.parse(speechUntil), elapsed = (now - end + 8000) / 1000;
  if (sleeping || typeof says !== 'string' || !says.trim() || !Number.isFinite(end) || elapsed < 0 || elapsed >= 8) return 0;
  const text = says.trim();
  const progress = elapsed / 8 * text.length;
  const char = text[Math.min(text.length - 1, Math.floor(progress))];
  if (/[\s.,!?;:—]/u.test(char)) return 0;
  const pulse = Math.pow(Math.max(0, Math.sin(elapsed * Math.PI * 7)), .8);
  const emphasis = /[aeiou]/i.test(char) ? 1 : .65;
  return pulse * emphasis * Math.min(1, elapsed * 12, (8-elapsed) * 10);
}

export function createPatchMouth(model) {
  const opening = {value: 0};
  model.traverse(node => {
    if (!node.isSkinnedMesh) return;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      const compile = material.onBeforeCompile;
      const cacheKey = material.customProgramCacheKey.bind(material);
      const previousKey = cacheKey();
      material.onBeforeCompile = shader => {
        compile.call(material,shader);
        shader.uniforms.patchMouthOpening = opening;
        shader.vertexShader = 'uniform float patchMouthOpening;\nvarying vec3 patchMouthRest;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          patchMouthRest = position;
          float smileY = 1.252 + 1.6 * position.x * position.x;
          float jaw = (1.0-smoothstep(.13,.23,abs(position.x))) * smoothstep(1.03,1.13,position.y)
            * (1.0-smoothstep(smileY-.025,smileY+.01,position.y)) * smoothstep(.12,.20,position.z);
          transformed.y -= patchMouthOpening * .035 * jaw;
        `);
        shader.fragmentShader = 'uniform float patchMouthOpening;\nvarying vec3 patchMouthRest;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
          if (patchMouthOpening > .001 && patchMouthRest.z > .20) {
            float mouthX = patchMouthRest.x / .145;
            float smileY = 1.252 + 1.6 * patchMouthRest.x * patchMouthRest.x;
            float width = 1.0-smoothstep(.78,1.0,abs(mouthX));
            float depth = patchMouthOpening * .026 * max(0.0,1.0-mouthX*mouthX);
            float inside = (1.0-smoothstep(smileY-.001,smileY+.003,patchMouthRest.y))
              * smoothstep(smileY-depth-.002,smileY-depth+.002,patchMouthRest.y) * width;
            vec3 cavity = mix(vec3(.035,.008,.006),vec3(.15,.028,.025),smoothstep(smileY-depth,smileY,patchMouthRest.y)*.3);
            diffuseColor.rgb = mix(diffuseColor.rgb,cavity,inside);
          }
        `);
      };
      material.customProgramCacheKey = () => previousKey + '-talking-mouth';
      material.needsUpdate = true;
    }
  });
  return {update(says, speechUntil, now, sleeping, dt) {
    const target = speechMouth(says,speechUntil,now,sleeping);
    opening.value += (target-opening.value) * (1-Math.exp(-Math.max(0,dt)*35));
  }};
}
