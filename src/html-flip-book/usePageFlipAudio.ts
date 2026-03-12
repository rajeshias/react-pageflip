import { useEffect, useRef, useCallback } from 'react';
import { DEFAULT_SOUND_URLS } from './defaultSounds';

// A full flip in this many seconds = playbackRate 1.0
// Tune this if audio feels too fast or too slow on a normal swipe.
const REFERENCE_FLIP_DURATION = 0.3;

export function usePageFlipAudio() {
    const ctxRef = useRef<AudioContext | null>(null);
    const buffersRef = useRef<AudioBuffer[]>([]);

    const lockedIdxRef = useRef(-1);
    const sourceRef = useRef<AudioBufferSourceNode | null>(null);
    const killedRef = useRef(false);

    // For playbackRate calculation
    const lastProgressRef = useRef(0);
    const lastTimeRef = useRef(0);

    useEffect(() => {
        if (!DEFAULT_SOUND_URLS.length) return;

        const AudioContextClass =
            window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioContextClass();
        ctxRef.current = ctx;

        Promise.all(
            DEFAULT_SOUND_URLS.map((url) =>
                fetch(url)
                    .then((r) => r.arrayBuffer())
                    .then((ab) => ctx.decodeAudioData(ab)),
            ),
        ).then((decoded) => {
            buffersRef.current = decoded;
        });

        return () => {
            stopSource();
            ctx.close();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function stopSource() {
        if (sourceRef.current) {
            try { sourceRef.current.stop(); } catch { /* already stopped */ }
            sourceRef.current = null;
        }
    }

    /** Wire to page-flip's changeState event */
    const handleChangeState = useCallback((e: { data: unknown }) => {
        const state = e.data as string;

        if (state === 'user_fold' || state === 'flipping') {
            if (lockedIdxRef.current === -1 && buffersRef.current.length > 0) {
                lockedIdxRef.current = Math.floor(Math.random() * buffersRef.current.length);
                killedRef.current = false;
                lastProgressRef.current = 0;
                lastTimeRef.current = 0;
            }
        } else if (state === 'read') {
            stopSource();
            lockedIdxRef.current = -1;
            killedRef.current = false;
        }
    }, []);

    /** Wire to page-flip's flipProgress event (fires every animation frame) */
    const handleFlipProgress = useCallback((e: { data: unknown }) => {
        const { progress, direction } = e.data as { progress: number; direction: number };

        if (lockedIdxRef.current === -1) return;

        // Direction reversed → kill audio for this flip
        if (direction !== 0) {
            if (!killedRef.current) {
                killedRef.current = true;
                stopSource();
            }
            return;
        }

        if (killedRef.current) return;

        const ctx = ctxRef.current;
        const buffer = buffersRef.current[lockedIdxRef.current];
        if (!ctx || !buffer) return;

        // Start the source on the first forward frame
        if (!sourceRef.current) {
            if (ctx.state === 'suspended') ctx.resume();
            const src = ctx.createBufferSource();
            src.buffer = buffer;
            src.connect(ctx.destination);
            src.start(0);
            src.onended = () => { sourceRef.current = null; };
            sourceRef.current = src;
            lastProgressRef.current = progress;
            lastTimeRef.current = ctx.currentTime;
            return;
        }

        // Update playbackRate based on swipe speed
        const deltaProgress = progress - lastProgressRef.current;
        const deltaTime = ctx.currentTime - lastTimeRef.current;

        if (deltaTime > 0 && deltaProgress > 0) {
            // (deltaProgress / 100) = fraction of flip covered
            // divide by deltaTime to get fraction-per-second
            // divide by (1 / REFERENCE_FLIP_DURATION) to normalise to rate 1.0
            const rate = (deltaProgress / 100) / (deltaTime / REFERENCE_FLIP_DURATION);
            sourceRef.current.playbackRate.value = Math.min(Math.max(rate, 0.05), 2.0);
        }

        lastProgressRef.current = progress;
        lastTimeRef.current = ctx.currentTime;
    }, []);

    return { handleChangeState, handleFlipProgress };
}
