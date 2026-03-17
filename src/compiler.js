const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const Tokenizer = require('./tokenizer');
const ASTBuilder = require('./ast');

const { newSprite, newBlock } = require('./util/project-util');
const uid = require('./util/uid');
const Scope = require('./util/scope');

const { name, version } = require('../package.json');

// todo: make a better system for this
const BUILT_IN_FUNCTIONS = [
    'wait',
    'print',
    'stopAll'
];

class Compiler {
    constructor () {
        this.targets = [];
        this.monitors = [];
        this.extensions = [];
        this.meta = {
            agent: "",
            semver: "3.0.0",
            vm: "0.2.0"
        };

        this._zip = new JSZip();

        this.targets.push(newSprite({ isStage: true, name: "Stage" }));
        this.targets.push(newSprite({ name: 'vm' }));
        this.stage = this.targets[0];
        this.root = this.targets[1];

        this.stage.comments[uid()] = {
            blockId: null,
            x: 50, y: 50,
            width: 350,
            height: 170,
            minimized: false,
            text: `Project compiled by ${name} v${version}`
        };

        this._ids = {
            consoleList: uid(),
            returnVar: uid()
        };

        this.stage.lists[this._ids.consoleList] = ['console', []];
        this.stage.variables[this._ids.returnVar] = ['$', ''];

        this.monitors.push({
            id: this._ids.consoleList,
            mode: 'list',
            opcode: 'data_listcontents',
            params: { LIST: 'console' },
            spriteName: null,
            visible: true,
            width: 0,
            height: 0,
            x: 5, y: 5
        });

        this._exports = {};
        this._compiledFiles = new Set();
        this._currentFile = null;
    }

    insertBlock (blockInfo, lastBlock) {
        const id = uid();
        if (lastBlock && this.root.blocks[lastBlock]) {
            this.root.blocks[lastBlock].next = id;
            this.root.blocks[id] = newBlock({ parent: lastBlock, ...blockInfo });
        } else {
            this.root.blocks[id] = newBlock(blockInfo);
        }
        return id;
    }

    parseSubstack (bodyStatements, parentScope, parentBlockId) {
        const childScope = parentScope.createChild();
        childScope.lastBlock = null;
        let firstBlock = null;

        for (const statement of bodyStatements) {
            childScope.lastBlock = this.parseStatement(statement, childScope);
            if (!firstBlock) firstBlock = childScope.lastBlock;
        }

        if (firstBlock) {
            this.root.blocks[firstBlock].parent = parentBlockId;
        }

        return firstBlock;
    }

    parseBuiltInFunction (funcName, args, scope) {
        switch (funcName) {
            case 'wait': {
                return this.insertBlock({
                    opcode: 'control_wait',
                    inputs: { DURATION: args[0] }
                }, scope.lastBlock);
            }
            case 'print': {
                return this.insertBlock({
                    opcode: 'data_addtolist',
                    fields: { LIST: ['console', this._ids.consoleList] },
                    inputs: { ITEM: args[0] }
                }, scope.lastBlock);
            }
            case 'stopAll': {
                return this.insertBlock({
                    opcode: "control_stop",
                    fields: {
                        STOP_OPTION: ['all', null]
                    },
                    mutation: {
                        children: [],
                        hasnext: false,
                        tagName: "mutation"
                    }
                }, scope.lastBlock);
            }
        }
    }

    parseIdentifier (identifier) {
        return identifier.name;
    }

    parseBinaryExpression (expr, scope) {
        const left = this.parseExpression(expr.left, scope, true);
        const right = this.parseExpression(expr.right, scope, true);
        switch (expr.operator) {
            case '+': {
                if (left[1][0] === 10 || right[1][0] === 10) {
                    return [2, this.insertBlock({
                        opcode: 'operator_join',
                        inputs: {
                            STRING1: left,
                            STRING2: right
                        }
                    })];
                }
                return [2, this.insertBlock({
                    opcode: 'operator_add',
                    inputs: {
                        NUM1: left,
                        NUM2: right
                    }
                })]
        };
            case '-': return [2, this.insertBlock({
                opcode: 'operator_subtract',
                inputs: {
                    NUM1: left,
                    NUM2: right
                }
            })];
            case '*': return [2, this.insertBlock({
                opcode: 'operator_multiply',
                inputs: {
                    NUM1: left,
                    NUM2: right
                }
            })];
            case '/': return [2, this.insertBlock({
                opcode: 'operator_divide',
                inputs: {
                    NUM1: left,
                    NUM2: right
                }
            })];
            case '>': return [2, this.insertBlock({
                opcode: 'operator_gt',
                inputs: {
                    OPERAND1: left,
                    OPERAND2: right
                }
            })];
            case '<': return [2, this.insertBlock({
                opcode: 'operator_lt',
                inputs: {
                    OPERAND1: left,
                    OPERAND2: right
                }
            })];
            case '==': return [2, this.insertBlock({
                opcode: 'operator_equals',
                inputs: {
                    OPERAND1: left,
                    OPERAND2: right
                }
            })];
            case '&&': return [2, this.insertBlock({
                opcode: 'operator_and',
                inputs: {
                    OPERAND1: left,
                    OPERAND2: right
                }
            })];
            case '||': return [2, this.insertBlock({
                opcode: 'operator_or',
                inputs: {
                    OPERAND1: left,
                    OPERAND2: right
                }
            })];
        }
    }

