import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import Tokenizer from './tokenizer.ts';
import ASTBuilder from './ast.ts';
import TypeChecker, {
  structType,
  type StructType,
  type TypeModule
} from './type-checker.ts';
import {
  EMPTY_COSTUME_FILE,
  newSprite,
  newBlock
} from './util/project-util.ts';
import uid from './util/uid.ts';
import Scope from './util/scope.ts';
import CallFrame from './util/call-frame.ts';
import loadExtension, {
  isExtensionImport,
  resolveExtensionImport,
  type LoadedExtension
} from './util/load-extension.ts';
import ListOperations, { listRuntimePath } from './blocks/categories/lists.ts';
import { internals } from './blocks/categories/list-bindings.ts';
import control from './blocks/categories/control.ts';
import data from './blocks/categories/data.ts';
import {
  globals,
  extensions
} from './blocks/index.ts';
import meta from '../package.json' with { type: 'json' };
import {
  NodeType,
  type Statement,
  type VarDeclaration,
  type ImportStatement,
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
  type SwitchStatement,
  type TryStatement,
  type WhileStatement,
  type RepeatStatement,
  type ForStatement,
  type IndexExpression,
  type ListBinding,
  type MemberExpression,
  type ObjectBinding,
  type VariableBinding,
  type Program
} from './types.ts';

const enum ProcedureExit {
  None,
  Stop,
  Throw,
  Return
}

