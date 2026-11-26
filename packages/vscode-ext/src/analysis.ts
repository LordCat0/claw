import { extensions, globals } from '../../compiler/src/blocks/index.ts';
import { internals, listMethods } from '../../compiler/src/blocks/categories/list-bindings.ts';
import TypeChecker, { type ValueType } from '../../compiler/src/type-checker.ts';
import { assetImport } from '../../compiler/src/util/asset-import.ts';
import {
  NodeType,
  TokenType,
  type Bindings,
  type Block,
  type Expression,
  type FunctionBinding,
  type Statement
} from '../../compiler/src/types.ts';
import type { Problem, Range, SourceToken } from './parser.ts';
import { Imports } from './imports.ts';

interface Symbol {
  name: string;
  kind: 'function' | 'variable' | 'constant' | 'parameter'
    | 'object' | 'import' | 'type' | 'enum' | 'enumMember';
  origin?: string;
  parameters?: string[];
  blockType?: FunctionBinding['blockType'];
  args?: FunctionBinding['args'];
  arity?: [number, number];
  readOnly?: boolean;
  procedure?: Procedure;
  members?: Symbols;
  declaration?: Range;
  definition?: Definition;
}

interface Definition {
  file: string;
  range: Range;
}

type Symbols = Record<string, Symbol>;
type ExpressionUse = 'value' | 'statement' | 'binding' | 'call' | 'assign' | 'increment' | 'decrement';

interface Scope extends Range {
  parent?: Scope;
  kind: 'module' | 'block' | 'function' | 'loop' | 'switch' | 'try';
  symbols: Symbol[];
  types?: Symbol[];
}

interface Procedure {
  body: Block;
  scope: Scope;
  visited: boolean;
}

function describeBindings (bindings: Bindings, origin: string): Symbols {
  return Object.fromEntries(Object.entries(bindings).map(([name, binding]) => {
    const symbol: Symbol = {
      name,
      kind: binding.kind === 'list' ? 'variable' : binding.kind,
      origin
    };
    if (binding.kind === 'object') {
      symbol.members = describeBindings(binding.members, origin);
    }
    if (binding.kind === 'function') {
      symbol.blockType = binding.blockType;
      symbol.args = binding.args;
      symbol.parameters = binding.args.map((argument, index) => {
        return typeof argument === 'string' ? `${argument}${index + 1}` : `arg${index + 1}`;
      });
    }
    if (binding.kind === 'variable') {
      symbol.readOnly = !binding.set;
    }
    return [name, symbol];
  }));
}

const builtins = describeBindings(globals, 'Claw built-in');
const internalBuiltins = { ...builtins, ...describeBindings(internals, 'Claw compiler') };
const modules = Object.fromEntries(Object.entries(extensions).map(([name, members]) => {
  return [name, describeBindings(members, `${name} extension`)];
}));
const listMembers: Symbols = {
  length: {
    name: 'length',
    kind: 'variable'
  },
  ...Object.fromEntries(Object.entries(listMethods).map(([name, [min, max]]) => {
    const count = Number.isFinite(max) ? max : min;
    const parameters = Array.from({ length: count }, (_, index) => {
      const name = `arg${index + 1}`;
      return index < min ? name : `${name}?`;
    });
    if (!Number.isFinite(max)) {
      parameters.push('...values');
    }
    return [name, {
      name,
      kind: 'function',
      parameters,
      arity: [min, max]
    }];
  }))
};

export class Analysis {
  syntax: Imports['entry'];
  types: TypeChecker;
  structFields: SourceToken[] = [];
  scopes: Scope[];
  errors: Problem[] = [];
  unreachable: Range[] = [];
  private internal: boolean;
  private builtins: Symbols;
  private definitions: { source: Range; target: Definition }[] = [];
  private dependencies: Record<string, Imports['entry']> = Object.create(null);
  private functions: Procedure[] = [];
  private reachable = true;

