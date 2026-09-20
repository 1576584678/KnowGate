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

const playerId = "e2e.p0.player";
const uiPlayerId = "e2e.p0.browser";
const adminHeaders = {
  "x-knowgate-admin-token": "local-admin",
  "x-knowgate-operator-id": "e2e-admin",
};

function playerHeaders(json = false) {
  return {
    "x-knowgate-profile-id": playerId,
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

type BattleState = {
  id: string;
  status: string;
  currentQuestion: { id: string } | null;
};

async function resetPlayer(
  request: APIRequestContext,
  profileId = playerId,
) {
  const response = await request.delete("/api/v1/progress", {
    headers: { "x-knowgate-profile-id": profileId },
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
    const curriculumResponse = await request.get(
      "/api/v1/admin/content/curriculum",
      { headers: adminHeaders },
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
        headers: { ...adminHeaders, "Content-Type": "application/json" },
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
    const createResponse = await request.post(
      "/api/v1/admin/content/drafts",
      {
        headers: { ...adminHeaders, "Content-Type": "application/json" },
        data: {
          kind: "chapter",
          title,
          payload: { title, source: "e2e" },
          authorId: "e2e-admin",
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
          headers: { ...adminHeaders, "Content-Type": "application/json" },
          data: {
            action,
            note: `e2e ${action}`,
            operatorId: "e2e-admin",
          },
        },
      );
      expect(reviewResponse.status(), await reviewResponse.text()).toBe(200);
      const reviewed = (await reviewResponse.json()) as {
        draft: { status: string };
      };
      expect(reviewed.draft.status).toBe(expectedStatus);
    }
  });

  test("renders the ten-stage map, a chapter, and the content console", async ({
    page,
    request,
  }) => {
    await resetPlayer(request, uiPlayerId);
    await page.addInitScript((profileId) => {
      window.localStorage.setItem("knowgate.profile.v1", profileId);
      window.localStorage.removeItem("knowgate.progress.v1");
    }, uiPlayerId);

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
});
