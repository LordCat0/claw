import {
  NodeType,
  type ArrayExpression,
  type Bindings,
  type CallExpression,
  type ExportStatement,
  type Expression,
  type FunctionDeclaration,
  type FunctionExpression,
  type ImportStatement,
  type Program,
  type Statement,
  type StructDeclaration,
  type StructLiteral,
  type Token,
  type TypeSyntax
} from './types.ts';

type Primitive = 'any' | 'unknown' | 'never' | 'void' | 'number' | 'string' | 'boolean';
type LiteralValue = number | string | boolean;
type ValueType = Primitive
  | {
    kind: 'literal';
    value: LiteralValue;
  }
  | {
    kind: 'array';
    element: ValueType;
  }
  | {
    kind: 'union';
    members: ValueType[];
  }
  | FunctionType
  | StructType
  | {
    kind: 'object';
    members: Record<string, ValueType>;
  };

export interface StructType {
  kind: 'struct';
  name: string;
  fields: string[];
  properties: Record<string, {
    type: ValueType;
    offset: number;
    width: number;
  }>;
}

export function structType (type: ValueType) {
  if (typeof type === 'object' && type.kind === 'struct') {
    return type;
  }
}

interface FunctionType {
  kind: 'function';
  params: {
    name: string;
    type: ValueType;
  }[];
  result: () => ValueType;
}

interface TypeScope {
  parent?: TypeScope;
  values: Record<string, ValueType>;
  scalarVariables: string[];
  aliases: Record<string, () => ValueType>;
  returns?: {
    expected?: ValueType;
    values: ValueType[];
  };
}

export interface TypeModule {
  file: string;
  program: Program;
  locations: WeakMap<object, Token>;
  names: WeakMap<object, Token[]>;
}

interface CheckedModule {
  source: TypeModule;
  values: Record<string, ValueType>;
  aliases: Record<string, () => ValueType>;
  functions: (() => ValueType)[];
  checking: boolean;
}

interface TypeProblem {
  file: string;
  token: Token;
  message: string;
}

const primitives: Primitive[] = [
  'any',
  'unknown',
  'never',
  'void',
  'number',
  'string',
  'boolean'
];
const utilityArity: Record<string, number> = {
  Array: 1,
  ReturnType: 1,
  NonNullable: 1,
  Exclude: 2,
  Extract: 2,
  Omit: 2,
  Pick: 2
};

// A statement can finish in several ways depending on which branch runs.
const enum Completion {
  Next = 1,
  Break = 2,
  Continue = 4,
  Exit = 8
}

class TypeChecker {
  problems: TypeProblem[];
  hovers: WeakMap<Token, ValueType>;
  imports: WeakMap<ImportStatement, string[]>;
  exports: WeakMap<ExportStatement, string[]>;
  structs: WeakMap<Expression | Statement, StructType>;
  procedures: WeakMap<FunctionDeclaration | FunctionExpression, FunctionType>;
  private modules: Record<string, CheckedModule>;
  private builtins: TypeScope;
  private extensions: Record<string, Bindings>;
  private loadModule?: (source: string, file: string) => TypeModule;

  constructor (
    globals: Bindings,
    extensions: Record<string, Bindings>,
    loadModule?: (source: string, file: string) => TypeModule
  ) {
    this.problems = [];
    this.hovers = new WeakMap();
    this.imports = new WeakMap();
    this.exports = new WeakMap();
    this.structs = new WeakMap();
    this.procedures = new WeakMap();
    this.modules = Object.create(null);
    this.builtins = this.child();
    this.builtins.values = this.bindingTypes(globals);
    this.extensions = extensions;
    this.loadModule = loadModule;
  }

  check (source: TypeModule) {
    if (this.modules[source.file]) {
      return this.modules[source.file];
    }

    const module: CheckedModule = {
      source,
      values: Object.create(null),
      aliases: Object.create(null),
      functions: [],
      checking: true
    };
    this.modules[source.file] = module;

    this.checkStatements(source.program.body, this.child(this.builtins), module);
    for (const alias of Object.values(module.aliases)) {
      alias();
    }
    for (const resolve of module.functions) {
      resolve();
    }
    module.checking = false;
    return module;
  }

  hasModule (file: string) {
    return Object.hasOwn(this.modules, file);
  }

  child (parent?: TypeScope): TypeScope {
    return {
      parent,
      values: Object.create(null),
      scalarVariables: [],
      aliases: Object.create(null),
      returns: parent?.returns
    };
  }

  lookup<K extends 'values' | 'aliases'> (
    scope: TypeScope,
    name: string,
    kind: K
  ): TypeScope[K][string] {
    for (let current = scope; current; current = current.parent) {
      if (Object.hasOwn(current[kind], name)) {
        return current[kind][name] as TypeScope[K][string];
      }
    }
  }

  acceptsListItems (target: Expression, scope: TypeScope) {
    if (target.type === NodeType.MemberExpression) {
      return !this.structs.has(target.object);
    }
    if (target.type !== NodeType.Identifier) {
      return false;
    }
    for (let current = scope; current; current = current.parent) {
      if (Object.hasOwn(current.values, target.name)) {
        return !current.scalarVariables.includes(target.name);
      }
    }
    return false;
  }