  static async create (source: string, internal = false, file = '') {
    const imports = new Imports(source, file);
    await imports.load();
    return new Analysis(source, internal, file, imports);
  }

  constructor (
    source: string,
    internal = false,
    file = '',
    readonly imports = new Imports(source, file)
  ) {
    this.syntax = imports.entry;
    this.internal = internal;
    this.builtins = internal ? internalBuiltins : builtins;
    this.types = new TypeChecker(internal ? {
      ...globals,
      ...internals
    } : globals, extensions);
    this.types.on('loadModule', ({ source, importer, resolve, reject }) => {
      try {
        const syntax = imports.resolve(source, importer);
        if (syntax && importer === file) {
          this.dependencies[source] = syntax;
        }
        resolve(syntax);
      } catch (error) {
        reject(error);
      }
    });
    this.types.check(this.syntax);
    for (const problem of this.types.problems) {
      if (problem.file === file) {
        this.report(problem.message, problem.token as SourceToken);
      }
    }
    const root: Scope = {
      start: 0,
      end: source.length + 1,
      kind: 'module',
      symbols: []
    };
    this.scopes = [root];
    this.visitBody(this.syntax.program.body, root);
    for (const procedure of this.functions) {
      this.visitProcedure(procedure);
    }
  }

  private importSymbol (
    source: string,
    type: ValueType | undefined,
    definition?: Definition
  ): Omit<Symbol, 'name'> {
    const symbol: Omit<Symbol, 'name'> = {
      kind: 'import',
      origin: `Import from '${source}'`,
      definition
    };
    if (typeof type === 'object' && type.kind === 'function') {
      symbol.kind = 'function';
      symbol.parameters = type.params.map(parameter => parameter.name);
    } else if (typeof type === 'object' && type.kind === 'array') {
      symbol.members = listMembers;
    } else if (typeof type === 'object' && (type.kind === 'object' || type.kind === 'struct')) {
      const members = type.kind === 'object' ? type.members : Object.fromEntries(
        Object.entries(type.properties).map(([name, property]) => [name, property.type])
      );
      symbol.kind = type.kind === 'object' ? 'object' : 'import';
      symbol.members = Object.fromEntries(Object.entries(members).map(([name, member]) => {
        return [name, {
          name,
          ...this.importSymbol(source, member)
        }];
      }));
    }
    return symbol;
  }

  visitBody (body: Statement[], scope: Scope) {
    const reachable = this.reachable;
    let stopped = false;
    let unreachable: Statement | undefined;
    for (const statement of body) {
      if (stopped && !unreachable) {
        unreachable = statement;
      }
      this.reachable = reachable && !stopped;
      stopped = this.visit(statement, scope) || stopped;
    }
    this.reachable = reachable;
    if (unreachable) {
      this.markUnreachable(unreachable, body.at(-1));
    }
    return stopped;
  }

  markUnreachable (statement: Statement, last = statement) {
    const { first } = this.syntax.spans.get(statement);
    const { end } = this.syntax.spans.get(last);
    this.unreachable.push({
      start: this.syntax.tokens[first].start,
      end
    });
  }

  addScope (node: Statement, parent: Scope, kind: Scope['kind'] = 'block'): Scope {
    const { first, end, open } = this.syntax.spans.get(node);
    const scope: Scope = {
      start: this.syntax.tokens[first].start,
      end: open ? end + 1 : end,
      parent,
      kind,
      symbols: []
    };
    this.scopes.push(scope);
    return scope;
  }

  define (scope: Scope, token: SourceToken, binding: Omit<Symbol, 'name' | 'declaration'>) {
    const name = String(token.value);
    if (scope.symbols.some(symbol => symbol.name === name)) {
      this.report(`"${name}" is already defined in this scope.`, token);
      return;
    }
    const symbol: Symbol = {
      ...binding,
      name,
      declaration: token
    };
    scope.symbols.push(symbol);
  }

