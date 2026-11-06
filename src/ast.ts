import {
  TokenType,
  Keyword,
  NodeType,
  type Token,
  type Statement,
  type Expression,
  type Program,
  type Block,
  type VarDeclaration,
  type IfStatement,
  type WhileStatement,
  type RepeatStatement,
  type ForStatement,
  type FunctionDeclaration,
  type ReturnStatement,
  type ImportStatement,
  type ExportStatement
} from './types.ts';

class ASTBuilder {
  tokens: Token[];
  pos: number;

  constructor () {
    this.tokens = [];
    this.pos = 0;
  }

  build (tokens: Token[]): Program {
    this.tokens = tokens;
    this.pos = 0;

    const body: Statement[] = [];
    while (!this.isAtEnd()) {
      body.push(this.parseStatement());
    }
    return { type: NodeType.Program, body };
  }

  // Helper functions

  current () {
    return this.tokens[this.pos];
  }

  peek () {
    return this.tokens[this.pos];
  }

  advance () {
    const token = this.tokens[this.pos];
    this.pos++;
    return token;
  }

  isAtEnd () {
    return this.current().type === TokenType.EOF;
  }

  expect (type: TokenType, value?: Token['value']) {
    const token = this.current();
    if (token.type !== type || (value !== undefined && token.value !== value)) {
      throw new Error(
        `Expected ${type}${value !== undefined ? ` '${value}'` : ''} ` +
        `but got ${token.type} '${token.value}' at line ${token.line}, col ${token.col}`
      );
    }
    return this.advance();
  }

  // Statements

  parseStatement (): Statement {
    const token = this.current();

    if (token.type === TokenType.KEYWORD) {
      switch (token.value) {
        case Keyword.var: return this.parseVarDeclaration();
        case Keyword.if: return this.parseIf();
        case Keyword.while: return this.parseWhile();
        case Keyword.repeat: return this.parseRepeat();
        case Keyword.for: return this.parseFor();
        case Keyword.function: return this.parseFunctionDeclaration(false);
        case Keyword['function*']: return this.parseFunctionDeclaration(true);
        case Keyword.return: return this.parseReturn();
        case Keyword.import: return this.parseImport();
        case Keyword.export: return this.parseExport();
      }
    }

    // Expression statement (function calls, assignments)
    const expr = this.parseExpression();

    // Assignment: identifier = expression
    if (this.current().type === TokenType.EQUALS) {
      this.advance();
      const value = this.parseExpression();
      this.expect(TokenType.SEMICOLON);
      return { type: NodeType.Assignment, target: expr, value };
    }

    this.expect(TokenType.SEMICOLON);
    return { type: NodeType.ExpressionStatement, expression: expr };
  }

  parseVarDeclaration (): VarDeclaration {
    this.advance(); // skip Keyword.var
    const name = (this.expect(TokenType.IDENTIFIER).value as string);
    let init = null;
    if (this.current().type === TokenType.EQUALS) {
      this.advance();
      init = this.parseExpression();
    }
    this.expect(TokenType.SEMICOLON);
    return { type: NodeType.VarDeclaration, name, init };
  }

  parseIf (): IfStatement {
    this.advance(); // skip Keyword.if
    this.expect(TokenType.LPAREN);
    const test = this.parseExpression();
    this.expect(TokenType.RPAREN);
    const consequent = this.parseBlock();
    let alternate = null;
    if (this.current().type === TokenType.KEYWORD && this.current().value === Keyword.else) {
      this.advance();
      if (this.current().type === TokenType.KEYWORD && this.current().value === Keyword.if) {
        alternate = this.parseIf();
      } else {
        alternate = this.parseBlock();
      }
    }
    return { type: NodeType.IfStatement, test, consequent, alternate };
  }

  parseWhile (): WhileStatement {
    this.advance(); // skip Keyword.while
    this.expect(TokenType.LPAREN);
    const test = this.parseExpression();
    this.expect(TokenType.RPAREN);
    const body = this.parseBlock();
    return { type: NodeType.WhileStatement, test, body };
  }

