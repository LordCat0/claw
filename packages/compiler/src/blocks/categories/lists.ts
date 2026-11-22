import { fileURLToPath } from 'node:url';
import uid from '../../util/uid.ts';
import data from './data.ts';
import { listMethods } from './list-bindings.ts';
import {
  NodeType,
  type Expression,
  type FunctionBinding,
  type FunctionDeclaration,
  type ListBinding,
  type ScratchInput
} from '../../types.ts';
import type Compiler from '../../compiler.ts';
import type Scope from '../../util/scope.ts';

const LIST_LIMIT = 200000;
const zero: ScratchInput = [1, [4, 0]];
const end: ScratchInput = [1, [4, LIST_LIMIT]];
const defaults: Record<string, ScratchInput[]> = {
  fill: [zero, end],
  lastIndexOf: [end],
  join: [[1, [10, ',']]]
};
const createsList = ['slice', 'copy', 'concat', 'splice', 'remove', 'map', 'filter'];
const returnsList = [...createsList, 'clear', 'fill', 'reverse', 'sort'];
export const listRuntimePath = fileURLToPath(new URL('../../internal/lists.claw', import.meta.url));
const listBlocks = data.globals.lists.members;

class ListOperations {
  private _compiler: Compiler;
  private _helperScopes: Record<string, Scope>;

  constructor (compiler: Compiler) {
    this._compiler = compiler;
    this._helperScopes = {};
  }

  create (name: string, constant = false): ListBinding {
    const id = uid();
    const field: ListBinding['field'] = [`${name}@${uid.shortUid()}`, id];
    this._compiler.root.lists[id] = [field[0], []];
    return {
      kind: 'list',
      field,
      constant
    };
  }

  async resolve (
    expression: Expression,
    scope: Scope,
    target?: ListBinding
  ): Promise<ListBinding | null> {
    if (expression.type === NodeType.Identifier || expression.type === NodeType.MemberExpression) {
      const binding = await this._compiler.resolveBinding(expression, scope);
      return binding?.kind === 'list' ? binding : null;
    }

    if (
      expression.type === NodeType.CallExpression &&
      expression.callee.type === NodeType.MemberExpression &&
      returnsList.includes(expression.callee.property)
    ) {
      const { object, property } = expression.callee;
      const source = await this.resolve(object, scope);

      if (source) {
        const result = await this.call(source, property, expression.arguments, scope, true, target);
        return result as ListBinding;
      }
    }

    return null;
  }

  private length (list: ListBinding) {
    return this.emitBlock(list, 'length');
  }

  async get (list: ListBinding, index: ScratchInput | null, scope: Scope) {
    if (!index) {
      return this.length(list);
    }

    if (index[0] === 1 && Array.isArray(index[1]) && [4, 5].includes(Number(index[1][0]))) {
      const value = Number(index[1][1]);

      if (Number.isInteger(value) && Math.abs(value) <= LIST_LIMIT) {
        return this.emitBlock(list, 'item', [this._compiler.number(value + 1)]);
      }
    }

    const value = await this._compiler.builtin('integer', [index], scope);
    return this.emitBlock(list, 'item', [this.offset(value, 1)]);
  }

  async set (list: ListBinding, index: ScratchInput | null, value: ScratchInput, scope: Scope) {
    if (index) {
      return this.callHelper('listSet', list, scope, [index, value], false);
    }

    return this.callHelper('listResize', list, scope, [value], false);
  }

  async assign (
    target: ListBinding,
    expression: Expression | null,
    scope: Scope,
    initializing = false
  ) {
    if (!expression || expression.type === NodeType.ArrayExpression) {
      const elements = expression?.type === NodeType.ArrayExpression ? expression.elements : [];

      if (elements.length > LIST_LIMIT) {
        throw new Error('List length exceeds the Scratch limit.');
      }

      const values = await this.parseItems(elements, scope, true);
      this.emitBlock(target, 'clear', [], scope);

      for (const value of values) {
        this.emitBlock(target, 'add', [value], scope);
      }
      return;
    }

    const source = await this.resolve(expression, scope, initializing ? target : undefined);

    if (!source) {
      throw new Error('A list needs an array literal or another list.');
    }

    if (source !== target) {
      await this.copy(source, target, scope);
    }
  }