  defineEnum (
    scope: Scope,
    token: SourceToken,
    members: { name: string; declaration?: Range }[],
    definition?: Definition
  ) {
    const symbols: Symbols = Object.create(null);
    for (const member of members) {
      symbols[member.name] = {
        ...member,
        kind: 'enumMember'
      };
    }
    this.define(scope, token, {
      kind: 'enum',
      members: symbols,
      definition
    });
  }

  report (message: string, range: Range) {
    if (range) {
      this.errors.push({
        message,
        start: range.start,
        end: range.end
      });
    }
  }

  lookup (name: string, scope: Scope) {
    for (let current = scope; current; current = current.parent) {
      const symbol = current.symbols.find(symbol => symbol.name === name);
      if (symbol) {
        return symbol;
      }
    }
    if (Object.hasOwn(this.builtins, name)) {
      return this.builtins[name];
    }
  }

  inside (scope: Scope, ...kinds: Scope['kind'][]) {
    for (let current = scope; current; current = current.parent) {
      if (kinds.includes(current.kind)) {
        return true;
      }
      if (current.kind === 'function') {
        break;
      }
    }
    return false;
  }

  addProcedure (body: Block, parent: Scope) {
    const scope = this.addScope(body, parent, 'function');
    for (const parameter of this.syntax.names.get(body)) {
      this.define(scope, parameter, { kind: 'parameter' });
    }
    const procedure: Procedure = {
      body,
      scope,
      visited: false
    };
    this.functions.push(procedure);
    return procedure;
  }

  visitProcedure (procedure: Procedure) {
    if (!procedure.visited) {
      procedure.visited = true;
      this.visitBody(procedure.body.body, procedure.scope);
    }
  }

