import type CallFrame from './util/call-frame.ts';
import type Compiler from './compiler.ts';
import type { StructType } from './type-checker.ts';

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
  QUESTION = 'QUESTION',
  COLON = 'COLON',
  OPERATOR = 'OPERATOR',
  EQUALS = 'EQUALS',
  COMPARISON = 'COMPARISON',
  NOT = 'NOT',
  EOF = 'EOF'
}

export enum Keyword {
  if = 'if',
  else = 'else',
  switch = 'switch',
  case = 'case',
  default = 'default',
  while = 'while',
  for = 'for',
  repeat = 'repeat',
  break = 'break',
  continue = 'continue',
  function = 'function',
  'function*' = 'function*',
  return = 'return',
  try = 'try',
  catch = 'catch',
  throw = 'throw',
  const = 'const',
  var = 'var',
  list = 'list',
  struct = 'struct',
  true = 'true',
  false = 'false',
  import = 'import',
  export = 'export',
  type = 'type'
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
  SwitchStatement = 'SwitchStatement',
  WhileStatement = 'WhileStatement',
  RepeatStatement = 'RepeatStatement',
  ForStatement = 'ForStatement',
  BreakStatement = 'BreakStatement',
  ContinueStatement = 'ContinueStatement',
  FunctionDeclaration = 'FunctionDeclaration',
  FunctionExpression = 'FunctionExpression',
  ReturnStatement = 'ReturnStatement',
  TryStatement = 'TryStatement',
  ThrowStatement = 'ThrowStatement',
  ImportStatement = 'ImportStatement',
  ExportStatement = 'ExportStatement',
  TypeDeclaration = 'TypeDeclaration',
  StructDeclaration = 'StructDeclaration',
  BinaryExpression = 'BinaryExpression',
  ConditionalExpression = 'ConditionalExpression',
  UnaryExpression = 'UnaryExpression',
  CallExpression = 'CallExpression',
  MemberExpression = 'MemberExpression',
  IndexExpression = 'IndexExpression',
  ArrayExpression = 'ArrayExpression',
  StructLiteral = 'StructLiteral',
  UpdateExpression = 'UpdateExpression',
  NumberLiteral = 'NumberLiteral',
  StringLiteral = 'StringLiteral',
  BooleanLiteral = 'BooleanLiteral',
  Identifier = 'Identifier'
}

export type Statement =
  | Block
  | Assignment
  | ExpressionStatement
  | VarDeclaration
  | IfStatement
  | SwitchStatement
  | WhileStatement
  | RepeatStatement
  | ForStatement
  | BreakStatement
  | ContinueStatement
  | FunctionDeclaration
  | ReturnStatement
  | TryStatement
  | ThrowStatement
  | ImportStatement
  | ExportStatement
  | TypeDeclaration
  | StructDeclaration;

export type TypeSyntax =
  | {
    kind: 'reference';
    name: string;
    args: TypeSyntax[];
  }
  | {
    kind: 'literal';
    value: string | number | boolean;
  }
  | {
    kind: 'array';
    element: TypeSyntax;
  }
  | {
    kind: 'union';
    members: TypeSyntax[];
  }
  | {
    kind: 'function';
    params: {
      name: string;
      annotation: TypeSyntax;
    }[];
    result: TypeSyntax;
  };

export interface TypeDeclaration {
  type: NodeType.TypeDeclaration;
  name: string;
  annotation: TypeSyntax;
  exported?: boolean;
}

export interface StructDeclaration {
  type: NodeType.StructDeclaration;
  name: string;
  properties: {
    name: string;
    annotation?: TypeSyntax;
  }[];
  exported?: boolean;
}

export type Expression =
  | BinaryExpression
  | ConditionalExpression
  | UnaryExpression
  | FunctionExpression
  | CallExpression
  | MemberExpression
  | IndexExpression
  | ArrayExpression
  | StructLiteral
  | UpdateExpression
  | Literal
  | Identifier;

export type Literal = NumberLiteral | StringLiteral | BooleanLiteral;

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
  operator?: string;
}

