import React, { useState, useEffect, useRef } from 'react';
import { Search, AlertTriangle, X } from 'lucide-react';
import type { SearchIndexItem } from '../lib/search-indexer';

interface CustomSearchProps {
  initialQuery?: string;
}

const CustomSearch: React.FC<CustomSearchProps> = ({ initialQuery = '' }) => {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchIndexItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchIndex, setSearchIndex] = useState<SearchIndexItem[] | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 加载搜索索引
  useEffect(() => {
    const loadSearchIndex = async () => {
      try {
        console.log('Starting to load search index...');
        const response = await fetch('/search/index.json');
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const text = await response.text();
        console.log('Raw response text:', text.substring(0, 100) + '...');

        const index = JSON.parse(text);
        console.log('Parsed index:', index);

        setSearchIndex(index);
      } catch (err) {
        console.error('Error loading search index:', err);
        console.error('Error details:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(`Failed to load search functionality: ${errorMessage}`);
      }
    };

    loadSearchIndex();
  }, []);

  // 处理搜索
  useEffect(() => {
    if (!searchIndex) return;

    // 清除之前的搜索超时
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // 如果查询为空，清空结果
    if (!query.trim()) {
      setResults([]);
      return;
    }

    // 设置搜索延迟，避免每次输入都搜索
    searchTimeoutRef.current = setTimeout(() => {
      setLoading(true);

      try {
        const lowercaseQuery = query.toLowerCase();

        // 简单的全文搜索算法
        const filteredResults = searchIndex
          .map(item => {
            let score = 0;

            // 标题匹配权重最高
            if (item.title.toLowerCase().includes(lowercaseQuery)) {
              score += 5;
              // 精确匹配标题权重更高
              if (item.title.toLowerCase() === lowercaseQuery) {
                score += 10;
              }
            }

            // 描述匹配权重次高
            if (item.description.toLowerCase().includes(lowercaseQuery)) {
              score += 3;
            }

            // 内容匹配权重
            if (item.content.toLowerCase().includes(lowercaseQuery)) {
              score += 1;
            }

            // 标签和分类匹配权重
            const tagsMatch = item.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery));
            const categoriesMatch = item.categories.some(category => category.toLowerCase().includes(lowercaseQuery));

            if (tagsMatch || categoriesMatch) {
              score += 4;
            }

            return { ...item, score };
          })
          .filter(item => item.score > 0) // 只保留有匹配的结果
          .sort((a, b) => b.score - a.score); // 按分数排序

        setResults(filteredResults);

        // 更新URL参数
        const params = new URLSearchParams(window.location.search);
        params.set('q', query);
        history.replaceState(history.state, '', '?' + params.toString());
      } catch (err) {
        console.error('Error searching:', err);
        setError('Search failed. Please try again.');
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, searchIndex]);

  // 处理输入变化
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    // 如果输入为空，清除URL参数
    if (!value) {
      history.replaceState(history.state, '', window.location.pathname);
    }
  };

  // 处理清除搜索
  const handleClearSearch = () => {
    setQuery('');
    setResults([]);
    history.replaceState(history.state, '', window.location.pathname);
  };

  // 格式化日期
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (error) {
    return (
      <div className="alert alert-error shadow-lg">
        <div>
          <AlertTriangle className="w-6 h-6" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="custom-search">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          placeholder="搜索文章..."
          className="input input-bordered w-full pr-12"
          aria-label="Search"
        />
        <button
          type="button"
          onClick={handleClearSearch}
          className={`absolute right-2 top-1/2 transform -translate-y-1/2 p-2 ${!query ? 'hidden' : ''}`}
          aria-label="Clear search"
        >
          <X className="w-4 h-4 text-base-content/50" />
        </button>
        <button
          type="button"
          className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2"
          aria-label="Search"
        >
          <Search className="w-4 h-4 text-base-content/50" />
        </button>
      </div>

      {loading && (
        <div className="mt-4 flex justify-center">
          <span className="loading loading-spinner loading-md text-primary"></span>
        </div>
      )}

      {!loading && searchIndex && (
        <div className="mt-4">
          {query && (
            <div className="text-sm text-base-content/70 mb-2">
              找到 {results.length} 个结果
            </div>
          )}

          {results.length > 0 ? (
            <div className="space-y-4">
              {results.map(result => (
                <div key={result.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                  <a href={result.url} className="block">
                    <h3 className="text-lg font-bold text-primary hover:underline">
                      {result.title}
                    </h3>
                  </a>

                  <div className="flex flex-wrap gap-2 mt-2">
                    {result.categories.map(category => (
                      <span
                        key={`category-${category}`}
                        className="inline-block px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs"
                      >
                        {category}
                      </span>
                    ))}
                    {result.tags.map(tag => (
                      <span
                        key={`tag-${tag}`}
                        className="inline-block px-2 py-0.5 rounded-full bg-secondary/10 text-secondary text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="mt-2 text-sm text-base-content/70">
                    {result.description}
                  </div>

                  <div className="mt-3 text-xs text-base-content/50">
                    {formatDate(result.pubDate)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            query && (
              <div className="text-center py-8 text-base-content/70">
                <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>没有找到匹配的结果</p>
                <p className="text-sm mt-2">请尝试其他关键词</p>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
};

export default CustomSearch;
