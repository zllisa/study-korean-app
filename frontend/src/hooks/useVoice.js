import { useState, useRef, useCallback } from 'react'
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk'
import api from '../services/api.js'

export function useVoice() {
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const recognizerRef = useRef(null)
  const synthesizerRef = useRef(null)

  const getToken = async () => {
    const { data } = await api.get('/speech/token')
    return data
  }

  const onResultRef = useRef(null)
  const onErrorRef = useRef(null)
  const accumulatedTextRef = useRef('')

  const startListening = useCallback(async (onResult, onError) => {
    try {
      const { token, region } = await getToken()
      const authConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(token, region)
      authConfig.speechRecognitionLanguage = 'ko-KR'

      const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput()
      const recognizer = new SpeechSDK.SpeechRecognizer(authConfig, audioConfig)
      recognizerRef.current = recognizer
      onResultRef.current = onResult
      onErrorRef.current = onError
      accumulatedTextRef.current = ''

      recognizer.recognized = (_, e) => {
        if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech && e.result.text) {
          accumulatedTextRef.current += (accumulatedTextRef.current ? ' ' : '') + e.result.text
        }
      }

      recognizer.canceled = (_, e) => {
        if (e.reason === SpeechSDK.CancellationReason.Error) {
          onErrorRef.current?.('语音识别出错，请重试')
        }
      }

      recognizer.startContinuousRecognitionAsync(
        () => setIsListening(true),
        err => {
          setIsListening(false)
          onError?.(err)
          recognizer.close()
        }
      )
    } catch (e) {
      onError?.(e.message)
    }
  }, [])

  const stopListening = useCallback(() => {
    const recognizer = recognizerRef.current
    if (!recognizer) return
    recognizer.stopContinuousRecognitionAsync(
      () => {
        setIsListening(false)
        const text = accumulatedTextRef.current.trim()
        if (text) {
          onResultRef.current?.(text)
        } else {
          onErrorRef.current?.('未识别到语音，请重试')
        }
        recognizer.close()
        recognizerRef.current = null
      },
      err => {
        setIsListening(false)
        onErrorRef.current?.(err)
        recognizer.close()
        recognizerRef.current = null
      }
    )
  }, [])

  const speak = useCallback(async (text, onEnd) => {
    if (synthesizerRef.current) {
      synthesizerRef.current.close()
      synthesizerRef.current = null
      setIsSpeaking(false)
    }
    try {
      const { token, region } = await getToken()
      const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(token, region)
      speechConfig.speechSynthesisVoiceName = 'ko-KR-SunHiNeural'

      const synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig)
      synthesizerRef.current = synthesizer
      setIsSpeaking(true)

      synthesizer.speakTextAsync(
        text,
        () => {
          setIsSpeaking(false)
          synthesizer.close()
          synthesizerRef.current = null
          onEnd?.()
        },
        err => {
          setIsSpeaking(false)
          synthesizer.close()
          synthesizerRef.current = null
          console.error('TTS error:', err)
        }
      )
    } catch (e) {
      setIsSpeaking(false)
      console.error(e)
    }
  }, [])

  const stopSpeaking = useCallback(() => {
    const synth = synthesizerRef.current
    if (!synth) return
    synthesizerRef.current = null
    setIsSpeaking(false)
    try {
      synth.stopSpeakingAsync(
        () => synth.close(),
        () => synth.close()
      )
    } catch {
      try { synth.close() } catch {}
    }
  }, [])

  return { isListening, isSpeaking, startListening, stopListening, speak, stopSpeaking }
}