  visit (node: Statement, scope: Scope): boolean {
    switch (node.type) {
      case NodeType.VarDeclaration: {
        const { first } = this.syntax.spans.get(node);
        const token = this.syntax.tokens[first + (node.constant ? 2 : 1)];
        const value = node.init && this.visitExpression(node.init, scope, 'binding');
        if (!node.list && (value?.kind === 'function' || value?.kind === 'object' || value?.kind === 'import')) {
          this.define(scope, token, value);
        } else {
          this.define(scope, token, {
            kind: node.constant ? 'constant' : 'variable',
            members: node.list ? listMembers : value?.members
          });
        }
        return false;
      }
      case NodeType.ImportStatement: {
        const dependency = this.dependencies[node.source];
        const importFile = dependency?.file;
        const asset = !importFile && assetImport(node.source);
        const custom = this.syntax.extensionImports?.[node.source];
        let members = !importFile && Object.hasOwn(modules, node.source) ? modules[node.source] : undefined;
        if (custom) {
          members = describeBindings(custom.bindings, `Import from '${node.source}'`);
        }
        const runtime = this.types.imports.get(node);
        const declarations = dependency?.program.body.filter(statement => {
          return 'name' in statement || statement.type === NodeType.ImportStatement;
        }).flatMap(statement => dependency.names.get(statement) || []);
        const { first, end } = this.syntax.spans.get(node);
        const sourceToken = this.syntax.tokens.find(token => {
          return token.start >= this.syntax.tokens[first].start && token.end <= end &&
            token.type === TokenType.STRING && token.value === node.source;
        });
        if (importFile && sourceToken) {
          this.definitions.push({
            source: sourceToken,
            target: {
              file: importFile,
              range: { start: 0, end: 0 }
            }
          });
        }
        for (const [index, name] of node.names.entries()) {
          const token = this.syntax.names.get(node)[index];
          const type = this.types.hovers.get(token);
          const declaration = declarations?.findLast(token => token.value === name);
          const definition = declaration ? {
            file: importFile,
            range: declaration
          } : undefined;
          if (definition) {
            this.definitions.push({
              source: token,
              target: definition
            });
          }
          if (!node.typeOnly && typeof type === 'object' && type.kind === 'enum') {
            this.defineEnum(scope, token, Object.keys(type.members).map(name => ({ name })), definition);
            continue;
          }
          if (node.typeOnly || (runtime && !runtime.includes(name))) {
            this.syntax.typeTokens.push(token);
            scope.types ||= [];
            scope.types.push({
              name,
              kind: 'type',
              declaration: token,
              definition
            });
            continue;
          }
          if (asset) {
            this.define(scope, token, { kind: 'constant' });
          } else if (members && node.defaultImport) {
            this.define(scope, token, {
              kind: 'object',
              members
            });
          } else if (members && Object.hasOwn(members, name)) {
            this.define(scope, token, members[name]);
          } else {
            this.define(scope, token, this.importSymbol(node.source, type, definition));
          }
        }
        return false;
      }
      case NodeType.ExportStatement: {
        const runtime = this.types.exports.get(node);
        for (const [index, name] of node.names.entries()) {
          if (node.typeOnly || (runtime && !runtime.includes(name))) {
            this.syntax.typeTokens.push(this.syntax.names.get(node)[index]);
          }
        }
        return false;
      }
      case NodeType.TypeDeclaration:
        return false;
      case NodeType.StructDeclaration:
        for (const property of node.properties) {
          this.structFields.push(this.syntax.locations.get(property) as SourceToken);
        }
        return false;
      case NodeType.EnumDeclaration: {
        const [token] = this.syntax.names.get(node);
        this.defineEnum(scope, token, node.members.map(member => ({
          name: member.name,
          declaration: this.syntax.locations.get(member) as SourceToken
        })));
        return false;
      }
      case NodeType.FunctionDeclaration: {
        const { first } = this.syntax.spans.get(node);
        this.define(scope, this.syntax.tokens[first + 1], {
          kind: 'function',
          parameters: node.params,
          procedure: this.addProcedure(node.body, scope)
        });
        return false;
      }
      case NodeType.Assignment:
        this.visitExpression(node.target, scope, 'assign');
        this.visitExpression(node.value, scope);
        return false;
      case NodeType.ExpressionStatement:
        this.visitExpression(node.expression, scope, 'statement');
        return false;
      case NodeType.Block:
        return this.visitBody(node.body, this.addScope(node, scope));
      case NodeType.TryStatement: {
        const bodyScope = this.addScope(node.body, scope, 'try');
        const stopped = this.visitBody(node.body.body, bodyScope);
        const handlerScope = this.addScope(node.handler, scope);
        if (node.parameter) {
          const [parameter] = this.syntax.names.get(node);
          handlerScope.start = parameter.start;
          this.define(handlerScope, parameter, { kind: 'variable' });
        }
        const handlerStopped = this.visitBody(node.handler.body, handlerScope);
        return stopped && handlerStopped;
      }
      case NodeType.ThrowStatement:
        this.visitExpression(node.value, scope);
        return true;
      case NodeType.IfStatement: {
        this.visitExpression(node.test, scope);
        const consequent = this.visit(node.consequent, scope);
        const alternate = node.alternate && this.visit(node.alternate, scope);
        const test = this.types.enumMembers.get(node.test) || node.test;
        if (test.type === NodeType.BooleanLiteral) {
          const unreachable = test.value ? node.alternate : node.consequent;
          if (unreachable) {
            this.markUnreachable(unreachable);
          }
          return test.value ? consequent : !!alternate;
        }
        return consequent && !!alternate;
      }
      case NodeType.SwitchStatement: {
        this.visitExpression(node.discriminant, scope);
        const switchScope = this.addScope(node, scope, 'switch');
        for (const { test, body } of node.cases) {
          if (test) {
            this.visitExpression(test, switchScope);
          }
          this.visitBody(body, switchScope);
        }
        return false;
      }
      case NodeType.ForStatement: {
        const forScope = this.addScope(node, scope);
        this.visit(node.init, forScope);
        this.visitExpression(node.test, forScope);
        this.visitBody(node.body.body, this.addScope(node.body, forScope, 'loop'));
        this.visit(node.update, forScope);
        const test = this.types.enumMembers.get(node.test) || node.test;
        if (test.type === NodeType.BooleanLiteral && !test.value) {
          this.markUnreachable(node.body);
        }
        return false;
      }
      case NodeType.WhileStatement: {
        this.visitExpression(node.test, scope);
        this.visitBody(node.body.body, this.addScope(node.body, scope, 'loop'));
        const test = this.types.enumMembers.get(node.test) || node.test;
        if (test.type === NodeType.BooleanLiteral && !test.value) {
          this.markUnreachable(node.body);
        }
        return false;
      }
      case NodeType.RepeatStatement:
        this.visitExpression(node.count, scope);
        this.visitBody(node.body.body, this.addScope(node.body, scope, 'loop'));
        return false;
      case NodeType.ReturnStatement: {
        const { first } = this.syntax.spans.get(node);
        if (!this.inside(scope, 'function')) {
          this.report('Return statements can only be used inside functions.', this.syntax.tokens[first]);
        }
        if (node.value) {
          this.visitExpression(node.value, scope);
        }
        return true;
      }
      case NodeType.BreakStatement:
      case NodeType.ContinueStatement: {
        const { first } = this.syntax.spans.get(node);
        const valid = node.type === NodeType.BreakStatement
          ? this.inside(scope, 'loop', 'switch')
          : this.inside(scope, 'loop');
        if (!valid) {
          const token = this.syntax.tokens[first];
          const target = node.type === NodeType.BreakStatement ? 'a loop or switch' : 'a loop';
          this.report(`"${token.value}" can only be used inside ${target}.`, token);
        }
        return true;
      }
    }
  }

