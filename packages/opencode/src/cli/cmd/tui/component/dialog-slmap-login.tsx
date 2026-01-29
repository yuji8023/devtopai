import { DialogPrompt } from "@tui/ui/dialog-prompt"
import { useDialog } from "@tui/ui/dialog"
import { useToast } from "@tui/ui/toast"
import { SlmapConfig } from "@/config/slmap"

export function DialogSLMAPLogin() {
  const dialog = useDialog()
  const toast = useToast()

  const handleLogin = async () => {
    try {
      // First prompt: slmap_url
      const slmapUrl = await DialogPrompt.show(dialog, "SLMAP URL", {
        placeholder: "输入 SLMAP 网址 (例如： https://slmap.example.com)",
      })

      if (!slmapUrl) {
        dialog.clear()
        return
      }

      // Second prompt: slmap_token
      const slmapToken = await DialogPrompt.show(dialog, "SLMAP Token", {
        placeholder: "输入 SLMAP 访问令牌",
      })

      if (!slmapToken) {
        dialog.clear()
        return
      }

      // Save to global slmap.json
      await SlmapConfig.write({
        slmap_url: slmapUrl,
        slmap_token: slmapToken,
      })

      toast.show({
        variant: "info",
        message: "SLMAP 身份信息保存成功",
        duration: 3000,
      })

      dialog.clear()
    } catch (error) {
      toast.show({
        variant: "error",
        message: `SLMAP 身份信息保存失败: ${error}`,
        duration: 5000,
      })
      dialog.clear()
    }
  }

  // Start the login flow immediately
  handleLogin()

  return null
}
