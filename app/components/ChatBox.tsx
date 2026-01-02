"use client"

import { useState, useRef, useEffect, FormEvent, KeyboardEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import { MicIcon, MicOffIcon, CornerDownLeftIcon, XIcon, CopyIcon, AlertCircle, Crown } from 'lucide-react'
import { mutateConversations, mutateUsage } from './ChatSidebar'
import { MODELS, MODEL_GROUPS, type Provider } from '@/lib/models'
import { Conversation, ConversationContent } from '@/components/ai-elements/conversation'
import { Message, MessageContent } from '@/components/ai-elements/message'
import {
  PromptInputSubmit,
  PromptInputButton,
  PromptInputSelect,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSelectContent,
  PromptInputSelectItem,
} from '@/components/ai-elements/prompt-input'
import { Loader } from '@/components/ai-elements/loader'
import { CodeBlock, CodeBlockCopyButton } from '@/components/ai-elements/code-block'
import { BundledLanguage } from 'shiki'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

function useTheme() {
  try {
    const { setTheme } = require('@/components/ThemeProvider').useTheme()
    return setTheme
  } catch {
    return () => {}
  }
}

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  files?: Array<{ name: string; type: string; size: number }>
  sources?: Array<{ title: string; url: string }>
}

type TokenStatus = {
  tokensUsed: number
  tokensLimit: number
  tokensRemaining: number
  tokensPercentage: number
  subscriptionTier: string
  shouldShowAlert: boolean
  alertLevel: 'warning' | 'critical' | 'depleted'
  hoursUntilReset: number
  resetAt: string
  lastTokenAlert: number | null
}

const PROMPTMODELOPTIONS = Object.keys(MODEL_GROUPS as Record<Provider, typeof MODEL_GROUPS[Provider]>)
  .flatMap((provider) => {
    const group = MODEL_GROUPS[provider as Provider]
    if (provider === 'google') {
      return group.models
        .filter(id => id === 'gemini-2.5-flash' || id === 'gemini-2.5-flash-lite')
        .map(id => ({ id, name: MODELS[id]?.name ?? id }))
    }
    return group.models.map(id => ({ id, name: MODELS[id]?.name ?? id }))
  })

const DEFAULTMODELID = PROMPTMODELOPTIONS.find(m => m.id === 'gemini-2.5-flash')?.id ?? PROMPTMODELOPTIONS[0]?.id ?? 'gemini-2.5-flash'

