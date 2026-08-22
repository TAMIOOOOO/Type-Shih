import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  RotateCcw,
  Sparkles,
  AlertTriangle,
  Flame,
  CheckCircle,
  Timer,
  Keyboard,
  Award,
  ChevronRight,
  TrendingUp,
  Type,
  FileText,
  Clock,
} from 'lucide-react';
import { GameStatus, GameSummary, User, Theme } from '../types.js';
import { playKeySound, playErrorSound, playSuccessSound, playFinishSound } from '../lib/sound.js';
import { executeGraphQL, SAVE_GAME_MUTATION, getAuthToken } from '../lib/graphqlClient.js';
import { getRandomWords } from '../lib/wordBank.js';

interface GameArenaProps {
  currentUser: User | null;
  bestScore: number | null;
  onUpdateBestScore: (newScore: number) => void;
  onOpenAuth: () => void;
  onViewLeaderboard: () => void;
  isMuted: boolean;
  theme?: Theme;
}

export type ModeCategory = 'alphabet' | 'words';
export type AlphabetPreset = 'blitz' | 'standard' | 'marathon';
export type WordsPreset = 'time20' | 'time30' | 'time60';

const ALPHABET_CONFIG: Record<AlphabetPreset, { label: string; length: number; desc: string }> = {
  blitz: { label: 'Blitz 10', length: 10, desc: 'Sprint' },
  standard: { label: 'Standard 20', length: 20, desc: 'Protocol' },
  marathon: { label: 'Marathon 40', length: 40, desc: 'Endurance' },
};

const WORDS_CONFIG: Record<WordsPreset, { label: string; durationSeconds: number; desc: string }> = {
  time20: { label: '20s', durationSeconds: 20, desc: '20 Seconds' },
  time30: { label: '30s', durationSeconds: 30, desc: '30 Seconds' },
  time60: { label: '1:00 min', durationSeconds: 60, desc: '1 Minute' },
};

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function generateRandomSequence(length = 20): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * ALPHABET.length);
    result += ALPHABET[randomIndex];
  }
  return result;
}

