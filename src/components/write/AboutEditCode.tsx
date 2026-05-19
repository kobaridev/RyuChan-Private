'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { Toaster, toast } from 'sonner'
import { useAuthStore } from './hooks/use-auth'
import { saveAboutCodeToGitHub } from './services/about-service'
import { readFileAsText } from '@/lib/file-utils'
import { Icon } from '@iconify/react'

type Props = {
  initialCode: string
}

export default function AboutEditCode({ initialCode }: Props) {
  const { isAuth, setPrivateKey } = useAuthStore()
  const keyInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { prefix, suffix, innerContent } = useMemo(() => {
    const match = initialCode.match(/([\s\S]*?<Card[^>]*>\s*)([\s\S]*?)(\s*<\/Card>[\s\S]*)/)
    if (match) {
      return {
        prefix: match[1],
        innerContent: match[2],
        suffix: match[3]
      }
    }
    return { prefix: '', innerContent: initialCode, suffix: '' }
  }, [initialCode])

  const [code, setCode] = useState(innerContent)
  const [saving, setSaving] = useState(false)

  const autoResize = useCallback(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = '999999px'
      el.style.height = Math.max(el.scrollHeight, 600) + 'px'
    }
  }, [])

  useEffect(() => {
    autoResize()
  }, [code, autoResize])

  const handleImportKey = () => {
    keyInputRef.current?.click()
  }

  const onChoosePrivateKey = async (file: File) => {
    try {
      const pem = await readFileAsText(file)
      await setPrivateKey(pem)
      toast.success('密钥导入成功')
    } catch (e) {
      toast.error('密钥导入失败')
    }
  }

  const handleSave = async () => {
    if (!isAuth) {
      toast.error('请先添加 GitHub App 私钥后再保存！')
      return
    }
    try {
      setSaving(true)
      const finalCode = prefix ? `${prefix}\n${code}\n${suffix}` : code
      await saveAboutCodeToGitHub(finalCode)
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (!isAuth) {
      toast.warning('您当前未配置权限，编辑后无法保存，请先添加密钥。')
    }
  }, [isAuth])

  return (
    <>
      <Toaster position="top-center" richColors />
      <input
        ref={keyInputRef}
        type="file"
        accept=".pem"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0]
          if (f) await onChoosePrivateKey(f)
          if (e.currentTarget) e.currentTarget.value = ''
        }}
      />
      <div className="flex flex-col md:flex-row h-full w-full justify-center px-4 md:px-6 pt-12 pb-32">
        <div className="flex-1 max-w-4xl w-full mx-auto relative group bg-base-100 rounded-2xl shadow-lg p-6 md:p-10 border border-base-200">
          <div className="flex items-center justify-between mb-6 pb-6 border-b border-base-200/50">
            <div className="flex items-center">
              <span className="w-3 h-3 rounded-full bg-error"></span>
              <span className="w-3 h-3 rounded-full bg-warning"></span>
              <span className="w-3 h-3 rounded-full bg-success"></span>
              <span className="ml-2 font-mono text-xs font-semibold tracking-wider text-base-content/40 uppercase">ABOUT.ASTRO</span>
            </div>
            <div className="flex gap-2">
              {isAuth ? (
                <span className="btn btn-outline border-success/50 btn-sm rounded-xl text-success cursor-default flex gap-1.5 items-center">
                  <Icon icon="lucide:circle-check" className="w-4 h-4" />密钥已导入
                </span>
              ) : (
                <button
                  onClick={handleImportKey}
                  className="btn btn-outline border-base-300 btn-sm rounded-xl hover:bg-base-200 hover:text-base-content"
                >
                  <Icon icon="lucide:key" className="w-4 h-4" />导入密钥
                </button>
              )}
              <a href="/about" className="btn btn-outline border-base-300 btn-sm rounded-xl hover:bg-base-200 hover:text-base-content">
                返回
              </a>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn btn-primary btn-sm rounded-xl font-medium px-6 shadow-lg shadow-primary/20"
              >
                {saving ? <span className="loading loading-spinner loading-xs" /> : '保存'}
              </button>
            </div>
          </div>
          <div className="mb-6 text-base-content/50 text-sm flex items-start gap-2 bg-base-200/50 p-4 rounded-xl">
            <Icon icon="lucide:info" className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">此输入框直接编辑 Astro 源文件。请注意：由于此环境非 Markdown 编译器，输入纯 Markdown 标签（如 <code># 标题</code>）不会自动被转为网页代码。建议直接使用 HTML 标签书写内容，并将普通文本包裹在 <code>&lt;div class="prose dark:prose-invert max-w-none"&gt;</code> 内，以获取优雅的原生排版。</p>
          </div>
          <div className="bg-base-200/40 border border-base-200 rounded-xl p-4 md:p-6 transition-colors focus-within:border-primary/30 focus-within:bg-base-200/60 shadow-inner">
            <textarea
              ref={textareaRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="在此编辑卡片内部内容..."
              className="w-full min-h-[600px] resize-none overflow-hidden leading-relaxed focus:outline-none focus:ring-0 bg-transparent py-2 text-base md:text-[1.05rem] font-semibold font-sans whitespace-pre-wrap break-words"
              spellCheck={false}
            />
          </div>
        </div>
      </div>
    </>
  )
}
