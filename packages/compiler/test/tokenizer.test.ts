import assert from 'node:assert/strict';
import { test } from 'node:test';
import Tokenizer from '../src/tokenizer.ts';
import { Keyword, TokenType } from '../src/types.ts';

test('tracks token positions across comments and compound tokens', () => {
  const tokens = new Tokenizer().tokenize('/* ignored\n*/ function* task // ignored\n  amount += .5');

  assert.deepEqual(tokens.map(({ type, value, line, col }) => [type, value, line, col]), [
    [TokenType.KEYWORD, Keyword['function*'], 2, 4],
    [TokenType.IDENTIFIER, 'task', 2, 14],
    [TokenType.IDENTIFIER, 'amount', 3, 3],
    [TokenType.OPERATOR, '+=', 3, 10],
    [TokenType.NUMBER, 0.5, 3, 13],
    [TokenType.EOF, null, 3, 15]
  ]);
});

test('decodes escapes in a string and tracks the following operator', () => {
  const source = String.raw`"one\n\"two\\three" + .5`;
  const [text, operator] = new Tokenizer().tokenize(source);

  assert.equal(text.type, TokenType.STRING);
  assert.equal(text.value, 'one\n"two\\three');
  assert.equal(operator.value, '+');
  assert.equal(operator.col, source.indexOf('+') + 1);
});

test('reports unterminated strings and block comments with locations', () => {
  assert.throws(
    () => new Tokenizer().tokenize('var ready;\n  "bad\n'),
    /Unterminated string at line 2, col 7/
  );
  assert.throws(
    () => new Tokenizer().tokenize('/* comment\n  text'),
    /Unterminated block comment at line 2, col 7/
  );
});
