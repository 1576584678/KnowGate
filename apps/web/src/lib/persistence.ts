import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  BattleOutcome,
  BattleSession,
  ProgressSnapshot,
} from "@knowgate/domain";

type BattleSessionRow = {
  state_json: string;
};

type ChapterProgressRow = {
  chapter_id: string;
};

type BattleOutcomeRow = {
  milestone_id: string;
  status: "won" | "lost";
  accuracy: number;
  max_combo: number;
  mistakes_json: string;
  completed_at: string;
};

export type PersistenceStore = ReturnType<typeof createPersistence>;

function defaultDatabasePath() {
  return (
    process.env.KNOWGATE_DB_PATH ??
    resolve(process.cwd(), ".data", "knowgate.sqlite")
  );
}

function parseJson<Value>(value: string, fallback: Value): Value {
  try {
    return JSON.parse(value) as Value;
  } catch {
    return fallback;
  }
}

export function createPersistence(databasePath = defaultDatabasePath()) {
  if (databasePath !== ":memory:") {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  const database = new DatabaseSync(databasePath);
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS battle_sessions (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      milestone_id TEXT NOT NULL,
      status TEXT NOT NULL,
      state_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS battle_sessions_profile_idx
      ON battle_sessions (profile_id, milestone_id);

    CREATE TABLE IF NOT EXISTS chapter_progress (
      profile_id TEXT NOT NULL,
      chapter_id TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      PRIMARY KEY (profile_id, chapter_id)
    );

    CREATE TABLE IF NOT EXISTS battle_outcomes (
      profile_id TEXT NOT NULL,
      milestone_id TEXT NOT NULL,
      status TEXT NOT NULL,
      accuracy INTEGER NOT NULL,
      max_combo INTEGER NOT NULL,
      mistakes_json TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      PRIMARY KEY (profile_id, milestone_id)
    );
  `);

  return {
    saveBattleSession(profileId: string, session: BattleSession) {
      const now = new Date().toISOString();
      database
        .prepare(
          `
            INSERT INTO battle_sessions (
              id,
              profile_id,
              milestone_id,
              status,
              state_json,
              created_at,
              updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              profile_id = excluded.profile_id,
              milestone_id = excluded.milestone_id,
              status = excluded.status,
              state_json = excluded.state_json,
              updated_at = excluded.updated_at
          `,
        )
        .run(
          session.id,
          profileId,
          session.milestoneId,
          session.status,
          JSON.stringify(session),
          session.startedAt,
          now,
        );
    },

    getBattleSession(profileId: string, battleId: string) {
      const row = database
        .prepare(
          `
            SELECT state_json
            FROM battle_sessions
            WHERE id = ? AND profile_id = ?
          `,
        )
        .get(battleId, profileId) as BattleSessionRow | undefined;

      return row
        ? parseJson<BattleSession | undefined>(row.state_json, undefined)
        : undefined;
    },

    completeChapter(
      profileId: string,
      chapterId: string,
      completedAt = new Date().toISOString(),
    ) {
      database
        .prepare(
          `
            INSERT INTO chapter_progress (profile_id, chapter_id, completed_at)
            VALUES (?, ?, ?)
            ON CONFLICT(profile_id, chapter_id) DO UPDATE SET
              completed_at = excluded.completed_at
          `,
        )
        .run(profileId, chapterId, completedAt);
    },

    saveBattleOutcome(profileId: string, outcome: BattleOutcome) {
      database
        .prepare(
          `
            INSERT INTO battle_outcomes (
              profile_id,
              milestone_id,
              status,
              accuracy,
              max_combo,
              mistakes_json,
              completed_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(profile_id, milestone_id) DO UPDATE SET
              status = excluded.status,
              accuracy = excluded.accuracy,
              max_combo = excluded.max_combo,
              mistakes_json = excluded.mistakes_json,
              completed_at = excluded.completed_at
          `,
        )
        .run(
          profileId,
          outcome.milestoneId,
          outcome.status,
          outcome.accuracy,
          outcome.maxCombo,
          JSON.stringify(outcome.mistakes),
          outcome.completedAt,
        );
    },

    getProgress(profileId: string): ProgressSnapshot {
      const chapters = database
        .prepare(
          `
            SELECT chapter_id
            FROM chapter_progress
            WHERE profile_id = ?
            ORDER BY completed_at ASC
          `,
        )
        .all(profileId) as ChapterProgressRow[];

      const outcomes = database
        .prepare(
          `
            SELECT
              milestone_id,
              status,
              accuracy,
              max_combo,
              mistakes_json,
              completed_at
            FROM battle_outcomes
            WHERE profile_id = ?
            ORDER BY completed_at ASC
          `,
        )
        .all(profileId) as BattleOutcomeRow[];

      return {
        passedChapterIds: chapters.map((chapter) => chapter.chapter_id),
        battleOutcomes: Object.fromEntries(
          outcomes.map((outcome) => [
            outcome.milestone_id,
            {
              milestoneId: outcome.milestone_id,
              status: outcome.status,
              accuracy: outcome.accuracy,
              maxCombo: outcome.max_combo,
              mistakes: parseJson(outcome.mistakes_json, []),
              completedAt: outcome.completed_at,
            } satisfies BattleOutcome,
          ]),
        ),
      };
    },

    resetProgress(profileId: string) {
      database.exec("BEGIN");
      try {
        database
          .prepare("DELETE FROM chapter_progress WHERE profile_id = ?")
          .run(profileId);
        database
          .prepare("DELETE FROM battle_outcomes WHERE profile_id = ?")
          .run(profileId);
        database.exec("COMMIT");
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    },

    close() {
      database.close();
    },
  };
}

const globalForPersistence = globalThis as typeof globalThis & {
  knowGatePersistence?: PersistenceStore;
};

export function getPersistence() {
  return (
    globalForPersistence.knowGatePersistence ??
    (globalForPersistence.knowGatePersistence = createPersistence())
  );
}