  bindingTypes (bindings: Bindings): Record<string, ValueType> {
    return Object.fromEntries(Object.entries(bindings).map(([name, binding]) => {
      switch (binding.kind) {
        case 'object':
          return [name, binding.struct?.type || {
            kind: 'object',
            members: this.bindingTypes(binding.members)
          }];
        case 'function':
          return [name, {
            kind: 'function',
            params: binding.args.map((_, index) => ({
              name: `arg${index + 1}`,
              type: 'any'
            })),
            result: () => binding.resultType ||
              (binding.blockType === 'reporter' ? 'any' : 'void')
          }];
        case 'list':
          return [name, {
            kind: 'array',
            element: 'any'
          }];
        default:
          return [name, binding.get.resultType ||
            (binding.boolean ? 'boolean' : 'any')];
      }
    }));
  }

  nameToken (node: object, module: CheckedModule, index = 0) {
    return module.source.names.get(node)?.[index] || module.source.locations.get(node);
  }

  report (
    module: CheckedModule,
    node: object,
    message: string,
    token = module.source.locations.get(node)
  ) {
    if (token) {
      this.problems.push({
        file: module.source.file,
        token,
        message
      });
    }
  }

  hover (token: Token, type: ValueType) {
    if (token) {
      this.hovers.set(token, type);
    }
  }

  describe (type: ValueType): string {
    if (typeof type === 'string') {
      return type;
    }
    switch (type.kind) {
      case 'struct':
        return type.name;
      case 'literal':
        return JSON.stringify(type.value);
      case 'array': {
        const element = this.describe(type.element);
        const group = typeof type.element === 'object' &&
          (type.element.kind === 'union' || type.element.kind === 'function');
        return group ? `(${element})[]` : `${element}[]`;
      }
      case 'union':
        return type.members.map(member => {
          const text = this.describe(member);
          return typeof member === 'object' && member.kind === 'function'
            ? `(${text})`
            : text;
        }).join(' | ');
      case 'function': {
        const params = type.params.map(param =>
          `${param.name}: ${this.describe(param.type)}`
        );
        return `(${params.join(', ')}) -> ${this.describe(type.result())}`;
      }
      case 'object':
        return `{ ${Object.keys(type.members).join(', ')} }`;
    }
  }

  primitive (value: LiteralValue): Primitive {
    switch (typeof value) {
      case 'number':
        return 'number';
      case 'string':
        return 'string';
      default:
        return 'boolean';
    }
  }

  members (type: ValueType) {
    return typeof type === 'object' && type.kind === 'union' ? type.members : [type];
  }

  union (types: ValueType[]): ValueType {
    const flattened = types.flatMap(type => this.members(type));
    if (flattened.includes('any')) {
      return 'any';
    }
    if (flattened.includes('unknown')) {
      return 'unknown';
    }
    const members: ValueType[] = [];
    for (const type of flattened) {
      if (type === 'never' || members.includes(type)) {
        continue;
      }
      const literal = typeof type === 'object' && type.kind === 'literal';
      if (
        literal &&
        members.some(member =>
          member === this.primitive(type.value) ||
          (
            typeof member === 'object' &&
            member.kind === 'literal' &&
            member.value === type.value
          )
        )
      ) {
        continue;
      }
      members.push(type);
    }

    const distinct = members.filter(member =>
      typeof member !== 'object' ||
      member.kind !== 'literal' ||
      !members.includes(this.primitive(member.value))
    );
    if (distinct.length === 0) {
      return 'never';
    }
    return distinct.length === 1 ? distinct[0] : {
      kind: 'union',
      members: distinct
    };
  }

  widen (type: ValueType): ValueType {
    if (typeof type === 'string') {
      return type;
    }
    switch (type.kind) {
      case 'literal':
        return this.primitive(type.value);
      case 'union':
        return this.union(type.members.map(member => this.widen(member)));
      case 'array':
        return {
          kind: 'array',
          element: this.widen(type.element)
        };
      default:
        return type;
    }
  }

  isAssignable (actual: ValueType, expected: ValueType): boolean {
    if (structType(actual) || structType(expected)) {
      return actual === expected || actual === 'never';
    }

    if (
      actual === expected ||
      actual === 'never' ||
      actual === 'any' ||
      expected === 'any' ||
      expected === 'unknown'
    ) {
      return true;
    }
    if (typeof actual === 'object' && actual.kind === 'union') {
      return actual.members.every(member => this.isAssignable(member, expected));
    }
    if (typeof expected === 'object' && expected.kind === 'union') {
      return expected.members.some(member => this.isAssignable(actual, member));
    }
    if (typeof actual === 'object' && actual.kind === 'literal') {
      return this.primitive(actual.value) === expected ||
        (
          typeof expected === 'object' &&
          expected.kind === 'literal' &&
          actual.value === expected.value
        );
    }
    if (typeof actual !== 'object' || typeof expected !== 'object') {
      return false;
    }
    if (actual.kind === 'array' && expected.kind === 'array') {
      return this.isAssignable(actual.element, expected.element);
    }
    if (actual.kind === 'function' && expected.kind === 'function') {
      return actual.params.length === expected.params.length &&
        expected.params.every((param, index) =>
          this.isAssignable(param.type, actual.params[index].type)
        ) &&
        this.isAssignable(actual.result(), expected.result());
    }
    if (actual.kind === 'object' && expected.kind === 'object') {
      return Object.entries(expected.members).every(([name, type]) => {
        return Object.hasOwn(actual.members, name) &&
          this.isAssignable(actual.members[name], type);
      });
    }
    return false;
  }

