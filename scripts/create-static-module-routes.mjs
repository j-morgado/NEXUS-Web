import { copyFile, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distRoot = path.join(projectRoot, 'dist')
const routes = JSON.parse(await readFile(path.join(projectRoot, 'src/modules/routes.json'), 'utf8'))

for (const slug of routes) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`Invalid static module slug: ${slug}`)
  const routeDirectory = path.join(distRoot, 'modules', slug)
  await mkdir(routeDirectory, { recursive: true })
  await copyFile(path.join(distRoot, 'index.html'), path.join(routeDirectory, 'index.html'))
}

console.log(`Created ${routes.length} static module route shells.`)

