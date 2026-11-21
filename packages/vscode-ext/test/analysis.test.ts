import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Analysis } from '../src/analysis.ts';

test('recovers from invalid syntax and reports errors in later statements', () => {
  const source = 'var before = 1;\nvar broken = ;\nvar after = missing;';
  const analysis = new Analysis(source);
  const semicolon = source.indexOf(';', source.indexOf('broken'));
  const missing = source.indexOf('missing');

  assert.deepEqual(analysis.syntax.errors, [{
    message: "Unexpected token SEMICOLON ';'",
    start: semicolon,
    end: semicolon + 1
  }]);
  assert.deepEqual(analysis.errors, [{
    message: 'Unknown name "missing".',
    start: missing,
    end: missing + 'missing'.length
  }]);
});

test('resolves a shadowed name to the declaration visible at each use', () => {
  const source = 'var value = 1;\nfunction pick(value) {\n  return value;\n}\nsprite.say(value);';
  const analysis = new Analysis(source);
  assert.deepEqual(analysis.syntax.errors, []);
  assert.deepEqual(analysis.errors, []);

  const inside = source.indexOf('value', source.indexOf('return'));
  const outside = source.lastIndexOf('value');
  const tokens = analysis.syntax.tokens;
  const parameter = analysis.resolve(
    tokens.findIndex(token => token.start === inside),
    analysis.symbolsAt(inside)
  );
  const variable = analysis.resolve(
    tokens.findIndex(token => token.start === outside),
    analysis.symbolsAt(outside)
  );

  assert.equal(parameter?.kind, 'parameter');
  assert.equal(parameter.declaration?.start, source.indexOf('value', source.indexOf('pick')));
  assert.equal(variable?.kind, 'variable');
  assert.equal(variable.declaration?.start, source.indexOf('value'));
});

test('marks only the statements after a return in the same function', () => {
  const source = 'function pick() {\n  return 1;\n  sprite.say(2);\n  sprite.say(3);\n}\nsprite.say(4);';
  const analysis = new Analysis(source);
  const firstUnreachable = 'sprite.say(2);';
  const lastUnreachable = 'sprite.say(3);';

  assert.deepEqual(analysis.unreachable, [{
    start: source.indexOf(firstUnreachable),
    end: source.indexOf(lastUnreachable) + lastUnreachable.length
  }]);
});
