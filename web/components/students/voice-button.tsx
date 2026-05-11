'use client';

import { useRef, useState } from 'react';
import { Mic, Loader2 } from 'lucide-react';
import { useToast } from '@/components/shell/toast-region';
import { cn } from '@/lib/utils';

export function VoiceButton({ onTranscript }: { onTranscript: (text: string) => void }) {
  const { toast } = useToast();
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const tickRef = useRef<number | null>(null);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        if (tickRef.current) cancelAnimationFrame(tickRef.current);

        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size < 1000) { toast('Too short', 'error'); return; }

        setTranscribing(true);
        const fd = new FormData();
        fd.append('audio', blob, 'voice.webm');
        try {
          const r = await fetch('/api/voice/transcribe', { method: 'POST', body: fd });
          if (!r.ok) throw new Error(await r.text());
          const { text } = await r.json();
          onTranscript(text);
          toast('Transcribed via Whisper', 'success');
        } catch (e: any) {
          toast(e.message ?? 'Transcription failed', 'error');
        }
        setTranscribing(false);
      };
      rec.start();
      mediaRef.current = rec;
      setRecording(true);
      const startedAt = Date.now();
      const tick = () => {
        setSeconds(Math.floor((Date.now() - startedAt) / 1000));
        tickRef.current = requestAnimationFrame(tick);
      };
      tickRef.current = requestAnimationFrame(tick);
    } catch (e: any) {
      toast(e.message ?? 'Microphone unavailable', 'error');
    }
  }

  function stop() { mediaRef.current?.stop(); }

  return (
    <button
      type="button"
      onClick={recording ? stop : start}
      disabled={transcribing}
      className={cn(
        'h-8 px-2.5 rounded-md text-[12px] font-medium flex items-center gap-1 border',
        recording ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-ink-200 hover:bg-ink-50'
      )}
    >
      {transcribing ? (
        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Transcribing…</>
      ) : recording ? (
        <>
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-rec-pulse" />
          Listening… <span className="font-mono">{`0:${String(seconds).padStart(2,'0')}`}</span>
        </>
      ) : (
        <><Mic className="w-3.5 h-3.5" /> Dictate</>
      )}
    </button>
  );
}
