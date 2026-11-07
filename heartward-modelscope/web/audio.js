/* Convert real microphone samples (often 48 kHz) to 16 kHz mono PCM16. */
((root) => {
  "use strict";
  function resample(samples, sourceRate, targetRate = 16000) {
    if (sourceRate === targetRate) return Float32Array.from(samples);
    const ratio = sourceRate / targetRate;
    const output = new Float32Array(Math.floor(samples.length / ratio));
    for (let i = 0; i < output.length; i++) {
      const start = i * ratio, end = (i + 1) * ratio;
      let sum = 0;
      for (let j = Math.floor(start); j < Math.ceil(end); j++) {
        sum += (samples[j] || 0) * (Math.min(end, j + 1) - Math.max(start, j));
      }
      output[i] = sum / ratio;
    }
    return output;
  }
  function encodeWav(samples, sourceRate) {
    const pcm = resample(samples, sourceRate);
    const buffer = new ArrayBuffer(44 + pcm.length * 2), view = new DataView(buffer);
    const write = (offset, text) => [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
    write(0, "RIFF"); view.setUint32(4, buffer.byteLength - 8, true);
    write(8, "WAVEfmt "); view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, 16000, true); view.setUint32(28, 32000, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    write(36, "data"); view.setUint32(40, pcm.length * 2, true);
    pcm.forEach((sample, i) => {
      const value = Math.max(-1, Math.min(1, sample));
      view.setInt16(44 + i * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
    });
    return buffer;
  }
  const api = {resample, encodeWav};
  if (typeof module !== "undefined") module.exports = api;
  else root.HXAudio = api;
})(typeof window === "undefined" ? globalThis : window);
