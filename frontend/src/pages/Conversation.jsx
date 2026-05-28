import React, { useState, useRef, useEffect, useCallback } from 'react'
import api from '../services/api.js'
import { useVoice } from '../hooks/useVoice.js'
import ChatMessage from '../components/Chat/ChatMessage.jsx'
import DictionaryPopup from '../components/Dictionary/DictionaryPopup.jsx'

const TOPICS = [
  { id: 'free', label: '自由对话', emoji: '💬' },
  { id: '식당', label: '餐厅点餐', emoji: '🍽️' },
  { id: '쇼핑', label: '购物', emoji: '🛍️' },
  { id: '길 안내', label: '问路', emoji: '🗺️' },
  { id: '자기소개', label: '自我介绍', emoji: '👋' },
  { id: '날씨', label: '天气', emoji: '🌤️' },
  { id: '여행', label: '旅行', emoji: '✈️' },
]

function extractKorean(text) {
  return text.match(/[가-힣ᄀ-ᇿ㄰-㆏\s，。！？,.!?]+/g)?.join('') || text
}

function formatDate(dateStr) {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function Conversation() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sessionId, setSessionId] = useState(null)
  const [topic, setTopic] = useState('free')
  const [loading, setLoading] = useState(false)
  const [dictPopup, setDictPopup] = useState(null)
  const [currentSpeakingId, setCurrentSpeakingId] = useState(null)
  const [sessions, setSessions] = useState([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [autoVoiceLoop, setAutoVoiceLoop] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const bottomRef = useRef(null)
  const autoVoiceLoopRef = useRef(false)
  const { isListening, isSpeaking, startListening, stopListening, speak, stopSpeaking } = useVoice()

  useEffect(() => { autoVoiceLoopRef.current = autoVoiceLoop }, [autoVoiceLoop])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => {
    return () => { stopSpeaking(); stopListening() }
  }, [])
  useEffect(() => {
    loadHistory()
    try {
      const saved = sessionStorage.getItem('korean_session')
      if (saved) {
        const { sessionId: sid, messages: msgs, topic: t } = JSON.parse(saved)
        setSessionId(sid)
        setMessages(msgs)
        setTopic(t)
        return
      }
    } catch {
      sessionStorage.removeItem('korean_session')
    }
    startSession()
  }, [])
  useEffect(() => {
    if (sessionId && messages.length > 0) {
      sessionStorage.setItem('korean_session', JSON.stringify({ sessionId, messages, topic }))
    }
  }, [sessionId, messages, topic])

  const loadHistory = async () => {
    try {
      const { data } = await api.get('/conversation/history')
      setSessions(data)
    } catch (e) {
      console.error(e)
    }
  }

  const loadSession = async (sid) => {
    if (selectMode) return
    try {
      const { data } = await api.get(`/conversation/session/${sid}`)
      setSessionId(data.id)
      setMessages(data.messages.map(m => ({ role: m.role, content: m.content, translation: m.translation })))
      setHistoryOpen(false)
    } catch (e) {
      console.error(e)
    }
  }

  const deleteSession = async (e, sid) => {
    e.stopPropagation()
    try {
      await api.delete(`/conversation/session/${sid}`)
      setSessions(prev => prev.filter(s => s.id !== sid))
      setSelected(prev => { const n = new Set(prev); n.delete(sid); return n })
    } catch (e) {
      console.error(e)
    }
  }

  const deleteSelected = async () => {
    const ids = [...selected]
    if (ids.length === 0) return
    try {
      await api.delete('/conversation/sessions', { data: { ids } })
      setSessions(prev => prev.filter(s => !selected.has(s.id)))
      setSelected(new Set())
      setSelectMode(false)
    } catch (e) {
      console.error(e)
    }
  }

  const toggleSelect = (e, sid) => {
    e.stopPropagation()
    setSelected(prev => {
      const n = new Set(prev)
      n.has(sid) ? n.delete(sid) : n.add(sid)
      return n
    })
  }

  const toggleSelectAll = () => {
    if (selected.size === sessions.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(sessions.map(s => s.id)))
    }
  }

  const startSession = async (newTopic) => {
    const activeTopic = newTopic ?? topic
    sessionStorage.removeItem('korean_session')
    setMessages([])
    setSessionId(null)
    try {
      const { data } = await api.post('/conversation/start', {
        topic: activeTopic === 'free' ? null : activeTopic,
        mode: activeTopic === 'free' ? 'free' : 'topic',
      })
      setSessionId(data.sessionId)
      const topicLabel = TOPICS.find(t => t.id === activeTopic)?.label
      const greeting = activeTopic === 'free'
        ? { role: 'assistant', content: '안녕하세요! 오늘은 무슨 이야기를 해볼까요? 😊\n[中文：你好！今天想聊什么话题呢？]', translation: '你好！今天想聊什么话题呢？' }
        : { role: 'assistant', content: `${activeTopic} 주제로 대화해 봅시다! 준비됐나요? 😊\n[中文：让我们来聊"${topicLabel}"的话题吧！准备好了吗？]`, translation: `让我们来聊"${topicLabel}"的话题吧！` }
      const korean = extractKorean(greeting.content.replace(/\[中文：.*?\]/g, '').trim())
      setMessages([greeting])
      setCurrentSpeakingId(0)
      speak(korean, () => {
        setCurrentSpeakingId(null)
        if (autoVoiceLoopRef.current) startVoiceListening()
      })
    } catch (e) {
      console.error(e)
    }
  }

  const startVoiceListening = useCallback(() => {
    startListening(
      text => sendMessage(text),
      err => console.warn(err || '语音识别失败')
    )
  }, [])

  const sendMessage = async (text) => {
    if (!text.trim() || !sessionId || loading) return
    const aiMsgIndex = messages.length + 1
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setInput('')
    setLoading(true)
    try {
      const { data } = await api.post('/conversation/message', { sessionId, message: text })
      const aiMsg = { role: 'assistant', content: data.message, translation: data.translation }
      const mainContent = data.message.replace(/\[中文：[\s\S]*?\]/g, '').replace(/\[纠错：[\s\S]*?\]/g, '').trim()
      const korean = extractKorean(mainContent)
      setMessages(prev => [...prev, aiMsg])
      setCurrentSpeakingId(aiMsgIndex)
      speak(korean, () => {
        setCurrentSpeakingId(null)
        if (autoVoiceLoopRef.current) startVoiceListening()
      })
      loadHistory()
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '抱歉，出现了错误，请重试。' }])
    } finally {
      setLoading(false)
    }
  }

  const handleVoice = () => {
    if (isListening) { stopListening(); return }
    startListening(
      text => { setInput(text); sendMessage(text) },
      err => alert(err || '语音识别失败')
    )
  }

  const handleSpeak = (text, msgIndex) => {
    if (isSpeaking) { stopSpeaking(); setCurrentSpeakingId(null); return }
    setCurrentSpeakingId(msgIndex)
    speak(text, () => setCurrentSpeakingId(null))
  }

  return (
    <div className="flex h-full">
      {/* 历史侧边栏 */}
      {historyOpen && (
        <div className="w-64 border-r bg-gray-50 flex flex-col flex-shrink-0">
          {/* 头部 */}
          <div className="px-3 py-2.5 border-b bg-white flex items-center gap-2">
            <span className="font-medium text-sm text-gray-700 flex-1">历史对话</span>
            {sessions.length > 0 && (
              <button
                onClick={() => { setSelectMode(v => !v); setSelected(new Set()) }}
                className={`text-xs px-2 py-1 rounded transition-colors ${selectMode ? 'bg-blue-100 text-blue-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
              >
                {selectMode ? '取消' : '多选'}
              </button>
            )}
            <button onClick={() => { setHistoryOpen(false); setSelectMode(false); setSelected(new Set()) }} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
          </div>

          {/* 多选操作栏 */}
          {selectMode && sessions.length > 0 && (
            <div className="px-3 py-2 bg-blue-50 border-b flex items-center gap-2">
              <button onClick={toggleSelectAll} className="text-xs text-blue-600 hover:underline">
                {selected.size === sessions.length ? '取消全选' : '全选'}
              </button>
              <span className="text-xs text-gray-400 flex-1">已选 {selected.size} 条</span>
              {selected.size > 0 && (
                <button
                  onClick={deleteSelected}
                  className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                >
                  删除
                </button>
              )}
            </div>
          )}

          {/* 列表 */}
          <div className="flex-1 overflow-y-auto py-1">
            {sessions.length === 0 && (
              <p className="text-xs text-gray-400 px-4 py-4 text-center">暂无历史记录</p>
            )}
            {sessions.map(s => {
              const topicInfo = TOPICS.find(t => t.id === s.topic)
              const preview = s.messages?.[0]?.content
                ?.replace(/\[中文：.*?\]/g, '').replace(/\[纠错：.*?\]/g, '').trim().slice(0, 36)
              return (
                <div
                  key={s.id}
                  onClick={() => loadSession(s.id)}
                  className={`group relative flex items-start gap-2 px-3 py-2.5 border-b border-gray-100 cursor-pointer transition-colors ${
                    selectMode ? 'hover:bg-blue-50' : 'hover:bg-white'
                  } ${selected.has(s.id) ? 'bg-blue-50' : ''}`}
                >
                  {/* 多选勾选框 */}
                  {selectMode && (
                    <div
                      onClick={e => toggleSelect(e, s.id)}
                      className={`flex-shrink-0 w-4 h-4 mt-0.5 rounded border-2 flex items-center justify-center transition-colors ${
                        selected.has(s.id) ? 'bg-blue-500 border-blue-500' : 'border-gray-300 bg-white'
                      }`}
                    >
                      {selected.has(s.id) && <span className="text-white text-xs leading-none">✓</span>}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 mb-0.5">
                      <span className="text-xs font-medium text-blue-600 truncate">
                        {topicInfo?.emoji || '💬'} {topicInfo?.label || '自由对话'}
                      </span>
                      <span className="text-xs text-gray-400 ml-auto flex-shrink-0">{formatDate(s.createdAt)}</span>
                    </div>
                    {preview && (
                      <p className="text-xs text-gray-500 truncate">{preview}</p>
                    )}
                  </div>

                  {/* 单条删除按钮（非多选模式 hover 显示） */}
                  {!selectMode && (
                    <button
                      onClick={e => deleteSession(e, s.id)}
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-500 p-0.5 -mr-0.5"
                      title="删除"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          <div className="p-3 border-t">
            <button
              onClick={() => { startSession(); setHistoryOpen(false); setSelectMode(false); setSelected(new Set()) }}
              className="w-full py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              + 新建对话
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col flex-1 min-w-0">
        <div className="bg-white border-b px-4 py-2.5 flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setHistoryOpen(o => !o)}
            className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${historyOpen ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            title="历史记录"
          >
            📋
          </button>
          <button
            onClick={() => { stopSpeaking(); stopListening(); setTopic('free'); startSession('free') }}
            className="flex-shrink-0 px-2.5 py-1.5 rounded-lg text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            title="新建对话"
          >
            ✏️
          </button>
          <div className="w-px h-5 bg-gray-200 flex-shrink-0" />
          {TOPICS.map(t => (
            <button
              key={t.id}
              onClick={() => { if (t.id !== topic) { stopSpeaking(); stopListening(); setTopic(t.id); startSession(t.id) } }}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                topic === t.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t.emoji} {t.label}
            </button>
          ))}
          <div className="ml-auto flex-shrink-0">
            <button
              onClick={() => setAutoVoiceLoop(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                autoVoiceLoop
                  ? 'bg-green-100 text-green-700 border border-green-300'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
              title="开启后：AI说完自动开始监听你的回复"
            >
              🔄 语音循环 {autoVoiceLoop ? '开' : '关'}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {messages.map((msg, i) => (
            <ChatMessage
              key={i}
              message={msg}
              onWordClick={(word, pos) => setDictPopup({ word, position: pos })}
              onSpeak={(text) => handleSpeak(text, i)}
              isSpeaking={isSpeaking && currentSpeakingId === i}
            />
          ))}
          {loading && (
            <div className="flex justify-start mb-4">
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm mr-2">AI</div>
              <div className="bg-white border shadow-sm rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="bg-white border-t px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleVoice}
              className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                isListening
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-600'
              }`}
            >
              {isListening ? '⏹' : '🎤'}
            </button>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
              placeholder={isListening ? '正在聆听...' : '输入韩语或点击麦克风说话...'}
              className="flex-1 border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              disabled={isListening}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              ↑
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1 px-1">
            点击韩语单词查词典 · AI回复自动朗读{autoVoiceLoop ? ' · 语音循环已开启' : ''}
          </p>
        </div>
      </div>

      {dictPopup && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setDictPopup(null)} />
          <DictionaryPopup
            word={dictPopup.word}
            position={dictPopup.position}
            onClose={() => setDictPopup(null)}
            onSave={async (vocabData) => { await api.post('/vocabulary', vocabData) }}
          />
        </>
      )}
    </div>
  )
}
