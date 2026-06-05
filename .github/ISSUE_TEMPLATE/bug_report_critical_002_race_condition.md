---
name: '🔴 Critical: Race Condition in Voice Recording'
about: 'Report a critical concurrency/race condition bug'
title: '[CRITICAL] Race condition in voice recording process management'
labels: 'bug, critical, voice-recording'
assignees: ''
---

## 🔴 Critical Bug Report

### Bug Description

**Race condition in voice recording** - The `start_voice_recording` and `stop_voice_recording` methods in `main.py` have multiple race conditions that can lead to:
- Orphaned subprocesses
- Lost transcriptions
- Crashes on repeated start/stop operations

### Location
`main.py`, methods `start_voice_recording()` and `stop_voice_recording()`

### Impact

- **Severity**: Critical
- **Reliability**: Multiple failure modes
- **User Experience**: Voice feature becomes unusable

### Failure Modes Observed

1. **Process not tracked correctly**
   ```python
   self.dictation_process = subprocess.Popen(...)
   # But if the process exits immediately, self.dictation_process still holds the object
   # even though poll() returns non-None
   ```

2. **Double-termination attempt**
   ```python
   # First: terminate in stop_voice_recording
   # Then: try to read from already-closed stdout
   # Finally: exception thrown
   ```

3. **Missing stdout synchronization**
   - `communicate()` is called multiple times
   - Race between process exit and stdout read
   - Transcription can be lost if timing is unlucky

4. **No process state validation**
   - `stop_voice_recording` doesn't check if process is already dead
   - `start_voice_recording` doesn't kill zombie processes

### Steps to Reproduce

1. Click voice button to start recording
2. Quickly click again to stop (within 500ms)
3. Repeat 3-4 times rapidly
4. Observe: lost transcriptions, orphaned nerd-dictation processes, or crashes

### Code Analysis

```python
# Current problematic flow in start_voice_recording:
self.dictation_process = subprocess.Popen(...)
await asyncio.sleep(0.5)
if self.dictation_process.poll() is not None:  # Race: process could exit here
    stdout, _ = self.dictation_process.communicate()  # Already dead!

# In stop_voice_recording:
if self.dictation_process.stdout:
    stdout_data, _ = self.dictation_process.communicate(timeout=2)
    # But stdout might already be closed/empty
```

### Suggested Fix

```python
import threading
import queue

class Plugin:
    def __init__(self):
        self._dictation_lock = threading.Lock()
        self._dictation_process = None
        self._transcription_queue = queue.Queue()
    
    async def start_voice_recording(self) -> str:
        with self._dictation_lock:
            if self._dictation_process is not None:
                # Check if process is still alive
                if self._dictation_process.poll() is None:
                    return "Already recording"
                # Clean up zombie
                self._dictation_process = None
            
            # Start process with pipe for real-time output capture
            self._dictation_process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                bufsize=1,
                universal_newlines=True
            )
            
            return "Voice recording started successfully"
    
    async def stop_voice_recording(self) -> str:
        with self._dictation_lock:
            if self._dictation_process is None:
                return "Error: No recording in progress"
            
            proc = self._dictation_process
            self._dictation_process = None  # Set to None BEFORE killing
            
            # Graceful termination
            proc.terminate()
            try:
                stdout, _ = proc.communicate(timeout=3)
            except subprocess.TimeoutExpired:
                proc.kill()
                stdout, _ = proc.communicate()
            
            return stdout.decode().strip() if stdout else "No speech detected"
```

### Additional Recommendations

1. Use a lock to ensure only one voice operation runs at a time
2. Validate process state before attempting operations
3. Read stdout in a separate thread for real-time capture
4. Add proper cleanup in plugin destructor

---

### Environment

- Steam Deck OS: <!-- your version -->
- Plugin version: <!-- e.g., 0.0.1 -->
- Decky Loader version: <!-- if known -->
- nerd-dictation version: <!-- if known -->
