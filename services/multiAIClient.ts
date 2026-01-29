
export interface AIClientOptions {
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export type AIProvider = 'openai' | 'anthropic' | 'google';

export class MultiAIClient {
  private keys: Record<AIProvider, string> = {
    openai: '',
    anthropic: '',
    google: ''
  };

  setKey(provider: AIProvider, key: string) {
    this.keys[provider] = key;
  }

  private parseModel(value: string) {
    const [provider, model] = value.split(':');
    return { provider: provider as AIProvider, model };
  }

  // ==================== TEXT GENERATION ====================

  async generateText(modelValue: string, prompt: string, options: AIClientOptions = {}) {
    const { provider, model } = this.parseModel(modelValue);
    if (!this.keys[provider]) throw new Error(`Missing ${provider} API key`);

    switch (provider) {
      case 'openai': return this._openaiText(model, prompt, options);
      case 'anthropic': return this._anthropicText(model, prompt, options);
      case 'google': return this._googleText(model, prompt, options);
      default: throw new Error(`Unknown provider: ${provider}`);
    }
  }

  private async _openaiText(model: string, prompt: string, options: AIClientOptions) {
    const { systemPrompt, maxTokens = 4096, temperature = 0.7 } = options;
    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.keys.openai}`
      },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature })
    });

    if (!res.ok) throw new Error((await res.json()).error?.message || 'OpenAI error');
    const data = await res.json();
    return data.choices[0].message.content;
  }

  private async _anthropicText(model: string, prompt: string, options: AIClientOptions) {
    const { systemPrompt, maxTokens = 4096 } = options;
    const body: any = {
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    };
    if (systemPrompt) body.system = systemPrompt;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.keys.anthropic,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error((await res.json()).error?.message || 'Anthropic error');
    const data = await res.json();
    return data.content[0].text;
  }

  private async _googleText(model: string, prompt: string, options: AIClientOptions) {
    const { systemPrompt, maxTokens = 4096, temperature = 0.7 } = options;
    const body: any = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature }
    };
    if (systemPrompt) body.systemInstruction = { parts: [{ text: systemPrompt }] };

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.keys.google}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );

    if (!res.ok) throw new Error((await res.json()).error?.message || 'Google error');
    const data = await res.json();
    return data.candidates[0].content.parts[0].text;
  }

  // ==================== IMAGE ANALYSIS (VISION) ====================

  async analyzeImages(modelValue: string, prompt: string, imageBase64s: string[], mimeTypes: string[] = [], options: AIClientOptions = {}) {
    const { provider, model } = this.parseModel(modelValue);
    if (!this.keys[provider]) throw new Error(`Missing ${provider} API key`);

    switch (provider) {
      case 'openai': return this._openaiVision(model, prompt, imageBase64s, mimeTypes, options);
      case 'anthropic': return this._anthropicVision(model, prompt, imageBase64s, mimeTypes, options);
      case 'google': return this._googleVision(model, prompt, imageBase64s, mimeTypes, options);
      default: throw new Error(`Unknown provider: ${provider}`);
    }
  }

  private async _openaiVision(model: string, prompt: string, imageBase64s: string[], mimeTypes: string[], options: AIClientOptions) {
    const { systemPrompt, maxTokens = 4096, temperature = 0.7 } = options;
    const messages: any[] = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });

    const content: any[] = [{ type: 'text', text: prompt }];
    imageBase64s.forEach((base64, i) => {
      const mimeType = mimeTypes[i] || 'image/png';
      content.push({
        type: 'image_url',
        image_url: { url: `data:${mimeType};base64,${base64}` }
      });
    });
    messages.push({ role: 'user', content });

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.keys.openai}`
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature
      })
    });

    if (!res.ok) throw new Error((await res.json()).error?.message || 'OpenAI error');
    const data = await res.json();
    return data.choices[0].message.content;
  }

  private async _anthropicVision(model: string, prompt: string, imageBase64s: string[], mimeTypes: string[], options: AIClientOptions) {
    const { systemPrompt, maxTokens = 4096 } = options;
    const content: any[] = [];
    imageBase64s.forEach((base64, i) => {
      const mimeType = mimeTypes[i] || 'image/png';
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: mimeType, data: base64 }
      });
    });
    content.push({ type: 'text', text: prompt });

    const body: any = {
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content }]
    };
    if (systemPrompt) body.system = systemPrompt;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.keys.anthropic,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error((await res.json()).error?.message || 'Anthropic error');
    const data = await res.json();
    return data.content[0].text;
  }

  private async _googleVision(model: string, prompt: string, imageBase64s: string[], mimeTypes: string[], options: AIClientOptions) {
    const { systemPrompt, maxTokens = 4096, temperature = 0.7 } = options;
    const parts: any[] = imageBase64s.map((base64, i) => ({
      inlineData: { mimeType: mimeTypes[i] || 'image/png', data: base64 }
    }));
    parts.push({ text: prompt });

    const body: any = {
      contents: [{ role: 'user', parts }],
      generationConfig: { maxOutputTokens: maxTokens, temperature }
    };
    if (systemPrompt) body.systemInstruction = { parts: [{ text: systemPrompt }] };

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.keys.google}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );

    if (!res.ok) throw new Error((await res.json()).error?.message || 'Google error');
    const data = await res.json();
    return data.candidates[0].content.parts[0].text;
  }

  // ==================== VERIFICATION ====================

  async verifyKey(provider: AIProvider): Promise<boolean> {
    if (!this.keys[provider]) return false;

    try {
      switch (provider) {
        case 'openai':
          const openaiRes = await fetch('https://api.openai.com/v1/models', {
            headers: { 'Authorization': `Bearer ${this.keys.openai}` }
          });
          return openaiRes.ok;
        case 'anthropic':
          // Anthropic doesn't have a specific lightweight check, so we send a minimal message
          const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': this.keys.anthropic,
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
              model: 'claude-3-haiku-20240307',
              max_tokens: 1,
              messages: [{ role: 'user', content: 'Hi' }]
            })
          });
          return anthropicRes.ok;
        case 'google':
          const googleRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${this.keys.google}`
          );
          return googleRes.ok;
        default:
          return false;
      }
    } catch (e) {
      console.error(`Verification failed for ${provider}:`, e);
      return false;
    }
  }
}
