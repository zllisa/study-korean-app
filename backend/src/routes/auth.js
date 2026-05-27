import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const router = express.Router()
const prisma = new PrismaClient()

router.post('/register', async (req, res) => {
  const { email, username, password } = req.body
  if (!email || !username || !password)
    return res.status(400).json({ error: '请填写所有字段' })

  try {
    const hashed = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { email, username, password: hashed },
    })
    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' })
    res.json({ token, user: { id: user.id, username: user.username, email: user.email, level: user.level } })
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ error: '邮箱或用户名已存在' })
    res.status(500).json({ error: '注册失败' })
  }
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  try {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return res.status(400).json({ error: '用户不存在' })

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return res.status(400).json({ error: '密码错误' })

    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' })
    res.json({ token, user: { id: user.id, username: user.username, email: user.email, level: user.level } })
  } catch {
    res.status(500).json({ error: '登录失败' })
  }
})

export default router
