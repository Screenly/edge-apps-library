import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const libraryRoot = path.resolve(__dirname, '..')
const templateRoot = path.resolve(__dirname, 'create-template')
const libraryPkg = JSON.parse(
  fs.readFileSync(path.join(libraryRoot, 'package.json'), 'utf-8'),
)

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
  '_gitignore',
])

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git'])

function toTitleCase(kebab) {
  return kebab
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function toKebabCase(name) {
  const kebab = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return kebab || 'my-edge-app'
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

const VALUE_FLAGS = new Set(['--pm', '--description', '--author'])

function parseCreateArgs(args) {
  const options = {
    pm: null,
    description: null,
    author: null,
    force: false,
    skipInstall: false,
  }
  const positional = []

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (VALUE_FLAGS.has(arg)) {
      const value = args[i + 1]
      if (value === undefined || value.startsWith('--')) {
        return { error: `Missing value for ${arg}` }
      }
      i++
      if (arg === '--pm') options.pm = value
      else if (arg === '--description') options.description = value
      else options.author = value
    } else if (arg === '--force') {
      options.force = true
    } else if (arg === '--skip-install') {
      options.skipInstall = true
    } else {
      positional.push(arg)
    }
  }

  return { directory: positional[0], options }
}

function detectPackageManager(explicit) {
  if (explicit) {
    if (explicit !== 'npm' && explicit !== 'bun') {
      console.error(
        `Unsupported package manager: ${explicit}. Use "npm" or "bun".`,
      )
      return null
    }
    return explicit
  }

  const userAgent = process.env.npm_config_user_agent || ''
  return userAgent.startsWith('bun') ? 'bun' : 'npm'
}

function finalizePackageJson(destination, pm) {
  const pkgPath = path.join(destination, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))

  pkg.devDependencies = {
    ...pkg.devDependencies,
    '@screenly/edge-apps': `^${libraryPkg.version}`,
    typescript: libraryPkg.dependencies.typescript,
    prettier: libraryPkg.devDependencies.prettier,
    '@types/node': libraryPkg.devDependencies['@types/node'],
  }

  if (pm === 'bun') {
    pkg.scripts.test = 'bun test --pass-with-no-tests src/'
  } else {
    pkg.scripts.test = 'vitest run --passWithNoTests'
    pkg.devDependencies.vitest = libraryPkg.devDependencies.vitest
    pkg.devDependencies.jsdom = libraryPkg.dependencies.jsdom
  }
  pkg.scripts['test:unit'] = pkg.scripts.test

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8')
}

function installDependencies(destination, pm) {
  console.log(`\nInstalling dependencies with ${pm}...`)
  const result = spawnSync(pm, ['install'], {
    cwd: destination,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (result.status !== 0) {
    console.warn(
      `\n${pm} install failed. Run it manually inside ${destination}.`,
    )
  }
}

function printScaffoldNextSteps(destination, appName, pm, skipInstall) {
  const relativePath = path.relative(process.cwd(), destination) || '.'
  const runCommand = pm === 'bun' ? 'bun run' : 'npm run'
  const installCommand = pm === 'bun' ? 'bun install' : 'npm install'

  const steps = [`cd "${relativePath}"`]
  if (skipInstall) steps.push(installCommand)
  steps.push(
    `Add an id to screenly.yml and screenly_qc.yml:\n       screenly edge-app create --name ${appName} --in-place`,
    `Start the dev server:\n       ${runCommand} dev`,
    `Deploy when ready:\n       ${runCommand} deploy`,
  )

  console.log(`
Done! Your Edge App is ready.

Next steps:
${steps.map((step, index) => `  ${index + 1}. ${step}`).join('\n')}
`)
}

function scaffoldNewApp(directory, options) {
  const pm = detectPackageManager(options.pm)
  if (!pm) {
    process.exitCode = 1
    return
  }

  const destination = path.resolve(process.cwd(), directory)

  if (fs.existsSync(destination)) {
    if (!fs.statSync(destination).isDirectory()) {
      console.error(`"${directory}" already exists and is not a directory.`)
      process.exitCode = 1
      return
    }
    const isEmpty = fs.readdirSync(destination).length === 0
    if (!isEmpty && !options.force) {
      console.error(
        `Directory "${directory}" already exists and is not empty. Use --force to write into it anyway.`,
      )
      process.exitCode = 1
      return
    }
  } else {
    fs.mkdirSync(destination, { recursive: true })
  }

  const appName = toKebabCase(path.basename(destination))
  const appTitle = toTitleCase(appName)
  const appDescription =
    options.description || `${appTitle} - Screenly Edge App`

  console.log(`\nScaffolding a new Edge App in ${destination}`)

  fs.cpSync(templateRoot, destination, { recursive: true })
  fs.copyFileSync(
    path.join(destination, '_gitignore'),
    path.join(destination, '.gitignore'),
  )
  fs.rmSync(path.join(destination, '_gitignore'))

  const replacements = {
    '{{APP_NAME}}': appName,
    '{{APP_TITLE}}': appTitle,
    '{{APP_DESCRIPTION}}': appDescription,
    '{{PM_RUN}}': pm === 'bun' ? 'bun run' : 'npm run',
    '{{PM_INSTALL}}': pm === 'bun' ? 'bun install' : 'npm install',
  }
  for (const filePath of walkTextFiles(destination)) {
    replaceInFile(filePath, replacements)
  }

  finalizePackageJson(destination, pm)

  if (options.author) {
    const pkgPath = path.join(destination, 'package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    pkg.author = options.author
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8')
  }

  if (pm === 'bun') {
    fs.rmSync(path.join(destination, 'vitest.config.ts'), { force: true })
  }

  if (!options.skipInstall) {
    installDependencies(destination, pm)
  }

  printScaffoldNextSteps(destination, appName, pm, options.skipInstall)
}

function initializeExistingProject() {
  const projectRoot = process.cwd()
  const pkgPath = path.join(projectRoot, 'package.json')

  let pkg
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  } catch (error) {
    console.error(
      `Failed to read or parse package.json at ${pkgPath}. ` +
        'Make sure you are running this command from an Edge App project root, ' +
        'or pass a directory name to scaffold a new Edge App: ' +
        'edge-apps-scripts create <directory>',
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

export async function createCommand(args) {
  const { directory, options, error } = parseCreateArgs(args)

  if (error) {
    console.error(error)
    process.exitCode = 1
    return
  }

  if (directory) {
    scaffoldNewApp(directory, options)
  } else {
    initializeExistingProject()
  }
}
