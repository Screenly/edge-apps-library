import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'
import {
  toKebabCase,
  toTitleCase,
  walkTextFiles,
  replaceInFile,
} from './template-utils.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const libraryRoot = path.resolve(__dirname, '..')
const templateRoot = path.resolve(__dirname, 'create-template')
const libraryPkg = JSON.parse(
  fs.readFileSync(path.join(libraryRoot, 'package.json'), 'utf-8'),
)

const NPM_RUN_ALL2_VERSION = '^8.0.4'
const TYPES_BUN_VERSION = '^1.3.13'
const BUN_TYPES_VERSION = '^1.3.13'

const VALUE_FLAGS = new Set(['--pm', '--description', '--author'])
const BOOLEAN_FLAGS = new Set(['--force', '--skip-install'])

export function parseCreateArgs(args) {
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
      if (value === undefined || value.startsWith('-')) {
        return { error: `Missing value for ${arg}` }
      }
      i++
      if (arg === '--pm') options.pm = value
      else if (arg === '--description') options.description = value
      else options.author = value
    } else if (BOOLEAN_FLAGS.has(arg)) {
      if (arg === '--force') options.force = true
      else options.skipInstall = true
    } else if (arg.startsWith('-')) {
      return { error: `Unknown option: ${arg}` }
    } else {
      positional.push(arg)
    }
  }

  if (positional.length > 1) {
    return {
      error: `Expected a single directory argument, got: ${positional.join(', ')}`,
    }
  }

  return { directory: positional[0], options }
}

function validateDescription(description) {
  if (description !== null && /[\r\n]/.test(description)) {
    return 'Description cannot contain line breaks.'
  }
  return null
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
    'npm-run-all2': NPM_RUN_ALL2_VERSION,
    '@playwright/test': libraryPkg.peerDependencies['@playwright/test'],
  }

  if (pm === 'bun') {
    pkg.scripts.test = 'bun test --pass-with-no-tests src/'
    pkg.devDependencies['@types/bun'] = TYPES_BUN_VERSION
    pkg.devDependencies['bun-types'] = BUN_TYPES_VERSION
    pkg.devDependencies.jsdom = libraryPkg.dependencies.jsdom
    pkg.devDependencies['@types/jsdom'] =
      libraryPkg.devDependencies['@types/jsdom']
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

function printScaffoldNextSteps(destination, appName, pm) {
  const relativePath = path.relative(process.cwd(), destination) || '.'
  const runCommand = pm === 'bun' ? 'bun run' : 'npm run'
  const installCommand = pm === 'bun' ? 'bun install' : 'npm install'
  const needsInstall = !fs.existsSync(path.join(destination, 'node_modules'))

  const steps = [`cd "${relativePath}"`]
  if (needsInstall) steps.push(installCommand)
  steps.push(
    `Register the app to get an id for screenly.yml:\n       screenly edge-app create --name ${appName} --in-place`,
    `Start the dev server:\n       ${runCommand} dev`,
    `Deploy when ready:\n       ${runCommand} deploy`,
  )

  console.log(`
Done! Your Edge App is ready.

Next steps:
${steps.map((step, index) => `  ${index + 1}. ${step}`).join('\n')}
`)
}

export function scaffoldNewApp(directory, options) {
  const pm = detectPackageManager(options.pm)
  if (!pm) {
    process.exitCode = 1
    return
  }

  const descriptionError = validateDescription(options.description)
  if (descriptionError) {
    console.error(descriptionError)
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
    options.description ?? `${appTitle} - Screenly Edge App`

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
    '{{APP_DESCRIPTION_JSON}}': JSON.stringify(appDescription).slice(1, -1),
    '{{APP_DESCRIPTION_YAML}}': appDescription.replace(/'/g, "''"),
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

  printScaffoldNextSteps(destination, appName, pm)
}
