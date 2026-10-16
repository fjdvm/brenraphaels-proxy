// Usage: node scripts/gen-callers.mjs crms pos ...
// Generates a key per Caller and writes CALLER_KEY_<NAME> and CALLERS (hashes only) into .env.
import { createHash, randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const names = process.argv.slice(2)
if (names.length === 0) {
  console.error('Usage: node scripts/gen-callers.mjs <caller-name>...')
  process.exit(1)
}

const keys = Object.fromEntries(names.map((n) => [n, randomBytes(32).toString('hex')]))
const callers = names.map((name) => ({
  name,
  keyHash: createHash('sha256').update(keys[name]).digest('hex'),
}))

const kept = (existsSync('.env') ? readFileSync('.env', 'utf8').split('\n') : []).filter(
  (l) => l && !l.startsWith('CALLERS=') && !l.startsWith('CALLER_KEY_'),
)
const lines = [
  ...kept,
  ...names.map((n) => `CALLER_KEY_${n.toUpperCase().replace(/\W/g, '_')}=${keys[n]}`),
  `CALLERS='${JSON.stringify(callers)}'`,
]
writeFileSync('.env', lines.join('\n') + '\n')
console.log(`Wrote ${names.length} Callers to .env`)
