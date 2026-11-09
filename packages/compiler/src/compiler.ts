import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
  arrayMethod,
  arrayMethods,
  internals,
  referenceVariables,
  arrayResults,
  numericFunctions
} from './blocks/categories/arrays.ts';
import listVariable from './util/list-variable.ts';
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
  type Literal,
  type BinaryExpression,
  type ConditionalExpression,
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
  type WhileStatement,
  type RepeatStatement,
  type ForStatement,
  type VariableBinding,
  type Program
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
  arrays: boolean;
  builtins: Scope;
  arrayCallbacks: {
    method: string;
    callback: FunctionBinding;
    binding: FunctionBinding;
  }[];
  private _zip: JSZip;
  private _exports: Record<string, Bindings>;
  private _compiledFiles: Record<string, 'visiting' | 'done'>;
  private _startup: Scope;
  private _runtimeLists: string[];
  private _currentFile: string | null;
  private _globals: Scope;
  private _capturedInputs: Record<string, boolean>;
  private _falsyList: [string, string] | null;
  private _writes: Record<string, boolean>;
  private _booleanInputs: Record<string, boolean>;
  private _arrayInputs: Record<string, ScratchInput>;
  private _programs: Record<string, Program>;
  private _lists: Record<string, [string, string]>;
  private _rootCount: number;
  private _frameSizes: number[];

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
    this.arrays = false;
    this.builtins = null;
    this.arrayCallbacks = [];
    this._lists = {};
    this._rootCount = 0;
    this._frameSizes = [];
    this.readyBroadcast = uid();
    this.stage.broadcasts[this.readyBroadcast] = `$ready@${this.readyBroadcast}`;
    this._currentFile = null;
    this._globals = new Scope();
    this._capturedInputs = {};
    this._falsyList = null;
    this._writes = {};
    this._booleanInputs = {};
    this._arrayInputs = {};
    this._programs = {};
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

  number (value: number): ScratchInput {
    return [1, [4, value]];
  }

  reporter (
    opcode: string,
    inputs: BlockOptions['inputs'] = {},
    fields: BlockOptions['fields'] = {}
  ): ScratchInput {
    return [2, this.insertBlock({
      opcode,
      inputs,
      fields
    })];
  }

  list (name: string) {
    this._lists[name] = this._lists[name] || this.runtimeList(name);
    return this._lists[name];
  }

  registerFrame (size: number) {
    if (!this._frameSizes.includes(size)) {
      this._frameSizes.push(size);
    }

    return this._frameSizes.indexOf(size) + 1;
  }

  async builtin (name: string | FunctionBinding, inputs: ScratchInput[], scope: Scope, asValue = true) {
    const binding = typeof name === 'string' ? this.builtins.resolve(name) as FunctionBinding : name;
    return this.parseCall(binding, [], scope, asValue, inputs);
  }

  async parseBuiltin (source: string, scope: Scope) {
    const program = new ASTBuilder().build(new Tokenizer().tokenize(source));
    return this.parseFunction(program.body[0] as FunctionDeclaration, scope);
  }

  writeReference (variable: VariableBinding, value: ScratchInput, scope: Scope) {
    // Root writes stay inline so assignments cannot yield halfway through
    if (!scope.internal || scope.frame) {
      const index = this.reporter('operator_add', {
        NUM1: this.read(variable),
        NUM2: this.number(5)
      });
      this.write(listVariable(this.list('$objects'), index),
        this.read(this.builtins.resolve('epoch') as VariableBinding), scope);
    }

    this.write(variable, value, scope);
  }

  async clearReference (variable: VariableBinding, scope: Scope) {
    if (scope.internal && !scope.frame) {
      this.write(variable, this.number(0), scope);
      return;
    }

    const block = variable.get.create({
      inputs: [],
      fields: [],
      bodies: []
    }, this);
    const name = block.fields.LIST[1] === this.list('$roots')[1] ? 'clearRoot' : 'clearLocal';
    await this.builtin(name, [block.inputs.INDEX], scope, false);
  }

  attachSubstack (parent: string, input: string, scope: Scope) {
    this.root.blocks[parent].inputs[input] = [2, null];

    if (scope.firstBlock) {
      this.root.blocks[parent].inputs[input] = [2, scope.firstBlock];
      this.root.blocks[scope.firstBlock].parent = parent;
    }
  }

  temporary (scope: Scope, scalar = false): VariableBinding {
    const index = scope.temporaries.next++;
    let variable = scope.temporaries.values[index];

    if (variable) {
      variable.boolean = undefined;
      variable.scalar = scalar;
      return variable;
    }

    if (scope.frame) {
      variable = scope.frame.variable();
    } else {
      const id = uid();
      variable = new Scope().defineVariable('$temporary', id);
      this.root.variables[id] = [variable.storage.name, ''];
      scope.variables.push(variable);
    }

    variable.temporary = true;
    variable.scalar = scalar;
    scope.temporaries.values[index] = variable;
    return variable;
  }

  read (variable: VariableBinding): ScratchInput {
    let value: ScratchInput;

    if (variable.storage && !variable.temporary) {
      value = [3, [12, variable.storage.name, variable.storage.id], [10, '']];
    } else {
      value = [2, this.insertBlock(variable.get.create({
        inputs: [],
        fields: [],
        bodies: []
      }, this))];
    }

    const id = value[1] as string;

    if (variable.temporary) {
      this._capturedInputs[id] = true;
    }

    if (variable.boolean) {
      this._booleanInputs[id] = true;
    }

    if (variable.reference && !variable.scalar) {
      this.tagArray(value, this.read(variable.reference));
    }

    return value;
  }

  arrayReference (value: ScratchInput): ScratchInput {
    return this._arrayInputs[value[1] as string] || [1, [4, 0]];
  }

  isScalar (value: ScratchInput) {
    const reference = this.arrayReference(value);
    return reference[0] === 1 && Array.isArray(reference[1]) && reference[1][1] === 0;
  }

  tagArray (value: ScratchInput, reference: ScratchInput) {
    this._arrayInputs[value[1] as string] = reference;
    return value;
  }

  write (variable: VariableBinding, value: ScratchInput, scope: Scope) {
    if (variable.temporary) {
      variable.boolean = variable.boolean !== false && this.isBoolean(value);
    }

    if (this.arrays && !variable.scalar && !variable.reference && variable.storage) {
      variable.reference = listVariable(this.list('$roots'), this.number(++this._rootCount));
    }

    const reference = variable.reference;

    if (reference) {
      this.writeReference(reference, this.arrayReference(value), scope);
    }

    return this.append(scope, variable.set.create({
      inputs: [value],
      fields: [],
      bodies: []
    }, this));
  }

  capture (value: ScratchInput, scope: Scope): ScratchInput {
    if (value[0] === 1 && Array.isArray(value[1])) {
      return value;
    }

    if (value[0] === 2 && this._capturedInputs[value[1] as string]) {
      return value;
    }

    const variable = this.temporary(scope, this.isScalar(value));
    this.write(variable, value, scope);
    return this.read(variable);
  }

  isBoolean (value: ScratchInput): boolean {
    if (this._booleanInputs[value[1] as string]) {
      return true;
    }

    if (value[0] !== 2) {
      return false;
    }

    const id = value[1] as string;

    return [
      'operator_lt',
      'operator_gt',
      'operator_equals',
      'operator_and',
      'operator_or',
      'operator_not',
      'operator_contains',
      'data_listcontainsitem',
      'sensing_touchingobject',
      'sensing_touchingcolor',
      'sensing_coloristouchingcolor',
      'sensing_keypressed',
      'sensing_mousedown',
      'sensing_loud'
    ].includes(this.root.blocks[id].opcode);
  }

  boolean (value: ScratchInput): ScratchInput {
    if (value[0] === 1 && Array.isArray(value[1])) {
      return this.booleanLiteral(this.truthy(value[1][1] as Literal['value']));
    }

    if (this._booleanInputs[value[1] as string]) {
      return [2, this.insertBlock({
        opcode: 'operator_equals',
        inputs: {
          OPERAND1: value,
          OPERAND2: [1, [10, 'true']]
        }
      })];
    }

    if (this.isBoolean(value)) {
      return value;
    }

    if (!this._falsyList) {
      const id = uid();
      this._falsyList = [`$falsy@${id}`, id];
      this.stage.lists[id] = [this._falsyList[0], ['#', '#0', '#false']];
    }

    // The prefix makes zero strings compare as text
    return this.not([2, this.insertBlock({
      opcode: 'data_listcontainsitem',
      fields: {
        LIST: this._falsyList
      },
      inputs: {
        ITEM: [2, this.insertBlock({
          opcode: 'operator_join',
          inputs: {
            STRING1: [1, [10, '#']],
            STRING2: value
          }
        })]
      }
    })]);
  }

  not (value: ScratchInput): ScratchInput {
    return [2, this.insertBlock({
      opcode: 'operator_not',
      inputs: {
        OPERAND: value
      }
    })];
  }

  booleanLiteral (value: boolean): ScratchInput {
    return [2, this.insertBlock({
      opcode: 'operator_not',
      inputs: value ? {} : {
        OPERAND: [2, this.insertBlock({ opcode: 'operator_not' })]
      }
    })];
  }

  constantValue (expression: Expression, scope: Scope): Literal | null {
    if (expression.type === NodeType.NumberLiteral ||
        expression.type === NodeType.StringLiteral ||
        expression.type === NodeType.BooleanLiteral) {
      return expression;
    }

    // shortcut: function reads stay dynamic, track initialization before folding captures
    if (expression.type === NodeType.Identifier && !scope.isFunction) {
      const binding = scope.resolve(expression.name);
      return binding?.kind === 'variable' ? binding.constantValue || null : null;
    }

    return null;
  }

  truthy (value: Literal['value']): boolean {
    return Boolean(value) && value !== '0' && String(value).toLowerCase() !== 'false';
  }

  scanWrites (node: Statement | Expression | Block) {
    if (node.type === NodeType.Assignment && node.target.type === NodeType.Identifier) {
      const value = node.value;
      const boolean = !node.operator && (value.type === NodeType.BooleanLiteral ||
        (value.type === NodeType.UnaryExpression && value.operator === '!') ||
        (value.type === NodeType.BinaryExpression &&
          ['==', '!=', '<', '>', '<=', '>=', '&&', '||'].includes(value.operator)));
      this._writes[node.target.name] = this._writes[node.target.name] !== false && boolean;
    }

    if (node.type === NodeType.UpdateExpression && node.argument.type === NodeType.Identifier) {
      this._writes[node.argument.name] = false;
    }

    if (node.type === NodeType.ExportStatement) {
      for (const name of node.names) {
        this._writes[name] = false;
      }
    }

    for (const value of Object.values(node).flat()) {
      if (value && typeof value === 'object') {
        this.scanWrites(value);
      }
    }
  }

  additionOpcode (expression: BinaryExpression) {
    const operands = [expression.left, expression.right];

    if (operands.every(value => value.type === NodeType.NumberLiteral)) {
      return 'operator_add';
    }

    if (operands.some(value => value.type === NodeType.StringLiteral &&
        (value.value.trim() === '' || Number.isNaN(Number(value.value))))) {
      return 'operator_join';
    }

    return null;
  }

  needsFrame (node: Statement | Expression | Block, asValue = true, scope?: Scope): boolean {
    if (node.type === NodeType.FunctionDeclaration || node.type === NodeType.FunctionExpression) {
      return false;
    }

    if (node.type === NodeType.ConditionalExpression) {
      if (node.test.type === NodeType.BooleanLiteral) {
        return this.needsFrame(node.test.value ? node.consequent : node.alternate, asValue, scope);
      }

      return asValue || this.needsFrame(node.test, true, scope) ||
        this.needsFrame(node.consequent, asValue, scope) ||
        this.needsFrame(node.alternate, asValue, scope);
    }

    if (node.type === NodeType.ExpressionStatement) {
      return this.needsFrame(node.expression, false, scope);
    }

    if (scope?.internal && node.type === NodeType.CallExpression &&
        node.callee.type === NodeType.MemberExpression &&
        node.callee.object.type === NodeType.Identifier) {
      const object = scope.resolve(node.callee.object.name);
      const member = object?.kind === 'object' ? object.members[node.callee.property] : null;

      if (member?.kind === 'function' && member.blockType === 'reporter') {
        return node.arguments.some(argument => this.needsFrame(argument, true, scope));
      }
    }

    if (node.type === NodeType.CallExpression && !asValue) {
      return node.arguments.some(argument => this.needsFrame(argument, true, scope));
    }

    if (node.type === NodeType.VarDeclaration || node.type === NodeType.ReturnStatement ||
        node.type === NodeType.BreakStatement || node.type === NodeType.ContinueStatement ||
        node.type === NodeType.CallExpression || node.type === NodeType.UpdateExpression ||
        node.type === NodeType.ArrayExpression || node.type === NodeType.IndexExpression ||
        (node.type === NodeType.MemberExpression && node.property === 'length')) {
      return true;
    }

    if (node.type === NodeType.BinaryExpression) {
      if (node.operator === '&&' || node.operator === '||') {
        return true;
      }

      if (node.operator === '+' && !this.additionOpcode(node)) {
        return true;
      }
    }

    return Object.values(node).some(value => {
      if (Array.isArray(value)) {
        return value.some(child => {
          return child && typeof child === 'object' && this.needsFrame(child, true, scope);
        });
      }

      return value && typeof value === 'object' && this.needsFrame(value, true, scope);
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
      return null;
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
    asValue = false,
    values?: ScratchInput[]
  ): Promise<ScratchInput> {
    if (definition.blockType === 'hat' && scope.isFunction) {
      throw new Error('Event handlers must be declared outside functions.');
    }

    const count = (values || expressions).length;

    if (count !== definition.args.length) {
      throw new Error(
        `Function expects ${definition.args.length} arguments, ` +
        `got ${count}.`
      );
    }

    if (definition.compile) {
      const compile = definition.compile;
      delete definition.compile;
      await compile();
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

      if (values && typeof argument === 'number') {
        args.inputs[i] = values[i];

        if (this.arrays && definition.procedure && !scope.internal && !this.isScalar(args.inputs[i])) {
          args.inputs[i] = this.capture(args.inputs[i], scope);
        }

        continue;
      }
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

          if ((definition.procedure?.frame && this.needsFrame(expression, true, scope)) ||
              expressions.slice(i + 1).some(value => this.needsFrame(value, true, scope)) ||
              (this.arrays && definition.procedure && !scope.internal && !this.isScalar(args.inputs[i]))) {
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
        case 'variable': {
          const resolved = scope.resolve(name);

          if (!resolved || resolved.kind !== 'variable' || !resolved.storage) {
            throw new Error(`"${name}" is not a variable.`);
          }

          args.fields[i] = [resolved.storage.name, resolved.storage.id];
          break;
        }
        case 'list': {
          if (name.startsWith('$')) {
            if (!scope.internal) {
              throw new Error('Compiler lists are private.');
            }

            args.fields[i] = this.list(name);
            break;
          }

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

    if (this.arrays && procedure) {
      args.inputs.push(...args.inputs
        .filter((_, index) => definition.args[index] === 10)
        .map(value => this.arrayReference(value)));
    }

    if (procedure?.frame) {
      frameIndex = await procedure.frame.allocate(scope);
      args.inputs.push(frameIndex);
    }

    if (this.arrays && procedure) {
      args.inputs.push(scope.thread || frameIndex || [1, [10, scope.id]]);
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

    if (!scope.internal && block.opcode === 'sensing_of' &&
        String(block.fields.PROPERTY[0]).startsWith('$')) {
      throw new Error('Compiler variables are private.');
    }

    if (this.arrays && !scope.internal) {
      if (block.opcode === 'control_delete_this_clone') {
        return this.builtin('deleteClone', [], scope, false);
      }

      if (block.opcode === 'control_stop' && block.fields.STOP_OPTION[0] === 'other scripts in sprite') {
        return this.builtin('stopOthers', [], scope, false);
      }
    }

    if (definition.blockType === 'hat') {
      this.insertBlock(block);

      if (scope.temporaries.next) {
        // Hat inputs can outlive the statement that declares them
        scope.temporaries.values = scope.temporaries.values.slice(scope.temporaries.next);
        scope.temporaries.next = 0;
      }

      return scope.lastBlock;
    }

    if (definition.blockType === 'reporter') {
      const value: ScratchInput = [2, this.insertBlock(block)];

      if (definition.reference) {
        this.tagArray(value, definition.reference(args, this));
      }

      return value;
    }

    if (block.opcode === 'control_delete_this_clone' ||
        (block.opcode === 'control_stop' && block.mutation.hasnext === false)) {
      // End blocks need a branch so later commands can connect
      const branch = this.append(scope, {
        opcode: 'control_if',
        inputs: {
          CONDITION: [2, this.insertBlock({ opcode: 'operator_not' })]
        }
      });
      const body = scope.createChild();
      this.append(body, block);
      this.attachSubstack(branch, 'SUBSTACK', body);
    } else {
      this.append(scope, block);
    }

    if (procedure?.frame) {
      const result = asValue ? this.capture(procedure.frame.readResult(frameIndex), scope) : null;
      await procedure.frame.release(scope, frameIndex);
      return result || scope.lastBlock;
    }

    if (definition.shared) {
      const result = asValue ? this.capture(this.read(procedure.result), scope) : null;

      for (const variable of procedure.variables) {
        if (variable.reference && !variable.scalar) {
          await this.clearReference(variable.reference, scope);
        }
      }

      if (definition.shared === 'locked') {
        // Copy the shared result before releasing the lock
        await this.builtin('leave', [], scope, false);
      }

      return result || scope.lastBlock;
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
    await this.parseASTBody(bodyStatements, childScope);
    await this.releaseScope(childScope);

    if (childScope.firstBlock) {
      this.root.blocks[childScope.firstBlock].parent = parentBlockId;
    }

    return childScope.firstBlock;
  }

  async parseBinaryExpression (
    expr: BinaryExpression,
    scope: Scope,
    inputs?: [ScratchInput, ScratchInput]
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

    if (!Object.hasOwn(arithmetic, expr.operator) &&
        !Object.hasOwn(comparisons, expr.operator) &&
        expr.operator !== '&&' && expr.operator !== '||') {
      throw new Error(`Unsupported binary operator "${expr.operator}".`);
    }

    let left = inputs ? inputs[0] : await this.parseExpression(expr.left, scope, true);

    if (expr.operator === '&&' || expr.operator === '||') {
      const rightScope = scope.createChild();
      const right = await this.parseExpression(expr.right, rightScope, true);

      if (scope.internal && !rightScope.firstBlock) {
        return [2, this.insertBlock({
          opcode: expr.operator === '&&' ? 'operator_and' : 'operator_or',
          inputs: {
            OPERAND1: this.boolean(left),
            OPERAND2: this.boolean(right)
          }
        })];
      }

      const result = this.temporary(scope);
      this.write(result, this.boolean(left), scope);
      let condition = this.boolean(this.read(result));

      if (expr.operator === '||') {
        condition = this.not(condition);
      }

      const branch = this.append(scope, {
        opcode: 'control_if',
        inputs: {
          CONDITION: condition
        }
      });
      this.write(result, this.boolean(right), rightScope);
      this.attachSubstack(branch, 'SUBSTACK', rightScope);
      return this.read(result);
    }

    let sum: VariableBinding;
    let addition = expr.operator === '+' ? this.additionOpcode(expr) : null;

    if (expr.operator === '+' && scope.internal) {
      addition = 'operator_add';
    }

    if (expr.operator === '+' && !addition) {
      sum = this.temporary(scope);
      this.write(sum, left, scope);
      left = this.read(sum);
    } else if (this.needsFrame(expr.right, true, scope)) {
      left = this.capture(left, scope);
    }

    let right = inputs ? inputs[1] : await this.parseExpression(expr.right, scope, true);

    if (sum) {
      right = this.capture(right, scope);
      // Numeric strings add, other text concatenates
      const numeric = [left, right].map(value => [2, this.insertBlock({
        opcode: 'operator_equals',
        inputs: {
          OPERAND1: value,
          OPERAND2: [2, this.insertBlock({
            opcode: 'operator_add',
            inputs: {
              NUM1: value,
              NUM2: [1, [4, 0]]
            }
          })]
        }
      })] as ScratchInput);
      const branch = this.append(scope, {
        opcode: 'control_if_else',
        inputs: {
          CONDITION: [2, this.insertBlock({
            opcode: 'operator_and',
            inputs: {
              OPERAND1: numeric[0],
              OPERAND2: numeric[1]
            }
          })]
        }
      });

      for (const [substack, opcode, input] of [
        ['SUBSTACK', 'operator_add', 'NUM'],
        ['SUBSTACK2', 'operator_join', 'STRING']
      ]) {
        const branchScope = scope.createChild();
        this.write(sum, [2, this.insertBlock({
          opcode,
          inputs: {
            [input + '1']: left,
            [input + '2']: right
          }
        })], branchScope);
        this.attachSubstack(branch, substack, branchScope);
      }

      return this.read(sum);
    }

    let result: ScratchInput;

    if (addition === 'operator_join') {
      return [2, this.insertBlock({
        opcode: addition,
        inputs: {
          STRING1: left,
          STRING2: right
        }
      })];
    }

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
        opcode: comparisons[expr.operator],
        inputs: {
          OPERAND1: left,
          OPERAND2: right
        }
      })];
    }

    if (this.arrays && (expr.operator === '==' || expr.operator === '!=') &&
        (!this.isScalar(left) || !this.isScalar(right))) {
      result = [2, this.insertBlock({
        opcode: 'operator_and',
        inputs: {
          OPERAND1: result,
          OPERAND2: [2, this.insertBlock({
            opcode: 'operator_equals',
            inputs: {
              OPERAND1: this.arrayReference(left),
              OPERAND2: this.arrayReference(right)
            }
          })]
        }
      })];
    }

    if (['!=', '<=', '>='].includes(expr.operator)) {
      return this.not(result);
    }

    return result;
  }

  async parseConditionalExpression (
    expression: ConditionalExpression,
    scope: Scope,
    asValue: boolean
  ): Promise<ScratchInput> {
    const constant = this.constantValue(expression.test, scope);

    if (constant) {
      const selected = this.truthy(constant.value) ? expression.consequent : expression.alternate;
      return this.parseExpression(selected, scope, asValue);
    }

    const test = await this.parseExpression(expression.test, scope, true);
    const result = asValue ? this.temporary(scope) : null;
    const branch = this.append(scope, {
      opcode: 'control_if_else',
      inputs: {
        CONDITION: this.boolean(test)
      }
    });

    for (const [input, selected] of [
      ['SUBSTACK', expression.consequent],
      ['SUBSTACK2', expression.alternate]
    ] as const) {
      const branchScope = scope.createChild();

      if (result) {
        const value = await this.parseExpression(selected, branchScope, true);
        this.write(result, value, branchScope);
      } else {
        await this.parseStatement({
          type: NodeType.ExpressionStatement,
          expression: selected
        }, branchScope);
      }

      this.attachSubstack(branch, input, branchScope);
    }

    return result ? this.read(result) : scope.lastBlock;
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
      return this.not(this.boolean(value));
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
    const constant = this.constantValue(expression, scope);

    if (constant && constant !== expression) {
      return this.parseExpression(constant, scope, asValue);
    }

    switch (expression.type) {
      case NodeType.ArrayExpression: {
        const array = await this.builtin('create', [this.number(expression.elements.length)], scope);

        for (const element of expression.elements) {
          const value = await this.parseExpression(element, scope, true);
          await this.builtin('push', [array, value], scope, false);
        }

        return array;
      }
      case NodeType.IndexExpression: {
        const array = this.capture(await this.parseExpression(expression.object, scope, true), scope);
        const index = await this.parseExpression(expression.index, scope, true);
        return this.builtin('get', [array, index], scope);
      }
      case NodeType.CallExpression: {
        const binding = await this.resolveBinding(expression.callee, scope);

        if (!binding || binding.kind !== 'function') {
          if (this.arrays && expression.callee.type === NodeType.MemberExpression) {
            return arrayMethod(this, expression.callee.object, expression.callee.property,
              expression.arguments, scope, asValue);
          }

          throw new Error('Expected a function.');
        }

        return this.parseCall(binding, expression.arguments, scope, asValue);
      }
      case NodeType.BinaryExpression: {
        return this.parseBinaryExpression(expression, scope);
      }
      case NodeType.ConditionalExpression: {
        return this.parseConditionalExpression(expression, scope, asValue);
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
        return this.booleanLiteral(expression.value);
      }
      case NodeType.MemberExpression:
      case NodeType.FunctionExpression:
      case NodeType.Identifier: {
        const binding = await this.resolveBinding(expression, scope);

        if (!binding || binding.kind !== 'variable') {
          if (this.arrays && expression.type === NodeType.MemberExpression &&
              expression.property === 'length') {
            const array = await this.parseExpression(expression.object, scope, true);
            return this.builtin('length', [array], scope);
          }

          throw new Error('Expected a variable.');
        }

        const value = this.read(binding);

        if (binding.boolean) {
          this._booleanInputs[value[1] as string] = true;
        }

        return value;
      }
      case NodeType.UpdateExpression: {
        if (expression.argument.type === NodeType.IndexExpression ||
            (expression.argument.type === NodeType.MemberExpression &&
              expression.argument.property === 'length' &&
              !(await this.resolveBinding(expression.argument, scope)))) {
          const target = expression.argument;
          const array = this.capture(await this.parseExpression(target.object, scope, true), scope);
          const index = target.type === NodeType.IndexExpression
            ? this.capture(await this.parseExpression(target.index, scope, true), scope)
            : null;
          const old = await this.builtin(index ? 'get' : 'length',
            index ? [array, index] : [array], scope);
          const value: ScratchInput = [2, this.insertBlock({
            opcode: expression.operator === '++' ? 'operator_add' : 'operator_subtract',
            inputs: {
              NUM1: old,
              NUM2: [1, [4, 1]]
            }
          })];
          await this.builtin(index ? 'set' : 'resize',
            index ? [array, index, value] : [array, value], scope, false);
          return asValue ? old : scope.lastBlock;
        }

        const binding = await this.resolveBinding(expression.argument, scope);

        if (!binding || binding.kind !== 'variable' || !binding.set) {
          throw new Error('This variable cannot be incremented or decremented.');
        }

        if (expression.operator !== '++' && expression.operator !== '--') {
          throw new Error(`Unsupported update operator "${expression.operator}".`);
        }

        let oldValue = this.read(binding);

        if (asValue) {
          oldValue = this.capture([2, this.insertBlock({
            opcode: 'operator_add',
            inputs: {
              NUM1: oldValue,
              NUM2: [1, [4, '0']]
            }
          })], scope);
        }

        this.append(scope, binding.set.create({
          inputs: [[2, this.insertBlock({
            opcode: expression.operator === '++' ? 'operator_add' : 'operator_subtract',
            inputs: {
              NUM1: oldValue,
              NUM2: [1, [4, '1']]
            }
          })]],
          fields: [],
          bodies: []
        }, this));
        return asValue ? oldValue : scope.lastBlock;
      }
    }
  }

  hasLoopControl (body: Statement[]): boolean {
    return body.some(statement => {
      if (statement.type === NodeType.BreakStatement ||
          statement.type === NodeType.ContinueStatement) {
        return true;
      }

      if (statement.type === NodeType.IfStatement) {
        let alternate: Statement[] = [];

        if (statement.alternate) {
          alternate = statement.alternate.type === NodeType.Block
            ? statement.alternate.body
            : [statement.alternate];
        }

        return this.hasLoopControl(statement.consequent.body) || this.hasLoopControl(alternate);
      }

      return false;
    });
  }

  async parseLoop (
    statement: WhileStatement | RepeatStatement | ForStatement,
    scope: Scope
  ) {
    const body = statement.body.body;
    const hasControl = this.hasLoopControl(body);

    if (statement.type === NodeType.RepeatStatement && !hasControl) {
      const count = await this.parseExpression(statement.count, scope, true);
      const loop = this.append(scope, {
        opcode: 'control_repeat',
        inputs: {
          TIMES: count,
          SUBSTACK: [2, null]
        }
      });
      const firstBody = await this.parseSubstack(body, scope, loop);

      if (firstBody) {
        this.root.blocks[loop].inputs.SUBSTACK = [2, firstBody];
      }

      return loop;
    }

    const state = hasControl ? this.temporary(scope) : null;
    const bodyScope = scope.createChild();
    bodyScope.loopState = state;
    let count: VariableBinding;
    let testExpression: Expression;
    let test: ScratchInput;
    let condition: VariableBinding;

    if (state) {
      // 0 runs the body, 1 skips to the next iteration, 2 exits the loop
      this.write(state, [1, [4, 0]], scope);
    }

    const previous = scope.lastBlock;

    if (statement.type === NodeType.RepeatStatement) {
      const value = await this.parseExpression(statement.count, scope, true);
      count = this.temporary(scope);
      this.write(count, [2, this.insertBlock({
        opcode: 'operator_round',
        inputs: { NUM: value }
      })], scope);
      test = [2, this.insertBlock({
        opcode: 'operator_gt',
        inputs: {
          OPERAND1: this.read(count),
          OPERAND2: [1, [4, 0]]
        }
      })];
    } else {
      testExpression = statement.test;
      test = this.boolean(await this.parseExpression(testExpression, scope, true));

      if (scope.lastBlock !== previous) {
        condition = this.temporary(scope);
        this.write(condition, test, scope);
        test = this.boolean(this.read(condition));
      }
    }

    let running: ScratchInput;

    if (state) {
      running = [2, this.insertBlock({
        opcode: 'operator_lt',
        inputs: {
          OPERAND1: this.read(state),
          OPERAND2: [1, [4, 2]]
        }
      })];
      test = [2, this.insertBlock({
        opcode: 'operator_and',
        inputs: {
          OPERAND1: running,
          OPERAND2: test
        }
      })];
    }

    const loop = this.append(scope, {
      opcode: 'control_while',
      inputs: {
        CONDITION: test
      }
    });

    if (state) {
      this.write(state, [1, [4, 0]], bodyScope);
    }

    await this.parseASTBody(body, bodyScope);
    await this.releaseScope(bodyScope);

    const lastBlock = bodyScope.lastBlock && this.root.blocks[bodyScope.lastBlock];

    if (!lastBlock || lastBlock.opcode !== 'control_stop' || lastBlock.mutation?.hasnext !== false) {
      // Use loop bindings for updates and conditions
      const tailScope = scope.createChild();
      tailScope.lastBlock = state ? null : bodyScope.lastBlock;

      if (statement.type === NodeType.ForStatement) {
        await this.parseStatement(statement.update, tailScope);
      }

      if (count) {
        this.write(count, [2, this.insertBlock({
          opcode: 'operator_subtract',
          inputs: {
            NUM1: this.read(count),
            NUM2: [1, [4, 1]]
          }
        })], tailScope);
      }

      if (condition) {
        const nextTest = await this.parseExpression(testExpression, tailScope, true);
        this.write(condition, this.boolean(nextTest), tailScope);
      }

      if (state && tailScope.firstBlock) {
        const guard = this.append(bodyScope, {
          opcode: 'control_if',
          inputs: { CONDITION: running }
        });
        this.attachSubstack(guard, 'SUBSTACK', tailScope);
      }

      bodyScope.firstBlock = bodyScope.firstBlock || tailScope.firstBlock;
    }

    this.attachSubstack(loop, 'SUBSTACK', bodyScope);
    return loop;
  }

  async parseStatement (statement: Statement, scope: Scope): Promise<ScratchInput> {
    switch (statement.type) {
      case NodeType.Assignment: {
        if (statement.target.type === NodeType.IndexExpression ||
            (statement.target.type === NodeType.MemberExpression &&
              !(await this.resolveBinding(statement.target, scope)))) {
          const target = statement.target;

          if (target.type === NodeType.MemberExpression && target.property !== 'length') {
            throw new Error('Only array.length can be assigned.');
          }

          const array = this.capture(await this.parseExpression(target.object, scope, true), scope);
          const index = target.type === NodeType.IndexExpression
            ? this.capture(await this.parseExpression(target.index, scope, true), scope)
            : null;
          let old: ScratchInput;

          if (statement.operator) {
            old = await this.builtin(index ? 'get' : 'length',
              index ? [array, index] : [array], scope);
          }

          let value = await this.parseExpression(statement.value, scope, true);

          if (statement.operator) {
            value = await this.parseBinaryExpression({
              type: NodeType.BinaryExpression,
              operator: statement.operator,
              left: statement.target,
              right: statement.value
            }, scope, [old, value]);
          }

          return this.builtin(index ? 'set' : 'resize',
            index ? [array, index, value] : [array, value], scope, false);
        }

        const binding = await this.resolveBinding(statement.target, scope);

        if (!binding || binding.kind !== 'variable' || !binding.set) {
          throw new Error('This variable cannot be set.');
        }

        const expression: Expression = statement.operator ? {
          type: NodeType.BinaryExpression,
          operator: statement.operator,
          left: statement.target,
          right: statement.value
        } : statement.value;
        const value = await this.parseExpression(expression, scope, true);
        return this.write(binding, value, scope);
      }
      case NodeType.ExpressionStatement: {
        const result = await this.parseExpression(statement.expression, scope);

        if (Array.isArray(result)) {
          this.capture(result, scope);
        }

        return scope.lastBlock;
      }
      case NodeType.BreakStatement:
      case NodeType.ContinueStatement: {
        const keyword = statement.type === NodeType.BreakStatement ? 'break' : 'continue';

        if (!scope.loopState) {
          throw new Error(`"${keyword}" can only be used inside a loop.`);
        }

        const value = statement.type === NodeType.BreakStatement ? 2 : 1;
        return this.write(scope.loopState, [1, [4, value]], scope);
      }
      case NodeType.WhileStatement:
      case NodeType.RepeatStatement: {
        return this.parseLoop(statement, scope);
      }
      case NodeType.IfStatement: {
        if (scope.internal && statement.test.type === NodeType.MemberExpression &&
            statement.test.object.type === NodeType.Identifier &&
            statement.test.object.name === 'compiler' && statement.test.property === 'arrays') {
          if (this.arrays) {
            const branch = scope.createChild();
            branch.lastBlock = scope.lastBlock;
            await this.parseASTBody(statement.consequent.body, branch);
            await this.releaseScope(branch);
            scope.firstBlock = scope.firstBlock || branch.firstBlock;
            scope.lastBlock = branch.lastBlock;
          }

          return scope.lastBlock;
        }

        const test = await this.parseExpression(statement.test, scope, true);
        const hasElse = statement.alternate !== null;
        const ifId = this.append(scope, {
          opcode: hasElse ? 'control_if_else' : 'control_if',
          inputs: {
            CONDITION: this.boolean(test),
            SUBSTACK: [2, null]
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
      case NodeType.ForStatement: {
        const forScope = scope.createChild();
        forScope.lastBlock = scope.lastBlock;
        await this.parseStatement(statement.init, forScope);
        await this.parseLoop(statement, forScope);
        await this.releaseScope(forScope);
        scope.firstBlock = scope.firstBlock || forScope.firstBlock;
        scope.lastBlock = forScope.lastBlock;
        return scope.lastBlock;
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
        variable.scalar = scope.internal && !scope.referenceVariables.includes(statement.name);
        variable.boolean = this._writes[statement.name] !== false && this.isBoolean(value);

        if (!Object.hasOwn(this._writes, statement.name) && statement.init) {
          variable.constantValue = this.constantValue(statement.init, scope) || undefined;
        }

        if (variable.storage) {
          const target = scope.internal && !scope.isFunction ? this.stage : this.root;
          target.variables[newVarId] = [variable.storage.name, ''];
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
        this.write(scope.result, value, scope);
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
    let create: FunctionBinding['create'];
    const binding: FunctionBinding = {
      kind: 'function',
      blockType: 'command',
      args: expression.params.map(() => 10),
      create: (args, compiler) => create(args, compiler),
      compile: async () => {
        const funcScope = scope.createChild(true);
        funcScope.frame = !binding.shared && (this.arrays || this.needsFrame(expression.body))
          ? new CallFrame(this)
          : null;
        funcScope.referenceVariables = binding.referenceVariables || [];

        if (funcScope.frame) {
          funcScope.frame.result.scalar = binding.scalar;
          funcScope.result = funcScope.frame.result;
        } else if (binding.shared) {
          funcScope.result = funcScope.defineVariable('$result', uid());
          funcScope.result.scalar = binding.scalar;
          const storage = funcScope.result.storage;
          this.root.variables[storage.id] = [storage.name, ''];
        }

        const args = expression.params.map(parameter => `${parameter}@${funcScope.id}`);
        const references = args.map((parameter, index) => {
          return this.arrays && binding.args[index] === 10 ? `${parameter}@reference` : null;
        });
        const thread = this.arrays ? [`$thread@${funcScope.id}`] : [];
        const captures = scope.parameters;
        const hidden = funcScope.frame ? [funcScope.frame.parameter] : [];
        const parameters = [...args, ...references.filter(Boolean), ...hidden, ...thread, ...captures];
        const { definition, argumentIds, mutation } = this.createProcedure(
          `${name}@${scope.id}`, parameters, expression.warp
        );
        funcScope.lastBlock = definition;
        funcScope.parameters = parameters;
        funcScope.thread = this.arrays ? [2, this.insertBlock({
          opcode: 'argument_reporter_string_number',
          fields: { VALUE: [thread[0], null] }
        })] : null;
        expression.params.forEach((parameter, i) => {
          funcScope.defineParam(parameter, args[i], references[i]);
        });

        if (scope.internal && this.arrays) {
          funcScope.defineParam('thread', thread[0]);
        }

        binding.procedure = {
          frame: funcScope.frame,
          captures,
          result: funcScope.result,
          variables: funcScope.variables
        };
        create = ({ inputs }) => ({
          opcode: 'procedures_call',
          inputs: Object.fromEntries(argumentIds.map((id, i) => [id, inputs[i]])),
          mutation: {
            argumentids: mutation.argumentids,
            children: [],
            proccode: mutation.proccode,
            tagName: 'mutation',
            warp: mutation.warp
          }
        });

        if (funcScope.frame) {
          this.write(funcScope.result, [1, [10, '']], funcScope);
        }

        await this.parseASTBody(expression.body.body, funcScope);

        funcScope.frame?.finalize();
      }
    };

    if (scope.internal) {
      binding.scalar = !arrayResults.includes(name);
      binding.referenceVariables = referenceVariables[name] || [];

      if (numericFunctions.includes(name)) {
        binding.args = expression.params.map(() => 4);
      }

      if (!['joinValue', 'stopOthers', 'deleteClone', 'transform'].includes(name)) {
        binding.shared = 'helper';
        const first = expression.body.body[0];

        if (first?.type === NodeType.ExpressionStatement &&
            first.expression.type === NodeType.CallExpression &&
            first.expression.callee.type === NodeType.Identifier &&
            first.expression.callee.name === 'enter') {
          binding.shared = 'locked';
        }
      }
    }

    if (expression.type === NodeType.FunctionDeclaration) {
      scope.define(name, binding);
    }

    return binding;
  }

  async parseASTBody (body: Statement[], scope: Scope) {
    for (let i = 0; i < body.length; i++) {
      const statement = body[i];
      const values = scope.temporaries.values;
      const next = scope.temporaries.next;
      await this.parseStatement(statement, scope);

      if (this.arrays && statement.type !== NodeType.ReturnStatement &&
          scope.temporaries.values === values) {
        for (const variable of values.slice(next, scope.temporaries.next)) {
          if (variable.reference && !variable.scalar) {
            await this.clearReference(variable.reference, scope);
          }
        }
      }

      scope.temporaries.next = scope.temporaries.values === values ? next : 0;

      if (statement.type === NodeType.ReturnStatement ||
          statement.type === NodeType.BreakStatement ||
          statement.type === NodeType.ContinueStatement) {
        break;
      }

      if (scope.loopState && i + 1 < body.length && this.hasLoopControl([statement])) {
        const guard = this.append(scope, {
          opcode: 'control_if',
          inputs: {
            CONDITION: [2, this.insertBlock({
              opcode: 'operator_equals',
              inputs: {
                OPERAND1: this.read(scope.loopState),
                OPERAND2: [1, [4, 0]]
              }
            })]
          }
        });
        const continuation = scope.createChild();
        continuation.bindings = scope.bindings;
        await this.parseASTBody(body.slice(i + 1), continuation);
        this.attachSubstack(guard, 'SUBSTACK', continuation);
        break;
      }
    }
  }

  async releaseScope (scope: Scope) {
    if (!this.arrays) {
      return;
    }

    const last = this.root.blocks[scope.lastBlock];

    if (last?.opcode === 'control_stop' && last.mutation?.hasnext === false) {
      return;
    }

    for (const binding of Object.values(scope.bindings)) {
      if (binding.kind === 'variable' && binding.reference && !binding.scalar) {
        await this.clearReference(binding.reference, scope);
      }
    }
  }

  runtimeList (name: string) {
    const id = uid();
    const list: [string, string] = [`${name}@${id}`, id];
    this.stage.lists[id] = [list[0], []];
    this._runtimeLists.push(id);
    return list;
  }

  resolveImport (source: string, filePath = this._currentFile) {
    const importPath = path.resolve(path.dirname(filePath), source);
    const resolvedPath = importPath.endsWith('.claw') ? importPath : importPath + '.claw';

    return fs.realpathSync(resolvedPath);
  }

  loadPrograms (filePath: string): Program {
    let source: string;

    try {
      filePath = fs.realpathSync(filePath);

      if (this._programs[filePath]) {
        return this._programs[filePath];
      }

      source = fs.readFileSync(filePath, 'utf8');
    } catch {
      throw new Error(`Failed to load file: ${filePath}`);
    }

    const ast = new ASTBuilder().build(new Tokenizer().tokenize(source));
    this._programs[filePath] = ast;

    for (const statement of ast.body) {
      if (statement.type === NodeType.ImportStatement && !Object.hasOwn(extensions, statement.source)) {
        this.loadPrograms(this.resolveImport(statement.source, filePath));
      }
    }

    return ast;
  }

  pruneBlocks () {
    const blocks = this.root.blocks;
    const pending = Object.keys(blocks).filter(id => blocks[id].topLevel);
    const used: Record<string, boolean> = {};

    while (pending.length) {
      const id = pending.pop();

      if (used[id]) {
        continue;
      }

      used[id] = true;
      const block = blocks[id];

      if (block.next) {
        pending.push(block.next);
      }

      for (const input of Object.values(block.inputs)) {
        for (const value of input.slice(1)) {
          if (typeof value === 'string' && blocks[value]) {
            pending.push(value);
          }
        }
      }
    }

    for (const id of Object.keys(blocks)) {
      if (!used[id]) {
        delete blocks[id];
      }
    }
  }

  usesArrays (node: Program | Statement | Expression | Block): boolean {
    if (node.type === NodeType.ArrayExpression || node.type === NodeType.IndexExpression ||
        (node.type === NodeType.Identifier && node.name === 'arrays') ||
        (node.type === NodeType.MemberExpression &&
          (node.property === 'length' || Object.hasOwn(arrayMethods, node.property)) &&
          (node.object.type !== NodeType.Identifier || !Object.hasOwn(globals, node.object.name)))) {
      return true;
    }

    return Object.values(node).flat().some(value => {
      return value && typeof value === 'object' && this.usesArrays(value);
    });
  }

  async compileFile (filePath: string, internal = false) {
    const ast = this.loadPrograms(filePath);
    filePath = fs.realpathSync(filePath);

    const key = internal ? `internal:${filePath}` : filePath;

    if (this._compiledFiles[key] === 'visiting') {
      throw new Error(`Circular import involving "${filePath}".`);
    }

    if (this._compiledFiles[key] === 'done') {
      return;
    }

    if (!this._startup.lastBlock) {
      this.append(this._startup, {
        opcode: 'event_whenflagclicked',
        topLevel: true
      });
    }

    this._compiledFiles[key] = 'visiting';
    const previousFile = this._currentFile;
    this._currentFile = filePath;

    try {
      ast.body.forEach(statement => this.scanWrites(statement));

      for (const statement of ast.body) {
        if (statement.type === NodeType.ImportStatement && !Object.hasOwn(extensions, statement.source)) {
          // Imports compile without internal access
          await this.compileFile(this.resolveImport(statement.source));
        }
      }

      const fileScope = this._globals.createChild();
      fileScope.internal = internal;

      if (internal) {
        Object.assign(fileScope.bindings, internals);
      }

      fileScope.lastBlock = this._startup.lastBlock;
      await this.parseASTBody(ast.body, fileScope);
      this._startup.lastBlock = fileScope.lastBlock;
      this._compiledFiles[key] = 'done';
      return fileScope;
    } finally {
      this._currentFile = previousFile;
    }
  }

  async compile (filePath: string) {
    this.loadPrograms(path.resolve(filePath));

    this.arrays = Object.values(this._programs).some(program => this.usesArrays(program));
    this.builtins = await this.compileFile(
      fileURLToPath(new URL('./internal/arrays.claw', import.meta.url)), true
    );
    await this.compileFile(path.resolve(filePath));

    const initialize = new Scope();

    if (this.arrays || this._frameSizes.length) {
      if (this._rootCount > 200000) {
        throw new Error('Too many array value slots for Scratch.');
      }

      await this.builtin('initialize', [
        this.number(this._rootCount), this.number(this._frameSizes.length)
      ], initialize, false);
    }

    const reset = new Scope();

    for (const id of this._runtimeLists) {
      this.append(reset, {
        opcode: 'data_deletealloflist',
        fields: {
          LIST: [this.stage.lists[id][0], id]
        }
      });
    }

    if (initialize.firstBlock) {
      if (reset.lastBlock) {
        this.root.blocks[reset.lastBlock].next = initialize.firstBlock;
        this.root.blocks[initialize.firstBlock].parent = reset.lastBlock;
      } else {
        reset.firstBlock = initialize.firstBlock;
      }

      reset.lastBlock = initialize.lastBlock;
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

    this.pruneBlocks();

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
