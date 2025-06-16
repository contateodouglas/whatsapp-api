import 'dotenv/config'
import express from 'express'
import nodeCleanup from 'node-cleanup'
import routes from './routes.js'
import { init, cleanup } from './whatsapp.js'
import cors from 'cors'

const app = express()

// Na Render, é OBRIGATÓRIO usar a variável PORT automaticamente fornecida
const port = process.env.PORT || process.env.WA_SERVER_PORT || 8000

app.use(cors())
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

// Rotas
app.use('/', routes)

// Iniciar servidor
app.listen(port, '0.0.0.0', () => {
    init()
    console.log(`✅ Server is listening on http://0.0.0.0:${port}`)
})

// Limpeza ao encerrar
nodeCleanup(cleanup)

export default app