  requireAssignable (
    actual: ValueType,
    expected: ValueType,
    node: object,
    module: CheckedModule,
    context = ''
  ) {
    if (!this.isAssignable(actual, expected)) {
      this.report(
        module,
        node,
        `${context}Type '${this.describe(actual)}' ` +
        `is not assignable to type '${this.describe(expected)}'.`
      );
    }
  }

  resolveAnnotation (syntax: TypeSyntax, scope: TypeScope, module: CheckedModule): ValueType {
    const token = module.source.locations.get(syntax);
    switch (syntax.kind) {
      case 'literal':
        return syntax;
      case 'array':
        return {
          kind: 'array',
          element: this.resolveAnnotation(syntax.element, scope, module)
        };
      case 'union':
        return this.union(syntax.members.map(member =>
          this.resolveAnnotation(member, scope, module)
        ));
      case 'function': {
        const params = syntax.params.map(param => ({
          name: param.name,
          type: this.resolveAnnotation(param.annotation, scope, module)
        }));
        const result = this.resolveAnnotation(syntax.result, scope, module);
        return {
          kind: 'function',
          params,
          result: () => result
        };
      }
      case 'reference': {
        const { name, args } = syntax;
        let type: ValueType = 'any';
        if (Object.hasOwn(utilityArity, name)) {
          if (args.length !== utilityArity[name]) {
            this.report(
              module,
              syntax,
              `Type '${name}' expects ${utilityArity[name]} type arguments.`
            );
          } else {
            type = this.resolveUtilityType(
              name,
              args.map(arg => this.resolveAnnotation(arg, scope, module)),
              syntax,
              module
            );
          }
        } else {
          const alias = this.lookup(scope, name, 'aliases');
          const builtin = this.builtins.values[name];
          if (args.length) {
            this.report(
              module,
              syntax,
              `Type '${name}' does not accept type arguments.`
            );
          }
          if (alias) {
            type = alias();
          } else if (primitives.includes(name as Primitive)) {
            type = name as Primitive;
          } else if (typeof builtin === 'object' && builtin.kind === 'object') {
            type = builtin;
          } else {
            this.report(module, syntax, `Unknown type '${name}'.`);
          }
        }
        this.hover(token, type);
        return type;
      }
    }
  }

  resolveUtilityType (
    name: string,
    [type, keys]: ValueType[],
    syntax: TypeSyntax,
    module: CheckedModule
  ): ValueType {
    switch (name) {
      case 'Array':
        return {
          kind: 'array',
          element: type
        };
      case 'NonNullable':
      case 'Exclude':
      case 'Extract':
        if (type === 'any') {
          return 'any';
        }
        return this.union(this.members(type).filter(member => {
          return this.isAssignable(
            member,
            name === 'NonNullable' ? 'void' : keys
          ) === (name === 'Extract');
        }));
      case 'ReturnType': {
        const members = this.members(type);
        if (type === 'any') {
          return 'any';
        }
        if (members.every(member =>
          typeof member === 'object' && member.kind === 'function'
        )) {
          return this.union(members.map(member => member.result()));
        }
        this.report(module, syntax, 'ReturnType requires a function type.');
        return 'any';
      }
      case 'Omit':
      case 'Pick':
        if (!this.isAssignable(keys, 'string')) {
          this.report(module, syntax, `${name} requires string keys.`);
        } else if (typeof type === 'object' && type.kind === 'object') {
          if (name === 'Pick') {
            this.requireAssignable(
              keys,
              this.union(Object.keys(type.members).map(value => ({
                kind: 'literal',
                value
              }))),
              syntax,
              module
            );
          }
          return {
            kind: 'object',
            members: Object.fromEntries(
              Object.entries(type.members).filter(([value]) => {
                return this.isAssignable({
                  kind: 'literal',
                  value
                }, keys) === (name === 'Pick');
              })
            )
          };
        } else if (type !== 'any') {
          this.report(module, syntax, `${name} requires a namespace type.`);
        }
        return 'any';
    }
  }

  declareTypes (body: Statement[], scope: TypeScope, module: CheckedModule) {
    for (const statement of body) {
      if (
        statement.type !== NodeType.TypeDeclaration &&
        statement.type !== NodeType.StructDeclaration
      ) {
        continue;
      }

      const { name } = statement;
      const token = this.nameToken(statement, module);
      if (
        scope.aliases[name] ||
        primitives.includes(name as Primitive) ||
        Object.hasOwn(utilityArity, name)
      ) {
        this.report(module, statement, `Type '${name}' is already defined.`, token);
        continue;
      }

      let type: ValueType;
      let resolving = false;
      scope.aliases[name] = () => {
        if (resolving) {
          const kind = statement.type === NodeType.StructDeclaration ? 'struct' : 'type alias';
          this.report(module, statement, `Circular ${kind} '${name}'.`, token);
          return 'any';
        }
        if (!type) {
          resolving = true;
          type = statement.type === NodeType.StructDeclaration
            ? this.structDeclaration(statement, scope, module)
            : this.resolveAnnotation(statement.annotation, scope, module);
          resolving = false;
          this.hover(token, type);
        }
        return type;
      };
    }
  }

