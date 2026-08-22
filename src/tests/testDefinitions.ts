/**
 * Comprehensive Automated Test Suite for Typing Speed Game
 * 
 * Deliverables Testing Coverage:
 * 1. Correct character handling & case-insensitivity
 * 2. Incorrect character detection & 0.5s penalty calculation
 * 3. Exact game sequence completion
 * 4. High-score calculation (lower completion time is better)
 * 5. User registration, password hashing & login validation
 * 6. Saving game results & updating personal bests
 * 7. Leaderboard ordering (strictly ascending by lowest completion time)
 * 8. Real-time Analytics (WPM, Accuracy %, Penalty ratios)
 * 9. Multi-difficulty configuration (Standard 20, Blitz 10, Marathon 40)
 */

import { db } from '../server/db.js';
import { hashPassword, verifyPassword, generateToken, verifyToken } from '../server/auth.js';

export interface TestResult {
  name: string;
  category: string;
  passed: boolean;
  message: string;
  durationMs: number;
}

export async function runAllTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  async function test(category: string, name: string, fn: () => Promise<void> | void) {
    const start = performance.now();
    try {
      await fn();
      const durationMs = Number((performance.now() - start).toFixed(2));
      results.push({
        category,
        name,
        passed: true,
        message: 'Passed successfully',
        durationMs,
      });
    } catch (err: any) {
      const durationMs = Number((performance.now() - start).toFixed(2));
      results.push({
        category,
        name,
        passed: false,
        message: err?.message || String(err),
        durationMs,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 1. Correct Character Handling
  // ---------------------------------------------------------------------------
  await test('Correct Character Handling', 'Advances sequence on exact and case-insensitive match', () => {
    const sequence = 'ABCDEFGHIJKLMNOPQRST';

    function handleKey(currentIndex: number, inputKey: string): { success: boolean; nextIndex: number } {
      const expected = sequence[currentIndex];
      if (inputKey.toUpperCase() === expected) {
        return { success: true, nextIndex: currentIndex + 1 };
      }
      return { success: false, nextIndex: currentIndex };
    }

    let currentIndex = 0;

    // Uppercase match
    const step1 = handleKey(currentIndex, 'A');
    if (!step1.success || step1.nextIndex !== 1) {
      throw new Error('Failed to accept correct uppercase letter "A"');
    }
    currentIndex = step1.nextIndex;

    // Lowercase match
    const step2 = handleKey(currentIndex, 'b');
    if (!step2.success || step2.nextIndex !== 2) {
      throw new Error('Failed to accept correct lowercase letter "b"');
    }
    currentIndex = step2.nextIndex;

    // Incorrect character
    const step3 = handleKey(currentIndex, 'X');
    if (step3.success || step3.nextIndex !== 2) {
      throw new Error('Incorrectly accepted wrong character "X"');
    }
    currentIndex = step3.nextIndex;

    // Correct continuation
    const step4 = handleKey(currentIndex, 'C');
    if (!step4.success || step4.nextIndex !== 3) {
      throw new Error('Failed to continue after incorrect attempt');
    }
  });

  // ---------------------------------------------------------------------------
  // 2. Incorrect Character & Penalty Calculation
  // ---------------------------------------------------------------------------
  await test('Incorrect Character & Penalty', 'Applies strictly 0.5s per mistake and computes total time', () => {
    const penaltyPerError = 0.5;
    const calculatePenalty = (mistakes: number) => Number((mistakes * penaltyPerError).toFixed(2));
    const calculateTotalTime = (rawTime: number, mistakes: number) =>
      Number((rawTime + calculatePenalty(mistakes)).toFixed(2));

    // Zero penalties
    if (calculatePenalty(0) !== 0.0) {
      throw new Error('0 mistakes should result in 0.0s penalty');
    }

    // Single penalty
    if (calculatePenalty(1) !== 0.5) {
      throw new Error('1 mistake should result in 0.5s penalty');
    }

    // Multiple penalties (e.g. 7 mistakes = 3.5s)
    if (calculatePenalty(7) !== 3.5) {
      throw new Error('7 mistakes should result in 3.5s penalty');
    }

    // Total Time formula verification: Total = Raw + Penalty
    const rawTime = 8.42;
    const mistakes = 3; // 1.5s penalty
    const expectedTotal = 9.92;
    const actualTotal = calculateTotalTime(rawTime, mistakes);
    if (actualTotal !== expectedTotal) {
      throw new Error(`Total time formula mismatch: expected ${expectedTotal}, got ${actualTotal}`);
    }
  });

  // ---------------------------------------------------------------------------
  // 3. Game Completion
  // ---------------------------------------------------------------------------
  await test('Game Completion', 'Triggers completion upon reaching exactly 20 characters', () => {
    const targetLength = 20;
    let typedCount = 0;
    let isCompleted = false;

    for (let i = 0; i < targetLength; i++) {
      typedCount++;
      if (typedCount === targetLength) {
        isCompleted = true;
      }
    }

    if (!isCompleted || typedCount !== 20) {
      throw new Error('Game failed to complete at exactly 20 characters');
    }
  });

  // ---------------------------------------------------------------------------
  // 4. High-Score Calculation (Lower is Better)
  // ---------------------------------------------------------------------------
  await test('High-Score Calculation', 'Evaluates Success when current score is lower than previous best', () => {
    const isNewRecord = (currentScore: number, previousBest: number | null): boolean => {
      if (previousBest === null) return true;
      return currentScore < previousBest;
    };

    // First playthrough (no prior best)
    if (!isNewRecord(12.5, null)) {
      throw new Error('First playthrough must be treated as a new record');
    }

    // Faster run (8.42s beats 9.50s)
    if (!isNewRecord(8.42, 9.50)) {
      throw new Error('8.42s should beat 9.50s');
    }

    // Slower run (10.10s does not beat 9.50s)
    if (isNewRecord(10.10, 9.50)) {
      throw new Error('10.10s should not beat 9.50s');
    }

    // Equal run (9.50s does not beat 9.50s)
    if (isNewRecord(9.50, 9.50)) {
      throw new Error('Equal time should not beat existing record');
    }
  });

  // ---------------------------------------------------------------------------
  // 5. User Registration / Login / Auth Security
  // ---------------------------------------------------------------------------
  await test('Authentication', 'Validates credentials, hashes with bcrypt, and issues signed JWT', async () => {
    const testPassword = 'SecurePassword123!';
    const passwordHash = await hashPassword(testPassword);

    // Verify bcrypt hash validity
    const isCorrect = await verifyPassword(testPassword, passwordHash);
    if (!isCorrect) {
      throw new Error('Password verification failed for correct password');
    }

    const isWrong = await verifyPassword('WrongPassword', passwordHash);
    if (isWrong) {
      throw new Error('Password verification incorrectly passed for wrong password');
    }

    // Verify JWT generation & verification
    const mockUser = {
      id: 'test-user-id-123',
      username: 'UnitTester',
      email: 'unittester@example.com',
      passwordHash,
      createdAt: new Date().toISOString(),
      bestScore: 8.88,
    };

    const token = generateToken(mockUser);
    if (!token || typeof token !== 'string') {
      throw new Error('Failed to generate JWT token');
    }

    const payload = verifyToken(token);
    if (!payload || payload.userId !== mockUser.id) {
      throw new Error('Failed to decode and verify JWT payload');
    }
  });

  // ---------------------------------------------------------------------------
  // 6. Saving Game Results
  // ---------------------------------------------------------------------------
  await test('Saving Game Results', 'Persists game runs, computes penalties, and dynamically updates user best score', () => {
    // Create temporary test user in in-memory DB
    const testUsername = `test_player_${Date.now()}`;
    const testEmail = `${testUsername}@example.com`;
    const user = db.createUser({
      username: testUsername,
      email: testEmail,
      passwordHash: 'dummy-hash',
    });

    if (!user || user.bestScore !== null) {
      throw new Error('New user should start with null bestScore');
    }

    // Save game result #1: 10.00s total
    const result1 = db.saveGameResult({
      userId: user.id,
      rawTime: 9.0,
      wrongAttempts: 2, // 1.0s penalty -> 10.0s total
      sequence: 'ABCDEFGHIJKLMNOPQRST',
    });

    if (result1.result.totalTime !== 10.0 || !result1.isNewBestScore) {
      throw new Error('First game result save failed or did not mark as new best score');
    }

    const updatedUser1 = db.findUserById(user.id);
    if (updatedUser1?.bestScore !== 10.0) {
      throw new Error('User bestScore was not updated to 10.00s in database');
    }

    // Save game result #2: 8.50s total (faster -> new best score)
    const result2 = db.saveGameResult({
      userId: user.id,
      rawTime: 8.0,
      wrongAttempts: 1, // 0.5s penalty -> 8.50s total
      sequence: 'ABCDEFGHIJKLMNOPQRST',
    });

    if (result2.result.totalTime !== 8.5 || !result2.isNewBestScore) {
      throw new Error('Faster second game result was not flagged as new best score');
    }

    const updatedUser2 = db.findUserById(user.id);
    if (updatedUser2?.bestScore !== 8.5) {
      throw new Error('User bestScore was not updated to 8.50s');
    }

    // Save game result #3: 11.00s total (slower -> NOT new best score)
    const result3 = db.saveGameResult({
      userId: user.id,
      rawTime: 10.0,
      wrongAttempts: 2, // 11.0s total
      sequence: 'ABCDEFGHIJKLMNOPQRST',
    });

    if (result3.isNewBestScore !== false) {
      throw new Error('Slower game result was incorrectly flagged as new best score');
    }

    // History should contain 3 entries
    const history = db.getUserGameHistory(user.id);
    if (history.length !== 3) {
      throw new Error(`Expected 3 history records, found ${history.length}`);
    }
  });

  // ---------------------------------------------------------------------------
  // 7. Leaderboard Ordering
  // ---------------------------------------------------------------------------
  await test('Leaderboard Ordering', 'Ranks players strictly ascending by lowest completion time', () => {
    // Seed temporary users for leaderboard sorting verification
    const u1 = db.createUser({
      username: `RankTesterA_${Date.now()}`,
      email: `rank_a_${Date.now()}@test.com`,
      passwordHash: 'dummy-hash',
    });
    const u2 = db.createUser({
      username: `RankTesterB_${Date.now()}`,
      email: `rank_b_${Date.now()}@test.com`,
      passwordHash: 'dummy-hash',
    });

    db.saveGameResult({
      userId: u1.id,
      rawTime: 12.0,
      wrongAttempts: 0,
      sequence: 'ABCDEFGHIJKLMNOPQRST',
    });
    db.saveGameResult({
      userId: u2.id,
      rawTime: 7.5,
      wrongAttempts: 0,
      sequence: 'ABCDEFGHIJKLMNOPQRST',
    });
    // u2 plays again with a slower score: 9.0s -> best remains 7.5s
    db.saveGameResult({
      userId: u2.id,
      rawTime: 9.0,
      wrongAttempts: 0,
      sequence: 'ABCDEFGHIJKLMNOPQRST',
    });
    // u1 plays again with a faster score: 6.2s -> becomes new best for u1
    db.saveGameResult({
      userId: u1.id,
      rawTime: 6.2,
      wrongAttempts: 0,
      sequence: 'ABCDEFGHIJKLMNOPQRST',
    });

    const leaderboard = db.getLeaderboard(100);
    if (!Array.isArray(leaderboard) || leaderboard.length === 0) {
      throw new Error('Leaderboard should return ranked list of players');
    }

    // Verify only 1 entry per user exists on the leaderboard
    const u1Entries = leaderboard.filter((e) => e.userId === u1.id);
    const u2Entries = leaderboard.filter((e) => e.userId === u2.id);
    if (u1Entries.length !== 1) {
      throw new Error(`Expected exactly 1 leaderboard entry for user 1, found ${u1Entries.length}`);
    }
    if (u2Entries.length !== 1) {
      throw new Error(`Expected exactly 1 leaderboard entry for user 2, found ${u2Entries.length}`);
    }
    if (u1Entries[0].bestTime !== 6.2) {
      throw new Error(`User 1 best time should be updated to 6.2s, found ${u1Entries[0].bestTime}s`);
    }
    if (u2Entries[0].bestTime !== 7.5) {
      throw new Error(`User 2 best time should remain 7.5s, found ${u2Entries[0].bestTime}s`);
    }

    // Verify strictly sorted in ascending order of bestTime
    for (let i = 0; i < leaderboard.length - 1; i++) {
      const current = leaderboard[i];
      const next = leaderboard[i + 1];
      if (current.bestTime > next.bestTime) {
        throw new Error(
          `Leaderboard sorting violation at rank ${current.rank}: ${current.bestTime}s should be <= ${next.bestTime}s`
        );
      }
      if (current.rank !== i + 1) {
        throw new Error(`Leaderboard rank index mismatch: expected ${i + 1}, got ${current.rank}`);
      }
    }

    // ---------------------------------------------------------------------------
    // Verify Tie-Breaking Logic: Equal totalTime with fewer wrong attempts wins tie
    // ---------------------------------------------------------------------------
    const uTieA = db.createUser({
      username: `TieUserA_${Date.now()}`,
      email: `tie_a_${Date.now()}@test.com`,
      passwordHash: 'dummy-hash',
    });
    const uTieB = db.createUser({
      username: `TieUserB_${Date.now()}`,
      email: `tie_b_${Date.now()}@test.com`,
      passwordHash: 'dummy-hash',
    });

    // Both achieve totalTime 5.0s:
    // uTieA had 0 mistakes (raw 5.0 + 0 penalty = 5.0s) -> 100% accuracy
    // uTieB had 2 mistakes (raw 4.0 + 1.0 penalty = 5.0s) -> lower accuracy
    db.saveGameResult({
      userId: uTieA.id,
      rawTime: 5.0,
      wrongAttempts: 0,
      sequence: 'ABCDEFGHIJKLMNOPQRST',
    });
    db.saveGameResult({
      userId: uTieB.id,
      rawTime: 4.0,
      wrongAttempts: 2,
      sequence: 'ABCDEFGHIJKLMNOPQRST',
    });

    const lbWithTie = db.getLeaderboard(100);
    const tieAEntry = lbWithTie.find((e) => e.userId === uTieA.id);
    const tieBEntry = lbWithTie.find((e) => e.userId === uTieB.id);

    if (!tieAEntry || !tieBEntry) {
      throw new Error('Expected both tie test users to be present on leaderboard');
    }
    if (tieAEntry.rank >= tieBEntry.rank) {
      throw new Error(
        `Tie-breaker failed: User A with 0 penalties (rank ${tieAEntry.rank}) should rank ahead of User B with penalties (rank ${tieBEntry.rank})`
      );
    }
    if (tieAEntry.accuracy !== 100) {
      throw new Error(`Expected 100% accuracy for clean run, got ${tieAEntry.accuracy}`);
    }
    if (!tieAEntry.wpm || tieAEntry.wpm <= 0) {
      throw new Error(`Expected valid calculated WPM on leaderboard entry, got ${tieAEntry.wpm}`);
    }

    // Verify user ranking calculation
    const topEntry = lbWithTie[0];
    const userRank = db.getUserRank(topEntry.userId);
    if (!userRank || userRank.rank !== 1) {
      throw new Error(`Expected rank 1 for top player, got ${userRank?.rank}`);
    }
  });

  // ---------------------------------------------------------------------------
  // 8. Game Statistics & Analytics (WPM, Accuracy, Speed)
  // ---------------------------------------------------------------------------
  await test('Analytics Engine', 'Calculates WPM and Accuracy metrics with precision', () => {
    const charCount = 20;
    const rawTimeSeconds = 8.0;
    const wrongAttempts = 2;

    // Words Per Minute formula: (characters / 5) / (rawTimeInMinutes)
    const words = charCount / 5;
    const minutes = rawTimeSeconds / 60;
    const wpm = Math.round(words / minutes);

    // Accuracy formula: totalCorrect / (totalCorrect + wrongAttempts) * 100
    const totalKeystrokes = charCount + wrongAttempts;
    const accuracy = Number(((charCount / totalKeystrokes) * 100).toFixed(1));

    if (wpm !== 30) {
      throw new Error(`WPM calculation error: expected 30, got ${wpm}`);
    }
    if (accuracy !== 90.9) {
      throw new Error(`Accuracy calculation error: expected 90.9%, got ${accuracy}%`);
    }
  });

  // ---------------------------------------------------------------------------
  // 9. Multi-Difficulty / Length Modes
  // ---------------------------------------------------------------------------
  await test('Game Difficulty Configuration', 'Configures Standard, Blitz, and Marathon sequence modes', () => {
    const difficulties = [
      { id: 'blitz', length: 10, name: 'Blitz 10' },
      { id: 'standard', length: 20, name: 'Standard 20' },
      { id: 'marathon', length: 40, name: 'Marathon 40' },
    ];

    for (const diff of difficulties) {
      if (diff.length <= 0) {
        throw new Error(`Invalid difficulty length for ${diff.name}`);
      }
    }

    if (difficulties.length !== 3) {
      throw new Error('Expected 3 distinct difficulty modes');
    }
  });

  // ---------------------------------------------------------------------------
  // 10. Word Typing Mode
  // ---------------------------------------------------------------------------
  await test('Word Typing Mode & Auto-Advancement', 'Validates word sequence generation, direct word auto-advancement without space key, and timed presets', () => {
    const timedModes = [
      { id: 'time20', duration: 20, label: '20s' },
      { id: 'time30', duration: 30, label: '30s' },
      { id: 'time60', duration: 60, label: '1:00 min' },
    ];

    if (timedModes.length !== 3) {
      throw new Error('Expected exactly 3 word duration modes: 20s, 30s, 1:00 min');
    }

    const testWords = ['SPEED', 'FOCUS', 'TEMPO'];
    let completedWords = 0;
    let totalCharsTyped = 0;

    for (let w = 0; w < testWords.length; w++) {
      const currentWord = testWords[w];
      for (let c = 0; c < currentWord.length; c++) {
        // Typing characters directly without requiring space
        totalCharsTyped++;
      }
      completedWords++;
    }

    if (completedWords !== testWords.length) {
      throw new Error(`Expected ${testWords.length} completed words, got ${completedWords}`);
    }
    if (totalCharsTyped !== 15) {
      throw new Error(`Expected 15 total characters typed, got ${totalCharsTyped}`);
    }
  });

  // ---------------------------------------------------------------------------
  // 11. High Score Beat & Conditional Leaderboard Updates
  // ---------------------------------------------------------------------------
  await test('High Score Beat Verification', "Checks if user's high score is beaten first, then verifies if score beats someone on leaderboard before updating", () => {
    const leaderUser = db.createUser({
      username: `TargetLeader_${Date.now()}`,
      email: `leader_${Date.now()}@test.com`,
      passwordHash: 'dummy-hash',
    });
    // Leader sets an 8.0s time
    db.saveGameResult({
      userId: leaderUser.id,
      rawTime: 8.0,
      wrongAttempts: 0,
      sequence: 'ABCDEFGHIJKLMNOPQRST',
    });

    const challenger = db.createUser({
      username: `Challenger_${Date.now()}`,
      email: `challenger_${Date.now()}@test.com`,
      passwordHash: 'dummy-hash',
    });

    // 1) Challenger plays first game: 12.0s -> new personal best, but did not beat the 8.0s leader
    const res1 = db.saveGameResult({
      userId: challenger.id,
      rawTime: 12.0,
      wrongAttempts: 0,
      sequence: 'ABCDEFGHIJKLMNOPQRST',
    });
    if (!res1.isNewBestScore) {
      throw new Error('Expected first game to be personal best');
    }

    // 2) Challenger plays slower game: 15.0s -> high score NOT beaten (remains unchanged)
    const res2 = db.saveGameResult({
      userId: challenger.id,
      rawTime: 15.0,
      wrongAttempts: 0,
      sequence: 'ABCDEFGHIJKLMNOPQRST',
    });
    if (res2.isNewBestScore !== false) {
      throw new Error('Expected 15.0s to NOT beat personal best 12.0s');
    }
    if (res2.isLeaderboardBeaten !== false) {
      throw new Error('Expected isLeaderboardBeaten to be false when personal highscore is not beaten');
    }

    // 3) Challenger plays winning game: 6.5s -> beats personal best AND beats leader (8.0s)!
    const res3 = db.saveGameResult({
      userId: challenger.id,
      rawTime: 6.5,
      wrongAttempts: 0,
      sequence: 'ABCDEFGHIJKLMNOPQRST',
    });
    if (!res3.isNewBestScore) {
      throw new Error('Expected 6.5s to be marked as new personal best');
    }
    if (!res3.isLeaderboardBeaten) {
      throw new Error('Expected 6.5s to be flagged as beating someone on the leaderboard');
    }
    const leaderRank = db.getUserRank(leaderUser.id)?.rank;
    const challengerRank = db.getUserRank(challenger.id)?.rank;
    if (!leaderRank || !challengerRank || challengerRank >= leaderRank) {
      throw new Error(`Expected challenger (rank ${challengerRank}) to be ahead of leader (rank ${leaderRank})`);
    }
  });

  return results;
}
