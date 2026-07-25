'use client'

import { useState, useRef, useEffect } from 'react'
import { toast, Toaster } from 'sonner'
import { useAuthStore } from './hooks/use-auth'
import { readFileAsText } from '@/lib/file-utils'
import { saveProjectsToGitHub } from './services/projects-service'
import type { ProjectItem } from '@/interface/project'

type ProjectEditState = ProjectItem & { _draft?: boolean }

type Props = {
  initialProjects?: ProjectItem[]
}

export default function ProjectsEditPage({ initialProjects = [] }: Props) {
  const [projects, setProjects] = useState<ProjectEditState[]>(initialProjects)
  const [originalProjects, setOriginalProjects] = useState<ProjectItem[]>(
    JSON.parse(JSON.stringify(initialProjects))
  )
  const [globalEditMode, setGlobalEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingIndices, setEditingIndices] = useState<Set<number>>(new Set())
  const [pendingAvatars, setPendingAvatars] = useState<Record<number, { file: File; previewUrl: string }>>({})
  const [avatarTargetIndex, setAvatarTargetIndex] = useState<number | null>(null)
  const [scrollToIndex, setScrollToIndex] = useState<number | null>(null)
  const { isAuth, setPrivateKey } = useAuthStore()
  const keyInputRef = useRef<HTMLInputElement>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({})

  // Scroll a newly added card into view once it renders
  useEffect(() => {
    if (scrollToIndex === null) return
    const el = cardRefs.current[scrollToIndex]
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    setScrollToIndex(null)
  }, [scrollToIndex])

  const hasChanges = () => {
    return JSON.stringify(projects) !== JSON.stringify(originalProjects) || Object.keys(pendingAvatars).length > 0
  }

  const handleEnterEditMode = () => {
    setGlobalEditMode(true)
  }

  const handleCancelGlobal = () => {
    if (hasChanges()) {
      if (!window.confirm('你有未保存的更改，确定要取消吗？所有修改将丢失。')) return
    }
    setProjects(JSON.parse(JSON.stringify(originalProjects)))
    // Clean up pending avatar previews
    Object.values(pendingAvatars).forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl))
    setPendingAvatars({})
    setGlobalEditMode(false)
    setEditingIndices(new Set())
  }

  const handleSaveAll = async () => {
    if (!isAuth) {
      toast.error('请先导入密钥后再保存')
      handleImportKey()
      return
    }
    try {
      setSaving(true)
      const cleanProjects = projects.map(({ _draft, ...rest }) => rest as ProjectItem)
      await saveProjectsToGitHub(cleanProjects, pendingAvatars)
      // Clean up pending avatar previews
      Object.values(pendingAvatars).forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl))
      setPendingAvatars({})
      setOriginalProjects(JSON.parse(JSON.stringify(cleanProjects)))
      setProjects(cleanProjects)
      setGlobalEditMode(false)
      setEditingIndices(new Set())
    } catch {
      // error handled in service
    } finally {
      setSaving(false)
    }
  }

  const handleAdd = () => {
    const newProject: ProjectEditState = {
      name: '',
      avatar: '',
      description: '',
      url: '',
      badge: '',
      _draft: true
    }
    const newIndex = projects.length
    setProjects([...projects, newProject])
    setEditingIndices(prev => new Set(prev).add(newIndex))
    setScrollToIndex(newIndex)
  }

  const handleDelete = (index: number) => {
    if (!window.confirm(`确定要删除项目 "${projects[index].name || '(未命名)'}" 吗？`)) return
    const updated = [...projects]
    updated.splice(index, 1)
    setProjects(updated)
    // Re-index editing set (indices shift after splice)
    setEditingIndices(prev => {
      const next = new Set<number>()
      prev.forEach(i => {
        if (i === index) return
        next.add(i > index ? i - 1 : i)
      })
      return next
    })
    // Clean up and re-index pending avatars (indices shift after splice)
    setPendingAvatars(prev => {
      const next: Record<number, { file: File; previewUrl: string }> = {}
      for (const [keyStr, value] of Object.entries(prev)) {
        const key = parseInt(keyStr)
        if (key === index) {
          URL.revokeObjectURL(value.previewUrl)
        } else if (key > index) {
          next[key - 1] = value
        } else {
          next[key] = value
        }
      }
      return next
    })
  }

  // Swap membership of two indices in the editing set
  const swapEditing = (a: number, b: number) => {
    setEditingIndices(prev => {
      const next = new Set(prev)
      const hasA = prev.has(a)
      const hasB = prev.has(b)
      next.delete(a); next.delete(b)
      if (hasA) next.add(b)
      if (hasB) next.add(a)
      return next
    })
  }

  const handleMoveUp = (index: number) => {
    if (index <= 0) return
    const updated = [...projects]
    ;[updated[index - 1], updated[index]] = [updated[index], updated[index - 1]]
    setProjects(updated)
    swapEditing(index, index - 1)
    setPendingAvatars(prev => {
      const next: Record<number, { file: File; previewUrl: string }> = {}
      for (const [keyStr, value] of Object.entries(prev)) {
        const key = parseInt(keyStr)
        if (key === index) {
          next[index - 1] = value
        } else if (key === index - 1) {
          next[index] = value
        } else {
          next[key] = value
        }
      }
      return next
    })
  }

  const handleMoveDown = (index: number) => {
    if (index >= projects.length - 1) return
    const updated = [...projects]
    ;[updated[index], updated[index + 1]] = [updated[index + 1], updated[index]]
    setProjects(updated)
    swapEditing(index, index + 1)
    setPendingAvatars(prev => {
      const next: Record<number, { file: File; previewUrl: string }> = {}
      for (const [keyStr, value] of Object.entries(prev)) {
        const key = parseInt(keyStr)
        if (key === index) {
          next[index + 1] = value
        } else if (key === index + 1) {
          next[index] = value
        } else {
          next[key] = value
        }
      }
      return next
    })
  }

  const handleStartEdit = (index: number) => {
    setEditingIndices(prev => new Set(prev).add(index))
  }

  const handleCancelEdit = (index: number) => {
    // Clean up pending avatar if exists
    if (pendingAvatars[index]) {
      URL.revokeObjectURL(pendingAvatars[index].previewUrl)
      setPendingAvatars(prev => {
        const next = { ...prev }
        delete next[index]
        return next
      })
    }
    if (projects[index]._draft && !projects[index].name) {
      const updated = [...projects]
      updated.splice(index, 1)
      setProjects(updated)
      // Re-index editing set (indices shift after splice)
      setEditingIndices(prev => {
        const next = new Set<number>()
        prev.forEach(i => {
          if (i === index) return
          next.add(i > index ? i - 1 : i)
        })
        return next
      })
    } else {
      const updated = [...projects]
      const orig = originalProjects[index]
      if (orig) {
        updated[index] = { ...orig, _draft: false }
      } else {
        updated[index] = { ...projects[index], _draft: false }
      }
      setProjects(updated)
      setEditingIndices(prev => {
        const next = new Set(prev)
        next.delete(index)
        return next
      })
    }
  }

  const handleCompleteEdit = (index: number) => {
    const item = projects[index]
    if (!item.name.trim()) {
      toast.error('项目名称不能为空')
      return
    }
    if (!item.url.trim()) {
      toast.error('请填写项目链接')
      return
    }
    const updated = [...projects]
    updated[index] = { ...item, _draft: false }
    setProjects(updated)
    setEditingIndices(prev => {
      const next = new Set(prev)
      next.delete(index)
      return next
    })
  }

  const updateProject = (index: number, field: keyof ProjectEditState, value: any) => {
    const updated = [...projects]
    updated[index] = { ...updated[index], [field]: value }
    setProjects(updated)
  }

  const handleImportKey = () => {
    keyInputRef.current?.click()
  }

  const onChoosePrivateKey = async (file: File) => {
    const pem = await readFileAsText(file)
    setPrivateKey(pem)
    toast.success('密钥导入成功')
  }

  // Avatar upload handlers
  const handleAvatarClick = (index: number) => {
    setAvatarTargetIndex(index)
    avatarInputRef.current?.click()
  }

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const index = avatarTargetIndex
    if (!file || index === null) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件')
      setAvatarTargetIndex(null)
      if (e.currentTarget) e.currentTarget.value = ''
      return
    }

    // Clean up previous preview if exists
    if (pendingAvatars[index]) {
      URL.revokeObjectURL(pendingAvatars[index].previewUrl)
    }

    const previewUrl = URL.createObjectURL(file)
    setPendingAvatars(prev => ({ ...prev, [index]: { file, previewUrl } }))
    // Also update the avatar field visually so the preview shows
    updateProject(index, 'avatar', previewUrl)

    setAvatarTargetIndex(null)
    if (e.currentTarget) e.currentTarget.value = ''
  }

  // ====== Render badge ======
  const renderBadge = (badge?: string) => {
    if (!badge) return null
    return (
      <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded bg-primary/10 text-primary border border-primary/20">
        {badge}
      </span>
    )
  }

  // ====== Render avatar (view mode only) ======
  const renderAvatar = (project: ProjectEditState, index: number) => {
    const pendingAvatar = pendingAvatars[index]
    const displaySrc = pendingAvatar?.previewUrl || project.avatar

    return (
      <div className="shrink-0">
        <div className="group relative w-16 h-16 rounded-xl bg-base-200/50 p-1 transition-all duration-300">
          {displaySrc ? (
            <img
              alt={project.name}
              className="w-full h-full rounded-lg object-cover"
              src={displaySrc}
            />
          ) : (
            <div className="flex items-center justify-center w-full h-full rounded-lg bg-base-300 text-base-content/40">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ====== Render title (view mode only) ======
  const renderTitleRow = (project: ProjectEditState) => {
    return (
      <h3 className="font-bold text-lg text-base-content truncate">
        {project.name}
      </h3>
    )
  }

  // ====== Render description (view mode only) ======
  const renderDescription = (project: ProjectEditState) => {
    return (
      <p className="text-sm text-base-content/70 line-clamp-2 leading-relaxed">
        {project.description}
      </p>
    )
  }

  // ====== Render links (view mode only) ======
  const renderLinks = (project: ProjectEditState) => {
    if (!project.url) return null
    return (
      <div className="flex flex-wrap gap-1.5">
        <a
          href={project.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary bg-primary/5 hover:bg-primary/10 rounded-md px-2 py-1 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          Website
        </a>
      </div>
    )
  }

  return (
    <>
      <Toaster
        richColors
        position="top-center"
        toastOptions={{
          className: 'shadow-xl rounded-2xl border-2 border-primary/20 backdrop-blur-sm',
          style: { fontSize: '1rem', padding: '14px 20px', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)' },
          duration: 5000,
        }}
      />

      {/* PEM key file input */}
      <input
        ref={keyInputRef}
        type="file"
        accept=".pem"
        className="hidden"
        onChange={async e => {
          const f = e.target.files?.[0]
          if (f) await onChoosePrivateKey(f)
          if (e.currentTarget) e.currentTarget.value = ''
        }}
      />

      {/* Avatar file input */}
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarFileChange}
      />

      {/* Header: Title + Toolbar */}
      <div className="mb-8 animate-fade-in-up">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary shrink-0" style={{ fontSize: '2.5rem' }}>
              <path d="M9 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v5"/><circle cx="13" cy="12" r="2"/><path d="M18 19c-2.8 0-5-2.2-5-5v8"/><circle cx="20" cy="19" r="2"/>
            </svg>
            <span>My Projects</span>
          </h1>
          <div className="flex gap-3 shrink-0">
            {globalEditMode ? (
              <>
                <button onClick={handleCancelGlobal} className="btn btn-sm btn-ghost rounded-xl border bg-base-100/60 font-semibold">
                  取消
                </button>
                <button onClick={handleAdd} className="btn btn-sm btn-ghost rounded-xl border bg-base-100/60 font-semibold">
                  添加
                </button>
                <button
                  onClick={handleImportKey}
                  disabled={isAuth}
                  className={`btn btn-sm rounded-xl font-semibold ${
                    isAuth ? 'btn-ghost text-success' : 'btn-outline'
                  }`}
                >
                  {isAuth ? '已导入' : '导入密钥'}
                </button>
                <button onClick={handleSaveAll} disabled={saving} className="btn btn-sm btn-primary px-6 shadow-lg shadow-primary/20 font-semibold">
                  {saving ? '保存中...' : '保存'}
                </button>
              </>
            ) : (
              <button onClick={handleEnterEditMode} className="btn btn-sm btn-primary gap-2 rounded-xl font-semibold shadow-lg shadow-primary/20">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                编辑
              </button>
            )}
          </div>
        </div>
        <p className="text-base-content/70 text-lg">
          这里展示了我的一些个人项目、工具和实验性作品。
        </p>
      </div>

      {projects.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          {projects.map((project, index) => {
            const isEditing = editingIndices.has(index)

            return (
              <div
                key={index}
                ref={el => { cardRefs.current[index] = el }}
                className={`group block bg-base-100 rounded-2xl border border-base-200 hover:border-primary/40 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden ${
                  isEditing ? 'ring-2 ring-primary/30' : ''
                }`}
              >
                <div className={`flex flex-col h-full ${isEditing ? '' : 'p-4'}`}>
                  {/* Global edit mode toolbar for non-editing cards */}
                  {globalEditMode && !isEditing && (
                    <div className="px-4 pt-4 pb-2">
                      <div className="flex justify-end gap-2">
                        {index > 0 && (
                          <button
                            onClick={(e) => { e.preventDefault(); handleMoveUp(index) }}
                            className="btn btn-sm btn-ghost text-primary/50 hover:text-primary hover:bg-primary/10 rounded-lg px-2"
                            title="上移"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                          </button>
                        )}
                        {index < projects.length - 1 && (
                          <button
                            onClick={(e) => { e.preventDefault(); handleMoveDown(index) }}
                            className="btn btn-sm btn-ghost text-primary/50 hover:text-primary hover:bg-primary/10 rounded-lg px-2"
                            title="下移"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.preventDefault(); handleStartEdit(index) }}
                          className="btn btn-sm btn-ghost text-primary hover:bg-primary/10 rounded-lg px-2"
                          title="编辑"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                        </button>
                        <button
                          onClick={(e) => { e.preventDefault(); handleDelete(index) }}
                          className="btn btn-sm btn-ghost text-error hover:bg-error/10 rounded-lg px-2"
                          title="删除"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                      </div>
                    </div>
                  )}

                  {isEditing ? (
                    /* ====== Inline Edit Form — single card, vertical layout ====== */
                    <div className="p-4 space-y-3">
                      {/* Avatar row: 1/3 avatar + 2/3 name/badge */}
                      <div className="flex items-start gap-3">
                        <div className="w-1/3 shrink-0">
                          <div
                            className="group relative aspect-square w-full rounded-xl bg-base-200/50 p-1 cursor-pointer hover:bg-primary/10 hover:shadow-md transition-all duration-300"
                            onClick={() => handleAvatarClick(index)}
                            title="点击上传头像"
                          >
                            {(pendingAvatars[index]?.previewUrl || project.avatar) ? (
                              <img
                                alt={project.name}
                                className="w-full h-full rounded-lg object-cover"
                                src={pendingAvatars[index]?.previewUrl || project.avatar}
                              />
                            ) : (
                              <div className="flex items-center justify-center w-full h-full rounded-lg bg-base-300 text-base-content/40">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                              </div>
                            )}
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="text-xs text-white font-semibold">更换</span>
                            </div>
                          </div>
                          <input
                            className="input input-xs input-bordered w-full bg-base-100 focus:border-primary text-xs font-medium mt-1.5"
                            value={project.avatar || ''}
                            onChange={e => updateProject(index, 'avatar', e.target.value)}
                            placeholder="图片URL"
                          />
                        </div>
                        <div className="w-2/3 min-w-0 flex flex-col gap-2">
                          <input
                            className="input input-sm input-bordered w-full bg-base-100 focus:border-primary text-sm font-medium"
                            value={project.name}
                            onChange={e => updateProject(index, 'name', e.target.value)}
                            placeholder="项目名称"
                          />
                          <input
                            className="input input-sm input-bordered w-full bg-base-100 focus:border-primary text-sm"
                            value={project.badge || ''}
                            onChange={e => updateProject(index, 'badge', e.target.value)}
                            placeholder="徽章（如 Web、Tool）"
                          />
                          <textarea
                            className="textarea textarea-bordered w-full flex-1 min-h-0 bg-base-100 focus:border-primary text-sm leading-relaxed resize-none"
                            value={project.description}
                            onChange={e => updateProject(index, 'description', e.target.value)}
                            placeholder="项目描述"
                          />
                        </div>
                      </div>

                      {/* Links */}
                      <input
                        className="input input-sm input-bordered w-full bg-base-100 focus:border-primary text-sm"
                        value={project.url}
                        onChange={e => updateProject(index, 'url', e.target.value)}
                        placeholder="项目链接 URL"
                        type="url"
                      />

                      {/* Action buttons */}
                      <div className="flex gap-3 pt-2 border-t border-base-200/50">
                        <button onClick={() => handleCancelEdit(index)} className="btn btn-ghost btn-sm flex-1 rounded-xl text-base-content/60 font-semibold">
                          取消
                        </button>
                        <button onClick={() => handleCompleteEdit(index)} className="btn btn-primary btn-sm flex-1 rounded-xl font-semibold shadow-lg shadow-primary/20">
                          完成
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ====== View Mode — original compact card ====== */
                    <>
                      {/* Header: Avatar + Title + Badge */}
                      <div className="flex items-start gap-3 mb-2">
                        {renderAvatar(project, index)}
                        <div className="flex-1 min-w-0 pt-0.5">
                          {renderTitleRow(project)}
                        </div>
                        {/* Badge: right-aligned */}
                        <div className="shrink-0 pt-0.5">
                          {renderBadge(project.badge)}
                        </div>
                      </div>

                      {/* Description */}
                      <div className="mb-2">
                        {renderDescription(project)}
                      </div>

                      {/* Links */}
                      <div className="pt-2 border-t border-base-200/50 mt-auto">
                        {renderLinks(project)}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center space-y-4 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-base-content/20"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          <p className="text-base-content/50">还没有项目，点击"编辑"开始添加</p>
          <button onClick={handleEnterEditMode} className="btn btn-primary btn-sm gap-2 font-semibold">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
            编辑
          </button>
        </div>
      )}
    </>
  )
}
