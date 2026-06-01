import express from 'express'
import { PrismaClient } from '@prisma/client'
import authMiddleware from '../middleware/auth.js'

const router = express.Router()
const prisma = new PrismaClient()

function intervalToMastery(interval) {
  if (interval >= 21) return 100
  if (interval >= 7) return 70
  if (interval >= 3) return 40
  return 20
}

function sm2(interval, easeFactor, quality) {
  let newInterval, newEF
  if (quality === 0) {
    newInterval = 1
    newEF = Math.max(1.3, easeFactor - 0.2)
  } else if (quality === 1) {
    newInterval = Math.max(1, Math.round(interval * 1.2))
    newEF = Math.max(1.3, easeFactor - 0.15)
  } else if (quality === 2) {
    newInterval = Math.max(1, Math.round(interval * easeFactor))
    newEF = easeFactor
  } else {
    newInterval = Math.max(1, Math.round(interval * easeFactor * 1.3))
    newEF = Math.min(2.5, easeFactor + 0.1)
  }
  return { interval: newInterval, easeFactor: parseFloat(newEF.toFixed(2)) }
}

router.get('/', authMiddleware, async (req, res) => {
  try {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayEnd = new Date(todayStart.getTime() + 86400000)

    const vocabulary = await prisma.vocabulary.findMany({
      where: { userId: req.user.id },
      orderBy: { nextReview: 'asc' },
    })

    const dueCount = vocabulary.filter(v => new Date(v.nextReview) <= now).length
    const masteredCount = vocabulary.filter(v => v.interval >= 21).length
    const todayReviewed = vocabulary.filter(
      v => v.lastReviewed && new Date(v.lastReviewed) >= todayStart && new Date(v.lastReviewed) < todayEnd
    ).length

    res.json({ vocabulary, stats: { total: vocabulary.length, dueCount, masteredCount, todayReviewed } })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: '获取词汇失败' })
  }
})

router.post('/', authMiddleware, async (req, res) => {
  const { word, meaning, pronunciation, examples } = req.body
  try {
    const existing = await prisma.vocabulary.findFirst({
      where: { userId: req.user.id, word },
    })
    if (existing) return res.json(existing)

    const vocab = await prisma.vocabulary.create({
      data: { userId: req.user.id, word, meaning, pronunciation, examples },
    })
    res.json(vocab)
  } catch {
    res.status(500).json({ error: '保存词汇失败' })
  }
})

router.post('/review/:id', authMiddleware, async (req, res) => {
  const { quality } = req.body  // 0=忘了 1=模糊 2=记得 3=很熟
  if (![0, 1, 2, 3].includes(quality))
    return res.status(400).json({ error: '无效评分' })

  try {
    const vocab = await prisma.vocabulary.findUnique({ where: { id: parseInt(req.params.id) } })
    if (!vocab || vocab.userId !== req.user.id)
      return res.status(404).json({ error: '单词不存在' })

    const { interval, easeFactor } = sm2(vocab.interval, vocab.easeFactor, quality)
    const mastery = intervalToMastery(interval)
    const nextReview = new Date()
    nextReview.setDate(nextReview.getDate() + interval)

    const updated = await prisma.vocabulary.update({
      where: { id: vocab.id },
      data: {
        interval,
        easeFactor,
        mastery,
        nextReview,
        reviewCount: { increment: 1 },
        lastReviewed: new Date(),
      },
    })
    res.json(updated)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: '复习记录失败' })
  }
})

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const vocab = await prisma.vocabulary.findUnique({ where: { id: parseInt(req.params.id) } })
    if (!vocab || vocab.userId !== req.user.id)
      return res.status(404).json({ error: '单词不存在' })
    await prisma.vocabulary.delete({ where: { id: vocab.id } })
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: '删除失败' })
  }
})

// keep old mastery patch for compatibility
router.patch('/:id/mastery', authMiddleware, async (req, res) => {
  const { mastery } = req.body
  const nextReview = new Date()
  nextReview.setDate(nextReview.getDate() + (mastery > 70 ? 7 : mastery > 40 ? 3 : 1))
  try {
    const vocab = await prisma.vocabulary.update({
      where: { id: parseInt(req.params.id) },
      data: { mastery, nextReview },
    })
    res.json(vocab)
  } catch {
    res.status(500).json({ error: '更新失败' })
  }
})

export default router
