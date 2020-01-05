const fs = require('fs').promises
const crypto = require('crypto')
const algorithm = 'aes-256-cbc'
const key = Buffer.from(process.env.FILE_ENCRYPTION_KEY, 'base64')
const iv = Buffer.from(process.env.FILE_ENCRYPTION_IV, 'base64')

module.exports = {read, write, update}

function encrypt(text) {
  const cipher = crypto.createCipheriv(algorithm, key, iv)
  const encrypted = cipher.update(Buffer.from(text))
  return Buffer.concat([encrypted, cipher.final()])
}

function decrypt(encryptedBuffer) {
  if (!encryptedBuffer.length) return ''
  const decipher = crypto.createDecipheriv(algorithm, key, iv)
  const decrypted = decipher.update(encryptedBuffer)
  return Buffer.concat([decrypted, decipher.final()]).toString()
}

async function read (filePath) {
  const file = await fs.open(filePath, 'r+')
  return decrypt(await file.readFile())
}

async function write (filePath, str) {
  const file = await fs.open(filePath, 'w+')
  if (!str.length) {
    await file.truncate()
  } else {
    await file.writeFile(encrypt(str))
  }
  return file.close()
}

async function update (filePath, str) {
  const content = await read(filePath)
  return write(filePath, content + str)
}