  visitExpression (node: Expression, scope: Scope, use: ExpressionUse = 'value'): Symbol | undefined {
    const { expressions, locations } = this.syntax;
    const range = expressions.get(node) || locations.get(node) as SourceToken;
    switch (node.type) {
      case NodeType.Identifier: {
        const symbol = this.lookup(node.name, scope);
        if (!symbol) {
          const kind = use === 'call' ? 'function' : 'name';
          this.report(`Unknown ${kind} "${node.name}".`, range);
          return;
        }
        return this.checkUse(symbol, use, range);
      }
      case NodeType.MemberExpression: {
        const errorCount = this.errors.length;
        const object = this.visitExpression(node.object, scope, 'binding');
        const struct = this.types.structs.get(node.object);
        if (struct) {
          this.structFields.push(locations.get(node) as SourceToken);
          if (struct.properties[node.property]) {
            return this.checkUse({
              name: node.property,
              kind: 'variable',
              readOnly: !object || object.readOnly ||
                object.kind === 'constant' || object.kind === 'parameter'
            }, use, range);
          }
          return;
        }
        if (this.errors.length > errorCount || object?.kind === 'import') {
          return object;
        }
        if (object?.kind === 'enum') {
          return object.members[node.property];
        }

        const members = object?.kind === 'object' ? object.members : listMembers;
        const member = Object.hasOwn(members, node.property) ? members[node.property] : undefined;
        if (!member || (object?.kind !== 'object' && member.kind === 'function' && use !== 'call')) {
          this.report(`Unknown ${use === 'call' ? 'method' : 'property'} "${node.property}".`, range);
          return;
        }
        if (object?.kind === 'function') {
          this.report(`"${object.name}" cannot be used as a list.`, expressions.get(node.object));
          return;
        }
        return this.checkUse(member, use, range);
      }
      case NodeType.StructLiteral:
        for (const property of node.properties) {
          this.structFields.push(locations.get(property) as SourceToken);
          this.visitExpression(property.value, scope);
        }
        break;
      case NodeType.FunctionExpression:
        return this.checkUse({
          name: 'Anonymous function',
          kind: 'function',
          parameters: node.params,
          procedure: this.addProcedure(node.body, scope)
        }, use, range);
      case NodeType.CallExpression: {
        const callee = this.visitExpression(node.callee, scope, 'call');
        if (callee?.kind === 'function') {
          this.checkCall(callee, node.arguments.length, scope, use, expressions.get(node.callee) || range);
        }
        for (const [index, argument] of node.arguments.entries()) {
          this.visitArgument(argument, scope, callee, index);
        }
        break;
      }
      case NodeType.IndexExpression:
        this.visitExpression(node.object, scope);
        this.visitExpression(node.index, scope);
        break;
      case NodeType.UpdateExpression:
        this.visitExpression(node.argument, scope, node.operator === '++' ? 'increment' : 'decrement');
        break;
      case NodeType.ConditionalExpression: {
        const branchUse = use === 'statement' ? 'statement' : 'value';
        this.visitExpression(node.test, scope);
        const test = this.types.enumMembers.get(node.test) || node.test;
        if (test.type === NodeType.BooleanLiteral || test.type === NodeType.NumberLiteral ||
            test.type === NodeType.StringLiteral) {
          const truthy = Boolean(test.value) && test.value !== '0' && String(test.value).toLowerCase() !== 'false';
          this.visitExpression(truthy ? node.consequent : node.alternate, scope, branchUse);
        } else {
          this.visitExpression(node.consequent, scope, branchUse);
          this.visitExpression(node.alternate, scope, branchUse);
        }
        break;
      }
      default:
        for (const child of Object.values(node).flat()) {
          if (child && typeof child === 'object') {
            this.visitExpression(child, scope);
          }
        }
    }

    if (use === 'call') {
      this.report('Expected a function to call.', range);
    }
    if ((use === 'assign' || use === 'increment' || use === 'decrement') &&
        node.type !== NodeType.IndexExpression) {
      this.report('Expected a writable variable or list element.', range);
    }
  }