function TypingIndicator({ isTyping }: { isTyping: boolean }) {
  const [loadingText, setLoadingText] = useState('Typing')
  const [dots, setDots] = useState('')

  useEffect(() => {
    if (!isTyping) {
      setLoadingText('Typing')
      setDots('')
      return
    }

    const texts = ['Typing', 'Generating', 'Processing']
    let textIndex = 0
    let dotIndex = 0

    const interval = setInterval(() => {
      setLoadingText(texts[textIndex])
      setDots('.'.repeat(dotIndex + 1))
      textIndex = (textIndex + 1) % texts.length
      dotIndex = (dotIndex + 1) % 4
    }, 800)

    return () => clearInterval(interval)
  }, [isTyping])

  if (!isTyping) return null

  return (
    <div className="flex items-start gap-3 p-4">
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
        <div className="h-2.5 w-2.5 animate-ping rounded-full bg-black dark:bg-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="inline-flex items-center gap-1 text-sm text-gray-900 dark:text-gray-100">
          <span>{loadingText}</span>
          <span>{dots}</span>
        </div>
      </div>
    </div>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function FilePreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  return (
    <div className="group flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2 shadow-sm hover:shadow-md transition-all">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
        <span className="text-xs font-medium">📎</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium text-black dark:text-white">{file.name}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{formatFileSize(file.size)}</p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 h-7 w-7 flex-shrink-0 ml-1 flex items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
        aria-label={`Remove ${file.name}`}
      >
        <XIcon className="h-3 w-3 text-gray-900 dark:text-gray-100" />
      </button>
    </div>
  )
}

const getBundledLanguage = (lang: string): BundledLanguage => {
  const allowed: BundledLanguage[] = ['javascript', 'typescript', 'python', 'html', 'css', 'json', 'markdown']
  return allowed.includes(lang as BundledLanguage) ? (lang as BundledLanguage) : 'text' as any
}

function CompactTokenStatus({ tokenStatus }: { tokenStatus: TokenStatus | null }) {
  const percentage = tokenStatus ? Math.round(tokenStatus.tokensPercentage) : 0
  const tokensRemaining = tokenStatus?.tokensRemaining ?? 0
  const tokensLimit = tokenStatus?.tokensLimit ?? 0

  if (!tokenStatus) return null

  return (
    <div className="flex items-center justify-between gap-2 border-b border-gray-200 dark:border-gray-700 px-4 py-2.5 bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center gap-1.5 min-w-0">
        <Crown className="h-3.5 w-3.5 text-gray-900 dark:text-gray-100" />
        <span className="truncate text-xs font-semibold text-gray-900 dark:text-gray-100">
          {tokensRemaining.toLocaleString()}/{tokensLimit.toLocaleString()}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-16 rounded-full bg-gray-300 dark:bg-gray-700">
          <div
            className="h-1.5 rounded-full transition-all bg-black dark:bg-white"
            style={{ width: `${Math.min(Math.max(percentage, 5), 100)}%` }}
          />
        </div>
        <span className="w-8 text-right font-mono text-xs text-gray-900 dark:text-gray-100">{percentage}%</span>
      </div>
    </div>
  )
}

function SourcesList({ sources }: { sources: Array<{ title: string; url: string }> }) {
  return (
    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1.5 h-1.5 bg-black dark:bg-white rounded-full" />
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Sources</span>
      </div>
      <div className="space-y-1.5">
        {sources.map((source, index) => (
          <a
            key={index}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-black dark:hover:border-white transition-all text-sm truncate text-gray-900 dark:text-gray-100"
          >
            {source.title}
          </a>
        ))}
      </div>
    </div>
  )
}

export default function ChatBox({
  conversationId,
  setConversationId,
  chatTitle,
}: {
  conversationId: string | null
  setConversationId: (id: string | null) => void
  chatTitle?: string | null
}) {
  const router = useRouter()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [input, setInput] = useState('')
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULTMODELID!)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [searchEnabled, setSearchEnabled] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [tokenStatus, setTokenStatus] = useState<TokenStatus | null>(null)
  const [showTokenDepletedModal, setShowTokenDepletedModal] = useState(false)
  const recognitionRef = useRef<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollRootRef = useRef<HTMLDivElement>(null)

  const hasHistory = conversationId !== null && messages.length > 0
  const isDepleted = (tokenStatus?.tokensRemaining ?? 0) === 0 || (tokenStatus?.tokensPercentage ?? 0) >= 100

  const fetchTokenStatus = async () => {
    try {
      const res = await fetch('/api/credits', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setTokenStatus(data)
      }
    } catch (error) {
      console.error('Error fetching tokens', error)
    }
  }

  const checkTokensBeforeSend = async (): Promise<boolean> => {
    await fetchTokenStatus()
    if (!tokenStatus) return true

    const percentage = Math.round(tokenStatus.tokensPercentage)
    if (tokenStatus.tokensRemaining <= 0 || percentage >= 100) {
      setShowTokenDepletedModal(true)
      return false
    }

    if (percentage >= 90) {
      toast.warning(
        `High token usage! ${percentage}% used, ${tokenStatus.tokensRemaining} tokens left`,
        {
          id: 'tokens-high-popup',
          duration: 5000,
          action: {
            label: 'Upgrade',
            onClick: () => router.push('/pricing'),
          },
        }
      )
    }
    return true
  }

  useEffect(() => {
    fetchTokenStatus()
    const interval = setInterval(fetchTokenStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      setSpeechSupported(!!SpeechRecognition)
    }
  }, [])

  const startListening = () => {
    if (typeof window === 'undefined') return

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      toast.error('Speech recognition not supported. Please use Chrome.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onstart = () => setIsListening(true)
    recognition.onresult = (event: any) => {
      let finalTranscript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript
        }
      }
      if (finalTranscript) {
        setInput((prev) => prev + finalTranscript)
      }
    }
    recognition.onerror = () => setIsListening(false)
    recognition.onend = () => setIsListening(false)

    recognitionRef.current = recognition
    recognitionRef.current.start()
  }

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    setIsListening(false)
  }

  const toggleVoiceInput = () => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [])

  const defaultSuggestions = [
    'Explain this concept',
    'Help debug code',
    'Generate ideas',
    'Write SQL query',
  ]

  useEffect(() => {
    const timeout = setTimeout(() => {
      const trimmed = input.trim()
      if (!trimmed) {
        setSuggestions(defaultSuggestions)
        return
      }
      const filtered = defaultSuggestions.filter(s =>
        s.toLowerCase().includes(trimmed.toLowerCase())
      )
      setSuggestions(filtered.length ? filtered : defaultSuggestions)
    }, 200)
    return () => clearTimeout(timeout)
  }, [input])

  useEffect(() => {
    let isMounted = true
    async function loadHistory(id: string) {
      const res = await fetch(`/api/messages?conversationId=${id}`, {
        credentials: 'include',
      })
      const data = await res.json()
      if (!isMounted) return

      const parsedMessages = data.messages?.map((msg: any) => {
        try {
          const parsed = JSON.parse(msg.content)
          if (parsed.text || parsed.files) {
            return {
              role: msg.role as 'user' | 'assistant',
              content: parsed.text,
              files: parsed.files,
              sources: parsed.sources,
            }
          }
        } catch {
          //
        }
        return {
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        }
      })

      setMessages(
        parsedMessages?.length
          ? (parsedMessages as ChatMessage[])
          : [{ role: 'assistant', content: chatTitle || 'How can I help you today?' }]
      )
    }
    if (conversationId) {
      loadHistory(conversationId)
    } else {
      setMessages([])
    }
    return () => {
      isMounted = false
    }
  }, [conversationId, chatTitle])

  useEffect(() => {
    if (scrollRootRef.current) {
      scrollRootRef.current.scrollTop = scrollRootRef.current.scrollHeight
    }
  }, [messages, isTyping])

  const isValidFile = (file: File): boolean => {
    return file.type.startsWith('image/') || file.type === 'application/pdf'
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files)
      const validFiles: File[] = []
      let error = false

      newFiles.forEach((file) => {
        if (isValidFile(file)) {
          validFiles.push(file)
        } else {
          error = true
        }
      })

      if (error) {
        setErrorMessage('Only images and PDFs are supported.')
        setTimeout(() => setErrorMessage(null), 3000)
      }

      setFiles((prev) => [...prev, ...validFiles])
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleFileUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function sendChatMessage(text: string) {
    const hasTokens = await checkTokensBeforeSend()
    if (!hasTokens) return

    const trimmed = text.trim()
    if (!trimmed || isTyping) return

    const userMessage: ChatMessage = { role: 'user', content: trimmed }
    if (files.length > 0) {
      userMessage.files = files.map((f) => ({
        name: f.name,
        type: f.type,
        size: f.size,
      }))
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsTyping(true)
    setFiles([])

    const formData = new FormData()
    formData.append('message', trimmed)
    formData.append('model', selectedModel)
    formData.append('searchEnabled', searchEnabled.toString())
    if (conversationId) {
      formData.append('conversationId', conversationId)
    }
    files.forEach((file, index) => {
      formData.append(`file${index}`, file)
    })

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      if (!res.ok) {
        const errorData = await res.json()
        if (errorData.code === 'TOKENSEXHAUSTED') {
          setTokenStatus((prev) =>
            prev ? { ...prev, tokensRemaining: 0, tokensPercentage: 100 } : null
          )
          setShowTokenDepletedModal(true)
        } else {
          throw new Error(errorData.error || 'Failed to send message')
        }
        return
      }

      if (!conversationId) {
        mutateConversations()
        const convRes = await fetch('/api/conversations', { credentials: 'include' })
        if (convRes.ok) {
          const convData = await convRes.json()
          const list = convData.conversations ?? []
          if (list.length) {
            const newest = list[list.length - 1]
            setConversationId(newest.id)
          }
        }
      }

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let full = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value)
          full += chunk

          setMessages((prev) => {
            const updated = [...prev]
            if (updated.length && updated[updated.length - 1].role === 'assistant') {
              updated[updated.length - 1].content = full
            } else {
              updated.push({ role: 'assistant', content: full })
            }
            return updated
          })
        }
      }

      mutateUsage()
      mutateConversations()
      await fetchTokenStatus()
    } catch (error) {
      console.error('Chat error:', error)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            error instanceof Error
              ? `Error: ${error.message}`
              : 'Unable to connect. Please try again.',
        },
      ])
    } finally {
      setIsTyping(false)
    }
  }

  const handlePromptSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    if (event) {
      event.preventDefault()
    }
    const text = input.trim()
    if (!text || isTyping) return
    await sendChatMessage(text)
  }

  const handleTextareaKeyDown = async (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const text = input.trim()
      if (text && !isTyping) {
        await sendChatMessage(text)
      }
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion)
  }

  const handleCopyAssistantMessage = async (content: string) => {
    if (!navigator.clipboard) return
    try {
      await navigator.clipboard.writeText(content)
      toast.success('Copied to clipboard!')
    } catch (err) {
      console.error('Failed to copy', err)
    }
  }

  const showCenterPrompt = !hasHistory && !isTyping && messages.length === 0 && !input

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-white dark:bg-gray-950">
      <CompactTokenStatus tokenStatus={tokenStatus} />

      <Dialog open={showTokenDepletedModal} onOpenChange={setShowTokenDepletedModal}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <AlertCircle className="h-6 w-6" />
              Token Limit Reached
            </DialogTitle>
            <DialogDescription className="text-sm">
              You've used all your daily tokens. Upgrade for unlimited access or wait for reset.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col gap-2">
            <Button
              variant="outline"
              onClick={() => setShowTokenDepletedModal(false)}
              className="w-full"
            >
              Wait for Reset
            </Button>
            <Button
              onClick={() => {
                setShowTokenDepletedModal(false)
                router.push('/pricing')
              }}
              className="w-full bg-black text-white hover:bg-gray-900 dark:bg-white dark:text-black dark:hover:bg-gray-100"
            >
              Upgrade Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-1 w-full flex-col overflow-hidden">
        <div className="h-full w-full overflow-auto">
          <div
            ref={scrollRootRef}
            className="flex min-h-full w-full flex-col gap-4 p-4 sm:p-6 lg:p-8 pb-20 lg:pb-24"
          >
            {showCenterPrompt ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center px-4 max-w-md mx-auto">
                <div className="flex flex-col items-center gap-3">
                  <h1 className="text-2xl sm:text-3xl font-bold text-black dark:text-white">
                    What would you like to ask QueryMate?
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    Ask anything, get instant answers.
                  </p>
                </div>

                <div className="w-full flex flex-wrap gap-2.5 justify-center max-w-lg">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="px-4 py-2.5 text-xs font-medium bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-sm transition-all duration-200 backdrop-blur-sm flex-shrink-0 min-w-[100px] max-w-[200px] text-gray-900 dark:text-gray-100"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((m, i) => (
                  <div key={i} className="flex w-full">
                    {m.role === 'user' ? (
                      <div className="flex w-full justify-end">
                        <div className="flex flex-col items-end max-w-xs sm:max-w-md lg:max-w-lg">
                          <div className="bg-gray-200 dark:bg-gray-800 rounded-2xl rounded-br-md px-4 py-3 max-w-full border border-gray-300 dark:border-gray-600">
                            <div className="prose prose-sm max-w-none text-black dark:text-white leading-relaxed break-words">
                              {m.content}
                            </div>
                            {m.files && m.files.length > 0 && (
                              <div className="mt-2.5 flex flex-wrap gap-1.5 pt-1.5 border-t border-gray-300 dark:border-gray-600">
                                {m.files.map((file, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-gray-900 rounded-lg border border-gray-300 dark:border-gray-600 text-xs"
                                  >
                                    <span className="text-xs">📎</span>
                                    <span className="truncate max-w-32 text-gray-900 dark:text-gray-100">{file.name}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex w-full">
                        <div className="flex flex-col max-w-xs sm:max-w-md lg:max-w-2xl">
                          <div className="bg-white dark:bg-gray-800 rounded-2xl px-4 py-3 shadow-sm border border-gray-200 dark:border-gray-700">
                            <div className="prose prose-sm max-w-none dark:prose-invert">
                              <ReactMarkdown
                                components={{
                                  a: ({ node, children, href, ...props }) => (
                                    <a
                                      href={href}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-black dark:text-white underline hover:text-gray-900 dark:hover:text-gray-100 break-all font-medium"
                                      {...props}
                                    >
                                      {children}
                                    </a>
                                  ),
                                  code({ className, children, ...props }) {
                                    const match = /language-(\w+)/.exec(className || '')
                                    const codeText = String(children ?? '').replace(/\n$/, '').replace(/^\n/, '')
                                    const lang = match ? match[1] : 'text'
                                    const bundledLang = getBundledLanguage(lang)

                                    return (
                                      <div className="my-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 shadow-sm overflow-hidden">
                                        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                                          <span className="text-xs font-semibold uppercase tracking-wide text-black dark:text-white">
                                            {lang}
                                          </span>
                                          <CodeBlockCopyButton
                                            onCopy={async () => {
                                              if (!navigator.clipboard) return
                                              await navigator.clipboard.writeText(codeText)
                                            }}
                                            className="h-7 w-7 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-600 transition-all"
                                          />
                                        </div>
                                        <div className="max-h-80 overflow-auto">
                                          <CodeBlock
                                            code={codeText}
                                            language={bundledLang}
                                            showLineNumbers={true}
                                            className="text-xs [&>pre]:p-4"
                                          />
                                        </div>
                                      </div>
                                    )
                                  },
                                  pre: () => null,
                                  p: ({ children, ...props }) => (
                                    <p className="mb-3 leading-relaxed text-black dark:text-white" {...props}>
                                      {children}
                                    </p>
                                  ),
                                  ul: ({ children, ...props }) => (
                                    <ul className="list-disc ml-6 space-y-1.5 mb-3 text-gray-900 dark:text-gray-100" {...props}>
                                      {children}
                                    </ul>
                                  ),
                                  ol: ({ children, ...props }) => (
                                    <ol className="list-decimal ml-6 space-y-1.5 mb-3 text-gray-900 dark:text-gray-100" {...props}>
                                      {children}
                                    </ol>
                                  ),
                                  li: ({ children, ...props }) => (
                                    <li className="text-sm leading-relaxed text-gray-900 dark:text-gray-100" {...props}>
                                      {children}
                                    </li>
                                  ),
                                  h1: ({ children, ...props }) => (
                                    <h1 className="text-xl font-bold mt-6 mb-3 text-black dark:text-white" {...props}>
                                      {children}
                                    </h1>
                                  ),
                                  h2: ({ children, ...props }) => (
                                    <h2 className="text-lg font-bold mt-5 mb-2.5 text-black dark:text-white" {...props}>
                                      {children}
                                    </h2>
                                  ),
                                  h3: ({ children, ...props }) => (
                                    <h3 className="text-base font-bold mt-4 mb-2 text-black dark:text-white" {...props}>
                                      {children}
                                    </h3>
                                  ),
                                }}
                              >
                                {m.content}
                              </ReactMarkdown>
                            </div>
                            
                            {m.sources && m.sources.length > 0 && (
                              <SourcesList sources={m.sources} />
                            )}
                            
                            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                              <button
                                type="button"
                                onClick={() => handleCopyAssistantMessage(m.content)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl text-xs font-medium text-black dark:text-white border border-gray-300 dark:border-gray-600 transition-all"
                              >
                                <CopyIcon className="h-3 w-3" />
                                Copy
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <TypingIndicator isTyping={isTyping} />
              </>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-4 sm:px-6 sticky bottom-0">
        <div className="mx-auto max-w-2xl w-full">
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {files.map((file, index) => (
                <FilePreview
                  key={index}
                  file={file}
                  onRemove={() => handleRemoveFile(index)}
                />
              ))}
            </div>
          )}

          {errorMessage && (
            <div className="mb-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-sm text-black dark:text-white">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handlePromptSubmit} className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-2xl shadow-sm hover:shadow-md transition-all">
              <textarea
                value={input}
                onChange={(e) => setInput(e.currentTarget.value)}
                onKeyDown={handleTextareaKeyDown}
                placeholder={showCenterPrompt ? "Try asking a question..." : "Type your message..."}
                rows={1}
                disabled={isTyping}
                className="w-full resize-none bg-transparent border-none p-0 text-sm font-normal text-black dark:text-white outline-none placeholder-gray-500 dark:placeholder-gray-400 disabled:opacity-50 min-h-[20px] max-h-24 leading-relaxed"
              />

              <input
                type="file"
                multiple
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/*,.pdf"
              />

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={handleFileUploadClick}
                    disabled={isTyping}
                    className="h-10 w-10 rounded-xl bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center justify-center shadow-sm hover:shadow-md transition-all disabled:opacity-50 text-gray-900 dark:text-gray-100"
                    aria-label="Attach file"
                  >
                    <span className="text-lg">+</span>
                  </button>

                  <button
                    type="button"
                    onClick={toggleVoiceInput}
                    disabled={!speechSupported || isTyping}
                    className={`h-10 w-10 rounded-xl flex items-center justify-center shadow-sm transition-all disabled:opacity-50 ${
                      isListening
                        ? 'bg-black dark:bg-white border-black dark:border-white text-white dark:text-black hover:bg-gray-900 dark:hover:bg-gray-100'
                        : 'bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 hover:shadow-md text-black dark:text-white'
                    }`}
                    aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
                  >
                    {isListening ? (
                      <MicOffIcon className="h-4 w-4" />
                    ) : (
                      <MicIcon className="h-4 w-4" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSearchEnabled(!searchEnabled)}
                    disabled={isTyping}
                    className={`h-10 px-3 rounded-xl text-xs font-medium shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5 ${
                      searchEnabled
                        ? 'bg-black dark:bg-white border-black dark:border-white text-white dark:text-black hover:bg-gray-900 dark:hover:bg-gray-100'
                        : 'bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 hover:shadow-md text-black dark:text-white'
                    }`}
                  >
                    <span>🔍</span>
                    <span>{searchEnabled ? 'Search ON' : 'Search'}</span>
                  </button>

                  <PromptInputSelect
                    value={selectedModel}
                    onValueChange={setSelectedModel}
                    disabled={isTyping}
                  >
                    <PromptInputSelectTrigger className="h-10 w-28 rounded-xl bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 px-2.5 shadow-sm hover:shadow-md text-xs font-medium text-gray-900 dark:text-gray-100">
                      Model
                    </PromptInputSelectTrigger>
                    <PromptInputSelectContent className="w-44">
                      {PROMPTMODELOPTIONS.map((m) => (
                        <PromptInputSelectItem key={m.id} value={m.id} className="text-xs py-2">
                          {m.name}
                        </PromptInputSelectItem>
                      ))}
                    </PromptInputSelectContent>
                  </PromptInputSelect>
                </div>

                <button
                  type="submit"
                  disabled={isTyping || !input.trim()}
                  className={`h-12 px-4 rounded-xl flex items-center gap-2 font-semibold transition-all shadow-lg ${
                    isTyping || !input.trim()
                      ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed shadow-none'
                      : 'bg-black dark:bg-white hover:bg-gray-900 dark:hover:bg-gray-100 text-white dark:text-black hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0'
                  } min-w-[56px]`}
                  aria-label="Send message"
                >
                  {isTyping ? (
                    <Loader className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <CornerDownLeftIcon className="h-4 w-4" />
                      <span className="hidden sm:inline">Send</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>

          <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-3 pt-2 border-t border-gray-300 dark:border-gray-700">
           QueryMate AI may make mistakes. Verify important information.
          </p>
        </div>
      </div>
    </div>
  )
}