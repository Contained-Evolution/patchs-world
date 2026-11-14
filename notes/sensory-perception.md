# Patch’s senses and memory

Extend [Patch’s perception](../worker/senses.mjs), the [island viewer](../world/src/main.js), and the [memory graph](../worker/memory-graph.mjs). Use the [shared flower interaction proposal](https://github.com/Contained-Evolution/tenari/blob/main/notes/asset-interactions.md) as the first scene. The route, facing direction, weather, asset placements, and contact events need to agree for Patch and every viewer, including while nobody is watching.

## Asset sensory profiles

Give every interactive or placed island object a stable instance ID and a five-row sensory table. Resolve each row from a reusable asset or material profile plus instance overrides. Give silent, odorless, and inactive channels explicit defaults. Cover procedural trees, ground cover and rocks through shared profiles with stable instance IDs or patches for dense ground cover. Keep meaningful individuals addressable. Use the [world registry](../world/src/editor/registry.js) and [published layout](../worker/editor-world.mjs) so moved, resized, removed and newly published objects resolve the same way in the worker and viewer. Include terrain surfaces, water, weather, and moving creatures as sources. Validate profile coverage in authoring and show source bounds, trigger and effective range in a preview.

| Sense | Author on each asset | Compute for Patch |
| --- | --- | --- |
| Sight | Shape and silhouette, size, color, contrast, movement, occlusion bounds, visible parts | Use open eyes, head direction, line of sight, light, and weather. Fade detail toward the edge of the forward field and with distance. A far landmark may register as a silhouette while a small rock disappears sooner. Eyes closed yield no live sight. |
| Smell | Scent IDs and descriptions, emission strength, source area, triggers and persistence | Use a small near-source spread and a downwind plume with falloff, dilution and travel time. Faster wind can carry scent farther downwind while spreading or thinning it. Track wet-earth and humid or musty air as authored cues when local conditions support them. |
| Touch | Material, texture, firmness, thermal response, wetness, contact points and triggers | Sample the surface under each contacting foot. Record grass, mud, stone or water and track wetness after leaving the water. Add air temperature, sun and shade, rain, and wind on exposed body regions, including pressure and cooling at the ears. Use actual hand contact for held objects. |
| Sound | Source dB SPL at a reference distance, cue, source position, trigger and duration, with a silent default | Start with distance attenuation for point sources, then apply occlusion, terrain, and a bounded downwind or upwind adjustment. Compare against local background noise so loud wind can mask a quieter source even downwind. Track sound direction separately from the feeling of wind on the ears. |
| Taste | Mouth-contact or airborne aerosol trigger, flavor descriptors, temperature and texture, and edible status | Trigger taste on modeled mouth contact, eating or drinking. Allow a faint salt cue from sea spray when aerosol reaches Patch near the shore. Use temperature and texture as oral sensations alongside flavor. A log can have a written taste profile while remaining inedible. |

Give a banana tree separate leaf, trunk and fruit cues. A log can smell woody or damp, feel rough, and creak only on a relevant trigger. A tent can block sight, shelter Patch from wind and rain, and flap in gusts. Large and small rocks can share stone material while their geometry affects visibility, occlusion and contact.

## Weather and movement

Extend the seeded island weather with a time-varying wind vector and gust strength, temperature, humidity and precipitation. Add local modifiers for open shore, exposed ridges, forest, sheltered camp and caves. Persist effects with their own decay, including soil dampness, mud, foot wetness and lingering scent. Use a gentle baseline breeze around 5% on an authoring scale and occasional stronger gusts or windy days. Calibrate that scale to physical simulation units during the first scene. Sample weather by location and time with one wind-direction convention across scent, sound and touch.

Use a headless movement and perception model driven by shared simulation time. Resolve Patch’s pose and environment at roughly one-second intervals along a walk or idle roam, with event timestamps for short contacts, snaps and splashes. Batch nearby-object checks using a spatial index and integrate by elapsed time. Store compact start/end encounters and intensity summaries in place of permanent per-second records. Catch up deterministically between worker wakes and deduplicate by stable event IDs so refreshes, multiple viewers and retries cannot create extra encounters.

## Thought, experience and memory

Give the model separate sections for current sight, smell, touch, sound and taste, recent encounters, confirmed actions, and recalled memories. Each observed cue carries a source, location, time range, intensity and confidence. A live thought may express feelings, plans and imagination in Patch’s voice. Concrete public claims need references to confirmed actions or observed cues. Preserve older writing and memories and treat unsupported claims as unverified.

After each thought, review the evidence for a meaningful experience. Let Patch combine cues into a short account in his own words. Save the experience and evidence references in his current memory store, index cue IDs to it, and strengthen relevant existing memories when a distinct encounter supports them. Merge repeated exposures into familiarity with diminishing returns. A recall can affect what comes to mind without counting as a new experience. Keep the journal’s writing step separate from thoughts and check its factual claims against the day’s recorded events before publishing.

## First implementation and checks

- Replay a 45-second walk through a meadow flower patch. The flower is in view for about 30 seconds, then drops out for the last 15. Reverse Patch’s gaze, close his eyes, put a tent between him and the flower, and compare near detail with distant silhouette.
- Replay the same path upwind, crosswind and downwind under light wind and gusts. Check scent arrival and fading, sound attenuation and masking, and ear cooling. Walk from dry grass through rain-softened mud into shallow water and check which body regions get wet and when they dry. Check shore spray and a mouth-triggered taste separately.
- Run the scene with no viewers and again with multiple viewers and a restart. Confirm the same intervals, one memory for continuous exposure, appropriate strengthening on a later visit, and a matching scent recalling the earlier experience with its original place and time.
- Verify the live gift-to-shelf-to-play sequence and check that thoughts, memory and journal agree with the recorded events. Expand coverage to the remaining island assets after the flower scene works end to end.

## References

- [Epic’s AI perception documentation](https://dev.epicgames.com/documentation/unreal-engine/ai-perception-in-unreal-engine?application_version=5.8) uses a sight radius, peripheral angle and separate loss radius. Use the pattern with Patch’s existing stack.
- [NOAA’s HYSPLIT overview](https://www.ready.noaa.gov/documents/Tutorial/html/intro.html) describes wind-driven transport, spreading and concentration. Use a lightweight approximation suitable for the island.
- [FHWA noise fundamentals](https://www.fhwa.dot.gov/environMent/noise/regulations_and_guidance/polguide/polguide02.cfm) and its [measurement handbook](https://www.fhwa.dot.gov/ENVIRonment/noise/measurement/handbook.cfm) cover distance loss and the effect of wind shear on downwind and upwind sound.
- [NIDCD’s taste overview](https://www.nidcd.nih.gov/health/taste-disorders) explains how taste, aroma, texture and temperature combine into flavor.
