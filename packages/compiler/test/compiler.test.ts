import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import Compiler from '../src/compiler.ts';
import type { ScratchInput } from '../src/types.ts';

function inputBlockId (input: ScratchInput) {
  assert.ok(Array.isArray(input));
  const [kind, id] = input;
  assert.equal(kind, 2);
  assert.ok(typeof id === 'string');
  return id;
}

test('emits a Scratch archive', async () => {
  const compiler = new Compiler();
  await compiler.compile(fileURLToPath(new URL('./fixtures/project.claw', import.meta.url)));

  const archive = await JSZip.loadAsync(await compiler.generateZip('nodebuffer'));
  const projectFile = archive.file('project.json');
  assert.ok(projectFile);
  const project: ReturnType<Compiler['toJSON']> = JSON.parse(await projectFile.async('string'));
  for (const target of project.targets) {
    for (const costume of target.costumes) {
      assert.ok(archive.file(costume.md5ext), `Missing costume ${costume.md5ext}`);
    }
  }

  const sprite = project.targets.find(target => !target.isStage);
  assert.ok(sprite);
  const { blocks } = sprite;
  const repeat = Object.entries(blocks).find(([, block]) => block.opcode === 'control_repeat');
  assert.ok(repeat);
  const [loopId, loop] = repeat;
  assert.ok(loop.parent, 'Expected a parent for the repeat block');
  assert.equal(blocks[loop.parent].next, loopId);
  assert.deepEqual(loop.inputs.TIMES, [1, [5, '2']]);

  const sayId = inputBlockId(loop.inputs.SUBSTACK);
  const say = blocks[sayId];
  assert.equal(say.opcode, 'looks_say');
  assert.equal(say.parent, loopId);
  const subtractionId = inputBlockId(say.inputs.MESSAGE);
  const subtraction = blocks[subtractionId];
  assert.equal(subtraction.opcode, 'operator_subtract');
  assert.equal(subtraction.parent, sayId);
  assert.deepEqual(subtraction.inputs.NUM1, [1, [5, '10']]);
  const multiplication = blocks[inputBlockId(subtraction.inputs.NUM2)];
  assert.equal(multiplication.opcode, 'operator_multiply');
  assert.equal(multiplication.parent, subtractionId);

  assert.ok(say.next, 'Expected a command after say inside the loop');
  const think = blocks[say.next];
  assert.equal(think.opcode, 'looks_think');
  assert.equal(think.parent, sayId);
  assert.equal(think.next, null);
  const item = blocks[inputBlockId(think.inputs.MESSAGE)];
  assert.equal(item.opcode, 'data_itemoflist');
  assert.equal(item.parent, say.next);
  assert.deepEqual(item.inputs.INDEX, [1, [4, 1]]);
  const [listName, listId] = item.fields.LIST;
  assert.ok(typeof listId === 'string');
  assert.equal(sprite.lists[listId][0], listName);

  assert.ok(loop.next, 'Expected a command after the repeat block');
  const done = blocks[loop.next];
  assert.equal(done.opcode, 'looks_say');
  assert.equal(done.parent, loopId);
  assert.deepEqual(done.inputs.MESSAGE, [1, [10, 'done']]);
});

test('initializes a shared import once before its consumers', async () => {
  const compiler = new Compiler();
  const source = fileURLToPath(new URL('./fixtures/imports/entry.claw', import.meta.url));
  await compiler.compile(source);

  const { blocks } = compiler.root;
  const initializers = Object.entries(blocks).filter(([, block]) =>
    block.opcode === 'looks_say' && block.inputs.MESSAGE[0] === 1
  );
  assert.equal(initializers.length, 1);
  const [dependencyId, dependency] = initializers[0];
  assert.deepEqual(dependency.inputs.MESSAGE, [1, [10, 'dependency']]);
  assert.ok(dependency.parent, 'Expected a shared variable initializer');
  const initialization = blocks[dependency.parent];
  assert.equal(initialization.opcode, 'data_setvariableto');
  assert.deepEqual(initialization.inputs.VALUE, [1, [10, 'shared value']]);

  assert.ok(dependency.next, 'Expected the wrapper module after the dependency');
  const wrapper = blocks[dependency.next];
  assert.equal(wrapper.opcode, 'looks_think');
  assert.equal(wrapper.parent, dependencyId);
  assert.ok(wrapper.next, 'Expected the entry module after the wrapper');
  const entry = blocks[wrapper.next];
  assert.equal(entry.opcode, 'looks_say');
  assert.equal(entry.parent, dependency.next);
  const shared = [12, ...initialization.fields.VARIABLE];
  assert.deepEqual(wrapper.inputs.MESSAGE[1], shared);
  assert.deepEqual(entry.inputs.MESSAGE[1], shared);
});

test('rejects a circular file import', async () => {
  const compiler = new Compiler();
  const source = fileURLToPath(new URL('./fixtures/circular.claw', import.meta.url));
  await assert.rejects(compiler.compile(source), /Circular import involving .*circular\.claw/);
});