  structDeclaration (
    statement: StructDeclaration,
    scope: TypeScope,
    module: CheckedModule
  ): StructType {
    const fields: string[] = [];
    const properties: StructType['properties'] = Object.create(null);
    for (const property of statement.properties) {
      const { name, annotation } = property;
      if (properties[name]) {
        this.report(module, property, `Duplicate property '${name}'.`);
        continue;
      }

      const type: ValueType = annotation ? this.resolveAnnotation(annotation, scope, module) : 'any';
      const nested = structType(type);
      const width = nested ? nested.fields.length : 1;
      const offset = fields.length;
      if (offset + width >= 200000) {
        this.report(module, property, 'Struct size exceeds the Scratch limit.');
        break;
      }

      if (nested) {
        for (const field of nested.fields) {
          fields.push(`${name}.${field}`);
        }
      } else {
        if (!this.isScalar(type)) {
          this.report(module, property, 'Struct properties require a scalar or a single struct type.');
        }
        fields.push(name);
      }
      properties[name] = {
        type,
        offset,
        width
      };
    }

    return {
      kind: 'struct',
      name: statement.name,
      fields,
      properties
    };
  }

  importTypes (statement: ImportStatement, scope: TypeScope, module: CheckedModule) {
    const { source, names, typeOnly } = statement;
    let values: Record<string, ValueType>;
    let aliases: CheckedModule['aliases'];

    if (Object.hasOwn(this.extensions, source)) {
      values = this.bindingTypes(this.extensions[source]);
      if (statement.defaultImport) {
        values = {
          [names[0]]: {
            kind: 'object',
            members: values
          }
        };
      }
    } else if (this.loadModule) {
      try {
        const dependency = this.check(this.loadModule(source, module.source.file));
        if (dependency.checking) {
          throw new Error(`Circular import involving "${dependency.source.file}".`);
        }
        values = dependency.values;
        aliases = dependency.aliases;
      } catch (error) {
        this.report(
          module,
          statement,
          error instanceof Error ? error.message : String(error)
        );
        return;
      }
    }

    const runtime: string[] = [];
    for (const [index, name] of names.entries()) {
      const token = this.nameToken(statement, module, index);
      const type = aliases?.[name];
      const value = values && Object.hasOwn(values, name) ? values[name] : undefined;

      if (type) {
        if (scope.aliases[name]) {
          this.report(module, statement, `Type '${name}' is already defined.`, token);
        } else {
          scope.aliases[name] = type;
        }
      } else if (!values) {
        scope.aliases[name] = () => 'any';
      }

      if (!typeOnly && (value || !values)) {
        runtime.push(name);
        scope.values[name] = value || 'any';
      } else if (!type && values) {
        const kind = typeOnly ? 'Type' : 'Name';
        this.report(
          module,
          statement,
          `${kind} '${name}' is not exported from '${source}'.`,
          token
        );
      }

      this.hover(token, (!typeOnly && value) || type?.() || 'any');
    }
    this.imports.set(statement, runtime);
  }

  exportTypes (statement: ExportStatement, scope: TypeScope, module: CheckedModule) {
    const runtime: string[] = [];
    for (const [index, name] of statement.names.entries()) {
      const token = this.nameToken(statement, module, index);
      const alias = this.lookup(scope, name, 'aliases');
      const value = statement.typeOnly ? undefined : this.lookup(scope, name, 'values');
      if (alias) {
        module.aliases[name] = () => {
          const type = alias();
          this.hover(token, value || type);
          return type;
        };
      }
      if (value) {
        module.values[name] = value;
        runtime.push(name);
      }
      if (!alias && !value) {
        this.report(
          module,
          statement,
          `'${name}' is not defined and cannot be exported.`,
          token
        );
      }
      this.hover(token, value);
    }
    this.exports.set(statement, runtime);
  }

  checkProcedure (
    node: FunctionDeclaration | FunctionExpression,
    scope: TypeScope,
    module: CheckedModule,
    context?: ValueType
  ): FunctionType {
    const local = this.child(scope);
    const contextual = typeof context === 'object' && context.kind === 'function'
      ? context.params
      : [];
    const params = node.params.map((name, index) => {
      const annotation = node.paramTypes?.[index];
      const type = annotation
        ? this.resolveAnnotation(annotation, scope, module)
        : contextual[index]?.type || 'any';
      this.hover(this.nameToken(node.body, module, index), type);
      local.values[name] = type;
      return {
        name,
        type
      };
    });
    const expected = node.returnType
      ? this.resolveAnnotation(node.returnType, scope, module)
      : undefined;
    local.returns = {
      expected,
      values: []
    };

    let result: ValueType;
    const infer = () => {
      if (!result) {
        result = expected || 'any';
        const completion = this.checkStatements(node.body.body, local, module);
        const { values } = local.returns;
        if (completion & Completion.Next) {
          values.push('void');
          if (expected) {
            this.requireAssignable(
              'void',
              expected,
              node.returnType,
              module,
              'Function can finish without returning a value. '
            );
          }
        }
        const struct = !expected && values.find(structType);
        if (struct) {
          for (const value of values) {
            this.requireAssignable(value, struct, node, module, 'Function return values. ');
          }
          result = struct;
        } else {
          result = expected || this.union(values.map(value => this.widen(value)));
        }
      }
      return result;
    };
    module.functions.push(infer);

    const type: FunctionType = {
      kind: 'function',
      params,
      result: expected ? () => expected : infer
    };
    this.procedures.set(node, type);
    return type;
  }

