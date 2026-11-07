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
import CallFrame from './util/call-frame.ts';
import {
  globals,
  extensions
} from './blocks/index.ts';
import meta from '../package.json' with { type: 'json' };
import {
  NodeType,
  type Statement,
  type Block,
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
  type FunctionExpression,
  type VariableBinding
} from './types.ts';

class Compiler {
  targets: Sprite[];
  monitors: Monitor[];
  extensions: string[];
  meta: ProjectMeta;
  stage: Sprite;
  root: Sprite;
  consoleList: string;
  readyBroadcast: string;
  private _zip: JSZip;
  private _exports: Record<string, Bindings>;
  private _compiledFiles: Record<string, 'visiting' | 'done'>;
  private _startup: Scope;
  private _runtimeLists: string[];
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

    this.stage.lists[this.consoleList] = ['console', []];

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
    this._compiledFiles = {};
    this._startup = new Scope();
    this._runtimeLists = [];
    this.readyBroadcast = uid();
    this.stage.broadcasts[this.readyBroadcast] = `$ready@${this.readyBroadcast}`;
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

    for (const [name, input] of Object.entries(this.root.blocks[id].inputs)) {
      if (Array.isArray(input)) {
        const attached: typeof input = [...input];
        this.root.blocks[id].inputs[name] = attached;

        for (let i = 1; i < attached.length; i++) {
          const value = attached[i];

          if (typeof value === 'string' && this.root.blocks[value]) {
            let child = value;

            if (this.root.blocks[child].parent) {
              child = this.insertBlock({
                ...this.root.blocks[child],
                parent: null
              });
            }

            attached[i] = child;
            this.root.blocks[child].parent = id;
          }
        }
      }
    }

    if (blockInfo.next) {
      this.root.blocks[blockInfo.next].parent = id;
    }