  checkUse (symbol: Symbol, use: ExpressionUse, range: Range) {
    if (symbol.kind === 'import') {
      return symbol;
    }
    if (symbol.kind === 'enum') {
      return use === 'binding' ? symbol : undefined;
    }

    if (use === 'call' && symbol.kind !== 'function') {
      this.report(`"${symbol.name}" is not a function.`, range);
    } else if ((use === 'assign' || use === 'increment' || use === 'decrement') &&
        (symbol.kind !== 'variable' || symbol.readOnly)) {
      const operation = use === 'assign' ? 'assign to' : use;
      const target = symbol.kind === 'constant' ? `constant "${symbol.name}"` : `"${symbol.name}"`;
      this.report(`Cannot ${operation} ${target}.`, range);
    } else if ((use === 'value' || use === 'statement') &&
        (symbol.kind === 'function' || symbol.kind === 'object')) {
      this.report(`"${symbol.name}" cannot be used as a value.`, range);
    } else {
      return symbol;
    }
  }

  checkCall (callee: Symbol, count: number, scope: Scope, use: ExpressionUse, range: Range) {
    const [min, max] = callee.arity || [callee.parameters.length, callee.parameters.length];
    if (count < min || count > max) {
      let expected = String(min);
      if (min !== max) {
        expected = Number.isFinite(max) ? `${min} to ${max}` : `at least ${min}`;
      }
      const unit = min === 1 && max === 1 ? 'argument' : 'arguments';
      this.report(`"${callee.name}" expects ${expected} ${unit}, got ${count}.`, range);
    } else if (callee.blockType === 'hat' && this.inside(scope, 'function')) {
      this.report('Event handlers must be declared outside functions.', range);
    } else if (callee.blockType === 'hat' && this.inside(scope, 'try')) {
      this.report('Event handlers must be declared outside try blocks.', range);
    } else if (use !== 'statement' && (callee.blockType === 'command' || callee.blockType === 'hat')) {
      this.report(`"${callee.name}" does not return a value.`, range);
    } else if (callee.procedure && this.reachable) {
      // A function captures the bindings known when the compiler first emits its body.
      this.visitProcedure(callee.procedure);
    }
  }