  checkStatements (
    body: Statement[],
    scope: TypeScope,
    module: CheckedModule,
    reachable = true
  ) {
    this.declareTypes(body, scope, module);
    let completion = Completion.Next;
    for (const statement of body) {
      const next = this.checkStatement(
        statement,
        scope,
        module,
        reachable && !!(completion & Completion.Next)
      );
      if (completion & Completion.Next) {
        completion = (completion & ~Completion.Next) | next;
      }
    }

    for (const alias of Object.values(scope.aliases)) {
      alias();
    }
    return completion;
  }

  literalTruth (expression: Expression) {
    if (
      expression.type === NodeType.BooleanLiteral ||
      expression.type === NodeType.NumberLiteral ||
      expression.type === NodeType.StringLiteral
    ) {
      const value = expression.value;
      return (
        Boolean(value) &&
        value !== '0' &&
        String(value).toLowerCase() !== 'false'
      );
    }
  }

  checkStatement (
    node: Statement,
    scope: TypeScope,
    module: CheckedModule,
    reachable: boolean
  ): Completion {
    switch (node.type) {
      case NodeType.TypeDeclaration:
      case NodeType.StructDeclaration:
        if (node.exported) {
          if (scope.parent !== this.builtins) {
            this.report(module, node, 'Exports are only allowed at module scope.');
          } else {
            const alias = this.lookup(scope, node.name, 'aliases');
            if (alias) {
              module.aliases[node.name] = alias;
            }
          }
        }
        break;
      case NodeType.ImportStatement:
        if (scope.parent !== this.builtins) {
          this.report(module, node, 'Imports are only allowed at module scope.');
        } else {
          this.importTypes(node, scope, module);
        }
        break;
      case NodeType.ExportStatement:
        if (scope.parent !== this.builtins) {
          this.report(module, node, 'Exports are only allowed at module scope.');
        } else {
          this.exportTypes(node, scope, module);
        }
        break;
      case NodeType.VarDeclaration: {
        const { name, init, annotation } = node;
        const expected = annotation
          ? this.resolveAnnotation(annotation, scope, module)
          : undefined;
        const struct = structType(expected);
        let actual: ValueType = 'any';
        if (init) {
          actual = node.list && init.type === NodeType.ArrayExpression
            ? this.listItems(init, scope, module)
            : this.checkExpression(init, scope, module, expected || undefined);
          if (!node.list && actual !== 'any' && this.element(actual)) {
            this.report(module, init, 'Use the list keyword to declare a list.');
          }
        }
        if (structType(actual) && !struct) {
          this.report(module, init, `Variable '${name}' requires a struct type annotation.`);
        } else if (init && expected) {
          this.requireAssignable(actual, expected, init, module);
        }
        if (node.list && expected) {
          this.requireAssignable(
            expected,
            {
              kind: 'array',
              element: 'any'
            },
            node,
            module,
            'List declarations require an array type. '
          );
        }
        const type = expected || this.widen(actual);
        if (struct) {
          if (!init) {
            this.report(module, node, `Struct '${name}' requires an initializer.`);
          }
          this.structs.set(node, struct);
        }
        scope.values[name] = node.list && type === 'any' ? {
          kind: 'array',
          element: 'any'
        } : type;
        if (!node.list) {
          scope.scalarVariables.push(name);
        }
        this.hover(this.nameToken(node, module), scope.values[name]);
        break;
      }
      case NodeType.FunctionDeclaration: {
        const type = this.checkProcedure(node, scope, module);
        scope.values[node.name] = type;
        this.hover(this.nameToken(node, module), type);
        break;
      }
      case NodeType.Assignment: {
        const type = this.checkExpression(node.target, scope, module);
        const value = node.value.type === NodeType.ArrayExpression &&
          !node.operator && this.element(type) && this.acceptsListItems(node.target, scope)
          ? this.listItems(node.value, scope, module)
          : this.checkExpression(
            node.value,
            scope,
            module,
            node.operator ? undefined : structType(type)
          );
        const assigned = node.operator
          ? this.binary(node.operator, type, value)
          : value;

        if (type === 'any' && node.target.type === NodeType.MemberExpression &&
            this.structs.has(node.target.object) && !this.isScalar(assigned)) {
          this.report(module, node.value, 'An untyped struct property requires a scalar value.');
          break;
        }
        this.requireAssignable(assigned, type, node.value, module);
        break;
      }
      case NodeType.ExpressionStatement:
        return this.checkExpression(node.expression, scope, module) === 'never'
          ? Completion.Exit
          : Completion.Next;
      case NodeType.Block:
        return this.checkStatements(node.body, this.child(scope), module, reachable);
      case NodeType.ReturnStatement: {
        const returns = scope.returns;
        const value = node.value
          ? this.checkExpression(node.value, scope, module, structType(returns?.expected))
          : 'void';
        if (returns?.expected) {
          this.requireAssignable(
            value,
            returns.expected,
            node.value || node,
            module,
            'Return value. '
          );
        }
        if (reachable) {
          returns?.values.push(value);
        }
        return Completion.Exit;
      }
      case NodeType.ThrowStatement:
        this.checkExpression(node.value, scope, module);
        return Completion.Exit;
      case NodeType.IfStatement: {
        this.checkExpression(node.test, scope, module);
        const truth = this.literalTruth(node.test);
        const consequent = this.checkStatement(
          node.consequent,
          scope,
          module,
          reachable && truth !== false
        );
        const alternate = node.alternate
          ? this.checkStatement(node.alternate, scope, module, reachable && truth !== true)
          : Completion.Next;
        if (truth === undefined) {
          return consequent | alternate;
        }
        return truth ? consequent : alternate;
      }
      case NodeType.SwitchStatement: {
        this.checkExpression(node.discriminant, scope, module);
        const local = this.child(scope);
        const clauses = node.cases.map(({ test, body }) => {
          if (test) {
            this.checkExpression(test, local, module);
          }
          return this.checkStatements(body, local, module, reachable);
        });

        let following = Completion.Next;
        let exits = node.cases.some(clause => clause.test === null)
          ? 0
          : Completion.Next;
        for (const clause of clauses.reverse()) {
          following = (clause & ~Completion.Next) |
            (clause & Completion.Next ? following : 0);
          exits |= following;
        }
        return (exits & ~Completion.Break) |
          (exits & Completion.Break ? Completion.Next : 0);
      }
      case NodeType.ForStatement:
      case NodeType.WhileStatement:
      case NodeType.RepeatStatement: {
        const local = node.type === NodeType.ForStatement ? this.child(scope) : scope;
        if (node.type === NodeType.ForStatement) {
          this.checkStatement(node.init, local, module, reachable);
        }
        const test = node.type === NodeType.RepeatStatement ? node.count : node.test;
        this.checkExpression(test, local, module);
        const truth = node.type === NodeType.RepeatStatement
          ? this.repeatRuns(test)
          : this.literalTruth(test);
        const body = this.checkStatement(node.body, local, module, reachable && truth !== false);
        if (node.type === NodeType.ForStatement) {
          this.checkStatement(node.update, local, module, reachable);
        }
        if (truth === false) {
          return Completion.Next;
        }
        const mayFinish = truth === undefined ||
          (body & Completion.Break) ||
          (
            node.type === NodeType.RepeatStatement &&
            (body & (Completion.Next | Completion.Continue))
          );
        return (body & Completion.Exit) | (mayFinish ? Completion.Next : 0);
      }
      case NodeType.TryStatement: {
        const handler = this.child(scope);
        if (node.parameter) {
          handler.values[node.parameter] = 'any';
          this.hover(this.nameToken(node, module), 'any');
        }
        return this.checkStatement(node.body, scope, module, reachable) |
          this.checkStatements(node.handler.body, handler, module, reachable);
      }
      case NodeType.BreakStatement:
        return Completion.Break;
      case NodeType.ContinueStatement:
        return Completion.Continue;
    }
    return Completion.Next;
  }

