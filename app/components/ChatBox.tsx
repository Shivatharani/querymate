"use client"

import { useState, useRef, useEffect, FormEvent, KeyboardEvent } from 'react'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import ReactMarkdown from 'react-markdown'
import { PlusIcon, MicIcon, MicOffIcon, Globe2, CornerDownLeftIcon, FileIcon, ImageIcon, XIcon, CopyIcon, AlertCircle, Crown } from 'lucide-react'
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
import { Suggestions, Suggestion } from '@/components/ai-elements/suggestion'
import{ Loader} from '@/components/ai-elements/loader'
import { CodeBlock, CodeBlockCopyButton } from '@/components/ai-elements/code-block'
import { BundledLanguage } from 'shiki'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// Defensive useTheme hook - won't crash if no ThemeProvider
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

function TypingIndicator({ isSearching }: { isSearching: boolean }) {
  const [loadingText, setLoadingText] = useState('Thinking...')

  useEffect(() => {
    const texts = isSearching
      ? ['Searching...', 'Thinking...', 'Analyzing...', 'Processing...']
      : ['Thinking...', 'Analyzing...', 'Processing...']
    let index = 0
    const interval = setInterval(() => {
      setLoadingText(texts[index])
      index = (index + 1) % texts.length
    }, 1500)
    return () => clearInterval(interval)
  }, [isSearching])

  if (!isSearching) return null

  return (
    <Message from="assistant">
      <MessageContent>
        <div className="flex items-center gap-2 p-4">
          <Loader className="h-5 w-5 text-primary animate-spin" />
          <span className="text-sm font-medium text-foreground">{loadingText}...</span>
        </div>
      </MessageContent>
    </Message>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function FilePreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [preview, setPreview] = useState<string | null>(null)
  const isImage = file.type.startsWith('image/')

  useEffect(() => {
    if (isImage) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }, [file, isImage])

  return (
    <div className="relative flex items-center gap-2 rounded-xl border border-border bg-muted/50 p-3 backdrop-blur-sm">
      {isImage && preview ? (
        <img
          src={preview}
          alt={file.name}
          className="h-12 w-12 flex-shrink-0 rounded-lg object-cover border border-border"
        />
      ) : (
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
          <FileIcon className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0 overflow-hidden">
        <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
        <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-accent transition-colors"
        aria-label={`Remove ${file.name}`}
      >
        <XIcon className="h-4 w-4 text-muted-foreground hover:text-destructive" />
      </button>
    </div>
  )
}

const getBundledLanguage = (lang: string): BundledLanguage => {
  const allowed: BundledLanguage[] = ['javascript', 'typescript', 'python', 'html', 'css', 'json', 'markdown']
  return allowed.includes(lang as BundledLanguage) ? (lang as BundledLanguage) : 'text' as any
}

function CompactTokenStatus({ tokenStatus }: { tokenStatus: TokenStatus | null }) {
  const router = useRouter()
  const percentage = tokenStatus ? Math.round(tokenStatus.tokensPercentage) : 0
  const tokensRemaining = tokenStatus?.tokensRemaining ?? 0
  const tokensLimit = tokenStatus?.tokensLimit ?? 0
  const isHighUsage = percentage >= 90 && percentage < 100
  const isDepleted = tokensRemaining <= 0

  useEffect(() => {
    if (tokenStatus && isHighUsage && !isDepleted) {
      toast.warning(
        `You're using ${percentage}% of your daily tokens. ${tokensRemaining} tokens remaining.`,
        {
          id: 'high-usage-alert',
          duration: 6000,
          action: {
            label: 'View plans',
            onClick: () => router.push('/pricing'),
          },
        }
      )
    }
  }, [percentage, tokensRemaining, isHighUsage, isDepleted, router, tokenStatus])

  if (!tokenStatus) return null

  return (
    <div className="flex items-center justify-between p-3 bg-muted/50 border-b border-border">
      <div className="flex items-center gap-2">
        <Crown className="h-4 w-4 text-warning flex-shrink-0" />
        <span className="text-sm font-medium text-foreground">
          {tokensRemaining.toLocaleString()}/{tokensLimit.toLocaleString()} tokens
        </span>
      </div>
      <div className="flex items-center gap-2 w-24">
        <div className="flex-1 h-2 bg-muted rounded-full">
          <div
            className={`h-2 rounded-full transition-all ${
              isDepleted
                ? 'bg-destructive'
                : isHighUsage
                ? 'bg-warning'
                : 'bg-success'
            }`}
            style={{ width: `${Math.min(Math.max(percentage, 5), 100)}%` }}
          />
        </div>
        <span className="text-xs font-mono text-muted-foreground">{percentage}%</span>
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
  const setTheme = useTheme()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
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
      toast.error('Speech recognition is not supported. Please use Chrome.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onstart = () => {
      setIsListening(true)
    }

    recognition.onresult = (event: any) => {
      let interimTranscript = ''
      let finalTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript
        } else {
          interimTranscript += transcript
        }
      }

      if (finalTranscript) {
        setInput((prev) => prev + finalTranscript)
      }
    }

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error)
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

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
    'Summarize this text',
    'Explain this in simple terms',
    'Help me debug some code',
    'Brainstorm ideas for a project',
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
    }, 250)
    return () => clearTimeout(timeout)
  }, [input])

  useEffect(() => {
    setSuggestions(defaultSuggestions)
  }, [])

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
        parsedMessages.length
          ? (parsedMessages as ChatMessage[])
          : [{ role: 'assistant', content: chatTitle || 'Chat started.' }]
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
  }, [messages, loading])

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
        setErrorMessage('File format is not supported. Only images and PDFs are allowed.')
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
    if (!trimmed || loading) return

    const userMessage: ChatMessage = {
      role: 'user',
      content: trimmed,
    }
    if (files.length > 0) {
      userMessage.files = files.map((f) => ({
        name: f.name,
        type: f.type,
        size: f.size,
      }))
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)

    const formData = new FormData()
    formData.append('message', trimmed)
    formData.append('model', selectedModel)
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
      setLoading(false)
      setFiles([])
    }
  }

  const handlePromptSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    if (event) {
      event.preventDefault()
    }
    const text = input.trim()
    if (!text || loading) return
    await sendChatMessage(text)
  }

  const handleTextareaKeyDown = async (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const text = input.trim()
      if (text && !loading) {
        await sendChatMessage(text)
      }
    }
  }

  const showCenterPrompt =
    !hasHistory && !loading && messages.length === 0 && !input

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion)
  }

  const handleSearchClick = () => {
    setSearchEnabled((prev) => !prev)
  }

  const handleThemeToggle = (theme: string) => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  const isSearching = loading || searchEnabled

  const handleCopyAssistantMessage = async (content: string) => {
    if (!navigator.clipboard) return
    try {
      await navigator.clipboard.writeText(content)
      toast.success('Response copied!')
    } catch (err) {
      console.error('Failed to copy', err)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <CompactTokenStatus tokenStatus={tokenStatus} />
      
      <Dialog open={showTokenDepletedModal} onOpenChange={setShowTokenDepletedModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <AlertCircle className="h-8 w-8 text-destructive" />
              Daily Token Limit Reached
            </DialogTitle>
            <DialogDescription className="text-lg">
              You've used all {tokenStatus?.tokensLimit.toLocaleString() ?? 0} tokens for today. 
              Upgrade to continue chatting or wait {tokenStatus?.hoursUntilReset ?? 0} hours for reset.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-3 p-6 bg-card/80 backdrop-blur-sm">
            <Button
              variant="outline"
              onClick={() => setShowTokenDepletedModal(false)}
              className="flex-1"
            >
              Wait for Reset
            </Button>
            <Button
  onClick={() => {
    setShowTokenDepletedModal(false)
    router.push('/pricing')
  }}
  className="flex-1 h-12 px-8 font-semibold text-lg shadow-2xl border-2 border-white/20 bg-gradient-to-r from-orange-500 via-red-500 to-pink-600 hover:from-orange-400 hover:via-red-400 hover:to-pink-500 active:scale-95 transition-all duration-200 text-white !ring-4 !ring-white/30"
>
   Upgrade Now
</Button>

          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="min-h-0 flex-1">
        <ScrollArea className="h-full w-full">
          <div ref={scrollRootRef} className="h-full w-full px-3 py-4 sm:px-4 md:px-6 md:py-6">
            <div className="mx-auto flex h-full max-w-full flex-col gap-6 sm:max-w-3xl">
              {showCenterPrompt ? (
                <div className="flex flex-1 flex-col items-center justify-center text-center py-8">
                  <h1 className="mb-6 text-3xl font-bold text-foreground md:text-4xl">
                    What's on the agenda today?
                  </h1>
                  <p className="mb-8 text-lg text-muted-foreground max-w-md">
                    Choose a model and ask anything to get started.
                  </p>
                  <div className="w-full max-w-2xl">
                    <Suggestions className="flex flex-nowrap justify-center gap-3 overflow-x-auto pb-4 -mb-4 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent snap-x snap-mandatory">
  {suggestions.map((suggestion, i) => (
    <Suggestion
      key={suggestion}
      suggestion={suggestion}
      onClick={() => handleSuggestionClick(suggestion)}
      variant="outline"
      size="sm"
      className="bg-muted/80 backdrop-blur-sm text-foreground shadow-md border-border hover:shadow-lg transition-all whitespace-nowrap flex-shrink-0 snap-center h-12 px-4 py-2"
    />
  ))}
</Suggestions>

                      
                  </div>
                </div>
              ) : (
                <>
                  <Conversation className="!bg-transparent">
                    <ConversationContent className="!bg-transparent">
                      {messages.map((m, i) => (
                        <Message key={i} from={m.role} className="!bg-transparent">
                          <MessageContent className="!bg-transparent p-0">
                            {m.role === 'user' ? (
                              <div className="max-w-3xl">
                                <div className="group relative mb-6 ml-auto max-w-2xl rounded-2xl rounded-br-sm bg-muted text-foreground px-6 py-5 text-base leading-relaxed shadow-lg">
                                  <div className="prose prose-sm max-w-none dark:prose-invert">
                                    {m.content}
                                  </div>
                                  {m.files && m.files.length > 0 && (
                                    <div className="mt-4 flex flex-wrap gap-2 pt-2">
                                      {m.files.map((file, idx) => (
                                        <div key={idx} className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2 backdrop-blur-sm text-xs">
                                          {file.type.startsWith('image/') ? (
                                            <ImageIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                          ) : (
                                            <FileIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                          )}
                                          <div className="min-w-0 flex-1">
                                            <span className="truncate font-medium text-foreground">
                                              {file.name}
                                            </span>
                                          </div>
                                          <span className="text-muted-foreground">
                                            {formatFileSize(file.size)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                <div className="prose prose-lg max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-foreground">
                                  <ReactMarkdown
                                    components={{
                                      a: ({ node, children, href, ...props }) => (
                                        <a
                                          href={href}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-primary font-medium underline hover:text-primary/80 transition-colors"
                                          {...props}
                                        >
                                          {children}
                                        </a>
                                      ),
                                      code({ className, children, ...props }) {
                                        const match = /language-(\w+)/.exec(className || '')
                                        const codeText = String(children ?? '')
                                          .replace(/\n$/, '')
                                          .replace(/^\n/, '')
                                        const lang = match ? match[1] : 'text'
                                        const bundledLang = getBundledLanguage(lang)

                                        return (
                                          <div className="my-6 overflow-hidden rounded-2xl border border-border bg-muted shadow-2xl">
                                            <div className="flex items-center justify-between border-b border-border/50 bg-muted/50 px-4 py-3 backdrop-blur-md">
                                              <span className="font-mono font-semibold text-xs uppercase tracking-wider text-foreground">
                                                {lang}
                                              </span>
                                              <CodeBlockCopyButton
                                                onCopy={async () => {
                                                  if (!navigator.clipboard) return
                                                  await navigator.clipboard.writeText(codeText)
                                                }}
                                                className="h-8 w-8 rounded-xl bg-accent hover:bg-accent/80 text-foreground transition-all"
                                              />
                                            </div>
                                            <div className="max-h-[500px] overflow-auto">
                                              <CodeBlock
                                                code={codeText}
                                                language={bundledLang}
                                                showLineNumbers={true}
                                                className="px-6 py-4 text-sm leading-relaxed"
                                              />
                                            </div>
                                          </div>
                                        )
                                      },
                                      pre({ children, ...props }) {
                                        return (
                                          <div className="not-prose my-6 rounded-2xl border border-border bg-muted p-0 shadow-xl backdrop-blur-sm">
                                            {children}
                                          </div>
                                        )
                                      },
                                      p({ children, ...props }) {
                                        return (
                                          <p className="text-base leading-relaxed text-foreground mb-6" {...props}>
                                            {children}
                                          </p>
                                        )
                                      },
                                      h1({ children, ...props }) {
                                        return (
                                          <h1 className="text-3xl font-bold text-foreground mt-8 mb-4" {...props}>
                                            {children}
                                          </h1>
                                        )
                                      },
                                      h2({ children, ...props }) {
                                        return (
                                          <h2 className="text-2xl font-bold text-foreground mt-8 mb-4" {...props}>
                                            {children}
                                          </h2>
                                        )
                                      },
                                      h3({ children, ...props }) {
                                        return (
                                          <h3 className="text-xl font-bold text-foreground mt-6 mb-3" {...props}>
                                            {children}
                                          </h3>
                                        )
                                      },
                                    }}
                                  >
                                    {m.content}
                                  </ReactMarkdown>
                                </div>
                                <div className="flex justify-end pt-4">
                                  <button
                                    type="button"
                                    onClick={() => handleCopyAssistantMessage(m.content)}
                                    className="flex items-center gap-2 rounded-xl bg-muted px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:shadow-md hover:bg-accent transition-all backdrop-blur-sm border border-border"
                                    aria-label="Copy response"
                                  >
                                    <span>Copy response</span>
                                    <CopyIcon className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </MessageContent>
                        </Message>
                      ))}
                      <TypingIndicator isSearching={isSearching} />
                    </ConversationContent>
                  </Conversation>
                </>
              )}
            </div>
          </div>
<ScrollBar 
  orientation="vertical" 
  className="w-2 bg-transparent [&>div]:rounded-full [&>div]:bg-muted hover:[&>div]:bg-muted-foreground/50 transition-colors"
/>
</ScrollArea>

      </div>

      {/* Input area with increased height and visible disclaimer */}
      <div className="w-full border-t border-border bg-background/80 backdrop-blur-sm px-3 pb-6 pt-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          
          {/* Files preview */}
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {files.map((file, index) => (
                <FilePreview
                  key={index}
                  file={file}
                  onRemove={() => handleRemoveFile(index)}
                />
              ))}
            </div>
          )}
          
          {/* Error message */}
          {errorMessage && (
            <div className="rounded-lg bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive border border-destructive/20">
              {errorMessage}
            </div>
          )}

          {/* Main input form */}
          <form onSubmit={handlePromptSubmit} className="flex w-full flex-col gap-3">
            
            {/* Input container - increased padding for better visibility */}
            <div className="flex w-full flex-col rounded-2xl border bg-card shadow-lg hover:shadow-xl backdrop-blur-md transition-all border-border hover:border-border/70 p-6">
              
              {/* Textarea container - more vertical space */}
              <div className="px-2 pb-3 pt-1">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.currentTarget.value)}
                  onKeyDown={handleTextareaKeyDown}
                  placeholder="What would you like to know?"
                  rows={1}
                  disabled={loading}
                  className="w-full resize-none border-none bg-transparent p-0 text-base font-normal placeholder:text-muted-foreground focus:outline-none focus:ring-0 min-h-[52px] max-h-[160px] text-foreground leading-relaxed"
                />
              </div>

              {/* Hidden file input */}
              <input
                type="file"
                multiple
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/*,.pdf"
              />

              {/* Action buttons */}
              <div className="flex items-center justify-between px-1 pb-1 pt-2 gap-1.5">
                <div className="flex items-center gap-1.5">
                  
                  {/* File upload */}
                  <PromptInputButton
                    size="icon-sm"
                    aria-label="Upload file"
                    type="button"
                    onClick={handleFileUploadClick}
                    disabled={loading}
                    className="h-11 w-11 rounded-xl transition-all shadow-sm border bg-muted hover:bg-accent hover:shadow-md border-border"
                  >
                    {loading ? (
                      <div>
                        <PlusIcon className="h-4 w-4 text-foreground" />
                      </div>
                    ) : (
                      <PlusIcon className="h-4 w-4 text-foreground" />
                    )}
                  </PromptInputButton>

                  {/* Voice input */}
                  <PromptInputButton
                    size="icon-sm"
                    aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
                    type="button"
                    onClick={toggleVoiceInput}
                    disabled={!speechSupported || loading}
                    className="h-11 w-11 rounded-xl transition-all shadow-sm border border-border backdrop-blur-sm
                      isListening:bg-destructive isListening:text-destructive-foreground isListening:hover:bg-destructive/90 isListening:shadow-lg isListening:animate-pulse
                      loading:opacity-50 loading:cursor-not-allowed bg-muted hover:bg-accent
                      !speechSupported:opacity-50 !speechSupported:cursor-not-allowed"
                  >
                    {isListening ? (
                      <MicOffIcon className="h-4 w-4" />
                    ) : (
                      <MicIcon className="h-4 w-4 text-foreground" />
                    )}
                  </PromptInputButton>

                  {/* Search toggle */}
                  <PromptInputButton
                    size="sm"
                    type="button"
                    onClick={handleSearchClick}
                    aria-pressed={searchEnabled}
                    disabled={loading}
                    className="h-11 rounded-xl px-3 text-xs font-medium shadow-sm border border-border backdrop-blur-sm transition-all
                      searchEnabled:bg-primary searchEnabled:text-primary-foreground searchEnabled:hover:bg-primary/90 searchEnabled:shadow-lg
                      loading:opacity-50 loading:cursor-not-allowed bg-muted hover:bg-accent text-foreground"
                  >
                    <Globe2 className="mr-1.5 h-3.5 w-3.5 searchEnabled:text-primary-foreground text-foreground" />
                    <span>{searchEnabled ? 'Search On' : 'Search'}</span>
                  </PromptInputButton>

                  {/* Model selector */}
                  <PromptInputSelect
                    value={selectedModel}
                    onValueChange={setSelectedModel}
                    disabled={loading}
                  >
                    <PromptInputSelectTrigger className="h-11 w-28 rounded-xl bg-muted px-2 text-xs font-medium shadow-sm hover:bg-accent border-border hover:border-border/70">
                      <Globe2 className="mr-1 h-3 w-3 text-foreground" />
                      <PromptInputSelectValue />
                    </PromptInputSelectTrigger>
                    <PromptInputSelectContent>
                      {PROMPTMODELOPTIONS.map((m) => (
                        <PromptInputSelectItem key={m.id} value={m.id}>
                          {m.name}
                        </PromptInputSelectItem>
                      ))}
                    </PromptInputSelectContent>
                  </PromptInputSelect>
                </div>

                {/* Send button */}
                <PromptInputSubmit
                  variant="secondary"
                  size="icon-sm"
                  disabled={loading || !input.trim()}
                  className="h-11 w-11 flex items-center justify-center rounded-xl transition-all bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg hover:shadow-xl border border-primary/50"
                  aria-label="Send message"
                >
                  {loading ? (
                    <Loader className="h-4 w-4 animate-spin" />
                  ) : (
                    <CornerDownLeftIcon className="h-4 w-4" />
                  )}
                </PromptInputSubmit>
              </div>
            </div>
          </form>

          {/* Disclaimer - now always visible with better styling */}
          <div className="flex justify-center">
            <p className="text-center text-xs font-medium px-4 py-2 leading-relaxed text-muted-foreground bg-muted/50 rounded-xl backdrop-blur-sm border border-border/30 max-w-2xl mx-auto">
              QueryMate AI can make mistakes. Consider checking important information.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}