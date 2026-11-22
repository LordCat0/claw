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
  private _slotCount: number;
  private _bucketInput: [number, string];
  private _sizeInput: [number, string];

  constructor (compiler: Compiler, canStop: boolean, canThrow: boolean) {
    this._compiler = compiler;
    this.canStop = canStop;
    this.canThrow = canThrow;
    this.parameter = `$frame@${uid()}`;
    this._slotCount = 0;
    this._bucketInput = [4, '0'];
    this._sizeInput = [4, '0'];
    this.result = this.allocateSlot();
  }

  private slotIndex (offset: number, frameIndex?: ScratchInput): ScratchInput {
    const index = frameIndex || this._compiler.reporter('argument_reporter_string_number', {}, {
      VALUE: [this.parameter, null]
    });

    if (offset === 0) {
      return index;
    }

    return this._compiler.reporter('operator_add', {
      NUM1: index,
      NUM2: this._compiler.number(offset)
    });
  }

  exitStatus (frameIndex?: ScratchInput) {
    // An allocated frame can use its free-list link to record how it exits
    return listVariable(this._compiler.list('$frames'), this.slotIndex(0, frameIndex));
  }

  allocateSlot (): VariableBinding {
    return listVariable(this._compiler.list('$frames'), this.slotIndex(++this._slotCount));
  }

  async allocate (scope: Scope) {
    return this._compiler.builtin(
      'allocateFrame',
      [[1, this._bucketInput], [1, this._sizeInput]],
      scope
    );
  }

  readResult (frameIndex: ScratchInput, offset = 0): ScratchInput {
    return this._compiler.reporter('data_itemoflist', {
      INDEX: this.slotIndex(1 + offset, frameIndex)
    }, { LIST: this._compiler.list('$frames') });
  }

  async release (scope: Scope, frameIndex: ScratchInput) {
    // Threads stopped from outside can hold frames until the next project start
    await this._compiler.builtin('releaseFrame', [frameIndex, [1, this._bucketInput]], scope, false);
  }

  finalize () {
    // Recursive calls share these inputs before the frame size is known.
    this._bucketInput[1] = String(this._compiler.registerFrame(this._slotCount));
    this._sizeInput[1] = String(this._slotCount);
  }
}

export default CallFrame;
