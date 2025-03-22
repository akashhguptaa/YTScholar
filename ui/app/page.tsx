"use client"

import { MessageCircle, Youtube, Fish, X } from "lucide-react"
import { useState, useRef, useEffect } from "react"
import type React from "react"

// Type definitions
interface CachedItem {
  content: string
  timestamp: number
}

interface CachedData {
  transcripts: Record<string, CachedItem>
  summaries: Record<string, CachedItem>
}

interface ChatMessage {
  type: "user" | "ai"
  content: string
}

interface WebSocketResponse {
  status?: string
  type?: string
  message?: string
  transcript?: string
  summary?: string
}

interface MessageData {
  type: string
  message: string
  context: string
}

const cn = (...classes: string[]): string => {
  return classes.filter(Boolean).join(" ")
}

const CACHE_KEYS = {
  TRANSCRIPTS: "youwin_transcripts",
  SUMMARIES: "youwin_summaries",
  CURRENT_URL: "youwin_current_url",
}

export default function Home(): React.ReactElement {
  const [url, setUrl] = useState<string>("")
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [transcript, setTranscript] = useState<string>("")
  const [summary, setSummary] = useState<string>("")
  const [error, setError] = useState<string>("")
  const [isConnected, setIsConnected] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<string>("transcript")
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [currentMessage, setCurrentMessage] = useState<string>("")
  const [isChatReady, setIsChatReady] = useState<boolean>(false)

  const webSocketRef = useRef<WebSocket | null>(null)
  const chatEndRef = useRef<HTMLDivElement | null>(null)

  const [cachedData, setCachedData] = useState<CachedData>({
    transcripts: {},
    summaries: {},
  })

  // Load cached data on initial render
  useEffect(() => {
    try {
      const storedTranscripts = localStorage.getItem(CACHE_KEYS.TRANSCRIPTS)
      const storedSummaries = localStorage.getItem(CACHE_KEYS.SUMMARIES)

      if (storedTranscripts) {
        setCachedData((prev) => ({
          ...prev,
          transcripts: JSON.parse(storedTranscripts),
        }))
      }

      if (storedSummaries) {
        setCachedData((prev) => ({
          ...prev,
          summaries: JSON.parse(storedSummaries),
        }))
      }

      const storedUrl = localStorage.getItem(CACHE_KEYS.CURRENT_URL)
      if (storedUrl) {
        setUrl(storedUrl)

        // Optionally auto-load the transcript and summary for the stored URL
        const cachedTranscript = storedTranscripts ? JSON.parse(storedTranscripts)[storedUrl] : null
        const cachedSummary = storedSummaries ? JSON.parse(storedSummaries)[storedUrl] : null

        if (cachedTranscript) {
          setTranscript(cachedTranscript.content)
          setError("")
        }

        if (cachedSummary) {
          setSummary(cachedSummary.content)
          setIsChatReady(true)
        }
      }
    } catch (error) {
      console.error("Error loading cached data:", error)
    }
  }, [])

  // Save to cache whenever data changes
  useEffect(() => {
    try {
      if (Object.keys(cachedData.transcripts).length > 0) {
        localStorage.setItem(CACHE_KEYS.TRANSCRIPTS, JSON.stringify(cachedData.transcripts))
      }

      if (Object.keys(cachedData.summaries).length > 0) {
        localStorage.setItem(CACHE_KEYS.SUMMARIES, JSON.stringify(cachedData.summaries))
      }
    } catch (error) {
      console.error("Error saving to cache:", error)
    }
  }, [cachedData])

  // Save current URL to local storage whenever it changes
  useEffect(() => {
    if (url) {
      localStorage.setItem(CACHE_KEYS.CURRENT_URL, url)
    }
  }, [url])

  // Scroll to bottom of chat when messages change
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [chatMessages])

  const establishConnection = (): WebSocket => {
    // Close any existing connection first
    if (webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN) {
      webSocketRef.current.close(1000, "New connection initiated")
    }

    const ws = new WebSocket("wss://b0d4-182-75-25-162.ngrok-free.app/ws")

    ws.onopen = () => {
      console.log("WebSocket connection established")
      setIsConnected(true)

      // After connection is established, send the URL
      if (url) {
        ws.send(url)
      }
    }

    ws.onmessage = (event: MessageEvent) => {
      try {
        const response: WebSocketResponse = JSON.parse(event.data)

        if (response.status === "connected") {
          console.log("Connection confirmed by server")
          return
        }

        if (response.type === "chat_response") {
          // Handle chat response
          if (response.message) {
            setChatMessages((prev) => [...prev, { type: "ai", content: response.message ?? "" }]);
          }
          return
        }

        setIsProcessing(false)

        if (response.status === "success") {
          if (response.transcript) {
            setTranscript(response.transcript)
            setError("")

            // Cache the transcript
            setCachedData((prev: CachedData) => ({
              ...prev,
              transcripts: {
                ...prev.transcripts,
                [url]: {
                  content: response.transcript || "",
                  timestamp: Date.now(),
                },
              },
            }))
          }

          // Handle summary if provided
          if (response.summary) {
            setSummary(response.summary)
            setIsChatReady(true)

            // Cache the summary
            setCachedData((prev: CachedData) => ({
              ...prev,
              summaries: {
                ...prev.summaries,
                [url]: {
                  content: response.summary || "",
                  timestamp: Date.now(),
                },
              },
            }))
          }
        } else if (response.status === "error") {
          if (response.message) {
            setError(response.message)
          } else {
            setError("An unknown error occurred")
          }
          setTranscript("")
          setSummary("")
        }
      } catch (err) {
        console.error("Error parsing WebSocket message:", err)
        setError("Error processing server response")
        setIsProcessing(false)
      }
    }

    ws.onclose = (event: CloseEvent) => {
      console.log("WebSocket connection closed", event.code, event.reason)
      setIsConnected(false)
    }

    ws.onerror = (error: Event) => {
      console.error("WebSocket error:", error)
      setError("WebSocket connection error. Please try again later.")
      setIsProcessing(false)
      setIsConnected(false)
    }

    webSocketRef.current = ws
    return ws
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    // Reset error state
    setError("")

    // Check if URL is provided
    if (!url.trim()) {
      setError("Please enter a YouTube URL")
      return
    }

    // Check if we have cached results for this URL
    const hasCachedTranscript = cachedData.transcripts[url]
    const hasCachedSummary = cachedData.summaries[url]

    if (hasCachedTranscript && hasCachedSummary) {
      console.log("Using cached data for", url)
      setTranscript(cachedData.transcripts[url].content)
      setSummary(cachedData.summaries[url].content)
      setIsChatReady(true)
      return
    }

    // If not cached, proceed with WebSocket connection
    setIsProcessing(true)
    setTranscript("")
    setSummary("")
    setIsChatReady(false)

    // Establish a new connection for this request
    const ws = establishConnection()

    // Make sure the connection is open before sending the URL
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(url)
    }
    // If not open yet, the URL will be sent in the onopen handler
  }

  const clearCache = (): void => {
    try {
      localStorage.removeItem(CACHE_KEYS.TRANSCRIPTS)
      localStorage.removeItem(CACHE_KEYS.SUMMARIES)
      setCachedData({
        transcripts: {},
        summaries: {},
      })
      setTranscript("")
      setSummary("")
      setError("")
      setIsChatReady(false)
    } catch (error) {
      console.error("Error clearing cache:", error)
      setError("Failed to clear cache")
    }
  }

  const sendChatMessage = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault()

    if (!currentMessage.trim()) return

    // Add user message to chat
    setChatMessages((prev) => [...prev, { type: "user", content: currentMessage }])

    // Prepare to send message to backend
    const messageData: MessageData = {
      type: "chat",
      message: currentMessage,
      context: transcript, // Include the transcript as context
    }

    // Clear input
    setCurrentMessage("")

    // Send to backend
    // Make sure a connection exists
    let ws = webSocketRef.current

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      ws = establishConnection()
      // Need to wait for connection to open before sending
      ws.onopen = () => {
        ws?.send(JSON.stringify(messageData))
      }
    } else {
      // Connection already open, send immediately
      ws.send(JSON.stringify(messageData))
    }
  }

  return (
    <main className="min-h-screen bg-[#020817] text-white overflow-x-hidden">
      {/* Background Elements */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[url('/placeholder.svg?height=1080&width=1920')] bg-cover bg-center opacity-20"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#020817]/50 to-[#020817]"></div>
      </div>

      {/* Floating Bubbles */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-20 left-1/4 w-32 h-32 bg-blue-500/20 rounded-full blur-xl animate-pulse"></div>
        <div className="absolute top-40 right-1/3 w-24 h-24 bg-blue-400/20 rounded-full blur-xl animate-pulse delay-700"></div>
        <div className="absolute bottom-32 left-1/3 w-40 h-40 bg-blue-600/20 rounded-full blur-xl animate-pulse delay-1000"></div>
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Navigation */}
        <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-lg bg-[#020817]/80 border-b border-blue-500/20">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Fish className="w-8 h-8 md:w-10 md:h-10 text-blue-400" />
                <span className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-blue-600">
                  youWIN
                </span>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm text-blue-400">
                  {isConnected ? (
                    <span className="flex items-center">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                      Connected
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                      Disconnected
                    </span>
                  )}
                </div>
                {(Object.keys(cachedData.transcripts).length > 0 || Object.keys(cachedData.summaries).length > 0) && (
                  <button onClick={clearCache} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                    Clear Cache
                  </button>
                )}
              </div>
            </div>
          </div>
        </nav>

        <div className="container mx-auto px-4 pt-28 pb-20 min-h-screen flex flex-col">
          {/* Hero Section */}
          <div className="text-center mb-12 md:mb-20">
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-blue-600 leading-tight">
              Transform Videos into Insights
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl text-blue-200/80 max-w-3xl mx-auto px-4">
              Unlock the power of AI to convert YouTube videos into detailed transcriptions and summaries.
            </p>
          </div>

          {/* URL Input Section */}
          <div className="w-full max-w-3xl mx-auto mb-12 md:mb-20 px-4">
            <div className="backdrop-blur-xl bg-white/5 p-6 md:p-8 rounded-2xl border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.2)] hover:shadow-[0_0_25px_rgba(59,130,246,0.3)] transition-shadow duration-300">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-center gap-4 p-3 bg-white/5 rounded-lg border border-blue-500/20">
                  <Youtube className="text-blue-400 min-w-[24px]" size={24} />
                  <input
                    type="text"
                    value={url}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
                    placeholder="Paste your YouTube URL here..."
                    className="w-full bg-transparent border-none focus:outline-none text-white placeholder-blue-200/50"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className={cn(
                    "w-full py-3 px-6 rounded-lg text-white font-medium transition-all duration-300",
                    "bg-gradient-to-r from-blue-600 to-blue-400 hover:from-blue-500 hover:to-blue-300",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:shadow-[0_0_25px_rgba(59,130,246,0.4)]",
                  )}
                >
                  {isProcessing
                    ? "Processing..."
                    : cachedData.transcripts[url] && cachedData.summaries[url]
                      ? "Load Cached Data"
                      : "Process Video"}
                </button>
                {(cachedData.transcripts[url] || cachedData.summaries[url]) && (
                  <p className="text-xs text-blue-400 text-center">
                    Cached{" "}
                    {new Date(
                      cachedData.transcripts[url]?.timestamp || cachedData.summaries[url]?.timestamp || 0,
                    ).toLocaleString()}
                  </p>
                )}
              </form>
            </div>
          </div>

          {/* Transcript/Summary Result Section */}
          {(transcript || summary || error) && (
            <div className="w-full max-w-4xl mx-auto mb-12 md:mb-20 px-4">
              <div className="backdrop-blur-xl bg-white/5 p-6 md:p-8 rounded-2xl border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                {error ? (
                  <div>
                    <h2 className="text-2xl font-bold text-red-400 mb-4">Error</h2>
                    <div className="text-red-400">{error}</div>
                  </div>
                ) : (
                  <>
                    {/* Tabs */}
                    <div className="flex border-b border-blue-500/20 mb-6">
                      <button
                        className={cn(
                          "py-2 px-4 font-medium -mb-px",
                          activeTab === "transcript"
                            ? "border-b-2 border-blue-400 text-blue-400"
                            : "text-blue-200/60 hover:text-blue-200",
                        )}
                        onClick={() => setActiveTab("transcript")}
                      >
                        Transcript
                      </button>
                      <button
                        className={cn(
                          "py-2 px-4 font-medium -mb-px",
                          activeTab === "summary"
                            ? "border-b-2 border-blue-400 text-blue-400"
                            : "text-blue-200/60 hover:text-blue-200",
                        )}
                        onClick={() => setActiveTab("summary")}
                      >
                        Summary
                      </button>
                    </div>

                    {/* Tab Content */}
                    <div className="min-h-[200px]">
                      {activeTab === "transcript" && (
                        <div className="max-h-96 overflow-y-auto text-blue-100 whitespace-pre-line">{transcript}</div>
                      )}

                      {activeTab === "summary" && (
                        <div className="max-h-96 overflow-y-auto text-blue-100">
                          {summary ? (
                            <div className="whitespace-pre-line">{summary}</div>
                          ) : (
                            <div className="flex items-center justify-center h-32 text-blue-300/60">
                              {isProcessing ? "Generating summary..." : "Summary not available yet"}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Features Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-8 max-w-6xl mx-auto px-4">
            {[
              {
                title: "Accurate Transcription",
                description: "Get precise word-by-word transcription of your videos",
                gradient: "from-blue-400 to-blue-600",
              },
              {
                title: "Smart Summaries",
                description: "AI-powered summaries that capture key insights",
                gradient: "from-blue-500 to-blue-700",
              },
              {
                title: "Interactive Chat",
                description: "Chat with an AI that understands your video content",
                gradient: "from-blue-600 to-blue-800",
              },
            ].map((feature, index) => (
              <div
                key={index}
                className="backdrop-blur-xl bg-white/5 p-6 rounded-xl border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)] hover:shadow-[0_0_25px_rgba(59,130,246,0.2)] transition-shadow duration-300"
              >
                <div className={`h-1 w-20 mb-4 rounded bg-gradient-to-r ${feature.gradient}`}></div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-blue-200/80">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Chat Button */}
        <button
          className={cn(
            "fixed bottom-6 right-6 md:bottom-8 md:right-8 p-4 rounded-full",
            "shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:shadow-[0_0_25px_rgba(59,130,246,0.4)]",
            "transition-all duration-300",
            isChatReady
              ? "bg-gradient-to-r from-green-600 to-green-400"
              : "bg-gradient-to-r from-blue-600 to-blue-400 opacity-70",
          )}
          onClick={() => isChatReady && setIsChatOpen(true)}
          disabled={!isChatReady}
        >
          <MessageCircle className="text-white w-6 h-6 md:w-7 md:h-7" />
        </button>

        {/* Chat Window */}
        {isChatOpen && (
          <div className="fixed bottom-0 right-0 md:bottom-6 md:right-6 w-full md:w-96 h-96 z-50">
            <div className="backdrop-blur-xl bg-[#020817]/95 border border-blue-500/30 rounded-t-xl md:rounded-xl shadow-[0_0_30px_rgba(59,130,246,0.3)] flex flex-col h-full">
              {/* Chat Header */}
              <div className="flex items-center justify-between p-4 border-b border-blue-500/20">
                <h3 className="font-medium text-blue-300">Chat about this video</h3>
                <button onClick={() => setIsChatOpen(false)} className="text-blue-400 hover:text-blue-300">
                  <X size={18} />
                </button>
              </div>

              {/* Chat Messages */}
              <div className="flex-grow overflow-y-auto p-4 space-y-4">
                {/* Welcome Message */}
                {chatMessages.length === 0 && (
                  <div className="bg-blue-500/10 p-3 rounded-lg text-blue-200 text-sm">
                    Ask me anything about the video content!
                  </div>
                )}
                {/* Message Bubbles */}
                {chatMessages.map((msg, index) => (
                  <div
                    key={index}
                    className={cn(
                      "max-w-[85%] p-3 rounded-lg",
                      msg.type === "user" ? "bg-blue-600/30 ml-auto" : "bg-blue-500/10 mr-auto",
                    )}
                  >
                    {msg.content}
                  </div>
                ))}
                <div ref={chatEndRef} /> {/* Scroll anchor */}
              </div>

              {/* Chat Input */}
              <form onSubmit={sendChatMessage} className="p-4 border-t border-blue-500/20">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={currentMessage}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrentMessage(e.target.value)}
                    placeholder="Ask about the video..."
                    className="flex-grow bg-blue-900/20 border border-blue-500/30 rounded-lg px-4 py-2 text-white placeholder-blue-300/50 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-500 rounded-lg px-4 py-2 text-white transition-colors"
                  >
                    Send
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}