  binary (operator: string, left: ValueType, right: ValueType): ValueType {
    if (['==', '!=', '<', '>', '<=', '>=', '&&', '||'].includes(operator)) {
      return 'boolean';
    }
    if (operator !== '+') {
      return 'number';
    }
    if ([left, right].some(type =>
      typeof type === 'object' &&
      type.kind === 'literal' &&
      typeof type.value === 'string' &&
      (type.value.trim() === '' || Number.isNaN(Number(type.value)))
    )) {
      return 'string';
    }
    if ([left, right].every(type =>
      type === 'number' ||
      (
        typeof type === 'object' &&
        type.kind === 'literal' &&
        typeof type.value === 'number'
      )
    )) {
      return 'number';
    }
    if (left === 'any' || right === 'any') {
      return 'any';
    }
    return this.union(['number', 'string']);
  }

  repeatRuns (count: Expression) {
    if (
      count.type === NodeType.NumberLiteral ||
      count.type === NodeType.StringLiteral ||
      count.type === NodeType.BooleanLiteral
    ) {
      return Math.round(Number(count.value)) > 0;
    }
  }

  member (type: ValueType, property: string): ValueType {
    if (type === 'any') {
      return 'any';
    }
    if (typeof type !== 'object') {
      return;
    }
    if (type.kind === 'object' && Object.hasOwn(type.members, property)) {
      return type.members[property];
    }
    if (type.kind === 'struct') {
      return type.properties[property]?.type;
    }
    if (type.kind === 'array' && property === 'length') {
      return 'number';
    }
    if (type.kind === 'union') {
      const members = type.members.map(member => this.member(member, property));
      if (members.every(Boolean)) {
        return this.union(members);
      }
    }
  }

