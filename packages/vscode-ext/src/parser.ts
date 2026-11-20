import ASTBuilder from '../../compiler/src/ast.ts';
import Tokenizer from '../../compiler/src/tokenizer.ts';
import {
  Keyword,
  NodeType,
  TokenType,
  type Block,
  type Expression,
  type Statement,
  type Token
} from '../../compiler/src/types.ts';

export interface Range {
  start: number;
  end: number;
}

export interface SourceToken extends Token, Range {}

export interface Problem extends Range {
  message: string;
}

class SourceTokenizer extends Tokenizer {
  ignored: Range[] = [];

  readString (quote: string) {
    const { pos, line, col } = this;
    try {
      super.readString(quote);
      const lines = this.source.slice(pos, this.pos).split('\n');
      if (lines.length > 1) {
        this.line += lines.length - 1;
        this.col = lines.at(-1).length + 1;
      }
      Object.assign(this.tokens.at(-1), {
        line,
        col,
        length: this.pos - pos
      });
    } finally {
      this.ignored.push({
        start: pos,
        end: this.pos
      });
    }
  }

  readNumber () {
    const start = this.pos;
    super.readNumber();
    Object.assign(this.tokens.at(-1), { length: this.pos - start });
  }

  skipLineComment () {
    const start = this.pos;
    super.skipLineComment();
    this.ignored.push({
      start,
      end: this.pos
    });
  }

  skipBlockComment () {
    const start = this.pos;
    try {
      super.skipBlockComment();
    } finally {
      this.ignored.push({
        start,
        end: this.pos
      });
    }
  }
}

class EditorParser extends ASTBuilder {
  declare tokens: SourceToken[];
  errors: Problem[] = [];
  spans = new WeakMap<Statement, { first: number; end: number; open?: boolean }>();
  expressions = new WeakMap<Expression, Range>();
  parameters = new WeakMap<Block, SourceToken[]>();

  current () {
    return this.tokens[this.pos];
  }

  parseBlock (): Block {
    const first = this.pos;
    this.expect(TokenType.LBRACE);

    const block: Block = {
      type: NodeType.Block,
      body: []
    };
    while (!this.isAtEnd() && this.current().type !== TokenType.RBRACE) {
      block.body.push(this.parseStatement());
    }

    const end = this.current().end;
    const open = this.isAtEnd();
    if (open) {
      this.addError('Expected RBRACE before the end of the file', this.current());
    } else {
      this.advance();
    }
    this.spans.set(block, {
      first,
      end,
      open
    });
    return block;
  }

  parseFunctionExpression (warp: boolean) {
    const first = this.pos + 1;
    const expression = super.parseFunctionExpression(warp);
    this.parameters.set(expression.body, expression.params.map((_, index) => {
      return this.tokens[first + index * 2];
    }));
    return expression;
  }

  parseIf () {
    const first = this.pos;
    const statement = super.parseIf();
    this.recordSpan(statement, first);
    return statement;
  }

  parsePrimary () {
    const first = this.current();
    const expression = super.parsePrimary();
    this.recordExpression(expression, first);
    return expression;
  }

  parseCallExpression () {
    const first = this.current();
    const expression = super.parseCallExpression();
    this.recordExpression(expression, first);
    return expression;
  }

  parseExpression () {
    const first = this.current();
    const expression = super.parseExpression();
    this.recordExpression(expression, first);
    return expression;
  }

  parseMemberExpression (object: Expression) {
    const member = super.parseMemberExpression(object);
    this.expressions.set(member, this.tokens[this.pos - 1]);
    return member;
  }

  recordExpression (expression: Expression, first: SourceToken) {
    if (!this.expressions.has(expression)) {
      this.expressions.set(expression, {
        start: first.start,
        end: this.tokens[this.pos - 1].end
      });
    }
  }

  parseStatement (): Statement {
    const first = this.pos;
    if (this.isAtEnd()) {
      return super.parseStatement();
    }

    let statement: Statement;
    try {
      statement = super.parseStatement();
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error;
      }
      const location = / at line (\d+), col (\d+)$/.exec(error.message);
      if (!location) {
        throw error;
      }

      const previous = this.tokens[this.pos - 1];
      const token = previous?.line === Number(location[1]) && previous.col === Number(location[2])
        ? previous
        : this.current();
      this.addError(error.message.slice(0, location.index), token);

      // Keep parsing at the next statement or enclosing block boundary.
      this.pos = Math.max(this.pos, first + 1);
      while (!this.isAtEnd()) {
        const next = this.current();
        if (next.type === TokenType.SEMICOLON) {
          this.advance();
          break;
        }
        if (next.type === TokenType.RBRACE || next.value === Keyword.case ||
            next.value === Keyword.default || next.line > this.tokens[first].line) {
          break;
        }
        this.advance();
      }

      statement = {
        type: NodeType.Block,
        body: []
      };
    }

    if (!this.spans.has(statement)) {
      this.recordSpan(statement, first);
    }
    return statement;
  }

  recordSpan (statement: Statement, first: number) {
    this.spans.set(statement, {
      first,
      end: this.tokens[this.pos - 1].end
    });
  }

  addError (message: string, { start, end }: Range) {
    const previous = this.errors.at(-1);
    if (previous?.start !== start) {
      this.errors.push({
        message,
        start,
        end
      });
    }
  }
}

export function parse (source: string) {
  const tokenizer = new SourceTokenizer();
  const parser = new EditorParser();
  const lineStarts = [0];
  for (const newline of source.matchAll(/\n/g)) {
    lineStarts.push(newline.index + 1);
  }

  let lexicalError: Problem | undefined;
  try {
    tokenizer.tokenize(source);
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error;
    }
    const message = error.message.replace(/ at line \d+, col \d+$/, '');
    const pos = Math.min(tokenizer.pos, source.length);
    const ignored = tokenizer.ignored.at(-1);
    lexicalError = {
      message,
      start: message.startsWith('Unterminated') ? ignored.start : pos,
      end: Math.min(source.length, pos + 1)
    };
    tokenizer.push(TokenType.EOF, null);
  }

  const tokens: SourceToken[] = tokenizer.tokens.map((token: Token & { length?: number }) => {
    const start = lineStarts[token.line - 1] + token.col - 1;
    const length = token.value === null ? 0 : (token.length || String(token.value).length);
    return {
      ...token,
      start,
      end: start + length
    };
  });
  const program = parser.build(tokens);
  const errors = parser.errors.filter(error => !lexicalError || error.start < lexicalError.start);
  if (lexicalError) {
    errors.push(lexicalError);
  }

  return {
    program,
    errors,
    tokens,
    ignored: tokenizer.ignored,
    spans: parser.spans,
    expressions: parser.expressions,
    parameters: parser.parameters
  };
}
