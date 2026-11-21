import { fileURLToPath } from 'node:url';
import uid from '../../util/uid.ts';
import { arrayMethods } from './arrays.ts';
import data from './data.ts';
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

const limit = 200000;
const zero: ScratchInput = [1, [4, 0]];
const end: ScratchInput = [1, [4, limit]];
const defaults: Record<string, ScratchInput[]> = {
  fill: [zero, end],
  lastIndexOf: [end],
  join: [[1, [10, ',']]]
};
const copies = ['slice', 'copy', 'concat', 'splice', 'remove', 'map', 'filter'];
const returnsList = [...copies, 'clear', 'fill', 'reverse', 'sort'];
const helpersPath = fileURLToPath(new URL('../../internal/lists.claw', import.meta.url));
const listBlocks = data.globals.lists.members;

class ListOperations {
  private _compiler: Compiler;
  private _helpers: Record<string, Scope>;

  constructor (compiler: Compiler) {
    this._compiler = compiler;
    this._helpers = {};
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

  async resolve (expression: Expression, scope: Scope, target?: ListBinding): Promise<ListBinding | null> {
    if (expression.type === NodeType.Identifier || expression.type === NodeType.MemberExpression) {
      const binding = await this._compiler.resolveBinding(expression, scope);
      return binding?.kind === 'list' ? binding : null;
    }

    if (expression.type === NodeType.CallExpression && expression.callee.type === NodeType.MemberExpression &&
        returnsList.includes(expression.callee.property)) {
      const { object, property } = expression.callee;
      const source = await this.resolve(object, scope);

      if (source) {
        return await this.call(source, property, expression.arguments, scope, true, target) as ListBinding;
      }
    }

    return null;
  }

  private length (list: ListBinding) {
    return this.block(list, 'length');
  }

  async get (list: ListBinding, index: ScratchInput | null, scope: Scope) {
    if (!index) {
      return this.length(list);
    }

    if (index[0] === 1 && Array.isArray(index[1]) && [4, 5].includes(Number(index[1][0]))) {
      const value = Number(index[1][1]);

      if (Number.isInteger(value) && Math.abs(value) <= limit) {
        return this.block(list, 'item', [this._compiler.number(value + 1)]);
      }
    }

    const value = await this._compiler.builtin('integer', [index], scope);
    return this.block(list, 'item', [this.offset(value, 1)]);
  }

  async set (list: ListBinding, index: ScratchInput | null, value: ScratchInput, scope: Scope) {
    if (index) {
      return this.run('listSet', list, scope, [index, await this.scalar(value, scope)], false);
    }

    return this.run('listResize', list, scope, [value], false);
  }

  async assign (target: ListBinding, expression: Expression | null, scope: Scope, initializing = false) {
    if (!expression || expression.type === NodeType.ArrayExpression) {
      const elements = expression?.type === NodeType.ArrayExpression ? expression.elements : [];

      if (elements.length > limit) {
        throw new Error('List length exceeds the Scratch limit.');
      }

      const values = await this.values(elements, scope, true);
      this.block(target, 'clear', [], scope);

      for (const value of values) {
        this.block(target, 'add', [value], scope);
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
    if (!Object.hasOwn(arrayMethods, name)) {
      throw new Error(`Unknown list method "${name}".`);
    }

    const [min, max] = arrayMethods[name];
    if (expressions.length < min || expressions.length > max) {
      throw new Error(`Invalid number of arguments for list.${name}.`);
    }

    const compiler = this._compiler;
    const result = asValue && copies.includes(name) ? target || this.create('$list') : null;

    if (name === 'map' || name === 'filter') {
      await this.transform(list, name, expressions[0], result, scope);
      return result || scope.lastBlock;
    }

    if (name === 'concat') {
      const values: (ListBinding | ScratchInput)[] = [];

      for (const expression of expressions) {
        if (expression.type === NodeType.ArrayExpression) {
          for (const value of await this.values(expression.elements, scope, true)) {
            values.push(value);
          }
          continue;
        }

        const source = await this.resolve(expression, scope);
        values.push(source || (await this.values([expression], scope, true))[0]);
      }

      if (result) {
        await this.copy(list, result, scope);

        for (const value of values) {
          if (typeof value === 'object' && 'field' in value) {
            await this.run('listAppend', value, scope, [zero, end], false, result);
          } else {
            await this.add(result, [value], scope);
          }
        }
      }
      return result || scope.lastBlock;
    }

    const inputs = await this.values(expressions, scope);
    const [first, second] = inputs;

    switch (name) {
      case 'push':
        await this.add(list, inputs, scope);
        return asValue ? this.length(list) : scope.lastBlock;
      case 'pop':
      case 'shift': {
        const index = name === 'pop' ? [1, [10, 'last']] as ScratchInput : compiler.number(1);
        const value = asValue ? compiler.capture(this.block(list, 'item', [index]), scope) : null;
        this.block(list, 'delete', [index], scope);
        return value || scope.lastBlock;
      }
      case 'clear':
        this.block(list, 'clear', [], scope);
        return asValue ? list : scope.lastBlock;
      case 'slice':
      case 'copy':
        if (result) {
          await this.copy(list, result, scope, [first || zero, second || end]);
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
          const count = second || compiler.number(name === 'remove' ? 1 : limit);
          const removed = await this.run('listDeleteCount', list, scope, [position, count]);

          if (result) {
            this.block(result, 'clear', [], scope);
            await this.run('listTake', list, scope, [position, removed], false, result);
          }

          await this.run('listDelete', list, scope, [position, removed], false);
        }

        await this.add(list, values, scope, position);
        return result || (asValue && !removes ? this.length(list) : scope.lastBlock);
      }
      case 'indexOf':
      case 'includes': {
        if (!second && name === 'includes') {
          return this.block(list, 'contains', [first]);
        }

        const index = second
          ? await this.run('listIndexOf', list, scope, inputs, asValue)
          : this.offset(this.block(list, 'indexOf', [first]), -1);

        if (name === 'includes' && asValue) {
          return compiler.reporter('operator_gt', {
            OPERAND1: index,
            OPERAND2: compiler.number(-1)
          });
        }
        return index;
      }
      default: {
        const helper = `list${name[0].toUpperCase()}${name.slice(1)}`;
        const returnsSource = returnsList.includes(name);
        inputs.push(...(defaults[name] || []).slice(inputs.length - min));
        const value = await this.run(helper, list, scope, inputs, asValue && !returnsSource);
        return asValue && returnsSource ? list : value;
      }
    }
  }

  private block (
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

    return scope ? compiler.append(scope, block) : compiler.reporter(block.opcode, block.inputs, block.fields);
  }

  private offset (value: ScratchInput, offset: number) {
    return this._compiler.reporter('operator_add', {
      NUM1: value,
      NUM2: this._compiler.number(offset)
    });
  }

  private async values (expressions: Expression[], scope: Scope, capture = false) {
    const values: ScratchInput[] = [];
    const compiler = this._compiler;

    for (const expression of expressions) {
      if (expression.type === NodeType.ArrayExpression) {
        throw new Error('Scratch list items must be scalar values.');
      }

      const value = await compiler.parseExpression(expression, scope, true);
      values.push(await this.scalar(value, scope, capture || expressions.length > 1));
    }

    return values;
  }

  private async scalar (value: ScratchInput, scope: Scope, capture = false) {
    const compiler = this._compiler;
    value = capture || !compiler.isScalar(value) ? compiler.capture(value, scope) : value;

    if (!compiler.isScalar(value)) {
      const isArray = compiler.reporter('operator_gt', {
        OPERAND1: compiler.arrayReference(value),
        OPERAND2: compiler.number(0)
      });
      await this.failIf(isArray, 'Scratch list items must be scalar values.', scope);
    }

    return value;
  }

  private async add (list: ListBinding, values: ScratchInput[], scope: Scope, start?: ScratchInput) {
    if (!values.length) {
      return;
    }

    const compiler = this._compiler;
    const full = compiler.reporter('operator_gt', {
      OPERAND1: this.length(list),
      OPERAND2: compiler.number(limit - values.length)
    });
    await this.failIf(full, 'List length exceeds the Scratch limit.', scope);

    for (const [index, value] of values.entries()) {
      if (start) {
        this.block(list, 'insert', [this.offset(start, index + 1), value], scope);
      } else {
        this.block(list, 'add', [value], scope);
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
    range = [zero, end]
  ) {
    this.block(target, 'clear', [], scope);
    await this.run('listAppend', source, scope, range, false, target);
  }

  private async run (
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
    let helper = this._helpers[key];

    if (!helper) {
      helper = compiler.builtins.createChild();
      helper.define('source', source);

      if (sort) {
        target = this.create('$sort');
      }

      if (target) {
        helper.define('target', target);
      }

      const program = compiler.loadPrograms(helpersPath);
      for (const declaration of program.body as FunctionDeclaration[]) {
        await compiler.parseFunction(declaration, helper);
      }

      this._helpers[key] = helper;
    }

    return compiler.builtin(helper.resolve(name) as FunctionBinding, args, scope, asValue);
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
      this.block(target, 'clear', [], scope);
    }

    const args = ['value', 'index'].slice(0, callback.args.length).join(', ');
    const call = `callback(${args})`;
    let apply = `${call};`;

    if (target) {
      apply = method === 'filter'
        ? `if (${call}) { lists.add(target, value); }`
        : `lists.replace(target, index + 1, ${call});`;

      if (method === 'map' && compiler.arrays) {
        apply = `target[index] = ${call};`;
      }
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
