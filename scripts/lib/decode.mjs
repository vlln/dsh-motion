// ffmpeg rawvideo helpers: probe geometry, stream frames at a fixed size/fps.
// Shared so the film gate and the reference analyser look at the same pixels.

import { execFileSync, spawn } from 'node:child_process';

export function probe(file) {
  const out = JSON.parse(
    execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', file], {
      encoding: 'utf8',
    }),
  );
  const stream = out.streams.find((s) => s.codec_type === 'video');
  if (!stream) throw new Error(`no video stream: ${file}`);
  const [num, den] = String(stream.avg_frame_rate ?? stream.r_frame_rate ?? '24/1').split('/').map(Number);
  return {
    width: Number(stream.width),
    height: Number(stream.height),
    duration: Number(out.format.duration),
    fps: den ? num / den : num,
  };
}

/** Decode to raw frames; onFrame(buffer, w, h, index). Resolves with the frame count. */
export function decode(file, { info, fps, width, pixFmt = 'gray' }, onFrame) {
  return new Promise((resolve, reject) => {
    // even height keeps swscale happy and the frame size predictable
    const h = Math.max(2, Math.round((width * info.height) / info.width / 2) * 2);
    const frameSize = width * h * (pixFmt === 'rgb24' ? 3 : 1);
    const ff = spawn('ffmpeg', [
      '-v', 'error', '-i', file,
      '-vf', `fps=${fps},scale=${width}:${h},format=${pixFmt}`,
      '-f', 'rawvideo', 'pipe:1',
    ]);
    let buf = Buffer.alloc(0);
    let count = 0;
    ff.stdout.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      while (buf.length >= frameSize) {
        onFrame(buf.subarray(0, frameSize), width, h, count++);
        buf = buf.subarray(frameSize);
      }
    });
    ff.on('close', (code) => (code === 0 ? resolve(count) : reject(new Error(`ffmpeg exited ${code}`))));
  });
}
