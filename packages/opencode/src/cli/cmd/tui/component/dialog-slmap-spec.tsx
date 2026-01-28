import { createSignal, onMount, Show } from "solid-js"
import { DialogSelect } from "../ui/dialog-select"
import { useDialog } from "@tui/ui/dialog"
import { useToast } from "@tui/ui/toast"
import { useSync } from "@tui/context/sync"
import { SlmapConfig } from "@/config/slmap"
import path from "path"

interface SlmapProject {
  pkid: string
  sVer: string
  prjName?: string
  prjNo?: string
}

// Module-level variables to prevent rapid repeated checks
let lastCheckTime = 0
let lastCredentialCheckTime = 0  // 凭证检查时间戳
let cachedProjectInfo: SlmapProject | null = null
let cachedError: string | null = null
let cachedCredentialStatus: { hasCredentials: boolean; timestamp: number } | null = null  // 缓存凭证状态

export function DialogSLMAPSpec() {
  const dialog = useDialog()
  const toast = useToast()
  const sync = useSync()
  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal<string | null>(cachedError)
  const [projectInfo, setProjectInfo] = createSignal<SlmapProject | null>(cachedProjectInfo)

  // 使用缓存的凭证状态初始化（如果有的话）
  const now = Date.now()
  const hasCachedCredentials = cachedCredentialStatus && now - cachedCredentialStatus.timestamp < 1000
  const initialHasCredentials = hasCachedCredentials ? cachedCredentialStatus!.hasCredentials : null
  const initialCheckingCredentials = hasCachedCredentials ? false : true

  const [hasCredentials, setHasCredentials] = createSignal<boolean | null>(initialHasCredentials)
  const [checkingCredentials, setCheckingCredentials] = createSignal(initialCheckingCredentials)

  onMount(async () => {
    const now = Date.now()
    let hasCredentials = false

    // 检查凭证（使用缓存或重新读取）
    if (cachedCredentialStatus && now - cachedCredentialStatus.timestamp < 1000) {
      hasCredentials = cachedCredentialStatus.hasCredentials
      setHasCredentials(hasCredentials)
      setCheckingCredentials(false)
    } else {
      // 首先检查凭证是否存在
      const credentials = await SlmapConfig.read()

      hasCredentials = !!(credentials?.slmap_url && credentials?.slmap_token)

      // 缓存凭证状态
      cachedCredentialStatus = {
        hasCredentials,
        timestamp: Date.now()
      }

      setHasCredentials(hasCredentials)
      setCheckingCredentials(false)
    }

    if (!hasCredentials) {
      return
    }

    // 凭证存在，继续检查项目信息

    // 先检查文件是否存在，以决定是否使用缓存
    const directory = sync.data.path.directory
    const filePath = path.join(directory, "slmap.json")
    const file = Bun.file(filePath)
    const fileExists = await file.exists()

    // 如果缓存的是错误，但文件现在存在了，清除错误缓存
    if (cachedError && fileExists) {
      cachedError = null
      lastCheckTime = 0
    }

    // 如果缓存的是项目信息，但文件现在不存在了，清除项目缓存
    if (cachedProjectInfo && !fileExists) {
      cachedProjectInfo = null
      lastCheckTime = 0
    }

    // Check if we recently read the file (within 500ms) to prevent rapid re-reads
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

    lastCheckTime = now

    try {
      if (!fileExists) {
        const errorMsg = "未找到 slmap.json 文件。请先运行 /slmap:project 命令选择项目。"
        cachedError = errorMsg
        setError(errorMsg)
        return
      }

      const projectData = (await file.json()) as SlmapProject

      // 成功读取项目信息，清除错误状态
      cachedError = null
      setError(null)

      cachedProjectInfo = projectData
      setProjectInfo(projectData)
    } catch (err) {
      console.error("[slmap-spec] 读取项目信息失败:", err)
      const errorMsg = `读取项目信息失败: ${err}`
      cachedError = errorMsg
      setError(errorMsg)
    }
  })

  const downloadSpec = async (specLevel: number) => {
    setLoading(true)
    setError(null)

    try {
      const credentials = await SlmapConfig.read()
      const slmapUrl = credentials?.slmap_url
      const slmapToken = credentials?.slmap_token

      // 凭证检查已在 onMount 中完成，这里再次检查以防万一
      if (!slmapUrl || !slmapToken) {
        const errorMsg = "SLMAP凭证未配置"
        setError(errorMsg)
        setLoading(false)
        return
      }

      const project = projectInfo()
      if (!project) {
        const errorMsg = "项目信息未加载"
        setError(errorMsg)
        setLoading(false)
        return
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

      dialog.clear()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error("[slmap-spec] 下载失败:", errorMessage)
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
          title={error() || "未知错误"}
          options={[
            {
              value: null,
              title: "关闭",
              description: "按 Escape 键关闭",
              onSelect: () => dialog.clear(),
            },
          ]}
        />
      }
    >
      <Show
        when={!checkingCredentials()}
        fallback={
          <DialogSelect
            title="检查凭证中..."
            options={[]}
          />
        }
      >
        <Show
          when={hasCredentials()}
          fallback={
            <DialogSelect
              title="下载规格说明书"
              options={[
                {
                  value: null,
                  title: "请先配置 SLMAP 凭证",
                  description: "运行 /slmap:login 命令进行登录配置",
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
      </Show>
    </Show>
  )
}
