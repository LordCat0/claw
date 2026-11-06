import uid from './uid.ts';
import {
  BindingType,
  type Mutation,
  type ResolvedVariable
} from '../types.ts';

class Scope {
  parent: Scope | null;
  isFunction: boolean;
  id: string;
  variables: Record<string, string>;
  variableIds: Record<string, string>;
  functions: Record<string, Mutation>;
  params: Record<string, boolean>;
  lastBlock: string | null;

  constructor (parent: Scope | null = null, isFunction = false) {
    this.parent = parent;
    this.isFunction = isFunction;
    this.id = uid.shortUid();
    this.variables = {};
    this.variableIds = {};
    this.functions = {};
    this.params = {};
    this.lastBlock = null;
  }

  defineVariable (name: string, id: string) {
    if (name in this.variables) {
      throw new Error(`Variable "${name}" is already defined in this scope.`);
    }
    this.variables[name] = `${name}@${this.id}`;
    this.variableIds[name] = id;
  }

  defineParam (name: string) {
    this.params[name] = true;
  }

  importVariable (name: string, scopedName: string, id: string) {
    this.variables[name] = scopedName;
    this.variableIds[name] = id;
  }

  defineFunction (name: string, mutation: Mutation) {
    this.functions[name] = mutation;
  }

  resolveVariable (name: string): ResolvedVariable | null {
    if (name in this.variables)
      return {
        type: BindingType.Variable,
        name: this.variables[name],
        id: this.variableIds[name]
      };
    if (name in this.params) return { type: BindingType.Parameter };
    if (name in this.functions) return { type: BindingType.Function };
    if (this.parent) return this.parent.resolveVariable(name);
    return null;
  }

  resolveFunction (name: string): Mutation | null {
    if (name in this.functions) return this.functions[name];
    if (this.parent) return this.parent.resolveFunction(name);
    return null;
  }

  createChild (newFunction?: boolean) {
    return new Scope(this, newFunction || this.isFunction);
  }
}

export default Scope;
