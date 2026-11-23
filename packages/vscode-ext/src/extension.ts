import * as vscode from 'vscode';
import { Keyword, TokenType } from '../../compiler/src/types.ts';
import { Analysis } from './analysis.ts';
import type { Range } from './parser.ts';

const language = 'claw';
const validationDelay = 500;
const identifier = /[a-zA-Z_][a-zA-Z_0-9]*/;
const semanticTokens = new vscode.SemanticTokensLegend(
  ['type', 'keyword', 'enum', 'enumMember', 'property'],
  ['defaultLibrary']
);
const primitiveTypes = ['any', 'unknown', 'never', 'void', 'number', 'string', 'boolean'];
const itemKinds = {
  function: vscode.CompletionItemKind.Function,
  variable: vscode.CompletionItemKind.Variable,
  constant: vscode.CompletionItemKind.Constant,
  parameter: vscode.CompletionItemKind.Variable,
  object: vscode.CompletionItemKind.Module,
  import: vscode.CompletionItemKind.Reference,
  enum: vscode.CompletionItemKind.Enum,
  enumMember: vscode.CompletionItemKind.EnumMember
};

type Symbol = NonNullable<ReturnType<Analysis['resolve']>>;

function editorRange (document: vscode.TextDocument, { start, end }: Range) {
  return new vscode.Range(document.positionAt(start), document.positionAt(end));
}

function describe (symbol: Symbol) {
  if (symbol.kind === 'function') {
    return `${symbol.name}(${symbol.parameters.join(', ')})`;
  }
  return `${symbol.name} (${symbol.kind})`;
}

