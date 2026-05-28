#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const distDir = join(projectRoot, 'dist');

// Path alias mappings to actual directories
const aliasToDir = {
  '@core': 'core',
  '@utils': 'utils',
  '@auth': 'auth',
  '@api': 'api',
  '@tools': 'tools',
  '@middleware': 'middleware',
  '@types': 'types'
};

function getRelativePath(fromFile, toDir) {
  const fromDir = dirname(fromFile);
  const toPath = join(distDir, toDir);
  // Always use forward slashes in ESM import specifiers — on Windows,
  // path.relative returns backslashes, which the JS parser then reads
  // as escape sequences (e.g. "..\utils" → invalid \u escape).
  const relativePath = relative(fromDir, toPath).split('\\').join('/');
  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
}

async function fixImports() {
  try {
    // Find all .js files in dist directory
    const files = await glob('**/*.js', { cwd: distDir });
    
    console.log(`Found ${files.length} files to process`);
    
    for (const file of files) {
      const filePath = join(distDir, file);
      let content = readFileSync(filePath, 'utf8');
      let modified = false;
      
      // Replace each alias
      for (const [alias, targetDir] of Object.entries(aliasToDir)) {
        const relativePath = getRelativePath(filePath, targetDir);



        // Handle static imports (from statements)
        const fromRegex = new RegExp(`from ['"]${alias}([^'"]*?)['"]`, 'g');
        // Handle dynamic imports (import() statements)
        const dynamicImportRegex = new RegExp(`import\\s*\\(\\s*['"]${alias}([^'"]*?)['"]\\s*\\)`, 'g');

        let newContent = content;

        // Replace static imports
        newContent = newContent.replace(fromRegex, `from '${relativePath}$1'`);

        // Replace dynamic imports
        newContent = newContent.replace(dynamicImportRegex, `import('${relativePath}$1')`);

        if (newContent !== content) {
          content = newContent;
          modified = true;
        }
      }
      
      if (modified) {
        writeFileSync(filePath, content, 'utf8');
        console.log(`Fixed imports in: ${file}`);
      }
    }
    
    console.log('Import fixing completed!');
  } catch (error) {
    console.error('Error fixing imports:', error);
    process.exit(1);
  }
}

fixImports();
