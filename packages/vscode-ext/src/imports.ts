import fs from 'node:fs';
import path from 'node:path';
import { extensions } from '../../compiler/src/blocks/index.ts';
import type { TypeModule } from '../../compiler/src/type-checker.ts';
import { NodeType } from '../../compiler/src/types.ts';
import { assetImport } from '../../compiler/src/util/asset-import.ts';
import loadExtension, {
  isExtensionImport,
  resolveExtensionImport,
  type LoadedExtension
} from '../../compiler/src/util/load-extension.ts';
import { parse } from './parser.ts';

type Module = ReturnType<typeof parse> & TypeModule;

export class Imports {
  private static cache: Record<string, Promise<LoadedExtension>> = Object.create(null);
  entry: Module;
  files: Record<string, boolean> = Object.create(null);
  private modules: Record<string, Module> = Object.create(null);
  private errors: Record<string, Record<string, unknown>> = Object.create(null);

  constructor (source: string, file: string) {
    this.entry = this.add(source, file);
  }

  private add (source: string, file: string): Module {
    const module = {
      file,
      ...parse(source)
    };
    this.modules[file] = module;
    this.files[file] = true;
    return module;
  }

  resolve (source: string, importer: string) {
    if (Object.hasOwn(this.errors[importer] || {}, source)) {
      throw this.errors[importer][source];
    }
    if (!importer) {
      return;
    }
    const file = this.resolveFile(source, importer);
    if (file) {
      return this.modules[file] || this.add(fs.readFileSync(file, 'utf8'), file);
    }
  }

  static invalidate (file: string) {
    delete Imports.cache[file];
  }

  private resolveFile (source: string, importer: string) {
    const importPath = path.resolve(path.dirname(importer), source);
    const clawPath = importPath.endsWith('.claw') ? importPath : importPath + '.claw';
    if (!source.startsWith('tw:') && (
      source.endsWith('.claw') || fs.statSync(clawPath, { throwIfNoEntry: false })?.isFile()
    )) {
      return fs.realpathSync(clawPath);
    }
    if (assetImport(source) || Object.hasOwn(extensions, source) || isExtensionImport(source)) {
      return;
    }

    for (let directory = path.dirname(importer);;) {
      const packageDirectory = path.join(directory, 'claw_modules', source);
      const manifestPath = path.join(packageDirectory, 'claw.json');
      if (fs.statSync(manifestPath, { throwIfNoEntry: false })?.isFile()) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        if (typeof manifest?.main !== 'string') {
          throw new Error(`Package '${source}' has no main file.`);
        }
        return fs.realpathSync(path.join(packageDirectory, manifest.main));
      }

      const parent = path.dirname(directory);
      if (parent === directory) {
        throw new Error(`Cannot find package '${source}'.`);
      }
      directory = parent;
    }
  }

  async load () {
    const pending = [this.entry];
    const visited: Record<string, boolean> = Object.create(null);
    for (const module of pending) {
      if (visited[module.file]) {
        continue;
      }
      visited[module.file] = true;

      await Promise.all(module.program.body.map(async statement => {
        if (statement.type !== NodeType.ImportStatement) {
          return;
        }
        const { source } = statement;
        try {
          const dependency = this.resolve(source, module.file);
          if (dependency) {
            pending.push(dependency);
          } else if (module.file && isExtensionImport(source)) {
            module.extensionImports ||= Object.create(null);
            if (statement.typeOnly) {
              module.extensionImports[source] ||= null;
            } else {
              const location = resolveExtensionImport(source, module.file);
              Imports.cache[location] ||= loadExtension(location).catch(error => {
                delete Imports.cache[location];
                throw error;
              });
              this.files[location] = true;
              module.extensionImports[source] = await Imports.cache[location];
            }
          }
        } catch (error) {
          this.errors[module.file] ||= Object.create(null);
          this.errors[module.file][source] = error;
        }
      }));
    }
  }
}