export function activate (context: vscode.ExtensionContext) {
  const cache = new WeakMap<vscode.TextDocument, { version: number; analysis: Analysis }>();
  const validationTimers = new WeakMap<vscode.TextDocument, ReturnType<typeof setTimeout>>();
  const diagnostics = vscode.languages.createDiagnosticCollection(language);

  function analyze (document: vscode.TextDocument) {
    const cached = cache.get(document);
    if (cached?.version === document.version) {
      return cached.analysis;
    }

    const internal = document.uri.path.endsWith('/packages/compiler/src/internal/lists.claw');
    const file = document.uri.scheme === 'file' ? document.uri.fsPath : '';
    const analysis = new Analysis(document.getText(), internal, file);
    cache.set(document, {
      version: document.version,
      analysis
    });
    return analysis;
  }

  function validate (document: vscode.TextDocument) {
    if (document.languageId !== language) {
      return;
    }

    const { syntax, errors, unreachable } = analyze(document);
    const problems = [...syntax.errors, ...errors].map(error => {
      let { start, end } = error;
      if (start === end) {
        end = document.getText().slice(0, end).trimEnd().length;
        start = Math.max(0, end - 1);
      }
      return new vscode.Diagnostic(editorRange(document, { start, end }), error.message);
    });

    let lastEnd = -1;
    for (const range of unreachable.sort((a, b) => a.start - b.start || b.end - a.end)) {
      if (range.end <= lastEnd) {
        continue;
      }
      const diagnostic = new vscode.Diagnostic(
        editorRange(document, range), 'Unreachable code', vscode.DiagnosticSeverity.Hint
      );
      diagnostic.tags = [vscode.DiagnosticTag.Unnecessary];
      problems.push(diagnostic);
      lastEnd = range.end;
    }

    for (const problem of problems) {
      problem.source = 'Claw';
    }
    diagnostics.set(document.uri, problems);
  }

  function symbolAt (document: vscode.TextDocument, position: vscode.Position) {
    const analysis = analyze(document);
    const offset = document.offsetAt(position);
    const index = analysis.syntax.tokens.findIndex(token => token.start <= offset && offset < token.end);
    return analysis.resolve(index, analysis.symbolsAt(offset));
  }

  context.subscriptions.push(
    diagnostics,
    vscode.workspace.onDidOpenTextDocument(validate),
    vscode.workspace.onDidChangeTextDocument(({ document, contentChanges }) => {
      if (document.languageId === language && contentChanges.length) {
        clearTimeout(validationTimers.get(document));
        validationTimers.set(document, setTimeout(() => {
          validationTimers.delete(document);
          validate(document);
        }, validationDelay));
      }
    }),
    vscode.workspace.onDidCloseTextDocument(document => {
      clearTimeout(validationTimers.get(document));
      validationTimers.delete(document);
      diagnostics.delete(document.uri);
    }),
    vscode.workspace.onDidSaveTextDocument(saved => {
      if (saved.languageId === language && saved.uri.scheme === 'file') {
        for (const document of vscode.workspace.textDocuments) {
          if (document !== saved && cache.get(document)?.analysis.types.hasModule(saved.uri.fsPath)) {
            cache.delete(document);
            validate(document);
          }
        }
      }
    }),
    vscode.languages.registerDocumentSemanticTokensProvider(language, {
      provideDocumentSemanticTokens (document) {
        const analysis = analyze(document);
        const tokens = new vscode.SemanticTokensBuilder(semanticTokens);
        for (const token of analysis.syntax.tokens) {
          const kind = analysis.types.enumTokens.get(token);
          if (kind) {
            tokens.push(editorRange(document, token), kind);
          }
        }
        for (const token of analysis.structFields) {
          tokens.push(editorRange(document, token), 'property');
        }
        for (const token of analysis.syntax.typeTokens) {
          if (analysis.types.enumTokens.has(token)) {
            continue;
          }
          const name = String(token.value);
          if (name === Keyword.type) {
            tokens.push(editorRange(document, token), 'keyword');
          } else {
            const modifiers = primitiveTypes.includes(name) ? ['defaultLibrary'] : [];
            tokens.push(editorRange(document, token), 'type', modifiers);
          }
        }
        return tokens.build();
      }
    }, semanticTokens),
    vscode.languages.registerCompletionItemProvider(language, {
      provideCompletionItems (document, position) {
        const analysis = analyze(document);
        const offset = document.offsetAt(position);
        const { ignored, tokens } = analysis.syntax;
        if (ignored.some(range => range.start < offset && offset <= range.end)) {
          return [];
        }

        const word = document.getWordRangeAtPosition(position, identifier);
        const wordStart = word ? document.offsetAt(word.start) : offset;
        const previous = tokens.findLastIndex(token => token.type !== TokenType.EOF && token.end <= wordStart);
        const memberAccess = tokens[previous]?.type === TokenType.DOT;
        const visible = analysis.symbolsAt(offset);
        const symbols = memberAccess ? analysis.resolve(previous - 1, visible)?.members : visible;
        const items = Object.values(symbols || {}).map(symbol => {
          const item = new vscode.CompletionItem(symbol.name, itemKinds[symbol.kind]);
          item.detail = describe(symbol);
          item.documentation = symbol.origin;
          return item;
        });

        if (!memberAccess) {
          for (const keyword of Object.values(Keyword)) {
            items.push(new vscode.CompletionItem(keyword, vscode.CompletionItemKind.Keyword));
          }
        }
        return items;
      }
    }, '.'),
    vscode.languages.registerHoverProvider(language, {
      provideHover (document, position) {
        const analysis = analyze(document);
        const offset = document.offsetAt(position);
        const token = analysis.syntax.tokens.find(token => token.start <= offset && offset < token.end);
        const type = token && analysis.types.hovers.get(token);
        const symbol = symbolAt(document, position);
        if (type || symbol) {
          const signature = type ? `${token.value}: ${analysis.types.describe(type)}` : describe(symbol);
          const contents = new vscode.MarkdownString().appendCodeblock(signature, 'typescript');
          if (symbol?.origin) {
            contents.appendText(symbol.origin);
          }
          return new vscode.Hover(contents, token && editorRange(document, token));
        }
      }
    }),
    vscode.languages.registerDefinitionProvider(language, {
      provideDefinition (document, position) {
        const symbol = symbolAt(document, position);
        if (symbol?.declaration) {
          return new vscode.Location(document.uri, editorRange(document, symbol.declaration));
        }
      }
    }),
    vscode.languages.registerSignatureHelpProvider(language, {
      provideSignatureHelp (document, position) {
        const analysis = analyze(document);
        const offset = document.offsetAt(position);
        const { tokens } = analysis.syntax;
        const symbols = analysis.symbolsAt(offset);
        const frames: { close: TokenType; argument: number; callee?: Symbol }[] = [];

        for (const [index, token] of tokens.entries()) {
          if (token.start >= offset) {
            break;
          }

          const frame = frames.at(-1);
          switch (token.type) {
            case TokenType.LPAREN:
              frames.push({
                close: TokenType.RPAREN,
                argument: 0,
                callee: analysis.resolve(index - 1, symbols)
              });
              break;
            case TokenType.LBRACE:
              frames.push({
                close: TokenType.RBRACE,
                argument: 0
              });
              break;
            case TokenType.LBRACKET:
              frames.push({
                close: TokenType.RBRACKET,
                argument: 0
              });
              break;
            case TokenType.COMMA:
              if (frame) {
                frame.argument++;
              }
              break;
            default:
              if (frame?.close === token.type) {
                frames.pop();
              }
          }
        }

        const call = frames.findLast(frame => frame.callee?.kind === 'function');
        if (call) {
          const { callee, argument } = call;
          const signature = new vscode.SignatureInformation(describe(callee), callee.origin);
          signature.parameters = callee.parameters.map(parameter => new vscode.ParameterInformation(parameter));
          return {
            signatures: [signature],
            activeSignature: 0,
            activeParameter: Math.max(0, Math.min(argument, signature.parameters.length - 1))
          };
        }
      }
    }, '(', ',')
  );

  vscode.workspace.textDocuments.forEach(validate);
}
