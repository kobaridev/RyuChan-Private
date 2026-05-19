import { putFile } from '@/lib/github-client'
import { getAuthToken } from '@/lib/auth'
import { GITHUB_CONFIG } from '@/consts'
import { toBase64Utf8 } from '@/lib/github-client'
import { toast } from 'sonner'

const ABOUT_FILE_PATH = 'src/pages/about.astro'

export async function saveAboutCodeToGitHub(code: string): Promise<void> {
  const token = await getAuthToken()
  const toastId = toast.loading('🚀 正在保存关于页代码...')

  try {
    const base64Content = toBase64Utf8(code)

    await putFile(
      token,
      GITHUB_CONFIG.OWNER,
      GITHUB_CONFIG.REPO,
      ABOUT_FILE_PATH,
      base64Content,
      'chore(about): update about page code',
      GITHUB_CONFIG.BRANCH
    )

    toast.success('🎉 保存成功！', {
      id: toastId,
      description: '更改已推送到代码库，GitHub Actions 将更新页面。'
    })
  } catch (error: any) {
    console.error(error)
    toast.error('❌ 保存失败', {
      id: toastId,
      description: error.message || '发生未知错误'
    })
    throw error
  }
}
