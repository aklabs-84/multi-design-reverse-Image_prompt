# AI Models Reference (January 2026)

## OpenAI Models

### GPT-5.2 Series (December 2025)
| Model ID | Type | Context | Best For | Pricing (per 1M tokens) |
|----------|------|---------|----------|------------------------|
| gpt-5.2 | Flagship | 400K | Professional work, complex tasks | ~$2.50 input / $15 output |
| gpt-5.2-codex | Coding | 400K | Agentic coding, refactors | ~$2.50 input / $15 output |

### GPT-5.1 Series (October 2025)
| Model ID | Type | Context | Best For | Pricing |
|----------|------|---------|----------|---------|
| gpt-5.1 | Balanced | 200K | General tasks, conversations | ~$1.50 input / $10 output |
| gpt-5.1-thinking | Reasoning | 200K | Complex reasoning | ~$1.50 input / $10 output |

### GPT-5 Series (August 2025)
| Model ID | Type | Context | Best For | Pricing |
|----------|------|---------|----------|---------|
| gpt-5 | Standard | 128K | General use, cost-effective | ~$1.25 input / $10 output |

### Image Models
| Model ID | Type | Best For |
|----------|------|----------|
| dall-e-3 | Image Gen | High-quality images |
| gpt-image-1 | Image Gen | Fast generation |

## Anthropic Claude Models

### Claude 4.5 Series (November 2025)
| Model ID | Type | Context | Best For | Pricing (per 1M tokens) |
|----------|------|---------|----------|------------------------|
| claude-opus-4-5-20251101 | Flagship | 200K | Complex reasoning, long tasks | $5 input / $25 output |
| claude-sonnet-4-5-20250929 | Balanced | 200K (1M beta) | Coding, agents, computer use | $3 input / $15 output |
| claude-haiku-4-5-20251001 | Fast | 200K | Quick tasks, high volume | $1 input / $5 output |

### Claude 4 Series (May 2025)
| Model ID | Type | Context | Best For | Pricing |
|----------|------|---------|----------|---------|
| claude-opus-4-20250514 | Premium | 200K | Legacy high-performance | $15 input / $75 output |
| claude-sonnet-4-20250514 | Balanced | 200K | General coding, chat | $3 input / $15 output |

### Vision Support
All Claude 4.x models support image analysis (vision). No image generation support.

## Google Gemini Models

### Gemini 3 Series (November 2025)
| Model ID | Type | Context | Best For | Pricing (per 1M tokens) |
|----------|------|---------|----------|------------------------|
| gemini-3-pro-preview | Flagship | 1M | Complex reasoning, multimodal | $2-4 input / $12-18 output |
| gemini-3-flash-preview | Fast | 1M | General tasks, vibe coding | $0.50 input / $3 output |

### Gemini 2.5 Series
| Model ID | Type | Context | Best For | Pricing |
|----------|------|---------|----------|---------|
| gemini-2.5-pro | Balanced | 1M | General professional work | $1.25 input / $5 output |
| gemini-2.5-flash | Cost-Effective | 1M | High volume, fast responses | $0.075 input / $0.30 output |

### Image Models
| Model ID | Type | Best For |
|----------|------|----------|
| gemini-3-pro-image-preview | Image Gen | High quality (Nano Banana Pro) |
| imagen-3 | Image Gen | Photorealistic images |

## Model Selection Guide

### By Use Case

**Text Generation / Chat**
- Premium: Claude Opus 4.5, GPT-5.2
- Balanced: Claude Sonnet 4.5, GPT-5.1, Gemini 3 Flash
- Budget: Claude Haiku 4.5, Gemini 2.5 Flash

**Code Generation**
- Premium: GPT-5.2-Codex, Claude Sonnet 4.5
- Balanced: Claude Sonnet 4, GPT-5.1, Gemini 3 Pro
- Budget: Gemini 3 Flash, Claude Haiku 4.5

**Image Analysis (Vision)**
- Best: Claude Opus 4.5, GPT-5.2, Gemini 3 Pro
- Balanced: Claude Sonnet 4.5, Gemini 3 Flash

**Image Generation**
- OpenAI: DALL-E 3, gpt-image-1
- Google: Imagen 3, gemini-3-pro-image-preview
- Anthropic: Not supported

### By Budget

**High Budget (Best Quality)**
- Claude Opus 4.5 ($5/$25)
- GPT-5.2 (~$2.50/$15)
- Gemini 3 Pro ($2-4/$12-18)

**Medium Budget (Best Value)**
- Claude Sonnet 4.5 ($3/$15)
- GPT-5.1 (~$1.50/$10)
- Gemini 3 Flash ($0.50/$3)

**Low Budget (Cost-Effective)**
- Claude Haiku 4.5 ($1/$5)
- GPT-5 (~$1.25/$10)
- Gemini 2.5 Flash ($0.075/$0.30)
