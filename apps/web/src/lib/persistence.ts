import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  BattleOutcome,
  BattleSession,
  ContentDraft,
  ContentDraftKind,
  ContentDraftStatus,
  ContentPublicationAudit,
  ContentReviewRecord,
  ContentSnapshot,
  ContentSnapshotStatus,
  LearningEvent,
  ProgressSnapshot,
} from "@knowgate/domain";

type BattleSessionRow = {
  state_json: string;
};

type ChapterProgressRow = {
  chapter_id: string;
  score: number;
  duration_sec: number;
  completed_at: string;
};

type BattleOutcomeRow = {
  milestone_id: string;
  status: "won" | "lost";
  accuracy: number;
  max_combo: number;
  mistakes_json: string;
  completed_at: string;
};

type LearningEventRow = {
  id: string;
  profile_id: string;
  event_type: LearningEvent["eventType"];
  entity_type: string;
  entity_id: string;
  payload_json: string;
  occurred_at: string;
  content_version: string | null;
};

type ContentDraftRow = {
  id: string;
  kind: ContentDraftKind;
  title: string;
  payload_json: string;
  status: ContentDraftStatus;
  author_id: string;
  reviewer_id: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  published_at: string | null;
};

type ContentReviewRow = {
  id: string;
  draft_id: string;
  action: ContentReviewRecord["action"];
  operator_id: string;
  note: string | null;
  occurred_at: string;
};

type PublishedContentRow = {
  id: string;
  draft_id: string;
  kind: ContentDraftKind;
  entity_id: string;
  content_version: string;
  payload_json: string;
  published_at: string;
};

type ContentSnapshotRow = {
  id: string;
  draft_id: string;
  content_version: string;
  graph_hash: string;
  curriculum_hash: string;
  item_set_hash: string;
  graph_json: string;
  status: ContentSnapshotStatus;
  rollout_percent: number;
  created_by: string;
  created_at: string;
  activated_at: string | null;
  retired_at: string | null;
  previous_snapshot_id: string | null;
};

type ContentPublicationAuditRow = {
  id: string;
  snapshot_id: string;
  action: ContentPublicationAudit["action"];
  operator_id: string;
  note: string | null;
  occurred_at: string;
};

export type ChapterCompletionRecord = {
  chapterId: string;
  score: number;
  durationSec: number;
  completedAt: string;
};

export type PublishedContentRecord = {
  id: string;
  draftId: string;
  kind: ContentDraftKind;
  entityId: string;
  contentVersion: string;
  payload: Record<string, unknown>;
  publishedAt: string;
};

function mapContentSnapshot(row: ContentSnapshotRow): ContentSnapshot {
  return {
    id: row.id,
    draftId: row.draft_id,
    contentVersion: row.content_version,
    graphHash: row.graph_hash,
    curriculumHash: row.curriculum_hash,
    itemSetHash: row.item_set_hash,
    graph: parseJson<Record<string, unknown>>(row.graph_json, {}),
    status: row.status,
    rolloutPercent: row.rollout_percent,
    createdBy: row.created_by,
    createdAt: row.created_at,
    activatedAt: row.activated_at ?? undefined,
    retiredAt: row.retired_at ?? undefined,
    previousSnapshotId: row.previous_snapshot_id ?? undefined,
  };
}

function mapContentPublicationAudit(
  row: ContentPublicationAuditRow,
): ContentPublicationAudit {
  return {
    id: row.id,
    snapshotId: row.snapshot_id,
    action: row.action,
    operatorId: row.operator_id,
    note: row.note ?? undefined,
    occurredAt: row.occurred_at,
  };
}

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

