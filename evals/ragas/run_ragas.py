#!/usr/bin/env python3
"""Soft-score KnowGate question content with RAGAS.

The hard-rule pipeline answers "what must never appear". This runner answers
"how good is the answer and its teaching material" by asking an LLM judge to
score five independent dimensions from 0 to 5.

The script deliberately exits successfully when no OpenAI API key is present.
Content CI should stay useful and offline-safe by default; a skipped report is
still written so reviewers can see why no soft scores were produced.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_INPUT = REPO_ROOT / "evals" / "data" / "questions.jsonl"
DEFAULT_OUTPUT = REPO_ROOT / "evals" / "reports" / "ragas.json"

METRICS: list[dict[str, Any]] = [
    {
        "name": "answer_correctness",
        "threshold": 4.5,
        "definition": (
            "Score the question's selected answer from 0 to 5. A 5 means the "
            "selected option is mathematically correct, unique, and the answer "
            "index matches the reference answer. A 0 means the selected answer "
            "is wrong or ambiguous. Treat the reference answer as canonical."
        ),
    },
    {
        "name": "explanation_sufficiency",
        "threshold": 4.0,
        "definition": (
            "Score the explanation from 0 to 5. A 5 means it explains every "
            "required operation clearly, is correct, and is sufficient for a "
            "fourth-grade learner to understand the answer. A 0 means it is "
            "missing, wrong, circular, or only states the answer."
        ),
    },
    {
        "name": "distractor_quality",
        "threshold": 4.0,
        "definition": (
            "Score the distractors from 0 to 5. A 5 means every wrong option is "
            "plausible, clearly wrong for a reason a learner can understand, and "
            "targets a realistic misconception without creating a second valid "
            "answer. A 0 means distractors are random, duplicated, misleading, "
            "or include another correct answer."
        ),
    },
    {
        "name": "difficulty_match",
        "threshold": 4.0,
        "definition": (
            "Score the difficulty fit from 0 to 5. A 5 means the task is "
            "appropriate for grade 4 mathematics, matches the stated kind and "
            "time limit, and does not require unstated knowledge. A 0 means it "
            "is materially too easy, too hard, or impossible within the limit."
        ),
    },
    {
        "name": "age_suitability",
        "threshold": 4.5,
        "definition": (
            "Score age suitability from 0 to 5. A 5 means the wording, context, "
            "numbers, and examples are clear, culturally neutral, and suitable "
            "for a fourth-grade learner. A 0 means the wording is unsafe, "
            "confusing, developmentally inappropriate, or relies on obscure "
            "adult context."
        ),
    },
]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def read_records(path: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError as error:
                raise ValueError(
                    f"{path}:{line_number}: invalid JSON: {error}"
                ) from error
    return records


def write_report(path: Path, report: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument(
        "--limit",
        type=int,
        default=int(os.getenv("RAGAS_LIMIT", "0")),
        help="Evaluate only the first N records after stable file ordering.",
    )
    parser.add_argument(
        "--model",
        default=os.getenv("RAGAS_MODEL", os.getenv("OPENAI_MODEL", "gpt-4o-mini")),
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=int(os.getenv("RAGAS_BATCH_SIZE", "4")),
    )
    return parser.parse_args()


def reference_text(record: dict[str, Any]) -> str:
    answer = record.get("answer")
    explanation = record.get("explanation")
    return (
        f"correct answer: {answer if answer is not None else '<missing>'}\n"
        f"canonical explanation: {explanation if explanation else '<missing>'}"
    )


def response_text(record: dict[str, Any]) -> str:
    payload = {
        "kind": record.get("kind"),
        "origin": record.get("origin"),
        "chapter": record.get("chapterTitle"),
        "boss": record.get("bossName"),
        "timeLimitSec": record.get("timeLimitSec"),
        "options": record.get("options", []),
        "answerIndex": record.get("answerIndex"),
        "selectedAnswer": record.get("answer"),
        "explanation": record.get("explanation"),
    }
    return json.dumps(payload, ensure_ascii=False, indent=2)


def make_report(
    *,
    status: str,
    records: list[dict[str, Any]],
    model: str,
    reason: str | None = None,
    metrics_result: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    report: dict[str, Any] = {
        "status": status,
        "generatedAt": utc_now(),
        "questionCount": len(records),
        "model": model,
        "metrics": [
            {
                "name": metric["name"],
                "threshold": metric["threshold"],
                "definition": metric["definition"],
            }
            for metric in METRICS
        ],
    }
    if reason:
        report["reason"] = reason
    if metrics_result is not None:
        report["scores"] = metrics_result
    return report


def run_evaluation(
    records: list[dict[str, Any]], model: str, batch_size: int
) -> list[dict[str, Any]]:
    from openai import OpenAI
    from ragas import evaluate
    from ragas.dataset_schema import EvaluationDataset, SingleTurnSample
    from ragas.llms import llm_factory
    from ragas.metrics import SimpleCriteriaScore

    client = OpenAI(
        api_key=os.environ["OPENAI_API_KEY"],
        base_url=os.getenv("OPENAI_BASE_URL") or None,
    )
    llm = llm_factory(model, client=client)
    metrics = [
        SimpleCriteriaScore(
            name=metric["name"],
            definition=metric["definition"],
            llm=llm,
            strictness=1,
        )
        for metric in METRICS
    ]

    samples = [
        SingleTurnSample(
            user_input=record.get("prompt", ""),
            response=response_text(record),
            reference=reference_text(record),
        )
        for record in records
    ]
    evaluation = evaluate(
        EvaluationDataset(samples=samples),
        metrics=metrics,
        llm=llm,
        show_progress=True,
        batch_size=batch_size,
        raise_exceptions=False,
    )

    scores_by_index = evaluation.scores
    metric_rows: list[dict[str, Any]] = []
    for index, record in enumerate(records):
        scores = {
            metric["name"]: scores_by_index[index].get(metric["name"])
            for metric in METRICS
        }
        metric_rows.append(
            {
                "id": record.get("id"),
                "prompt": record.get("prompt"),
                "origin": record.get("origin"),
                "chapterId": record.get("chapterId"),
                "bossId": record.get("bossId"),
                "scores": scores,
                "belowThreshold": [
                    metric["name"]
                    for metric in METRICS
                    if scores.get(metric["name"]) is not None
                    and scores[metric["name"]] < metric["threshold"]
                ],
            }
        )
    return metric_rows


def summarize(rows: list[dict[str, Any]]) -> dict[str, Any]:
    summary: dict[str, Any] = {}
    for metric in METRICS:
        name = metric["name"]
        values = [
            row["scores"][name]
            for row in rows
            if row["scores"].get(name) is not None
        ]
        summary[name] = {
            "mean": round(sum(values) / len(values), 3) if values else None,
            "min": min(values) if values else None,
            "belowThresholdCount": sum(
                value < metric["threshold"] for value in values
            ),
            "threshold": metric["threshold"],
        }
    return summary


def main() -> int:
    args = parse_args()
    records = read_records(args.input)
    if args.limit > 0:
        records = records[: args.limit]

    if not os.getenv("OPENAI_API_KEY"):
        report = make_report(
            status="skipped",
            records=records,
            model=args.model,
            reason=(
                "OPENAI_API_KEY is not set. Install the RAGAS dependencies and "
                "set an API key to produce soft scores; hard-rule checks still "
                "run without one."
            ),
        )
        write_report(args.output, report)
        print(
            f"RAGAS skipped: OPENAI_API_KEY is not set. "
            f"Wrote {args.output}",
            file=sys.stderr,
        )
        return 0

    rows = run_evaluation(records, args.model, args.batch_size)
    report = make_report(
        status="completed",
        records=records,
        model=args.model,
        metrics_result=rows,
    )
    report["summary"] = summarize(rows)
    write_report(args.output, report)
    print(
        f"RAGAS completed: {len(records)} questions -> {args.output}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:  # noqa: BLE001 - surface a useful CI failure.
        print(f"RAGAS audit failed: {error}", file=sys.stderr)
        raise
