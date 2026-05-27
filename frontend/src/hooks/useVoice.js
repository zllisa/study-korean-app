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

  const startListening = useCallback(async (onResult, onError) => {
    try {
      const { token, region } = await getToken()
      const authConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(token, region)
      authConfig.speechRecognitionLanguage = 'ko-KR'

      const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput()
      const recognizer = new SpeechSDK.SpeechRecognizer(authConfig, audioConfig)
      recognizerRef.current = recognizer

      recognizer.recognizeOnceAsync(
        result => {
          setIsListening(false)
          if (result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
            onResult(result.text)
          } else {
            onError?.('未识别到语音，请重试')
          }
          recognizer.close()
        },
        err => {
          setIsListening(false)
          onError?.(err)
          recognizer.close()
        }
      )
      setIsListening(true)
    } catch (e) {
      onError?.(e.message)
    }
  }, [])

  const stopListening = useCallback(() => {
    recognizerRef.current?.close()
    setIsListening(false)
  }, [])

  const speak = useCallback(async (text, onEnd) => {
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
          onEnd?.()
        },
        err => {
          setIsSpeaking(false)
          synthesizer.close()
          console.error('TTS error:', err)
        }
      )
    } catch (e) {
      setIsSpeaking(false)
      console.error(e)
    }
  }, [])

  const stopSpeaking = useCallback(() => {
    synthesizerRef.current?.close()
    setIsSpeaking(false)
  }, [])

  return { isListening, isSpeaking, startListening, stopListening, speak, stopSpeaking }
}
