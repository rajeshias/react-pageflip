import { useEffect, useRef, useCallback } from 'react';
import { DEFAULT_SOUND_URLS } from './defaultSounds';

function reverseAudioBuffer(ctx: AudioContext, buffer: AudioBuffer): AudioBuffer {
    const reversed = ctx.createBuffer(
        buffer.numberOfChannels,
        buffer.length,
        buffer.sampleRate,
    );
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        const src = buffer.getChannelData(ch);
        const dst = reversed.getChannelData(ch);
        for (let i = 0; i < src.length; i++) {
            dst[i] = src[src.length - 1 - i];
        }
    }
    return reversed;
}

export function usePageFlipAudio() {
    const urls = DEFAULT_SOUND_URLS;
    const ctxRef = useRef<AudioContext | null>(null);
    const buffersRef = useRef<AudioBuffer[]>([]);
    const reversedRef = useRef<AudioBuffer[]>([]);

    // State tracked across frames
    const lockedIdxRef = useRef(-1);       // which of the 6 sounds is locked for this flip
    const sourceRef = useRef<AudioBufferSourceNode | null>(null);
    const playStartTimeRef = useRef(0);    // audioCtx.currentTime when current source started
    const playOffsetRef = useRef(0);       // buffer offset (seconds) when current source started
    const lastDirectionRef = useRef(-1);   // 0 = FORWARD, 1 = BACK
    const isPlayingRef = useRef(false);

    useEffect(() => {
        if (!urls || urls.length === 0) return;

        const AudioContextClass =
            window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioContextClass();
        ctxRef.current = ctx;

        Promise.all(
            urls.map((url) =>
                fetch(url)
                    .then((r) => r.arrayBuffer())
                    .then((ab) => ctx.decodeAudioData(ab)),
            ),
        ).then((decoded) => {
            buffersRef.current = decoded;
            reversedRef.current = decoded.map((buf) => reverseAudioBuffer(ctx, buf));
        });

        return () => {
            stopSource();
            ctx.close();
        };
        // soundUrls is expected to be stable (defined once by consumer)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function stopSource() {
        if (sourceRef.current) {
            try {
                sourceRef.current.stop();
            } catch {
                // already stopped
            }
            sourceRef.current = null;
        }
        isPlayingRef.current = false;
    }

    function startAt(buffer: AudioBuffer, offset: number) {
        const ctx = ctxRef.current;
        if (!ctx) return;

        stopSource();

        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(ctx.destination);

        const clamped = Math.max(0, Math.min(offset, buffer.duration - 0.001));
        src.start(0, clamped);

        sourceRef.current = src;
        playStartTimeRef.current = ctx.currentTime;
        playOffsetRef.current = clamped;
        isPlayingRef.current = true;
    }

    /** Wire to page-flip's changeState event */
    const handleChangeState = useCallback((e: { data: unknown }) => {
        const state = e.data as string;

        if (state === 'user_fold' || state === 'flipping') {
            // Lock a random sound for the duration of this flip
            if (lockedIdxRef.current === -1 && buffersRef.current.length > 0) {
                lockedIdxRef.current = Math.floor(Math.random() * buffersRef.current.length);
            }
        } else if (state === 'read') {
            stopSource();
            lockedIdxRef.current = -1;
            lastDirectionRef.current = -1;
        }
    }, []);

    /** Wire to page-flip's flipProgress event (fires every animation frame) */
    const handleFlipProgress = useCallback((e: { data: unknown }) => {
        const { progress, direction } = e.data as { progress: number; direction: number };

        const idx = lockedIdxRef.current;
        if (idx === -1) return;

        const ctx = ctxRef.current;
        if (!ctx) return;

        const buffers = buffersRef.current;
        const reversed = reversedRef.current;
        if (!buffers[idx]) return;

        const isForward = direction === 0;
        const buffer = isForward ? buffers[idx] : reversed[idx];

        // Expected playback position in the buffer (seconds)
        const expectedOffset = isForward
            ? (progress / 100) * buffer.duration
            : ((100 - progress) / 100) * buffer.duration;

        // Direction changed → restart at the mirrored position
        if (direction !== lastDirectionRef.current) {
            lastDirectionRef.current = direction;
            startAt(buffer, expectedOffset);
            return;
        }

        if (isPlayingRef.current) {
            // Check how far the natural playback has drifted from the expected position
            const elapsed = ctx.currentTime - playStartTimeRef.current;
            const actualOffset = playOffsetRef.current + elapsed;
            const drift = Math.abs(actualOffset - expectedOffset);

            // Only restart if drift exceeds 50 ms — avoids audio clicking every frame
            if (drift > 0.05) {
                startAt(buffer, expectedOffset);
            }
        } else {
            startAt(buffer, expectedOffset);
        }
    }, []);

    return { handleChangeState, handleFlipProgress };
}
