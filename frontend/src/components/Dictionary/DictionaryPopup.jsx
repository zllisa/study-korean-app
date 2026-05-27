import React, { useState } from 'react'
import api from '../../services/api.js'

export default function DictionaryPopup({ word, position, onClose, onSave }) {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  React.useEffect(() => {
    if (!word) return
    setLoading(true)
    api.post('/conversation/lookup', { word })
      .then(({ data }) => setResult(data.result))
      .catch(() => setResult('查询失败，请重试'))
      .finally(() => setLoading(false))
  }, [word])

  const handleSave = async () => {
    if (!result) return
    const lines = result.split('\n')
    const meaning = lines.find(l => l.startsWith('释义：'))?.replace('释义：', '') || result
    const pronunciation = lines.find(l => l.startsWith('发音：'))?.replace('发音：', '')
    await onSave({ word, meaning, pronunciation, examples: result })
    setSaved(true)
  }

  return (
    <div
      className="fixed z-50 bg-white rounded-xl shadow-2xl border p-4 w-72"
      style={{ top: position.y + 10, left: Math.min(position.x, window.innerWidth - 300) }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="font-bold text-blue-600 text-lg">{word}</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
      </div>
      {loading ? (
        <div className="text-sm text-gray-500 py-4 text-center">查询中...</div>
      ) : result ? (
        <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{result}</div>
      ) : null}
      {result && !loading && (
        <button
          onClick={handleSave}
          disabled={saved}
          className={`mt-3 w-full py-1.5 rounded-lg text-sm font-medium transition-colors ${
            saved ? 'bg-green-100 text-green-600' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
          }`}
        >
          {saved ? '✓ 已加入词汇本' : '+ 加入词汇本'}
        </button>
      )}
    </div>
  )
}
