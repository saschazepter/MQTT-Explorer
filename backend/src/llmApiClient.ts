/**
 * LLM API Client for direct API calls
 * This module can be used in tests without requiring browser/RPC infrastructure
 */

import axios from 'axios'

export type LLMProvider = 'openai' | 'gemini'

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMApiConfig {
  provider?: LLMProvider
  apiKey: string
  model?: string
  maxTokens?: number
}

export interface LLMApiResponse {
  content: string
  provider: string
  model: string
  usage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
}

/**
 * Direct LLM API client for testing
 * Makes HTTP calls directly to LLM providers without going through backend
 */
export class LLMApiClient {
  private provider: LLMProvider
  private apiKey: string
  private model: string
  private maxTokens: number

  constructor(config: LLMApiConfig) {
    this.provider = config.provider || this.detectProvider(config.apiKey)
    this.apiKey = config.apiKey
    this.model = config.model || this.getDefaultModel(this.provider)
    this.maxTokens = config.maxTokens || 1000
  }

  private detectProvider(apiKey: string): LLMProvider {
    if (apiKey.startsWith('sk-')) {
      return 'openai'
    }
    return 'gemini'
  }

  private getDefaultModel(provider: LLMProvider): string {
    return provider === 'openai' ? 'gpt-5-mini' : 'gemini-1.5-flash-latest'
  }

  /**
   * Send messages to LLM and get response
   */
  async chat(messages: LLMMessage[]): Promise<LLMApiResponse> {
    if (this.provider === 'openai') {
      return this.chatOpenAI(messages)
    } else {
      return this.chatGemini(messages)
    }
  }

  private async chatOpenAI(messages: LLMMessage[]): Promise<LLMApiResponse> {
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: this.model,
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          max_completion_tokens: this.maxTokens,
          reasoning_effort: 'minimal',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          timeout: 45000, // 45 second timeout for reasoning models
        }
      )

      const choice = response.data.choices?.[0]
      if (!choice) {
        throw new Error('No response from OpenAI')
      }

      return {
        content: choice.message.content || '',
        provider: 'openai',
        model: response.data.model,
        usage: {
          promptTokens: response.data.usage?.prompt_tokens,
          completionTokens: response.data.usage?.completion_tokens,
          totalTokens: response.data.usage?.total_tokens,
        },
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || error.message || 'Unknown error'
      throw new Error(`OpenAI API error: ${errorMessage}`)
    }
  }

  private async chatGemini(messages: LLMMessage[]): Promise<LLMApiResponse> {
    try {
      // Convert messages to Gemini format
      const contents = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }))

      // Add system message to first user message if present
      const systemMessage = messages.find(m => m.role === 'system')
      if (systemMessage && contents.length > 0) {
        contents[0].parts[0].text = `${systemMessage.content}\n\n${contents[0].parts[0].text}`
      }

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          contents,
          generationConfig: {
            maxOutputTokens: this.maxTokens,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 45000,
        }
      )

      const candidate = response.data.candidates?.[0]
      if (!candidate) {
        throw new Error('No response from Gemini')
      }

      return {
        content: candidate.content.parts[0].text || '',
        provider: 'gemini',
        model: this.model,
        usage: {
          promptTokens: response.data.usageMetadata?.promptTokenCount,
          completionTokens: response.data.usageMetadata?.candidatesTokenCount,
          totalTokens: response.data.usageMetadata?.totalTokenCount,
        },
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || error.message || 'Unknown error'
      throw new Error(`Gemini API error: ${errorMessage}`)
    }
  }

  /**
   * Simple helper to send a single message with optional system prompt
   */
  async sendMessage(userMessage: string, systemPrompt?: string): Promise<string> {
    const messages: LLMMessage[] = []
    
    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt,
      })
    }
    
    messages.push({
      role: 'user',
      content: userMessage,
    })

    const response = await this.chat(messages)
    return response.content
  }
}

/**
 * Factory function to create LLM client from environment variables
 */
export function createLLMClientFromEnv(): LLMApiClient {
  const apiKey = process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.LLM_API_KEY
  
  if (!apiKey) {
    throw new Error('No LLM API key found in environment')
  }

  const provider = (process.env.LLM_PROVIDER as LLMProvider) || undefined

  return new LLMApiClient({
    apiKey,
    provider,
  })
}
