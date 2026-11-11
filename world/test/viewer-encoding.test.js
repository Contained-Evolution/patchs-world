import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('camera and facial animation sources are valid UTF-8',()=>{
  const decoder=new TextDecoder('utf-8',{fatal:true});
  for(const name of ['visitor-controls.js','patch-eyes.js','patch-mouth.js']) {
    const source=decoder.decode(readFileSync(new URL('../src/'+name,import.meta.url)));
    assert.ok(!source.includes('\ufffd'),name);
  }
});
