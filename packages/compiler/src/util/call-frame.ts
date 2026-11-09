import uid from './uid.ts';
import listVariable from './list-variable.ts';
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
  private _slots: number;
  private _bucket: [number, string];
  private _size: [number, string];

  constructor (compiler: Compiler) {
    this._compiler = compiler;
    this.parameter = `$frame@${uid()}`;
    this._slots = 0;
    this._bucket = [4, '0'];
    this._size = [4, '0'];
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
    const variable = listVariable(this._compiler.list('$frames'), this.index(slot));
    variable.scalar = false;

    if (this._compiler.arrays) {
      variable.reference = listVariable(
        this._compiler.list('$locals'), this.index(slot)
      );
    }

    return variable;
  }

  async allocate (scope: Scope) {
    return this._compiler.builtin('allocateFrame', [[1, this._bucket], [1, this._size]], scope);
  }

  readResult (index: ScratchInput): ScratchInput {
    const value: ScratchInput = [2, this._compiler.insertBlock({
      opcode: 'data_itemoflist',
      fields: { LIST: this._compiler.list('$frames') },
      inputs: { INDEX: this.index(0, index) }
    })];

    if (this._compiler.arrays && !this.result.scalar) {
      const reference = this._compiler.read(
        listVariable(this._compiler.list('$locals'), this.index(0, index))
      );
      this._compiler.tagArray(value, reference);
    }

    return value;
  }

  async release (scope: Scope, index: ScratchInput) {
    // shortcut: canceled frames live until reset, add cleanup when tracking script cancellation
    await this._compiler.builtin('releaseFrame', [index, [1, this._bucket], [1, this._size]], scope, false);
  }

  finalize () {
    this._bucket[1] = String(this._compiler.registerFrame(this._slots));
    this._size[1] = String(this._slots);
  }
}

export default CallFrame;
