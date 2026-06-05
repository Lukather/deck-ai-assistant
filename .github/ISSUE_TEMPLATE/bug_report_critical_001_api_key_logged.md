---
name: '🔴 Critical: API Key Security Vulnerability'
about: 'Report a critical security issue that needs immediate attention'
title: '[CRITICAL] API key is being logged to disk in plaintext'
labels: 'bug, critical, security'
assignees: ''
---

## 🔴 Critical Bug Report

### Bug Description

**API key is being logged to disk in plaintext** - The Gemini API key is being written to the Decky Loader log file at `main.py:45`.

### Location
`main.py`, line 45:
```python
decky.logger.info(f"Chiave API usata: {repr(api_key)}")
```

### Impact

- **Severity**: Critical
- **CVSS Estimate**: 7.5 (High)
- **Attack Vector**: Local log file access
- **Confidentiality Impact**: Complete compromise of API credentials

Any user or process with read access to the Steam Deck's filesystem can retrieve the API key from:
- Decky Loader logs
- System journal logs
- Any backup of the filesystem

### Steps to Reproduce

1. Install the plugin
2. Configure a valid API key
3. Make any AI request
4. Check logs: `journalctl --user -u dechy-loader` or plugin log files

### Expected Behavior

API keys should **never** be logged. If logging is needed for debugging, only the last 4 characters should be shown (e.g., `****abcd`).

### Suggested Fix

```python
# Instead of logging the full key:
# BEFORE (vulnerable):
decky.logger.info(f"Chiave API usata: {repr(api_key)}")

# AFTER (secure):
masked_key = f"****{api_key[-4:]}" if len(api_key) >= 4 else "****"
decky.logger.info(f"Chiave API usata: {masked_key}")
```

### Additional Security Recommendations

1. Verify `CONFIG_PATH` file permissions are set to `0o600` after saving
2. Add a comment in code explaining why the key is never fully logged
3. Consider adding a debug mode flag that can be toggled for verbose logging

---

### Environment

- Steam Deck OS: <!-- your version -->
- Plugin version: <!-- e.g., 0.0.1 -->
- Decky Loader version: <!-- if known -->
