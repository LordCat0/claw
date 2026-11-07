import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import Tokenizer from './tokenizer.ts';
import ASTBuilder from './ast.ts';
import {
  newSprite,
  newBlock
} from './util/project-util.ts';
import uid from './util/uid.ts';
import Scope from './util/scope.ts';
import {
  globals,
  extensions
} from './blocks/index.ts';
import meta from '../package.json' with { type: 'json' };
import {
  NodeType,
  type Statement,
  type Expression,
  type BinaryExpression,
  type UnaryExpression,
  type ScratchInput,
  type Mutation,
  type Sprite,
  type BlockOptions,
  type ZipOutputs,
  type Monitor,
  type ProjectMeta,
  type Binding,
  type Bindings,
  type FunctionBinding,
  type CallArguments,
  type FunctionDeclaration,
  type FunctionExpression
} from './types.ts';

class Compiler {
  targets: Sprite[];
  monitors: Monitor[];
  extensions: string[];
  meta: ProjectMeta;
  stage: Sprite;
  root: Sprite;
  consoleList: string;
  private _zip: JSZip;
  private _returnVar: string;
  private _exports: Record<string, Bindings>;
  private _compiledFiles: Set<string>;
  private _currentFile: string | null;
  private _globals: Scope;

  constructor () {
    this.targets = [];
    this.monitors = [];
    this.extensions = [];
    this.meta = {
      agent: '',
      semver: '3.0.0',
      vm: '0.2.0'
    };

    this._zip = new JSZip();

    this.targets.push(newSprite({
      isStage: true,
      name: 'Stage'
    }));
    this.targets.push(newSprite({ name: 'vm' }));
    this.stage = this.targets[0];
    this.root = this.targets[1];

    this.stage.comments[uid()] = {
      blockId: null,
      x: 50,
      y: 50,
      width: 350,
      height: 170,
      minimized: false,
      text: `Project compiled by ${meta.name} v${meta.version}`
    };

    this.consoleList = uid();
    this._returnVar = uid();

    this.stage.lists[this.consoleList] = ['console', []];
    this.stage.variables[this._returnVar] = ['$', ''];

    this.monitors.push({
      id: this.consoleList,
      mode: 'list',
      opcode: 'data_listcontents',
      params: { LIST: 'console' },
      spriteName: null,
      visible: true,
      width: 0,
      height: 0,
      x: 5,
      y: 5
    });

    this._exports = {};
    this._compiledFiles = new Set();
    this._currentFile = null;
    this._globals = new Scope();
    Object.assign(this._globals.bindings, globals);
  }

  insertBlock (blockInfo: BlockOptions, lastBlock?: string) {
    const id = uid();

    if (lastBlock && this.root.blocks[lastBlock]) {
      this.root.blocks[lastBlock].next = id;
      this.root.blocks[id] = newBlock({
        parent: lastBlock,
        ...blockInfo
      });
    } else {
      this.root.blocks[id] = newBlock(blockInfo);
    }

    for (const input of Object.values(this.root.blocks[id].inputs)) {
      if (Array.isArray(input)) {
        for (const value of input.slice(1)) {
          if (typeof value === 'string' && this.root.blocks[value]) {
            this.root.blocks[value].parent = id;
          }
        }
      }
    }

    if (blockInfo.next) {
      this.root.blocks[blockInfo.next].parent = id;
    }

    return id;
  }

  async resolveBinding (
    expression: Expression,
    scope: Scope
  ): Promise<Binding | null> {
    if (expression.type === NodeType.FunctionExpression) {
      return this.parseFunction(expression, scope);
    }

    if (expression.type === NodeType.Identifier) {
      return scope.resolve(expression.name);
    }

    if (expression.type !== NodeType.MemberExpression) {
      return null;
    }

    const object = await this.resolveBinding(expression.object, scope);

    if (!object) {
      return null;
    }

    if (object.kind !== 'object') {
      throw new Error('Only objects have members.');
    }

    if (!Object.hasOwn(object.members, expression.property)) {
      throw new Error(`"${expression.property}" is not a member of this object.`);
    }

    return object.members[expression.property];
  }

