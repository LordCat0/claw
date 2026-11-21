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
  canStop: boolean;
  canThrow: boolean;
  private _compiler: Compiler;
  private _slots: number;
  private _bucket: [number, string];
  private _size: [number, string];

  constructor (compiler: Compiler, canStop: boolean, canThrow: boolean) {
    this._compiler = compiler;
    this.canStop = canStop;
    this.canThrow = canThrow;
    this.parameter = `$frame@${uid()}`;
    this._slots = 0;
    this._bucket = [4, '0'];
    this._size = [4, '0'];
    this.result = this.variable();
  }

  index (offset: number, base?: ScratchInput): ScratchInput {
    const frame = base || this._compiler.reporter('argument_reporter_string_number', {}, {
      VALUE: [this.parameter, null]
    });

    if (offset === 0) {
      return frame;
    }

    return this._compiler.reporter('operator_add', {
      NUM1: frame,
      NUM2: this._compiler.number(offset)
    });
  }

  exitStatus (base?: ScratchInput) {
    // An allocated frame can use its free-list link to record how it exits
    return listVariable(this._compiler.list('$frames'), this.index(0, base));
  }

  variable (): VariableBinding {
    const slot = ++this._slots;
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
    const list = this._compiler.list('$frames');
    const value = this._compiler.reporter('data_itemoflist', {
      INDEX: this.index(1, index)
    }, { LIST: list });

    if (this._compiler.arrays && !this.result.scalar) {
      const reference = this._compiler.read(
        listVariable(this._compiler.list('$locals'), this.index(1, index))
      );
      this._compiler.tagArray(value, reference);
    }

    return value;
  }

  async release (scope: Scope, index: ScratchInput) {
    // Threads stopped from outside can hold frames until the next project start
    await this._compiler.builtin('releaseFrame', [index, [1, this._bucket], [1, this._size]], scope, false);
  }

  finalize () {
    this._bucket[1] = String(this._compiler.registerFrame(this._slots));
    this._size[1] = String(this._slots);
  }
}

export default CallFrame;
