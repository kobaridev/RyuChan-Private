import type { CollectionEntry } from 'astro:content';
import { getCollection } from 'astro:content';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// 搜索索引项类型定义
export interface SearchIndexItem {
  id: string;
  title: string;
  description: string;
  content: string;
  url: string;
  pubDate: string;
  categories: string[];
  tags: string[];
}

/**
 * 生成博客文章的搜索索引
 */
export async function generateSearchIndex() {
  // 获取所有博客文章
  const blogPosts = await getCollection('blog');

  // 创建搜索索引
  const searchIndex: SearchIndexItem[] = blogPosts
    .filter(post => !post.data.draft) // 排除草稿文章
    .map(post => ({
      id: post.slug,
      title: post.data.title,
      description: post.data.description,
      content: extractPlainText(post.body), // 提取纯文本内容
      url: `/blog/${post.slug}`,
      pubDate: post.data.pubDate.toISOString(),
      categories: post.data.categories || [],
      tags: post.data.tags || [],
    }));

  // 确保输出目录存在
  const outputDir = join(process.cwd(), 'public', 'search');
  mkdirSync(outputDir, { recursive: true });

  // 写入搜索索引文件
  writeFileSync(
    join(outputDir, 'index.json'),
    JSON.stringify(searchIndex, null, 2),
    'utf-8'
  );

  console.log(`Generated search index with ${searchIndex.length} entries`);
}

/**
 * 从Markdown内容中提取纯文本
 * @param markdown Markdown内容
 * @returns 纯文本内容
 */
function extractPlainText(markdown: string): string {
  // 移除代码块
  let text = markdown.replace(/```[\s\S]*?```/g, '');
  
  // 移除内联代码
  text = text.replace(/`[^`]+`/g, '');
  
  // 移除标题标记
  text = text.replace(/^#+.+$/gm, '');
  
  // 移除列表标记
  text = text.replace(/^[\s]*[-*+].+$/gm, '');
  
  // 移除数字列表标记
  text = text.replace(/^[\s]*\d+\..+$/gm, '');
  
  // 移除引用标记
  text = text.replace(/^>+.+$/gm, '');
  
  // 移除链接
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  
  // 移除图片
  text = text.replace(/!\[([^\]]+)\]\([^)]+\)/g, '');
  
  // 移除HTML标签
  text = text.replace(/<[^>]+>/g, '');
  
  // 移除特殊字符和多余空格
  text = text.replace(/[^\w\s\u4e00-\u9fa5]/g, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}