  async parseCall (
    definition: FunctionBinding,
    expressions: Expression[],
    scope: Scope,
    asValue = false
  ): Promise<ScratchInput> {
    if (expressions.length !== definition.args.length) {
      throw new Error(
        `Function expects ${definition.args.length} arguments, ` +
        `got ${expressions.length}.`
      );
    }

    if (asValue && definition.blockType !== 'reporter' && !definition.returnValue) {
      throw new Error('This function does not return a value.');
    }

    const args: CallArguments = {
      inputs: [],
      fields: [],
      bodies: []
    };

    for (let i = 0; i < definition.args.length; i++) {
      const argument = definition.args[i];
      const expression = expressions[i];
      const literal =
        expression.type === NodeType.StringLiteral ||
        expression.type === NodeType.NumberLiteral ||
        expression.type === NodeType.BooleanLiteral;

      if (
        literal &&
        (typeof argument !== 'number' || expression.type !== NodeType.BooleanLiteral)
      ) {
        args.fields[i] = [expression.value, null];
      }

      if (typeof argument === 'number') {
        if (
          expression.type === NodeType.StringLiteral ||
          expression.type === NodeType.NumberLiteral
        ) {
          args.inputs[i] = [1, [argument, String(expression.value)]];
        } else {
          args.inputs[i] = await this.parseExpression(expression, scope, true);
        }

        continue;
      }

      if (argument === 'body') {
        const callback = await this.resolveBinding(expression, scope);

        if (
          !callback ||
          callback.kind !== 'function' ||
          callback.args.length !== 0 ||
          callback.blockType !== 'command'
        ) {
          throw new Error('Block bodies require a function without parameters.');
        }

        args.bodies[i] = await this.parseCall(callback, [], scope.createChild()) as string;
        continue;
      }

      if (argument === 'broadcast' && definition.blockType !== 'hat' && !literal) {
        args.inputs[i] = await this.parseExpression(expression, scope, true);
        continue;
      }

      if (!literal) {
        throw new Error('Block dropdowns and data names require a literal value.');
      }

      const name = String(expression.value);

      switch (argument) {
        case 'variable':
        case 'writableVariable': {
          const resolved = scope.resolve(name);

          if (!resolved || resolved.kind !== 'variable' || !resolved.storage) {
            throw new Error(`"${name}" is not a variable.`);
          }

          if (argument === 'writableVariable' && !resolved.set) {
            throw new Error(`"${name}" cannot be set.`);
          }

          args.fields[i] = [resolved.storage.name, resolved.storage.id];
          break;
        }
        case 'list': {
          const lists = this.stage.lists;
          const id = Object.keys(lists).find(id => lists[id][0] === name) || uid();
          lists[id] = lists[id] || [name, []];
          args.fields[i] = [name, id];
          break;
        }
        case 'broadcast': {
          const broadcasts = this.stage.broadcasts;
          const id = Object.keys(broadcasts).find(id => broadcasts[id] === name) || uid();
          broadcasts[id] = name;
          args.fields[i] = [name, id];
          args.inputs[i] = [1, [11, name, id]];
          break;
        }
      }
    }

    const block = definition.create(args, this);
    const previous = definition.blockType === 'command' ? scope.lastBlock : null;
    const id = this.insertBlock(block, previous);

    if (definition.blockType === 'hat') {
      return scope.lastBlock;
    }

    if (definition.blockType === 'reporter') {
      return [2, id];
    }

    scope.lastBlock = id;

    if (asValue && definition.returnValue) {
      return definition.returnValue;
    }

    return id;
  }

  async parseSubstack (
    bodyStatements: Statement[],
    parentScope: Scope,
    parentBlockId: string
  ) {
    const childScope = parentScope.createChild();
    childScope.lastBlock = null;
    let firstBlock = null;

    for (const statement of bodyStatements) {
      childScope.lastBlock = await this.parseStatement(statement, childScope) as string;
      if (!firstBlock) {
        firstBlock = childScope.lastBlock;
      }
    }

    if (firstBlock) {
      this.root.blocks[firstBlock].parent = parentBlockId;
    }

    return firstBlock;
  }

