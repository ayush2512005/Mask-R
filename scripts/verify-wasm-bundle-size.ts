import { readdirSync, statSync } from 'fs';
import { join } from 'path';

const MAX_WASM_BYTES = 5 * 1024 * 1024;
const DIST_DIR = join(import.meta.dirname ?? '.', '../packages/web/dist');

function findWasmFiles(dir: string): string[] {
  const results: string[] = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...findWasmFiles(fullPath));
      } else if (entry.name.endsWith('.wasm')) {
        results.push(fullPath);
      }
    }
  } catch {
    // dir may not exist yet
  }
  return results;
}

const wasmFiles = findWasmFiles(DIST_DIR);
let totalBytes = 0;

for (const file of wasmFiles) {
  const size = statSync(file).size;
  totalBytes += size;
  console.log(`  ${file.replace(DIST_DIR, '')}: ${(size / 1024).toFixed(1)} KB`);
}

console.log(`\nTotal WASM: ${(totalBytes / 1024 / 1024).toFixed(2)} MB / 5.00 MB limit`);

if (totalBytes > MAX_WASM_BYTES) {
  console.error(`\n❌ WASM bundle exceeds 5MB limit! (${(totalBytes / 1024 / 1024).toFixed(2)} MB)`);
  process.exit(1);
} else {
  console.log(`✅ WASM bundle within limit.`);
}
