import React, { useState, useEffect, useRef } from 'react'
import api from '../services/api.js'
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk'

const QUALITY_BUTTONS = [
  { q: 0, label: '又忘了', sub: '重置', color: 'bg-red-100 text-red-700 hover:bg-red-200 border-red-200' },
  { q: 1, label: '模糊',   sub: '间隔×1.2', color: 'bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-200' },
  { q: 2, label: '记得',   sub: '间隔×EF',  color: 'bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200' },
  { q: 3, label: '很熟',   sub: '间隔×EF×1.3', color: 'bg-green-100 text-green-700 hover:bg-green-200 border-green-200' },
]

function masteryLabel(interval) {
  if (interval >= 21) return { text: '精通', color: 'text-green-600 bg-green-50' }
  if (interval >= 7)  return { text: '掌握', color: 'text-blue-600 bg-blue-50' }
  if (interval >= 3)  return { text: '熟悉', color: 'text-yellow-600 bg-yellow-50' }
  return { text: '初识', color: 'text-gray-500 bg-gray-100' }
}

function formatNextReview(dateStr) {
  const now = new Date()
  const d = new Date(dateStr)
  const diff = Math.round((d - now) / 86400000)
  if (diff <= 0) return '今天'
  if (diff === 1) return '明天'
  return `${diff} 天后`
}

async function speakKorean(text) {
  try {
    const { data } = await api.get('/speech/token')
    const config = SpeechSDK.SpeechConfig.fromAuthorizationToken(data.token, data.region)
    config.speechSynthesisVoiceName = 'ko-KR-SunHiNeural'
    const synth = new SpeechSDK.SpeechSynthesizer(config)
    synth.speakTextAsync(text, () => synth.close(), () => synth.close())
  } catch (e) {
    console.error(e)
  }
}

