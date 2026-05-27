import React, { useState, useEffect } from 'react'
import api from '../services/api.js'

export default function Errors() {
  const [errors, setErrors] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/errors').then(({ data }) => setErrors(data)).finally(() => setLoading(false))
  }, [])

  const handleDelete = async (id) => {
    await api.delete(`/errors/${id}`)
    setErrors(prev => prev.filter(e => e.id !== id))
  }

  if (loading) return <div className="flex items-center justify-center h-full text-gray-400">加载中...</div>

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800">我的错误记录</h2>
          <span className="text-sm text-gray-500">{errors.length} 条记录</span>
        </div>

        {errors.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <div className="text-5xl mb-3">🎉</div>
            <p>暂无错误记录，继续保持！</p>
          </div>
        ) : (
          <div className="space-y-3">
            {errors.map(err => (
              <div key={err.id} className="bg-white rounded-xl border p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full">错误</span>
                      <span className="text-sm font-medium text-red-500 line-through">{err.errorText}</span>
                      <span className="text-gray-400">→</span>
                      <span className="text-sm font-medium text-green-600">{err.correction}</span>
                    </div>
                    <p className="text-sm text-gray-600">{err.explanation}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-gray-400">出现 {err.count} 次</span>
                      <span className="text-xs text-gray-400">
                        最近：{new Date(err.lastSeen).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(err.id)}
                    className="text-gray-300 hover:text-red-400 text-lg ml-3 transition-colors"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
