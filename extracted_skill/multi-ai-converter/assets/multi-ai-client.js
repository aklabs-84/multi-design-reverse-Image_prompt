/**
 * Multi-AI Client Library
 * Unified interface for OpenAI, Anthropic, and Google AI APIs
 * Version: 1.0.0 (January 2026)
 */

class MultiAIClient {
  constructor() {
    this.keys = { openai: '', anthropic: '', google: '' };
  }

  setKey(provider, key) {
    this.keys[provider] = key;
  }

  setKeysFromDOM() {
    this.keys.openai = document.getElementById('openai-key')?.value || '';
    this.keys.anthropic = document.getElementById('anthropic-key')?.value || '';
    this.keys.google = document.getElementById('google-key')?.value || '';
  }

  parseModel(value) {
    const [provider, model] = value.split(':');
    return { provider, model };
  }

  // ==================== TEXT GENERATION ====================

  async generateText(modelValue, prompt, options = {}) {
    const { provider, model } = this.parseModel(modelValue);
    if (!this.keys[provider]) throw new Error(`Missing ${provider} API key`);

    switch (provider) {
      case 'openai': return this._openaiText(model, prompt, options);
      case 'anthropic': return this._anthropicText(model, prompt, options);
      case 'google': return this._googleText(model, prompt, options);
      default: throw new Error(`Unknown provider: ${provider}`);
    }
  }

  async _openaiText(model, prompt, options) {
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
    return (await res.json()).choices[0].message.content;
  }

  async _anthropicText(model, prompt, options) {
    const { systemPrompt, maxTokens = 4096 } = options;
    const body = {
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
    return (await res.json()).content[0].text;
  }

  async _googleText(model, prompt, options) {
    const { systemPrompt, maxTokens = 4096, temperature = 0.7 } = options;
    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature }
    };
    if (systemPrompt) body.systemInstruction = { parts: [{ text: systemPrompt }] };

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.keys.google}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );

    if (!res.ok) throw new Error((await res.json()).error?.message || 'Google error');
    return (await res.json()).candidates[0].content.parts[0].text;
  }

  // ==================== IMAGE ANALYSIS (VISION) ====================

  async analyzeImage(modelValue, prompt, imageBase64, mimeType = 'image/png') {
    const { provider, model } = this.parseModel(modelValue);
    if (!this.keys[provider]) throw new Error(`Missing ${provider} API key`);

    switch (provider) {
      case 'openai': return this._openaiVision(model, prompt, imageBase64, mimeType);
      case 'anthropic': return this._anthropicVision(model, prompt, imageBase64, mimeType);
      case 'google': return this._googleVision(model, prompt, imageBase64, mimeType);
      default: throw new Error(`Unknown provider: ${provider}`);
    }
  }

  async _openaiVision(model, prompt, imageBase64, mimeType) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.keys.openai}`
      },
      body: JSON.stringify({
        model,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } }
          ]
        }],
        max_tokens: 4096
      })
    });
    return (await res.json()).choices[0].message.content;
  }

  async _anthropicVision(model, prompt, imageBase64, mimeType) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.keys.anthropic,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64 } },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });
    return (await res.json()).content[0].text;
  }

  async _googleVision(model, prompt, imageBase64, mimeType) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.keys.google}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [
              { inlineData: { mimeType, data: imageBase64 } },
              { text: prompt }
            ]
          }]
        })
      }
    );
    return (await res.json()).candidates[0].content.parts[0].text;
  }

  // ==================== IMAGE GENERATION ====================

  async generateImage(provider, prompt, options = {}) {
    if (!this.keys[provider]) throw new Error(`Missing ${provider} API key`);

    switch (provider) {
      case 'openai': return this._openaiImageGen(prompt, options);
      case 'google': return this._googleImageGen(prompt, options);
      case 'anthropic': throw new Error('Anthropic does not support image generation');
      default: throw new Error(`Unknown provider: ${provider}`);
    }
  }

  async _openaiImageGen(prompt, options) {
    const { size = '1024x1024', quality = 'standard' } = options;
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.keys.openai}`
      },
      body: JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size, quality })
    });
    return (await res.json()).data[0].url;
  }

  async _googleImageGen(prompt, options) {
    const { aspectRatio = '1:1' } = options;
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-3:generateImages?key=${this.keys.google}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, config: { numberOfImages: 1, aspectRatio } })
      }
    );
    return (await res.json()).images[0].base64;
  }
}

// ==================== UI COMPONENTS ====================

function createAPIKeyInputs() {
  return `
    <div class="api-keys" style="display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem;">
      <div class="key-group" style="flex: 1; min-width: 200px;">
        <label style="display: block; margin-bottom: 0.25rem; font-weight: 500;">OpenAI API Key</label>
        <input type="password" id="openai-key" placeholder="sk-..." 
               style="width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;">
      </div>
      <div class="key-group" style="flex: 1; min-width: 200px;">
        <label style="display: block; margin-bottom: 0.25rem; font-weight: 500;">Anthropic API Key</label>
        <input type="password" id="anthropic-key" placeholder="sk-ant-..." 
               style="width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;">
      </div>
      <div class="key-group" style="flex: 1; min-width: 200px;">
        <label style="display: block; margin-bottom: 0.25rem; font-weight: 500;">Google AI API Key</label>
        <input type="password" id="google-key" placeholder="AIza..." 
               style="width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;">
      </div>
    </div>
  `;
}

function createModelSelector(defaultModel = 'anthropic:claude-sonnet-4-5-20250929') {
  return `
    <div class="model-selector" style="margin-bottom: 1rem;">
      <label style="display: block; margin-bottom: 0.25rem; font-weight: 500;">Select AI Model</label>
      <select id="model-selector" style="width: 100%; max-width: 400px; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;">
        <optgroup label="🔷 OpenAI - High Performance">
          <option value="openai:gpt-5.2">GPT-5.2 (Latest Flagship)</option>
          <option value="openai:gpt-5.2-codex">GPT-5.2 Codex (Coding)</option>
        </optgroup>
        <optgroup label="🔷 OpenAI - Balanced">
          <option value="openai:gpt-5.1">GPT-5.1</option>
          <option value="openai:gpt-5">GPT-5</option>
        </optgroup>
        <optgroup label="🟠 Anthropic - High Performance">
          <option value="anthropic:claude-opus-4-5-20251101">Claude Opus 4.5</option>
        </optgroup>
        <optgroup label="🟠 Anthropic - Balanced" ${defaultModel.includes('anthropic') ? '' : ''}>
          <option value="anthropic:claude-sonnet-4-5-20250929" ${defaultModel === 'anthropic:claude-sonnet-4-5-20250929' ? 'selected' : ''}>Claude Sonnet 4.5 (Recommended)</option>
          <option value="anthropic:claude-sonnet-4-20250514">Claude Sonnet 4</option>
        </optgroup>
        <optgroup label="🟠 Anthropic - Cost-Effective">
          <option value="anthropic:claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
        </optgroup>
        <optgroup label="🔴 Google - High Performance">
          <option value="google:gemini-3-pro-preview">Gemini 3 Pro</option>
        </optgroup>
        <optgroup label="🔴 Google - Balanced">
          <option value="google:gemini-3-flash-preview">Gemini 3 Flash</option>
        </optgroup>
        <optgroup label="🔴 Google - Cost-Effective">
          <option value="google:gemini-2.5-flash">Gemini 2.5 Flash</option>
        </optgroup>
      </select>
    </div>
  `;
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MultiAIClient, createAPIKeyInputs, createModelSelector };
}
