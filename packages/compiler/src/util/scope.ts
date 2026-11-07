import uid from './uid.ts';
import type CallFrame from './call-frame.ts';
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
  firstBlock: string | null;
  lastBlock: string | null;
  frame: CallFrame | null;
  loopState: VariableBinding | null
  parameters: string[];
  temporaries: {
    values: VariableBinding[];
    next: number;
  };

  constructor (parent: Scope | null = null, isFunction = false) {
    this.parent = parent;
    this.isFunction = isFunction;
    this.id = uid.shortUid();
    this.bindings = {};
    this.firstBlock = null;
    this.lastBlock = null;
    this.frame = parent?.frame || null;
    this.loopState = parent?.loopState || null
    this.parameters = parent?.parameters || [];
    this.temporaries = parent?.temporaries || {
      values: [],
      next: 0
    };
  }

  define (name: string, binding: Binding) {
    if (Object.hasOwn(this.bindings, name)) {
      throw new Error(`"${name}" is already defined in this scope.`);
    }

    this.bindings[name] = binding;
  }

  defineVariable (name: string, id: string, constant = false) {
    if (this.isFunction) {
      const variable = this.frame.variable();
      this.define(name, variable);

      if (constant) {
        delete variable.set;
      }

      return variable;
    }

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

  defineParam (name: string, parameter = name) {
    this.define(name, {
      kind: 'variable',
      get: {
        kind: 'function',
        blockType: 'reporter',
        args: [],
        create: () => ({
          opcode: 'argument_reporter_string_number',
          fields: {
            VALUE: [parameter, null]
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
    const child = new Scope(this, newFunction || this.isFunction);

    if (newFunction) {
      child.loopState = null
      child.temporaries = {
        values: [],
        next: 0
      };
    }

    return child;
  }
}

export default Scope;
