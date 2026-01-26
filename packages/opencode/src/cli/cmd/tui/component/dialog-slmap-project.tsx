import { createMemo, createSignal, onMount, Show } from "solid-js"
import { DialogSelect } from "../ui/dialog-select"
import { useDialog } from "@tui/ui/dialog"
import { useToast } from "@tui/ui/toast"
import { useSync } from "@tui/context/sync"
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
let fetchError: string | null = null
let hasCheckedFile = false // Track if we've already checked for existing file
let cachedExistingProject: SlmapProject | null = null // Cache the existing project data
let needsConfirmationFlag = false // Track if confirmation is needed

export function DialogSLMAPProject() {
  const dialog = useDialog()
  const toast = useToast()
  const sync = useSync()
  const [projects, setProjects] = createSignal<SlmapProject[]>(cachedProjects || [])
  const [loading, setLoading] = createSignal(!cachedProjects && !fetchError && !needsConfirmationFlag)
  const [error, setError] = createSignal<string | null>(fetchError)
  const [existingProject, setExistingProject] = createSignal<SlmapProject | null>(cachedExistingProject)
  const [needsConfirmation, setNeedsConfirmation] = createSignal(needsConfirmationFlag)

  const fetchProjects = async () => {
    // If we have cached data or an error, don't fetch again
    if (cachedProjects) {
      setProjects(cachedProjects)
      setLoading(false)
      return
    }

    if (fetchError) {
      setError(fetchError)
      setLoading(false)
      return
    }

    // Prevent concurrent fetches
    if (isFetching) {
      return
    }

    isFetching = true
    setLoading(true)

    try {
      const config = sync.data.config
      const slmapUrl = (config as any).slmap_url
      const slmapToken = (config as any).slmap_token

      if (!slmapUrl || !slmapToken) {
        const errorMsg = "SLMAP凭证未配置。请先运行/login命令。"
        fetchError = errorMsg
        setError(errorMsg)
        setLoading(false)
        isFetching = false
        return
      }

      // Construct the full API endpoint
      const apiUrl = `${slmapUrl}/prjs`

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

      // Cache the error
      fetchError = errorMessage
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
            console.log('currentProjectData', currentProjectData)
            cachedExistingProject = currentProjectData
            setExistingProject(currentProjectData)
            needsConfirmationFlag = true
            setNeedsConfirmation(true)
            setLoading(false)
            return // Don't fetch projects yet
          } catch (error) {
            console.error("Error parsing slmap.json:", error)
            // If file exists but can't be parsed, proceed with fetching
          }
        }
      } catch (error) {
        console.error("Error checking slmap.json:", error)
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
              title="加载项目出错"
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