// ── FlashCard Session ────────────────────────────────────────────────────────
function FlashCardSession({ cards, onFinish }) {
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [results, setResults] = useState([])   // { word, quality }
  const [done, setDone] = useState(false)

  const card = cards[index]

  const handleQuality = async (q) => {
    try {
      await api.post(`/vocabulary/review/${card.id}`, { quality: q })
    } catch (e) {
      console.error(e)
    }
    const next = [...results, { word: card.word, quality: q }]
    setResults(next)
    if (index + 1 >= cards.length) {
      setDone(true)
    } else {
      setIndex(i => i + 1)
      setFlipped(false)
    }
  }

  if (done) {
    const counts = [0, 1, 2, 3].map(q => results.filter(r => r.quality === q).length)
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 px-6">
        <div className="text-5xl">🎉</div>
        <h2 className="text-2xl font-bold text-gray-800">复习完成！</h2>
        <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
          {QUALITY_BUTTONS.map((b, i) => (
            <div key={b.q} className={`rounded-xl p-3 text-center border ${b.color}`}>
              <div className="text-2xl font-bold">{counts[i]}</div>
              <div className="text-sm">{b.label}</div>
            </div>
          ))}
        </div>
        <p className="text-sm text-gray-500">共复习 {results.length} 个单词</p>
        <button
          onClick={onFinish}
          className="px-8 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
        >
          返回词汇本
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* 进度条 */}
      <div className="px-6 pt-5 pb-3">
        <div className="flex items-center justify-between mb-2">
          <button onClick={onFinish} className="text-sm text-gray-400 hover:text-gray-600">← 退出</button>
          <span className="text-sm font-medium text-gray-600">{index + 1} / {cards.length}</span>
        </div>
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${((index) / cards.length) * 100}%` }}
          />
        </div>
      </div>

      {/* 卡片区域 */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
        <div
          className="w-full max-w-md cursor-pointer select-none"
          style={{ perspective: '1000px' }}
          onClick={() => !flipped && setFlipped(true)}
        >
          <div
            style={{
              transformStyle: 'preserve-3d',
              transition: 'transform 0.45s ease',
              transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              position: 'relative',
              height: '260px',
            }}
          >
            {/* 正面 */}
            <div
              className="absolute inset-0 bg-white rounded-2xl border shadow-md flex flex-col items-center justify-center gap-3 p-6"
              style={{ backfaceVisibility: 'hidden' }}
            >
              <div className="text-4xl font-bold text-blue-600">{card.word}</div>
              {card.pronunciation && (
                <div className="text-base text-gray-400">[{card.pronunciation}]</div>
              )}
              <button
                onClick={e => { e.stopPropagation(); speakKorean(card.word) }}
                className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-50 text-blue-600 text-sm hover:bg-blue-100 transition-colors"
              >
                🔊 朗读
              </button>
              <p className="text-xs text-gray-300 mt-2">点击翻面查看释义</p>
            </div>

            {/* 背面 */}
            <div
              className="absolute inset-0 bg-white rounded-2xl border shadow-md flex flex-col items-center justify-center gap-3 p-6"
              style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            >
              <div className="text-2xl font-bold text-gray-800 text-center">{card.meaning}</div>
              {card.examples && (
                <div className="text-sm text-gray-500 text-center whitespace-pre-line border-t pt-3 mt-1 w-full">
                  {card.examples}
                </div>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${masteryLabel(card.interval).color}`}>
                  {masteryLabel(card.interval).text}
                </span>
                <span className="text-xs text-gray-400">已复习 {card.reviewCount} 次</span>
              </div>
            </div>
          </div>
        </div>

        {/* 评分按钮 */}
        {flipped ? (
          <div className="w-full max-w-md grid grid-cols-4 gap-2">
            {QUALITY_BUTTONS.map(b => (
              <button
                key={b.q}
                onClick={() => handleQuality(b.q)}
                className={`flex flex-col items-center py-3 px-2 rounded-xl border text-sm font-medium transition-all active:scale-95 ${b.color}`}
              >
                <span>{b.label}</span>
                <span className="text-xs opacity-60 mt-0.5">{b.sub}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">想好了再翻面</p>
        )}
      </div>
    </div>
  )
}

// ── Vocabulary Card ──────────────────────────────────────────────────────────
function VocabCard({ v, onDelete, onQuickReview }) {
  const [expanded, setExpanded] = useState(false)
  const label = masteryLabel(v.interval)
  const isDue = new Date(v.nextReview) <= new Date()

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${isDue ? 'border-blue-200' : ''}`}>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        {isDue && <span className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500" title="今日待复习" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-base font-bold text-blue-600">{v.word}</span>
            {v.pronunciation && <span className="text-xs text-gray-400">[{v.pronunciation}]</span>}
          </div>
          <p className="text-sm text-gray-600 truncate">{v.meaning}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${label.color}`}>{label.text}</span>
          <span className="text-gray-300 text-sm">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div className="border-t px-4 py-3 bg-gray-50">
          {v.examples && (
            <p className="text-sm text-gray-600 whitespace-pre-line mb-3">{v.examples}</p>
          )}
          <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
            <span>下次复习：{formatNextReview(v.nextReview)}</span>
            <span>·</span>
            <span>已复习 {v.reviewCount} 次</span>
            <span>·</span>
            <span>间隔 {v.interval} 天</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => speakKorean(v.word)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs hover:bg-blue-100 transition-colors"
            >
              🔊 朗读
            </button>
            <button
              onClick={() => onDelete(v.id)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 text-red-500 text-xs hover:bg-red-100 transition-colors ml-auto"
            >
              🗑 删除
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Stats Bar ────────────────────────────────────────────────────────────────
function StatsBar({ stats }) {
  return (
    <div className="grid grid-cols-4 gap-3 mb-5">
      {[
        { label: '总词数', value: stats.total, color: 'text-gray-700', bg: 'bg-gray-50' },
        { label: '今日待复习', value: stats.dueCount, color: 'text-blue-600', bg: 'bg-blue-50', highlight: stats.dueCount > 0 },
        { label: '今日已复习', value: stats.todayReviewed, color: 'text-green-600', bg: 'bg-green-50' },
        { label: '已精通', value: stats.masteredCount, color: 'text-purple-600', bg: 'bg-purple-50' },
      ].map(s => (
        <div key={s.label} className={`rounded-xl p-3 text-center ${s.bg} ${s.highlight ? 'ring-2 ring-blue-300' : ''}`}>
          <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
          <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
        </div>
      ))}
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function Vocabulary() {
  const [vocabulary, setVocabulary] = useState([])
  const [stats, setStats] = useState({ total: 0, dueCount: 0, masteredCount: 0, todayReviewed: 0 })
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')  // all | due | mastered
  const [studyMode, setStudyMode] = useState(false)
  const [studyCards, setStudyCards] = useState([])

  const load = async () => {
    try {
      const { data } = await api.get('/vocabulary')
      setVocabulary(data.vocabulary)
      setStats(data.stats)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id) => {
    try {
      await api.delete(`/vocabulary/${id}`)
      setVocabulary(prev => prev.filter(v => v.id !== id))
      setStats(prev => ({ ...prev, total: prev.total - 1 }))
    } catch (e) {
      console.error(e)
    }
  }

  const startStudy = () => {
    const now = new Date()
    const due = vocabulary.filter(v => new Date(v.nextReview) <= now)
    if (due.length === 0) return
    setStudyCards(due)
    setStudyMode(true)
  }

  const finishStudy = () => {
    setStudyMode(false)
    setLoading(true)
    load()
  }

  if (studyMode) {
    return <FlashCardSession cards={studyCards} onFinish={finishStudy} />
  }

  const now = new Date()
  const filtered = tab === 'all'
    ? vocabulary
    : tab === 'due'
    ? vocabulary.filter(v => new Date(v.nextReview) <= now)
    : vocabulary.filter(v => v.interval >= 21)

  if (loading) return <div className="flex items-center justify-center h-full text-gray-400">加载中...</div>

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-6">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-gray-800">词汇本</h2>
          {stats.dueCount > 0 && (
            <button
              onClick={startStudy}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
              <span>🧠</span>
              开始复习
              <span className="bg-white text-blue-600 rounded-full text-xs font-bold px-1.5 py-0.5 leading-none">
                {stats.dueCount}
              </span>
            </button>
          )}
        </div>

        {/* 统计 */}
        <StatsBar stats={stats} />

        {/* Tab */}
        <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1">
          {[
            { key: 'all',      label: `全部 (${vocabulary.length})` },
            { key: 'due',      label: `待复习 (${stats.dueCount})` },
            { key: 'mastered', label: `已精通 (${stats.masteredCount})` },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                tab === t.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 词汇列表 */}
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            {tab === 'due' ? (
              <>
                <div className="text-5xl mb-3">✅</div>
                <p>今日没有待复习的单词，保持下去！</p>
              </>
            ) : tab === 'mastered' ? (
              <>
                <div className="text-5xl mb-3">🎯</div>
                <p>还没有精通的单词，继续加油！</p>
              </>
            ) : (
              <>
                <div className="text-5xl mb-3">📚</div>
                <p>词汇本还是空的，在对话中点击韩语单词添加吧！</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(v => (
              <VocabCard key={v.id} v={v} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
