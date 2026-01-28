import path from "path"
import { Global } from "../global"

export namespace SlmapConfig {
  export interface Credentials {
    slmap_url: string
    slmap_token: string
  }

  /**
   * Get the path to the global slmap.json file
   */
  function getSlmapConfigPath(): string {
    return path.join(Global.Path.config, "slmap.json")
  }

  /**
   * Read SLMAP credentials from the global slmap.json file
   * Returns null if the file doesn't exist or credentials are missing
   */
  export async function read(): Promise<Credentials | null> {
    try {
      const filePath = getSlmapConfigPath()
      const file = Bun.file(filePath)
      const exists = await file.exists()

      if (!exists) {
        return null
      }

      const data = await file.json()
      const slmap_url = data.slmap_url
      const slmap_token = data.slmap_token

      if (!slmap_url || !slmap_token) {
        return null
      }

      return { slmap_url, slmap_token }
    } catch (error) {
      console.error("Failed to read SLMAP credentials:", error)
      return null
    }
  }

  /**
   * Write SLMAP credentials to the global slmap.json file
   */
  export async function write(credentials: Credentials): Promise<void> {
    const filePath = getSlmapConfigPath()
    await Bun.write(filePath, JSON.stringify(credentials, null, 2))
  }

  /**
   * Check if SLMAP credentials exist
   */
  export async function exists(): Promise<boolean> {
    const credentials = await read()
    return credentials !== null
  }
}
