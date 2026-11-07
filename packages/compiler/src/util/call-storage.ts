import uid from './uid.ts';
import Scope from './scope.ts';
import type Compiler from '../compiler.ts';
import type { ScratchInput } from '../types.ts';

class CallStorage {
  memory: [string, string];
  private _compiler: Compiler;
  private _free: [string, string];
  private _allocated: string;
  private _sizes: number[];
  private _procedure: ReturnType<Compiler['createProcedure']>;

  constructor (compiler: Compiler) {
    this._compiler = compiler;
    this.memory = compiler.runtimeList('$locals');
    this._free = compiler.runtimeList('$free');
    this._allocated = uid();
    this._sizes = [];
    this._procedure = compiler.createProcedure('$allocate', ['$bucket'], true);
    compiler.stage.variables[this._allocated] = ['$allocated', 0];
  }

  register (size: number) {
    let bucket = this._sizes.indexOf(size);

    if (bucket === -1) {
      bucket = this._sizes.length;
      this._sizes.push(size);
      this._compiler.stage.lists[this._free[1]][1].push(0);
    }

    return bucket + 1;
  }

  allocate (bucket: [number, string], scope: Scope, asValue: boolean): ScratchInput {
    this._compiler.append(scope, {
      opcode: 'procedures_call',
      inputs: { [this._procedure.argumentIds[0]]: [1, bucket] },
      mutation: this._procedure.mutation
    });
    const index: ScratchInput = [3, [12, '$allocated', this._allocated], [10, '']];
    return asValue ? this._compiler.capture(index, scope) : index;
  }

  release (index: ScratchInput, bucket: [number, string], scope: Scope) {
    this._compiler.append(scope, {
      opcode: 'data_replaceitemoflist',
      fields: { LIST: this.memory },
      inputs: {
        INDEX: index,
        ITEM: [2, this._compiler.insertBlock({
          opcode: 'data_itemoflist',
          fields: { LIST: this._free },
          inputs: { INDEX: [1, bucket] }
        })]
      }
    });
    this._compiler.append(scope, {
      opcode: 'data_replaceitemoflist',
      fields: { LIST: this._free },
      inputs: {
        INDEX: [1, bucket],
        ITEM: index
      }
    });
  }

  initialize (scope: Scope) {
    for (let i = 0; i < this._sizes.length; i++) {
      this._compiler.append(scope, {
        opcode: 'data_addtolist',
        fields: { LIST: this._free },
        inputs: { ITEM: [1, [4, 0]] }
      });
    }
  }

  compileAllocator () {
    const compiler = this._compiler;
    const scope = new Scope();
    scope.lastBlock = this._procedure.definition;
    const bucket: ScratchInput = [2, compiler.insertBlock({
      opcode: 'argument_reporter_string_number',
      fields: { VALUE: ['$bucket', null] }
    })];
    const head: ScratchInput = [2, compiler.insertBlock({
      opcode: 'data_itemoflist',
      fields: { LIST: this._free },
      inputs: { INDEX: bucket }
    })];
    const choose = compiler.append(scope, {
      opcode: 'control_if_else',
      inputs: { CONDITION: head }
    });
    const reuse = new Scope();
    compiler.append(reuse, {
      opcode: 'data_setvariableto',
      fields: { VARIABLE: ['$allocated', this._allocated] },
      inputs: { VALUE: head }
    });
    compiler.append(reuse, {
      opcode: 'data_replaceitemoflist',
      fields: { LIST: this._free },
      inputs: {
        INDEX: bucket,
        ITEM: [2, compiler.insertBlock({
          opcode: 'data_itemoflist',
          fields: { LIST: this.memory },
          inputs: { INDEX: [3, [12, '$allocated', this._allocated], [10, '']] }
        })]
      }
    });
    const fresh = new Scope();
    compiler.append(fresh, {
      opcode: 'data_setvariableto',
      fields: { VARIABLE: ['$allocated', this._allocated] },
      inputs: {
        VALUE: [2, compiler.insertBlock({
          opcode: 'operator_add',
          inputs: {
            NUM1: [2, compiler.insertBlock({
              opcode: 'data_lengthoflist',
              fields: { LIST: this.memory }
            })],
            NUM2: [1, [4, 1]]
          }
        })]
      }
    });

    for (let i = 0; i < this._sizes.length; i++) {
      const cells = this._sizes.length === 1 ? fresh : new Scope();

      // Unrolled appends keep frame reservation atomic across scripts
      for (let slot = 0; slot <= this._sizes[i]; slot++) {
        compiler.append(cells, {
          opcode: 'data_addtolist',
          fields: { LIST: this.memory },
          inputs: { ITEM: [1, [10, '']] }
        });
      }

      if (this._sizes.length > 1) {
        const branch = compiler.append(fresh, {
          opcode: 'control_if',
          inputs: {
            CONDITION: [2, compiler.insertBlock({
              opcode: 'operator_equals',
              inputs: {
                OPERAND1: bucket,
                OPERAND2: [1, [4, i + 1]]
              }
            })]
          }
        });
        compiler.attachSubstack(branch, 'SUBSTACK', cells);
      }
    }

    compiler.attachSubstack(choose, 'SUBSTACK', reuse);
    compiler.attachSubstack(choose, 'SUBSTACK2', fresh);
  }
}

export default CallStorage;
