import { createMemo, createSignal, onMount, Show } from "solid-js"
import { DialogSelect } from "../ui/dialog-select"
import { useDialog } from "@tui/ui/dialog"
import { useToast } from "@tui/ui/toast"
import { useSync } from "@tui/context/sync"
import { SlmapConfig } from "@/config/slmap"
import path from "path"

interface SlmapProject {
  prjName: string
  prjNo: string
  pkid: string
  sVer: string
  subTypeCode: string
}

interface SlmapResponse {
  responseBody: SlmapProject[]
}

// Module-level cache to prevent repeated fetches across component recreations
let cachedProjects: SlmapProject[] | null = null
let isFetching = false
let hasCheckedFile = false // Track if we've already checked for existing file
let cachedExistingProject: SlmapProject | null = null // Cache the existing project data
let needsConfirmationFlag = false // Track if confirmation is needed
let cachedCredentials: { url: string; token: string } | null = null // Track credentials used for caching
let cachedError: { error: string; credentials: { url: string | undefined; token: string | undefined } } | null = null // Cache error with credentials

export function DialogSLMAPProject() {
  const dialog = useDialog()
  const toast = useToast()
  const sync = useSync()
  const [projects, setProjects] = createSignal<SlmapProject[]>(cachedProjects || [])
  const initialLoading = !cachedProjects && !cachedError && !needsConfirmationFlag
  const [loading, setLoading] = createSignal(initialLoading)
  const [error, setError] = createSignal<string | null>(cachedError?.error || null)
  const [existingProject, setExistingProject] = createSignal<SlmapProject | null>(cachedExistingProject)
  const [needsConfirmation, setNeedsConfirmation] = createSignal(needsConfirmationFlag)

  const fetchProjects = async () => {
    // Get current credentials from global slmap.json
    const credentials = await SlmapConfig.read()
    const slmapUrl = credentials?.slmap_url
    const slmapToken = credentials?.slmap_token

    // Check if credentials have changed - if so, invalidate cache
    // This includes: null -> credentials, credentials -> null, or credentials changed
    const credentialsChanged =
      (cachedCredentials === null && (slmapUrl || slmapToken)) ||
      (cachedCredentials !== null && (!slmapUrl || !slmapToken)) ||
      (cachedCredentials !== null &&
        (cachedCredentials.url !== slmapUrl || cachedCredentials.token !== slmapToken))

    // Also check if cached error was for different credentials
    const errorCredentialsChanged =
      cachedError &&
      (cachedError.credentials.url !== slmapUrl || cachedError.credentials.token !== slmapToken)

    if (credentialsChanged || errorCredentialsChanged) {
      // Clear all caches when credentials change
      cachedProjects = null
      cachedError = null
      cachedCredentials = null
      // Also reset isFetching flag when credentials change
      isFetching = false
      // Clear the error state in the component
      setError(null)
    }

    // If we have cached data with same credentials, use it
    if (cachedProjects && !credentialsChanged) {
      setProjects(cachedProjects)
      setLoading(false)
      return
    }

    if (cachedError && !errorCredentialsChanged) {
      setError(cachedError.error)
      setLoading(false)
      return
    }

    // Prevent concurrent fetches
    if (isFetching) {
      setLoading(false)  // 确保设置 loading 状态
      return
    }

    isFetching = true
    setLoading(true)

    try {
      if (!slmapUrl || !slmapToken) {
        const errorMsg = "SLMAP凭证未配置。请先运行 /slmap:login 命令。"
        cachedError = { error: errorMsg, credentials: { url: slmapUrl, token: slmapToken } }
        setError(errorMsg)
        setLoading(false)
        isFetching = false
        return
      }

      // Store credentials used for this fetch
      cachedCredentials = { url: slmapUrl, token: slmapToken }

      // Construct the full API endpoint
      const apiUrl = `${slmapUrl}/sms-server/prjs`

      // Fetch projects from SLMAP API
      const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          "__ACCESS_TOKEN__": slmapToken,
        },
      })

      if (!response.ok) {
        throw new Error(`获取项目列表失败: ${response.statusText}`)
      }

      const data: SlmapResponse = await response.json()

      // Cache the results
      cachedProjects = data.responseBody || []
      setProjects(cachedProjects)
      setLoading(false)
      isFetching = false
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)

      // Cache the error with current credentials
      cachedError = { error: errorMessage, credentials: { url: slmapUrl, token: slmapToken } }
      setError(errorMessage)
      setLoading(false)
      isFetching = false

      toast.show({
        variant: "error",
        message: `获取项目列表失败: ${errorMessage}`,
        duration: 5000,
      })
    }
  }

  onMount(async () => {
    // Check if slmap.json already exists (only check once)
    if (!hasCheckedFile) {
      hasCheckedFile = true // Mark as checked immediately to prevent re-entry

      try {
        const directory = sync.data.path.directory
        const filePath = path.join(directory, "slmap.json")
        const file = Bun.file(filePath)
        const exists = await file.exists()

        if (exists) {
          // Read existing project data
          try {
            const currentProjectData = await file.json() as SlmapProject
            cachedExistingProject = currentProjectData
            setExistingProject(currentProjectData)
            needsConfirmationFlag = true
            setNeedsConfirmation(true)
            setLoading(false)
            return // Don't fetch projects yet
          } catch (error) {
            console.error("[slmap-project] Error parsing slmap.json:", error)
            // If file exists but can't be parsed, proceed with fetching
          }
        }
      } catch (error) {
        console.error("[slmap-project] Error checking slmap.json:", error)
        // If check fails, proceed with fetching
      }
    }

    // Fetch projects if no confirmation needed or already confirmed
    if (!needsConfirmationFlag) {
      await fetchProjects()
    }
  })

  // Helper function to save project data
  const saveProject = async (project: SlmapProject) => {
    try {
      const directory = sync.data.path.directory
      const filePath = path.join(directory, "slmap.json")

      const projectData = {
        prjName: project.prjName,
        prjNo: project.prjNo,
        pkid: project.pkid,
        sVer: project.sVer,
        subTypeCode: project.subTypeCode,
      }

      await Bun.write(filePath, JSON.stringify(projectData, null, 2))

      toast.show({
        variant: "info",
        message: `项目 "${project.prjName}" 已保存到 slmap.json`,
        duration: 3000,
      })

      dialog.clear()
    } catch (error) {
      toast.show({
        variant: "error",
        message: `保存项目失败: ${error}`,
        duration: 5000,
      })
    }
  }

  const options = createMemo(() => {
    const projectList = projects()

    return projectList.map((project) => ({
      value: project,
      title: `【${project.prjName}】`,
      description: `${project.prjNo}`,
      onSelect: async () => {
        await saveProject(project)
      },
    }))
  })

  return (
    <Show
      when={!needsConfirmation()}
      fallback={
        <DialogSelect
          title={`当前项目: ${existingProject()?.prjName} (${existingProject()?.prjNo})`}
          options={[
            {
              value: "continue",
              title: "重新选择项目",
              description: "将覆盖当前项目配置",
              onSelect: async () => {
                needsConfirmationFlag = false // Clear confirmation flag
                setNeedsConfirmation(false)
                setLoading(true)
                await fetchProjects()
              },
            },
            {
              value: "cancel",
              title: "取消",
              description: "按 Escape 键关闭",
              onSelect: () => {
                dialog.clear()
              },
            },
          ]}
        />
      }
    >
      <Show
        when={!loading()}
        fallback={
          <DialogSelect
            title="加载项目中..."
            options={[]}
          />
        }
      >
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
          <DialogSelect
            title="选择 SLMAP 项目"
            placeholder="搜索"
            options={options()}
          />
        </Show>
      </Show>
    </Show>
  )
}