export const GameArena: React.FC<GameArenaProps> = ({
  currentUser,
  bestScore,
  onUpdateBestScore,
  onOpenAuth,
  onViewLeaderboard,
  isMuted,
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';

  // Game Mode: 'alphabet' vs 'words'
  const [modeCategory, setModeCategory] = useState<ModeCategory>('alphabet');
  const [alphaPreset, setAlphaPreset] = useState<AlphabetPreset>('standard');
  const [wordsPreset, setWordsPreset] = useState<WordsPreset>('time20');

  // Game state for Alphabet mode
  const [alphaSequence, setAlphaSequence] = useState<string>(() => generateRandomSequence(20));
  const [alphaIndex, setAlphaIndex] = useState<number>(0);

  // Game state for Words mode (stream of words, no space pressing needed)
  const [wordsList, setWordsList] = useState<string[]>(() => getRandomWords(50));
  const [wordIndex, setWordIndex] = useState<number>(0);
  const [charInWordIndex, setCharInWordIndex] = useState<number>(0);
  const [completedWordsCount, setCompletedWordsCount] = useState<number>(0);
  const [totalWordCharsTyped, setTotalWordCharsTyped] = useState<number>(0);

  // Common game states
  const [status, setStatus] = useState<GameStatus>('IDLE');
  const [wrongAttempts, setWrongAttempts] = useState<number>(0);
  const [rawElapsedTime, setRawElapsedTime] = useState<number>(0);
  const [, setLastKeyPressed] = useState<string | null>(null);
  const [isErrorFlashing, setIsErrorFlashing] = useState<boolean>(false);
  const [gameSummary, setGameSummary] = useState<GameSummary | null>(null);
  const [isSavingToBackend, setIsSavingToBackend] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // References for precision timing and async loops
  const startTimeRef = useRef<number>(0);
  const timerAnimationRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const modeCategoryRef = useRef<ModeCategory>(modeCategory);
  const wordsPresetRef = useRef<WordsPreset>(wordsPreset);
  const wrongAttemptsRef = useRef<number>(0);
  const alphaIndexRef = useRef<number>(0);
  const alphaSequenceRef = useRef<string>(alphaSequence);
  const wordsListRef = useRef<string[]>(wordsList);
  const wordIndexRef = useRef<number>(0);
  const totalWordCharsTypedRef = useRef<number>(0);
  const completedWordsRef = useRef<number>(0);

  modeCategoryRef.current = modeCategory;
  wordsPresetRef.current = wordsPreset;
  wrongAttemptsRef.current = wrongAttempts;
  alphaIndexRef.current = alphaIndex;
  alphaSequenceRef.current = alphaSequence;
  wordsListRef.current = wordsList;
  wordIndexRef.current = wordIndex;
  totalWordCharsTypedRef.current = totalWordCharsTyped;
  completedWordsRef.current = completedWordsCount;

  // Calculate live total time & countdown
  const penaltyTime = Number((wrongAttempts * 0.5).toFixed(2));
  const currentTotalTime = Number((rawElapsedTime + penaltyTime).toFixed(2));

  // Word Mode duration limit in seconds
  const targetWordDuration = WORDS_CONFIG[wordsPreset]?.durationSeconds || 20;
  const wordTimeRemaining = Math.max(0, targetWordDuration - rawElapsedTime);

  // Live total characters typed for WPM
  const totalCorrectChars = modeCategory === 'words' ? totalWordCharsTyped : alphaIndex;
  const liveWpm =
    rawElapsedTime > 0
      ? Math.round((totalCorrectChars / 5) / (rawElapsedTime / 60))
      : 0;
  const liveAccuracy =
    totalCorrectChars + wrongAttempts > 0
      ? Number(((totalCorrectChars / (totalCorrectChars + wrongAttempts)) * 100).toFixed(1))
      : 100;

  // Keep input focused automatically
  const focusInput = useCallback(() => {
    if (inputRef.current) {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        activeEl !== inputRef.current &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.closest('.fixed') ||
          activeEl.closest('form'))
      ) {
        return;
      }
      inputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    focusInput();
    const handleWindowClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'BUTTON' ||
        target.closest('form') ||
        target.closest('.fixed') ||
        target.closest('header') ||
        target.closest('nav')
      ) {
        return;
      }
      focusInput();
    };
    window.addEventListener('click', handleWindowClick);
    return () => window.removeEventListener('click', handleWindowClick);
  }, [focusInput]);

  // Handle completion (Alphabet or Word Mode)
  const handleGameCompletion = useCallback(
    async (
      finalRawTime: number,
      finalWrongAttempts: number,
      currentSeqStr: string,
      finalCharCount: number
    ) => {
      if (timerAnimationRef.current) {
        cancelAnimationFrame(timerAnimationRef.current);
        timerAnimationRef.current = null;
      }

      const seqLen = finalCharCount;
      const finalPenalty = Number((finalWrongAttempts * 0.5).toFixed(2));
      const finalTotalTime = Number((finalRawTime + finalPenalty).toFixed(2));
      const prevBest = bestScore;
      const isNewBest = prevBest === null || finalTotalTime < prevBest;

      const totalKeyStrokes = seqLen + finalWrongAttempts;
      const accuracy = totalKeyStrokes > 0 ? (seqLen / totalKeyStrokes) * 100 : 100;
      const cps = finalRawTime > 0 ? seqLen / finalRawTime : 0;

      const summary: GameSummary = {
        sequence: currentSeqStr.slice(0, Math.min(seqLen, 100)),
        rawTime: Number(finalRawTime.toFixed(2)),
        penaltyTime: finalPenalty,
        totalTime: finalTotalTime,
        wrongAttempts: finalWrongAttempts,
        correctChars: seqLen,
        isNewBestScore: isNewBest,
        previousBest: prevBest,
        accuracy: Number(accuracy.toFixed(1)),
        cps: Number(cps.toFixed(2)),
      };

      setGameSummary(summary);
      setStatus('FINISHED');

      if (isNewBest) {
        onUpdateBestScore(finalTotalTime);
        playSuccessSound(isMuted);
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#f59e0b', '#10b981', '#3b82f6', '#ec4899'],
        });
      } else {
        playFinishSound(isMuted);
      }

      // Save result to GraphQL backend if logged in and token is active
      const token = getAuthToken();
      if (currentUser && token) {
        setIsSavingToBackend(true);
        setSaveError(null);
        try {
          const saveRes: any = await executeGraphQL(SAVE_GAME_MUTATION, {
            input: {
              rawTime: Number(finalRawTime.toFixed(2)),
              wrongAttempts: finalWrongAttempts,
              sequence: currentSeqStr.slice(0, Math.min(seqLen, 100)),
              correctChars: seqLen,
            },
          });

          // STEP 1: Check if the user's high score was beaten
          // STEP 2: If beaten, check if the score has beaten someone's high score on the leaderboard
          if (isNewBest) {
            let beatSomeoneOnLeaderboard = Boolean(saveRes?.saveGameResult?.isLeaderboardBeaten);

            // Client-side fallback check against cached leaderboard
            if (!beatSomeoneOnLeaderboard) {
              try {
                const cached = localStorage.getItem('typing_speed_cache_lb_ALL_TIME');
                if (cached) {
                  const cachedLb: any[] = JSON.parse(cached);
                  beatSomeoneOnLeaderboard = cachedLb.some(
                    (entry) => entry.userId !== currentUser.id && finalTotalTime < entry.bestTime
                  );
                }
              } catch {}
            }

            // STEP 3: If YES, update the interface. If NOT, remain as is to avoid lapses in the interface
            if (beatSomeoneOnLeaderboard) {
              try {
                window.dispatchEvent(
                  new CustomEvent('typing_speed_leaderboard_sync', {
                    detail: { beaten: true, newTime: finalTotalTime, user: currentUser.username },
                  })
                );
                if (typeof BroadcastChannel !== 'undefined') {
                  const channel = new BroadcastChannel('typing_speed_sync_channel');
                  channel.postMessage({
                    type: 'LEADERBOARD_SCORE_BEATEN',
                    timestamp: Date.now(),
                    userId: currentUser.id,
                    newTime: finalTotalTime,
                  });
                  channel.close();
                }
              } catch {}
            }
          }
          // If highscore is not beaten, or didn't beat someone else's score: remain without triggering UI lapses.
        } catch (err: any) {
          // Log user-friendly notice without breaking game completion
          setSaveError(err?.message || 'Failed to sync with server');
        } finally {
          setIsSavingToBackend(false);
        }
      }
    },
    [bestScore, currentUser, isMuted, onUpdateBestScore]
  );

  // High precision timer loop with Word Mode countdown cutoff
  const updateTimer = useCallback(() => {
    if (startTimeRef.current > 0) {
      const now = performance.now();
      const elapsedSeconds = (now - startTimeRef.current) / 1000;

      if (modeCategoryRef.current === 'words') {
        const targetDuration = WORDS_CONFIG[wordsPresetRef.current]?.durationSeconds || 20;
        if (elapsedSeconds >= targetDuration) {
          setRawElapsedTime(targetDuration);
          const seqSummary = wordsListRef.current.slice(0, wordIndexRef.current + 1).join(' ');
          handleGameCompletion(
            targetDuration,
            wrongAttemptsRef.current,
            seqSummary,
            totalWordCharsTypedRef.current
          );
          return;
        }
      }

      setRawElapsedTime(elapsedSeconds);
      timerAnimationRef.current = requestAnimationFrame(updateTimer);
    }
  }, [handleGameCompletion]);

  // Reset and prepare new game sequence
  const restartGame = useCallback(
    (newCategory?: ModeCategory, newAlpha?: AlphabetPreset, newWords?: WordsPreset) => {
      if (timerAnimationRef.current) {
        cancelAnimationFrame(timerAnimationRef.current);
        timerAnimationRef.current = null;
      }
      startTimeRef.current = 0;

      const targetCategory = newCategory || modeCategory;

      if (targetCategory === 'alphabet') {
        const preset = newAlpha || alphaPreset;
        const len = ALPHABET_CONFIG[preset]?.length ?? 20;
        setAlphaSequence(generateRandomSequence(len));
        setAlphaIndex(0);
      } else {
        setWordsList(getRandomWords(50));
        setWordIndex(0);
        setCharInWordIndex(0);
        setCompletedWordsCount(0);
        setTotalWordCharsTyped(0);
      }

      setStatus('IDLE');
      setWrongAttempts(0);
      setRawElapsedTime(0);
      setLastKeyPressed(null);
      setIsErrorFlashing(false);
      setGameSummary(null);
      setSaveError(null);
      setTimeout(focusInput, 50);
    },
    [alphaPreset, focusInput, modeCategory]
  );

  // Key press processing
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const rawKey = e.key;
    const upperKey = rawKey.toUpperCase();

    // If game is finished, allow restart keys
    if (status === 'FINISHED') {
      if (rawKey === ' ' || rawKey === 'Enter' || upperKey === 'R') {
        e.preventDefault();
        restartGame();
      }
      return;
    }

    // Escape allows quick reset when playing
    if (rawKey === 'Escape') {
      e.preventDefault();
      restartGame();
      return;
    }

    // Only process standard alphabet keys (A-Z)
    const isAlphabetKey = /^[A-Z]$/.test(upperKey);
    if (!isAlphabetKey) {
      return;
    }

    e.preventDefault();
    setLastKeyPressed(upperKey);

    // If IDLE, start timer on first keypress
    if (status === 'IDLE') {
      setStatus('PLAYING');
      startTimeRef.current = performance.now();
      timerAnimationRef.current = requestAnimationFrame(updateTimer);
    }

    if (modeCategory === 'words') {
      // ----------------------------------------------------
      // Words Mode (No Space Needed: Automatically advances to next word!)
      // ----------------------------------------------------
      const currentWord = wordsList[wordIndex] || '';
      const expectedChar = currentWord[charInWordIndex] || '';

      if (upperKey === expectedChar) {
        // Correct letter typed!
        playKeySound(isMuted);
        setIsErrorFlashing(false);
        setTotalWordCharsTyped((prev) => prev + 1);

        const isLastCharOfWord = charInWordIndex === currentWord.length - 1;

        if (isLastCharOfWord) {
          // Word complete! Instantly move to next word with no space key needed
          setCompletedWordsCount((prev) => prev + 1);
          setWordIndex((prev) => prev + 1);
          setCharInWordIndex(0);

          // Append more words if approaching end of queue
          if (wordIndex >= wordsList.length - 15) {
            setWordsList((prev) => [...prev, ...getRandomWords(25)]);
          }
        } else {
          // Advance to next letter in current word
          setCharInWordIndex((prev) => prev + 1);
        }
      } else {
        // Mistake in word mode
        playErrorSound(isMuted);
        setWrongAttempts((prev) => prev + 1);
        setIsErrorFlashing(true);
        setTimeout(() => setIsErrorFlashing(false), 300);
      }
    } else {
      // ----------------------------------------------------
      // Alphabet Mode (Single character sequence)
      // ----------------------------------------------------
      const expectedChar = alphaSequence[alphaIndex];
      if (upperKey === expectedChar) {
        playKeySound(isMuted);
        setIsErrorFlashing(false);

        const nextIndex = alphaIndex + 1;
        setAlphaIndex(nextIndex);

        if (nextIndex >= alphaSequence.length) {
          const finalRaw = (performance.now() - startTimeRef.current) / 1000;
          handleGameCompletion(finalRaw, wrongAttempts, alphaSequence, alphaSequence.length);
        }
      } else {
        playErrorSound(isMuted);
        setWrongAttempts((prev) => prev + 1);
        setIsErrorFlashing(true);
        setTimeout(() => setIsErrorFlashing(false), 300);
      }
    }
  };

  // Currently expected character
  const currentExpectedKeyDisplay =
    modeCategory === 'words'
      ? wordsList[wordIndex]?.[charInWordIndex] || ''
      : alphaSequence[alphaIndex] || '';

  // Progress percentage
  const progressPercent =
    modeCategory === 'words'
      ? Math.min(100, Math.round((rawElapsedTime / targetWordDuration) * 100))
      : Math.min(100, Math.round((alphaIndex / (alphaSequence.length || 1)) * 100));

  const activeWord = wordsList[wordIndex] || '';

  return (
    <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center justify-center px-4 py-8">
      {/* Hidden input to capture continuous keyboard events */}
      <input
        ref={inputRef}
        id="game-keyboard-capture"
        type="text"
        value=""
        onChange={() => {}}
        onKeyDown={handleKeyDown}
        className="absolute h-0 w-0 opacity-0 pointer-events-none"
        aria-hidden="true"
        autoFocus
      />

      {/* Main Game Card */}
      <div
        id="typing-game-card"
        onClick={focusInput}
        className={`relative w-full rounded-2xl border p-6 sm:p-10 shadow-2xl transition-all duration-200 backdrop-blur-xl ${
          isDark ? 'bg-[#080808]' : 'bg-white'
        } ${
          isErrorFlashing
            ? 'border-rose-500/80 shadow-rose-950/50 ring-2 ring-rose-500/30 animate-shake'
            : status === 'PLAYING'
            ? 'border-[#F27D26]/70 shadow-[#F27D26]/10 ring-1 ring-[#F27D26]/30'
            : isDark
            ? 'border-white/10 shadow-black/80'
            : 'border-zinc-200/80 shadow-zinc-200/60'
        }`}
      >
        {/* Top Header Metrics */}
        <div
          className={`flex flex-wrap items-center justify-between gap-4 border-b pb-6 ${
            isDark ? 'border-white/10' : 'border-zinc-200'
          }`}
        >
          {/* Timer Display */}
          <div className="flex items-center space-x-3">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-xl border transition ${
                status === 'PLAYING'
                  ? 'border-[#F27D26]/40 bg-[#F27D26]/10 text-[#F27D26]'
                  : isDark
                  ? 'border-white/10 bg-[#0C0C0C] text-white/40'
                  : 'border-zinc-200 bg-zinc-100 text-zinc-500'
              }`}
            >
              {modeCategory === 'words' ? (
                <Clock className="h-5 w-5" />
              ) : (
                <Timer className="h-5 w-5" />
              )}
            </div>
            <div>
              <div
                className={`text-[10px] font-medium tracking-[0.2em] uppercase ${
                  isDark ? 'text-white/40' : 'text-zinc-500'
                }`}
              >
                {modeCategory === 'words' ? 'Time Remaining' : 'Stopwatch'}
              </div>
              <div
                id="timer-display"
                className={`font-mono text-2xl sm:text-3xl font-bold tracking-tight ${
                  isDark ? 'text-white' : 'text-zinc-950'
                }`}
              >
                {modeCategory === 'words' ? (
                  <span>
                    {wordTimeRemaining.toFixed(1)}
                    <span className={`text-sm font-normal ml-1 ${isDark ? 'text-white/40' : 'text-zinc-400'}`}>
                      / {WORDS_CONFIG[wordsPreset]?.label}
                    </span>
                  </span>
                ) : (
                  <span>
                    {currentTotalTime.toFixed(2)}
                    <span className={`text-sm font-normal ml-1 ${isDark ? 'text-white/40' : 'text-zinc-400'}`}>s</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Penalty Indicator */}
          <div className="flex items-center space-x-2">
            <div
              id="penalty-counter-badge"
              className={`flex items-center space-x-1.5 rounded-xl border px-3 py-1.5 transition ${
                wrongAttempts > 0
                  ? isDark
                    ? 'border-rose-500/40 bg-rose-950/40 text-rose-300 shadow-sm shadow-rose-950/50'
                    : 'border-rose-300 bg-rose-50 text-rose-700 shadow-xs'
                  : isDark
                  ? 'border-white/10 bg-[#0C0C0C] text-white/40'
                  : 'border-zinc-200 bg-zinc-50 text-zinc-500'
              }`}
            >
              <AlertTriangle
                className={`h-4 w-4 ${
                  wrongAttempts > 0
                    ? isDark
                      ? 'text-rose-400'
                      : 'text-rose-600'
                    : isDark
                    ? 'text-white/30'
                    : 'text-zinc-400'
                }`}
              />
              <div className="text-xs font-semibold">
                <span className={`text-[10px] uppercase tracking-wider mr-1 ${isDark ? 'text-white/40' : 'text-zinc-500'}`}>
                  Penalty:
                </span>
                <span className={`font-mono font-bold ${isDark ? 'text-rose-400' : 'text-rose-600'}`}>
                  +{penaltyTime.toFixed(2)}s
                </span>
                <span className={`ml-1 text-[10px] ${isDark ? 'text-white/30' : 'text-zinc-400'}`}>
                  ({wrongAttempts} {wrongAttempts === 1 ? 'error' : 'errors'})
                </span>
              </div>
            </div>
          </div>

          {/* Progress / Words Completed */}
          <div className="flex items-center space-x-3">
            <div className="text-right">
              <div
                className={`text-[10px] font-medium tracking-[0.2em] uppercase ${
                  isDark ? 'text-white/40' : 'text-zinc-500'
                }`}
              >
                {modeCategory === 'words' ? 'Words Typed' : 'Progress'}
              </div>
              <div
                id="progress-counter"
                className="font-mono text-xl sm:text-2xl font-bold text-[#F27D26]"
              >
                {modeCategory === 'words' ? (
                  <span>
                    {completedWordsCount}{' '}
                    <span className={`text-sm font-normal ${isDark ? 'text-white/40' : 'text-zinc-400'}`}>
                      words
                    </span>
                  </span>
                ) : (
                  <span>
                    {alphaIndex}{' '}
                    <span className={`text-sm font-normal ${isDark ? 'text-white/40' : 'text-zinc-400'}`}>
                      / {alphaSequence.length}
                    </span>
                  </span>
                )}
              </div>
            </div>
            <div
              className={`h-10 w-10 flex items-center justify-center rounded-xl border font-mono text-xs font-bold text-[#F27D26] ${
                isDark ? 'border-white/10 bg-[#0C0C0C]' : 'border-zinc-200 bg-zinc-50'
              }`}
            >
              <span>{progressPercent}%</span>
            </div>
          </div>
        </div>

        {/* Mode Selector & Duration Presets (20s, 30s, 1:00 min) */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Category Toggle: Alphabets vs Words */}
            <div
              className={`flex items-center space-x-1 rounded-xl border p-1 ${
                isDark ? 'border-white/10 bg-[#060606]' : 'border-zinc-200 bg-zinc-100'
              }`}
            >
              <button
                id="btn-category-alphabet"
                onClick={() => {
                  if (status === 'PLAYING') return;
                  setModeCategory('alphabet');
                  restartGame('alphabet', alphaPreset, wordsPreset);
                }}
                disabled={status === 'PLAYING'}
                className={`flex items-center space-x-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition ${
                  modeCategory === 'alphabet'
                    ? 'bg-[#F27D26] text-black font-bold shadow-sm'
                    : isDark
                    ? 'text-white/50 hover:text-white disabled:opacity-40'
                    : 'text-zinc-600 hover:text-zinc-950 disabled:opacity-40'
                }`}
              >
                <Type className="h-3.5 w-3.5" />
                <span>Alphabets</span>
              </button>

              <button
                id="btn-category-words"
                onClick={() => {
                  if (status === 'PLAYING') return;
                  setModeCategory('words');
                  restartGame('words', alphaPreset, wordsPreset);
                }}
                disabled={status === 'PLAYING'}
                className={`flex items-center space-x-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition ${
                  modeCategory === 'words'
                    ? 'bg-[#F27D26] text-black font-bold shadow-sm'
                    : isDark
                    ? 'text-white/50 hover:text-white disabled:opacity-40'
                    : 'text-zinc-600 hover:text-zinc-950 disabled:opacity-40'
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Words</span>
              </button>
            </div>

            {/* Presets based on selected mode */}
            <div
              className={`flex items-center space-x-1 rounded-xl border p-1 ${
                isDark ? 'border-white/10 bg-[#060606]' : 'border-zinc-200 bg-zinc-100'
              }`}
            >
              {modeCategory === 'alphabet'
                ? (Object.keys(ALPHABET_CONFIG) as AlphabetPreset[]).map((p) => (
                    <button
                      key={p}
                      id={`btn-preset-alpha-${p}`}
                      onClick={() => {
                        if (status === 'PLAYING') return;
                        setAlphaPreset(p);
                        restartGame('alphabet', p, wordsPreset);
                      }}
                      disabled={status === 'PLAYING'}
                      className={`rounded-lg px-2.5 py-0.5 text-[11px] font-medium transition ${
                        alphaPreset === p
                          ? isDark
                            ? 'bg-white/15 text-white font-bold'
                            : 'bg-white text-zinc-950 font-bold shadow-xs'
                          : isDark
                          ? 'text-white/40 hover:text-white disabled:opacity-40'
                          : 'text-zinc-600 hover:text-zinc-950 disabled:opacity-40'
                      }`}
                    >
                      {ALPHABET_CONFIG[p].label}
                    </button>
                  ))
                : (Object.keys(WORDS_CONFIG) as WordsPreset[]).map((p) => (
                    <button
                      key={p}
                      id={`btn-preset-words-${p}`}
                      onClick={() => {
                        if (status === 'PLAYING') return;
                        setWordsPreset(p);
                        restartGame('words', alphaPreset, p);
                      }}
                      disabled={status === 'PLAYING'}
                      className={`rounded-lg px-2.5 py-0.5 text-[11px] font-medium transition ${
                        wordsPreset === p
                          ? isDark
                            ? 'bg-white/15 text-white font-bold'
                            : 'bg-white text-zinc-950 font-bold shadow-xs'
                          : isDark
                          ? 'text-white/40 hover:text-white disabled:opacity-40'
                          : 'text-zinc-600 hover:text-zinc-950 disabled:opacity-40'
                      }`}
                    >
                      {WORDS_CONFIG[p].label}
                    </button>
                  ))}
            </div>
          </div>

          {/* Live Speed & Accuracy */}
          <div className="flex items-center space-x-4 text-xs font-mono">
            <div className={`flex items-center space-x-1.5 ${isDark ? 'text-white/60' : 'text-zinc-600'}`}>
              <span className={`text-[10px] uppercase tracking-wider ${isDark ? 'text-white/30' : 'text-zinc-400'}`}>
                Speed:
              </span>
              <span className={`font-bold ${isDark ? 'text-white/90' : 'text-zinc-900'}`}>{liveWpm} WPM</span>
            </div>
            <div className={`flex items-center space-x-1.5 ${isDark ? 'text-white/60' : 'text-zinc-600'}`}>
              <span className={`text-[10px] uppercase tracking-wider ${isDark ? 'text-white/30' : 'text-zinc-400'}`}>
                Accuracy:
              </span>
              <span
                className={`font-bold ${
                  liveAccuracy >= 95
                    ? isDark
                      ? 'text-emerald-400'
                      : 'text-emerald-600'
                    : liveAccuracy >= 80
                    ? isDark
                      ? 'text-amber-400'
                      : 'text-amber-600'
                    : isDark
                    ? 'text-rose-400'
                    : 'text-rose-600'
                }`}
              >
                {liveAccuracy}%
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic Progress Bar */}
        <div
          className={`mt-3 h-1.5 w-full overflow-hidden rounded-full ${
            isDark ? 'bg-white/10' : 'bg-zinc-200'
          }`}
        >
          <div
            id="progress-bar-fill"
            className="h-full bg-[#F27D26] transition-all duration-150 ease-out shadow-sm shadow-[#F27D26]/50"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Active Typing Display Area */}
        {status !== 'FINISHED' ? (
          <div className="my-8 flex flex-col items-center justify-center text-center">
            {/* Penalty Alert Banner on Wrong Key Press */}
            <div className="h-7 mb-2 flex items-center justify-center">
              {isErrorFlashing ? (
                <div
                  id="penalty-alert-flash"
                  className={`inline-flex items-center space-x-1.5 rounded-full border px-3 py-0.5 text-xs font-bold animate-bounce ${
                    isDark
                      ? 'border-rose-500/50 bg-rose-500/20 text-rose-300'
                      : 'border-rose-300 bg-rose-100 text-rose-800'
                  }`}
                >
                  <AlertTriangle className={`h-3.5 w-3.5 ${isDark ? 'text-rose-400' : 'text-rose-600'}`} />
                  <span>+0.50s Penalty Added!</span>
                </div>
              ) : status === 'IDLE' ? (
                <span
                  className={`text-xs font-mono uppercase tracking-[0.15em] ${
                    isDark ? 'text-white/40' : 'text-zinc-500'
                  }`}
                >
                  {modeCategory === 'words'
                    ? `Press any key to start ${WORDS_CONFIG[wordsPreset]?.label} challenge`
                    : 'Press any key to engage stopwatch (0.00s)'}
                </span>
              ) : (
                <span className="text-xs font-medium text-[#F27D26] flex items-center space-x-1 font-semibold">
                  <Flame className="h-3.5 w-3.5" />
                  <span>
                    {modeCategory === 'words'
                      ? `${wordTimeRemaining.toFixed(1)}s remaining • Auto-advancing words`
                      : 'Protocol Active • Maintain Velocity'}
                  </span>
                </span>
              )}
            </div>

            {/* Display Area: Words Mode vs Alphabet Mode */}
            {modeCategory === 'words' ? (
              /* Words Mode Visual Display (Auto-advance upon completing word) */
              <div className="w-full my-4 flex flex-col items-center">
                {/* Prominent Active Word Card */}
                <div className="relative my-2 flex items-center justify-center w-full max-w-lg">
                  <div className="absolute -inset-4 rounded-3xl bg-[#F27D26]/10 blur-xl transition-all pointer-events-none" />

                  <div
                    id="current-word-card"
                    className={`relative w-full py-8 px-6 flex flex-col items-center justify-center rounded-2xl border transition-all duration-150 select-none ${
                      isErrorFlashing
                        ? isDark
                          ? 'border-rose-500 bg-rose-950/60 scale-98 shadow-rose-900/50'
                          : 'border-rose-400 bg-rose-50 scale-98 shadow-rose-200'
                        : isDark
                        ? 'border-white/15 bg-[#0C0C0C] shadow-black/80'
                        : 'border-zinc-200 bg-zinc-50 shadow-zinc-200'
                    }`}
                  >
                    <div className="flex items-center justify-center tracking-widest text-4xl sm:text-6xl font-bold font-mono">
                      {activeWord.split('').map((letter, lIdx) => {
                        const isTyped = lIdx < charInWordIndex;
                        const isCurrentChar = lIdx === charInWordIndex;
                        return (
                          <span
                            key={lIdx}
                            className={`transition-colors duration-100 ${
                              isTyped
                                ? 'text-emerald-400 font-extrabold'
                                : isCurrentChar
                                ? 'text-[#F27D26] underline decoration-[#F27D26] decoration-4 underline-offset-8 animate-pulse'
                                : isDark
                                ? 'text-white/30'
                                : 'text-zinc-400'
                            }`}
                          >
                            {letter}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Sub-label & Keyboard Cue */}
                <div
                  className={`mt-3 flex items-center space-x-2 text-xs font-medium ${
                    isDark ? 'text-white/40' : 'text-zinc-500'
                  }`}
                >
                  <Keyboard className="h-4 w-4 text-[#F27D26]" />
                  <span>
                    Press key:{' '}
                    <kbd
                      className={`rounded border px-2 py-0.5 font-mono font-bold text-[#F27D26] ${
                        isDark ? 'border-white/20 bg-white/5' : 'border-zinc-300 bg-zinc-100'
                      }`}
                    >
                      {currentExpectedKeyDisplay}
                    </kbd>
                  </span>
                </div>

                {/* Word Ribbon Stream */}
                <div
                  className={`mt-6 w-full max-w-2xl rounded-2xl border p-4 shadow-inner ${
                    isDark ? 'border-white/10 bg-[#060606]/80' : 'border-zinc-200 bg-zinc-50'
                  }`}
                >
                  <div
                    className={`mb-2 flex items-center justify-between px-1 text-[10px] font-mono uppercase tracking-wider ${
                      isDark ? 'text-white/40' : 'text-zinc-500'
                    }`}
                  >
                    <span>Upcoming Words</span>
                    <span>{completedWordsCount} words completed</span>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2 py-1 max-h-28 overflow-hidden">
                    {wordsList.slice(wordIndex, wordIndex + 10).map((w, idx) => {
                      const isCurrent = idx === 0;
                      return (
                        <div
                          key={idx}
                          className={`px-3 py-1 rounded-lg border font-mono text-xs sm:text-sm font-semibold transition select-none ${
                            isCurrent
                              ? 'border-[#F27D26] bg-[#F27D26]/20 text-[#F27D26] font-bold ring-2 ring-[#F27D26]/50 shadow-xs'
                              : isDark
                              ? 'border-white/5 bg-[#0C0C0C] text-white/50'
                              : 'border-zinc-200 bg-white text-zinc-600'
                          }`}
                        >
                          {w}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              /* Alphabet Mode Visual Display */
              <div className="w-full flex flex-col items-center">
                {/* Big Alphabet Display Card */}
                <div className="relative my-4 flex items-center justify-center">
                  <div className="absolute -inset-6 rounded-3xl bg-[#F27D26]/10 blur-2xl transition-all pointer-events-none" />

                  <div
                    id="current-alphabet-display"
                    className={`relative flex h-36 w-36 sm:h-44 sm:w-44 items-center justify-center rounded-2xl border text-7xl sm:text-8xl font-serif italic shadow-2xl transition-all duration-150 select-none ${
                      isErrorFlashing
                        ? isDark
                          ? 'border-rose-500 bg-rose-950/60 text-rose-400 scale-95 shadow-rose-900/50'
                          : 'border-rose-400 bg-rose-50 text-rose-600 scale-95 shadow-rose-200'
                        : isDark
                        ? 'border-white/15 bg-[#0C0C0C] text-[#F27D26] shadow-black/80'
                        : 'border-zinc-200 bg-zinc-50 text-[#F27D26] shadow-zinc-200'
                    }`}
                  >
                    {currentExpectedKeyDisplay}
                  </div>
                </div>

                {/* Sub-label & Keyboard Cue */}
                <div
                  className={`mt-4 flex items-center space-x-2 text-xs font-medium ${
                    isDark ? 'text-white/40' : 'text-zinc-500'
                  }`}
                >
                  <Keyboard className="h-4 w-4 text-[#F27D26]" />
                  <span>
                    Press key:{' '}
                    <kbd
                      className={`rounded border px-2 py-0.5 font-mono font-bold text-[#F27D26] ${
                        isDark ? 'border-white/20 bg-white/5' : 'border-zinc-300 bg-zinc-100'
                      }`}
                    >
                      {currentExpectedKeyDisplay}
                    </kbd>
                  </span>
                </div>

                {/* Sequence Queue Preview Bar */}
                <div
                  className={`mt-8 w-full max-w-2xl rounded-2xl border p-3 sm:p-4 shadow-inner ${
                    isDark ? 'border-white/10 bg-[#060606]/80' : 'border-zinc-200 bg-zinc-50'
                  }`}
                >
                  <div
                    className={`mb-2 flex items-center justify-between px-1 text-[10px] font-mono uppercase tracking-wider ${
                      isDark ? 'text-white/40' : 'text-zinc-500'
                    }`}
                  >
                    <span>Sequence Track ({alphaIndex}/{alphaSequence.length})</span>
                    <span>{alphaSequence.length - alphaIndex} remaining</span>
                  </div>
                  <div
                    id="sequence-letters-container"
                    className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 py-1"
                  >
                    {alphaSequence.split('').map((char, idx) => {
                      const isPast = idx < alphaIndex;
                      const isCurrent = idx === alphaIndex;
                      return (
                        <div
                          key={idx}
                          id={`seq-char-${idx}`}
                          className={`shrink-0 aspect-square w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 flex items-center justify-center rounded-lg border font-mono text-xs sm:text-sm font-bold transition-all duration-150 select-none ${
                            isPast
                              ? isDark
                                ? 'border-emerald-500/30 bg-[#07160E] text-emerald-400 opacity-80'
                                : 'border-emerald-300 bg-emerald-50 text-emerald-700'
                              : isCurrent
                              ? 'border-[#F27D26] bg-[#F27D26]/20 text-[#F27D26] ring-2 ring-[#F27D26]/60 shadow-sm shadow-[#F27D26]/30 font-extrabold'
                              : isDark
                              ? 'border-white/5 bg-[#0C0C0C] text-white/30'
                              : 'border-zinc-200 bg-white text-zinc-400'
                          }`}
                        >
                          {char}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Result Card on Game Completion */
          <div id="game-results-card" className="my-6 text-center animate-fadeIn">
            {/* Status Banner */}
            <div className="mb-6 flex flex-col items-center">
              {gameSummary?.isNewBestScore ? (
                <div
                  className={`inline-flex items-center space-x-3 rounded-2xl border px-6 py-3 shadow-xl ${
                    isDark
                      ? 'border-emerald-500/40 bg-[#07160E] text-emerald-300'
                      : 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  }`}
                >
                  <Sparkles
                    className={`h-6 w-6 animate-pulse ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}
                  />
                  <div className="text-left">
                    <div
                      className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${
                        isDark ? 'text-emerald-400' : 'text-emerald-600'
                      }`}
                    >
                      Personal Record Beaten
                    </div>
                    <div
                      className={`text-base sm:text-lg font-serif font-bold ${
                        isDark ? 'text-white' : 'text-zinc-950'
                      }`}
                    >
                      🎉 SUCCESS! New Personal Best Record!
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className={`inline-flex items-center space-x-3 rounded-2xl border px-6 py-3 shadow-lg ${
                    isDark
                      ? 'border-white/15 bg-[#0C0C0C] text-[#D1D1D1]'
                      : 'border-zinc-200 bg-zinc-50 text-zinc-800'
                  }`}
                >
                  <CheckCircle className="h-6 w-6 text-[#F27D26]" />
                  <div className="text-left">
                    <div
                      className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${
                        isDark ? 'text-white/40' : 'text-zinc-500'
                      }`}
                    >
                      Challenge Completed
                    </div>
                    <div
                      className={`text-base sm:text-lg font-serif font-bold ${
                        isDark ? 'text-white' : 'text-zinc-950'
                      }`}
                    >
                      {modeCategory === 'words'
                        ? `Finished ${WORDS_CONFIG[wordsPreset]?.label} challenge with ${completedWordsCount} words!`
                        : `Try Again to beat your record (${bestScore?.toFixed(2)}s)`}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Score & Timing Metrics Bento Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-left my-6">
              {/* Primary Metric */}
              <div
                className={`rounded-xl border p-4 ${
                  isDark ? 'border-[#F27D26]/40 bg-[#F27D26]/10' : 'border-[#F27D26]/30 bg-amber-50/70'
                }`}
              >
                <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#F27D26]">
                  {modeCategory === 'words' ? 'Words Completed' : 'Final Score'}
                </span>
                <div
                  className={`mt-1 font-mono text-2xl sm:text-3xl font-bold ${
                    isDark ? 'text-white' : 'text-zinc-950'
                  }`}
                >
                  {modeCategory === 'words' ? `${completedWordsCount} words` : `${gameSummary?.totalTime.toFixed(2)}s`}
                </div>
                <span
                  className={`text-[10px] uppercase tracking-wider ${
                    isDark ? 'text-white/40' : 'text-zinc-500'
                  }`}
                >
                  {modeCategory === 'words'
                    ? `${Math.round(((gameSummary?.correctChars || 0) / 5) / ((gameSummary?.rawTime || 1) / 60))} WPM`
                    : 'Lower is better'}
                </span>
              </div>

              {/* Base Duration */}
              <div
                className={`rounded-xl border p-4 ${
                  isDark ? 'border-white/10 bg-[#0C0C0C]' : 'border-zinc-200 bg-zinc-50'
                }`}
              >
                <span
                  className={`text-[10px] font-semibold uppercase tracking-[0.15em] ${
                    isDark ? 'text-white/40' : 'text-zinc-500'
                  }`}
                >
                  Duration
                </span>
                <div
                  className={`mt-1 font-mono text-xl sm:text-2xl font-bold ${
                    isDark ? 'text-white/90' : 'text-zinc-900'
                  }`}
                >
                  {gameSummary?.rawTime.toFixed(2)}s
                </div>
                <span
                  className={`text-[10px] uppercase tracking-wider ${
                    isDark ? 'text-white/30' : 'text-zinc-400'
                  }`}
                >
                  {modeCategory === 'words' ? WORDS_CONFIG[wordsPreset]?.label : 'Raw duration'}
                </span>
              </div>

              {/* Penalty Applied */}
              <div
                className={`rounded-xl border p-4 ${
                  isDark ? 'border-white/10 bg-[#0C0C0C]' : 'border-zinc-200 bg-zinc-50'
                }`}
              >
                <span
                  className={`text-[10px] font-semibold uppercase tracking-[0.15em] ${
                    isDark ? 'text-white/40' : 'text-zinc-500'
                  }`}
                >
                  Penalties
                </span>
                <div
                  className={`mt-1 font-mono text-xl sm:text-2xl font-bold ${
                    isDark ? 'text-rose-400' : 'text-rose-600'
                  }`}
                >
                  +{gameSummary?.penaltyTime.toFixed(2)}s
                </div>
                <span
                  className={`text-[10px] uppercase tracking-wider ${
                    isDark ? 'text-white/30' : 'text-zinc-400'
                  }`}
                >
                  {gameSummary?.wrongAttempts} errors (+0.5s)
                </span>
              </div>

              {/* Typing Accuracy */}
              <div
                className={`rounded-xl border p-4 ${
                  isDark ? 'border-white/10 bg-[#0C0C0C]' : 'border-zinc-200 bg-zinc-50'
                }`}
              >
                <span
                  className={`text-[10px] font-semibold uppercase tracking-[0.15em] ${
                    isDark ? 'text-white/40' : 'text-zinc-500'
                  }`}
                >
                  Accuracy
                </span>
                <div
                  className={`mt-1 font-mono text-xl sm:text-2xl font-bold ${
                    isDark ? 'text-emerald-400' : 'text-emerald-600'
                  }`}
                >
                  {gameSummary?.accuracy}%
                </div>
                <span
                  className={`text-[10px] uppercase tracking-wider ${
                    isDark ? 'text-white/30' : 'text-zinc-400'
                  }`}
                >
                  {gameSummary?.cps} char/sec
                </span>
              </div>
            </div>

            {/* Backend Sync Notification */}
            {currentUser ? (
              <div
                className={`mb-4 text-xs flex items-center justify-center space-x-1.5 ${
                  isDark ? 'text-white/50' : 'text-zinc-600'
                }`}
              >
                {isSavingToBackend ? (
                  <span className="text-[#F27D26] animate-pulse">Syncing score to PostgreSQL GraphQL backend...</span>
                ) : saveError ? (
                  <span className="text-rose-500">{saveError}</span>
                ) : (
                  <span
                    className={`flex items-center space-x-1 ${
                      isDark ? 'text-emerald-400' : 'text-emerald-600'
                    }`}
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    <span>Score synced to your account & global leaderboard!</span>
                  </span>
                )}
              </div>
            ) : (
              <div
                className={`mb-4 rounded-xl border p-3.5 text-xs flex items-center justify-between ${
                  isDark
                    ? 'border-white/10 bg-[#0C0C0C] text-white/70'
                    : 'border-zinc-200 bg-zinc-50 text-zinc-700'
                }`}
              >
                <span>Score stored locally. Sign in to compete on the global leaderboard!</span>
                <button
                  id="btn-result-signin"
                  onClick={onOpenAuth}
                  className="rounded-lg bg-[#F27D26] px-3 py-1 font-semibold text-black hover:bg-[#ff8b38] transition shadow-sm"
                >
                  Sign In / Register
                </button>
              </div>
            )}
          </div>
        )}

        {/* Bottom Actions Bar */}
        <div
          className={`mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-6 ${
            isDark ? 'border-white/10' : 'border-zinc-200'
          }`}
        >
          <button
            id="btn-restart-game"
            onClick={() => restartGame()}
            className="flex items-center space-x-2 rounded-xl bg-[#F27D26] px-5 py-2.5 text-sm font-bold text-black shadow-lg shadow-[#F27D26]/20 hover:bg-[#ff8b38] active:scale-95 transition"
          >
            <RotateCcw className="h-4 w-4" />
            <span>{status === 'FINISHED' ? 'Play Again (Space/Enter)' : 'Restart Game'}</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              id="btn-view-leaderboard-cta"
              onClick={onViewLeaderboard}
              className={`flex items-center space-x-1.5 rounded-xl border px-4 py-2.5 text-xs font-semibold transition ${
                isDark
                  ? 'border-white/10 bg-[#0C0C0C] text-white/80 hover:bg-white/5 hover:text-white'
                  : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950'
              }`}
            >
              <Award className="h-4 w-4 text-[#F27D26]" />
              <span>View Leaderboard</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Helper rules card */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-3 w-full text-xs">
        <div
          className={`rounded-xl border p-3.5 transition-colors ${
            isDark
              ? 'border-white/5 bg-[#080808]/90 text-white/50'
              : 'border-zinc-200 bg-white text-zinc-600 shadow-xs'
          }`}
        >
          <div
            className={`font-semibold flex items-center space-x-1.5 mb-1 text-xs ${
              isDark ? 'text-white' : 'text-zinc-950'
            }`}
          >
            <Timer className="h-3.5 w-3.5 text-[#F27D26]" />
            <span>Timer Starts on Keypress</span>
          </div>
          Starts automatically on your first keystroke.
        </div>
        <div
          className={`rounded-xl border p-3.5 transition-colors ${
            isDark
              ? 'border-white/5 bg-[#080808]/90 text-white/50'
              : 'border-zinc-200 bg-white text-zinc-600 shadow-xs'
          }`}
        >
          <div
            className={`font-semibold flex items-center space-x-1.5 mb-1 text-xs ${
              isDark ? 'text-white' : 'text-zinc-950'
            }`}
          >
            <AlertTriangle className={`h-3.5 w-3.5 ${isDark ? 'text-rose-400' : 'text-rose-600'}`} />
            <span>+0.5s Error Penalty</span>
          </div>
          Each wrong keypress adds a 0.5-second penalty.
        </div>
        <div
          className={`rounded-xl border p-3.5 transition-colors ${
            isDark
              ? 'border-white/5 bg-[#080808]/90 text-white/50'
              : 'border-zinc-200 bg-white text-zinc-600 shadow-xs'
          }`}
        >
          <div
            className={`font-semibold flex items-center space-x-1.5 mb-1 text-xs ${
              isDark ? 'text-white' : 'text-zinc-950'
            }`}
          >
            <TrendingUp className={`h-3.5 w-3.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
            <span>Seamless Auto-Advancing Words</span>
          </div>
          Typing the last letter correctly immediately transitions to the next word.
        </div>
      </div>
    </div>
  );
};