interface ExpressionStatement {
  type: NodeType.ExpressionStatement;
  expression: Expression;
}

export interface VarDeclaration {
  type: NodeType.VarDeclaration;
  name: string;
  constant: boolean;
  list: boolean;
  init: Expression | null;
  annotation?: TypeSyntax;
}

export interface IfStatement {
  type: NodeType.IfStatement;
  test: Expression;
  consequent: Block;
  alternate: IfStatement | Block | null;
}

export interface SwitchStatement {
  type: NodeType.SwitchStatement;
  discriminant: Expression;
  cases: {
    test: Expression | null;
    body: Statement[];
  }[];
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
  update: Statement;
  body: Block;
}

export interface BreakStatement {
  type: NodeType.BreakStatement;
}

export interface ContinueStatement {
  type: NodeType.ContinueStatement;
}

export interface FunctionDeclaration {
  type: NodeType.FunctionDeclaration;
  name: string;
  params: string[];
  paramTypes?: (TypeSyntax | undefined)[];
  returnType?: TypeSyntax;
  warp: boolean;
  body: Block;
}

export interface FunctionExpression {
  type: NodeType.FunctionExpression;
  params: string[];
  paramTypes?: (TypeSyntax | undefined)[];
  returnType?: TypeSyntax;
  warp: boolean;
  body: Block;
}

export interface ReturnStatement {
  type: NodeType.ReturnStatement;
  value: Expression | null;
}

export interface TryStatement {
  type: NodeType.TryStatement;
  body: Block;
  parameter: string | null;
  handler: Block;
}

export interface ThrowStatement {
  type: NodeType.ThrowStatement;
  value: Expression;
}

export interface ImportStatement {
  type: NodeType.ImportStatement;
  names: string[];
  source: string;
  defaultImport: boolean;
  typeOnly?: boolean;
}

export interface ExportStatement {
  type: NodeType.ExportStatement;
  names: string[];
  typeOnly?: boolean;
}

export interface BinaryExpression {
  type: NodeType.BinaryExpression;
  operator: string;
  left: Expression;
  right: Expression;
}

export interface ConditionalExpression {
  type: NodeType.ConditionalExpression;
  test: Expression;
  consequent: Expression;
  alternate: Expression;
}

export interface UnaryExpression {
  type: NodeType.UnaryExpression;
  operator: string;
  value: Expression;
}

export interface CallExpression {
  type: NodeType.CallExpression;
  callee: Expression;
  arguments: Expression[];
}

export interface MemberExpression {
  type: NodeType.MemberExpression;
  object: Expression;
  property: string;
}

export interface IndexExpression {
  type: NodeType.IndexExpression;
  object: Expression;
  index: Expression;
}

export interface ArrayExpression {
  type: NodeType.ArrayExpression;
  elements: Expression[];
}

export interface StructLiteral {
  type: NodeType.StructLiteral;
  properties: {
    name: string;
    value: Expression;
  }[];
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

export type ScratchInput = string | [mode: number, value: ScratchValue, ...shadows: ScratchValue[]];

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
  resultType?: 'number' | 'string' | 'boolean' | 'never';
  compile?: () => Promise<void>;
  listCallback?: (list: ListBinding) => Promise<FunctionBinding>;
  args: FunctionArgument[];
  structParams?: (StructType | undefined)[];
  create: (args: CallArguments, compiler: Compiler) => BlockOptions;
  shared?: boolean;
  procedure?: {
    frame: CallFrame | null;
    captures: string[];
    results: VariableBinding[];
  };
}

export interface VariableBinding {
  kind: 'variable';
  temporary?: boolean;
  boolean?: boolean;
  constantValue?: Literal;
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
  struct?: {
    type: StructType;
    fields: VariableBinding[];
    constant: boolean;
  };
}

export interface ListBinding {
  kind: 'list';
  field: [string, string];
  constant: boolean;
}

export type Binding = VariableBinding | FunctionBinding | ObjectBinding | ListBinding;
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