    parseUnaryExpression (expr, scope) {
        const value = this.parseExpression(expr.value, scope);
        if (expr.operator === '!') {
            return [2, this.insertBlock({
                opcode: 'operator_not',
                inputs: {
                    OPERAND: value
                }
            })];
        } else if (expr.operator === '-') {
            return [2, this.insertBlock({
                opcode: 'operator_subtract',
                inputs: {
                    NUM1: [1, [6, 0]],
                    NUM2: value
                }
            })];
        }
    }

    parseExpression (expression, scope, asValue = false) {
        switch (expression.type) {
            case 'CallExpression': {
                const callee = this.parseIdentifier(expression.callee);
                const args = expression.arguments.map(a => this.parseExpression(a, scope, true));
                if (BUILT_IN_FUNCTIONS.includes(callee)) {
                    return this.parseBuiltInFunction(callee, args, scope);
                }
                const mutation = scope.resolveFunction(callee);
                if (mutation) {
                    scope.lastBlock = this.insertBlock({
                        opcode: 'procedures_call',
                        inputs: Object.fromEntries(
                            JSON.parse(mutation.argumentids).map((argId, i) => {
                                if (args[i]) {
                                    return [argId, args[i]];
                                } else {
                                    return [argId, [1, [10, '']]];
                                }
                            })
                        ),
                        mutation: {
                            argumentids: mutation.argumentids,
                            children: [],
                            proccode: mutation.proccode,
                            tagName: 'mutation',
                            warp: mutation.warp
                        }
                    }, scope.lastBlock);
                    if (asValue) {
                        return [3, [12, '$', this._ids.returnVar], [10, '']];
                    }
                    return scope.lastBlock;
                }
                throw new Error(`"${callee}" is not a function.`);
            }
            case 'BinaryExpression': {
                return this.parseBinaryExpression(expression, scope);
            }
            case 'UnaryExpression': {
                return this.parseUnaryExpression(expression, scope);
            }
            case 'StringLiteral': {
                return [1, [10, String(expression.value)]];
            }
            case 'NumberLiteral': {
                return [1, [5, String(expression.value)]];
            }
            case 'BooleanLiteral': {
                const block1 = this.insertBlock({
                    opcode: 'operator_not',
                    inputs: expression.value ? {} : {
                        OPERAND: [2, this.insertBlock({
                            opcode: 'operator_not'
                        })]
                    }
                }, scope.lastBlock);
                return [2, block1];
            }
            case 'Identifier': {
                const resolved = scope.resolveVariable(expression.name);
                if (!resolved) {
                    throw new Error(`"${expression.name}" is not defined.`);
                }
                if (resolved.type === 'parameter') {
                    return [2, this.insertBlock({
                        opcode: 'argument_reporter_string_number',
                        fields: {
                            VALUE: [expression.name, null]
                        }
                    })];
                } else if (resolved.type === 'function') {
                    return [1, [10, '[function]']];
                } else if (resolved.type === 'variable') {
                    return [2, [12, resolved.name, resolved.id]];
                }
            }
            case 'UpdateExpression': {
                const resolved = scope.resolveVariable(expression.argument.name);
                if (!resolved || resolved.type !== 'variable') {
                    throw new Error(`"${expression.argument.name}" cannot be incremented/decremented.`);
                }
                scope.lastBlock = this.insertBlock({
                    opcode: 'data_changevariableby',
                    fields: {
                        VARIABLE: [resolved.name, resolved.id]
                    },
                    inputs: {
                        VALUE: [1, [5, expression.operator === '++' ? '1' : '-1']]
                    }
                }, scope.lastBlock);
                return scope.lastBlock;
            }
        }
    }

