import { createDecipheriv, privateDecrypt, constants } from "crypto"

// ── 格式 ──────────────────────────────────────────────────
// MAGIC | encKey(512B) | IV(12B) | ciphertext | tag(16B)
//
// 分块策略：混合加密（Hybrid Encryption）
//   - RSA-4096 加密一个随机 AES-256 会话密钥（每文件仅 1 次 RSA 操作）
//   - AES-256-GCM 加密实际内容（无大小限制，流式处理）
//   - 每文件独立会话密钥，类似 TLS / PGP 的做法
// ──────────────────────────────────────────────────────────

const MAGIC = Buffer.from("-----BEGIN ENCRYPTED-----\n")
const ALGO = "aes-256-gcm"
const SESSION_KEY_LEN = 32
const IV_LEN = 12
const AUTH_TAG_LEN = 16
const RSA_BLOCK = 512 // RSA-4096 密文块大小
const HEADER_LEN = MAGIC.length + RSA_BLOCK + IV_LEN

// ── 私钥（硬编码于代码中，仅用于解密） ──
const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
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
5DJhzbTILbchH9RxKovlhoVmAP8T
-----END PRIVATE KEY-----`

// ── 公钥（对外公开，用于加密脚本） ──
export const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAvH0HyBo53ABrPM2IaDa0
ha8ZXx0Kc56j4hpZVISsC84rDPXPYPS3CiL9X7umg6rMcl0d2ivGpJBZ9JM7aXIN
aAyWWjN5OA6AAsCGXC8C5BiXQHQbeNJUIH3z/qCJ9mkLBZ+BVaNwe5kMXaaBChS6
jkrrm8MBmj5Xneusw6a0nBLu8n5p1Bu856PFMV5leClb/SqALmeTx2GlbXIMYmHT
xTOoZ2+yGguMY4UtmVrZeAE3j4Qh17B3UemgZq0oQld8dURBbEa4FhVcwkRREMMZ
umONb/nteCBeJlQDC8aWCbxtCP2ouTQIj+gL53EcxMYh0/UvOTlDRJMkxgftHrtQ
JcEV+4t6QzT06xWIPV7D64Ed0q+Op9GNmFt/OIUD6fEhtnSurJ5qStgIOPK3sRo0
svH6J1cgWSfCKcsUdbtyuW/lVZGX1wMcM0F5+I7B93YwtlJWhAIUHZXlpXpK5r7t
WKWDxryhCm3tVta6+RaTXKYkTQUqm6YmsypftPn81+bYxmGXY1w9xWdJMY+d7M4i
0p6bOvsGitDWIzTRq8DKEa8li159mXPUfg4qJfzdqoc4gm+8jyuiUAQoMD+8olsd
YLn4hQiwxTVt8aQ6ldG41INL6HtMdV0I3wmhWRrMeIWDGpUGR4rf0AyFr0s5+sbW
B149KCRgLkAX1IKMPlNac/0CAwEAAQ==
-----END PUBLIC KEY-----`

export namespace ConfigCrypto {
  export function isEncrypted(data: Buffer): boolean {
    if (data.length < HEADER_LEN) return false
    return data.subarray(0, MAGIC.length).equals(MAGIC)
  }

  export function decrypt(data: Buffer): Buffer {
    if (!isEncrypted(data)) return data

    const encKey = data.subarray(MAGIC.length, MAGIC.length + RSA_BLOCK)
    const iv = data.subarray(MAGIC.length + RSA_BLOCK, HEADER_LEN)
    const tag = data.subarray(data.length - AUTH_TAG_LEN)
    const ciphertext = data.subarray(HEADER_LEN, data.length - AUTH_TAG_LEN)

    const sessionKey = privateDecrypt(
      { key: PRIVATE_KEY, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
      encKey,
    )

    const decipher = createDecipheriv(ALGO, sessionKey, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()])
  }

  export function decryptText(encrypted: Buffer): string {
    const data = decrypt(encrypted)
    if (data === encrypted) return encrypted.toString("utf-8")
    return data.toString("utf-8")
  }

  /**
   * 加密明文（供 CI / 构建脚本调用，需引入 crypto 和公钥）
   *
   * 使用方式:
   *   const { ConfigCrypto } = require("./config/crypto")
   *   const enc = ConfigCrypto.encrypt(fs.readFileSync("foo.md", "utf-8"))
   *   fs.writeFileSync("foo.md", enc)
   */
  export function encrypt(plain: string): Buffer {
    const crypto = require("crypto")
    const sessionKey = crypto.randomBytes(SESSION_KEY_LEN)
    const iv = crypto.randomBytes(IV_LEN)

    const encKey = crypto.publicEncrypt(
      { key: PUBLIC_KEY, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
      sessionKey,
    )

    const cipher = crypto.createCipheriv(ALGO, sessionKey, iv)
    const ciphertext = Buffer.concat([cipher.update(plain, "utf-8"), cipher.final()])
    const tag = cipher.getAuthTag()

    return Buffer.concat([MAGIC, encKey, iv, ciphertext, tag])
  }
}
