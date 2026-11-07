import {
  TokenType,
  Keyword,
  type Token
} from './types.ts';

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
      const ch = this.source[this.pos];

      // Skip whitespace
      if (/\s/.test(ch)) {
        if (ch === '\n') {
          this.line++;
          this.col = 1;
        } else {
          this.col++;
        }
        this.pos++;
        continue;
      }

      // Skip line comments
      if (ch === '/' && this.source[this.pos + 1] === '/') {
        this.skipLineComment();
        continue;
      }

      // Skip block comments
      if (ch === '/' && this.source[this.pos + 1] === '*') {
        this.skipBlockComment();
        continue;
      }

      // Numbers
      if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(this.source[this.pos + 1]))) {
        this.readNumber();
        continue;
      }

      // Strings
      if (ch === '"' || ch === "'") {
        this.readString(ch);
        continue;
      }

      // Identifiers and keywords
      if (/[a-zA-Z_]/.test(ch)) {
        this.readIdentifier();
        continue;
      }

      // Two character operators and comparisons
      const next = this.source[this.pos + 1];
      if ((ch === '=' || ch === '!' || ch === '<' || ch === '>') && next === '=') {
        this.push(TokenType.COMPARISON, ch + next);
        this.pos += 2;
        this.col += 2;
        continue;
      }

      if (ch === '+' && next === '+') {
        this.push(TokenType.OPERATOR, '++');
        this.pos += 2;
        this.col += 2;
        continue;
      }

      if (ch === '-' && next === '-') {
        this.push(TokenType.OPERATOR, '--');
        this.pos += 2;
        this.col += 2;
        continue;
      }

      if (ch === '&' && next === '&') {
        this.push(TokenType.OPERATOR, '&&');
        this.pos += 2;
        this.col += 2;
        continue;
      }

      if (ch === '|' && next === '|') {
        this.push(TokenType.OPERATOR, '||');
        this.pos += 2;
        this.col += 2;
        continue;
      }

      // Single character tokens
      switch (ch) {
        case '(': this.push(TokenType.LPAREN, ch); break;
        case ')': this.push(TokenType.RPAREN, ch); break;
        case '{': this.push(TokenType.LBRACE, ch); break;
        case '}': this.push(TokenType.RBRACE, ch); break;
        case '[': this.push(TokenType.LBRACKET, ch); break;
        case ']': this.push(TokenType.RBRACKET, ch); break;
        case ';': this.push(TokenType.SEMICOLON, ch); break;
        case ',': this.push(TokenType.COMMA, ch); break;
        case '.': this.push(TokenType.DOT, ch); break;
        case '=': this.push(TokenType.EQUALS, ch); break;
        case '!': this.push(TokenType.NOT, ch); break;
        case '<': case '>':
          this.push(TokenType.COMPARISON, ch); break;
        case '+': case '-': case '*': case '/': case '%':
          this.push(TokenType.OPERATOR, ch); break;
        default:
          throw new Error(`Unexpected character '${ch}' at line ${this.line}, col ${this.col}`);
      }
      this.pos++;
      this.col++;
    }

    this.push(TokenType.EOF, null);
    return this.tokens;
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
    let hasDot = false;
    while (this.pos < this.source.length) {
      const ch = this.source[this.pos];
      if (ch === '.' && !hasDot) {
        hasDot = true;
        this.pos++;
      } else if (/[0-9]/.test(ch)) {
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
    this.pos++; // skip opening quote
    this.col++;
    let value = '';
    while (this.pos < this.source.length) {
      const ch = this.source[this.pos];
      if (ch === '\\') {
        this.pos++;
        const esc = this.source[this.pos];
        switch (esc) {
          case 'n': value += '\n'; break;
          case 't': value += '\t'; break;
          case '\\': value += '\\'; break;
          case "'": value += "'"; break;
          case '"': value += '"'; break;
          default: value += esc;
        }
        this.pos++;
        this.col += 2;
        continue;
      }
      if (ch === quote) {
        this.pos++; // skip closing quote
        this.col++;
        this.push(TokenType.STRING, value);
        return;
      }
      if (ch === '\n') {
        throw new Error(`Unterminated string at line ${this.line}, col ${this.col}`);
      }
      value += ch;
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
    const type = Object.hasOwn(Keyword, value) ?
      TokenType.KEYWORD : TokenType.IDENTIFIER;

    this.push(type, value);
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
      if (this.source[this.pos] === '\n') {
        this.line++;
        this.col = 1;
      } else {
        this.col++;
      }
      this.pos++;
    }
    throw new Error(`Unterminated block comment at line ${this.line}, col ${this.col}`);
  }
}

export default Tokenizer;
