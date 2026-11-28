import { once } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import type {
  Bindings,
  BlockOptions,
  FunctionArgument,
  FunctionBinding
} from '../types.ts';

interface ExtensionBlock {
  opcode: string;
  blockType?: string;
  text?: string | string[] | { default: string };
  arguments?: Record<string, { type: string; menu?: string }>;
  branchCount?: number;
}

interface ExtensionInfo {
  id: string;
  blocks: (ExtensionBlock | string)[];
  menus?: Record<string, { acceptReporters?: boolean }>;
}

export interface LoadedExtension {
  bindings: Bindings;
  ids: string[];
  url: string;
}

// Supply some scratch globals
// todo: we may need more but this should be fine for now.
const setup = String.raw`
  const clawExtension = (() => {
    const scripts = [];
    const registered = [];
    const stringify = JSON.stringify;
    const noop = () => {};
    const stub = fields => {
      const proxy = new Proxy(Object.assign(function () {}, fields), {
        get (target, key) {
          if (Reflect.has(target, key)) {
            return Reflect.get(target, key);
          }
          if (key === 'then') {
            return undefined;
          }
          if (key === Symbol.toPrimitive) {
            return () => '';
          }
          if (key === Symbol.iterator) {
            return function * () {};
          }
          return proxy;
        },
        apply: () => proxy,
        construct: () => proxy
      });
      return proxy;
    };

    const location = {
      href: 'https://turbowarp.org/',
      hostname: 'turbowarp.org',
      origin: 'https://turbowarp.org',
      search: ''
    };
    const renderer = stub({
      canvas: stub({
        width: 480,
        height: 360
      }),
      _nativeSize: [480, 360]
    });
    class AudioContext {
      createGain () {
        return stub({ gain: { value: 1 } });
      }
    }
    const runtime = stub({
      renderer,
      targets: [],
      audioEngine: {
        audioContext: new AudioContext(),
        inputNode: stub({ gain: { value: 1 } })
      },
      extensionStorage: Object.create(null)
    });
    const constants = names => Object.fromEntries(
      names.split(' ').map(name => [name.toUpperCase(), name])
    );
    const translate = (message, values = {}) => {
      const text = typeof message === 'string' ? message : message.default || message.id;
      return text.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);
    };
    translate.setup = noop;
    translate.language = 'en';

    Object.assign(globalThis, {
      Scratch: {
        BlockType: constants('command reporter Boolean hat event conditional loop button label xml'),
        ArgumentType: constants('string number angle Boolean color image matrix note costume sound'),
        TargetType: constants('sprite stage'),
        Cast: {
          toNumber: value => Number(value) || 0,
          toString: String
        },
        gui: { getBlockly: () => new Promise(noop) },
        translate,
        renderer,
        vm: stub({
          renderer,
          runtime
        }),
        extensions: {
          unsandboxed: true,
          register (extension) {
            registered.push(extension);
          }
        }
      },
      window: globalThis,
      self: globalThis,
      location,
      document: stub({ currentScript: { src: location.href } }),
      navigator: {
        language: 'en',
        userAgent: '',
        maxTouchPoints: 0
      },
      AudioContext,
      EventTarget: class {
        addEventListener () {}
        removeEventListener () {}
        dispatchEvent () { return true; }
      },
      TextEncoder: class {
        encode (text = '') {
          return Uint8Array.from(unescape(encodeURIComponent(text)), char => char.charCodeAt(0));
        }
      },
      TextDecoder: class {
        decode (bytes = []) {
          const data = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
          const text = Array.from(data, byte => String.fromCharCode(byte)).join('');
          return decodeURIComponent(escape(text));
        }
      },
      Blob: class {
        constructor (parts) {
          this.parts = parts;
        }
      },
      URL: class {
        static createObjectURL (blob) {
          return 'blob:claw:' + (scripts.push(blob.parts) - 1);
        }
      },
      btoa (value) {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        let result = '';
        for (let i = 0; i < value.length; i += 3) {
          const bits = value.charCodeAt(i) << 16 | value.charCodeAt(i + 1) << 8 | value.charCodeAt(i + 2);
          result += alphabet[bits >> 18 & 63] + alphabet[bits >> 12 & 63];
          result += i + 1 < value.length ? alphabet[bits >> 6 & 63] : '=';
          result += i + 2 < value.length ? alphabet[bits & 63] : '=';
        }
        return result;
      },
      queueMicrotask: callback => Promise.resolve().then(callback)
    });
    for (const name of ['DOMParser', 'Headers', 'Image', 'MutationObserver', 'XMLSerializer']) {
      globalThis[name] = stub();
    }
    for (const name of ['addEventListener', 'removeEventListener', 'requestAnimationFrame',
      'cancelAnimationFrame', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval']) {
      globalThis[name] = noop;
    }

    return {
      readInfo () {
        return stringify(registered.map(extension => {
          const { id, blocks, menus } = extension.getInfo();
          return { id, blocks, menus };
        }));
      },
      readScript (index) {
        return stringify(scripts[index].map(part =>
          typeof part === "string" ? part : Array.from(new Uint8Array(part))
        ));
      }
    };
  })();
`;

