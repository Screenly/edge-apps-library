import fs from 'fs'
import path from 'path'
import { toTitleCase, walkTextFiles, replaceInFile } from './template-utils.js'
import { parseCreateArgs, scaffoldNewApp } from './create-scaffold.js'

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
