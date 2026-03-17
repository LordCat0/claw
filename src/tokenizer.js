// todo: move these to a separate enum file

const TOKEN_TYPES = {
    NUMBER:     'NUMBER',
    STRING:     'STRING',
    IDENTIFIER: 'IDENTIFIER',
    KEYWORD:    'KEYWORD',
    LPAREN:     'LPAREN',
    RPAREN:     'RPAREN',
    LBRACE:     'LBRACE',
    RBRACE:     'RBRACE',
    LBRACKET:   'LBRACKET',
    RBRACKET:   'RBRACKET',
    SEMICOLON:  'SEMICOLON',
    COMMA:      'COMMA',
    OPERATOR:   'OPERATOR',
    EQUALS:     'EQUALS',
    COMPARISON: 'COMPARISON',
    NOT:        'NOT',
    EOF:        'EOF'
};

const KEYWORDS = [
    'if', 'else', 'while', 'for', 'repeat',
    'function', 'return', 'var', 'true', 'false',
    'import', 'export'
];

class Tokenizer {
    constructor () {
        this.tokens = [];
        this.pos = 0;
        this.line = 1;
        this.col = 1;
        this.source = '';
    }

    tokenize (script) {
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
                this.push(TOKEN_TYPES.COMPARISON, ch + next);
                this.pos += 2;
                this.col += 2;
                continue;
            }

            if (ch === '+' && next === '+') {
                this.push(TOKEN_TYPES.OPERATOR, '++');
                this.pos += 2;
                this.col += 2;
                continue;
            }

            if (ch === '-' && next === '-') {
                this.push(TOKEN_TYPES.OPERATOR, '--');
                this.pos += 2;
                this.col += 2;
                continue;
            }

            if (ch === '&' && next === '&') {
                this.push(TOKEN_TYPES.OPERATOR, '&&');
                this.pos += 2;
                this.col += 2;
                continue;
            }

            if (ch === '|' && next === '|') {
                this.push(TOKEN_TYPES.OPERATOR, '||');
                this.pos += 2;
                this.col += 2;
                continue;
            }

            // Single character tokens
            switch (ch) {
                case '(': this.push(TOKEN_TYPES.LPAREN, ch); break;
                case ')': this.push(TOKEN_TYPES.RPAREN, ch); break;
                case '{': this.push(TOKEN_TYPES.LBRACE, ch); break;
                case '}': this.push(TOKEN_TYPES.RBRACE, ch); break;
                case '[': this.push(TOKEN_TYPES.LBRACKET, ch); break;
                case ']': this.push(TOKEN_TYPES.RBRACKET, ch); break;
                case ';': this.push(TOKEN_TYPES.SEMICOLON, ch); break;
                case ',': this.push(TOKEN_TYPES.COMMA, ch); break;
                case '=': this.push(TOKEN_TYPES.EQUALS, ch); break;
                case '!': this.push(TOKEN_TYPES.NOT, ch); break;
                case '<': case '>':
                    this.push(TOKEN_TYPES.COMPARISON, ch); break;
                case '+': case '-': case '*': case '/': case '%':
                    this.push(TOKEN_TYPES.OPERATOR, ch); break;
                default:
                    throw new Error(`Unexpected character '${ch}' at line ${this.line}, col ${this.col}`);
            }
            this.pos++;
            this.col++;
        }

        this.push(TOKEN_TYPES.EOF, null);
        return this.tokens;
    }

    push (type, value) {
        this.tokens.push({ type, value, line: this.line, col: this.col });
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
        this.push(TOKEN_TYPES.NUMBER, Number(value));
        this.col += value.length;
    }

    readString (quote) {
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
                this.push(TOKEN_TYPES.STRING, value);
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
        const value = this.source.slice(start, this.pos);
        const type = KEYWORDS.includes(value) ? TOKEN_TYPES.KEYWORD : TOKEN_TYPES.IDENTIFIER;
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

module.exports = Tokenizer;