  async parseBinaryExpression (
    expr: BinaryExpression,
    scope: Scope
  ): Promise<ScratchInput> {
    const left = await this.parseExpression(expr.left, scope, true);
    const right = await this.parseExpression(expr.right, scope, true);

    switch (expr.operator) {
      case '+': {
        if ((left[1] as number[])[0] === 10 || (right[1] as number[])[0] === 10) {
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
        })];
      }
      case '-': {
        return [2, this.insertBlock({
          opcode: 'operator_subtract',
          inputs: {
            NUM1: left,
            NUM2: right
          }
        })];
      }
      case '*': {
        return [2, this.insertBlock({
          opcode: 'operator_multiply',
          inputs: {
            NUM1: left,
            NUM2: right
          }
        })];
      }
      case '/': {
        return [2, this.insertBlock({
          opcode: 'operator_divide',
          inputs: {
            NUM1: left,
            NUM2: right
          }
        })];
      }
      case '>': {
        return [2, this.insertBlock({
          opcode: 'operator_gt',
          inputs: {
            OPERAND1: left,
            OPERAND2: right
          }
        })];
      }
      case '<': {
        return [2, this.insertBlock({
          opcode: 'operator_lt',
          inputs: {
            OPERAND1: left,
            OPERAND2: right
          }
        })];
      }
      case '==': {
        return [2, this.insertBlock({
          opcode: 'operator_equals',
          inputs: {
            OPERAND1: left,
            OPERAND2: right
          }
        })];
      }
      case '&&': {
        return [2, this.insertBlock({
          opcode: 'operator_and',
          inputs: {
            OPERAND1: left,
            OPERAND2: right
          }
        })];
      }
      case '||': {
        return [2, this.insertBlock({
          opcode: 'operator_or',
          inputs: {
            OPERAND1: left,
            OPERAND2: right
          }
        })];
      }
    }
  }

  async parseUnaryExpression (
    expr: UnaryExpression,
    scope: Scope
  ): Promise<ScratchInput> {
    const value = await this.parseExpression(expr.value, scope, true);

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

  async parseExpression (
    expression: Expression,
    scope: Scope,
    asValue = false
  ): Promise<ScratchInput> {
    switch (expression.type) {
      case NodeType.CallExpression: {
        const binding = await this.resolveBinding(expression.callee, scope);

        if (!binding || binding.kind !== 'function') {
          throw new Error('Expected a function.');
        }

        return this.parseCall(binding, expression.arguments, scope, asValue);
      }
      case NodeType.BinaryExpression: {
        return this.parseBinaryExpression(expression, scope);
      }
      case NodeType.UnaryExpression: {
        return this.parseUnaryExpression(expression, scope);
      }
      case NodeType.StringLiteral: {
        return [1, [10, String(expression.value)]];
      }
      case NodeType.NumberLiteral: {
        return [1, [5, String(expression.value)]];
      }
      case NodeType.BooleanLiteral: {
        const block1 = this.insertBlock({
          opcode: 'operator_not',
          inputs: expression.value ? {} : {
            OPERAND: [2, this.insertBlock({
              opcode: 'operator_not'
            })]
          }
        });
        return [2, block1];
      }
      case NodeType.MemberExpression:
      case NodeType.FunctionExpression:
      case NodeType.Identifier: {
        const binding = await this.resolveBinding(expression, scope);

        if (!binding || binding.kind !== 'variable') {
          throw new Error('Expected a variable.');
        }

        return this.parseCall(binding.get, [], scope, true);
      }
      case NodeType.UpdateExpression: {
        const binding = await this.resolveBinding(expression.argument, scope);

        if (!binding || binding.kind !== 'variable' || !binding.set) {
          throw new Error('This variable cannot be incremented or decremented.');
        }

        return this.parseCall(binding.set, [{
          type: NodeType.BinaryExpression,
          operator: expression.operator === '++' ? '+' : '-',
          left: expression.argument,
          right: {
            type: NodeType.NumberLiteral,
            value: 1
          }
        }], scope);
      }
    }
  }

  async parseStatement (statement: Statement, scope: Scope): Promise<ScratchInput> {
    switch (statement.type) {
      case NodeType.Assignment: {
        const binding = await this.resolveBinding(statement.target, scope);

        if (!binding || binding.kind !== 'variable' || !binding.set) {
          throw new Error('This variable cannot be set.');
        }

        return this.parseCall(binding.set, [statement.value], scope);
      }
      case NodeType.ExpressionStatement: {
        const result = await this.parseExpression(statement.expression, scope);
        return typeof result === 'string' ? result : scope.lastBlock;
      }
      case NodeType.WhileStatement: {
        const test = await this.parseExpression(statement.test, scope, true);
        const whileId = this.insertBlock({
          opcode: 'control_while',
          inputs: {
            CONDITION: test,
            SUBSTACK: [2]
          }
        }, scope.lastBlock);
        const firstBody = await this.parseSubstack(statement.body.body, scope, whileId);
        if (firstBody) {
          this.root.blocks[whileId].inputs.SUBSTACK = [2, firstBody];
        }
        return whileId;
      }
      case NodeType.IfStatement: {
        const test = await this.parseExpression(statement.test, scope, true);
        const hasElse = statement.alternate !== null;
        const ifId = this.insertBlock({
          opcode: hasElse ? 'control_if_else' : 'control_if',
          inputs: {
            CONDITION: test,
            SUBSTACK: [2]
          }
        }, scope.lastBlock);
        const firstCons = await this.parseSubstack(statement.consequent.body, scope, ifId);
        if (firstCons) {
          this.root.blocks[ifId].inputs.SUBSTACK = [2, firstCons];
        }
        if (hasElse) {
          const altBody = statement.alternate.type === NodeType.Block
            ? statement.alternate.body
            : [statement.alternate];
          const firstAlt = await this.parseSubstack(altBody, scope, ifId);
          if (firstAlt) {
            this.root.blocks[ifId].inputs.SUBSTACK2 = [2, firstAlt];
          }
        }
        return ifId;
      }
      case NodeType.RepeatStatement: {
        const count = await this.parseExpression(statement.count, scope, true);
        const repeatId = this.insertBlock({
          opcode: 'control_repeat',
          inputs: {
            TIMES: count,
            SUBSTACK: [2]
          }
        }, scope.lastBlock);
        const firstBody = await this.parseSubstack(statement.body.body, scope, repeatId);
        if (firstBody) {
          this.root.blocks[repeatId].inputs.SUBSTACK = [2, firstBody];
        }
        return repeatId;
      }
      case NodeType.ForStatement: {
        scope.lastBlock = await this.parseStatement(statement.init, scope) as string;

        const test = await this.parseExpression(statement.test, scope, true);
        const whileId = this.insertBlock({
          opcode: 'control_while',
          inputs: {
            CONDITION: test,
            SUBSTACK: [2]
          }
        }, scope.lastBlock);

        const bodyWithUpdate: Statement[] = [
          ...statement.body.body,
          {
            type: NodeType.ExpressionStatement,
            expression: statement.update
          }
        ];
        const firstBody = await this.parseSubstack(bodyWithUpdate, scope, whileId);
        if (firstBody) {
          this.root.blocks[whileId].inputs.SUBSTACK = [2, firstBody];
        }
        return whileId;
      }
      case NodeType.VarDeclaration: {
        if (statement.init) {
          const binding = await this.resolveBinding(statement.init, scope);
          if (binding && binding.kind !== 'variable') {
            scope.define(statement.name, binding);
            return scope.lastBlock;
          }
        }
        const newVarId = uid();
        const variable = scope.defineVariable(statement.name, newVarId, statement.constant);
        this.root.variables[newVarId] = [variable.storage.name, ''];
        if (statement.init) {
          if (
            statement.init.type === NodeType.StringLiteral ||
            statement.init.type === NodeType.NumberLiteral ||
            statement.init.type === NodeType.BooleanLiteral
          ) {
            this.root.variables[newVarId][1] = String(statement.init.value);
            return scope.lastBlock;
          }
          const value = await this.parseExpression(statement.init, scope, true);
          return this.insertBlock({
            opcode: 'data_setvariableto',
            fields: {
              VARIABLE: [variable.storage.name, newVarId]
            },
            inputs: {
              VALUE: value
            }
          }, scope.lastBlock);
        }
        return scope.lastBlock;
      }
      case NodeType.ReturnStatement: {
        if (!scope.isFunction) {
          throw new Error('Return statements can only be used inside of functions.');
        }
        const value = await this.parseExpression(statement.value, scope, true);
        const block1 = this.insertBlock({
          opcode: 'data_setvariableto',
          fields: {
            VARIABLE: ['$', this._returnVar]
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
      case NodeType.ImportStatement: {
        let fileExports: Bindings;
        if (Object.hasOwn(extensions, statement.source)) {
          fileExports = extensions[statement.source];
          if (statement.defaultImport) {
            fileExports = {
              [statement.names[0]]: {
                kind: 'object',
                members: fileExports
              }
            };
          }
          if (!this.extensions.includes(statement.source)) {
            this.extensions.push(statement.source);
          }
        } else {
          const importPath = path.resolve(path.dirname(this._currentFile), statement.source);
          const resolvedPath = importPath.endsWith('.claw') ? importPath : importPath + '.claw';
          if (!this._compiledFiles.has(resolvedPath)) {
            await this.compileFile(resolvedPath);
          }
          fileExports = this._exports[resolvedPath];
          if (!fileExports) {
            throw new Error(`No exports found from "${statement.source}"`);
          }
        }
        for (const name of statement.names) {
          if (!Object.hasOwn(fileExports, name)) {
            throw new Error(`"${name}" is not exported from "${statement.source}"`);
          }
          scope.define(name, fileExports[name]);
        }
        return scope.lastBlock;
      }
      case NodeType.ExportStatement: {
        this._exports[this._currentFile] = this._exports[this._currentFile] || {};
        for (const name of statement.names) {
          const binding = scope.resolve(name);
          if (!binding) {
            throw new Error(`"${name}" is not defined and cannot be exported.`);
          }
          this._exports[this._currentFile][name] = binding;
        }
        return scope.lastBlock;
      }
      case NodeType.FunctionDeclaration: {
        await this.parseFunction(statement, scope);
        return scope.lastBlock;
      }
    }
  }

  async parseFunction (
    expression: FunctionDeclaration | FunctionExpression,
    scope: Scope
  ): Promise<FunctionBinding> {
    const name = expression.type === NodeType.FunctionDeclaration
      ? expression.name
      : `function_${uid.shortUid()}`;
    const args = expression.params;
    const argumentIds = args.map(() => uid());
    const mutation: Mutation = {
      argumentdefaults: JSON.stringify(args.map(() => '""')),
      argumentids: JSON.stringify(argumentIds),
      argumentnames: JSON.stringify(args),
      children: [],
      proccode: name + args.map(() => ' %s').join('') + `@${scope.id}`,
      tagName: 'mutation',
      warp: expression.warp
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
          return [argId, [1, arg]];
        })
      ),
      mutation,
      shadow: true
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
    const binding: FunctionBinding = {
      kind: 'function',
      blockType: 'command',
      args: args.map(() => 10),
      returnValue: [3, [12, '$', this._returnVar], [10, '']],
      create: ({ inputs }) => ({
        opcode: 'procedures_call',
        inputs: Object.fromEntries(argumentIds.map((id, i) => [id, inputs[i]])),
        mutation: {
          argumentids: mutation.argumentids,
          children: [],
          proccode: mutation.proccode,
          tagName: 'mutation',
          warp: mutation.warp
        }
      })
    };

    if (expression.type === NodeType.FunctionDeclaration) {
      scope.define(name, binding);
    }

    await this.parseASTBody(expression.body.body, funcScope);
    return binding;
  }

  async parseASTBody (body: Statement[], scope: Scope) {
    if (!scope.lastBlock) {
      scope.lastBlock = this.insertBlock({
        opcode: 'event_whenflagclicked',
        topLevel: true
      });
    }

    for (const statement of body) {
      scope.lastBlock = await this.parseStatement(statement, scope) as string;
    }
  }

  async compileFile (filePath: string) {
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

    const fileScope = this._globals.createChild();
    await this.parseASTBody(ast.body, fileScope);

    this._currentFile = previousFile;
    return fileScope;
  }

  async compile (filePath: string) {
    const resolvedPath = path.resolve(filePath);
    await this.compileFile(resolvedPath);

    const projectJSON = this.toJSON();
    const emptySVG = fs.readFileSync(
      new URL('./assets/927d672925e7b99f7813735c484c6922.svg', import.meta.url)
    );
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

  generateZip<T extends JSZip.OutputType> (type: T): Promise<ZipOutputs[T]> {
    return this._zip.generateAsync({ type });
  }
}

export default Compiler;
