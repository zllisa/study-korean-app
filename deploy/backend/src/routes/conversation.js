import express from 'express'
import OpenAI from 'openai'
import { PrismaClient } from '@prisma/client'
import authMiddleware from '../middleware/auth.js'

const router = express.Router()
const prisma = new PrismaClient()

const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL,
})

const SYSTEM_PROMPT = (level, topic, errors) => `
你是一个韩语口语练习伙伴，扮演一个友好的韩国母语者。

规则：
1. 始终用韩语回复，每句韩语后面立即提供中文翻译（格式：韩语内容\n[中文：翻译内容]）
2. 根据用户的${level}水平调整语言复杂度（beginner=简单日常用语，intermediate=正常对话，advanced=自然流利）
3. 如果用户的韩语有语法或用词错误，在回复末尾用以下格式指出：\n[纠错：原文 → 正确：修正 | 说明：解释]
4. 保持对话自然流畅，像真实聊天一样
5. ${topic ? `当前练习主题：${topic}，围绕这个主题对话` : '自由对话模式'}
${errors && errors.length > 0 ? `6. 用户常见错误：${errors.join('、')}，适时在对话中帮助练习这些点` : ''}

重要：纠错格式必须严格遵守，方便系统解析。
`

router.post('/start', authMiddleware, async (req, res) => {
  const { topic, mode } = req.body
  try {
    const session = await prisma.session.create({
      data: { userId: req.user.id, topic, mode: mode || 'free' },
    })
    res.json({ sessionId: session.id })
  } catch {
    res.status(500).json({ error: '创建会话失败' })
  }
})

router.post('/message', authMiddleware, async (req, res) => {
  const { sessionId, message } = req.body

  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { messages: { orderBy: { createdAt: 'asc' }, take: 20 } },
    })

    if (!session || session.userId !== req.user.id)
      return res.status(404).json({ error: '会话不存在' })

    const recentErrors = await prisma.errorRecord.findMany({
      where: { userId: req.user.id },
      orderBy: { count: 'desc' },
      take: 3,
      select: { errorText: true },
    })

    await prisma.message.create({
      data: { sessionId, role: 'user', content: message },
    })

    const history = session.messages.map(m => ({ role: m.role, content: m.content }))
    history.push({ role: 'user', content: message })

    const completion = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT(user.level, session.topic, recentErrors.map(e => e.errorText)) },
        ...history,
      ],
      temperature: 0.8,
    })

    const aiReply = completion.choices[0].message.content

    const translationMatch = aiReply.match(/\[中文：([\s\S]+?)\]/)
    const translation = translationMatch ? translationMatch[1].trim() : null

    const savedMessage = await prisma.message.create({
      data: { sessionId, role: 'assistant', content: aiReply, translation },
    })

    const errorMatch = aiReply.match(/\[纠错：([\s\S]+?) → 正确：([\s\S]+?) \| 说明：([\s\S]+?)\]/)
    if (errorMatch) {
      const [, errorText, correction, explanation] = errorMatch
      const existing = await prisma.errorRecord.findFirst({
        where: { userId: req.user.id, errorText },
      })
      if (existing) {
        await prisma.errorRecord.update({
          where: { id: existing.id },
          data: { count: { increment: 1 }, lastSeen: new Date() },
        })
      } else {
        await prisma.errorRecord.create({
          data: { userId: req.user.id, errorText, correction, explanation },
        })
      }
      await prisma.learningStats.create({
        data: { userId: req.user.id, errorsCount: 1, messagesCount: 1 },
      })
    } else {
      await prisma.learningStats.create({
        data: { userId: req.user.id, messagesCount: 1 },
      })
    }

    res.json({ message: aiReply, translation, messageId: savedMessage.id })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'AI 回复失败' })
  }
})

router.post('/lookup', authMiddleware, async (req, res) => {
  const { word } = req.body
  try {
    const completion = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: '你是韩语词典，用中文解释韩语单词，格式严格如下：\n发音：[发音]\n词性：[词性]\n释义：[中文含义]\n例句1：[韩语例句]\n翻译1：[例句中文翻译]\n例句2：[韩语例句]\n翻译2：[例句中文翻译]',
        },
        { role: 'user', content: `查询韩语单词：${word}` },
      ],
      temperature: 0.3,
    })
    res.json({ result: completion.choices[0].message.content })
  } catch {
    res.status(500).json({ error: '查词失败' })
  }
})

router.post('/grammar', authMiddleware, async (req, res) => {
  const { sentence } = req.body
  try {
    const completion = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: '你是韩语语法老师，用中文详细分析韩语句子的语法结构，包括：句子成分、语法点、时态/语气、注意事项。语言简洁易懂。',
        },
        { role: 'user', content: `分析这个韩语句子的语法：${sentence}` },
      ],
      temperature: 0.3,
    })
    res.json({ result: completion.choices[0].message.content })
  } catch {
    res.status(500).json({ error: '语法分析失败' })
  }
})

router.get('/history', authMiddleware, async (req, res) => {
  try {
    const sessions = await prisma.session.findMany({
      where: {
        userId: req.user.id,
        messages: { some: { role: 'user' } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { messages: { where: { role: 'assistant' }, take: 1, orderBy: { createdAt: 'asc' } } },
    })
    res.json(sessions)
  } catch {
    res.status(500).json({ error: '获取历史失败' })
  }
})

router.delete('/session/:id', authMiddleware, async (req, res) => {
  const sessionId = parseInt(req.params.id)
  try {
    const session = await prisma.session.findUnique({ where: { id: sessionId } })
    if (!session || session.userId !== req.user.id)
      return res.status(404).json({ error: '会话不存在' })
    await prisma.message.deleteMany({ where: { sessionId } })
    await prisma.session.delete({ where: { id: sessionId } })
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: '删除失败' })
  }
})

router.delete('/sessions', authMiddleware, async (req, res) => {
  const { ids } = req.body
  if (!Array.isArray(ids) || ids.length === 0)
    return res.status(400).json({ error: '请提供要删除的会话 ID' })
  try {
    const sessions = await prisma.session.findMany({
      where: { id: { in: ids }, userId: req.user.id },
      select: { id: true },
    })
    const validIds = sessions.map(s => s.id)
    await prisma.message.deleteMany({ where: { sessionId: { in: validIds } } })
    await prisma.session.deleteMany({ where: { id: { in: validIds } } })
    res.json({ ok: true, deleted: validIds.length })
  } catch {
    res.status(500).json({ error: '批量删除失败' })
  }
})

router.get('/session/:id', authMiddleware, async (req, res) => {
  try {
    const session = await prisma.session.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    })
    if (!session || session.userId !== req.user.id)
      return res.status(404).json({ error: '会话不存在' })
    res.json(session)
  } catch {
    res.status(500).json({ error: '获取会话失败' })
  }
})

export default router
