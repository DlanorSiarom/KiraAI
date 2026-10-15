export interface RecordingResult {
  audioBase64: string;
  mimeType: string;
  durationMs: number;
}

class UniversalAudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private animFrameId: number | null = null;
  private startTime: number = 0;
  private isRecording: boolean = false;

  public getIsRecording(): boolean {
    return this.isRecording;
  }

  // Determine supported audio mime type across browsers (Chrome, Safari iOS, Firefox)
  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/aac',
      'audio/ogg;codecs=opus',
    ];

    for (const t of types) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) {
        return t;
      }
    }
    return '';
  }

  // Check and request microphone permissions explicitly
  public async requestPermission(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Release tracks right away
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch (err) {
      console.warn('Permissão de microfone negada ou inacessível:', err);
      return false;
    }
  }

  // Start recording audio from the microphone with live volume feedback
  public async start(onLevelChange?: (level: number) => void): Promise<void> {
    if (this.isRecording) {
      await this.stop();
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Navegador não possui suporte para gravação de áudio.');
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.stream = stream;
    this.audioChunks = [];
    this.startTime = Date.now();
    this.isRecording = true;

    // Setup AudioContext for real-time volume reactivity on the Orb
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        const audioCtx = new AudioCtxClass();
        this.audioCtx = audioCtx;
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }

        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        this.analyser = analyser;

        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          if (!this.isRecording || !this.analyser) return;
          this.analyser.getByteFrequencyData(dataArray);

          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const normalized = Math.min(1, Math.max(0, avg / 70));

          if (onLevelChange) {
            onLevelChange(normalized);
          }

          this.animFrameId = requestAnimationFrame(tick);
        };

        tick();
      }
    } catch (e) {
      console.warn('Erro ao inicializar analisador de áudio:', e);
    }

    const mimeType = this.getSupportedMimeType();
    const options: MediaRecorderOptions = mimeType ? { mimeType } : {};

    const recorder = new MediaRecorder(stream, options);
    this.mediaRecorder = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    // Request data in chunks every 250ms
    recorder.start(250);
  }

  // Stop recording and return base64 audio data
  public async stop(): Promise<RecordingResult | null> {
    if (!this.isRecording) return null;
    this.isRecording = false;

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    const recorder = this.mediaRecorder;
    const stream = this.stream;
    const durationMs = Date.now() - this.startTime;

    return new Promise((resolve) => {
      if (!recorder || recorder.state === 'inactive') {
        this.cleanup();
        resolve(null);
        return;
      }

      recorder.onstop = async () => {
        try {
          const mimeType = recorder.mimeType || 'audio/webm';
          const audioBlob = new Blob(this.audioChunks, { type: mimeType });

          if (audioBlob.size === 0) {
            this.cleanup();
            resolve(null);
            return;
          }

          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            const base64 = dataUrl.split(',')[1] || '';
            this.cleanup();
            resolve({
              audioBase64: base64,
              mimeType,
              durationMs,
            });
          };
          reader.readAsDataURL(audioBlob);
        } catch (err) {
          console.error('Erro ao processar blob de áudio:', err);
          this.cleanup();
          resolve(null);
        }
      };

      try {
        recorder.stop();
      } catch {
        this.cleanup();
        resolve(null);
      }

      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    });
  }

  private cleanup() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    this.mediaRecorder = null;
    this.analyser = null;
    this.audioChunks = [];
  }
}

export const audioRecorder = new UniversalAudioRecorder();

// Sends recorded audio to the /api/transcribe backend endpoint
export async function transcribeAudioDirectly(audioBase64: string, mimeType: string = 'audio/webm'): Promise<string> {
  const res = await fetch('/api/transcribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ audioBase64, mimeType }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Falha ao transcrever o áudio.');
  }

  const data = await res.json();
  return data.text || '';
}
