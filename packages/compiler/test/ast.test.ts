import assert from 'node:assert/strict';
import { test } from 'node:test';
import ASTBuilder from '../src/ast.ts';
import Tokenizer from '../src/tokenizer.ts';
import { NodeType } from '../src/types.ts';

function parse (source: string) {
  return new ASTBuilder().build(new Tokenizer().tokenize(source));
}

test('reports the unexpected token at its source location', () => {
  assert.throws(
    () => parse('var ready = true;\nvar value = ;'),
    /Unexpected token SEMICOLON ';' at line 2, col 13/
  );
});

test('parses catch handlers with and without an error binding', () => {
  const [withBinding, withoutBinding] = parse([
    "try { throw 'oops'; } catch (error) { throw error; }",
    "try { throw 'oops'; } catch {}"
  ].join('\n')).body;

  assert.equal(withBinding.type, NodeType.TryStatement);
  assert.equal(withBinding.parameter, 'error');
  assert.deepEqual(withBinding.body.body, [{
    type: NodeType.ThrowStatement,
    value: {
      type: NodeType.StringLiteral,
      value: 'oops'
    }
  }]);
  assert.deepEqual(withBinding.handler.body, [{
    type: NodeType.ThrowStatement,
    value: {
      type: NodeType.Identifier,
      name: 'error'
    }
  }]);
  assert.equal(withoutBinding.type, NodeType.TryStatement);
  assert.equal(withoutBinding.parameter, null);
});

test('rejects a line break between throw and its value', () => {
  assert.throws(
    () => parse("try {\n  throw\n  'oops';\n} catch {}"),
    /Unexpected line break after 'throw' at line 2, col 3/
  );
});
