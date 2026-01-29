# API Implementation Reference

Complete implementation patterns for each AI provider.

## OpenAI API

### Text Generation
```javascript
async function callOpenAI(apiKey, model, prompt, options = {}) {
  const { systemPrompt, maxTokens = 4096, temperature = 0.7 } = options;
  
  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      max_tokens: maxTokens,
      temperature: temperature
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'OpenAI API error');
  }
  
  const data = await response.json();
  return data.choices[0].message.content;
}
```

### Image Analysis (Vision)
```javascript
async function callOpenAIVision(apiKey, model, prompt, imageBase64, mimeType = 'image/png') {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { 
            type: 'image_url', 
            image_url: { 
              url: `data:${mimeType};base64,${imageBase64}` 
            }
          }
        ]
      }],
      max_tokens: 4096
    })
  });
  
  const data = await response.json();
  return data.choices[0].message.content;
}
```

### Image Generation
```javascript
async function callOpenAIImageGen(apiKey, prompt, options = {}) {
  const { size = '1024x1024', quality = 'standard', n = 1 } = options;
  
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: prompt,
      n: n,
      size: size,
      quality: quality
    })
  });
  
  const data = await response.json();
  return data.data[0].url; // or data.data[0].b64_json if requested
}
```

## Anthropic Claude API

### Text Generation
```javascript
async function callAnthropic(apiKey, model, prompt, options = {}) {
  const { systemPrompt, maxTokens = 4096, temperature = 0.7 } = options;
  
  const body = {
    model: model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }]
  };
  
  if (systemPrompt) {
    body.system = systemPrompt;
  }
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Anthropic API error');
  }
  
  const data = await response.json();
  return data.content[0].text;
}
```

### Image Analysis (Vision)
```javascript
async function callAnthropicVision(apiKey, model, prompt, imageBase64, mimeType = 'image/png') {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType,
              data: imageBase64
            }
          },
          { type: 'text', text: prompt }
        ]
      }]
    })
  });
  
  const data = await response.json();
  return data.content[0].text;
}
```

## Google Gemini API

### Text Generation
```javascript
async function callGoogle(apiKey, model, prompt, options = {}) {
  const { systemPrompt, maxTokens = 4096, temperature = 0.7 } = options;
  
  const body = {
    contents: [{ 
      role: 'user', 
      parts: [{ text: prompt }] 
    }],
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: temperature
    }
  };
  
  if (systemPrompt) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] };
  }
  
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Google AI API error');
  }
  
  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}
```

### Image Analysis (Vision)
```javascript
async function callGoogleVision(apiKey, model, prompt, imageBase64, mimeType = 'image/png') {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: imageBase64
              }
            },
            { text: prompt }
          ]
        }]
      })
    }
  );
  
  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}
```

### Image Generation (Imagen 3)
```javascript
async function callGoogleImageGen(apiKey, prompt, options = {}) {
  const { aspectRatio = '1:1', numberOfImages = 1 } = options;
  
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/imagen-3:generateImages?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: prompt,
        config: {
          numberOfImages: numberOfImages,
          aspectRatio: aspectRatio
        }
      })
    }
  );
  
  const data = await response.json();
  return data.images[0].base64; // Returns base64 encoded image
}
```

## Unified Handler with All Features

```javascript
class MultiAIClient {
  constructor() {
    this.keys = {
      openai: '',
      anthropic: '',
      google: ''
    };
  }
  
  setKey(provider, key) {
    this.keys[provider] = key;
  }
  
  parseModelSelector(value) {
    const [provider, model] = value.split(':');
    return { provider, model };
  }
  
  async generateText(modelValue, prompt, options = {}) {
    const { provider, model } = this.parseModelSelector(modelValue);
    const apiKey = this.keys[provider];
    
    if (!apiKey) throw new Error(`Missing ${provider} API key`);
    
    switch (provider) {
      case 'openai': return this.callOpenAI(apiKey, model, prompt, options);
      case 'anthropic': return this.callAnthropic(apiKey, model, prompt, options);
      case 'google': return this.callGoogle(apiKey, model, prompt, options);
      default: throw new Error(`Unknown provider: ${provider}`);
    }
  }
  
  async analyzeImage(modelValue, prompt, imageBase64, mimeType) {
    const { provider, model } = this.parseModelSelector(modelValue);
    const apiKey = this.keys[provider];
    
    if (!apiKey) throw new Error(`Missing ${provider} API key`);
    
    switch (provider) {
      case 'openai': return this.callOpenAIVision(apiKey, model, prompt, imageBase64, mimeType);
      case 'anthropic': return this.callAnthropicVision(apiKey, model, prompt, imageBase64, mimeType);
      case 'google': return this.callGoogleVision(apiKey, model, prompt, imageBase64, mimeType);
      default: throw new Error(`Unknown provider: ${provider}`);
    }
  }
  
  async generateImage(provider, prompt, options = {}) {
    const apiKey = this.keys[provider];
    
    if (!apiKey) throw new Error(`Missing ${provider} API key`);
    
    switch (provider) {
      case 'openai': return this.callOpenAIImageGen(apiKey, prompt, options);
      case 'google': return this.callGoogleImageGen(apiKey, prompt, options);
      case 'anthropic': throw new Error('Anthropic does not support image generation');
      default: throw new Error(`Unknown provider: ${provider}`);
    }
  }
  
  // Include all the individual API call methods from above...
}

// Usage
const ai = new MultiAIClient();
ai.setKey('openai', document.getElementById('openai-key').value);
ai.setKey('anthropic', document.getElementById('anthropic-key').value);
ai.setKey('google', document.getElementById('google-key').value);

const result = await ai.generateText('anthropic:claude-sonnet-4-5-20250929', 'Hello!');
```

## Error Handling Patterns

```javascript
async function safeAPICall(fn) {
  try {
    return await fn();
  } catch (error) {
    if (error.message.includes('401') || error.message.includes('invalid_api_key')) {
      throw new Error('Invalid API key. Please check your credentials.');
    }
    if (error.message.includes('429') || error.message.includes('rate_limit')) {
      throw new Error('Rate limit exceeded. Please wait and try again.');
    }
    if (error.message.includes('insufficient_quota')) {
      throw new Error('API quota exceeded. Please check your billing.');
    }
    throw error;
  }
}
```

## Streaming Support

### OpenAI Streaming
```javascript
async function* streamOpenAI(apiKey, model, prompt, options = {}) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model, 
      messages: [{ role: 'user', content: prompt }],
      stream: true
    })
  });
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(line => line.startsWith('data: '));
    
    for (const line of lines) {
      const data = line.slice(6);
      if (data === '[DONE]') return;
      const parsed = JSON.parse(data);
      yield parsed.choices[0]?.delta?.content || '';
    }
  }
}
```

### Anthropic Streaming
```javascript
async function* streamAnthropic(apiKey, model, prompt, options = {}) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
      stream: true
    })
  });
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(line => line.startsWith('data: '));
    
    for (const line of lines) {
      const data = JSON.parse(line.slice(6));
      if (data.type === 'content_block_delta') {
        yield data.delta?.text || '';
      }
    }
  }
}
```

### Google Streaming
```javascript
async function* streamGoogle(apiKey, model, prompt, options = {}) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      })
    }
  );
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    // Google returns JSON array chunks
    try {
      const parsed = JSON.parse(chunk.replace(/^\[|\]$/g, '').trim());
      yield parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (e) {
      // Handle partial JSON
    }
  }
}
```
