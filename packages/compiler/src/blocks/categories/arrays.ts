import type Compiler from '../../compiler.ts';
import type Scope from '../../util/scope.ts';
import type { Bindings, Expression, FunctionBinding, ScratchInput } from '../../types.ts';

export const referenceVariables: Record<string, string[]> = {
  create: ['array'],
  get: ['result'],
  pop: ['result'],
  shift: ['result'],
  slice: ['result'],
  splice: ['removed'],
  joinValue: ['item'],
  transform: ['result', 'value']
};

export const arrayResults = [
  'create', 'get', 'at', 'set', 'pop', 'clear', 'shift', 'reverse',
  'fill', 'sort', 'slice', 'extend', 'splice', 'transform'
];

export const numericFunctions = [
  'enter', 'leave', 'clearRoot', 'clearLocal', 'allocateFrame', 'releaseFrame',
  'initialize', 'capacity', 'bucket', 'freeBuffer', 'reserve', 'mark', 'collect', 'compact'
];

export const internals: Bindings = {
  compiler: {
    kind: 'object',
    members: {
      array: {
        kind: 'function',
        blockType: 'reporter',
        args: [10],
        create: ({ inputs }) => ({
          opcode: 'operator_add',
          inputs: {
            NUM1: inputs[0],
            NUM2: [1, [4, 0]]
          }
        }),
        reference: ({ inputs }) => inputs[0]
      },
      reference: {
        kind: 'function',
        blockType: 'reporter',
        args: [10],
        create: ({ inputs }, compiler) => ({
          opcode: 'operator_add',
          inputs: {
            NUM1: compiler.arrayReference(inputs[0]),
            NUM2: [1, [4, 0]]
          }
        })
      },
      read: {
        kind: 'function',
        blockType: 'reporter',
        args: [4],
        create: ({ inputs }, compiler) => ({
          opcode: 'data_itemoflist',
          fields: { LIST: compiler.list('$values') },
          inputs: { INDEX: inputs[0] }
        }),
        reference: ({ inputs }, compiler) => compiler.reporter('data_itemoflist', {
          INDEX: inputs[0]
        }, { LIST: compiler.list('$references') })
      },
      join: {
        kind: 'function',
        blockType: 'reporter',
        args: [10, 10],
        create: ({ inputs }) => ({
          opcode: 'operator_join',
          inputs: {
            STRING1: inputs[0],
            STRING2: inputs[1]
          }
        })
      },
      waitUntil: {
        kind: 'function',
        blockType: 'command',
        args: [10],
        create: ({ inputs }, compiler) => ({
          opcode: 'control_wait_until',
          inputs: { CONDITION: compiler.boolean(inputs[0]) }
        })
      },
      arrays: {
        kind: 'variable',
        get: {
          kind: 'function',
          blockType: 'reporter',
          args: [],
          create: (_, compiler) => ({
            opcode: 'operator_equals',
            inputs: {
              OPERAND1: compiler.number(Number(compiler.arrays)),
              OPERAND2: compiler.number(1)
            }
          })
        }
      }
    }
  }
};

export default {
  arrays: {
    kind: 'object',
    members: {
      isArray: {
        kind: 'function',
        blockType: 'reporter',
        args: [10],
        create: ({ inputs }, compiler) => ({
          opcode: 'operator_gt',
          inputs: {
            OPERAND1: compiler.arrayReference(inputs[0]),
            OPERAND2: [1, [4, 0]]
          }
        })
      }
    }
  }
} satisfies Bindings;

export const arrayMethods: Record<string, [number, number]> = {
  at: [1, 1],
  push: [0, Infinity],
  pop: [0, 0],
  shift: [0, 0],
  unshift: [0, Infinity],
  insert: [2, Infinity],
  remove: [1, 2],
  clear: [0, 0],
  slice: [0, 2],
  concat: [0, Infinity],
  copy: [0, 0],
  splice: [1, Infinity],
  reverse: [0, 0],
  sort: [0, 0],
  fill: [1, 3],
  indexOf: [1, 2],
  lastIndexOf: [1, 2],
  includes: [1, 2],
  join: [0, 1],
  map: [1, 1],
  filter: [1, 1]
};

