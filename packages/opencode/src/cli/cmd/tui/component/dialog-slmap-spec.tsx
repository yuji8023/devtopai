import { createSignal, onMount, Show } from "solid-js"
import { DialogSelect } from "../ui/dialog-select"
import { useDialog } from "@tui/ui/dialog"
import { useToast } from "@tui/ui/toast"
import { useSync } from "@tui/context/sync"
import path from "path"

interface SlmapProject {
  pkid: string
  sVer: string
  prjName?: string
  prjNo?: string
}

// Module-level variables to prevent rapid repeated checks
let lastCheckTime = 0
let isChecking = false
let cachedProjectInfo: SlmapProject | null = null
let cachedError: string | null = null

export function DialogSLMAPSpec() {
  const dialog = useDialog()
  const toast = useToast()
  const sync = useSync()
  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal<string | null>(cachedError)
  const [projectInfo, setProjectInfo] = createSignal<SlmapProject | null>(cachedProjectInfo)

  onMount(async () => {
    // Prevent concurrent checks
    if (isChecking) {
      return
    }

    // Check if we recently read the file (within 500ms) to prevent rapid re-reads
    const now = Date.now()
    if (now - lastCheckTime < 500) {
      // Restore cached state
      if (cachedProjectInfo) {
        setProjectInfo(cachedProjectInfo)
      }
      if (cachedError) {
        setError(cachedError)
      }
      return
    }

    isChecking = true
    lastCheckTime = now
    console.log("[slmap-spec] 读取项目信息")

    try {
      const directory = sync.data.path.directory
      const filePath = path.join(directory, "slmap.json")
      const file = Bun.file(filePath)
      const exists = await file.exists()

      if (!exists) {
        console.log("[slmap-spec] slmap.json 文件不存在")
        const errorMsg = "未找到 slmap.json 文件。请先运行 /slmap-project 命令选择项目。"
        cachedError = errorMsg
        setError(errorMsg)
        return
      }

      const projectData = (await file.json()) as SlmapProject
      console.log("[slmap-spec] 读取到项目信息:", projectData)
      cachedProjectInfo = projectData
      setProjectInfo(projectData)
    } catch (err) {
      console.error("[slmap-spec] 读取项目信息失败:", err)
      console.error("[slmap-spec] 错误类型:", typeof err)
      console.error("[slmap-spec] 错误详情:", JSON.stringify(err, null, 2))
      if (err instanceof Error) {
        console.error("[slmap-spec] 错误消息:", err.message)
        console.error("[slmap-spec] 错误堆栈:", err.stack)
      }
      const errorMsg = `读取项目信息失败: ${err}`
      cachedError = errorMsg
      setError(errorMsg)
    } finally {
      isChecking = false
    }
  })

  const downloadSpec = async (specLevel: number) => {
    setLoading(true)
    setError(null)

    try {
      console.log("[slmap-spec] 开始下载 Spec-" + specLevel)

      const config = sync.data.config
      const slmapUrl = (config as any).slmap_url
      const slmapToken = (config as any).slmap_token

      if (!slmapUrl || !slmapToken) {
        throw new Error("SLMAP凭证未配置。请先运行 /login 命令。")
      }

      const project = projectInfo()
      if (!project) {
        throw new Error("项目信息未加载")
      }

      // Show downloading toast
      toast.show({
        variant: "info",
        message: `正在下载规格说明书 Spec-${specLevel}...`,
        duration: 3000,
      })

      // Construct the API endpoint
      const apiUrl = `${slmapUrl}/ide/exportSpec`

      const requestBody = {
        prjId: project.pkid,
        sVer: project.sVer,
        specLevel: specLevel,
      }

      // Make POST request to download the spec
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "__ACCESS_TOKEN__": slmapToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      })

      console.log("[slmap-spec] 响应状态:", response.status, response.statusText)

      if (!response.ok) {
        throw new Error(`下载失败: ${response.statusText}`)
      }

      // Get the response as blob
      const blob = await response.blob()

      // Save the zip file temporarily
      const directory = sync.data.path.directory
      const tempZipPath = path.join(directory, "temp_spec.zip")
      await Bun.write(tempZipPath, blob)

      // Extract the zip file using PowerShell (Windows)
      const { execSync } = await import("child_process")

      try {
        const cmd = `powershell -command "Expand-Archive -Path '${tempZipPath}' -DestinationPath '${directory}' -Force"`
        execSync(cmd, {
          cwd: directory,
        })
      } catch (unzipError) {
        console.log("[slmap-spec] PowerShell 解压失败，尝试 tar 命令")
        // Fallback: try using tar command (available on Windows 10+)
        try {
          const tarCmd = `tar -xf "${tempZipPath}" -C "${directory}"`
          execSync(tarCmd, {
            cwd: directory,
          })
        } catch (tarError) {
          console.error("[slmap-spec] tar 解压也失败:", tarError)
          throw new Error("解压失败。请确保系统支持 PowerShell 或 tar 命令。")
        }
      }

      // Clean up temp file
      const fs = await import("fs")
      await fs.promises.unlink(tempZipPath).catch(() => {})

      toast.show({
        variant: "success",
        message: "规格说明书下载并解压成功！",
        duration: 3000,
      })

      console.log("[slmap-spec] 下载完成")
      dialog.clear()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error("[slmap-spec] 下载失败:", errorMessage, err)
      setError(errorMessage)
      toast.show({
        variant: "error",
        message: `下载失败: ${errorMessage}`,
        duration: 5000,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Show
      when={!error()}
      fallback={
        <DialogSelect
          title="下载规格说明书失败"
          options={[
            {
              value: null,
              title: error() || "未知错误",
              description: "按 Escape 键关闭",
              onSelect: () => dialog.clear(),
            },
          ]}
        />
      }
    >
      <Show
        when={projectInfo()}
        fallback={
          <DialogSelect
            title="加载项目信息中..."
            options={[]}
          />
        }
      >
        <DialogSelect
          title={`下载规格说明书: ${projectInfo()?.prjName || projectInfo()?.pkid}`}
          options={[
            {
              value: "download-0",
              title: loading() ? "下载中..." : "开始下载 Spec-0",
              description: loading() ? "请稍候..." : "下载并解压 Spec-0 规格说明书到当前目录",
              onSelect: loading() ? undefined : () => downloadSpec(0),
            },
            {
              value: "download-1",
              title: loading() ? "下载中..." : "开始下载 Spec-1",
              description: loading() ? "请稍候..." : "下载并解压 Spec-1 规格说明书到当前目录",
              onSelect: loading() ? undefined : () => downloadSpec(1),
            },
            {
              value: "download-2",
              title: loading() ? "下载中..." : "开始下载 Spec-2",
              description: loading() ? "请稍候..." : "下载并解压 Spec-2 规格说明书到当前目录",
              onSelect: loading() ? undefined : () => downloadSpec(2),
            },
            {
              value: "download-3",
              title: loading() ? "下载中..." : "开始下载 Spec-3",
              description: loading() ? "请稍候..." : "下载并解压 Spec-3 规格说明书到当前目录",
              onSelect: loading() ? undefined : () => downloadSpec(3),
            },
            {
              value: "cancel",
              title: "取消",
              description: "按 Escape 键关闭",
              onSelect: () => dialog.clear(),
            },
          ]}
        />
      </Show>
    </Show>
  )
}