  async call (
    list: ListBinding,
    name: string,
    expressions: Expression[],
    scope: Scope,
    asValue: boolean,
    target?: ListBinding
  ): Promise<ScratchInput | ListBinding> {
    if (!Object.hasOwn(listMethods, name)) {
      throw new Error(`Unknown list method "${name}".`);
    }

    const [minimum, maximum] = listMethods[name];
    if (expressions.length < minimum || expressions.length > maximum) {
      throw new Error(`Invalid number of arguments for list.${name}.`);
    }

    const compiler = this._compiler;
    const result = asValue && createsList.includes(name) ? target || this.create('$list') : null;

    if (name === 'map' || name === 'filter') {
      await this.transform(list, name, expressions[0], result, scope);
      return result || scope.lastBlock;
    }

    if (name === 'concat') {
      const values: (ListBinding | ScratchInput)[] = [];

      for (const expression of expressions) {
        if (expression.type === NodeType.ArrayExpression) {
          for (const value of await this.parseItems(expression.elements, scope, true)) {
            values.push(value);
          }
          continue;
        }

        const source = await this.resolve(expression, scope);
        values.push(source || (await this.parseItems([expression], scope, true))[0]);
      }

      if (result) {
        await this.copy(list, result, scope);

        for (const value of values) {
          if (typeof value === 'object' && 'field' in value) {
            await this.callHelper('listAppend', value, scope, [zero, end], false, result);
          } else {
            await this.add(result, [value], scope);
          }
        }
      }
      return result || scope.lastBlock;
    }

    const inputs = await this.parseItems(expressions, scope);
    const [first, second] = inputs;

    switch (name) {
      case 'push':
        await this.add(list, inputs, scope);
        return asValue ? this.length(list) : scope.lastBlock;
      case 'pop':
      case 'shift': {
        const index = name === 'pop' ? [1, [10, 'last']] as ScratchInput : compiler.number(1);
        const value = asValue ? compiler.capture(this.emitBlock(list, 'item', [index]), scope) : null;
        this.emitBlock(list, 'delete', [index], scope);
        return value || scope.lastBlock;
      }
      case 'clear':
        this.emitBlock(list, 'clear', [], scope);
        return asValue ? list : scope.lastBlock;
      case 'slice':
      case 'copy':
        if (result) {
          await this.copy(list, result, scope, first ? [first, second || end] : undefined);
        }
        return result || scope.lastBlock;
      case 'insert':
      case 'unshift':
      case 'splice':
      case 'remove': {
        const position = name === 'unshift'
          ? zero
          : await compiler.builtin('bound', [first, this.length(list)], scope);
        const removes = name === 'splice' || name === 'remove';
        const firstItem = removes ? 2 : 1;
        const values = name === 'unshift' ? inputs : inputs.slice(firstItem);

        if (removes) {
          const count = second || compiler.number(name === 'remove' ? 1 : LIST_LIMIT);
          const removed = await this.callHelper('listDeleteCount', list, scope, [position, count]);

          if (result) {
            this.emitBlock(result, 'clear', [], scope);
            await this.callHelper('listTake', list, scope, [position, removed], false, result);
          }

          await this.callHelper('listDelete', list, scope, [position, removed], false);
        }

        await this.add(list, values, scope, position);
        return result || (asValue && !removes ? this.length(list) : scope.lastBlock);
      }
      case 'indexOf':
      case 'includes': {
        if (!second && name === 'includes') {
          return this.emitBlock(list, 'contains', [first]);
        }

        const index = second
          ? await this.callHelper('listIndexOf', list, scope, inputs, asValue)
          : this.offset(this.emitBlock(list, 'indexOf', [first]), -1);

        if (name === 'includes' && asValue) {
          return compiler.reporter('operator_gt', {
            OPERAND1: index,
            OPERAND2: compiler.number(-1)
          });
        }
        return index;
      }
      default: {
        const helperName = `list${name[0].toUpperCase()}${name.slice(1)}`;
        const returnsSource = returnsList.includes(name);
        inputs.push(...(defaults[name] || []).slice(inputs.length - minimum));
        const value = await this.callHelper(helperName, list, scope, inputs, asValue && !returnsSource);
        return asValue && returnsSource ? list : value;
      }
    }
  }

  private emitBlock (
    list: ListBinding,
    method: keyof typeof listBlocks,
    inputs: ScratchInput[] = [],
    scope?: Scope
  ) {
    const compiler = this._compiler;
    const definition: FunctionBinding = listBlocks[method];
    const block = definition.create({
      inputs: [null, ...inputs],
      fields: [list.field],
      bodies: []
    }, compiler);

    return scope
      ? compiler.append(scope, block)
      : compiler.reporter(block.opcode, block.inputs, block.fields);
  }

  private offset (value: ScratchInput, offset: number) {
    return this._compiler.reporter('operator_add', {
      NUM1: value,
      NUM2: this._compiler.number(offset)
    });
  }

