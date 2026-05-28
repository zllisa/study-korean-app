import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import authRoutes from './routes/auth.js'
import conversationRoutes from './routes/conversation.js'
import speechRoutes from './routes/speech.js'
import errorRoutes from './routes/errors.js'
import vocabularyRoutes from './routes/vocabulary.js'
import statsRoutes from './routes/stats.js'

const app = express()
const PORT = process.env.PORT || 4000

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

app.use('/api/auth', authRoutes)
app.use('/api/conversation', conversationRoutes)
app.use('/api/speech', speechRoutes)
app.use('/api/errors', errorRoutes)
app.use('/api/vocabulary', vocabularyRoutes)
app.use('/api/stats', statsRoutes)

app.get('/health', (req, res) => res.json({ status: 'ok' }))

app.listen(PORT, () => {
  console.log(`后端服务启动：http://localhost:${PORT}`)
})