function ensureColumn(
  database: DatabaseSync,
  table: string,
  column: string,
  definition: string,
) {
  const columns = database
    .prepare(`PRAGMA table_info(${table})`)
    .all() as Array<{ name: string }>;

  if (!columns.some((item) => item.name === column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
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
      score INTEGER NOT NULL DEFAULT 0,
      duration_sec INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT NOT NULL,
      PRIMARY KEY (profile_id, chapter_id)
    );

    CREATE TABLE IF NOT EXISTS learning_events (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      content_version TEXT
    );

    CREATE INDEX IF NOT EXISTS learning_events_profile_idx
      ON learning_events (profile_id, occurred_at);

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

    CREATE TABLE IF NOT EXISTS content_drafts (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL,
      author_id TEXT NOT NULL,
      reviewer_id TEXT,
      review_note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      submitted_at TEXT,
      reviewed_at TEXT,
      published_at TEXT
    );

    CREATE INDEX IF NOT EXISTS content_drafts_status_idx
      ON content_drafts (status, updated_at);

    CREATE TABLE IF NOT EXISTS content_reviews (
      id TEXT PRIMARY KEY,
      draft_id TEXT NOT NULL,
      action TEXT NOT NULL,
      operator_id TEXT NOT NULL,
      note TEXT,
      occurred_at TEXT NOT NULL,
      FOREIGN KEY (draft_id) REFERENCES content_drafts (id)
    );

    CREATE INDEX IF NOT EXISTS content_reviews_draft_idx
      ON content_reviews (draft_id, occurred_at);

    CREATE TABLE IF NOT EXISTS published_content (
      id TEXT PRIMARY KEY,
      draft_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      content_version TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      published_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS published_content_entity_idx
      ON published_content (kind, entity_id, published_at);

    CREATE TABLE IF NOT EXISTS content_snapshots (
      id TEXT PRIMARY KEY,
      draft_id TEXT NOT NULL,
      content_version TEXT NOT NULL,
      graph_hash TEXT NOT NULL,
      curriculum_hash TEXT NOT NULL,
      item_set_hash TEXT NOT NULL,
      graph_json TEXT NOT NULL,
      status TEXT NOT NULL,
      rollout_percent INTEGER NOT NULL DEFAULT 100,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      activated_at TEXT,
      retired_at TEXT,
      previous_snapshot_id TEXT
    );

    CREATE INDEX IF NOT EXISTS content_snapshots_status_idx
      ON content_snapshots (status, created_at);

    CREATE TABLE IF NOT EXISTS content_publication_audit (
      id TEXT PRIMARY KEY,
      snapshot_id TEXT NOT NULL,
      action TEXT NOT NULL,
      operator_id TEXT NOT NULL,
      note TEXT,
      occurred_at TEXT NOT NULL,
      FOREIGN KEY (snapshot_id) REFERENCES content_snapshots (id)
    );

    CREATE INDEX IF NOT EXISTS content_publication_audit_snapshot_idx
      ON content_publication_audit (snapshot_id, occurred_at);
  `);

  ensureColumn(database, "chapter_progress", "score", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(
    database,
    "chapter_progress",
    "duration_sec",
    "INTEGER NOT NULL DEFAULT 0",
  );

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
      score = 0,
      durationSec = 0,
    ) {
      database
        .prepare(
          `
            INSERT INTO chapter_progress (
              profile_id,
              chapter_id,
              score,
              duration_sec,
              completed_at
            )
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(profile_id, chapter_id) DO UPDATE SET
              score = excluded.score,
              duration_sec = excluded.duration_sec,
              completed_at = excluded.completed_at
          `,
        )
        .run(profileId, chapterId, score, durationSec, completedAt);
    },

    getChapterCompletion(
      profileId: string,
      chapterId: string,
    ): ChapterCompletionRecord | undefined {
      const row = database
        .prepare(
          `
            SELECT chapter_id, score, duration_sec, completed_at
            FROM chapter_progress
            WHERE profile_id = ? AND chapter_id = ?
          `,
        )
        .get(profileId, chapterId) as ChapterProgressRow | undefined;

      return row
        ? {
            chapterId: row.chapter_id,
            score: row.score,
            durationSec: row.duration_sec,
            completedAt: row.completed_at,
          }
        : undefined;
    },

    recordEvent(event: LearningEvent) {
      database
        .prepare(
          `
            INSERT INTO learning_events (
              id,
              profile_id,
              event_type,
              entity_type,
              entity_id,
              payload_json,
              occurred_at,
              content_version
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
        )
        .run(
          event.id,
          event.profileId,
          event.eventType,
          event.entityType,
          event.entityId,
          JSON.stringify(event.payload),
          event.occurredAt,
          event.contentVersion ?? null,
        );
    },

    getLearningEvents(profileId: string): LearningEvent[] {
      const events = database
        .prepare(
          `
            SELECT
              id,
              profile_id,
              event_type,
              entity_type,
              entity_id,
              payload_json,
              occurred_at,
              content_version
            FROM learning_events
            WHERE profile_id = ?
            ORDER BY occurred_at ASC, id ASC
          `,
        )
        .all(profileId) as LearningEventRow[];

      return events.map((event) => ({
        id: event.id,
        profileId: event.profile_id,
        eventType: event.event_type,
        entityType: event.entity_type,
        entityId: event.entity_id,
        payload: parseJson<Record<string, unknown>>(event.payload_json, {}),
        occurredAt: event.occurred_at,
        contentVersion: event.content_version ?? undefined,
      }));
    },

    getAllLearningEvents(): LearningEvent[] {
      const events = database
        .prepare(
          `
            SELECT
              id,
              profile_id,
              event_type,
              entity_type,
              entity_id,
              payload_json,
              occurred_at,
              content_version
            FROM learning_events
            ORDER BY occurred_at ASC, id ASC
          `,
        )
        .all() as LearningEventRow[];

      return events.map((event) => ({
        id: event.id,
        profileId: event.profile_id,
        eventType: event.event_type,
        entityType: event.entity_type,
        entityId: event.entity_id,
        payload: parseJson<Record<string, unknown>>(event.payload_json, {}),
        occurredAt: event.occurred_at,
        contentVersion: event.content_version ?? undefined,
      }));
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

    saveContentDraft(draft: ContentDraft) {
      database
        .prepare(
          `
            INSERT INTO content_drafts (
              id,
              kind,
              title,
              payload_json,
              status,
              author_id,
              reviewer_id,
              review_note,
              created_at,
              updated_at,
              submitted_at,
              reviewed_at,
              published_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              kind = excluded.kind,
              title = excluded.title,
              payload_json = excluded.payload_json,
              status = excluded.status,
              author_id = excluded.author_id,
              reviewer_id = excluded.reviewer_id,
              review_note = excluded.review_note,
              updated_at = excluded.updated_at,
              submitted_at = excluded.submitted_at,
              reviewed_at = excluded.reviewed_at,
              published_at = excluded.published_at
          `,
        )
        .run(
          draft.id,
          draft.kind,
          draft.title,
          JSON.stringify(draft.payload),
          draft.status,
          draft.authorId,
          draft.reviewerId ?? null,
          draft.reviewNote ?? null,
          draft.createdAt,
          draft.updatedAt,
          draft.submittedAt ?? null,
          draft.reviewedAt ?? null,
          draft.publishedAt ?? null,
        );
    },

    getContentDraft(draftId: string): ContentDraft | undefined {
      const row = database
        .prepare(
          `
            SELECT
              id,
              kind,
              title,
              payload_json,
              status,
              author_id,
              reviewer_id,
              review_note,
              created_at,
              updated_at,
              submitted_at,
              reviewed_at,
              published_at
            FROM content_drafts
            WHERE id = ?
          `,
        )
        .get(draftId) as ContentDraftRow | undefined;

      return row
        ? {
            id: row.id,
            kind: row.kind,
            title: row.title,
            payload: parseJson<Record<string, unknown>>(row.payload_json, {}),
            status: row.status,
            authorId: row.author_id,
            reviewerId: row.reviewer_id ?? undefined,
            reviewNote: row.review_note ?? undefined,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            submittedAt: row.submitted_at ?? undefined,
            reviewedAt: row.reviewed_at ?? undefined,
            publishedAt: row.published_at ?? undefined,
          }
        : undefined;
    },

    listContentDrafts(status?: ContentDraftStatus): ContentDraft[] {
      const rows = (
        status
          ? database
              .prepare(
                `
                  SELECT
                    id,
                    kind,
                    title,
                    payload_json,
                    status,
                    author_id,
                    reviewer_id,
                    review_note,
                    created_at,
                    updated_at,
                    submitted_at,
                    reviewed_at,
                    published_at
                  FROM content_drafts
                  WHERE status = ?
                  ORDER BY updated_at DESC, id ASC
                `,
              )
              .all(status)
          : database
              .prepare(
                `
                  SELECT
                    id,
                    kind,
                    title,
                    payload_json,
                    status,
                    author_id,
                    reviewer_id,
                    review_note,
                    created_at,
                    updated_at,
                    submitted_at,
                    reviewed_at,
                    published_at
                  FROM content_drafts
                  ORDER BY updated_at DESC, id ASC
                `,
              )
              .all()
      ) as ContentDraftRow[];

      return rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        title: row.title,
        payload: parseJson<Record<string, unknown>>(row.payload_json, {}),
        status: row.status,
        authorId: row.author_id,
        reviewerId: row.reviewer_id ?? undefined,
        reviewNote: row.review_note ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        submittedAt: row.submitted_at ?? undefined,
        reviewedAt: row.reviewed_at ?? undefined,
        publishedAt: row.published_at ?? undefined,
      }));
    },

    recordContentReview(review: ContentReviewRecord) {
      database
        .prepare(
          `
            INSERT INTO content_reviews (
              id,
              draft_id,
              action,
              operator_id,
              note,
              occurred_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
          `,
        )
        .run(
          review.id,
          review.draftId,
          review.action,
          review.operatorId,
          review.note ?? null,
          review.occurredAt,
        );
    },

    getContentReviews(draftId: string): ContentReviewRecord[] {
      const rows = database
        .prepare(
          `
            SELECT id, draft_id, action, operator_id, note, occurred_at
            FROM content_reviews
            WHERE draft_id = ?
            ORDER BY occurred_at ASC, id ASC
          `,
        )
        .all(draftId) as ContentReviewRow[];

      return rows.map((row) => ({
        id: row.id,
        draftId: row.draft_id,
        action: row.action,
        operatorId: row.operator_id,
        note: row.note ?? undefined,
        occurredAt: row.occurred_at,
      }));
    },

    recordPublication(record: PublishedContentRecord) {
      database
        .prepare(
          `
            INSERT INTO published_content (
              id,
              draft_id,
              kind,
              entity_id,
              content_version,
              payload_json,
              published_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
        )
        .run(
          record.id,
          record.draftId,
          record.kind,
          record.entityId,
          record.contentVersion,
          JSON.stringify(record.payload),
          record.publishedAt,
        );
    },

    getPublishedContent(
      kind?: ContentDraftKind,
    ): PublishedContentRecord[] {
      const rows = (
        kind
          ? database
              .prepare(
                `
                  SELECT
                    id,
                    draft_id,
                    kind,
                    entity_id,
                    content_version,
                    payload_json,
                    published_at
                  FROM published_content
                  WHERE kind = ?
                  ORDER BY published_at ASC, id ASC
                `,
              )
              .all(kind)
          : database
              .prepare(
                `
                  SELECT
                    id,
                    draft_id,
                    kind,
                    entity_id,
                    content_version,
                    payload_json,
                    published_at
                  FROM published_content
                  ORDER BY published_at ASC, id ASC
                `,
              )
              .all()
      ) as PublishedContentRow[];

      return rows.map((row) => ({
        id: row.id,
        draftId: row.draft_id,
        kind: row.kind,
        entityId: row.entity_id,
        contentVersion: row.content_version,
        payload: parseJson<Record<string, unknown>>(row.payload_json, {}),
        publishedAt: row.published_at,
      }));
    },

    recordContentSnapshot(snapshot: ContentSnapshot) {
      if (snapshot.status === "active") {
        database
          .prepare(
            `
              UPDATE content_snapshots
              SET status = 'superseded'
              WHERE status = 'active'
            `,
          )
          .run();
      }

      database
        .prepare(
          `
            INSERT INTO content_snapshots (
              id,
              draft_id,
              content_version,
              graph_hash,
              curriculum_hash,
              item_set_hash,
              graph_json,
              status,
              rollout_percent,
              created_by,
              created_at,
              activated_at,
              retired_at,
              previous_snapshot_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
        )
        .run(
          snapshot.id,
          snapshot.draftId,
          snapshot.contentVersion,
          snapshot.graphHash,
          snapshot.curriculumHash,
          snapshot.itemSetHash,
          JSON.stringify(snapshot.graph),
          snapshot.status,
          snapshot.rolloutPercent,
          snapshot.createdBy,
          snapshot.createdAt,
          snapshot.activatedAt ?? null,
          snapshot.retiredAt ?? null,
          snapshot.previousSnapshotId ?? null,
        );
    },

    getContentSnapshot(snapshotId: string): ContentSnapshot | undefined {
      const row = database
        .prepare(
          `
            SELECT
              id,
              draft_id,
              content_version,
              graph_hash,
              curriculum_hash,
              item_set_hash,
              graph_json,
              status,
              rollout_percent,
              created_by,
              created_at,
              activated_at,
              retired_at,
              previous_snapshot_id
            FROM content_snapshots
            WHERE id = ?
          `,
        )
        .get(snapshotId) as ContentSnapshotRow | undefined;

      return row ? mapContentSnapshot(row) : undefined;
    },

    getContentSnapshots(
      status?: ContentSnapshotStatus,
    ): ContentSnapshot[] {
      const rows = (
        status
          ? database
              .prepare(
                `
                  SELECT
                    id,
                    draft_id,
                    content_version,
                    graph_hash,
                    curriculum_hash,
                    item_set_hash,
                    graph_json,
                    status,
                    rollout_percent,
                    created_by,
                    created_at,
                    activated_at,
                    retired_at,
                    previous_snapshot_id
                  FROM content_snapshots
                  WHERE status = ?
                  ORDER BY COALESCE(activated_at, created_at) ASC, created_at ASC, id ASC
                `,
              )
              .all(status)
          : database
              .prepare(
                `
                  SELECT
                    id,
                    draft_id,
                    content_version,
                    graph_hash,
                    curriculum_hash,
                    item_set_hash,
                    graph_json,
                    status,
                    rollout_percent,
                    created_by,
                    created_at,
                    activated_at,
                    retired_at,
                    previous_snapshot_id
                  FROM content_snapshots
                  ORDER BY COALESCE(activated_at, created_at) ASC, created_at ASC, id ASC
                `,
              )
              .all()
      ) as ContentSnapshotRow[];

      return rows.map(mapContentSnapshot);
    },

    activateContentSnapshot(snapshotId: string, rolloutPercent = 100) {
      const snapshot = this.getContentSnapshot(snapshotId);
      if (!snapshot) return undefined;

      const activatedAt = new Date().toISOString();
      database
        .prepare(
          `
            UPDATE content_snapshots
            SET status = 'retired', retired_at = ?
            WHERE id <> ?
              AND status IN ('active', 'superseded')
              AND COALESCE(activated_at, created_at) > COALESCE(?, created_at)
          `,
        )
        .run(
          activatedAt,
          snapshotId,
          snapshot.activatedAt ?? snapshot.createdAt,
        );
      database
        .prepare(
          `
            UPDATE content_snapshots
            SET status = 'superseded'
            WHERE id <> ? AND status = 'active'
          `,
        )
        .run(snapshotId);
      database
        .prepare(
          `
            UPDATE content_snapshots
            SET
              status = 'active',
              rollout_percent = ?,
              activated_at = ?,
              retired_at = NULL
            WHERE id = ?
          `,
        )
        .run(
          Math.max(1, Math.min(100, Math.round(rolloutPercent))),
          activatedAt,
          snapshotId,
        );

      return this.getContentSnapshot(snapshotId);
    },

    retireContentSnapshot(snapshotId: string) {
      const snapshot = this.getContentSnapshot(snapshotId);
      if (!snapshot) return undefined;

      const retiredAt = new Date().toISOString();
      database
        .prepare(
          `
            UPDATE content_snapshots
            SET status = 'retired', retired_at = ?
            WHERE id = ?
          `,
        )
        .run(retiredAt, snapshotId);

      if (snapshot.status === "active" && snapshot.previousSnapshotId) {
        const previous = this.getContentSnapshot(snapshot.previousSnapshotId);
        if (previous && previous.status !== "retired") {
          database
            .prepare(
              `
                UPDATE content_snapshots
                SET status = 'active', activated_at = ?, retired_at = NULL
                WHERE id = ?
              `,
            )
            .run(retiredAt, previous.id);
        }
      }

      return this.getContentSnapshot(snapshotId);
    },

    recordPublicationAudit(audit: ContentPublicationAudit) {
      database
        .prepare(
          `
            INSERT INTO content_publication_audit (
              id,
              snapshot_id,
              action,
              operator_id,
              note,
              occurred_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
          `,
        )
        .run(
          audit.id,
          audit.snapshotId,
          audit.action,
          audit.operatorId,
          audit.note ?? null,
          audit.occurredAt,
        );
    },

    getPublicationAudit(snapshotId?: string): ContentPublicationAudit[] {
      const rows = (
        snapshotId
          ? database
              .prepare(
                `
                  SELECT
                    id,
                    snapshot_id,
                    action,
                    operator_id,
                    note,
                    occurred_at
                  FROM content_publication_audit
                  WHERE snapshot_id = ?
                  ORDER BY occurred_at ASC, id ASC
                `,
              )
              .all(snapshotId)
          : database
              .prepare(
                `
                  SELECT
                    id,
                    snapshot_id,
                    action,
                    operator_id,
                    note,
                    occurred_at
                  FROM content_publication_audit
                  ORDER BY occurred_at ASC, id ASC
                `,
              )
              .all()
      ) as ContentPublicationAuditRow[];

      return rows.map(mapContentPublicationAudit);
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
        database
          .prepare("DELETE FROM learning_events WHERE profile_id = ?")
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
