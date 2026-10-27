import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'next/server') {
    let nextServerPath = path.resolve(process.cwd(), 'node_modules/next/server.js');
    if (!fs.existsSync(nextServerPath)) {
      nextServerPath = path.resolve(process.cwd(), 'backend/node_modules/next/server.js');
    }
    return {
      url: pathToFileURL(nextServerPath).href,
      shortCircuit: true,
      format: 'commonjs',
    };
  }

  if (specifier.startsWith('@/')) {
    const rel = specifier.replace(/^@\//, '');
    let resolved = path.resolve(process.cwd(), rel);
    if (!fs.existsSync(resolved) && !fs.existsSync(resolved + '.js') && !fs.existsSync(path.join(resolved, 'index.js'))) {
      const backendResolved = path.resolve(process.cwd(), 'backend', rel);
      if (fs.existsSync(backendResolved) || fs.existsSync(backendResolved + '.js') || fs.existsSync(path.join(backendResolved, 'index.js'))) {
        resolved = backendResolved;
      }
    }
    if (!fs.existsSync(resolved) && fs.existsSync(resolved + '.js')) {
      resolved = resolved + '.js';
    } else if (fs.existsSync(path.join(resolved, 'index.js'))) {
      resolved = path.join(resolved, 'index.js');
    }
    return {
      url: pathToFileURL(resolved).href,
      shortCircuit: true,
      format: 'module',
    };
  }

  if (specifier.startsWith('.') && context.parentURL) {
    const parentDir = path.dirname(fileURLToPath(context.parentURL));
    let resolved = path.resolve(parentDir, specifier);
    if (!fs.existsSync(resolved) && fs.existsSync(resolved + '.js')) {
      return nextResolve(pathToFileURL(resolved + '.js').href, context);
    }
  }

  return nextResolve(specifier, context);
}
