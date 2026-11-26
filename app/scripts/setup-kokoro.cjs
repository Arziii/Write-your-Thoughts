const { spawnSync } = require('node:child_process')
const { createHash } = require('node:crypto')
const { createReadStream } = require('node:fs')
const { access, mkdir, mkdtemp, rename, rm } = require('node:fs/promises')
const { dirname, join, resolve } = require('node:path')

const modelName = 'kokoro-multi-lang-v1_0'
const archiveName = `${modelName}.tar.bz2`
const archiveUrl = `https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/${archiveName}`
const archiveHash = '60703707bc05ccd48d60e1eb723f38b07d6e474795a0b6a588d7220400e0f7a4'
const voicesDir = resolve(__dirname, '../build/voices')
const modelDir = join(voicesDir, 'kokoro')

const modelFiles = [
  'model.onnx', 'voices.bin', 'tokens.txt', 'espeak-ng-data',
  'lexicon-us-en.txt', 'lexicon-zh.txt',
]

async function setup() {
  const hasModel = await Promise.all(modelFiles.map(file => access(join(modelDir, file)).then(() => true, () => false)))
  if (hasModel.every(Boolean)) {
    console.log('Kokoro model is ready.')
    return
  }

  await mkdir(voicesDir, { recursive: true })
  const staging = await mkdtemp(join(voicesDir, 'download-'))
  if (dirname(staging) !== voicesDir) throw new Error('Unexpected model staging directory.')
  try {
    const archive = join(staging, archiveName)
    console.log('Downloading the Kokoro model for the Windows build…')
    const download = spawnSync('curl.exe', ['--fail', '--location', '--silent', '--show-error', '--retry', '2', '--max-time', '300', '--output', archive, archiveUrl], { stdio: 'inherit' })
    if (download.status !== 0) throw new Error('Kokoro download did not finish.')

    const hash = createHash('sha256')
    for await (const chunk of createReadStream(archive)) hash.update(chunk)
    if (hash.digest('hex') !== archiveHash) throw new Error('Kokoro archive checksum did not match the published release.')

    const extract = spawnSync('tar.exe', ['-xf', archive, '-C', staging], { stdio: 'inherit' })
    if (extract.status !== 0) throw new Error('Could not unpack the Kokoro model.')
    const extractedModel = join(staging, modelName)
    await Promise.all(modelFiles.map(file => access(join(extractedModel, file))))
    await rename(extractedModel, modelDir)
    console.log('Kokoro model is ready.')
  } finally {
    await rm(staging, { recursive: true, force: true })
  }
}

setup().catch(error => { console.error(error.message); process.exitCode = 1 })
