# Content Audit Pipelines

The content audit has two independent lanes over the same exported dataset:

1. **promptfoo hard rules**: structure, options, wording, duplicates, and graph
   consistency. These are deterministic checks and run without an API key.
2. **RAGAS soft scores**: answer correctness, explanation sufficiency,
   distractor quality, difficulty match, and age suitability. These require an
   LLM and are skipped cleanly when `OPENAI_API_KEY` is absent.

The audit commands export the current TypeScript content module automatically.
Run the export by itself when you want to inspect the generated dataset:

```sh
npm run content:export
```

Run the deterministic hard-rule report:

```sh
npm run content:audit
```

Run both promptfoo and RAGAS in parallel:

```sh
npm run content:audit:all
```

RAGAS setup:

```sh
python -m venv evals/.venv-ragas
evals/.venv-ragas/Scripts/python.exe -m pip install -r evals/ragas/requirements.txt
```

Set `OPENAI_API_KEY` to enable soft scores. `OPENAI_BASE_URL`,
`RAGAS_MODEL`, `RAGAS_LIMIT`, and `RAGAS_BATCH_SIZE` can be set for a
compatible endpoint or a smaller review run.

Reports are written under `evals/reports/`:

- `hard-rules.json`
- `promptfoo.json`
- `ragas.json`
