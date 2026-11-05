import { createHash } from 'node:crypto'
import { access, mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const requiredAssets = [
  'public/assets/jltv-runtime.glb',
  'public/assets/jltv-card.webp',
  'public/assets/reference/leidos-logo-light.svg',
  'public/assets/reference/leidos-mark-light.svg',
  'public/assets/fonts/AvenirNextforLeidos-Th.otf',
  'public/assets/fonts/AvenirNextforLeidos-Lt.otf',
  'public/assets/fonts/AvenirNextforLeidos.otf',
  'public/assets/fonts/AvenirNextforLeidos-Md.otf',
  'public/assets/fonts/AvenirNextforLeidos-Demi.otf',
  'public/assets/fonts/AvenirNextforLeidos-Bold.otf',
]

async function findMissingAssets() {
  const missing = []
  for (const asset of requiredAssets) {
    try { await access(asset) } catch { missing.push(asset) }
  }
  return missing
}

async function provisionAssets(missing) {
  const encodedManifest = process.env.NEXUS_PRIVATE_ASSET_MANIFEST
  if (!encodedManifest) return

  let manifest
  try {
    manifest = JSON.parse(encodedManifest)
  } catch {
    throw new Error('NEXUS_PRIVATE_ASSET_MANIFEST must contain valid JSON.')
  }

  for (const asset of missing) {
    const entry = manifest[asset]
    if (!entry?.url || !entry?.sha1) {
      throw new Error(`The private asset manifest has no valid entry for ${asset}.`)
    }

    const response = await fetch(entry.url)
    if (!response.ok) {
      throw new Error(`Unable to provision ${asset}: HTTP ${response.status}.`)
    }

    const contents = Buffer.from(await response.arrayBuffer())
    const digest = createHash('sha1').update(contents).digest('hex')
    if (digest !== entry.sha1) {
      throw new Error(`Integrity check failed while provisioning ${asset}.`)
    }

    const temporaryPath = `${asset}.download`
    await mkdir(dirname(asset), { recursive: true })
    await writeFile(temporaryPath, contents)
    try {
      await rename(temporaryPath, asset)
    } catch (error) {
      await rm(temporaryPath, { force: true })
      throw error
    }
    console.log(`Provisioned ${asset}`)
  }
}

let missing = await findMissingAssets()
try {
  await provisionAssets(missing)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
missing = await findMissingAssets()

if (missing.length) {
  console.error(`Missing private runtime assets:\n${missing.map(asset => `  - ${asset}`).join('\n')}\nProvision the private asset bundle described in README.md before building or running NEXUS.`)
  process.exitCode = 1
}