  listCall (
    receiver: Extract<ValueType, { kind: 'array' }>,
    node: CallExpression,
    property: string,
    args: ValueType[],
    module: CheckedModule
  ): ValueType {
    const { element } = receiver;
    const firstItem = {
      push: 0,
      unshift: 0,
      insert: 1,
      splice: 2
    };
    if (Object.hasOwn(firstItem, property)) {
      const start = firstItem[property as keyof typeof firstItem];
      for (let index = start; index < args.length; index++) {
        this.requireAssignable(args[index], element, node.arguments[index], module);
      }
    }

    switch (property) {
      case 'fill':
        if (args.length) {
          this.requireAssignable(args[0], element, node.arguments[0], module);
        }
        return receiver;
      case 'at':
      case 'pop':
      case 'shift':
        return element;
      case 'push':
      case 'unshift':
      case 'insert':
      case 'indexOf':
      case 'lastIndexOf':
        return 'number';
      case 'includes':
        return 'boolean';
      case 'join':
        return 'string';
      case 'clear':
      case 'copy':
      case 'slice':
      case 'remove':
      case 'splice':
      case 'reverse':
      case 'sort':
      case 'filter':
      case 'concat':
      case 'map': {
        const callback = args[0];
        if (
          (property === 'map' || property === 'filter') &&
          typeof callback === 'object' &&
          callback.kind === 'function'
        ) {
          const inputs: ValueType[] = [element, 'number', receiver];
          callback.params.slice(0, inputs.length).forEach((param, index) => {
            this.requireAssignable(
              inputs[index],
              param.type,
              node.arguments[0],
              module,
              'Callback parameter. '
            );
          });
        }

        if (property === 'map') {
          return {
            kind: 'array',
            element: typeof callback === 'object' && callback.kind === 'function'
              ? callback.result()
              : 'any'
          };
        }

        if (property === 'concat') {
          return {
            kind: 'array',
            element: this.union([element, ...args.map(arg => this.element(arg) || 'any')])
          };
        }

        return receiver;
      }
      default:
        this.report(module, node.callee, `List has no method '${property}'.`);
        return 'any';
    }
  }

  element (type: ValueType): ValueType {
    if (type === 'any') {
      return 'any';
    }
    if (typeof type === 'object' && type.kind === 'array') {
      return type.element;
    }
    if (typeof type === 'object' && type.kind === 'union') {
      const elements = type.members.map(member => this.element(member));
      if (elements.every(Boolean)) {
        return this.union(elements);
      }
    }
  }

  listItems (node: ArrayExpression, scope: TypeScope, module: CheckedModule): ValueType {
    const elements = node.elements.map(element => {
      const type = this.checkExpression(element, scope, module);
      if (type !== 'any' && (this.element(type) || this.members(type).some(structType))) {
        this.report(module, element, 'List items must be scalar values.');
      }
      return type;
    });
    return {
      kind: 'array',
      element: elements.length ? this.union(elements) : 'any'
    };
  }

  checkExpression (
    node: Expression,
    scope: TypeScope,
    module: CheckedModule,
    expected?: ValueType
  ): ValueType {
    let type: ValueType;
    switch (node.type) {
      case NodeType.FunctionExpression:
        type = this.checkProcedure(node, scope, module, expected);
        break;
      case NodeType.StructLiteral:
        type = this.structLiteral(node, scope, module, structType(expected));
        break;
      default:
        type = this.inferExpression(node, scope, module, structType(expected));
        break;
    }

    const struct = structType(type);
    if (struct) {
      this.structs.set(node, struct);
    } else if (typeof type === 'object' && type.kind === 'union' && type.members.some(structType)) {
      this.report(module, node, 'A struct value requires a single struct type.');
    }
    if (
      node.type === NodeType.Identifier ||
      node.type === NodeType.MemberExpression ||
      node.type === NodeType.FunctionExpression ||
      node.type === NodeType.NumberLiteral ||
      node.type === NodeType.StringLiteral ||
      node.type === NodeType.BooleanLiteral
    ) {
      this.hover(module.source.locations.get(node), type);
    }
    return type;
  }

  structLiteral (
    node: StructLiteral,
    scope: TypeScope,
    module: CheckedModule,
    type?: StructType
  ): ValueType {
    if (!type) {
      this.report(module, node, 'A struct literal requires a struct type.');
      return 'any';
    }

    const missing = { ...type.properties };
    for (const property of node.properties) {
      const { name, value } = property;
      const entry = type.properties[name];
      if (!entry) {
        this.report(module, property, `Struct '${type.name}' has no property '${name}'.`);
      } else if (!Object.hasOwn(missing, name)) {
        this.report(module, property, `Duplicate property '${name}'.`);
      } else {
        delete missing[name];
        const actual = this.checkExpression(value, scope, module, entry.type);
        if (entry.type === 'any' && !this.isScalar(actual)) {
          this.report(module, value, `Property '${name}' requires a scalar value.`);
        } else {
          this.requireAssignable(actual, entry.type, value, module, `Property '${name}'. `);
        }
      }
    }

    for (const name of Object.keys(missing)) {
      this.report(module, node, `Missing property '${name}' of struct '${type.name}'.`);
    }
    return type;
  }

  isScalar (type: ValueType) {
    return this.members(type).every(member => typeof member === 'string' || member.kind === 'literal');
  }

