import {
  TokenType,
  Keyword,
  NodeType,
  type Token,
  type Statement,
  type Expression,
  type MemberExpression,
  type Program,
  type Block,
  type VarDeclaration,
  type IfStatement,
  type SwitchStatement,
  type WhileStatement,
  type RepeatStatement,
  type ForStatement,
  type FunctionDeclaration,
  type FunctionExpression,
  type ReturnStatement,
  type TryStatement,
  type ThrowStatement,
  type ImportStatement,
  type ExportStatement,
  type TypeDeclaration,
  type StructDeclaration,
  type StructLiteral,
  type TypeSyntax
} from './types.ts';

class ASTBuilder {
  tokens: Token[];
  pos: number;
  locations: WeakMap<object, Token>;
  names: WeakMap<object, Token[]>;
  typeTokens: Token[];

  constructor () {
    this.tokens = [];
    this.pos = 0;
    this.locations = new WeakMap();
    this.names = new WeakMap();
    this.typeTokens = [];
  }

  build (tokens: Token[]): Program {
    this.tokens = tokens;
    this.pos = 0;
    this.locations = new WeakMap();
    this.names = new WeakMap();
    this.typeTokens = [];

    const body: Statement[] = [];
    while (!this.isAtEnd()) {
      body.push(this.parseStatement());
    }
    return {
      type: NodeType.Program,
      body
    };
  }