    return id;
  }

  append (scope: Scope, block: BlockOptions) {
    const id = this.insertBlock(block, scope.lastBlock);
    scope.firstBlock = scope.firstBlock || id;
    scope.lastBlock = id;
    return id;
  }

  attachSubstack (parent: string, input: string, scope: Scope) {
    this.root.blocks[parent].inputs[input] = [2];

    if (scope.firstBlock) {
      this.root.blocks[parent].inputs[input] = [2, scope.firstBlock];
      this.root.blocks[scope.firstBlock].parent = parent;
    }
  }

  temporary (scope: Scope): VariableBinding {
    if (scope.frame) {
      return scope.frame.variable();
    }

    const id = uid();
    const variable = new Scope().defineVariable('$temporary', id);
    this.root.variables[id] = [variable.storage.name, ''];
    return variable;
  }

  read (variable: VariableBinding): ScratchInput {
    return [2, this.insertBlock(variable.get.create({
      inputs: [],
      fields: [],
      bodies: []
    }, this))];
  }

  write (variable: VariableBinding, value: ScratchInput, scope: Scope) {
    return this.append(scope, variable.set.create({
      inputs: [value],
      fields: [],
      bodies: []
    }, this));
  }

  capture (value: ScratchInput, scope: Scope): ScratchInput {
    const variable = this.temporary(scope);
    this.write(variable, value, scope);
    return this.read(variable);
  }

  not (value: ScratchInput): ScratchInput {
    return [2, this.insertBlock({
      opcode: 'operator_not',
      inputs: {
        OPERAND: value
      }
    })];
  }

  needsFrame (node: Statement | Expression | Block): boolean {
    if (node.type === NodeType.FunctionDeclaration || node.type === NodeType.FunctionExpression) {
      return false;
    }

    if (node.type === NodeType.ExpressionStatement && node.expression.type === NodeType.CallExpression) {
      return node.expression.arguments.some(argument => this.needsFrame(argument));
    }

    if (node.type === NodeType.VarDeclaration || node.type === NodeType.ReturnStatement ||
        node.type === NodeType.CallExpression || node.type === NodeType.UpdateExpression) {
      return true;
    }

    if (node.type === NodeType.BinaryExpression && ['+', '&&', '||'].includes(node.operator)) {
      return true;
    }

    return Object.values(node).some(value => {
      if (Array.isArray(value)) {
        return value.some(child => child && typeof child === 'object' && this.needsFrame(child));
      }

      return value && typeof value === 'object' && this.needsFrame(value);
    });
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
    if (definition.blockType === 'hat' && scope.isFunction) {
      throw new Error('Event handlers must be declared outside functions.');
    }

    if (expressions.length !== definition.args.length) {
      throw new Error(
        `Function expects ${definition.args.length} arguments, ` +
        `got ${expressions.length}.`
      );
    }

    if (asValue && definition.blockType !== 'reporter' && !definition.procedure) {
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

          if ((definition.procedure?.frame && this.needsFrame(expression)) ||
              expressions.slice(i + 1).some(value => this.needsFrame(value))) {
            args.inputs[i] = this.capture(args.inputs[i], scope);
          }
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

        const bodyScope = scope.createChild();
        await this.parseCall(callback, [], bodyScope);
        args.bodies[i] = bodyScope.firstBlock;
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
            throw new Error('This variable cannot be set.');
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

    let frameIndex: ScratchInput;
    const procedure = definition.procedure;

    if (procedure?.frame) {
      frameIndex = procedure.frame.allocate(scope, asValue);
      args.inputs.push(frameIndex);
    }

    if (procedure) {
      for (const name of procedure.captures) {
        args.inputs.push([2, this.insertBlock({
          opcode: 'argument_reporter_string_number',
          fields: {
            VALUE: [name, null]
          }
        })]);
      }
    }

    const block = definition.create(args, this);

    if (definition.blockType === 'hat') {
      this.insertBlock(block);
      return scope.lastBlock;
    }

    if (definition.blockType === 'reporter') {
      return [2, this.insertBlock(block)];
    }

    this.append(scope, block);

    if (procedure?.frame && asValue) {
      return this.capture(procedure.frame.readResult(frameIndex), scope);
    }

    if (asValue && procedure) {
      return [1, [10, '']];
    }

    return scope.lastBlock;
  }

  async parseSubstack (
    bodyStatements: Statement[],
    parentScope: Scope,
    parentBlockId: string
  ) {
    const childScope = parentScope.createChild();
    childScope.lastBlock = null;
    for (const statement of bodyStatements) {
      await this.parseStatement(statement, childScope);
    }

    if (childScope.firstBlock) {
      this.root.blocks[childScope.firstBlock].parent = parentBlockId;
    }

    return childScope.firstBlock;
  }

  async parseBinaryExpression (
    expr: BinaryExpression,
    scope: Scope
  ): Promise<ScratchInput> {
    const arithmetic: Record<string, string> = {
      '+': 'operator_add',
      '-': 'operator_subtract',
      '*': 'operator_multiply',
      '/': 'operator_divide',
      '%': 'operator_mod'
    };
    const comparisons: Record<string, string> = {
      '>': 'operator_gt',
      '<': 'operator_lt',
      '==': 'operator_equals',
      '!=': 'operator_equals',
      '<=': 'operator_gt',
      '>=': 'operator_lt'
    };

    const logical: Record<string, string> = {
      '&&': 'operator_and',
      '||': 'operator_or'
    };

    if (!Object.hasOwn(arithmetic, expr.operator) &&
        !Object.hasOwn(comparisons, expr.operator) &&
        !Object.hasOwn(logical, expr.operator)) {
      throw new Error(`Unsupported binary operator "${expr.operator}".`);
    }

    let left = await this.parseExpression(expr.left, scope, true);

    if (this.needsFrame(expr.right)) {
      left = this.capture(left, scope);
    }

    const right = await this.parseExpression(expr.right, scope, true);

    if (expr.operator === '+' &&
        ((left[1] as number[])[0] === 10 || (right[1] as number[])[0] === 10)) {
      return [2, this.insertBlock({
        opcode: 'operator_join',
        inputs: {
          STRING1: left,
          STRING2: right
        }
      })];
    }

    let result: ScratchInput;

    if (Object.hasOwn(arithmetic, expr.operator)) {
      result = [2, this.insertBlock({
        opcode: arithmetic[expr.operator],
        inputs: {
          NUM1: left,
          NUM2: right
        }
      })];
    } else {
      result = [2, this.insertBlock({
        opcode: comparisons[expr.operator] || logical[expr.operator],
        inputs: {
          OPERAND1: left,
          OPERAND2: right
        }
      })];
    }

    if (['!=', '<=', '>='].includes(expr.operator)) {
      return this.not(result);
    }

    return result;
  }

  async parseUnaryExpression (
    expr: UnaryExpression,
    scope: Scope
  ): Promise<ScratchInput> {
    if (expr.operator !== '!' && expr.operator !== '-') {
      throw new Error(`Unsupported unary operator "${expr.operator}".`);
    }

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

        if (Array.isArray(result)) {
          this.capture(result, scope);
        }

        return scope.lastBlock;
      }
      case NodeType.WhileStatement: {
        const test = await this.parseExpression(statement.test, scope, true);
        const whileId = this.append(scope, {
          opcode: 'control_while',
          inputs: {
            CONDITION: test,
            SUBSTACK: [2]
          }
        });
        const firstBody = await this.parseSubstack(statement.body.body, scope, whileId);
        if (firstBody) {
          this.root.blocks[whileId].inputs.SUBSTACK = [2, firstBody];
        }
        return whileId;
      }
      case NodeType.IfStatement: {
        const test = await this.parseExpression(statement.test, scope, true);
        const hasElse = statement.alternate !== null;
        const ifId = this.append(scope, {
          opcode: hasElse ? 'control_if_else' : 'control_if',
          inputs: {
            CONDITION: test,
            SUBSTACK: [2]
          }
        });
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
        const repeatId = this.append(scope, {
          opcode: 'control_repeat',
          inputs: {
            TIMES: count,
            SUBSTACK: [2]
          }
        });
        const firstBody = await this.parseSubstack(statement.body.body, scope, repeatId);
        if (firstBody) {
          this.root.blocks[repeatId].inputs.SUBSTACK = [2, firstBody];
        }
        return repeatId;
      }
      case NodeType.ForStatement: {
        scope.lastBlock = await this.parseStatement(statement.init, scope) as string;

        const test = await this.parseExpression(statement.test, scope, true);
        const whileId = this.append(scope, {
          opcode: 'control_while',
          inputs: {
            CONDITION: test,
            SUBSTACK: [2]
          }
        });

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
        const value = statement.init
          ? await this.parseExpression(statement.init, scope, true)
          : [1, [10, '']] as ScratchInput;
        const newVarId = uid();
        const variable = scope.defineVariable(statement.name, newVarId);

        if (variable.storage) {
          this.root.variables[newVarId] = [variable.storage.name, ''];
        }

        const assignment = this.write(variable, value, scope);

        if (statement.constant) {
          delete variable.set;
        }

        return assignment;
      }
      case NodeType.ReturnStatement: {
        if (!scope.isFunction) {
          throw new Error('Return statements can only be used inside of functions.');
        }

        const value = statement.value
          ? await this.parseExpression(statement.value, scope, true)
          : [1, [10, '']] as ScratchInput;
        this.write(scope.frame.result, value, scope);
        scope.frame.release(scope.frame.index(), scope);
        return this.append(scope, {
          opcode: 'control_stop',
          fields: {
            STOP_OPTION: ['this script', null]
          },
          mutation: {
            tagName: 'mutation',
            hasnext: false,
            children: []
          }
        });
      }
      case NodeType.ImportStatement: {
        if (scope.parent !== this._globals) {
          throw new Error('Imports are only allowed at module scope.');
        }

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
          const resolvedPath = this.resolveImport(statement.source);
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
        if (scope.parent !== this._globals) {
          throw new Error('Exports are only allowed at module scope.');
        }

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

  createProcedure (name: string, args: string[], warp: boolean) {
    const argumentIds = args.map(() => uid());
    const mutation: Mutation = {
      argumentdefaults: JSON.stringify(args.map(() => '')),
      argumentids: JSON.stringify(argumentIds),
      argumentnames: JSON.stringify(args),
      children: [],
      proccode: name + args.map(() => ' %s').join(''),
      tagName: 'mutation',
      warp
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
    return {
      definition,
      argumentIds,
      mutation
    };
  }

  async parseFunction (
    expression: FunctionDeclaration | FunctionExpression,
    scope: Scope
  ): Promise<FunctionBinding> {
    const name = expression.type === NodeType.FunctionDeclaration
      ? expression.name
      : `function_${uid.shortUid()}`;
    const funcScope = scope.createChild(true);
    funcScope.frame = this.needsFrame(expression.body) ? new CallFrame(this) : null;
    const args = expression.params.map(parameter => `${parameter}@${funcScope.id}`);
    const captures = scope.parameters;
    const hidden = funcScope.frame ? [funcScope.frame.parameter] : [];
    const parameters = [...args, ...hidden, ...captures];
    const { definition, argumentIds, mutation } = this.createProcedure(
      `${name}@${scope.id}`, parameters, expression.warp
    );
    funcScope.lastBlock = definition;
    funcScope.parameters = parameters;
    expression.params.forEach((parameter, i) => funcScope.defineParam(parameter, args[i]));
    const binding: FunctionBinding = {
      kind: 'function',
      blockType: 'command',
      args: args.map(() => 10),
      procedure: {
        frame: funcScope.frame,
        captures
      },
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

    if (funcScope.frame) {
      this.write(funcScope.frame.result, [1, [10, '']], funcScope);
    }

    await this.parseASTBody(expression.body.body, funcScope);

    if (funcScope.frame) {
      funcScope.frame.release(funcScope.frame.index(), funcScope);
      funcScope.frame.compileAllocator();
    }

    return binding;
  }

  async parseASTBody (body: Statement[], scope: Scope) {
    for (const statement of body) {
      await this.parseStatement(statement, scope);
    }
  }

  runtimeList (name: string) {
    const id = uid();
    const list: [string, string] = [`${name}@${id}`, id];
    this.stage.lists[id] = [list[0], []];
    this._runtimeLists.push(id);
    return list;
  }

  resolveImport (source: string) {
    const importPath = path.resolve(path.dirname(this._currentFile), source);
    const resolvedPath = importPath.endsWith('.claw') ? importPath : importPath + '.claw';

    return fs.realpathSync(resolvedPath);
  }

  async compileFile (filePath: string) {
    let scriptData: string;

    try {
      filePath = fs.realpathSync(filePath);
      scriptData = fs.readFileSync(filePath, { encoding: 'utf-8' });
    } catch {
      throw new Error(`Failed to load file: ${filePath}`);
    }

    if (this._compiledFiles[filePath] === 'visiting') {
      throw new Error(`Circular import involving "${filePath}".`);
    }

    if (this._compiledFiles[filePath] === 'done') {
      return;
    }

    if (!this._startup.lastBlock) {
      this.append(this._startup, {
        opcode: 'event_whenflagclicked',
        topLevel: true
      });
    }

    this._compiledFiles[filePath] = 'visiting';
    const previousFile = this._currentFile;
    this._currentFile = filePath;

    try {
      const tokens = new Tokenizer().tokenize(scriptData);
      const ast = new ASTBuilder().build(tokens);

      for (const statement of ast.body) {
        if (statement.type === NodeType.ImportStatement && !Object.hasOwn(extensions, statement.source)) {
          await this.compileFile(this.resolveImport(statement.source));
        }
      }

      const fileScope = this._globals.createChild();
      fileScope.lastBlock = this._startup.lastBlock;
      await this.parseASTBody(ast.body, fileScope);
      this._startup.lastBlock = fileScope.lastBlock;
      this._compiledFiles[filePath] = 'done';
      return fileScope;
    } finally {
      this._currentFile = previousFile;
    }
  }

  async compile (filePath: string) {
    await this.compileFile(path.resolve(filePath));

    const reset = new Scope();

    for (const id of this._runtimeLists) {
      this.append(reset, {
        opcode: 'data_deletealloflist',
        fields: {
          LIST: [this.stage.lists[id][0], id]
        }
      });
    }

    if (reset.firstBlock) {
      const flag = this._startup.firstBlock;
      const next = this.root.blocks[flag].next;
      this.root.blocks[flag].next = reset.firstBlock;
      this.root.blocks[reset.firstBlock].parent = flag;
      this.root.blocks[reset.lastBlock].next = next;

      if (next) {
        this.root.blocks[next].parent = reset.lastBlock;
      } else {
        this._startup.lastBlock = reset.lastBlock;
      }
    }

    this.append(this._startup, {
      opcode: 'event_broadcast',
      inputs: {
        BROADCAST_INPUT: [1, [11, this.stage.broadcasts[this.readyBroadcast], this.readyBroadcast]]
      }
    });

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
