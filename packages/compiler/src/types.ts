import type CallFrame from './util/call-frame.ts';
import type Compiler from './compiler.ts';

// Tokens

export const enum TokenType {
  NUMBER = 'NUMBER',
  STRING = 'STRING',
  IDENTIFIER = 'IDENTIFIER',
  KEYWORD = 'KEYWORD',
  LPAREN = 'LPAREN',
  RPAREN = 'RPAREN',
  LBRACE = 'LBRACE',
  RBRACE = 'RBRACE',
  LBRACKET = 'LBRACKET',
  RBRACKET = 'RBRACKET',
  SEMICOLON = 'SEMICOLON',
  COMMA = 'COMMA',
  DOT = 'DOT',
  OPERATOR = 'OPERATOR',
  EQUALS = 'EQUALS',
  COMPARISON = 'COMPARISON',
  NOT = 'NOT',
  EOF = 'EOF'
}

export enum Keyword {
  if = 'if',
  else = 'else',
  while = 'while',
  for = 'for',
  repeat = 'repeat',
  function = 'function',
  'function*' = 'function*',
  return = 'return',
  const = 'const',
  var = 'var',
  true = 'true',
  false = 'false',
  import = 'import',
  export = 'export'
}

export interface Token {
  type: TokenType;
  value: string | number | null;
  line: number;
  col: number;
}

// Abstract syntax tree

export const enum NodeType {
  Program = 'Program',
  Block = 'Block',
  Assignment = 'Assignment',
  ExpressionStatement = 'ExpressionStatement',
  VarDeclaration = 'VarDeclaration',
  IfStatement = 'IfStatement',
  WhileStatement = 'WhileStatement',
  RepeatStatement = 'RepeatStatement',
  ForStatement = 'ForStatement',
  FunctionDeclaration = 'FunctionDeclaration',
  FunctionExpression = 'FunctionExpression',
  ReturnStatement = 'ReturnStatement',
  ImportStatement = 'ImportStatement',
  ExportStatement = 'ExportStatement',
  BinaryExpression = 'BinaryExpression',
  UnaryExpression = 'UnaryExpression',
  CallExpression = 'CallExpression',
  MemberExpression = 'MemberExpression',
  UpdateExpression = 'UpdateExpression',
  NumberLiteral = 'NumberLiteral',
  StringLiteral = 'StringLiteral',
  BooleanLiteral = 'BooleanLiteral',
  Identifier = 'Identifier'
}

export type Statement =
  | Assignment
  | ExpressionStatement
  | VarDeclaration
  | IfStatement
  | WhileStatement
  | RepeatStatement
  | ForStatement
  | FunctionDeclaration
  | ReturnStatement
  | ImportStatement
  | ExportStatement;

export type Expression =
  | BinaryExpression
  | UnaryExpression
  | FunctionExpression
  | CallExpression
  | MemberExpression
  | UpdateExpression
  | NumberLiteral
  | StringLiteral
  | BooleanLiteral
  | Identifier;

export interface Program {
  type: NodeType.Program;
  body: Statement[];
}

export interface Block {
  type: NodeType.Block;
  body: Statement[];
}

interface Assignment {
  type: NodeType.Assignment;
  target: Expression;
  value: Expression;
}

interface ExpressionStatement {
  type: NodeType.ExpressionStatement;
  expression: Expression;
}

export interface VarDeclaration {
  type: NodeType.VarDeclaration;
  name: string;
  constant: boolean;
  init: Expression | null;
}

export interface IfStatement {
  type: NodeType.IfStatement;
  test: Expression;
  consequent: Block;
  alternate: IfStatement | Block | null;
}

export interface WhileStatement {
  type: NodeType.WhileStatement;
  test: Expression;
  body: Block;
}

export interface RepeatStatement {
  type: NodeType.RepeatStatement;
  count: Expression;
  body: Block;
}

export interface ForStatement {
  type: NodeType.ForStatement;
  init: Statement;
  test: Expression;
  update: Expression;
  body: Block;
}

export interface FunctionDeclaration {
  type: NodeType.FunctionDeclaration;
  name: string;
  params: string[];
  warp: boolean;
  body: Block;
}

export interface FunctionExpression {
  type: NodeType.FunctionExpression;
  params: string[];
  warp: boolean;
  body: Block;
}

export interface ReturnStatement {
  type: NodeType.ReturnStatement;
  value: Expression | null;
}

export interface ImportStatement {
  type: NodeType.ImportStatement;
  names: string[];
  source: string;
  defaultImport: boolean;
}

