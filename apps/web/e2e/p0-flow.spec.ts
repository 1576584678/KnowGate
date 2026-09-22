import { createHmac } from "node:crypto";
import {
  expect,
  test,
  type APIRequestContext,
} from "@playwright/test";
import {
  bossQuestions,
  chapters,
  gradeWorld,
  milestones,
} from "../src/content/math-grade4";

const adminEmail = "admin@knowgate.local";
const adminPassword = "local-admin";
const adminTotpSecret = "JBSWY3DPEHPK3PXP";

function decodeBase32(value: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const normalized = value.toUpperCase().replace(/=+$/u, "");
  let bits = "";

  for (const character of normalized) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error("Invalid TOTP secret");
    bits += index.toString(2).padStart(5, "0");
  }

  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function currentTotp(secret: string) {
  const counter = Math.floor(Date.now() / 30_000);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", decodeBase32(secret))
    .update(buffer)
    .digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    (((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff)) %
    1_000_000;
  return code.toString().padStart(6, "0");
}

async function loginAdmin(request: APIRequestContext) {
  const response = await request.post("/api/v1/admin/auth/login", {
    data: {
      email: adminEmail,
      password: adminPassword,
      totp: currentTotp(adminTotpSecret),
    },
  });
  expect(response.status(), await response.text()).toBe(200);
}

function playerHeaders(json = false) {
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

type BattleState = {
  id: string;
  status: string;
  currentQuestion: { id: string } | null;
};

async function resetPlayer(request: APIRequestContext) {
  const session = await request.post("/api/v1/profile/session");
  expect(session.status(), await session.text()).toBe(200);

  const response = await request.delete("/api/v1/progress", {
    headers: playerHeaders(),
  });
  expect(response.ok()).toBe(true);
}

function answerKey(answerIndex: number) {
  return String.fromCharCode(65 + answerIndex);
}

test.describe("P0 product flow", () => {
  test("completes chapters and bosses for all 10 milestones", async ({
    request,
  }) => {
    await resetPlayer(request);
    expect(milestones).toHaveLength(10);

    for (const milestone of milestones) {
      const milestoneChapters = chapters.filter((chapter) =>
        milestone.chapterIds.includes(chapter.id),
      );
      expect(milestoneChapters.length).toBeGreaterThan(0);

      for (const chapter of milestoneChapters) {
        const answers = chapter.steps.flatMap((step) =>
          step.question
            ? [
                {
                  itemId: step.question.id,
                  answer: answerKey(step.question.answerIndex),
                },
              ]
            : [],
        );
        const response = await request.post(
          `/api/v1/chapters/${chapter.id}/complete`,
          {
            headers: playerHeaders(true),
            data: {
              answers,
              durationSec: chapter.estimatedMinutes * 60,
              contentVersion: gradeWorld.contentVersion,
            },
          },
        );
        expect(response.status(), await response.text()).toBe(200);
        const payload = (await response.json()) as {
          result: { passed: boolean; score: number };
        };
        expect(payload.result.passed).toBe(true);
        expect(payload.result.score).toBe(100);
      }

      const battleResponse = await request.post("/api/v1/battles", {
        headers: playerHeaders(true),
        data: {
          milestoneId: milestone.id,
          mode: "learning",
          extendedTime: true,
        },
      });
      expect(battleResponse.status(), await battleResponse.text()).toBe(201);

      let battle = (await battleResponse.json()) as BattleState;
      let answerCount = 0;

      while (battle.status === "active") {
        expect(battle.currentQuestion).not.toBeNull();
        const question = bossQuestions.find(
          (item) => item.id === battle.currentQuestion?.id,
        );
        expect(question, `missing battle question`).toBeDefined();

        const answerResponse = await request.post(
          `/api/v1/battles/${battle.id}/answers`,
          {
            headers: playerHeaders(true),
            data: {
              questionId: question!.id,
              selectedIndex: question!.answerIndex,
            },
          },
        );
        expect(answerResponse.status(), await answerResponse.text()).toBe(200);
        const answerResult = (await answerResponse.json()) as {
          accepted: boolean;
          state: BattleState;
        };
        expect(answerResult.accepted).toBe(true);
        battle = answerResult.state;
        answerCount += 1;
        expect(answerCount).toBeLessThanOrEqual(12);
      }

      expect(battle.status).toBe("won");
    }

    const progressResponse = await request.get("/api/v1/progress", {
      headers: playerHeaders(),
    });
    expect(progressResponse.ok()).toBe(true);
    const progressPayload = (await progressResponse.json()) as {
      progress: {
        passedChapterIds: string[];
        battleOutcomes: Record<string, { status: string }>;
      };
    };
    expect(progressPayload.progress.passedChapterIds).toHaveLength(
      chapters.length,
    );
    expect(
      Object.values(progressPayload.progress.battleOutcomes).filter(
        (outcome) => outcome.status === "won",
      ),
    ).toHaveLength(10);
  });

  test("supports content validation, generated questions and review workflow", async ({
    request,
  }) => {
    await loginAdmin(request);

    const curriculumResponse = await request.get(
      "/api/v1/admin/content/curriculum",
    );
    expect(curriculumResponse.ok()).toBe(true);
    const curriculum = (await curriculumResponse.json()) as {
      totalStages: number;
      validation: { valid: boolean; errors: unknown[] };
      stages: unknown[];
    };
    expect(curriculum.totalStages).toBe(10);
    expect(curriculum.stages).toHaveLength(10);
    expect(curriculum.validation.valid).toBe(true);
    expect(curriculum.validation.errors).toHaveLength(0);

    const generationResponse = await request.post(
      "/api/v1/admin/content/questions/generate",
      {
        headers: { "Content-Type": "application/json" },
        data: {
          seed: 20260920,
          questionCount: 10,
          idPrefix: `e2e.generated.${Date.now()}`,
        },
      },
    );
    expect(generationResponse.ok()).toBe(true);
    const generation = (await generationResponse.json()) as {
      questions: Array<{ kind: string; answerIndex: number }>;
    };
    expect(generation.questions).toHaveLength(10);
    expect(generation.questions.at(-1)?.kind).toBe("decisive");
    expect(
      generation.questions.every(
        (question) =>
          question.answerIndex >= 0 && question.answerIndex < 4,
      ),
    ).toBe(true);

    const title = `E2E review draft ${Date.now()}`;
    const sourceChapter = chapters[0];
    const chapterId = `chapter.e2e.${Date.now()}`;
    const createResponse = await request.post(
      "/api/v1/admin/content/drafts",
      {
        headers: { "Content-Type": "application/json" },
        data: {
          kind: "chapter",
          title,
          payload: {
            ...sourceChapter,
            id: chapterId,
            title,
          },
        },
      },
    );
    expect(createResponse.status(), await createResponse.text()).toBe(201);
    const created = (await createResponse.json()) as {
      draft: { id: string; status: string };
    };
    expect(created.draft.status).toBe("draft");

    for (const [action, expectedStatus] of [
      ["submit", "in_review"],
      ["approve", "approved"],
      ["publish", "published"],
    ] as const) {
      const reviewResponse = await request.post(
        `/api/v1/admin/content/drafts/${created.draft.id}/review`,
        {
          headers: { "Content-Type": "application/json" },
          data: {
            action,
            note: `e2e ${action}`,
          },
        },
      );
      expect(reviewResponse.status(), await reviewResponse.text()).toBe(200);
      const reviewed = (await reviewResponse.json()) as {
        draft: { status: string };
      };
      expect(reviewed.draft.status).toBe(expectedStatus);
    }

    const publicationsResponse = await request.get(
      "/api/v1/admin/content/publications",
    );
    expect(publicationsResponse.ok()).toBe(true);
    const publications = (await publicationsResponse.json()) as {
      publications: Array<{ draftId: string; kind: string }>;
    };
    expect(
      publications.publications.some(
        (publication) =>
          publication.draftId === created.draft.id &&
          publication.kind === "chapter",
      ),
    ).toBe(true);

    const runtimeContentResponse = await request.get("/api/v1/content");
    expect(runtimeContentResponse.ok()).toBe(true);
    const runtimeContent = (await runtimeContentResponse.json()) as {
      content: { chapters: Array<{ id: string; title: string }> };
    };
    expect(
      runtimeContent.content.chapters.find(
        (chapter) => chapter.id === chapterId,
      )?.title,
    ).toBe(title);

    const publishedChapterResponse = await request.get(
      `/api/v1/chapters/${chapterId}`,
    );
    expect(publishedChapterResponse.ok()).toBe(true);
    const publishedChapter = (await publishedChapterResponse.json()) as {
      id: string;
      title: string;
    };
    expect(publishedChapter).toMatchObject({
      id: chapterId,
      title,
    });
  });

  test("rejects forged progress and out-of-order battles", async ({
    request,
  }) => {
    await resetPlayer(request);

    const forged = await request.post("/api/v1/progress", {
      headers: playerHeaders(true),
      data: {
        type: "chapter_completed",
        chapterId: chapters[0].id,
      },
    });
    expect(forged.status()).toBe(405);

    const secondMilestone = milestones[1];
    const secondMilestoneChapters = chapters.filter((chapter) =>
      secondMilestone.chapterIds.includes(chapter.id),
    );
    for (const chapter of secondMilestoneChapters) {
      const answers = chapter.steps.flatMap((step) =>
        step.question
          ? [
              {
                itemId: step.question.id,
                answer: answerKey(step.question.answerIndex),
              },
            ]
          : [],
      );
      const response = await request.post(
        `/api/v1/chapters/${chapter.id}/complete`,
        {
          headers: playerHeaders(true),
          data: {
            answers,
            durationSec: chapter.estimatedMinutes * 60,
            contentVersion: gradeWorld.contentVersion,
          },
        },
      );
      expect(response.status(), await response.text()).toBe(200);
    }

    const battleResponse = await request.post("/api/v1/battles", {
      headers: playerHeaders(true),
      data: {
        milestoneId: secondMilestone.id,
        mode: "learning",
      },
    });
    expect(battleResponse.status()).toBe(403);
    const battleError = (await battleResponse.json()) as {
      error: { code: string };
    };
    expect(battleError.error.code).toBe("PREVIOUS_MILESTONE_LOCKED");
  });

  test("renders the ten-stage map, a chapter, and the content console", async ({
    page,
    context,
  }) => {
    await resetPlayer(context.request);
    await loginAdmin(context.request);
    await page.addInitScript(() => {
      window.localStorage.removeItem("knowgate.progress.v1");
    });

    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "分数群岛" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "10 个里程碑" }),
    ).toBeVisible();
    await expect(page.locator(".map-node")).toHaveCount(10);

    await page.locator('.map-node[data-state="current"]').click();
    await expect(page).toHaveURL(
      /\/milestones\/math\.g4\.milestone\.01$/,
    );
    await expect(
      page.getByRole("heading", { name: "分数裂谷" }),
    ).toBeVisible();
    const firstMilestoneChapters = chapters.filter((chapter) =>
      milestones[0].chapterIds.includes(chapter.id),
    );
    await expect(page.locator(".chapter-row")).toHaveCount(
      firstMilestoneChapters.length,
    );

    await page.locator(".chapter-row .button").first().click();
    await expect(page).toHaveURL(/\/chapters\/.+/);
    await expect(
      page.getByRole("heading", { name: firstMilestoneChapters[0].title }),
    ).toBeVisible();

    // The question stem must be rendered alongside its options; previously the
    // prompt was dropped and learners only saw bare choices.
    const firstQuestionStep = firstMilestoneChapters[0].steps.find(
      (step) => step.question,
    );
    expect(firstQuestionStep?.question).toBeDefined();
    const continueButton = page.getByRole("button", { name: "继续" });
    for (let step = 0; step < 8; step += 1) {
      if (await page.locator(".lesson-question").isVisible()) break;
      await continueButton.click();
    }
    await expect(page.locator(".lesson-question")).toHaveText(
      firstQuestionStep!.question!.prompt,
    );

    await page.goto("/admin/content");
    await expect(
      page.getByRole("heading", { name: "课程内容后台" }),
    ).toBeVisible();
    await expect(page.getByText("图谱可发布")).toBeVisible();
    await expect(page.locator(".curriculum-list > li")).toHaveCount(10);
    await expect(
      page.getByRole("heading", { name: "内容草稿" }),
    ).toBeVisible();
  });

  test("keeps fraction comparison bars at equal height", async ({
    page,
    context,
  }) => {
    await resetPlayer(context.request);
    await page.addInitScript(() => {
      window.localStorage.removeItem("knowgate.progress.v1");
    });

    await page.goto("/chapters/chapter.fraction.equivalent");
    const continueButton = page.getByRole("button", { name: "继续" });
    const quizPrompt = page.getByText("与 2/6 相等的分数是哪一个？");

    for (let step = 0; step < 8; step += 1) {
      if (await quizPrompt.isVisible()) break;

      for (const answer of ["3/12", "2/8"]) {
        const answerButton = page.getByRole("button", { name: answer });
        if (await answerButton.isVisible()) {
          await answerButton.click();
          break;
        }
      }

      await continueButton.click();
    }

    await expect(quizPrompt).toBeVisible();
    const bars = page.locator(".lesson-card .fraction-visual__bar");
    await expect(bars).toHaveCount(2);

    const heights = await bars.evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().height),
    );
    expect(new Set(heights.map((height) => Math.round(height))).size).toBe(1);
  });
});
