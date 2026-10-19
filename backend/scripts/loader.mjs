import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'next/server') {
    return nextResolve('next/server', context);
  }

  if (specifier.startsWith('@/')) {
    const rel = specifier.replace(/^@\//, './');
    let resolved = path.resolve(process.cwd(), rel);
    if (!fs.existsSync(resolved) && fs.existsSync(resolved + '.js')) {
      resolved = resolved + '.js';
    } else if (fs.existsSync(path.join(resolved, 'index.js'))) {
      resolved = path.join(resolved, 'index.js');
    }
    return nextResolve(pathToFileURL(resolved).href, context);
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
