import React, { useState } from 'react'
import api from '../../services/api.js'

function ClickableText({ text, onWordClick, onSentenceClick }) {
  const koreanRegex = /[가-힣ᄀ-ᇿ㄰-㆏]+/g
  const parts = []
  let lastIndex = 0
  let match

  while ((match = koreanRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) })
    }
    parts.push({ type: 'korean', content: match[0] })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) })
  }

  return (
    <span>
      {parts.map((part, i) =>
        part.type === 'korean' ? (
          <span
            key={i}
            className="cursor-pointer hover:bg-yellow-100 hover:text-blue-700 rounded px-0.5 transition-colors"
            onClick={e => {
              e.stopPropagation()
              onWordClick(part.content, { x: e.clientX, y: e.clientY })
            }}
          >
            {part.content}
          </span>
        ) : (
          <span key={i}>{part.content}</span>
        )
      )}
    </span>
  )
}

export default function ChatMessage({ message, onWordClick, onSpeak, isSpeaking }) {
  const [showGrammar, setShowGrammar] = useState(false)
  const [grammar, setGrammar] = useState(null)
  const [grammarLoading, setGrammarLoading] = useState(false)

  const isUser = message.role === 'user'

  const mainContent = message.content
    .replace(/\[中文：[\s\S]*?\]/g, '')
    .replace(/\[纠错：[\s\S]*?\]/g, '')
    .trim()

  const errorMatch = message.content.match(/\[纠错：([\s\S]+?) → 正确：([\s\S]+?) \| 说明：([\s\S]+?)\]/)

  const handleGrammar = async () => {
    if (grammar) { setShowGrammar(!showGrammar); return }
    setGrammarLoading(true)
    setShowGrammar(true)
    try {
      const { data } = await api.post('/conversation/grammar', { sentence: mainContent })
      setGrammar(data.result)
    } catch {
      setGrammar('语法分析失败')
    } finally {
      setGrammarLoading(false)
    }
  }

  const koreanOnlyContent = mainContent.match(/[가-힣ᄀ-ᇿ㄰-㆏\s，。！？,.!?]+/g)?.join('') || mainContent

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm mr-2 flex-shrink-0 mt-1">
          AI
        </div>
      )}
      <div className={`max-w-lg ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? 'bg-blue-600 text-white rounded-br-sm'
              : 'bg-white border shadow-sm text-gray-800 rounded-bl-sm'
          }`}
        >
          {isUser ? (
            <span>{message.content}</span>
          ) : (
            <ClickableText
              text={mainContent}
              onWordClick={onWordClick}
              onSentenceClick={() => {}}
            />
          )}
        </div>

        {!isUser && message.translation && (
          <div className="text-xs text-gray-400 px-2">{message.translation}</div>
        )}

        {!isUser && errorMatch && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs">
            <span className="text-amber-700 font-medium">纠错：</span>
            <span className="line-through text-red-400">{errorMatch[1]}</span>
            <span className="text-gray-500"> → </span>
            <span className="text-green-600 font-medium">{errorMatch[2]}</span>
            <div className="text-gray-500 mt-1">{errorMatch[3]}</div>
          </div>
        )}

        {!isUser && (
          <div className="flex gap-2 px-1">
            <button
              onClick={() => onSpeak(koreanOnlyContent)}
              className={`text-xs px-2 py-1 rounded-lg transition-colors ${
                isSpeaking ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50'
              }`}
            >
              {isSpeaking ? '⏹ 停止' : '🔊 朗读'}
            </button>
            <button
              onClick={handleGrammar}
              className="text-xs px-2 py-1 rounded-lg text-gray-400 hover:text-purple-500 hover:bg-purple-50 transition-colors"
            >
              📖 语法
            </button>
          </div>
        )}

        {showGrammar && (
          <div className="bg-purple-50 border border-purple-100 rounded-xl px-3 py-2 text-xs text-gray-700 max-w-sm">
            {grammarLoading ? '分析中...' : <pre className="whitespace-pre-wrap font-sans">{grammar}</pre>}
          </div>
        )}
      </div>
    </div>
  )
}