const evaluator = `
  import { types } from 'node:util';
  import { parentPort, workerData } from 'node:worker_threads';
  import { SourceTextModule, constants, createContext, runInContext } from 'node:vm';

  const context = createContext(constants.DONT_CONTEXTIFY, {
    codeGeneration: { strings: false }
  });
  const run = source => runInContext(source, context, { displayErrors: false });
  run(${JSON.stringify(setup)});

  // Some gallery scripts bundle modules as blob URLs.
  const importError = run('new Error("Only bundled modules can be imported.")');
  async function importModule (specifier) {
    const match = /^blob:claw:(\\d+)$/.exec(specifier);
    if (!match) {
      throw importError;
    }
    try {
      const parts = JSON.parse(run('clawExtension.readScript(' + match[1] + ')'));
      const blob = new Blob(parts.map(part => typeof part === 'string' ? part : Uint8Array.from(part)));
      const module = new SourceTextModule(await blob.text(), {
        context,
        importModuleDynamically: importModule
      });
      await module.link(() => { throw importError; });
      await module.evaluate();
      return module;
    } catch {
      throw importError;
    }
  }

  process.on('uncaughtException', error => {
    const message = error && typeof error === 'object' && !types.isProxy(error)
      ? Object.getOwnPropertyDescriptor(error, 'message')?.value
      : error;
    parentPort.postMessage({
      error: typeof message === 'string' ? message : 'Extension evaluation failed.'
    });
  });

  const result = runInContext(workerData, context, {
    displayErrors: false,
    importModuleDynamically: importModule
  });
  if (types.isPromise(result)) {
    // Keep promise callbacks in the extension's context.
    const settled = run(${JSON.stringify(`
      promise => {
        let done = false;
        promise.then(() => { done = true; });
        return () => done;
      }
    `)})(result);
    while (!settled()) {
      await new Promise(resolve => setTimeout(resolve, 5));
    }
  }
  await new Promise(setImmediate);
  parentPort.postMessage({ info: run('clawExtension.readInfo()') });
`;

async function readInfo (source: string): Promise<ExtensionInfo[]> {
  const worker = new Worker(evaluator, {
    eval: true,
    execArgv: [
      '--input-type=module',
      '--permission',
      '--experimental-vm-modules',
      '--disable-warning=ExperimentalWarning'
    ],
    env: {},
    resourceLimits: { maxOldGenerationSizeMb: 64 },
    workerData: source
  });
  try {
    const [{ info, error }] = await once(worker, 'message', {
      signal: AbortSignal.timeout(5000)
    });
    if (error !== undefined) {
      throw new Error(error);
    }
    return JSON.parse(info);
  } finally {
    await worker.terminate();
  }
}

const primitives: Record<string, number> = {
  number: 4,
  angle: 8,
  color: 9
};
const shadows: Record<string, [string, string]> = {
  matrix: ['matrix', 'MATRIX'],
  note: ['note', 'NOTE'],
  costume: ['looks_costume', 'COSTUME'],
  sound: ['sound_sounds_menu', 'SOUND_MENU']
};