  parseRepeat (): RepeatStatement {
    this.advance(); // skip Keyword.repeat
    this.expect(TokenType.LPAREN);
    const count = this.parseExpression();
    this.expect(TokenType.RPAREN);
    const body = this.parseBlock();
    return { type: NodeType.RepeatStatement, count, body };
  }

  parseFor (): ForStatement {
    this.advance(); // skip Keyword.for
    this.expect(TokenType.LPAREN);
    const init = this.parseStatement();
    const test = this.parseExpression();
    this.expect(TokenType.SEMICOLON);
    const update = this.parseExpression();
    this.expect(TokenType.RPAREN);
    const body = this.parseBlock();
    return { type: NodeType.ForStatement, init, test, update, body };
  }

  parseFunctionDeclaration (warp: boolean): FunctionDeclaration {
    this.advance(); // skip Keyword.function
    const name = (this.expect(TokenType.IDENTIFIER).value as string);
    this.expect(TokenType.LPAREN);
    const params = [];
    if (this.current().type !== TokenType.RPAREN) {
      params.push((this.expect(TokenType.IDENTIFIER).value as string));
      while (this.current().type === TokenType.COMMA) {
        this.advance();
        params.push((this.expect(TokenType.IDENTIFIER).value as string));
      }
    }
    this.expect(TokenType.RPAREN);
    const body = this.parseBlock();
    return { type: NodeType.FunctionDeclaration, name, params, warp, body };
  }

  parseReturn (): ReturnStatement {
    this.advance(); // skip Keyword.return
    let value = null;
    if (this.current().type !== TokenType.SEMICOLON) {
      value = this.parseExpression();
    }
    this.expect(TokenType.SEMICOLON);
    return { type: NodeType.ReturnStatement, value };
  }

  parseImport (): ImportStatement {
    this.advance(); // skip Keyword.import
    let names = [];
    if (this.current().type === TokenType.LBRACE) {
      this.advance(); // skip '{'
      if (this.current().type !== TokenType.RBRACE) {
        names.push((this.expect(TokenType.IDENTIFIER).value as string));
        while (this.current().type === TokenType.COMMA) {
          this.advance();
          names.push((this.expect(TokenType.IDENTIFIER).value as string));
        }
      }
      this.expect(TokenType.RBRACE);
    } else {
      names.push((this.expect(TokenType.IDENTIFIER).value as string));
    }
    const fromToken = this.expect(TokenType.IDENTIFIER);
    if (fromToken.value !== 'from') {
      throw new Error(
        `Expected 'from' but got '${fromToken.value}' at line ${fromToken.line}, col ${fromToken.col}`
      );
    }
    const source = (this.expect(TokenType.STRING).value as string);
    this.expect(TokenType.SEMICOLON);
    return { type: NodeType.ImportStatement, names, source };
  }

  parseExport (): ExportStatement {
    this.advance(); // skip Keyword.export
    let names = [];
    if (this.current().type === TokenType.LBRACE) {
      this.advance(); // skip '{'
      names.push((this.expect(TokenType.IDENTIFIER).value as string));
      while (this.current().type === TokenType.COMMA) {
        this.advance();
        names.push((this.expect(TokenType.IDENTIFIER).value as string));
      }
      this.expect(TokenType.RBRACE);
      this.expect(TokenType.SEMICOLON);
    } else {
      names.push((this.expect(TokenType.IDENTIFIER).value as string));
      this.expect(TokenType.SEMICOLON);
    }
    return { type: NodeType.ExportStatement, names };
  }

  parseBlock (): Block {
    this.expect(TokenType.LBRACE);
    const body: Statement[] = [];
    while (this.current().type !== TokenType.RBRACE) {
      body.push(this.parseStatement());
    }
    this.expect(TokenType.RBRACE);
    return { type: NodeType.Block, body };
  }

  // Expressions

  parseExpression (): Expression {
    return this.parseOr();
  }