export interface ExportStatement {
  type: NodeType.ExportStatement;
  names: string[];
}

export interface BinaryExpression {
  type: NodeType.BinaryExpression;
  operator: string;
  left: Expression;
  right: Expression;
}

export interface UnaryExpression {
  type: NodeType.UnaryExpression;
  operator: string;
  value: Expression;
}

interface CallExpression {
  type: NodeType.CallExpression;
  callee: Expression;
  arguments: Expression[];
}

export interface MemberExpression {
  type: NodeType.MemberExpression;
  object: Expression;
  property: string;
}

export interface UpdateExpression {
  type: NodeType.UpdateExpression;
  operator: string;
  argument: Expression;
}

interface NumberLiteral {
  type: NodeType.NumberLiteral;
  value: number;
}

interface StringLiteral {
  type: NodeType.StringLiteral;
  value: string;
}

interface BooleanLiteral {
  type: NodeType.BooleanLiteral;
  value: boolean;
}

export interface Identifier {
  type: NodeType.Identifier;
  name: string;
}

// Scratch project

type ScratchValue = string | number | boolean | null | ScratchValue[];

export type ScratchInput = string | [number, ...ScratchValue[]];

export interface Mutation {
  tagName: string;
  children: ScratchValue[];
  hasnext?: boolean;
  argumentdefaults?: string;
  argumentids?: string;
  argumentnames?: string;
  proccode?: string;
  warp?: boolean;
}

export interface ScratchBlock {
  opcode: string;
  next: string | null;
  parent: string | null;
  inputs: Record<string, ScratchInput>;
  fields: Record<string, ScratchValue[]>;
  shadow: boolean;
  topLevel: boolean;
  mutation?: Mutation;
  x: number;
  y: number;
}

export interface Sprite {
  isStage: boolean;
  name: string;
  variables: Record<string, [string, ScratchValue]>;
  lists: Record<string, [string, ScratchValue[]]>;
  broadcasts: Record<string, string>;
  blocks: Record<string, ScratchBlock>;
  comments: Record<string, Comment>;
  currentCostume: number;
  costumes: Costume[];
  sounds: Record<string, ScratchValue>[];
  volume: number;
  layerOrder: number;
  tempo: number;
  videoTransparency: number;
  videoState: string;
  textToSpeechLanguage: string | null;
}

interface Comment {
  blockId: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
  text: string;
}

interface Costume {
  name: string;
  bitmapResolution: number;
  dataFormat: string;
  assetId: string;
  md5ext: string;
  rotationCenterX: number;
  rotationCenterY: number;
}

export interface BlockOptions extends Partial<ScratchBlock> {
  opcode: string;
}

export interface SpriteOptions extends Partial<Sprite> {
  name: string;
}

// Scope bindings

// Numeric arguments use Scratch's primitive input tags.
export type FunctionArgument =
  | number
  | 'field'
  | 'body'
  | 'variable'
  | 'list'
  | 'broadcast';

export interface CallArguments {
  inputs: ScratchInput[];
  fields: ScratchBlock['fields'][string][];
  bodies: string[];
}

export interface FunctionBinding {
  kind: 'function';
  blockType: 'command' | 'reporter' | 'hat';
  compile?: () => Promise<void>;
  args: FunctionArgument[];
  create: (args: CallArguments, compiler: Compiler) => BlockOptions;
  procedure?: {
    frame: CallFrame | null;
    captures: string[];
  };
}

export interface VariableBinding {
  kind: 'variable';
  temporary?: boolean;
  get: FunctionBinding;
  set?: FunctionBinding;
  storage?: {
    name: string;
    id: string;
  };
}

export interface ObjectBinding {
  kind: 'object';
  members: Bindings;
}

export type Binding = VariableBinding | FunctionBinding | ObjectBinding;
export type Bindings = Record<string, Binding>;

// Compiler output

export interface ProjectMeta {
  agent: string;
  semver: string;
  vm: string;
}

export interface ZipOutputs {
  base64: string;
  string: string;
  text: string;
  binarystring: string;
  array: number[];
  uint8array: Uint8Array;
  arraybuffer: ArrayBuffer;
  blob: Blob;
  nodebuffer: Buffer;
}

export interface Monitor {
  id: string;
  mode: string;
  opcode: string;
  params: Record<string, string>;
  spriteName: string | null;
  visible: boolean;
  width: number;
  height: number;
  x: number;
  y: number;
}
