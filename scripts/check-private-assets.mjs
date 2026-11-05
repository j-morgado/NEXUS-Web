import { access } from 'node:fs/promises'

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

const missing = []
for (const asset of requiredAssets) {
  try { await access(asset) } catch { missing.push(asset) }
}

if (missing.length) {
  console.error(`Missing private runtime assets:\n${missing.map(asset => `  - ${asset}`).join('\n')}\nProvision the private asset bundle described in README.md before building or running NEXUS.`)
  process.exitCode = 1
}