  inferExpression (
    node: Exclude<Expression, FunctionExpression | StructLiteral>,
    scope: TypeScope,
    module: CheckedModule,
    expected?: StructType
  ): ValueType {
    switch (node.type) {
      case NodeType.NumberLiteral:
      case NodeType.StringLiteral:
      case NodeType.BooleanLiteral:
        return {
          kind: 'literal',
          value: node.value
        };
      case NodeType.Identifier: {
        const value = this.lookup(scope, node.name, 'values');
        if (!value && this.lookup(scope, node.name, 'aliases')) {
          this.report(module, node, `Type '${node.name}' cannot be used as a value.`);
        }
        return value || 'any';
      }
      case NodeType.UnaryExpression: {
        const value = this.checkExpression(node.value, scope, module);
        if (node.operator === '!') {
          return 'boolean';
        }
        if (
          typeof value === 'object' &&
          value.kind === 'literal' &&
          typeof value.value === 'number'
        ) {
          return {
            kind: 'literal',
            value: -value.value
          };
        }
        return 'number';
      }
      case NodeType.ArrayExpression:
        this.report(module, node, 'Use the list keyword to declare a list.');
        return 'any';
      case NodeType.BinaryExpression:
        return this.binary(
          node.operator,
          this.checkExpression(node.left, scope, module),
          this.checkExpression(node.right, scope, module)
        );
      case NodeType.ConditionalExpression: {
        this.checkExpression(node.test, scope, module);
        const consequent = this.checkExpression(node.consequent, scope, module, expected);
        const alternate = this.checkExpression(node.alternate, scope, module, expected);
        const truth = this.literalTruth(node.test);
        if (truth === undefined) {
          const type = structType(consequent) || structType(alternate);
          if (type) {
            this.requireAssignable(consequent, type, node.consequent, module);
            this.requireAssignable(alternate, type, node.alternate, module);
            return type;
          }
          return this.union([consequent, alternate]);
        }
        return truth ? consequent : alternate;
      }
      case NodeType.MemberExpression: {
        const object = this.checkExpression(node.object, scope, module);
        const member = this.member(object, node.property);
        if (!member) {
          this.report(
            module,
            node,
            `Type '${this.describe(object)}' has no property '${node.property}'.`
          );
        }
        return member || 'any';
      }
      case NodeType.IndexExpression: {
        const object = this.checkExpression(node.object, scope, module);
        this.checkExpression(node.index, scope, module);
        const element = this.element(object);
        if (!element) {
          this.report(
            module,
            node,
            `Type '${this.describe(object)}' cannot be indexed.`
          );
        }
        return element || 'any';
      }
      case NodeType.UpdateExpression: {
        const type = this.checkExpression(node.argument, scope, module);
        this.requireAssignable('number', type, node.argument, module);
        return type;
      }
      case NodeType.CallExpression:
        return this.checkCall(node, scope, module);
    }
  }

  private checkCall (
    node: CallExpression,
    scope: TypeScope,
    module: CheckedModule
  ): ValueType {
    const { callee } = node;
    let type: ValueType;
    if (callee.type === NodeType.MemberExpression) {
      const receiver = this.checkExpression(callee.object, scope, module);
      const receivers = this.members(receiver);
      if (receivers.every(member =>
        typeof member === 'object' && member.kind === 'array'
      )) {
        const args = node.arguments.map(argument =>
          callee.property === 'concat' && argument.type === NodeType.ArrayExpression
            ? this.listItems(argument, scope, module)
            : this.checkExpression(argument, scope, module)
        );
        const result = this.union(receivers.map(member =>
          this.listCall(member, node, callee.property, args, module)
        ));
        this.hover(module.source.locations.get(callee), {
          kind: 'function',
          params: args.map((type, index) => ({
            name: `arg${index + 1}`,
            type: this.widen(type)
          })),
          result: () => result
        });
        return result;
      }
      type = this.member(receiver, callee.property);
      if (!type) {
        this.report(
          module,
          callee,
          `Type '${this.describe(receiver)}' has no property '${callee.property}'.`
        );
        return 'any';
      }
      this.hover(module.source.locations.get(callee), type);
    } else {
      type = this.checkExpression(callee, scope, module);
    }
    const params = typeof type === 'object' && type.kind === 'function' ? type.params : [];
    const args = node.arguments.map((argument, index) =>
      this.checkExpression(argument, scope, module, structType(params[index]?.type))
    );
    return this.union(this.members(type).map(member => {
      if (member === 'any' || member === 'never') {
        return member;
      }
      if (typeof member !== 'object' || member.kind !== 'function') {
        this.report(
          module,
          callee,
          `Type '${this.describe(member)}' is not callable.`
        );
        return 'any';
      }
      if (args.length !== member.params.length) {
        this.report(
          module,
          callee,
          `Function expects ${member.params.length} arguments, got ${args.length}.`
        );
      }
      member.params.forEach((param, index) => {
        if (index < args.length) {
          this.requireAssignable(
            args[index],
            param.type,
            node.arguments[index],
            module,
            `Argument '${param.name}'. `
          );
        }
      });
      return member.result();
    }));
  }
}

export default TypeChecker;