  private async parseItems (expressions: Expression[], scope: Scope, capture = false) {
    const values: ScratchInput[] = [];
    const compiler = this._compiler;

    for (const expression of expressions) {
      if (expression.type === NodeType.ArrayExpression) {
        throw new Error('Scratch list items must be scalar values.');
      }

      const value = await compiler.parseExpression(expression, scope, true);
      values.push(capture || expressions.length > 1 ? compiler.capture(value, scope) : value);
    }

    return values;
  }

  private async add (list: ListBinding, values: ScratchInput[], scope: Scope, start?: ScratchInput) {
    if (!values.length) {
      return;
    }

    const compiler = this._compiler;
    const full = compiler.reporter('operator_gt', {
      OPERAND1: this.length(list),
      OPERAND2: compiler.number(LIST_LIMIT - values.length)
    });
    await this.failIf(full, 'List length exceeds the Scratch limit.', scope);

    for (const [index, value] of values.entries()) {
      if (start) {
        this.emitBlock(list, 'insert', [this.offset(start, index + 1), value], scope);
      } else {
        this.emitBlock(list, 'add', [value], scope);
      }
    }
  }

  private async failIf (condition: ScratchInput, message: string, scope: Scope) {
    const compiler = this._compiler;
    const branch = compiler.append(scope, {
      opcode: 'control_if',
      inputs: { CONDITION: condition }
    });
    const failure = scope.createChild();
    await compiler.builtin('fail', [[1, [10, message]]], failure, false);
    compiler.attachSubstack(branch, 'SUBSTACK', failure);
  }

  private async copy (
    source: ListBinding,
    target: ListBinding,
    scope: Scope,
    range?: ScratchInput[]
  ) {
    this.emitBlock(target, 'clear', [], scope);
    if (range) {
      await this.callHelper('listAppend', source, scope, range, false, target);
    } else {
      await this.callHelper('listTake', source, scope, [zero, this.length(source)], false, target);
    }
  }

  private async callHelper (
    name: string,
    source: ListBinding,
    scope: Scope,
    args: ScratchInput[],
    asValue = true,
    target?: ListBinding
  ) {
    const compiler = this._compiler;
    const sort = name === 'listSort';
    // Scratch list fields are fixed when a procedure is compiled.
    const key = `$${source.field[1]}:${sort ? 'sort' : target?.field[1] || ''}`;
    let helperScope = this._helperScopes[key];

    if (!helperScope) {
      helperScope = compiler.builtins.createChild();
      helperScope.define('source', source);

      if (sort) {
        target = this.create('$sort');
      }

      if (target) {
        helperScope.define('target', target);
      }

      const program = compiler.loadProgram(listRuntimePath);
      const template = program.body.find((statement): statement is FunctionDeclaration => {
        return statement.type === NodeType.FunctionDeclaration && statement.name === 'listHelpers';
      });

      for (const declaration of template.body.body as FunctionDeclaration[]) {
        await compiler.parseFunction(declaration, helperScope);
      }

      this._helperScopes[key] = helperScope;
    }

    return compiler.builtin(helperScope.resolve(name) as FunctionBinding, args, scope, asValue);
  }

  private async transform (
    source: ListBinding,
    method: string,
    expression: Expression,
    target: ListBinding | null,
    scope: Scope
  ) {
    const compiler = this._compiler;
    let callback = await compiler.resolveBinding(expression, scope);

    if (callback?.kind !== 'function' || callback.args.length > 3 ||
        callback.args.some(argument => typeof argument !== 'number') ||
        (callback.args.length === 3 && !callback.listCallback)) {
      throw new Error(`${method} needs a function with up to three value parameters.`);
    }

    if (callback.args.length === 3) {
      callback = await callback.listCallback(source);
    }

    if (callback.compile) {
      const compile = callback.compile;
      delete callback.compile;
      await compile();
    }

    const helper = compiler.builtins.createChild();
    helper.internal = false;
    helper.parameters = callback.procedure?.captures || [];
    helper.define('callback', callback);
    helper.define('source', source);

    if (target) {
      helper.define('target', target);
      this.emitBlock(target, 'clear', [], scope);
    }

    const args = ['value', 'index'].slice(0, callback.args.length).join(', ');
    const call = `callback(${args})`;
    let apply = `${call};`;

    if (target) {
      apply = method === 'filter'
        ? `if (${call}) { lists.add(target, value); }`
        : `lists.replace(target, index + 1, ${call});`;
    }

    const binding = await compiler.parseBuiltin(`
      function* listTransform() {
        var count = source.length;
        ${target && method === 'map' ? 'repeat (count) { lists.add(target, ""); }' : ''}
        var index = 0;
        repeat (count) {
          if (index < source.length) {
            var value = lists.item(source, index + 1);
            ${apply}
          }
          index++;
        }
      }
    `, helper);

    await compiler.builtin(binding, [], scope, false);
  }
}

export default ListOperations;