class Compiler {
  targets: Sprite[];
  monitors: Monitor[];
  extensions: string[];
  meta: ProjectMeta;
  stage: Sprite;
  root: Sprite;
  consoleList: string;
  readyBroadcast: string;
  builtins: Scope;
  private _zip: JSZip;
  private _exports: Record<string, Bindings>;
  private _compiledFiles: Record<string, 'visiting' | 'done'>;
  private _startup: Scope;
  private _currentFile: string | null;
  private _globals: Scope;
  private _capturedInputs: Record<string, boolean>;
  private _falsyList: [string, string] | null;
  private _writes: Record<string, boolean>;
  private _booleanInputs: Record<string, boolean>;
  private _booleanReporters: Record<string, boolean>;
  private _extensionURLs: Record<string, string>;
  private _programs: Record<string, TypeModule>;
  private _types: TypeChecker;
  private _usesThread: boolean;
  private _usesThrow: boolean;
  private _lists: Record<string, [string, string]>;
  private _frameSizes: number[];
  private _listOperations: ListOperations;

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
    this.builtins = null;
    this._lists = {};
    this._frameSizes = [];
    this._listOperations = new ListOperations(this);
    this.readyBroadcast = uid();
    this.stage.broadcasts[this.readyBroadcast] = `$ready@${this.readyBroadcast}`;
    this._currentFile = null;
    this._globals = new Scope();
    this._capturedInputs = {};
    this._falsyList = null;
    this._writes = {};
    this._booleanInputs = {};
    this._booleanReporters = Object.create(null);
    this._extensionURLs = Object.create(null);
    this._programs = {};
    this._types = new TypeChecker(globals, extensions, (source, file) => {
      return this.loadModule(this.resolveImport(source, file));
    });
    this._usesThread = false;
    this._usesThrow = false;
    Object.assign(this._globals.bindings, globals);
  }

  insertBlock (blockInfo: BlockOptions, lastBlock?: string) {
    const id = uid();
    const blocks = this.root.blocks;

    if (lastBlock && blocks[lastBlock]) {
      blocks[lastBlock].next = id;
      blocks[id] = newBlock({
        parent: lastBlock,
        ...blockInfo
      });
    } else {
      blocks[id] = newBlock(blockInfo);
    }

    for (const [name, input] of Object.entries(blocks[id].inputs)) {
      if (!Array.isArray(input)) {
        continue;
      }

      const attached: typeof input = [...input];
      blocks[id].inputs[name] = attached;

      for (let i = 1; i < attached.length; i++) {
        let child = attached[i];

        if (typeof child !== 'string' || !blocks[child]) {
          continue;
        }

        if (blocks[child].parent) {
          child = this.insertBlock({
            ...blocks[child],
            parent: null
          });
        }

        attached[i] = child;
        blocks[child].parent = id;
      }
    }

    if (blockInfo.next) {
      blocks[blockInfo.next].parent = id;
    }

    return id;
  }

  append (scope: Scope, block: BlockOptions) {
    const previous = this.endsWithStop(scope) ? null : scope.lastBlock;
    const id = this.insertBlock(block, previous);
    scope.firstBlock = scope.firstBlock || id;
    scope.lastBlock = id;
    return id;
  }

  endsWithStop (scope: Scope) {
    const last = this.root.blocks[scope.lastBlock];
    return last?.opcode === 'control_stop' && last.mutation?.hasnext === false;
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

  menu (
    opcode: string,
    name: string,
    field: CallArguments['fields'][number],
    input: ScratchInput
  ): ScratchInput {
    const shadow = this.insertBlock({
      opcode,
      fields: { [name]: field || ['', null] },
      shadow: true
    });
    return field ? [1, shadow] : [3, input[1], shadow];
  }

  list (name: string) {
    if (!this._lists[name]) {
      const id = uid();
      const scopedName = `${name}@${id}`;
      this._lists[name] = [scopedName, id];
      this.stage.lists[id] = [scopedName, []];
    }

    return this._lists[name];
  }

  registerFrame (size: number) {
    const index = this._frameSizes.indexOf(size);
    if (index !== -1) {
      return index + 1;
    }

    this._frameSizes.push(size);
    return this._frameSizes.length;
  }

  async builtin (
    name: string | FunctionBinding,
    inputs: ScratchInput[],
    scope: Scope,
    asValue = true
  ) {
    const binding = typeof name === 'string' ? this.builtins.resolve(name) as FunctionBinding : name;
    return this.parseCall(binding, [], scope, asValue, inputs);
  }

  async parseBuiltin (source: string, scope: Scope) {
    const program = new ASTBuilder().build(new Tokenizer().tokenize(source));
    return this.parseFunction(program.body[0] as FunctionDeclaration, scope);
  }

  attachSubstack (parent: string, input: string, scope: Scope) {
    this.root.blocks[parent].inputs[input] = [2, scope.firstBlock];

    if (scope.firstBlock) {
      this.root.blocks[scope.firstBlock].parent = parent;
    }
  }

  appendEndBlock (
    scope: Scope,
    block: BlockOptions,
    condition?: ScratchInput,
    exit = ProcedureExit.Stop
  ) {
    const branch = condition && this.append(scope, {
      opcode: 'control_if',
      inputs: {
        CONDITION: condition
      }
    });
    const body = branch ? scope.createChild() : scope;

    if (block.opcode === 'control_stop' && block.fields.STOP_OPTION[0] === 'this script' &&
        (scope.inTry || (exit === ProcedureExit.Stop && scope.frame?.canStop))) {
      this.write(scope.frame.exitStatus(), this.number(exit), body);
    }

    const end = this.append(body, block);

    if (branch) {
      this.attachSubstack(branch, 'SUBSTACK', body);
    }

    return branch || end;
  }

  temporary (scope: Scope): VariableBinding {
    const index = scope.temporaries.next++;
    let variable = scope.temporaries.values[index];

    if (variable) {
      variable.boolean = undefined;
      return variable;
    }

    if (scope.frame) {
      variable = scope.frame.allocateSlot();
    } else {
      const id = uid();
      variable = new Scope().defineVariable('$temporary', id);
      this.root.variables[id] = [variable.storage.name, ''];
    }

    variable.temporary = true;
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

    return value;
  }

  write (variable: VariableBinding, value: ScratchInput, scope: Scope) {
    if (variable.temporary) {
      variable.boolean = variable.boolean !== false && this.isBoolean(value);
    }

    return this.append(scope, variable.set.create({
      inputs: [value],
      fields: [],
      bodies: []
    }, this));
  }

  capture (value: ScratchInput, scope: Scope, target?: VariableBinding): ScratchInput {
    if (value[0] === 1 && Array.isArray(value[1])) {
      return value;
    }

    if (value[0] === 2 && this._capturedInputs[value[1] as string]) {
      return value;
    }

    const variable = target || this.temporary(scope);
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

    const opcode = this.root.blocks[value[1] as string].opcode;
    return this._booleanReporters[opcode] || [
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
      'sensing_loud',
      'faceSensing_faceIsDetected'
    ].includes(opcode);
  }

  boolean (value: ScratchInput): ScratchInput {
    if (value[0] === 1 && Array.isArray(value[1])) {
      return this.booleanLiteral(this.truthy(value[1][1] as Literal['value']));
    }

    if (this._booleanInputs[value[1] as string]) {
      return this.reporter('operator_equals', {
        OPERAND1: value,
        OPERAND2: [1, [10, 'true']]
      });
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
    const text = this.reporter('operator_join', {
      STRING1: [1, [10, '#']],
      STRING2: value
    });
    return this.not(this.reporter('data_listcontainsitem', {
      ITEM: text
    }, { LIST: this._falsyList }));
  }

  not (value: ScratchInput): ScratchInput {
    return this.reporter('operator_not', { OPERAND: value });
  }

  equals (left: ScratchInput, right: ScratchInput): ScratchInput {
    return this.reporter('operator_equals', {
      OPERAND1: left,
      OPERAND2: right
    });
  }

  booleanLiteral (value: boolean): ScratchInput {
    const truth = this.reporter('operator_not');
    return value ? truth : this.not(truth);
  }

  constantValue (expression: Expression, scope?: Scope): Literal | null {
    if (expression.type === NodeType.NumberLiteral ||
        expression.type === NodeType.StringLiteral ||
        expression.type === NodeType.BooleanLiteral) {
      return expression;
    }

    // Functions can read captured variables before initialization
    if (expression.type === NodeType.Identifier && scope && !scope.isFunction) {
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
      for (const name of this._types.exports.get(node) || node.names) {
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

    if (node.type === NodeType.SwitchStatement &&
        (!this.canDispatchSwitchDirectly(node) ||
          (!this.constantValue(node.discriminant) &&
            node.cases.filter(clause => clause.test).length !== 1))) {
      return true;
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
        (node.type === NodeType.MemberExpression && node.property === 'length' &&
          !this._types.structs.has(node.object))) {
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

    if (object?.kind !== 'object') {
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
    compiledInputs?: ScratchInput[]
  ): Promise<ScratchInput> {
    const [result] = await this.emitCall(definition, expressions, scope, asValue, compiledInputs);
    return result;
  }

  private async emitCall (
    definition: FunctionBinding,
    expressions: Expression[],
    scope: Scope,
    asValue: boolean,
    compiledInputs?: ScratchInput[]
  ): Promise<ScratchInput[]> {
    if (definition.blockType === 'hat' && (scope.isFunction || scope.inTry)) {
      throw new Error(scope.isFunction
        ? 'Event handlers must be declared outside functions.'
        : 'Event handlers must be declared outside try blocks.');
    }

    const count = (compiledInputs || expressions).length;

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

    const args = await this.parseCallArguments(definition, expressions, scope, compiledInputs);

    let frameIndex: ScratchInput;
    const procedure = definition.procedure;

    if (procedure?.frame) {
      frameIndex = await procedure.frame.allocate(scope);
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

    if (!scope.internal && block.opcode === 'sensing_of' &&
        String(block.fields.PROPERTY[0]).startsWith('$')) {
      throw new Error('Compiler variables are private.');
    }

    if (definition.blockType === 'hat') {
      this.insertBlock(block);

      if (scope.temporaries.next) {
        // Hat inputs can outlive the statement that declares them
        scope.temporaries.values = scope.temporaries.values.slice(scope.temporaries.next);
        scope.temporaries.next = 0;
      }

      return [scope.lastBlock];
    }

    if (definition.blockType === 'reporter') {
      if (definition.resultType === 'boolean') {
        this._booleanReporters[block.opcode] = true;
      }
      return [[2, this.insertBlock(block)]];
    }

    if (block.opcode === 'control_delete_this_clone') {
      this.appendEndBlock(scope, block, this.booleanLiteral(true));
    } else if (block.opcode === 'control_stop' && block.mutation.hasnext === false) {
      this.appendEndBlock(scope, block);
    } else {
      this.append(scope, block);
    }

    if (procedure?.frame) {
      const frame = procedure.frame;
      const status = frame.canStop || frame.canThrow
        ? this.capture(this.read(frame.exitStatus(frameIndex)), scope)
        : null;
      const resultCount = Math.max(asValue ? procedure.results.length : 0, Number(frame.canThrow));
      const results = Array.from({ length: resultCount }, (_, index) =>
        this.capture(frame.readResult(frameIndex, index), scope)
      );
      await frame.release(scope, frameIndex);

      if (frame.canStop) {
        this.appendEndBlock(
          scope,
          control.thread.stop.create(),
          this.equals(status, this.number(ProcedureExit.Stop))
        );
      }

      if (frame.canThrow) {
        const branch = this.append(scope, {
          opcode: 'control_if',
          inputs: {
            CONDITION: this.equals(status, this.number(ProcedureExit.Throw))
          }
        });
        const failure = scope.createChild();
        this.throwValue(results[0], failure);
        this.attachSubstack(branch, 'SUBSTACK', failure);
      }

      return asValue ? results : [scope.lastBlock];
    }

    if (definition.shared && asValue) {
      return procedure.results.map(result => this.capture(this.read(result), scope));
    }

    if (asValue && procedure) {
      return [[1, [10, '']]];
    }

    return [scope.lastBlock];
  }

  private async parseCallArguments (
    definition: FunctionBinding,
    expressions: Expression[],
    scope: Scope,
    compiledInputs?: ScratchInput[]
  ): Promise<CallArguments> {
    const args: CallArguments = {
      inputs: [],
      fields: [],
      bodies: []
    };

    let extraInputs = 0;
    for (const [index, argumentType] of definition.args.entries()) {
      const expression = expressions[index];
      const inputIndex = index + extraInputs;

      if (definition.structParams?.[index]) {
        const fields = await this.parseValues(expression, scope);
        const capture = expressions.slice(index + 1).some(value =>
          this.needsFrame(value, true, scope)
        );
        for (const [fieldIndex, field] of fields.entries()) {
          args.inputs[inputIndex + fieldIndex] = capture ? this.capture(field, scope) : field;
        }
        extraInputs += fields.length - 1;
        continue;
      }

      if (compiledInputs && typeof argumentType === 'number') {
        args.inputs[index] = compiledInputs[index];
        continue;
      }

      const isLiteral =
        expression.type === NodeType.StringLiteral ||
        expression.type === NodeType.NumberLiteral ||
        expression.type === NodeType.BooleanLiteral;

      if (
        isLiteral &&
        (typeof argumentType !== 'number' || expression.type !== NodeType.BooleanLiteral)
      ) {
        args.fields[index] = [expression.value, null];
      }

      if (typeof argumentType === 'number') {
        if (
          expression.type === NodeType.StringLiteral ||
          expression.type === NodeType.NumberLiteral
        ) {
          args.inputs[inputIndex] = [1, [argumentType, String(expression.value)]];
        } else {
          args.inputs[inputIndex] = await this.parseExpression(expression, scope, true);

          if (
            (definition.procedure?.frame && this.needsFrame(expression, true, scope)) ||
            expressions.slice(index + 1).some(value => this.needsFrame(value, true, scope))
          ) {
            args.inputs[inputIndex] = this.capture(args.inputs[inputIndex], scope);
          }
        }

        continue;
      }

      if (argumentType === 'body') {
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
        args.bodies[index] = bodyScope.firstBlock;
        continue;
      }

      if (argumentType === 'broadcast' && definition.blockType !== 'hat' && !isLiteral) {
        args.inputs[index] = await this.parseExpression(expression, scope, true);
        continue;
      }

      if (argumentType === 'list' && expression.type === NodeType.Identifier) {
        const list = scope.resolve(expression.name);

        if (list?.kind === 'list') {
          args.fields[index] = list.field;
          continue;
        }
      }

      if (!isLiteral) {
        throw new Error('Block dropdowns and data names require a literal value.');
      }

      const name = String(expression.value);

      switch (argumentType) {
        case 'variable': {
          const resolved = scope.resolve(name);

          if (!resolved || resolved.kind !== 'variable' || !resolved.storage) {
            throw new Error(`"${name}" is not a variable.`);
          }

          args.fields[index] = [resolved.storage.name, resolved.storage.id];
          break;
        }
        case 'list': {
          if (name.startsWith('$')) {
            if (!scope.internal) {
              throw new Error('Compiler lists are private.');
            }

            args.fields[index] = this.list(name);
            break;
          }

          const lists = this.stage.lists;
          const id = Object.keys(lists).find(id => lists[id][0] === name) || uid();
          lists[id] = lists[id] || [name, []];
          args.fields[index] = [name, id];
          break;
        }
        case 'broadcast': {
          const broadcasts = this.stage.broadcasts;
          const id = Object.keys(broadcasts).find(id => broadcasts[id] === name) || uid();
          broadcasts[id] = name;
          args.fields[index] = [name, id];
          args.inputs[index] = [1, [11, name, id]];
          break;
        }
      }
    }

    return args;
  }

  async parseSubstack (
    bodyStatements: Statement[],
    parentScope: Scope,
    parentBlockId: string,
    input = 'SUBSTACK'
  ) {
    const childScope = parentScope.createChild();
    await this.parseStatements(bodyStatements, childScope);

    if (childScope.firstBlock) {
      this.attachSubstack(parentBlockId, input, childScope);
    }
  }

  async parseBinaryExpression (
    expression: BinaryExpression,
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

    if (!Object.hasOwn(arithmetic, expression.operator) &&
        !Object.hasOwn(comparisons, expression.operator) &&
        expression.operator !== '&&' && expression.operator !== '||') {
      throw new Error(`Unsupported binary operator "${expression.operator}".`);
    }

    let left = inputs ? inputs[0] : await this.parseExpression(expression.left, scope, true);

    if (expression.operator === '&&' || expression.operator === '||') {
      const rightScope = scope.createChild();
      const right = await this.parseExpression(expression.right, rightScope, true);

      if (scope.internal && !rightScope.firstBlock) {
        const opcode = expression.operator === '&&' ? 'operator_and' : 'operator_or';
        return this.reporter(opcode, {
          OPERAND1: this.boolean(left),
          OPERAND2: this.boolean(right)
        });
      }

      const result = this.temporary(scope);
      this.write(result, this.boolean(left), scope);
      let condition = this.boolean(this.read(result));

      if (expression.operator === '||') {
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
    let addition = expression.operator === '+' ? this.additionOpcode(expression) : null;

    if (expression.operator === '+' && scope.internal) {
      addition = 'operator_add';
    }

    if (expression.operator === '+' && !addition) {
      sum = this.temporary(scope);
      this.write(sum, left, scope);
      left = this.read(sum);
    } else if (this.needsFrame(expression.right, true, scope)) {
      left = this.capture(left, scope);
    }

    let right = inputs ? inputs[1] : await this.parseExpression(expression.right, scope, true);

    if (sum) {
      right = this.capture(right, scope);
      // Numeric strings add, other text concatenates
      const numeric = [left, right].map(value => {
        const number = this.reporter('operator_add', {
          NUM1: value,
          NUM2: this.number(0)
        });
        return this.reporter('operator_equals', {
          OPERAND1: value,
          OPERAND2: number
        });
      });
      const branch = this.append(scope, {
        opcode: 'control_if_else',
        inputs: {
          CONDITION: this.reporter('operator_and', {
            OPERAND1: numeric[0],
            OPERAND2: numeric[1]
          })
        }
      });

      for (const [substack, opcode, input] of [
        ['SUBSTACK', 'operator_add', 'NUM'],
        ['SUBSTACK2', 'operator_join', 'STRING']
      ]) {
        const branchScope = scope.createChild();
        const value = this.reporter(opcode, {
          [input + '1']: left,
          [input + '2']: right
        });
        this.write(sum, value, branchScope);
        this.attachSubstack(branch, substack, branchScope);
      }

      return this.read(sum);
    }

    let result: ScratchInput;

    if (addition === 'operator_join') {
      return this.reporter(addition, {
        STRING1: left,
        STRING2: right
      });
    }

    if (Object.hasOwn(arithmetic, expression.operator)) {
      result = this.reporter(arithmetic[expression.operator], {
        NUM1: left,
        NUM2: right
      });
    } else if (expression.operator === '==' || expression.operator === '!=') {
      result = this.equals(left, right);
    } else {
      result = this.reporter(comparisons[expression.operator], {
        OPERAND1: left,
        OPERAND2: right
      });
    }

    if (['!=', '<=', '>='].includes(expression.operator)) {
      return this.not(result);
    }

    return result;
  }

  async parseConditionalExpression (
    expression: ConditionalExpression,
    scope: Scope,
    asValue: boolean
  ): Promise<ScratchInput[]> {
    const constant = this.constantValue(expression.test, scope);

    if (constant) {
      const selected = this.truthy(constant.value) ? expression.consequent : expression.alternate;
      return asValue
        ? this.parseValues(selected, scope)
        : [await this.parseExpression(selected, scope)];
    }

    const test = await this.parseExpression(expression.test, scope, true);
    const type = this._types.structs.get(expression);
    const results = asValue
      ? Array.from({ length: type ? type.fields.length : 1 }, () => this.temporary(scope))
      : null;
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

      if (results) {
        const values = await this.parseValues(selected, branchScope);
        for (const [index, result] of results.entries()) {
          this.write(result, values[index], branchScope);
        }
      } else {
        await this.parseStatement({
          type: NodeType.ExpressionStatement,
          expression: selected
        }, branchScope);
      }

      this.attachSubstack(branch, input, branchScope);
    }

    return results ? results.map(result => this.read(result)) : [scope.lastBlock];
  }

  async parseUnaryExpression (
    expression: UnaryExpression,
    scope: Scope
  ): Promise<ScratchInput> {
    if (expression.operator !== '!' && expression.operator !== '-') {
      throw new Error(`Unsupported unary operator "${expression.operator}".`);
    }

    const value = await this.parseExpression(expression.value, scope, true);

    if (expression.operator === '!') {
      return this.not(this.boolean(value));
    }

    return this.reporter('operator_subtract', {
      NUM1: [1, [6, 0]],
      NUM2: value
    });
  }

  private structBinding (
    type: StructType,
    fields: VariableBinding[],
    constant: boolean
  ): ObjectBinding {
    const members: Bindings = Object.create(null);
    for (const [name, property] of Object.entries(type.properties)) {
      const { offset, width } = property;
      const nested = structType(property.type);
      members[name] = nested
        ? this.structBinding(nested, fields.slice(offset, offset + width), constant)
        : fields[offset];
    }

    return {
      kind: 'object',
      members,
      struct: {
        type,
        fields,
        constant
      }
    };
  }

  private async parseValues (
    expression: Expression,
    scope: Scope
  ): Promise<ScratchInput[]> {
    const type = this._types.structs.get(expression);
    if (!type) {
      return [await this.parseExpression(expression, scope, true)];
    }

    switch (expression.type) {
      case NodeType.StructLiteral: {
        const values: ScratchInput[] = [];
        let lastEffect = expression.properties.length - 1;
        while (
          lastEffect >= 0 &&
          !this.needsFrame(expression.properties[lastEffect].value, true, scope)
        ) {
          lastEffect--;
        }

        for (const [index, { name, value }] of expression.properties.entries()) {
          const { offset } = type.properties[name];
          const fields = await this.parseValues(value, scope);
          for (const [field, input] of fields.entries()) {
            values[offset + field] = index < lastEffect ?
              this.capture(input, scope) : input;
          }
        }
        return values;
      }
      case NodeType.ConditionalExpression:
        return this.parseConditionalExpression(expression, scope, true);
      case NodeType.CallExpression: {
        const binding = await this.resolveBinding(expression.callee, scope);
        if (binding?.kind !== 'function') {
          throw new Error('Expected a function returning a struct.');
        }
        return this.emitCall(binding, expression.arguments, scope, true);
      }
      default: {
        const binding = await this.resolveBinding(expression, scope);
        if (binding?.kind === 'object' && binding.struct) {
          return binding.struct.fields.map(field => this.read(field));
        }
        if (expression.type === NodeType.MemberExpression) {
          return this.parseStructMember(expression, scope);
        }
        throw new Error('Expected a struct value.');
      }
    }
  }

  private async parseStructMember (expression: MemberExpression, scope: Scope) {
    const type = this._types.structs.get(expression.object);
    const { offset, width } = type.properties[expression.property];
    const values = await this.parseValues(expression.object, scope);
    return values.slice(offset, offset + width);
  }

  async parseExpression (
    expression: Expression,
    scope: Scope,
    asValue = false
  ): Promise<ScratchInput> {
    if (asValue && this._types.structs.has(expression)) {
      throw new Error('Expected a scalar value.');
    }

    const constant = this.constantValue(expression, scope);

    if (constant && constant !== expression) {
      return this.parseExpression(constant, scope, asValue);
    }

    switch (expression.type) {
      case NodeType.ArrayExpression:
        throw new Error('Use the list keyword to declare a list.');
      case NodeType.StructLiteral:
        throw new Error('A struct literal requires a struct type.');
      case NodeType.IndexExpression: {
        const { read } = await this.parseListTarget(expression, scope);
        return read();
      }
      case NodeType.CallExpression: {
        const binding = await this.resolveBinding(expression.callee, scope);

        if (!binding || binding.kind !== 'function') {
          if (expression.callee.type === NodeType.MemberExpression) {
            const { object, property } = expression.callee;
            const list = await this._listOperations.resolve(object, scope);

            if (list) {
              const result = await this._listOperations.call(
                list, property, expression.arguments, scope, asValue
              );

              if (typeof result === 'string' || Array.isArray(result)) {
                return result;
              }

              if (result) {
                throw new Error('Use a list declaration to store a list result.');
              }
              return null;
            }
          }

          throw new Error('Expected a function.');
        }

        return this.parseCall(binding, expression.arguments, scope, asValue);
      }
      case NodeType.BinaryExpression: {
        return this.parseBinaryExpression(expression, scope);
      }
      case NodeType.ConditionalExpression: {
        const [result] = await this.parseConditionalExpression(expression, scope, asValue);
        return result;
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
          if (
            expression.type === NodeType.MemberExpression &&
            this._types.structs.has(expression.object)
          ) {
            const [value] = await this.parseStructMember(expression, scope);
            return value;
          }

          if (expression.type === NodeType.MemberExpression && expression.property === 'length') {
            const { read } = await this.parseListTarget(expression, scope);
            return read();
          }

          throw new Error('Expected a variable.');
        }

        return this.read(binding);
      }
      case NodeType.UpdateExpression: {
        if (expression.argument.type === NodeType.IndexExpression ||
            (expression.argument.type === NodeType.MemberExpression &&
              expression.argument.property === 'length' &&
              !(await this.resolveBinding(expression.argument, scope)))) {
          const { read, write } = await this.parseListTarget(expression.argument, scope, true);
          const current = await read();
          const previous = asValue ? this.capture(current, scope) : current;
          const opcode = expression.operator === '++' ? 'operator_add' : 'operator_subtract';
          const value = this.reporter(opcode, {
            NUM1: previous,
            NUM2: [1, [4, 1]]
          });
          await write(value);
          return asValue ? previous : scope.lastBlock;
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
          const numeric = this.reporter('operator_add', {
            NUM1: oldValue,
            NUM2: [1, [4, '0']]
          });
          oldValue = this.capture(numeric, scope);
        }

        const opcode = expression.operator === '++' ? 'operator_add' : 'operator_subtract';
        const value = this.reporter(opcode, {
          NUM1: oldValue,
          NUM2: [1, [4, '1']]
        });
        this.append(scope, binding.set.create({
          inputs: [value],
          fields: [],
          bodies: []
        }, this));
        return asValue ? oldValue : scope.lastBlock;
      }
    }
  }

  hasControl (
    statement: Statement,
    type: NodeType.BreakStatement | NodeType.ContinueStatement
  ): boolean {
    if (statement.type === type) {
      return true;
    }

    if (statement.type === NodeType.Block) {
      return statement.body.some(child => this.hasControl(child, type));
    }

    if (statement.type === NodeType.SwitchStatement) {
      return type === NodeType.ContinueStatement &&
        statement.cases.some(clause => clause.body.some(child => this.hasControl(child, type)));
    }

    if (statement.type === NodeType.TryStatement) {
      return this.hasControl(statement.body, type) || this.hasControl(statement.handler, type);
    }

    if (statement.type !== NodeType.IfStatement) {
      return false;
    }

    return this.hasControl(statement.consequent, type) ||
      (statement.alternate !== null && this.hasControl(statement.alternate, type));
  }

  canDispatchSwitchDirectly (statement: SwitchStatement) {
    return statement.cases.every(({ body }, index) => {
      for (const child of body) {
        if (child.type === NodeType.BreakStatement || child.type === NodeType.ContinueStatement ||
            child.type === NodeType.ReturnStatement || child.type === NodeType.ThrowStatement) {
          return true;
        }

        if (this.hasControl(child, NodeType.BreakStatement)) {
          return false;
        }
      }

      return index === statement.cases.length - 1;
    });
  }

  async parseSwitch (statement: SwitchStatement, scope: Scope) {
    const { cases, discriminant } = statement;
    const tests = cases.map(clause => clause.test).filter(test => test !== null);
    let value = await this.parseExpression(discriminant, scope, true);
    const state = this.canDispatchSwitchDirectly(statement) ? null : this.temporary(scope);

    if (!this.constantValue(discriminant, scope) &&
        (tests.length !== 1 || this.needsFrame(tests[0], true, scope))) {
      // Once a case is selected, its index can replace the scalar discriminant
      value = this.capture(value, scope, state);
    }

    const switchScope = scope.createChild();
    switchScope.lastBlock = scope.lastBlock;
    switchScope.breakState = state;

    const caseScopes: Scope[] = [];
    let matchScope = switchScope;
    let previousBranch: string;
    let fallback: Scope;

    for (const [index, { test, body }] of cases.entries()) {
      const caseScope = switchScope.createChild();
      caseScope.bindings = switchScope.bindings;
      caseScopes.push(caseScope);

      const selected = state ? switchScope.createChild() : caseScope;
      if (!tests.length) {
        selected.lastBlock = switchScope.lastBlock;
      }

      if (state) {
        // Negative indices allow fallthrough until break sets the state to 2
        this.write(state, this.number(index - cases.length), selected);
      }

      let branch: string;
      if (test) {
        const nextTemporary = matchScope.temporaries.next;
        const candidate = await this.parseExpression(test, matchScope, true);
        const hasAlternate = state || tests.length < cases.length ||
          test !== tests[tests.length - 1];
        branch = this.append(matchScope, {
          opcode: hasAlternate ? 'control_if_else' : 'control_if',
          inputs: {
            CONDITION: this.equals(value, candidate)
          }
        });

        // The condition has read its temporaries before either branch runs
        matchScope.temporaries.next = nextTemporary;

        if (previousBranch) {
          this.attachSubstack(previousBranch, 'SUBSTACK2', matchScope);
        }

        previousBranch = branch;
        matchScope = switchScope.createChild();
      } else {
        fallback = selected;
      }

      const breakIndex = state ? -1 : body.findIndex(child => child.type === NodeType.BreakStatement);
      await this.parseStatements(breakIndex === -1 ? body : body.slice(0, breakIndex), caseScope);

      if (branch) {
        this.attachSubstack(branch, 'SUBSTACK', selected);
      }

      if (!tests.length) {
        switchScope.firstBlock = switchScope.firstBlock || selected.firstBlock;
        switchScope.lastBlock = selected.lastBlock;
      }
    }

    if (state && !fallback) {
      fallback = matchScope;
      this.write(state, this.number(2), fallback);
    }

    if (previousBranch && fallback) {
      this.attachSubstack(previousBranch, 'SUBSTACK2', fallback);
    }

    if (state) {
      let canContinue = false;

      for (const [index, caseScope] of caseScopes.entries()) {
        if (!caseScope.firstBlock) {
          continue;
        }

        let condition = this.reporter('operator_lt', {
          OPERAND1: this.read(state),
          OPERAND2: this.number(index - cases.length + 1)
        });

        if (canContinue) {
          condition = this.reporter('operator_and', {
            OPERAND1: condition,
            OPERAND2: this.equals(this.read(scope.loopState), this.number(0))
          });
        }

        const branch = this.append(switchScope, {
          opcode: 'control_if',
          inputs: {
            CONDITION: condition
          }
        });
        this.attachSubstack(branch, 'SUBSTACK', caseScope);
        canContinue = canContinue ||
          cases[index].body.some(child => this.hasControl(child, NodeType.ContinueStatement));
      }
    }

    scope.firstBlock = scope.firstBlock || switchScope.firstBlock;
    scope.lastBlock = switchScope.lastBlock;
    return scope.lastBlock;
  }

  async parseLoop (
    statement: WhileStatement | RepeatStatement | ForStatement,
    scope: Scope
  ) {
    const body = statement.body.body;
    const hasControl = body.some(child => this.hasControl(child, NodeType.BreakStatement) ||
      this.hasControl(child, NodeType.ContinueStatement));

    if (statement.type === NodeType.RepeatStatement && !hasControl) {
      const count = await this.parseExpression(statement.count, scope, true);
      const loop = this.append(scope, {
        opcode: 'control_repeat',
        inputs: {
          TIMES: count,
          SUBSTACK: [2, null]
        }
      });
      await this.parseSubstack(body, scope, loop);
      return loop;
    }

    const state = hasControl ? this.temporary(scope) : null;
    const bodyScope = scope.createChild();
    bodyScope.loopState = state;
    bodyScope.breakState = state;
    let remaining: VariableBinding;
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
      remaining = this.temporary(scope);
      this.write(remaining, this.reporter('operator_round', { NUM: value }), scope);
      test = this.reporter('operator_gt', {
        OPERAND1: this.read(remaining),
        OPERAND2: this.number(0)
      });
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
      running = this.reporter('operator_lt', {
        OPERAND1: this.read(state),
        OPERAND2: this.number(2)
      });
      test = this.reporter('operator_and', {
        OPERAND1: running,
        OPERAND2: test
      });
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

    await this.parseStatements(body, bodyScope);

    if (!this.endsWithStop(bodyScope)) {
      // Use loop bindings for updates and conditions
      const tailScope = scope.createChild();
      tailScope.lastBlock = state ? null : bodyScope.lastBlock;

      if (statement.type === NodeType.ForStatement) {
        await this.parseStatement(statement.update, tailScope);
      }

      if (remaining) {
        const nextCount = this.reporter('operator_subtract', {
          NUM1: this.read(remaining),
          NUM2: this.number(1)
        });
        this.write(remaining, nextCount, tailScope);
      }

      if (condition && !this.endsWithStop(tailScope)) {
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

  private async parseListTarget (
    target: IndexExpression | MemberExpression,
    scope: Scope,
    updating = false
  ) {
    const list = await this._listOperations.resolve(target.object, scope);

    if (!list) {
      throw new Error('Expected a list.');
    }

    let index = target.type === NodeType.IndexExpression
      ? await this.parseExpression(target.index, scope, true)
      : null;

    if (index && updating) {
      index = this.capture(index, scope);
    }

    return {
      read: () => this._listOperations.get(list, index, scope),
      write: (value: ScratchInput) =>
        this._listOperations.set(list, index, value, scope)
    };
  }

  async parseStatement (statement: Statement, scope: Scope): Promise<ScratchInput> {
    switch (statement.type) {
      case NodeType.Block: {
        const blockScope = scope.createChild();
        blockScope.lastBlock = scope.lastBlock;
        await this.parseStatements(statement.body, blockScope);
        scope.firstBlock = scope.firstBlock || blockScope.firstBlock;
        scope.lastBlock = blockScope.lastBlock;
        return scope.lastBlock;
      }
      case NodeType.Assignment:
        return this.parseAssignment(statement, scope);
      case NodeType.ExpressionStatement: {
        const { expression } = statement;
        if (expression.type !== NodeType.CallExpression && this._types.structs.has(expression)) {
          await this.parseValues(expression, scope);
          return scope.lastBlock;
        }

        const result = await this.parseExpression(expression, scope);

        if (Array.isArray(result)) {
          this.capture(result, scope);
        }

        return scope.lastBlock;
      }
      case NodeType.BreakStatement:
      case NodeType.ContinueStatement: {
        const isBreak = statement.type === NodeType.BreakStatement;
        const state = isBreak ? scope.breakState : scope.loopState;

        if (!state) {
          throw new Error(isBreak
            ? '"break" can only be used inside a loop or switch.'
            : '"continue" can only be used inside a loop.');
        }

        return this.write(state, this.number(isBreak ? 2 : 1), scope);
      }
      case NodeType.SwitchStatement:
        return this.parseSwitch(statement, scope);
      case NodeType.WhileStatement:
      case NodeType.RepeatStatement: {
        return this.parseLoop(statement, scope);
      }
      case NodeType.IfStatement: {
        const test = await this.parseExpression(statement.test, scope, true);
        const hasElse = statement.alternate !== null;
        const ifId = this.append(scope, {
          opcode: hasElse ? 'control_if_else' : 'control_if',
          inputs: {
            CONDITION: this.boolean(test),
            SUBSTACK: [2, null]
          }
        });
        await this.parseSubstack(statement.consequent.body, scope, ifId);

        if (hasElse) {
          const alternateBody = statement.alternate.type === NodeType.Block
            ? statement.alternate.body
            : [statement.alternate];
          await this.parseSubstack(alternateBody, scope, ifId, 'SUBSTACK2');
        }
        return ifId;
      }
      case NodeType.ForStatement: {
        const forScope = scope.createChild();
        forScope.lastBlock = scope.lastBlock;
        await this.parseStatement(statement.init, forScope);

        if (!this.endsWithStop(forScope)) {
          await this.parseLoop(statement, forScope);
        }

        scope.firstBlock = scope.firstBlock || forScope.firstBlock;
        scope.lastBlock = forScope.lastBlock;
        return scope.lastBlock;
      }
      case NodeType.VarDeclaration:
        return this.parseVarDeclaration(statement, scope);
      case NodeType.ReturnStatement: {
        if (!scope.isFunction) {
          throw new Error('Return statements can only be used inside of functions.');
        }

        const values = statement.value
          ? await this.parseValues(statement.value, scope)
          : [[1, [10, '']]] as ScratchInput[];
        const resultCount = Math.min(values.length, scope.results.length);
        for (let index = 0; index < resultCount; index++) {
          this.write(scope.results[index], values[index], scope);
        }

        return this.appendEndBlock(
          scope,
          control.thread.stop.create(),
          undefined,
          ProcedureExit.Return
        );
      }
      case NodeType.TryStatement:
        return this.parseTry(statement, scope);
      case NodeType.ThrowStatement:
        return this.throwValue(await this.parseExpression(statement.value, scope, true), scope);
      case NodeType.ImportStatement: {
        if (scope.parent !== this._globals) {
          throw new Error('Imports are only allowed at module scope.');
        }

        const names = this._types.imports.get(statement) || statement.names;
        if (!this.hasRuntimeImport(statement)) {
          return scope.lastBlock;
        }

        let fileExports: Bindings;
        const custom = this._programs[this._currentFile].extensionImports?.[statement.source];
        const extension = custom?.bindings ||
          (Object.hasOwn(extensions, statement.source) &&
          extensions[statement.source]);

        if (extension) {
          fileExports = extension;
          if (statement.defaultImport) {
            fileExports = {
              [statement.names[0]]: {
                kind: 'object',
                members: fileExports
              }
            };
          }
          for (const id of custom?.ids || [statement.source]) {
            if (custom) {
              this._extensionURLs[id] = custom.url;
            }
            if (!this.extensions.includes(id)) {
              this.extensions.push(id);
            }
          }
        } else {
          if (!names.length) {
            return scope.lastBlock;
          }
          const resolvedPath = this.resolveImport(statement.source);
          fileExports = this._exports[resolvedPath];
          if (!fileExports) {
            throw new Error(`No exports found from "${statement.source}"`);
          }
        }
        for (const name of names) {
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

        this._exports[this._currentFile] = this._exports[this._currentFile] || Object.create(null);
        for (const name of this._types.exports.get(statement) || statement.names) {
          const binding = scope.resolve(name);
          if (!binding) {
            throw new Error(`"${name}" is not defined and cannot be exported.`);
          }
          this._exports[this._currentFile][name] = binding;
        }
        return scope.lastBlock;
      }
      case NodeType.TypeDeclaration:
      case NodeType.StructDeclaration:
      case NodeType.EnumDeclaration:
        return scope.lastBlock;
      case NodeType.FunctionDeclaration: {
        await this.parseFunction(statement, scope);
        return scope.lastBlock;
      }
    }
  }

  private async parseAssignment (
    statement: Extract<Statement, { type: NodeType.Assignment }>,
    scope: Scope
  ): Promise<ScratchInput> {
    const binding = await this.resolveBinding(statement.target, scope);
    if (statement.target.type === NodeType.IndexExpression ||
        (statement.target.type === NodeType.MemberExpression && !binding)) {
      const target = statement.target;

      if (target.type === NodeType.MemberExpression) {
        if (this._types.structs.has(target.object)) {
          throw new Error('Struct field assignment requires a writable variable.');
        }
        if (target.property !== 'length') {
          throw new Error('Only the length property of a list can be assigned.');
        }
      }

      const { read, write } = await this.parseListTarget(target, scope, true);
      const old = statement.operator ? this.capture(await read(), scope) : null;
      let value = await this.parseExpression(statement.value, scope, true);

      if (statement.operator) {
        value = await this.parseBinaryExpression({
          type: NodeType.BinaryExpression,
          operator: statement.operator,
          left: statement.target,
          right: statement.value
        }, scope, [old, value]);
      }

      return write(value);
    }

    if (binding?.kind === 'object' && binding.struct) {
      if (binding.struct.constant || statement.operator) {
        throw new Error('This struct cannot be reassigned.');
      }

      let values = await this.parseValues(statement.value, scope);
      if (statement.value.type === NodeType.StructLiteral) {
        values = values.map(value => this.capture(value, scope));
      }
      for (const [index, field] of binding.struct.fields.entries()) {
        this.write(field, values[index], scope);
      }
      return scope.lastBlock;
    }

    if (binding?.kind === 'list') {
      if (binding.constant || statement.operator) {
        throw new Error('This list cannot be reassigned.');
      }

      await this._listOperations.assign(binding, statement.value, scope);
      return scope.lastBlock;
    }

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

  private async parseVarDeclaration (
    statement: VarDeclaration,
    scope: Scope
  ): Promise<ScratchInput> {
    const type = this._types.structs.get(statement);
    if (type) {
      const values = await this.parseValues(statement.init, scope);
      const fields = type.fields.map((field, index) => {
        const variable = scope.defineVariable(`${statement.name}.${field}`, uid());
        const storage = variable.storage;
        if (storage) {
          this.root.variables[storage.id] = [storage.name, ''];
        }
        this.write(variable, values[index], scope);
        if (statement.constant) {
          delete variable.set;
        }
        return variable;
      });
      scope.define(statement.name, this.structBinding(type, fields, statement.constant));
      return scope.lastBlock;
    }

    if (statement.list) {
      const list = this._listOperations.create(statement.name, statement.constant);
      await this._listOperations.assign(list, statement.init, scope, true);
      scope.define(statement.name, list);
      return scope.lastBlock;
    }

    if (statement.init) {
      const binding = await this.resolveBinding(statement.init, scope);
      if (binding?.kind === 'function' || (binding?.kind === 'object' && !binding.struct)) {
        scope.define(statement.name, binding);
        return scope.lastBlock;
      }
    }
    const value = statement.init
      ? await this.parseExpression(statement.init, scope, true)
      : [1, [10, '']] as ScratchInput;
    const variableId = uid();
    const variable = scope.defineVariable(statement.name, variableId);
    variable.boolean = this._writes[statement.name] !== false && this.isBoolean(value);

    if (!Object.hasOwn(this._writes, statement.name) && statement.init) {
      variable.constantValue = this.constantValue(statement.init, scope) || undefined;
    }

    if (variable.storage) {
      const target = scope.internal && !scope.isFunction ? this.stage : this.root;
      target.variables[variableId] = [variable.storage.name, ''];
    }

    const declarationOnly = scope.internal && scope.parent === this._globals && !statement.init;
    const assignment = declarationOnly ? scope.lastBlock : this.write(variable, value, scope);

    if (statement.constant) {
      delete variable.set;
    }

    return assignment;
  }

  throwValue (value: ScratchInput, scope: Scope) {
    if (scope.frame?.canThrow) {
      this.write(scope.frame.result, value, scope);
      this.write(scope.frame.exitStatus(), this.number(ProcedureExit.Throw), scope);
      return this.append(scope, control.thread.stop.create());
    }

    this.append(scope, data.globals.print.create({
      inputs: [value],
      fields: [],
      bodies: []
    }, this));
    return this.append(scope, control.project.stop.create());
  }

  async parseTry (statement: TryStatement, scope: Scope) {
    // Stopping a Scratch custom block returns control to its caller
    const bodyScope = scope.createChild();
    const frame = new CallFrame(this, true, true);
    bodyScope.frame = frame;
    bodyScope.inTry = true;
    bodyScope.temporaries = {
      values: [],
      next: 0
    };
    bodyScope.parameters = [frame.parameter, ...scope.parameters];

    const { definition, call } = this.createProcedure(
      `$try@${bodyScope.id}`, bodyScope.parameters, false
    );
    bodyScope.lastBlock = definition;
    this.write(frame.exitStatus(), this.number(ProcedureExit.None), bodyScope);

    if (statement.parameter) {
      this.write(frame.result, [1, [10, '']], bodyScope);
    }

    await this.parseStatements(statement.body.body, bodyScope);
    frame.finalize();

    const frameIndex = await frame.allocate(scope);
    const captures = scope.parameters.map(name => {
      return this.reporter('argument_reporter_string_number', {}, { VALUE: [name, null] });
    });
    this.append(scope, call([frameIndex, ...captures]));

    const status = this.capture(this.read(frame.exitStatus(frameIndex)), scope);
    const value = statement.parameter ? this.capture(frame.readResult(frameIndex), scope) : null;
    await frame.release(scope, frameIndex);

    this.appendEndBlock(
      scope, control.thread.stop.create(), this.equals(status, this.number(ProcedureExit.Stop))
    );

    if (scope.isFunction) {
      this.appendEndBlock(
        scope,
        control.thread.stop.create(),
        this.equals(status, this.number(ProcedureExit.Return)),
        ProcedureExit.Return
      );
    }

    const branch = this.append(scope, {
      opcode: 'control_if',
      inputs: {
        CONDITION: this.equals(status, this.number(ProcedureExit.Throw))
      }
    });
    const handler = scope.createChild();

    if (statement.parameter) {
      const variable = handler.defineVariable(statement.parameter, uid());

      if (variable.storage) {
        this.root.variables[variable.storage.id] = [variable.storage.name, ''];
      }

      this.write(variable, value, handler);
    }

    await this.parseStatements(statement.handler.body, handler);
    this.attachSubstack(branch, 'SUBSTACK', handler);
    return branch;
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
      call: (inputs: ScratchInput[]): BlockOptions => ({
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
  }

  async parseFunction (
    expression: FunctionDeclaration | FunctionExpression,
    scope: Scope,
    list?: ListBinding
  ): Promise<FunctionBinding> {
    const name = !list && expression.type === NodeType.FunctionDeclaration
      ? expression.name
      : `function_${uid.shortUid()}`;
    const params = list ? expression.params.slice(0, -1) : expression.params;
    const signature = this._types.procedures.get(expression);
    const structParams = params.map((_, index) => structType(signature?.params[index].type));
    const resultType = structType(signature?.result());
    const resultCount = resultType ? resultType.fields.length : 1;
    let create: FunctionBinding['create'];
    const binding: FunctionBinding = {
      kind: 'function',
      blockType: 'command',
      args: params.map(() => 10),
      structParams,
      create: (args, compiler) => create(args, compiler),
      compile: async () => {
        const functionScope = scope.createChild(true);
        const handlesExit = !scope.internal;
        const canStop = this._usesThread && handlesExit;
        const canThrow = this._usesThrow && handlesExit;
        functionScope.frame = !binding.shared &&
          (canStop || canThrow || this.needsFrame(expression.body))
          ? new CallFrame(this, canStop, canThrow)
          : null;

        if (functionScope.frame) {
          functionScope.results = Array.from({ length: resultCount }, (_, index) =>
            index === 0 ? functionScope.frame.result : functionScope.frame.allocateSlot()
          );
        } else if (binding.shared) {
          functionScope.results = Array.from({ length: resultCount }, (_, index) => {
            const result = functionScope.defineVariable(`$result${index || ''}`, uid());
            const storage = result.storage;
            this.root.variables[storage.id] = [storage.name, ''];
            return result;
          });
        }

        const args: string[] = [];
        for (const [index, parameter] of params.entries()) {
          const type = structParams[index];
          if (!type) {
            const name = `${parameter}@${functionScope.id}`;
            args.push(name);
            functionScope.defineParameter(parameter, name);
            continue;
          }

          const fields = type.fields.map(field => {
            const name = `${parameter}.${field}`;
            const argument = `${name}@${functionScope.id}`;
            args.push(argument);
            return functionScope.defineParameter(name, argument);
          });
          functionScope.define(parameter, this.structBinding(type, fields, true));
        }

        const captures = scope.parameters;
        const hidden = functionScope.frame ? [functionScope.frame.parameter] : [];
        const parameters = [...args, ...hidden, ...captures];
        const { definition, call } = this.createProcedure(
          `${name}@${scope.id}`, parameters, expression.warp
        );
        functionScope.lastBlock = definition;
        functionScope.parameters = parameters;

        if (list) {
          functionScope.define(expression.params.at(-1), list);
        }

        binding.procedure = {
          frame: functionScope.frame,
          captures,
          results: functionScope.results
        };
        create = ({ inputs }) => call(inputs);

        if (functionScope.frame?.canStop || functionScope.frame?.canThrow) {
          this.write(functionScope.frame.exitStatus(), this.number(ProcedureExit.None), functionScope);
        }

        if (functionScope.frame && !resultType) {
          this.write(functionScope.frame.result, [1, [10, '']], functionScope);
        }

        await this.parseStatements(expression.body.body, functionScope);

        functionScope.frame?.finalize();
      }
    };

    if (!list && !scope.internal && params.length === 3) {
      binding.listCallback = list => this.parseFunction(expression, scope, list);
    }

    binding.shared = scope.internal;

    if (!list && expression.type === NodeType.FunctionDeclaration) {
      scope.define(name, binding);
    }

    return binding;
  }

  async parseStatements (body: Statement[], scope: Scope) {
    for (let i = 0; i < body.length; i++) {
      const statement = body[i];
      const values = scope.temporaries.values;
      const next = scope.temporaries.next;
      await this.parseStatement(statement, scope);
      const stopped = this.endsWithStop(scope);

      scope.temporaries.next = scope.temporaries.values === values ? next : 0;

      if ((stopped && scope.parent !== this._globals) ||
          statement.type === NodeType.BreakStatement ||
          statement.type === NodeType.ContinueStatement) {
        break;
      }

      if (i + 1 === body.length) {
        continue;
      }

      const breaks = scope.breakState && this.hasControl(statement, NodeType.BreakStatement);
      const continues = scope.loopState && this.hasControl(statement, NodeType.ContinueStatement);

      if (breaks || continues) {
        let condition: ScratchInput;
        if (continues || (breaks && scope.breakState === scope.loopState)) {
          condition = this.equals(this.read(scope.loopState), this.number(0));
        }

        if (breaks && scope.breakState !== scope.loopState) {
          const running = this.reporter('operator_lt', {
            OPERAND1: this.read(scope.breakState),
            OPERAND2: this.number(2)
          });
          condition = condition ? this.reporter('operator_and', {
            OPERAND1: condition,
            OPERAND2: running
          }) : running;
        }

        const guard = this.append(scope, {
          opcode: 'control_if',
          inputs: {
            CONDITION: condition
          }
        });
        const continuation = scope.createChild();
        continuation.bindings = scope.bindings;
        await this.parseStatements(body.slice(i + 1), continuation);
        this.attachSubstack(guard, 'SUBSTACK', continuation);
        break;
      }
    }
  }

  resolveImport (source: string, filePath = this._currentFile) {
    const importPath = path.resolve(path.dirname(filePath), source);
    const resolvedPath = importPath.endsWith('.claw') ? importPath : importPath + '.claw';

    return fs.realpathSync(resolvedPath);
  }

  loadProgram (filePath: string): Program {
    return this.loadModule(filePath).program;
  }

  private loadModule (filePath: string): TypeModule {
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

    const parser = new ASTBuilder();
    const program = parser.build(new Tokenizer().tokenize(source));
    const module = {
      file: filePath,
      program,
      locations: parser.locations,
      names: parser.names
    };
    this._programs[filePath] = module;
    return module;
  }

  private hasRuntimeImport (statement: ImportStatement) {
    const names = this._types.imports.get(statement) || statement.names;
    return !statement.typeOnly && (!statement.names.length || names.length > 0);
  }

  private isFileImport (statement: Statement): statement is ImportStatement {
    return statement.type === NodeType.ImportStatement &&
      this.hasRuntimeImport(statement) &&
      !Object.hasOwn(extensions, statement.source) &&
      !isExtensionImport(statement.source);
  }

  private async loadExtensions (entry: TypeModule) {
    const visited: Record<string, boolean> = Object.create(null);
    const sources: Record<string, LoadedExtension> = Object.create(null);
    const pending = [entry];

    for (const module of pending) {
      if (visited[module.file]) {
        continue;
      }
      visited[module.file] = true;

      for (const statement of module.program.body) {
        if (statement.type !== NodeType.ImportStatement ||
            Object.hasOwn(extensions, statement.source)) {
          continue;
        }

        const { source } = statement;
        if (!isExtensionImport(source)) {
          try {
            pending.push(this.loadModule(this.resolveImport(source, module.file)));
          } catch {
            // The type checker reports errors loading Claw modules.
          }
          continue;
        }

        module.extensionImports ||= Object.create(null);
        if (statement.typeOnly) {
          module.extensionImports[source] ||= null;
          continue;
        }

        try {
          const location = resolveExtensionImport(source, module.file);
          sources[location] ||= await loadExtension(location);
          module.extensionImports[source] = sources[location];
        } catch (error) {
          const token = module.locations.get(statement);
          const message = error instanceof Error ? error.message : String(error);
          throw new Error(
            `${module.file}:${token.line}:${token.col}: Cannot import '${source}'. ${message}`
          );
        }
      }
    }
  }

  private collectRuntimePrograms (module: TypeModule, programs: Record<string, Program>) {
    programs[module.file] = module.program;
    for (const statement of module.program.body) {
      if (this.isFileImport(statement)) {
        const file = this.resolveImport(statement.source, module.file);
        if (!programs[file]) {
          this.collectRuntimePrograms(this.loadModule(file), programs);
        }
      }
    }
  }

  private inlineEnumMembers (node: object) {
    for (const [key, child] of Object.entries(node)) {
      if (!child || typeof child !== 'object') {
        continue;
      }

      const literal = this._types.enumMembers.get(child);
      if (literal) {
        Reflect.set(node, key, literal);
      } else {
        this.inlineEnumMembers(child);
      }
    }
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

  usesThread (node: Program | Statement | Expression | Block): boolean {
    if (node.type === NodeType.Identifier && node.name === 'thread') {
      return true;
    }

    return Object.values(node).flat().some(value => {
      return value && typeof value === 'object' && this.usesThread(value);
    });
  }

  usesThrow (node: Program | Statement | Expression | Block): boolean {
    if (node.type === NodeType.ThrowStatement) {
      return true;
    }

    return Object.values(node).flat().some(value => {
      return value && typeof value === 'object' && this.usesThrow(value);
    });
  }

  async compileFile (filePath: string, internal = false) {
    const program = this.loadProgram(filePath);
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
      program.body.forEach(statement => this.scanWrites(statement));

      for (const statement of program.body) {
        if (this.isFileImport(statement)) {
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
      await this.parseStatements(program.body, fileScope);
      this._startup.lastBlock = fileScope.lastBlock;
      this._compiledFiles[key] = 'done';
      return fileScope;
    } finally {
      this._currentFile = previousFile;
    }
  }

  async compile (filePath: string) {
    const entry = this.loadModule(path.resolve(filePath));
    await this.loadExtensions(entry);
    this._types.check(entry);
    if (this._types.problems.length) {
      throw new Error(this._types.problems.map(({ file, token, message }) => {
        return `${file}:${token.line}:${token.col}: ${message}`;
      }).join('\n'));
    }

    const runtime: Record<string, Program> = Object.create(null);
    this.collectRuntimePrograms(entry, runtime);

    const programs = Object.values(runtime);
    // Use the same block optimizations for enum members and handwritten literals.
    for (const program of programs) {
      this.inlineEnumMembers(program);
    }
    this._usesThread = programs.some(program => this.usesThread(program));
    this._usesThrow = programs.some(program => this.usesThrow(program));
    this.builtins = await this.compileFile(listRuntimePath, true);
    await this.compileFile(path.resolve(filePath));

    const initialize = new Scope();

    if (this._frameSizes.length) {
      await this.builtin('initialize', [this.number(this._frameSizes.length)], initialize, false);
    }

    const reset = new Scope();

    for (const list of Object.values(this._lists)) {
      this.append(reset, {
        opcode: 'data_deletealloflist',
        fields: {
          LIST: list
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
    const costume = fs.readFileSync(new URL(`./assets/${EMPTY_COSTUME_FILE}`, import.meta.url));
    this._zip.file('project.json', JSON.stringify(projectJSON));
    this._zip.file(EMPTY_COSTUME_FILE, costume);
  }

  toJSON () {
    const hasCustomExtensions = Object.keys(this._extensionURLs).length > 0;
    return {
      targets: this.targets,
      monitors: this.monitors,
      extensions: this.extensions,
      ...(hasCustomExtensions && {
        extensionURLs: this._extensionURLs
      }),
      meta: this.meta
    };
  }

  generateZip<T extends JSZip.OutputType> (type: T): Promise<ZipOutputs[T]> {
    return this._zip.generateAsync({ type });
  }
}

export default Compiler;
