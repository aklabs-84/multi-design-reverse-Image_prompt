---
name: multi-ai-converter
description: Convert AI-powered web apps to support multiple AI platforms (OpenAI, Anthropic, Google). Accepts single files OR ZIP archives containing full projects. Use when user provides existing web app code using a single AI model and wants to add support for multiple AI providers with model selection dropdown. Triggers include requests to "add multi-model support", "convert to use different AI", "add API key selection", "support OpenAI/Claude/Gemini", uploading ZIP files with AI code, or when code uses only one AI provider and needs to support others. Handles image generation, image analysis, code generation, text generation/analysis apps.
---

# Multi-AI Converter

Transform single-AI web apps into multi-platform AI applications with model selection.

## Workflow

### Single File
1. **Analyze** the provided code to identify:
   - Current AI provider and model
   - API call patterns (REST, SDK)
   - Use case type (image gen/analysis, code gen, text gen/analysis)
   
2. **Generate** converted code with:
   - API key input fields for OpenAI, Anthropic, Google
   - Model dropdown selector grouped by provider
   - Unified API call handler for each provider

### ZIP Project (Multiple Files)

When user uploads a ZIP file:

1. **Extract** the archive:
```bash
mkdir -p /home/claude/project
unzip /mnt/user-data/uploads/[filename].zip -d /home/claude/project
```

2. **Scan** for AI-related files:
```bash
# Find files containing AI API calls
grep -rl "api.openai.com\|api.anthropic.com\|generativelanguage.googleapis.com\|openai\|anthropic\|gemini" /home/claude/project --include="*.js" --include="*.ts" --include="*.html" --include="*.jsx" --include="*.tsx" --include="*.py"
```

3. **Analyze** project structure:
   - Identify entry point (index.html, main.js, App.jsx, etc.)
   - Find API configuration files (config.js, .env patterns, api.js)
   - Locate UI components that need model selector

4. **Convert** each relevant file:
   - Add multi-ai-client.js to project assets
   - Modify API calls to use unified handler
   - Add API key inputs and model selector to UI
   - Update imports/dependencies as needed

5. **Package** and deliver:
```bash
cd /home/claude/project && zip -r /mnt/user-data/outputs/converted-project.zip .
```

### Detection Patterns

| Pattern | Provider | File Types |
|---------|----------|------------|
| `api.openai.com`, `openai.createChat` | OpenAI | .js, .ts, .py |
| `api.anthropic.com`, `Anthropic(` | Anthropic | .js, .ts, .py |
| `generativelanguage.googleapis.com`, `GoogleGenerativeAI` | Google | .js, .ts, .py |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY` | Config | .env, config.* |

## Supported Models (January 2026)

See [references/models.md](references/models.md) for full model specifications.

### Quick Reference

| Provider | High Performance | Balanced | Cost-Effective |
|----------|-----------------|----------|----------------|
| OpenAI | gpt-5.2 | gpt-5.1 | gpt-5 |
| Anthropic | claude-opus-4-5-20251101 | claude-sonnet-4-5-20250929 | claude-haiku-4-5-20251001 |
| Google | gemini-3-pro-preview | gemini-3-flash-preview | gemini-2.5-flash |

## Code Patterns

### API Key Input Section
```html
<div class="api-keys">
  <div class="key-group">
    <label>OpenAI API Key</label>
    <input type="password" id="openai-key" placeholder="sk-...">
  </div>
  <div class="key-group">
    <label>Anthropic API Key</label>
    <input type="password" id="anthropic-key" placeholder="sk-ant-...">
  </div>
  <div class="key-group">
    <label>Google AI API Key</label>
    <input type="password" id="google-key" placeholder="AIza...">
  </div>
</div>
```

### Model Selector Dropdown
```html
<select id="model-selector">
  <optgroup label="OpenAI - High Performance">
    <option value="openai:gpt-5.2">GPT-5.2 (Latest)</option>
    <option value="openai:gpt-5.2-codex">GPT-5.2 Codex (Coding)</option>
  </optgroup>
  <optgroup label="OpenAI - Balanced">
    <option value="openai:gpt-5.1">GPT-5.1</option>
    <option value="openai:gpt-5">GPT-5</option>
  </optgroup>
  <optgroup label="Anthropic - High Performance">
    <option value="anthropic:claude-opus-4-5-20251101">Claude Opus 4.5</option>
  </optgroup>
  <optgroup label="Anthropic - Balanced">
    <option value="anthropic:claude-sonnet-4-5-20250929">Claude Sonnet 4.5</option>
    <option value="anthropic:claude-sonnet-4-20250514">Claude Sonnet 4</option>
  </optgroup>
  <optgroup label="Anthropic - Cost-Effective">
    <option value="anthropic:claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
  </optgroup>
  <optgroup label="Google - High Performance">
    <option value="google:gemini-3-pro-preview">Gemini 3 Pro</option>
  </optgroup>
  <optgroup label="Google - Balanced">
    <option value="google:gemini-3-flash-preview">Gemini 3 Flash</option>
  </optgroup>
  <optgroup label="Google - Cost-Effective">
    <option value="google:gemini-2.5-flash">Gemini 2.5 Flash</option>
  </optgroup>
</select>
```

### Unified API Handler
```javascript
async function callAI(prompt, options = {}) {
  const [provider, model] = document.getElementById('model-selector').value.split(':');
  const keys = {
    openai: document.getElementById('openai-key').value,
    anthropic: document.getElementById('anthropic-key').value,
    google: document.getElementById('google-key').value
  };
  
  if (!keys[provider]) {
    throw new Error(`Please enter your ${provider.toUpperCase()} API key`);
  }
  
  switch (provider) {
    case 'openai': return callOpenAI(keys.openai, model, prompt, options);
    case 'anthropic': return callAnthropic(keys.anthropic, model, prompt, options);
    case 'google': return callGoogle(keys.google, model, prompt, options);
  }
}
```

## Provider-Specific Implementations

See [references/api-implementations.md](references/api-implementations.md) for complete API call implementations for each provider.

## Use Case Specific Conversions

### Text Generation/Chat
- Map system prompts appropriately (OpenAI: system role, Anthropic: system param, Google: system_instruction)
- Handle streaming responses per provider
- Manage conversation history format differences

### Image Analysis (Vision)
- Convert image to base64 for all providers
- Use appropriate content block format per provider
- Handle multi-image inputs where supported

### Image Generation
- OpenAI: Use DALL-E 3 or gpt-image-1 
- Google: Use Imagen 3 or gemini-3-pro-image-preview (Nano Banana Pro)
- Anthropic: Does not support image generation (notify user)

### Code Generation
- Prefer coding-optimized models (GPT-5.2-Codex, Claude Sonnet 4.5, Gemini 3 Pro)
- Handle code block extraction from responses

## Conversion Checklist

### Single File
- [ ] Add API key input fields with secure password type
- [ ] Add model selector dropdown with grouped options
- [ ] Replace single-provider API calls with unified handler
- [ ] Implement provider-specific API functions
- [ ] Add error handling for missing keys and API errors
- [ ] Preserve original functionality while adding flexibility

### ZIP Project
- [ ] Extract and scan project structure
- [ ] Identify all files with AI API calls
- [ ] Add multi-ai-client.js to appropriate location (assets/, lib/, utils/)
- [ ] Convert each AI-calling file to use unified handler
- [ ] Add UI components (API keys, model selector) to main interface
- [ ] Update any environment variable references
- [ ] Preserve project structure and non-AI files
- [ ] Re-package as ZIP with clear naming (e.g., `projectname-multi-ai.zip`)
