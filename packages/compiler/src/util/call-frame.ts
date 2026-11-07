import uid from './uid.ts';
import CallStorage from './call-storage.ts';
import type Scope from './scope.ts';
import type Compiler from '../compiler.ts';
import type {
  ScratchInput,
  VariableBinding
} from '../types.ts';

class CallFrame {
  parameter: string;
  result: VariableBinding;
  private _compiler: Compiler;
  private _storage: CallStorage;
  private _slots: number;
  private _bucket: [number, string];

  constructor (compiler: Compiler) {
    this._compiler = compiler;
    this._storage = compiler.frameStorage || new CallStorage(compiler);
    compiler.frameStorage = this._storage;
    this.parameter = `$frame@${uid()}`;
    this._slots = 0;
    this._bucket = [4, '0'];
    this.result = this.variable();
  }

  index (slot = 0, base?: ScratchInput): ScratchInput {
    const frame = base || [2, this._compiler.insertBlock({
      opcode: 'argument_reporter_string_number',
      fields: { VALUE: [this.parameter, null] }
    })];
    return [2, this._compiler.insertBlock({
      opcode: 'operator_add',
      inputs: {
        NUM1: frame,
        NUM2: [1, [4, slot + 1]]
      }
    })];
  }

  variable (): VariableBinding {
    const slot = this._slots++;
    return {
      kind: 'variable',
      set: {
        kind: 'function',
        blockType: 'command',
        args: [10],
        create: ({ inputs }) => ({
          opcode: 'data_replaceitemoflist',
          fields: { LIST: this._storage.memory },
          inputs: {
            INDEX: this.index(slot),
            ITEM: inputs[0]
          }
        })
      },
      get: {
        kind: 'function',
        blockType: 'reporter',
        args: [],
        create: () => ({
          opcode: 'data_itemoflist',
          fields: { LIST: this._storage.memory },
          inputs: { INDEX: this.index(slot) }
        })
      }
    };
  }

  allocate (scope: Scope, asValue: boolean) {
    return this._storage.allocate(this._bucket, scope, asValue);
  }

  readResult (index: ScratchInput): ScratchInput {
    return [2, this._compiler.insertBlock({
      opcode: 'data_itemoflist',
      fields: { LIST: this._storage.memory },
      inputs: { INDEX: this.index(0, index) }
    })];
  }

  release (scope: Scope) {
    const base: ScratchInput = [2, this._compiler.insertBlock({
      opcode: 'argument_reporter_string_number',
      fields: { VALUE: [this.parameter, null] }
    })];
    this._storage.release(base, this._bucket, scope);
  }

  finalize () {
    this._bucket[1] = String(this._storage.register(this._slots));
  }
}

export default CallFrame;
