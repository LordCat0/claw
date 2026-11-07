import uid from './uid.ts';
import type {
  Binding,
  Bindings,
  VariableBinding
} from '../types.ts';

class Scope {
  parent: Scope | null;
  isFunction: boolean;
  id: string;
  bindings: Bindings;
  lastBlock: string | null;

  constructor (parent: Scope | null = null, isFunction = false) {
    this.parent = parent;
    this.isFunction = isFunction;
    this.id = uid.shortUid();
    this.bindings = {};
    this.lastBlock = null;
  }

  define (name: string, binding: Binding) {
    if (Object.hasOwn(this.bindings, name)) {
      throw new Error(`"${name}" is already defined in this scope.`);
    }

    this.bindings[name] = binding;
  }

  defineVariable (name: string, id: string, constant = false) {
    const storage = {
      name: `${name}@${this.id}`,
      id
    };
    const variable: VariableBinding = {
      kind: 'variable',
      storage,
      get: {
        kind: 'function',
        blockType: 'reporter',
        args: [],
        create: () => ({
          opcode: 'data_variable',
          fields: {
            VARIABLE: [storage.name, storage.id]
          }
        })
      }
    };

    if (!constant) {
      variable.set = {
        kind: 'function',
        blockType: 'command',
        args: [10],
        create: ({ inputs }) => ({
          opcode: 'data_setvariableto',
          fields: {
            VARIABLE: [storage.name, storage.id]
          },
          inputs: {
            VALUE: inputs[0]
          }
        })
      };
    }

    this.define(name, variable);
    return variable;
  }

  defineParam (name: string) {
    this.define(name, {
      kind: 'variable',
      get: {
        kind: 'function',
        blockType: 'reporter',
        args: [],
        create: () => ({
          opcode: 'argument_reporter_string_number',
          fields: {
            VALUE: [name, null]
          }
        })
      }
    });
  }

  resolve (name: string): Binding | null {
    if (Object.hasOwn(this.bindings, name)) {
      return this.bindings[name];
    }

    if (this.parent) {
      return this.parent.resolve(name);
    }

    return null;
  }

  createChild (newFunction?: boolean) {
    return new Scope(this, newFunction || this.isFunction);
  }
}

export default Scope;