    parseStatement (statement, scope) {
        switch (statement.type) {
            case 'Assignment': {
                const resolved = scope.resolveVariable(statement.target.name);
                if (resolved.type !== 'variable') {
                    throw new Error(`"${statement.target.name}" cannot be set.`);
                }
                const value = this.parseExpression(statement.value, scope, true);
                return this.insertBlock({
                    opcode: 'data_setvariableto',
                    fields: {
                        VARIABLE: [resolved.name, resolved.id]
                    },
                    inputs: {
                        VALUE: value
                    }
                }, scope.lastBlock);
            }
            case 'ExpressionStatement': {
                return this.parseExpression(statement.expression, scope);
            }
            case 'WhileStatement': {
                const test = this.parseExpression(statement.test, scope, true);
                const whileId = this.insertBlock({
                    opcode: 'control_while',
                    inputs: {
                        CONDITION: test,
                        SUBSTACK: [2]
                    }
                }, scope.lastBlock);
                const firstBody = this.parseSubstack(statement.body.body, scope, whileId);
                if (firstBody) {
                    this.root.blocks[whileId].inputs.SUBSTACK = [2, firstBody];
                }
                return whileId;
            }
            case 'IfStatement': {
                const test = this.parseExpression(statement.test, scope, true);
                const hasElse = statement.alternate !== null;
                const ifId = this.insertBlock({
                    opcode: hasElse ? 'control_if_else' : 'control_if',
                    inputs: {
                        CONDITION: test,
                        SUBSTACK: [2]
                    }
                }, scope.lastBlock);
                const firstCons = this.parseSubstack(statement.consequent.body, scope, ifId);
                if (firstCons) {
                    this.root.blocks[ifId].inputs.SUBSTACK = [2, firstCons];
                }
                if (hasElse) {
                    const altBody = statement.alternate.type === 'Block'
                        ? statement.alternate.body
                        : [statement.alternate];
                    const firstAlt = this.parseSubstack(altBody, scope, ifId);
                    if (firstAlt) {
                        this.root.blocks[ifId].inputs.SUBSTACK2 = [2, firstAlt];
                    }
                }
                return ifId;
            }
            case 'RepeatStatement': {
                const count = this.parseExpression(statement.count, scope, true);
                const repeatId = this.insertBlock({
                    opcode: 'control_repeat',
                    inputs: {
                        TIMES: count,
                        SUBSTACK: [2]
                    }
                }, scope.lastBlock);
                const firstBody = this.parseSubstack(statement.body.body, scope, repeatId);
                if (firstBody) {
                    this.root.blocks[repeatId].inputs.SUBSTACK = [2, firstBody];
                }
                return repeatId;
            }
            case 'ForStatement': {
                // Compile the init statement of the for loop
                scope.lastBlock = this.parseStatement(statement.init, scope);

                const test = this.parseExpression(statement.test, scope, true);
                const whileId = this.insertBlock({
                    opcode: 'control_while',
                    inputs: {
                        CONDITION: test,
                        SUBSTACK: [2]
                    }
                }, scope.lastBlock);

                // This part is a little sketchy
                // This adds the update to the end of substack in the while loop
                const bodyWithUpdate = [...statement.body.body, { type: 'ExpressionStatement', expression: statement.update }];
                const firstBody = this.parseSubstack(bodyWithUpdate, scope, whileId);
                if (firstBody) {
                    this.root.blocks[whileId].inputs.SUBSTACK = [2, firstBody];
                }
                return whileId;
            }
            case 'VarDeclaration': {
                const newVarId = uid();
                scope.defineVariable(statement.name, newVarId);
                // todo: should the variable's init value be the variables value in the JSON?
                this.root.variables[newVarId] = [statement.name + '@' + scope.id, String(statement.init.value)];
                return scope.lastBlock;
            }
            case 'ReturnStatement': {
                if (!scope.isFunction) {
                    throw new Error("Return statements can only be used inside of functions.");
                }
                const value = this.parseExpression(statement.value, scope, true);
                const block1 = this.insertBlock({
                    opcode: 'data_setvariableto',
                    fields: {
                        VARIABLE: ['$', this._ids.returnVar]
                    },
                    inputs: {
                        VALUE: value
                    }
                }, scope.lastBlock);
                return this.insertBlock({
                    opcode: 'control_stop',
                    fields: {
                        STOP_OPTION: ['this script', null]
                    },
                    mutation: {
                        tagName: 'mutation',
                        hasnext: false,
                        children: []
                    }
                }, block1);
            }

            case 'ImportStatement': {
                const importPath = path.resolve(path.dirname(this._currentFile), statement.source);
                const resolvedPath = importPath.endsWith('.claw') ? importPath : importPath + '.claw';
                if (!this._compiledFiles.has(resolvedPath)) {
                    this.compileFile(resolvedPath, scope);
                }
                const fileExports = this._exports[resolvedPath];
                if (!fileExports) throw new Error(`No exports found from "${statement.source}"`);
                for (const name of statement.names) {
                    const exp = fileExports[name];
                    if (!exp) throw new Error(`"${name}" is not exported from "${statement.source}"`);
                    if (exp.type === 'variable') {
                        scope.importVariable(name, exp.name, exp.id);
                    } else if (exp.type === 'function') {
                        scope.defineFunction(name, exp.mutation);
                    }
                }
                return scope.lastBlock;
            }
            case 'ExportStatement': {
                if (!this._exports[this._currentFile]) this._exports[this._currentFile] = {};
                for (const name of statement.names) {
                    const resolvedFunc = scope.resolveFunction(name);
                    if (resolvedFunc) {
                        this._exports[this._currentFile][name] = {
                            type: 'function',
                            mutation: resolvedFunc
                        };
                    } else {
                        const resolvedVar = scope.resolveVariable(name);
                        if (resolvedVar && resolvedVar.type === 'variable') {
                            this._exports[this._currentFile][name] = {
                                type: 'variable',
                                name: resolvedVar.name,
                                id: resolvedVar.id
                            };
                        } else {
                            throw new Error(`"${name}" is not defined and cannot be exported.`);
                        }
                    }
                }
                return scope.lastBlock;
            }
            case 'FunctionDeclaration': {
                const args = statement.params;
                const argumentIds = args.map(_ => uid());
                const argumentBlocks = [];
                const mutation = {
                    argumentdefaults: JSON.stringify(args.map(_ => '""')),
                    argumentids: JSON.stringify(argumentIds),
                    argumentnames: JSON.stringify(args),
                    children: [],
                    proccode: statement.name + args.map(_ => ' %s').join('') + `@${scope.id}`,
                    tagName: "mutation",
                    warp: statement.warp
                };
                const procedurePrototype = this.insertBlock({
                    opcode: 'procedures_prototype',
                    inputs: Object.fromEntries(
                        argumentIds.map((argId, i) => {
                            const arg = this.insertBlock({
                                opcode: 'argument_reporter_string_number',
                                fields: {
                                    VALUE: [args[i], null]
                                },
                                shadow: true
                            });
                            argumentBlocks.push(arg);
                            return [argId, [1, arg]];
                        })
                    ),
                    mutation,
                    shadow: true
                });
                // todo: make a better way to do this
                argumentBlocks.forEach(argBlock => {
                    this.root.blocks[argBlock].parent = procedurePrototype;
                });
                const definition = this.insertBlock({
                    opcode: 'procedures_definition',
                    topLevel: true,
                    inputs: {
                        custom_block: [1, procedurePrototype]
                    }
                });
                const funcScope = scope.createChild(true);
                funcScope.lastBlock = definition;
                args.forEach(p => funcScope.defineParam(p));
                this.parseASTBody(statement.body.body, funcScope);
                scope.defineFunction(statement.name, mutation);
                return scope.lastBlock;
            }
        }
    }

