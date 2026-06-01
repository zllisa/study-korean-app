import express from 'express'
import { PrismaClient } from '@prisma/client'
import authMiddleware from '../middleware/auth.js'

const router = express.Router()
const prisma = new PrismaClient()

router.get('/', authMiddleware, async (req, res) => {
  try {
    const errors = await prisma.errorRecord.findMany({
      where: { userId: req.user.id },
      orderBy: { count: 'desc' },
    })
    res.json(errors)
  } catch {
    res.status(500).json({ error: '获取错误记录失败' })
  }
})

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await prisma.errorRecord.delete({ where: { id: parseInt(req.params.id) } })
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: '删除失败' })
  }
})

export default router
