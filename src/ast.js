class ASTBuilder {
    constructor () {
        this.tokens = [];
        this.pos = 0;
    }

    build (tokens) {
        this.tokens = tokens;
        this.pos = 0;

        const body = [];
        while (!this.isAtEnd()) {
            body.push(this.parseStatement());
        }
        return { type: 'Program', body };
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
        return this.current().type === 'EOF';
    }

    expect (type, value) {
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

    parseStatement () {
        const token = this.current();

        if (token.type === 'KEYWORD') {
            switch (token.value) {
                case 'var': return this.parseVarDeclaration();
                case 'if': return this.parseIf();
                case 'while': return this.parseWhile();
                case 'repeat': return this.parseRepeat();
                case 'for': return this.parseFor();
                case 'function': return this.parseFunctionDeclaration(false);
                case 'function*': return this.parseFunctionDeclaration(true);
                case 'return': return this.parseReturn();
                case 'import': return this.parseImport();
                case 'export': return this.parseExport();
            }
        }

        // Expression statement (function calls, assignments)
        const expr = this.parseExpression();

        // Assignment: identifier = expression
        if (this.current().type === 'EQUALS') {
            this.advance();
            const value = this.parseExpression();
            this.expect('SEMICOLON');
            return { type: 'Assignment', target: expr, value };
        }

        this.expect('SEMICOLON');
        return { type: 'ExpressionStatement', expression: expr };
    }

    parseVarDeclaration () {
        this.advance(); // skip 'var'
        const name = this.expect('IDENTIFIER').value;
        let init = null;
        if (this.current().type === 'EQUALS') {
            this.advance();
            init = this.parseExpression();
        }
        this.expect('SEMICOLON');
        return { type: 'VarDeclaration', name, init };
    }

    parseIf () {
        this.advance(); // skip 'if'
        this.expect('LPAREN');
        const test = this.parseExpression();
        this.expect('RPAREN');
        const consequent = this.parseBlock();
        let alternate = null;
        if (this.current().type === 'KEYWORD' && this.current().value === 'else') {
            this.advance();
            if (this.current().type === 'KEYWORD' && this.current().value === 'if') {
                alternate = this.parseIf();
            } else {
                alternate = this.parseBlock();
            }
        }
        return { type: 'IfStatement', test, consequent, alternate };
    }

    parseWhile () {
        this.advance(); // skip 'while'
        this.expect('LPAREN');
        const test = this.parseExpression();
        this.expect('RPAREN');
        const body = this.parseBlock();
        return { type: 'WhileStatement', test, body };
    }

    parseRepeat () {
        this.advance(); // skip 'repeat'
        this.expect('LPAREN');
        const count = this.parseExpression();
        this.expect('RPAREN');
        const body = this.parseBlock();
        return { type: 'RepeatStatement', count, body };
    }

    parseFor () {
        this.advance(); // skip 'for'
        this.expect('LPAREN');
        const init = this.parseStatement();
        const test = this.parseExpression();
        this.expect('SEMICOLON');
        const update = this.parseExpression();
        this.expect('RPAREN');
        const body = this.parseBlock();
        return { type: 'ForStatement', init, test, update, body };
    }

    parseFunctionDeclaration (warp) {
        this.advance(); // skip 'function'
        const name = this.expect('IDENTIFIER').value;
        this.expect('LPAREN');
        const params = [];
        if (this.current().type !== 'RPAREN') {
            params.push(this.expect('IDENTIFIER').value);
            while (this.current().type === 'COMMA') {
                this.advance();
                params.push(this.expect('IDENTIFIER').value);
            }
        }
        this.expect('RPAREN');
        const body = this.parseBlock();
        return { type: 'FunctionDeclaration', name, params, warp, body };
    }

    parseReturn () {
        this.advance(); // skip 'return'
        let value = null;
        if (this.current().type !== 'SEMICOLON') {
            value = this.parseExpression();
        }
        this.expect('SEMICOLON');
        return { type: 'ReturnStatement', value };
    }

    parseImport () {
        this.advance(); // skip 'import'
        let names = [];
        if (this.current().type === 'LBRACE') {
            this.advance(); // skip '{'
            names.push(this.expect('IDENTIFIER').value);
            while (this.current().type === 'COMMA') {
                this.advance();
                names.push(this.expect('IDENTIFIER').value);
            }
            this.expect('RBRACE');
        } else {
            names.push(this.expect('IDENTIFIER').value);
        }
        const fromToken = this.expect('IDENTIFIER');
        if (fromToken.value !== 'from') {
            throw new Error(
                `Expected 'from' but got '${fromToken.value}' at line ${fromToken.line}, col ${fromToken.col}`
            );
        }
        const source = this.expect('STRING').value;
        this.expect('SEMICOLON');
        return { type: 'ImportStatement', names, source };
    }

    parseExport () {
        this.advance(); // skip 'export'
        let names = [];
        if (this.current().type === 'LBRACE') {
            this.advance(); // skip '{'
            names.push(this.expect('IDENTIFIER').value);
            while (this.current().type === 'COMMA') {
                this.advance();
                names.push(this.expect('IDENTIFIER').value);
            }
            this.expect('RBRACE');
            this.expect('SEMICOLON');
        } else {
            names.push(this.expect('IDENTIFIER').value);
            this.expect('SEMICOLON');
        }
        return { type: 'ExportStatement', names };
    }

    parseBlock () {
        this.expect('LBRACE');
        const body = [];
        while (this.current().type !== 'RBRACE') {
            body.push(this.parseStatement());
        }
        this.expect('RBRACE');
        return { type: 'Block', body };
    }

    // Expressions

    parseExpression () {
        return this.parseOr();
    }

    parseOr () {
        let left = this.parseAnd();
        while (this.current().type === 'OPERATOR' && this.current().value === '||') {
            const op = this.advance().value;
            const right = this.parseAnd();
            left = { type: 'BinaryExpression', operator: op, left, right };
        }
        return left;
    }

    parseAnd () {
        let left = this.parseComparison();
        while (this.current().type === 'OPERATOR' && this.current().value === '&&') {
            const op = this.advance().value;
            const right = this.parseComparison();
            left = { type: 'BinaryExpression', operator: op, left, right };
        }
        return left;
    }

    parseComparison () {
        let left = this.parseAddition();
        while (this.current().type === 'COMPARISON') {
            const op = this.advance().value;
            const right = this.parseAddition();
            left = { type: 'BinaryExpression', operator: op, left, right };
        }
        return left;
    }

    parseAddition () {
        let left = this.parseMultiplication();
        while (this.current().type === 'OPERATOR' && (this.current().value === '+' || this.current().value === '-')) {
            const op = this.advance().value;
            const right = this.parseMultiplication();
            left = { type: 'BinaryExpression', operator: op, left, right };
        }
        return left;
    }

    parseMultiplication () {
        let left = this.parseUnary();
        while (this.current().type === 'OPERATOR' && (this.current().value === '*' || this.current().value === '/' || this.current().value === '%')) {
            const op = this.advance().value;
            const right = this.parseUnary();
            left = { type: 'BinaryExpression', operator: op, left, right };
        }
        return left;
    }

    parseUnary () {
        if (this.current().type === 'NOT') {
            this.advance();
            const value = this.parseUnary();
            return { type: 'UnaryExpression', operator: '!', value };
        }
        if (this.current().type === 'OPERATOR' && this.current().value === '-') {
            this.advance();
            const value = this.parseUnary();
            return { type: 'UnaryExpression', operator: '-', value };
        }
        return this.parseCallExpression();
    }

    parseCallExpression () {
        let expr = this.parsePrimary();

        // Handle function calls: name(args)
        while (this.current().type === 'LPAREN') {
            this.advance();
            const args = [];
            if (this.current().type !== 'RPAREN') {
                args.push(this.parseExpression());
                while (this.current().type === 'COMMA') {
                    this.advance();
                    args.push(this.parseExpression());
                }
            }
            this.expect('RPAREN');
            expr = { type: 'CallExpression', callee: expr, arguments: args };
        }

        // Handle postfix ++ and --
        if (this.current().type === 'OPERATOR' && (this.current().value === '++' || this.current().value === '--')) {
            const op = this.advance().value;
            expr = { type: 'UpdateExpression', operator: op, argument: expr };
        }

        return expr;
    }

    parsePrimary () {
        const token = this.current();

        switch (token.type) {
            case 'NUMBER':
                this.advance();
                return { type: 'NumberLiteral', value: token.value };

            case 'STRING':
                this.advance();
                return { type: 'StringLiteral', value: token.value };

            case 'KEYWORD':
                if (token.value === 'true' || token.value === 'false') {
                    this.advance();
                    return { type: 'BooleanLiteral', value: token.value === 'true' };
                }
                throw new Error(`Unexpected keyword '${token.value}' at line ${token.line}, col ${token.col}`);

            case 'IDENTIFIER':
                this.advance();
                return { type: 'Identifier', name: token.value };

            case 'LPAREN':
                this.advance();
                const expr = this.parseExpression();
                this.expect('RPAREN');
                return expr;

            default:
                throw new Error(`Unexpected token ${token.type} '${token.value}' at line ${token.line}, col ${token.col}`);
        }
    }
}

module.exports = ASTBuilder;