    parseASTBody (body, scope) {
        if (!scope.lastBlock) {
            scope.lastBlock = this.insertBlock({
                opcode: "event_whenflagclicked",
                topLevel: true
            });
        }

        for (const statement of body) {
            scope.lastBlock = this.parseStatement(statement, scope);
        }
    }

    compileFile (filePath) {
        const tokenizer = new Tokenizer();
        const astBuilder = new ASTBuilder();

        let scriptData;
        try {
            scriptData = fs.readFileSync(filePath, { encoding: 'utf-8' });
        } catch {
            throw new Error(`Failed to load file: ${filePath}`);
        }

        this._compiledFiles.add(filePath);
        const previousFile = this._currentFile;
        this._currentFile = filePath;

        const tokens = tokenizer.tokenize(scriptData);
        const ast = astBuilder.build(tokens);

        const fileScope = new Scope();
        this.parseASTBody(ast.body, fileScope);

        this._currentFile = previousFile;
        return fileScope;
    }

    compile (filePath) {
        const resolvedPath = path.resolve(filePath);
        this.compileFile(resolvedPath, new Scope());

        const projectJSON = this.toJSON();
        const emptySVG = fs.readFileSync(path.join(__dirname, './assets/927d672925e7b99f7813735c484c6922.svg'));
        this._zip.file('project.json', JSON.stringify(projectJSON));
        this._zip.file('927d672925e7b99f7813735c484c6922.svg', emptySVG);
    }

    toJSON () {
        return {
            targets: this.targets,
            monitors: this.monitors,
            extensions: this.extensions,
            meta: this.meta
        };
    }

    generateZip (type) {
        return this._zip.generateAsync({ type });
    }
}

module.exports = Compiler;