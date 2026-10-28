import { logger } from './loggingService';

export const AVAILABLE_VOICES = [
    { name: 'Nova',    voiceURI: 'nova',    lang: 'en-US', gender: 'female' },
    { name: 'Shimmer', voiceURI: 'shimmer', lang: 'en-US', gender: 'female' },
    { name: 'Coral',   voiceURI: 'coral',   lang: 'en-US', gender: 'female' },
    { name: 'Bella',   voiceURI: 'bella',   lang: 'en-US', gender: 'female' },
    { name: 'Sarah',   voiceURI: 'sarah',   lang: 'en-US', gender: 'female' },
    { name: 'Echo',    voiceURI: 'echo',    lang: 'en-US', gender: 'male'   },
    { name: 'Onyx',    voiceURI: 'onyx',    lang: 'en-US', gender: 'male'   },
    { name: 'Fable',   voiceURI: 'fable',   lang: 'en-US', gender: 'male'   },
    { name: 'Alloy',   voiceURI: 'alloy',   lang: 'en-US', gender: 'neutral'},
    { name: 'Ash',     voiceURI: 'ash',     lang: 'en-US', gender: 'neutral'},
    { name: 'Sage',    voiceURI: 'sage',    lang: 'en-US', gender: 'neutral'},
];

export const getVoices = (): Promise<typeof AVAILABLE_VOICES> =>
    Promise.resolve(AVAILABLE_VOICES);

export const isSupported = (): boolean => true;

let audioCtx: AudioContext | null = null;
let currentSource: AudioBufferSourceNode | null = null;
let audioQueue: { text: string; voice: string }[] = [];
let isPlaying = false;
// Pre-fetched buffers ready to play immediately
let prefetchedBuffers: AudioBuffer[] = [];

const MAX_CHUNK = 400; // chars — single Pollinations request sweet spot

export const unlockAudio = (): void => {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
};

const getCtx = async (): Promise<AudioContext> => {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioCtx.state === 'suspended') await audioCtx.resume();
    return audioCtx;
};

const stripMarkdown = (s: string): string =>
    s.replace(/\[.*?\]/g, '')
     .replace(/\*+([^*]*)\*+/g, '$1')
     .replace(/_{1,2}([^_]*)_{1,2}/g, '$1')
     .replace(/`[^`]*`/g, '')
     .replace(/\s+/g, ' ')
     .trim();

// Split long text at sentence boundaries into ≤MAX_CHUNK char chunks.
// Short text stays as a single chunk to avoid inter-request gaps.
const chunkText = (text: string): string[] => {
    if (text.length <= MAX_CHUNK) return [text];
    const sentences = text.match(/[^.!?]+[.!?]+\s*/g) ?? [text];
    const chunks: string[] = [];
    let current = '';
    for (const s of sentences) {
        if ((current + s).length > MAX_CHUNK && current) {
            chunks.push(current.trim());
            current = s;
        } else {
            current += s;
        }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks.length ? chunks : [text];
};

const fetchBuffer = async (text: string, voice: string): Promise<AudioBuffer | null> => {
    try {
        const resp = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, voice }),
        });
        if (!resp.ok) { logger.error(`TTS HTTP ${resp.status}`); return null; }
        const ab = await resp.arrayBuffer();
        const ctx = await getCtx();
        return await ctx.decodeAudioData(ab);
    } catch (err) {
        logger.error('TTS fetch/decode error:', err);
        return null;
    }
};

const playBuffer = (buf: AudioBuffer, onEnded: () => void): void => {
    if (!audioCtx) return;
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(audioCtx.destination);
    currentSource = src;
    src.onended = () => { currentSource = null; onEnded(); };
    src.start();
};

const processQueue = async () => {
    if (isPlaying || audioQueue.length === 0) return;
    isPlaying = true;

    const { text, voice } = audioQueue.shift()!;
    const chunks = chunkText(text);

    // Fetch first chunk immediately, prefetch second in parallel
    const firstBuf = await fetchBuffer(chunks[0], voice);
    if (!firstBuf) { isPlaying = false; processQueue(); return; }

    // Start prefetching remaining chunks
    const pending = chunks.slice(1).map(c => fetchBuffer(c, voice));

    const playChain = async (buf: AudioBuffer, rest: Promise<AudioBuffer | null>[]) => {
        // Kick off next fetch while this one plays
        const nextBufP = rest.length ? rest[0] : null;

        await new Promise<void>(resolve => playBuffer(buf, resolve));

        if (rest.length && nextBufP) {
            const nextBuf = await nextBufP;
            if (nextBuf) {
                await playChain(nextBuf, rest.slice(1));
            }
        }
    };

    await playChain(firstBuf, pending);
    isPlaying = false;
    processQueue();
};

export const speak = async (text: string, voiceURI?: string) => {
    const clean = stripMarkdown(text);
    if (!clean) return;
    audioQueue.push({ text: clean, voice: voiceURI || 'nova' });
    processQueue();
};

export const cancel = () => {
    audioQueue = [];
    prefetchedBuffers = [];
    if (currentSource) {
        try { currentSource.stop(); } catch { /* already stopped */ }
        currentSource = null;
    }
    isPlaying = false;
};
