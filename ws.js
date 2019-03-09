'use strict'

const express = require('express')
const SocketServer = require('ws').Server
const path = require('path')

const PORT = process.env.PORT || 3000
const INDEX = path.join(__dirname, 'index.html')

const server = express()
  .use((req, res) => res.sendFile(INDEX) )
  .listen(PORT, () => console.log(`Listening on ${ PORT }`))

const wss = new SocketServer({ server })

const QUESTIONS = [
  {
    question: 'Who?',
    options: ['me', 'you', 'someone else'],
    answer: 'you',
  },
  {
    question: 'When?',
    options: ['now', 'later', 'earlier'],
    answer: 'earlier',
  },
  {
    question: 'What?',
    options: ['that', 'this', 'something else'],
    answer: 'this',
  },
]

let APP_STATE = {
  _state: {
    activeQuestion: null,
    activeQuestionIndex: null,
    waiting: true,
    activeUsers: [],
    userID: (new Date()).valueOf() + Math.floor(Math.random() * 10),
    questionTimer: null,
    introCountdown: null,
    introCountdownActive: false,
  },
  addActiveUser(id) {
    this._state.activeUsers.push(id)
  },
  removeActiveUser(id) {
    const index = this._state.activeUsers.indexOf(id)
    if (index > -1) {
      this._state.activeUsers.splice(index, 1)
    }
  },
  triggerIntroCountdown() {
    this._state.introCountdownActive = true
  },
  startIntroCountdown(max) {
    this._state.introCountdown = max
  },
  decrementIntroCountdown() {
    this._state.introCountdown -= 1
  },
  clearIntroCountdown() {
    this._state.introCountdownActive = false
    this._state.introCountdown = null
  },
  startQuiz() {
    this._state.activeQuestion = QUESTIONS[0]
    this._state.activeQuestionIndex = 0
    this._state.waiting = false
  },
  startQuestionTimer(max) {
    this._state.questionTimer = max
  },
  decrementQuestionTimer() {
    this._state.questionTimer -= 1      
  },
  nextQuestion() {
    const currentIndex = this._state.activeQuestionIndex
    this._state.activeQuestion = QUESTIONS[currentIndex + 1]
    this._state.activeQuestionIndex += 1
  },
  finishQuiz() {
    this._state.activeQuestion = null
    this._state.questionTimer = null
    this._state.waiting = true
  }
}

wss.on('connection', (ws) => {
  console.log('Client connected')
  APP_STATE.addActiveUser(APP_STATE._state.userID)

  if (APP_STATE._state.activeUsers.length >= 2) {
    APP_STATE.triggerIntroCountdown()
  }

  ws.on('close', () => {
    console.log('Client disconnected')
    APP_STATE.removeActiveUser(APP_STATE._state.userID)
  })
})

setInterval(() => {
  if (APP_STATE._state.waiting && APP_STATE._state.activeUsers.length >= 2) {
    APP_STATE.triggerIntroCountdown()
  } else if (APP_STATE._state.activeUsers.length < 2) {
    APP_STATE.clearIntroCountdown()
  } 

  if (APP_STATE._state.introCountdownActive && APP_STATE._state.introCountdown === null) {
    APP_STATE.startIntroCountdown(10)
  } else if (APP_STATE._state.introCountdownActive && APP_STATE._state.introCountdown > 0) {
    APP_STATE.decrementIntroCountdown()
  } else if (APP_STATE._state.introCountdown !== null)  {
    APP_STATE.clearIntroCountdown()
    APP_STATE.startQuiz()
  }

  if (APP_STATE._state.activeQuestion && APP_STATE._state.questionTimer === null) {
    APP_STATE.startQuestionTimer(5)
  } else if (APP_STATE._state.activeQuestion && APP_STATE._state.questionTimer > 0) {
    APP_STATE.decrementQuestionTimer()
  } else if (APP_STATE._state.questionTimer !== null)  {
    if (APP_STATE._state.activeQuestionIndex + 1 < QUESTIONS.length) {
      APP_STATE.nextQuestion()
      APP_STATE.startQuestionTimer(5)
    } else {
      APP_STATE.finishQuiz()
    }
  }

  wss.clients.forEach((client) => {
    client.send(JSON.stringify(APP_STATE._state))
  }) 
}, 1000)
