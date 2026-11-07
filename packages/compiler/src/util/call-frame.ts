import uid from './uid.ts';
import Scope from './scope.ts';
import type Compiler from '../compiler.ts';
import type {
  ScratchInput,
  VariableBinding
} from '../types.ts';

class CallFrame {
  compiler: Compiler;
  parameter: string;
  result: VariableBinding;
  private _slots: number;
  private _memory: [string, string];
  private _free: [string, string];
  private _allocated: string;
  private _allocator: string;

  constructor (compiler: Compiler) {
    this.compiler = compiler;
    this.parameter = `$frame@${uid()}`;
    this._slots = 0;
    this._memory = compiler.runtimeList('$locals');
    this._free = compiler.runtimeList('$free');
    this._allocated = uid();
    this._allocator = `$allocate@${uid.shortUid()}`;
    compiler.stage.variables[this._allocated] = ['$allocated', 0];
    this.result = this.variable();
  }

  index (slot = 0): ScratchInput {
    const base: ScratchInput = [2, this.compiler.insertBlock({
      opcode: 'argument_reporter_string_number',
      fields: {
        VALUE: [this.parameter, null]
      }
    })];

    if (!slot) {
      return base;
    }

    return [2, this.compiler.insertBlock({
      opcode: 'operator_add',
      inputs: {
        NUM1: base,
        NUM2: [1, [4, slot]]
      }
    })];
  }

  variable (): VariableBinding {
    const slot = this._slots++;
    const set: VariableBinding['set'] = {
      kind: 'function',
      blockType: 'command',
      args: [10],
      create: ({ inputs }) => ({
        opcode: 'data_replaceitemoflist',
        fields: { LIST: this._memory },
        inputs: {
          INDEX: this.index(slot),
          ITEM: inputs[0]
        }
      })
    };

    return {
      kind: 'variable',
      set,
      get: {
        kind: 'function',
        blockType: 'reporter',
        args: [],
        create: () => ({
          opcode: 'data_itemoflist',
          fields: { LIST: this._memory },
          inputs: { INDEX: this.index(slot) }
        })
      }
    };
  }

  allocate (scope: Scope, asValue: boolean): ScratchInput {
    this.compiler.append(scope, {
      opcode: 'procedures_call',
      mutation: {
        tagName: 'mutation',
        children: [],
        proccode: this._allocator,
        argumentids: '[]',
        warp: true
      }
    });

    const index: ScratchInput = [3, [12, '$allocated', this._allocated], [10, '']];
    return asValue ? this.compiler.capture(index, scope) : index;
  }

  readResult (index: ScratchInput): ScratchInput {
    return [2, this.compiler.insertBlock({
      opcode: 'data_itemoflist',
      fields: { LIST: this._memory },
      inputs: { INDEX: index }
    })];
  }

  release (index: ScratchInput, scope: Scope) {
    // Results are copied before frame reuse
    this.compiler.append(scope, {
      opcode: 'data_addtolist',
      fields: { LIST: this._free },
      inputs: { ITEM: index }
    });
  }

  compileAllocator () {
    const procedure = this.compiler.createProcedure(this._allocator, [], true);
    const scope = new Scope();
    scope.lastBlock = procedure.definition;
    const choose = this.compiler.append(scope, {
      opcode: 'control_if_else',
      inputs: {
        CONDITION: [2, this.compiler.insertBlock({
          opcode: 'data_lengthoflist',
          fields: { LIST: this._free }
        })]
      }
    });
    const reuse = new Scope();
    this.compiler.append(reuse, {
      opcode: 'data_setvariableto',
      fields: { VARIABLE: ['$allocated', this._allocated] },
      inputs: {
        VALUE: [2, this.compiler.insertBlock({
          opcode: 'data_itemoflist',
          fields: { LIST: this._free },
          inputs: { INDEX: [1, [10, 'last']] }
        })]
      }
    });
    this.compiler.append(reuse, {
      opcode: 'data_deleteoflist',
      fields: { LIST: this._free },
      inputs: { INDEX: [1, [10, 'last']] }
    });
    const fresh = new Scope();
    this.compiler.append(fresh, {
      opcode: 'data_setvariableto',
      fields: { VARIABLE: ['$allocated', this._allocated] },
      inputs: {
        VALUE: [2, this.compiler.insertBlock({
          opcode: 'operator_add',
          inputs: {
            NUM1: [2, this.compiler.insertBlock({
              opcode: 'data_lengthoflist',
              fields: { LIST: this._memory }
            })],
            NUM2: [1, [4, 1]]
          }
        })]
      }
    });

    for (let slot = 0; slot < this._slots; slot++) {
      this.compiler.append(fresh, {
        opcode: 'data_addtolist',
        fields: { LIST: this._memory },
        inputs: { ITEM: [1, [10, '']] }
      });
    }

    this.compiler.attachSubstack(choose, 'SUBSTACK', reuse);
    this.compiler.attachSubstack(choose, 'SUBSTACK2', fresh);
  }
}

export default CallFrame;