  parseOr (): Expression {
    let left = this.parseAnd();
    while (this.current().type === TokenType.OPERATOR && this.current().value === '||') {
      const op = this.advance().value;
      const right = this.parseAnd();
      left = { type: NodeType.BinaryExpression, operator: op as string, left, right };
    }
    return left;
  }

  parseAnd (): Expression {
    let left = this.parseComparison();
    while (this.current().type === TokenType.OPERATOR && this.current().value === '&&') {
      const op = this.advance().value;
      const right = this.parseComparison();
      left = { type: NodeType.BinaryExpression, operator: op as string, left, right };
    }
    return left;
  }

  parseComparison (): Expression {
    let left = this.parseAddition();
    while (this.current().type === TokenType.COMPARISON) {
      const op = this.advance().value;
      const right = this.parseAddition();
      left = { type: NodeType.BinaryExpression, operator: op as string, left, right };
    }
    return left;
  }

  parseAddition (): Expression {
    let left = this.parseMultiplication();
    while (this.current().type === TokenType.OPERATOR && (this.current().value === '+' || this.current().value === '-')) {
      const op = this.advance().value;
      const right = this.parseMultiplication();
      left = { type: NodeType.BinaryExpression, operator: op as string, left, right };
    }
    return left;
  }

  parseMultiplication (): Expression {
    let left = this.parseUnary();
    while (this.current().type === TokenType.OPERATOR && (this.current().value === '*' || this.current().value === '/' || this.current().value === '%')) {
      const op = this.advance().value;
      const right = this.parseUnary();
      left = { type: NodeType.BinaryExpression, operator: op as string, left, right };
    }
    return left;
  }

  parseUnary (): Expression {
    if (this.current().type === TokenType.NOT) {
      this.advance();
      const value = this.parseUnary();
      return { type: NodeType.UnaryExpression, operator: '!', value };
    }
    if (this.current().type === TokenType.OPERATOR && this.current().value === '-') {
      this.advance();
      const value = this.parseUnary();
      return { type: NodeType.UnaryExpression, operator: '-', value };
    }
    return this.parseCallExpression();
  }

  parseCallExpression (): Expression {
    let expr = this.parsePrimary();

    // Handle function calls: name(args)
    while (this.current().type === TokenType.LPAREN) {
      this.advance();
      const args: Expression[] = [];
      if (this.current().type !== TokenType.RPAREN) {
        args.push(this.parseExpression());
        while (this.current().type === TokenType.COMMA) {
          this.advance();
          args.push(this.parseExpression());
        }
      }
      this.expect(TokenType.RPAREN);
      expr = { type: NodeType.CallExpression, callee: expr, arguments: args };
    }

    // Handle postfix ++ and --
    if (this.current().type === TokenType.OPERATOR && (this.current().value === '++' || this.current().value === '--')) {
      const op = this.advance().value;
      expr = { type: NodeType.UpdateExpression, operator: op as string, argument: expr };
    }

    return expr;
  }

  parsePrimary (): Expression {
    const token = this.current();

    switch (token.type) {
      case TokenType.NUMBER:
        this.advance();
        return { type: NodeType.NumberLiteral, value: token.value as number };

      case TokenType.STRING:
        this.advance();
        return { type: NodeType.StringLiteral, value: token.value as string };

      case TokenType.KEYWORD:
        if (token.value === Keyword.true || token.value === Keyword.false) {
          this.advance();
          return { type: NodeType.BooleanLiteral, value: token.value === Keyword.true };
        }
        throw new Error(`Unexpected keyword '${token.value}' at line ${token.line}, col ${token.col}`);

      case TokenType.IDENTIFIER:
        this.advance();
        return { type: NodeType.Identifier, name: token.value as string };

      case TokenType.LPAREN:
        this.advance();
        const expr = this.parseExpression();
        this.expect(TokenType.RPAREN);
        return expr;

      default:
        throw new Error(`Unexpected token ${token.type} '${token.value}' at line ${token.line}, col ${token.col}`);
    }
  }
}

export default ASTBuilder;
