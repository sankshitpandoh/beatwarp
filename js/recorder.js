const TYPES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

/** Captures the canvas plus the audio being played into an MP4 (or WebM) clip. */
export class Recorder {
  constructor() {
    this.rec = null;
  }

  get active() { return !!this.rec; }

  start(canvas, audioStream) {
    const tracks = [...canvas.captureStream(60).getVideoTracks()];
    if (audioStream) tracks.push(...audioStream.getAudioTracks());
    const mimeType = TYPES.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
    this.mime = mimeType || 'video/webm';
    this.chunks = [];
    this.rec = new MediaRecorder(new MediaStream(tracks), { mimeType, videoBitsPerSecond: 16e6 });
    this.rec.ondataavailable = e => e.data.size && this.chunks.push(e.data);
    this.rec.start(250);
    this.started = performance.now();
  }

  /** Resolves with the finished clip as { blob, name }. */
  stop() {
    return new Promise(resolve => {
      const rec = this.rec;
      this.rec = null;
      rec.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.mime });
        const ext = this.mime.includes('mp4') ? 'mp4' : 'webm';
        resolve({ blob, name: `beatwarp-${stamp()}.${ext}` });
      };
      rec.stop();
    });
  }
}

export function stamp() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
}

export function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