  current () {
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

  private recordLocation<T extends object> (node: T, token: Token): T {
    if (!this.locations.has(node)) {
      this.locations.set(node, token);
    }
    return node;
  }

  private recordNameTokens<T extends object> (node: T, tokens: Token[]): T {
    this.names.set(node, tokens);
    return node;
  }

  // Statements

  parseStatement (): Statement {
    const token = this.current();
    return this.recordLocation(this.parseStatementBody(), token);
  }

  parseStatementBody (): Statement {
    const token = this.current();

    if (token.value === Keyword.type && this.tokens[this.pos + 1].type === TokenType.IDENTIFIER) {
      return this.parseTypeDeclaration();
    }

    if (token.type === TokenType.LBRACE) {
      return this.parseBlock();
    }

    if (token.type === TokenType.KEYWORD) {
      switch (token.value) {
        case Keyword.const:
        case Keyword.var:
        case Keyword.list:
          return this.parseVarDeclaration();
        case Keyword.struct:
          return this.parseStructDeclaration();
        case Keyword.if:
          return this.parseIf();
        case Keyword.switch:
          return this.parseSwitch();
        case Keyword.while:
          return this.parseWhile();
        case Keyword.repeat:
          return this.parseRepeat();
        case Keyword.for:
          return this.parseFor();
        case Keyword.break: {
          this.advance();
          this.expect(TokenType.SEMICOLON);
          return {
            type: NodeType.BreakStatement
          };
        }
        case Keyword.continue: {
          this.advance();
          this.expect(TokenType.SEMICOLON);
          return {
            type: NodeType.ContinueStatement
          };
        }
        case Keyword.function:
          return this.parseFunctionDeclaration(false);
        case Keyword['function*']:
          return this.parseFunctionDeclaration(true);
        case Keyword.return:
          return this.parseReturn();
        case Keyword.try:
          return this.parseTry();
        case Keyword.throw:
          return this.parseThrow();
        case Keyword.import:
          return this.parseImport();
        case Keyword.export:
          return this.parseExport();
      }
    }

    const statement = this.parseSimpleStatement();
    this.expect(TokenType.SEMICOLON);
    return statement;
  }

  parseSimpleStatement (): Statement {
    const expression = this.parseExpression();
    const token = this.current();

    const compound = token.type === TokenType.OPERATOR &&
      ['+=', '-=', '*=', '/=', '%='].includes(token.value as string);

    if (token.type === TokenType.EQUALS || compound) {
      this.advance();
      const value = this.parseExpression();

      return {
        type: NodeType.Assignment,
        target: expression,
        value,
        operator: compound ? (token.value as string)[0] : undefined
      };
    }

    return {
      type: NodeType.ExpressionStatement,
      expression: expression
    };
  }

  parseVarDeclaration (): VarDeclaration {
    const constant = this.current().value === Keyword.const;
    if (constant) {
      this.advance();
    }
    const list = this.current().value === Keyword.list;
    this.expect(TokenType.KEYWORD, list ? Keyword.list : Keyword.var);
    const name = this.expect(TokenType.IDENTIFIER);
    const annotation = this.parseAnnotation();
    let init = null;
    if (this.current().type === TokenType.EQUALS) {
      this.advance();
      init = this.parseExpression();
    }
    this.expect(TokenType.SEMICOLON);
    return this.recordNameTokens({
      type: NodeType.VarDeclaration,
      name: name.value as string,
      constant,
      list,
      init,
      ...(annotation && { annotation })
    }, [name]);
  }

  parseIf (): IfStatement {
    this.advance();
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
    return {
      type: NodeType.IfStatement,
      test,
      consequent,
      alternate
    };
  }

  parseSwitch (): SwitchStatement {
    this.advance();
    this.expect(TokenType.LPAREN);
    const discriminant = this.parseExpression();
    this.expect(TokenType.RPAREN);
    this.expect(TokenType.LBRACE);

    const cases: SwitchStatement['cases'] = [];
    let hasDefault = false;

    while (this.current().type !== TokenType.RBRACE) {
      const label = this.current();
      let test = null;

      if (label.type === TokenType.KEYWORD && label.value === Keyword.default) {
        if (hasDefault) {
          throw new Error(`Unexpected 'default' at line ${label.line}, col ${label.col}`);
        }

        this.advance();
        hasDefault = true;
      } else {
        this.expect(TokenType.KEYWORD, Keyword.case);
        test = this.parseExpression();
      }

      this.expect(TokenType.COLON);
      const body: Statement[] = [];

      while (this.current().type !== TokenType.RBRACE) {
        const token = this.current();

        if (token.type === TokenType.KEYWORD &&
            (token.value === Keyword.case || token.value === Keyword.default)) {
          break;
        }

        body.push(this.parseStatement());
      }

      cases.push({
        test,
        body
      });
    }

    this.expect(TokenType.RBRACE);
    return {
      type: NodeType.SwitchStatement,
      discriminant,
      cases
    };
  }

  parseWhile (): WhileStatement {
    this.advance();
    this.expect(TokenType.LPAREN);
    const test = this.parseExpression();
    this.expect(TokenType.RPAREN);
    const body = this.parseBlock();
    return {
      type: NodeType.WhileStatement,
      test,
      body
    };
  }

  parseRepeat (): RepeatStatement {
    this.advance();
    this.expect(TokenType.LPAREN);
    const count = this.parseExpression();
    this.expect(TokenType.RPAREN);
    const body = this.parseBlock();
    return {
      type: NodeType.RepeatStatement,
      count,
      body
    };
  }

  parseFor (): ForStatement {
    this.advance();
    this.expect(TokenType.LPAREN);
    const init = this.parseStatement();
    const test = this.parseExpression();
    this.expect(TokenType.SEMICOLON);
    const update = this.parseSimpleStatement();
    this.expect(TokenType.RPAREN);
    const body = this.parseBlock();
    return {
      type: NodeType.ForStatement,
      init,
      test,
      update,
      body
    };
  }

  parseFunctionDeclaration (warp: boolean): FunctionDeclaration {
    this.advance();
    const name = this.expect(TokenType.IDENTIFIER);

    return this.recordNameTokens({
      ...this.parseFunctionExpression(warp),
      type: NodeType.FunctionDeclaration,
      name: name.value as string
    }, [name]);
  }

  parseFunctionExpression (warp: boolean): FunctionExpression {
    this.expect(TokenType.LPAREN);
    const parameters: Token[] = [];
    const paramTypes: (TypeSyntax | undefined)[] = [];
    while (this.current().type !== TokenType.RPAREN) {
      parameters.push(this.expect(TokenType.IDENTIFIER));
      paramTypes.push(this.parseAnnotation());
      if (this.current().type !== TokenType.COMMA) {
        break;
      }
      this.advance();
    }
    this.expect(TokenType.RPAREN);
    const returnType = this.parseAnnotation();
    const body = this.recordNameTokens(this.parseBlock(), parameters);
    return {
      type: NodeType.FunctionExpression,
      params: parameters.map(parameter => parameter.value as string),
      warp,
      body,
      ...(paramTypes.some(Boolean) && { paramTypes }),
      ...(returnType && { returnType })
    };
  }

  parseReturn (): ReturnStatement {
    this.advance();
    let value = null;
    if (this.current().type !== TokenType.SEMICOLON) {
      value = this.parseExpression();
    }
    this.expect(TokenType.SEMICOLON);
    return {
      type: NodeType.ReturnStatement,
      value
    };
  }

  parseTry (): TryStatement {
    this.advance();
    const body = this.parseBlock();
    this.expect(TokenType.KEYWORD, Keyword.catch);

    let parameter: Token | undefined;
    if (this.current().type === TokenType.LPAREN) {
      this.advance();
      parameter = this.expect(TokenType.IDENTIFIER);
      this.expect(TokenType.RPAREN);
    }

    return this.recordNameTokens({
      type: NodeType.TryStatement,
      body,
      parameter: (parameter?.value as string) || null,
      handler: this.parseBlock()
    }, parameter ? [parameter] : []);
  }

  parseThrow (): ThrowStatement {
    const keyword = this.advance();
    const token = this.current();

    if (token.line !== keyword.line) {
      throw new Error(
        `Unexpected line break after 'throw' at line ${keyword.line}, col ${keyword.col}`
      );
    }

    const value = this.parseExpression();
    this.expect(TokenType.SEMICOLON);
    return {
      type: NodeType.ThrowStatement,
      value
    };
  }

  parseImport (): ImportStatement {
    this.advance();
    const typeOnly = this.current().value === Keyword.type &&
      this.tokens[this.pos + 1].value !== 'from';
    if (typeOnly) {
      this.typeTokens.push(this.advance());
    }

    const defaultImport = this.current().type !== TokenType.LBRACE;
    let names: Token[];
    if (defaultImport) {
      names = [this.expect(TokenType.IDENTIFIER)];
    } else {
      this.advance();
      names = this.current().type === TokenType.RBRACE ? [] : this.parseNameList();
      this.expect(TokenType.RBRACE);
    }

    const fromToken = this.expect(TokenType.IDENTIFIER);
    if (fromToken.value !== 'from') {
      throw new Error(
        `Expected 'from' but got '${fromToken.value}' ` +
        `at line ${fromToken.line}, col ${fromToken.col}`
      );
    }
    const source = this.expect(TokenType.STRING).value as string;
    this.expect(TokenType.SEMICOLON);
    return this.recordNameTokens({
      type: NodeType.ImportStatement,
      names: names.map(name => name.value as string),
      source,
      defaultImport,
      ...(typeOnly && { typeOnly })
    }, names);
  }

  parseExport (): ExportStatement | TypeDeclaration | StructDeclaration {
    this.advance();
    if (
      this.current().type === TokenType.KEYWORD &&
      this.current().value === Keyword.struct
    ) {
      return this.parseStructDeclaration(true);
    }
    const isTypeOnly = (
      this.current().value === Keyword.type &&
      this.tokens[this.pos + 1].type !== TokenType.SEMICOLON
    );
    if (
      isTypeOnly &&
      this.tokens[this.pos + 2]?.type === TokenType.EQUALS
    ) {
      return this.parseTypeDeclaration(true);
    }
    if (isTypeOnly) {
      this.typeTokens.push(this.advance());
    }

    let names: Token[];
    if (this.current().type === TokenType.LBRACE) {
      this.advance();
      names = this.parseNameList();
      this.expect(TokenType.RBRACE);
    } else {
      names = [this.expect(TokenType.IDENTIFIER)];
    }
    this.expect(TokenType.SEMICOLON);
    return this.recordNameTokens({
      type: NodeType.ExportStatement,
      names: names.map(name => name.value as string),
      ...(isTypeOnly && { isTypeOnly })
    }, names);
  }

  private parseNameList () {
    const names = [this.expect(TokenType.IDENTIFIER)];
    while (this.current().type === TokenType.COMMA) {
      this.advance();
      names.push(this.expect(TokenType.IDENTIFIER));
    }

    return names;
  }

  parseTypeDeclaration (exported = false): TypeDeclaration {
    this.typeTokens.push(this.advance());
    const name = this.expect(TokenType.IDENTIFIER);
    this.typeTokens.push(name);
    this.expect(TokenType.EQUALS);
    const annotation = this.parseType();
    this.expect(TokenType.SEMICOLON);
    return this.recordNameTokens({
      type: NodeType.TypeDeclaration,
      name: name.value as string,
      annotation,
      ...(exported && { exported })
    }, [name]);
  }

  parseStructDeclaration (exported = false): StructDeclaration {
    this.expect(TokenType.KEYWORD, Keyword.struct);
    const name = this.expect(TokenType.IDENTIFIER);
    this.typeTokens.push(name);
    const properties: StructDeclaration['properties'] = [];

    this.expect(TokenType.LBRACE);
    while (this.current().type !== TokenType.RBRACE) {
      const property = this.expect(TokenType.IDENTIFIER);
      properties.push(this.recordLocation({
        name: property.value as string,
        annotation: this.parseAnnotation()
      }, property));

      if (this.current().type !== TokenType.COMMA) {
        break;
      }

      this.advance();
    }
    this.expect(TokenType.RBRACE);
    if (this.current().type === TokenType.SEMICOLON) {
      this.advance();
    }

    return this.recordNameTokens({
      type: NodeType.StructDeclaration,
      name: name.value as string,
      properties,
      ...(exported && { exported })
    }, [name]);
  }

  parseAnnotation () {
    if (this.current().type === TokenType.COLON) {
      this.advance();
      return this.parseType();
    }
  }

  parseType (): TypeSyntax {
    const start = this.current();
    const members = [this.parseArrayType()];
    while (this.current().value === '|') {
      this.advance();
      members.push(this.parseArrayType());
    }

    if (members.length === 1) {
      return members[0];
    }

    return this.recordLocation({
      kind: 'union',
      members
    }, start);
  }

  parseArrayType (): TypeSyntax {
    const start = this.current();
    let element = this.parsePrimaryType();
    while (this.current().type === TokenType.LBRACKET) {
      this.advance();
      this.expect(TokenType.RBRACKET);
      element = this.recordLocation({
        kind: 'array',
        element
      }, start);
    }
    return element;
  }

  parsePrimaryType (): TypeSyntax {
    const token = this.current();
    if (token.type === TokenType.LPAREN) {
      this.advance();
      if (this.current().type !== TokenType.RPAREN &&
        this.tokens[this.pos + 1]?.type !== TokenType.COLON
      ) {
        const group = this.parseType();
        this.expect(TokenType.RPAREN);
        return group;
      }

      const params: { name: string; annotation: TypeSyntax }[] = [];
      while (this.current().type !== TokenType.RPAREN) {
        const name = this.expect(TokenType.IDENTIFIER);
        this.expect(TokenType.COLON);
        params.push({
          name: name.value as string,
          annotation: this.parseType()
        });
        if (this.current().type !== TokenType.COMMA) {
          break;
        }
        this.advance();
      }
      this.expect(TokenType.RPAREN);
      this.expect(TokenType.OPERATOR, '->');
      return this.recordLocation({
        kind: 'function',
        params,
        result: this.parseType()
      }, token);
    }

    if (token.type === TokenType.STRING || token.type === TokenType.NUMBER ||
        token.value === Keyword.true || token.value === Keyword.false ||
        (token.type === TokenType.OPERATOR && token.value === '-')) {
      this.advance();
      let value = token.value;
      if (token.type === TokenType.KEYWORD) {
        return this.recordLocation({
          kind: 'literal',
          value: value === Keyword.true
        }, token);
      }
      if (token.type === TokenType.OPERATOR) {
        value = -Number(this.expect(TokenType.NUMBER).value);
      }
      return this.recordLocation({
        kind: 'literal',
        value
      }, token);
    }

    this.expect(TokenType.IDENTIFIER);
    this.typeTokens.push(token);

    const args: TypeSyntax[] = [];
    if (this.current().value === '<') {
      this.advance();
      args.push(this.parseType());
      while (this.current().type === TokenType.COMMA) {
        this.advance();
        args.push(this.parseType());
      }
      const close = this.current();
      if (close.type === TokenType.COMPARISON && close.value === '>=') {
        // The closing type argument can sit directly before an assignment.
        this.tokens[this.pos] = {
          ...close,
          type: TokenType.EQUALS,
          value: '=',
          col: close.col + 1
        };
      } else {
        this.expect(TokenType.COMPARISON, '>');
      }
    }
    return this.recordLocation({
      kind: 'reference',
      name: token.value as string,
      args
    }, token);
  }

  parseBlock (): Block {
    this.expect(TokenType.LBRACE);
    const body: Statement[] = [];
    while (this.current().type !== TokenType.RBRACE) {
      body.push(this.parseStatement());
    }
    this.expect(TokenType.RBRACE);
    return {
      type: NodeType.Block,
      body
    };
  }

  // Expressions

  parseExpression (): Expression {
    const start = this.current();
    return this.recordLocation(this.parseConditional(), start);
  }

  parseConditional (): Expression {
    const test = this.parseOr();

    if (this.current().type !== TokenType.QUESTION) {
      return test;
    }

    this.advance();
    const consequent = this.parseExpression();
    this.expect(TokenType.COLON);
    const alternate = this.parseExpression();

    return {
      type: NodeType.ConditionalExpression,
      test,
      consequent,
      alternate
    };
  }

  parseOr (): Expression {
    return this.parseBinary(() => this.parseAnd(), TokenType.OPERATOR, ['||']);
  }

  parseAnd (): Expression {
    return this.parseBinary(() => this.parseComparison(), TokenType.OPERATOR, ['&&']);
  }

  parseComparison (): Expression {
    return this.parseBinary(() => this.parseAddition(), TokenType.COMPARISON);
  }

  parseAddition (): Expression {
    return this.parseBinary(() => this.parseMultiplication(), TokenType.OPERATOR, ['+', '-']);
  }

  parseMultiplication (): Expression {
    return this.parseBinary(() => this.parseUnary(), TokenType.OPERATOR, ['*', '/', '%']);
  }

  private parseBinary (
    parseOperand: () => Expression,
    type: TokenType,
    operators?: string[]
  ): Expression {
    let left = parseOperand();

    while (this.current().type === type) {
      const operator = this.current().value as string;
      if (operators && !operators.includes(operator)) {
        break;
      }

      this.advance();
      left = {
        type: NodeType.BinaryExpression,
        operator,
        left,
        right: parseOperand()
      };
    }

    return left;
  }

  parseUnary (): Expression {
    const token = this.current();
    if (token.type === TokenType.NOT ||
        (token.type === TokenType.OPERATOR && token.value === '-')) {
      this.advance();
      return {
        type: NodeType.UnaryExpression,
        operator: token.type === TokenType.NOT ? '!' : '-',
        value: this.parseUnary()
      };
    }
    return this.parseCallExpression();
  }

  parseCallExpression (): Expression {
    const start = this.current();
    let expression = this.recordLocation(this.parsePrimary(), start);

    while (
      this.current().type === TokenType.LPAREN ||
      this.current().type === TokenType.DOT ||
      this.current().type === TokenType.LBRACKET
    ) {
      if (this.current().type === TokenType.LBRACKET) {
        this.advance();
        const index = this.parseExpression();
        this.expect(TokenType.RBRACKET);
        expression = this.recordLocation({
          type: NodeType.IndexExpression,
          object: expression,
          index
        }, start);
        continue;
      }

      if (this.current().type === TokenType.DOT) {
        expression = this.parseMemberExpression(expression);
        continue;
      }

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
      expression = this.recordLocation({
        type: NodeType.CallExpression,
        callee: expression,
        arguments: args
      }, start);
    }

    if (
      this.current().type === TokenType.OPERATOR &&
      (this.current().value === '++' || this.current().value === '--')
    ) {
      const operator = this.advance().value as string;
      expression = this.recordLocation({
        type: NodeType.UpdateExpression,
        operator,
        argument: expression
      }, start);
    }

    return expression;
  }

  parseMemberExpression (object: Expression): MemberExpression {
    this.advance();
    const token = this.current();
    if (token.type !== TokenType.IDENTIFIER && token.type !== TokenType.KEYWORD) {
      this.expect(TokenType.IDENTIFIER);
    }
    this.advance();

    return this.recordLocation({
      type: NodeType.MemberExpression,
      object,
      property: token.value as string
    }, token);
  }

  parseStructLiteral (): StructLiteral {
    this.expect(TokenType.LBRACE);
    const properties: StructLiteral['properties'] = [];
    while (this.current().type !== TokenType.RBRACE) {
      const token = this.expect(TokenType.IDENTIFIER);
      const name = token.value as string;
      let value: Expression;
      if (this.current().type === TokenType.COLON) {
        this.advance();
        value = this.parseExpression();
      } else {
        value = this.recordLocation({
          type: NodeType.Identifier,
          name
        }, token);
      }

      properties.push(this.recordLocation({
        name,
        value
      }, token));
      if (this.current().type !== TokenType.COMMA) {
        break;
      }

      this.advance();
    }
    this.expect(TokenType.RBRACE);
    return {
      type: NodeType.StructLiteral,
      properties
    };
  }

  parsePrimary (): Expression {
    const token = this.current();

    switch (token.type) {
      case TokenType.LBRACE:
        return this.parseStructLiteral();
      case TokenType.LBRACKET: {
        this.advance();
        const elements: Expression[] = [];

        while (this.current().type !== TokenType.RBRACKET) {
          elements.push(this.parseExpression());

          if (this.current().type !== TokenType.COMMA) {
            break;
          }

          this.advance();
        }

        this.expect(TokenType.RBRACKET);
        return {
          type: NodeType.ArrayExpression,
          elements
        };
      }

      case TokenType.NUMBER:
        this.advance();
        return {
          type: NodeType.NumberLiteral,
          value: token.value as number
        };

      case TokenType.STRING:
        this.advance();
        return {
          type: NodeType.StringLiteral,
          value: token.value as string
        };

      case TokenType.KEYWORD:
        if (token.value === Keyword.function || token.value === Keyword['function*']) {
          this.advance();
          return this.parseFunctionExpression(token.value === Keyword['function*']);
        }

        if (token.value === Keyword.true || token.value === Keyword.false) {
          this.advance();
          return {
            type: NodeType.BooleanLiteral,
            value: token.value === Keyword.true
          };
        }
        throw new Error(
          `Unexpected keyword '${token.value}' at line ${token.line}, col ${token.col}`
        );

      case TokenType.IDENTIFIER:
        this.advance();
        return {
          type: NodeType.Identifier,
          name: token.value as string
        };

      case TokenType.LPAREN:
        this.advance();
        const expression = this.parseExpression();
        this.expect(TokenType.RPAREN);
        return expression;

      default:
        throw new Error(
          `Unexpected token ${token.type} '${token.value}' ` +
          `at line ${token.line}, col ${token.col}`
        );
    }
  }
}

export default ASTBuilder;