function bindBlock(
  id: string, 
  block: ExtensionBlock,
  menus: ExtensionInfo['menus']
): FunctionBinding {
  const type = block.blockType?.toLowerCase();
  const hat = type === 'hat' || type === 'event';
  let blockType: FunctionBinding['blockType'] = 'command';
  if (hat) {
    blockType = 'hat';
  } else if (type === 'reporter' || type === 'boolean') {
    blockType = 'reporter';
  }

  const argumentsInfo = block.arguments || {};
  const names = [block.text].flat().flatMap(label => {
    const text = typeof label === 'string' ? label : label?.default || '';
    return Array.from(text.matchAll(/\[(.+?)\]/g), match => match[1]);
  });
  names.push(...Object.keys(argumentsInfo));

  const parameters = names.filter((name, index) => names.indexOf(name) === index)
    .flatMap(name => {
      const type = argumentsInfo[name]?.type?.toLowerCase();
      if (type === 'image') {
        return [];
      }

      const menu = argumentsInfo[name]?.menu;
      let argument: FunctionArgument = primitives[type] || 10;
      let shadow = shadows[type];
      if (menu) {
        if (menus?.[menu]?.acceptReporters) {
          shadow = [`${id}_menu_${menu}`, menu];
        } else {
          argument = 'field';
        }
      }
      return [{
        name,
        type,
        argument,
        shadow
      }];
    });
  const branches = type === 'conditional' || type === 'loop' ? block.branchCount || 1 : 0;

  return {
    kind: 'function',
    blockType,
    ...(type === 'boolean' && {
      resultType: 'boolean'
    }),
    args: [
      ...parameters.map(({ argument }) => argument),
      ...Array<FunctionArgument>(branches + Number(hat)).fill('body')
    ],
    create: ({ inputs, fields, bodies }, compiler) => {
      const blockInputs: BlockOptions['inputs'] = Object.create(null);
      const blockFields: BlockOptions['fields'] = Object.create(null);

      // Create the serialized block
      for (const [index, param] of parameters.entries()) {
        if (param.argument === 'field') {
          blockFields[param.name] = [String(fields[index][0]), null];
        } else if (param.shadow) {
          blockInputs[param.name] = compiler.menu(
            param.shadow[0],
            param.shadow[1],
            fields[index],
            inputs[index]
          );
        } else {
          blockInputs[param.name] = param.type === 'boolean'
            ? compiler.boolean(inputs[index])
            : inputs[index];
        }
      }
      for (let index = 0; index < branches; index++) {
        const name = index ? `SUBSTACK${index + 1}` : 'SUBSTACK';
        blockInputs[name] = [2, bodies[parameters.length + index]];
      }
      return {
        opcode: `${id}_${block.opcode}`,
        inputs: blockInputs,
        fields: blockFields,
        ...(hat && {
          topLevel: true,
          next: bodies[parameters.length]
        })
      };
    }
  };
}

export function isExtensionImport (source: string) {
  return source.startsWith('tw:') || source.endsWith('.js');
}

export function resolveExtensionImport (source: string, importer: string) {
  if (source.startsWith('tw:')) {
    const slug = source.slice(3)
      .split('/')
      .map(encodeURIComponent)
      .join('/');

    return `https://extensions.turbowarp.org/${slug}.js`;
  }
  return fs.realpathSync(path.resolve(path.dirname(importer), source));
}

export default async function loadExtension (location: string): Promise<LoadedExtension> {
  let url = location;
  let source: string;
  if (location.startsWith('https://')) {
    const response = await fetch(location, {
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    source = await response.text();
  } else {
    source = fs.readFileSync(location, 'utf8');
    url = `data:application/javascript;base64,${Buffer.from(source).toString('base64')}`;
  }

  const info = await readInfo(source);
  const bindings: Bindings = Object.create(null);
  for (const { id, blocks, menus } of info) {
    for (const block of blocks) {
      if (typeof block === 'string' || ['button', 'label', 'xml'].includes(block.blockType)) {
        // todo: do we need to do something about these?
        continue;
      }
      // Convert block names to camelCase.
      const name = block.opcode.replace(/^_+|_+$/g, '').replace(
        /^[A-Z]+(?=[A-Z][a-z]|_|$)|^[A-Z]|_+([a-zA-Z0-9]+)/g,
        (part, word: string) => {
          if (!word) {
            return part.toLowerCase();
          }
          const segment = /^[A-Z0-9]+$/.test(word) ? word.toLowerCase() : word;
          return segment[0].toUpperCase() + segment.slice(1);
        }
      );
      bindings[name] = bindBlock(id, block, menus);
    }
  }
  return {
    bindings,
    ids: info.map(({ id }) => id),
    url
  };
}
