import fs from 'fs'
import path from 'path'

const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.html',
  '.css',
  '.scss',
  '.json',
  '.yml',
  '.yaml',
  '.md',
  '.txt',
  '.svg',
  '.gitignore',
  '.ignore',
])

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git'])

function toTitleCase(kebab) {
  return kebab
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function walkTextFiles(dir) {
  const results = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) results.push(...walkTextFiles(fullPath))
    } else if (
      entry.isFile() &&
      (TEXT_EXTENSIONS.has(path.extname(entry.name)) ||
        TEXT_EXTENSIONS.has(entry.name))
    ) {
      results.push(fullPath)
    }
  }
  return results
}

function replaceInFile(filePath, replacements) {
  const original = fs.readFileSync(filePath, 'utf-8')
  const updated = Object.entries(replacements).reduce(
    (src, [placeholder, value]) => src.replaceAll(placeholder, value),
    original,
  )
  if (updated !== original) fs.writeFileSync(filePath, updated, 'utf-8')
}

export async function createCommand(_args) {
  const projectRoot = process.cwd()
  const pkgPath = path.join(projectRoot, 'package.json')

  let pkg
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  } catch (error) {
    console.error(
      `Failed to read or parse package.json at ${pkgPath}. ` +
        'Make sure you are running this command from an Edge App project root.',
    )
    if (error instanceof Error && error.message) {
      console.error(`Details: ${error.message}`)
    }
    process.exitCode = 1
    return
  }

  const rawName =
    typeof pkg.name === 'string' && pkg.name.length > 0
      ? pkg.name
      : path.basename(projectRoot) || 'my-edge-app'
  const appName = rawName.replace(/^@[^/]+\//, '').replace(/\//g, '-')
  const appTitle = toTitleCase(appName)
  const appDescription = `${appTitle} - Screenly Edge App`

  const replacements = {
    '{{APP_NAME}}': appName,
    '{{APP_TITLE}}': appTitle,
    '{{APP_DESCRIPTION}}': appDescription,
  }

  console.log(`\nInitializing Edge App: ${appTitle}`)

  for (const filePath of walkTextFiles(projectRoot)) {
    replaceInFile(filePath, replacements)
  }

  const updatedPkg = { ...pkg }
  delete updatedPkg['bun-create']
  fs.writeFileSync(pkgPath, JSON.stringify(updatedPkg, null, 2) + '\n', 'utf-8')

  console.log(`
Done! Your Edge App is ready.

Next steps:
  1. Add an id field to screenly.yml and screenly_qc.yml.

  2. Install dependencies:
       npm install

  3. Start the dev server:
       npm run dev

  4. Deploy when ready:
       npm run deploy
`)
}
