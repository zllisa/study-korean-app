import express from 'express'
import axios from 'axios'
import authMiddleware from '../middleware/auth.js'

const router = express.Router()

router.get('/token', authMiddleware, async (req, res) => {
  try {
    const response = await axios.post(
      `https://${process.env.AZURE_SPEECH_REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
      null,
      { headers: { 'Ocp-Apim-Subscription-Key': process.env.AZURE_SPEECH_KEY } }
    )
    res.json({ token: response.data, region: process.env.AZURE_SPEECH_REGION })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: '获取语音 Token 失败' })
  }
})

export default router
