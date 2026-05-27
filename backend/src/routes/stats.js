import express from 'express'
import { PrismaClient } from '@prisma/client'
import authMiddleware from '../middleware/auth.js'

const router = express.Router()
const prisma = new PrismaClient()

router.get('/', authMiddleware, async (req, res) => {
  try {
    const [totalMessages, totalErrors, totalVocab, recentStats] = await Promise.all([
      prisma.message.count({ where: { session: { userId: req.user.id }, role: 'user' } }),
      prisma.errorRecord.count({ where: { userId: req.user.id } }),
      prisma.vocabulary.count({ where: { userId: req.user.id } }),
      prisma.learningStats.findMany({
        where: { userId: req.user.id },
        orderBy: { date: 'desc' },
        take: 30,
      }),
    ])
    res.json({ totalMessages, totalErrors, totalVocab, recentStats })
  } catch {
    res.status(500).json({ error: '获取统计失败' })
  }
})

export default router