  visitArgument (argument: Expression, scope: Scope, callee: Symbol | undefined, index: number) {
    const kind = callee?.args?.[index];
    const listCallback = index === 0 && callee?.arity && (callee.name === 'map' || callee.name === 'filter');
    if (kind === 'body' || listCallback) {
      const errorCount = this.errors.length;
      const callback = this.visitExpression(argument, scope, 'binding');
      const max = listCallback ? 3 : 0;

      if (this.errors.length === errorCount && callback?.kind !== 'import' &&
          (callback?.kind !== 'function' || callback.blockType === 'hat' ||
            callback.blockType === (listCallback ? 'command' : 'reporter') || callback.parameters.length > max ||
            (listCallback && callback.args?.some(arg => typeof arg !== 'number')))) {
        const message = listCallback
          ? 'List callbacks need a function that returns a value and accepts up to three value parameters.'
          : 'Block bodies need a command or function without parameters.';

        this.report(message, this.syntax.expressions.get(argument));
      } else if (callback?.procedure && this.reachable) {
        this.visitProcedure(callback.procedure);
      }
      return;
    }

    const value = this.types.enumMembers.get(argument) || argument;
    const literal = value.type === NodeType.StringLiteral ||
      value.type === NodeType.NumberLiteral || value.type === NodeType.BooleanLiteral;
    const listName = kind === 'list' && argument.type === NodeType.Identifier;
    if (typeof kind === 'string' && (kind !== 'broadcast' || callee.blockType === 'hat') && !literal && !listName) {
      this.report('Block dropdowns and data names require a literal value.', this.syntax.expressions.get(argument));
    } else if (kind === 'variable' && literal) {
      const name = String(value.value);
      const variable = this.lookup(name, scope);
      if (!variable || !['variable', 'constant', 'import'].includes(variable.kind)) {
        this.report(`"${name}" is not a variable.`, this.syntax.expressions.get(argument));
      }
    } else if (kind === 'list' && literal && !this.internal && String(value.value).startsWith('$')) {
      this.report('Compiler lists are private.', this.syntax.expressions.get(argument));
    } else {
      this.visitExpression(argument, scope, callee?.kind === 'function' ? 'value' : 'binding');
    }
  }

  symbolsAt (offset: number) {
    const symbols: Symbols = Object.assign(Object.create(null), this.builtins);
    const scope = this.scopes.findLast(scope => offset >= scope.start && offset < scope.end);
    const visible: Symbol[][] = [];
    let limit = offset;
    for (let current = scope; current; current = current.parent) {
      visible.push([...(current.types || []), ...current.symbols].filter(symbol => {
        return !symbol.declaration || symbol.declaration.start <= limit;
      }));
      if (current.kind === 'function') {
        limit = Infinity;
      }
    }
    for (const local of visible.reverse()) {
      for (const symbol of local) {
        symbols[symbol.name] = symbol;
      }
    }
    return symbols;
  }

  definitionAt (offset: number) {
    return this.definitions.find(definition => {
      return definition.source.start <= offset && offset < definition.source.end;
    })?.target;
  }

  resolve (index: number, symbols: Symbols): Symbol | undefined {
    const { tokens } = this.syntax;
    if (!tokens[index] || ![TokenType.IDENTIFIER, TokenType.KEYWORD].includes(tokens[index].type)) {
      return;
    }

    const name = String(tokens[index].value);
    const members = tokens[index - 1]?.type === TokenType.DOT
      ? this.resolve(index - 2, symbols)?.members
      : symbols;
    if (members && Object.hasOwn(members, name)) {
      return members[name];
    }
  }
}
