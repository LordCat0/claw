import {
  TokenType,
  Keyword,
  type Token
} from './types.ts';

const TWO_CHAR_COMPARISONS = ['==', '!=', '<=', '>='];
const TWO_CHAR_OPERATORS = ['+=', '-=', '*=', '/=', '%=', '++', '--', '&&', '||', '->'];
const SINGLE_CHAR_TOKENS: Record<string, TokenType> = {
  '(': TokenType.LPAREN,
  ')': TokenType.RPAREN,
  '{': TokenType.LBRACE,
  '}': TokenType.RBRACE,
  '[': TokenType.LBRACKET,
  ']': TokenType.RBRACKET,
  ';': TokenType.SEMICOLON,
  ',': TokenType.COMMA,
  '.': TokenType.DOT,
  '?': TokenType.QUESTION,
  ':': TokenType.COLON,
  '=': TokenType.EQUALS,
  '!': TokenType.NOT,
  '<': TokenType.COMPARISON,
  '>': TokenType.COMPARISON,
  '+': TokenType.OPERATOR,
  '-': TokenType.OPERATOR,
  '*': TokenType.OPERATOR,
  '/': TokenType.OPERATOR,
  '%': TokenType.OPERATOR,
  '|': TokenType.OPERATOR
};

class Tokenizer {
  tokens: Token[];
  pos: number;
  line: number;
  col: number;
  source: string;

  constructor () {
    this.tokens = [];
    this.pos = 0;
    this.line = 1;
    this.col = 1;
    this.source = '';
  }

  tokenize (script: string) {
    this.tokens = [];
    this.pos = 0;
    this.line = 1;
    this.col = 1;
    this.source = script;

    while (this.pos < this.source.length) {
      const character = this.source[this.pos];
      const next = this.source[this.pos + 1];

      if (/\s/.test(character)) {
        this.advancePosition(character);
        continue;
      }

      if (character === '/' && next === '/') {
        this.skipLineComment();
        continue;
      }

      if (character === '/' && next === '*') {
        this.skipBlockComment();
        continue;
      }

      if (/[0-9]/.test(character) || (character === '.' && /[0-9]/.test(next))) {
        this.readNumber();
        continue;
      }

      if (character === '"' || character === "'") {
        this.readString(character);
        continue;
      }

      if (/[a-zA-Z_]/.test(character)) {
        this.readIdentifier();
        continue;
      }

      const operator = character + next;
      const isComparison = TWO_CHAR_COMPARISONS.includes(operator);
      if (isComparison || TWO_CHAR_OPERATORS.includes(operator)) {
        this.push(isComparison ? TokenType.COMPARISON : TokenType.OPERATOR, operator);
        this.pos += 2;
        this.col += 2;
        continue;
      }

      const type = SINGLE_CHAR_TOKENS[character];
      if (!type) {
        throw new Error(`Unexpected character '${character}' at line ${this.line}, col ${this.col}`);
      }

      this.push(type, character);
      this.pos++;
      this.col++;
    }

    this.push(TokenType.EOF, null);
    return this.tokens;
  }

  private advancePosition (character: string) {
    this.pos++;
    if (character === '\n') {
      this.line++;
      this.col = 1;
    } else {
      this.col++;
    }
  }

  push (type: TokenType, value: Token['value']) {
    this.tokens.push({
      type,
      value,
      line: this.line,
      col: this.col
    });
  }

  readNumber () {
    const start = this.pos;
    let hasDecimalPoint = false;
    while (this.pos < this.source.length) {
      const character = this.source[this.pos];
      if (character === '.' && !hasDecimalPoint) {
        hasDecimalPoint = true;
        this.pos++;
      } else if (/[0-9]/.test(character)) {
        this.pos++;
      } else {
        break;
      }
    }
    const value = this.source.slice(start, this.pos);
    this.push(TokenType.NUMBER, Number(value));
    this.col += value.length;
  }

  readString (quote: string) {
    const { line, col } = this;
    this.pos++; // skip opening quote
    this.col++;
    let value = '';
    while (this.pos < this.source.length) {
      const character = this.source[this.pos];
      if (character === '\\') {
        this.pos++;
        const escaped = this.source[this.pos];
        switch (escaped) {
          case 'n':
            value += '\n';
            break;
          case 't':
            value += '\t';
            break;
          default:
            value += escaped;
        }
        this.pos++;
        this.col += 2;
        continue;
      }
      if (character === quote) {
        this.pos++; // skip closing quote
        this.col++;
        this.push(TokenType.STRING, value);
        Object.assign(this.tokens.at(-1), {
          line,
          col
        });
        return;
      }
      if (character === '\n') {
        throw new Error(`Unterminated string at line ${this.line}, col ${this.col}`);
      }
      value += character;
      this.pos++;
      this.col++;
    }
    throw new Error(`Unterminated string at line ${this.line}, col ${this.col}`);
  }

  readIdentifier () {
    const start = this.pos;
    while (this.pos < this.source.length && /[a-zA-Z0-9_]/.test(this.source[this.pos])) {
      this.pos++;
    }
    if (this.source.slice(start, this.pos) === 'function' && this.source[this.pos] === '*') {
      this.pos++;
    }
    const value = this.source.slice(start, this.pos);
    const isKeyword = value !== Keyword.type && Object.hasOwn(Keyword, value);

    this.push(isKeyword ? TokenType.KEYWORD : TokenType.IDENTIFIER, value);
    this.col += value.length;
  }

  skipLineComment () {
    while (this.pos < this.source.length && this.source[this.pos] !== '\n') {
      this.pos++;
    }
  }

  skipBlockComment () {
    this.pos += 2; // skip /*
    this.col += 2;
    while (this.pos < this.source.length) {
      if (this.source[this.pos] === '*' && this.source[this.pos + 1] === '/') {
        this.pos += 2;
        this.col += 2;
        return;
      }
      this.advancePosition(this.source[this.pos]);
    }
    throw new Error(`Unterminated block comment at line ${this.line}, col ${this.col}`);
  }
}

export default Tokenizer;
