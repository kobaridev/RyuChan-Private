import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'
import type { NavCategory } from '@/data/navData'

const NAV_YAML_PATH = path.resolve(process.cwd(), 'src/data/navigation.yaml')

export function loadNavigation(): NavCategory[] {
  try {
    const raw = fs.readFileSync(NAV_YAML_PATH, 'utf-8')
    const data = yaml.load(raw)
    if (Array.isArray(data)) return data as NavCategory[]
    return []
  } catch {
    return []
  }
}
