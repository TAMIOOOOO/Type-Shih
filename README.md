# ⚡ Typing Speed Game (Full-Stack Application)

A full-stack typing speed challenge application where users test their typing speed by entering a sequence of 20 randomly generated alphabets using their keyboard. Built with **React**, **GraphQL Yoga**, **TypeScript**, **PostgreSQL**, **Prisma**, and **Docker Compose**.

---

## 🎯 Problem Statement & Requirements Checklist

| Requirement | Implementation Details | Status |
| :--- | :--- | :--- |
| **Timer from 0.00s** | High-precision stopwatch initialized upon the first keystroke | ✅ Implemented |
| **20 Random Alphabets** | Generates randomized 20-character sequences (`A-Z`) per challenge | ✅ Implemented |
| **1 Alphabet at a Time** | High-contrast single alphabet display with sequence queue preview | ✅ Implemented |
| **Advance on Correct Key** | Next alphabet is triggered only when the exact matching key is pressed | ✅ Implemented |
| **0.5s Error Penalty** | Automatically adds **+0.50s penalty** per wrong key press + visual/audio alerts | ✅ Implemented |
| **Automatic Input Focus** | Auto-focus trap and global keyboard listener ensures instant typing | ✅ Implemented |
| **Progress Display** | Live progress counter e.g. `10 / 20` and percentage bar | ✅ Implemented |
| **Final Score Breakdown** | Displays `Total Time = Base Time + Penalties`, accuracy, and key speed | ✅ Implemented |
| **Success vs Try Again** | Shows **Success 🎉** if user beats previous best score; else **Try Again** | ✅ Implemented |
| **Lower Time is Better** | Ranking and high scores treat lower completion time as the superior score | ✅ Implemented |
| **Local High-Score Persistence** | Saves personal record in `localStorage` for offline / guest play | ✅ Implemented |
| **Restart / Play Again** | Instant reset via `Restart` button or keyboard shortcut (`Space` / `Enter`) | ✅ Implemented |
| **GraphQL Yoga API** | Full GraphQL operations for auth, results submission, history, leaderboard | ✅ Implemented |
| **PostgreSQL & Prisma** | Relational data modeling in `prisma/schema.prisma` with User & GameResult | ✅ Implemented |
| **Docker Compose** | Multi-container setup with PostgreSQL database and application | ✅ Implemented |
| **Automated Tests** | Comprehensive test suite covering character handling, penalties, auth, scoring | ✅ Implemented |

---

## 🛠️ Architecture & Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons, Web Audio API, Canvas Confetti.
- **Backend & API**: Express + GraphQL Yoga, JWT authentication, bcrypt password hashing.
- **Database Modeling**: PostgreSQL with Prisma (`prisma/schema.prisma`).
- **Containerization**: Docker & Docker Compose (`docker-compose.yml`, `Dockerfile`).
- **Testing**: Native TypeScript test runner (`src/tests/runTests.ts` and interactive in-browser Test Suite).

---

## 🚀 Quick Start & Setup Instructions

### Option 1: Run with Docker Compose (Recommended for Production)

Make sure Docker is installed and running:

```bash
# 1. Clone repository
git clone <repo-url>
cd typing-speed-game

# 2. Start PostgreSQL database and application containers
docker-compose up --build
```

The application will be accessible at `http://localhost:3000`.

---

### Option 2: Run Locally with Node / Bun

```bash
# 1. Install dependencies
npm install
# or with bun: bun install

# 2. Configure environment variables
cp .env.example .env

# 3. Start development server (Port 3000)
npm run dev
# or with bun: bun run server.ts

# 4. Build for production
npm run build
npm start
```

---

## 🧪 Running the Test Suite

Run the automated test suite verifying all 7 requirement categories:

```bash
npm run test
```

### Test Coverage Breakdown:
1. **Character Handling**: Verifies character matching, rejection of incorrect inputs, and case-insensitivity.
2. **Penalty Calculation**: Verifies exact `0.5s` penalty per error and total time formula (`TotalTime = RawTime + PenaltyTime`).
3. **Sequence Completion**: Validates exact 20-character challenge boundary.
4. **Scoring Logic**: Evaluates `Success (New Best Score)` vs `Try Again` based on lower time ranking.
5. **Local Persistence**: Verifies `localStorage` cache read/write.
6. **Leaderboard Ranking**: Verifies ascending sort by completion time.
7. **Authentication Security**: Enforces email validation and password security.

You can also run and inspect tests interactively in the web UI under the **"Tests"** tab!

---

## 📡 GraphQL Yoga API Reference

Endpoint: `POST /api/graphql` or `POST /graphql`

### Queries

#### 1. Global Leaderboard
```graphql
query GetLeaderboard {
  leaderboard(limit: 10) {
    rank
    userId
    player
    bestTime
    totalGames
    lastPlayed
  }
}
```

#### 2. Current User Profile
```graphql
query GetMe {
  me {
    id
    username
    email
    bestScore
    gameCount
    createdAt
  }
}
```

#### 3. User Game History (Private)
```graphql
query GetGameHistory {
  gameHistory(limit: 20) {
    id
    totalTime
    rawTime
    penaltyTime
    wrongAttempts
    sequence
    isNewBestScore
    createdAt
  }
}
```

### Mutations

#### 1. Save Game Result
```graphql
mutation SaveGameResult($input: GameResultInput!) {
  saveGameResult(input: $input) {
    gameResult {
      id
      totalTime
      penaltyTime
      wrongAttempts
      isNewBestScore
    }
    isNewBestScore
    userBestScore
  }
}
```

#### 2. Register User
```graphql
mutation RegisterUser($input: RegisterInput!) {
  register(input: $input) {
    token
    user {
      id
      username
      email
    }
  }
}
```

#### 3. User Login
```graphql
mutation LoginUser($input: LoginInput!) {
  login(input: $input) {
    token
    user {
      id
      username
      bestScore
    }
  }
}
```

---

## 🔒 Security & Data Privacy

- **Password Hashing**: Stored using `bcrypt` with salt rounds.
- **JWT Authorization**: Requests validated through `Bearer <token>` headers in Yoga context.
- **Private Data Protection**: Resolvers enforce `context.user.id` matching so users can only view their own game history.

---

## 📹 Video Walkthrough / Technical Decisions Outline

1. **Precision Timing Architecture**:
   - High-resolution `performance.now()` stopwatch avoiding JS setInterval timer drift.
   - Decoupled `rawTime` from `penaltyTime` for auditability and accuracy scoring.

2. **UX & Responsive Ergonomics**:
   - Zero-friction keyboard capture via hidden focused element + window event delegation.
   - High visual feedback with error shake animations, penalty alert pills, and Web Audio API feedback.

3. **Hybrid Persistence**:
   - Instant guest play with `localStorage` high-score cache.
   - Seamless transition to authenticated PostgreSQL storage and global leaderboard synchronization upon sign in.
