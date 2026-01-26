import { DialogPrompt } from "@tui/ui/dialog-prompt"
import { useDialog } from "@tui/ui/dialog"
import { useToast } from "@tui/ui/toast"
import { Config } from "@/config/config"

export function DialogSLMAPLogin() {
  const dialog = useDialog()
  const toast = useToast()

  const handleLogin = async () => {
    try {
      // First prompt: slmap_url
      const slmapUrl = await DialogPrompt.show(dialog, "SLMAP URL", {
        placeholder: "Enter SLMAP URL (e.g., https://slmap.example.com)",
      })

      if (!slmapUrl) {
        dialog.clear()
        return
      }

      // Second prompt: slmap_token
      const slmapToken = await DialogPrompt.show(dialog, "SLMAP Token", {
        placeholder: "Enter SLMAP Token",
      })

      if (!slmapToken) {
        dialog.clear()
        return
      }

      // Save to global config
      await Config.updateGlobal({
        slmap_url: slmapUrl,
        slmap_token: slmapToken,
      } as any)

      toast.show({
        variant: "info",
        message: "SLMAP credentials saved successfully",
        duration: 3000,
      })

      dialog.clear()
    } catch (error) {
      toast.show({
        variant: "error",
        message: `Failed to save SLMAP credentials: ${error}`,
        duration: 5000,
      })
      dialog.clear()
    }
  }

  // Start the login flow immediately
  handleLogin()

  return null
}
