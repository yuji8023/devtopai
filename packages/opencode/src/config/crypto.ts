import { createDecipheriv, createHash } from "crypto"

// ── 格式 ──────────────────────────────────────────────────
// 加密文件内容:
//   -----BEGIN ENCRYPTED-----\n
//   base64( IV(16B) | ciphertext )
//
// 加密策略：AES-256-CBC
//   - 密钥 = SHA-256(seed) 派生
//   - IV 嵌入在 base64 数据的前 16 字节
//   - 文件以 -----BEGIN ENCRYPTED----- 标记头识别
// ──────────────────────────────────────────────────────────

const ALGO = "aes-256-cbc"
const HEADER = "-----BEGIN ENCRYPTED-----"
const IV_LEN = 16

// ── AES-256 密钥（SHA-256 派生） ──
const key = createHash("sha256").update("UQqs7L+sKSloUjBv8ZORMoC3YqGq/3zFms3iRhSfawM=").digest()

export namespace ConfigCrypto {
  export function isEncrypted(data: Buffer): boolean {
    return data.toString("utf-8").startsWith(HEADER)
  }

  export function decrypt(data: Buffer): Buffer {
    if (!isEncrypted(data)) return data

    const b64 = data.toString("utf-8").replace(HEADER, "").trim()
    const raw = Buffer.from(b64, "base64")
    if (raw.length < IV_LEN) return data

    const iv = raw.subarray(0, IV_LEN)
    const ct = raw.subarray(IV_LEN)

    const decipher = createDecipheriv(ALGO, key, iv)
    return Buffer.concat([decipher.update(ct), decipher.final()])
  }

  export function decryptText(encrypted: Buffer): string {
    const data = decrypt(encrypted)
    if (data === encrypted) return encrypted.toString("utf-8")
    return data.toString("utf-8")
  }
}