export async function arrayMethod (
  compiler: Compiler,
  object: Expression,
  name: string,
  expressions: Expression[],
  scope: Scope,
  asValue: boolean
) {
  if (!Object.hasOwn(arrayMethods, name)) {
    throw new Error(`Unknown array method "${name}".`);
  }

  const [min, max] = arrayMethods[name];

  if (expressions.length < min || expressions.length > max) {
    throw new Error(`Invalid number of arguments for array.${name}.`);
  }

  const array = compiler.capture(await compiler.parseExpression(object, scope, true), scope);

  if (name === 'map' || name === 'filter') {
    const callback = await compiler.resolveBinding(expressions[0], scope);

    if (!callback || callback.kind !== 'function' || callback.args.length > 3 ||
        callback.args.some(argument => typeof argument !== 'number')) {
      throw new Error(`${name} needs a function with up to three value parameters.`);
    }

    return transform(compiler, name, callback, array, scope, asValue);
  }

  const inputs: ScratchInput[] = [];

  for (const expression of expressions) {
    inputs.push(compiler.capture(await compiler.parseExpression(expression, scope, true), scope));
  }

  if (name === 'push') {
    let length: ScratchInput;

    for (let i = 0; i < inputs.length; i++) {
      length = await compiler.builtin(
        'push', [array, inputs[i]], scope, asValue && i === inputs.length - 1
      );
    }

    return length || compiler.builtin('length', [array], scope, asValue);
  }

  if (name === 'concat' || name === 'copy') {
    const result = await compiler.builtin('slice',
      [array, compiler.number(0), compiler.number(200000)], scope);

    for (const input of inputs) {
      await compiler.builtin('extend', [result, input], scope, false);
    }

    return asValue ? result : scope.lastBlock;
  }

  if (['splice', 'insert', 'remove', 'unshift'].includes(name)) {
    let start = compiler.number(0);
    let count = compiler.number(0);
    let values = inputs;

    if (name !== 'unshift') {
      start = inputs[0];
      values = inputs.slice(1);
    }

    if (name === 'splice' || name === 'remove') {
      count = inputs[1] || compiler.number(name === 'remove' ? 1 : 200000);
      values = inputs.slice(2);
    }

    const items = await compiler.builtin('create', [compiler.number(values.length)], scope);

    for (const value of values) {
      await compiler.builtin('push', [items, value], scope, false);
    }

    const returnsLength = name === 'insert' || name === 'unshift';
    const removed = await compiler.builtin('splice', [array, start, count, items], scope,
      asValue && !returnsLength);

    if (returnsLength && asValue) {
      return compiler.builtin('length', [array], scope);
    }

    return removed;
  }

  const defaults: Record<string, ScratchInput[]> = {
    slice: [compiler.number(0), compiler.number(200000)],
    fill: [compiler.number(0), compiler.number(200000)],
    indexOf: [compiler.number(0)],
    lastIndexOf: [compiler.number(200000)],
    includes: [compiler.number(0)],
    join: [[1, [10, ',']]]
  };

  for (const value of (defaults[name] || []).slice(inputs.length - min)) {
    inputs.push(value);
  }

  const result = await compiler.builtin(name === 'includes' ? 'indexOf' : name,
    [array, ...inputs], scope, asValue);

  if (name === 'includes' && asValue) {
    return compiler.reporter('operator_gt', {
      OPERAND1: result,
      OPERAND2: compiler.number(-1)
    });
  }

  return result;
}

async function transform (
  compiler: Compiler,
  method: string,
  callback: FunctionBinding,
  array: ScratchInput,
  scope: Scope,
  asValue: boolean
) {
  if (callback.compile) {
    const compile = callback.compile;
    delete callback.compile;
    await compile();
  }

  let entry = compiler.arrayCallbacks.find(value => value.method === method && value.callback === callback);

  if (!entry) {
    const callbackScope = compiler.builtins.createChild();
    callbackScope.parameters = callback.procedure?.captures || [];
    callbackScope.define('callback', callback);
    const parameters = ['value', 'index', 'array'].slice(0, callback.args.length).join(', ');
    const mapped = `callback(${parameters})`;
    const select = method === 'map'
      ? `set(result, index, ${mapped});`
      : `if (${mapped}) {
              push(result, value);
            }`;
    const binding = await compiler.parseBuiltin(`
      function* transform(array) {
        var count = length(array);
        var result = create(count);
        ${method === 'map' ? 'resize(result, count);' : ''}
        var index = 0;
        while (index < count) {
          if (index < length(array)) {
            var value = get(array, index);
            ${select}
          }
          index++;
        }
        return result;
      }
    `, callbackScope);
    entry = {
      method,
      callback,
      binding
    };
    compiler.arrayCallbacks.push(entry);
  }

  return compiler.builtin(entry.binding, [array], scope, asValue);
}
