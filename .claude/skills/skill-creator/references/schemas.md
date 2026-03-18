# JSONスキーマ

このドキュメントでは、skill-creatorで使用されるJSONスキーマを定義します。

---

## evals.json

スキルの評価（eval）を定義します。スキルディレクトリ内の `evals/evals.json` に配置されます。

```json
{
  "skill_name": "example-skill",
  "evals": [
    {
      "id": 1,
      "prompt": "User's example prompt",
      "expected_output": "Description of expected result",
      "files": ["evals/files/sample1.pdf"],
      "expectations": [
        "The output includes X",
        "The skill used script Y"
      ]
    }
  ]
}
```

**フィールド:**
- `skill_name`: スキルのフロントマターに一致する名前
- `evals[].id`: 一意の整数識別子
- `evals[].prompt`: 実行するタスク
- `evals[].expected_output`: 成功を示す人間が読める説明
- `evals[].files`: 入力ファイルパスのオプションリスト（スキルルートからの相対パス）
- `evals[].expectations`: 検証可能なステートメントのリスト

---

## history.json

改善モードでのバージョン進行を追跡します。ワークスペースルートに配置されます。

```json
{
  "started_at": "2026-01-15T10:30:00Z",
  "skill_name": "pdf",
  "current_best": "v2",
  "iterations": [
    {
      "version": "v0",
      "parent": null,
      "expectation_pass_rate": 0.65,
      "grading_result": "baseline",
      "is_current_best": false
    },
    {
      "version": "v1",
      "parent": "v0",
      "expectation_pass_rate": 0.75,
      "grading_result": "won",
      "is_current_best": false
    },
    {
      "version": "v2",
      "parent": "v1",
      "expectation_pass_rate": 0.85,
      "grading_result": "won",
      "is_current_best": true
    }
  ]
}
```

**フィールド:**
- `started_at`: 改善を開始したISOタイムスタンプ
- `skill_name`: 改善対象のスキル名
- `current_best`: 最も性能が良いバージョンの識別子
- `iterations[].version`: バージョン識別子（v0, v1, ...）
- `iterations[].parent`: 派生元の親バージョン
- `iterations[].expectation_pass_rate`: 採点による合格率
- `iterations[].grading_result`: "baseline"、"won"、"lost"、または "tie"
- `iterations[].is_current_best`: 現在の最良バージョンかどうか

---

## grading.json

採点エージェントからの出力です。`<run-dir>/grading.json` に配置されます。

```json
{
  "expectations": [
    {
      "text": "The output includes the name 'John Smith'",
      "passed": true,
      "evidence": "Found in transcript Step 3: 'Extracted names: John Smith, Sarah Johnson'"
    },
    {
      "text": "The spreadsheet has a SUM formula in cell B10",
      "passed": false,
      "evidence": "No spreadsheet was created. The output was a text file."
    }
  ],
  "summary": {
    "passed": 2,
    "failed": 1,
    "total": 3,
    "pass_rate": 0.67
  },
  "execution_metrics": {
    "tool_calls": {
      "Read": 5,
      "Write": 2,
      "Bash": 8
    },
    "total_tool_calls": 15,
    "total_steps": 6,
    "errors_encountered": 0,
    "output_chars": 12450,
    "transcript_chars": 3200
  },
  "timing": {
    "executor_duration_seconds": 165.0,
    "grader_duration_seconds": 26.0,
    "total_duration_seconds": 191.0
  },
  "claims": [
    {
      "claim": "The form has 12 fillable fields",
      "type": "factual",
      "verified": true,
      "evidence": "Counted 12 fields in field_info.json"
    }
  ],
  "user_notes_summary": {
    "uncertainties": ["Used 2023 data, may be stale"],
    "needs_review": [],
    "workarounds": ["Fell back to text overlay for non-fillable fields"]
  },
  "eval_feedback": {
    "suggestions": [
      {
        "assertion": "The output includes the name 'John Smith'",
        "reason": "A hallucinated document that mentions the name would also pass"
      }
    ],
    "overall": "Assertions check presence but not correctness."
  }
}
```

**フィールド:**
- `expectations[]`: エビデンス付きの採点済み期待値
- `summary`: 合格/不合格の集計数
- `execution_metrics`: ツール使用状況と出力サイズ（エグゼキュータのmetrics.jsonから取得）
- `timing`: 実時間の計測（timing.jsonから取得）
- `claims`: 出力から抽出・検証された主張
- `user_notes_summary`: エグゼキュータがフラグを立てた問題点
- `eval_feedback`: （オプション）評価の改善提案。採点者が指摘すべき問題を特定した場合のみ存在

---

## metrics.json

エグゼキュータエージェントからの出力です。`<run-dir>/outputs/metrics.json` に配置されます。

```json
{
  "tool_calls": {
    "Read": 5,
    "Write": 2,
    "Bash": 8,
    "Edit": 1,
    "Glob": 2,
    "Grep": 0
  },
  "total_tool_calls": 18,
  "total_steps": 6,
  "files_created": ["filled_form.pdf", "field_values.json"],
  "errors_encountered": 0,
  "output_chars": 12450,
  "transcript_chars": 3200
}
```

**フィールド:**
- `tool_calls`: ツール種類ごとの呼び出し回数
- `total_tool_calls`: 全ツール呼び出しの合計数
- `total_steps`: 主要な実行ステップの数
- `files_created`: 作成された出力ファイルのリスト
- `errors_encountered`: 実行中に発生したエラーの数
- `output_chars`: 出力ファイルの合計文字数
- `transcript_chars`: トランスクリプトの文字数

---

## timing.json

実行の実時間計測です。`<run-dir>/timing.json` に配置されます。

**取得方法:** サブエージェントのタスクが完了すると、タスク通知に `total_tokens` と `duration_ms` が含まれます。これらは他の場所に永続化されず、後から復元できないため、直ちに保存してください。

```json
{
  "total_tokens": 84852,
  "duration_ms": 23332,
  "total_duration_seconds": 23.3,
  "executor_start": "2026-01-15T10:30:00Z",
  "executor_end": "2026-01-15T10:32:45Z",
  "executor_duration_seconds": 165.0,
  "grader_start": "2026-01-15T10:32:46Z",
  "grader_end": "2026-01-15T10:33:12Z",
  "grader_duration_seconds": 26.0
}
```

---

## benchmark.json

ベンチマークモードからの出力です。`benchmarks/<timestamp>/benchmark.json` に配置されます。

```json
{
  "metadata": {
    "skill_name": "pdf",
    "skill_path": "/path/to/pdf",
    "executor_model": "claude-sonnet-4-20250514",
    "analyzer_model": "most-capable-model",
    "timestamp": "2026-01-15T10:30:00Z",
    "evals_run": [1, 2, 3],
    "runs_per_configuration": 3
  },

  "runs": [
    {
      "eval_id": 1,
      "eval_name": "Ocean",
      "configuration": "with_skill",
      "run_number": 1,
      "result": {
        "pass_rate": 0.85,
        "passed": 6,
        "failed": 1,
        "total": 7,
        "time_seconds": 42.5,
        "tokens": 3800,
        "tool_calls": 18,
        "errors": 0
      },
      "expectations": [
        {"text": "...", "passed": true, "evidence": "..."}
      ],
      "notes": [
        "Used 2023 data, may be stale",
        "Fell back to text overlay for non-fillable fields"
      ]
    }
  ],

  "run_summary": {
    "with_skill": {
      "pass_rate": {"mean": 0.85, "stddev": 0.05, "min": 0.80, "max": 0.90},
      "time_seconds": {"mean": 45.0, "stddev": 12.0, "min": 32.0, "max": 58.0},
      "tokens": {"mean": 3800, "stddev": 400, "min": 3200, "max": 4100}
    },
    "without_skill": {
      "pass_rate": {"mean": 0.35, "stddev": 0.08, "min": 0.28, "max": 0.45},
      "time_seconds": {"mean": 32.0, "stddev": 8.0, "min": 24.0, "max": 42.0},
      "tokens": {"mean": 2100, "stddev": 300, "min": 1800, "max": 2500}
    },
    "delta": {
      "pass_rate": "+0.50",
      "time_seconds": "+13.0",
      "tokens": "+1700"
    }
  },

  "notes": [
    "Assertion 'Output is a PDF file' passes 100% in both configurations - may not differentiate skill value",
    "Eval 3 shows high variance (50% ± 40%) - may be flaky or model-dependent",
    "Without-skill runs consistently fail on table extraction expectations",
    "Skill adds 13s average execution time but improves pass rate by 50%"
  ]
}
```

**フィールド:**
- `metadata`: ベンチマーク実行に関する情報
  - `skill_name`: スキルの名前
  - `timestamp`: ベンチマークが実行された日時
  - `evals_run`: 評価名またはIDのリスト
  - `runs_per_configuration`: 構成ごとの実行回数（例: 3）
- `runs[]`: 個別の実行結果
  - `eval_id`: 数値の評価識別子
  - `eval_name`: 人間が読める評価名（ビューアでセクションヘッダとして使用）
  - `configuration`: `"with_skill"` または `"without_skill"` でなければならない（ビューアはこの正確な文字列をグループ化と色分けに使用）
  - `run_number`: 整数の実行番号（1, 2, 3...）
  - `result`: `pass_rate`、`passed`、`total`、`time_seconds`、`tokens`、`errors` を含むネストされたオブジェクト
- `run_summary`: 構成ごとの統計的集計
  - `with_skill` / `without_skill`: それぞれ `mean` と `stddev` フィールドを持つ `pass_rate`、`time_seconds`、`tokens` オブジェクトを含む
  - `delta`: `"+0.50"`、`"+13.0"`、`"+1700"` のような差分文字列
- `notes`: アナライザからの自由記述の所見

**重要:** ビューアはこれらのフィールド名を正確に読み取ります。`configuration` の代わりに `config` を使用したり、`pass_rate` を `result` の下にネストせずに実行のトップレベルに配置したりすると、ビューアに空またはゼロの値が表示されます。benchmark.json を手動で生成する際は、必ずこのスキーマを参照してください。

---

## comparison.json

ブラインドコンパレータからの出力です。`<grading-dir>/comparison-N.json` に配置されます。

```json
{
  "winner": "A",
  "reasoning": "Output A provides a complete solution with proper formatting and all required fields. Output B is missing the date field and has formatting inconsistencies.",
  "rubric": {
    "A": {
      "content": {
        "correctness": 5,
        "completeness": 5,
        "accuracy": 4
      },
      "structure": {
        "organization": 4,
        "formatting": 5,
        "usability": 4
      },
      "content_score": 4.7,
      "structure_score": 4.3,
      "overall_score": 9.0
    },
    "B": {
      "content": {
        "correctness": 3,
        "completeness": 2,
        "accuracy": 3
      },
      "structure": {
        "organization": 3,
        "formatting": 2,
        "usability": 3
      },
      "content_score": 2.7,
      "structure_score": 2.7,
      "overall_score": 5.4
    }
  },
  "output_quality": {
    "A": {
      "score": 9,
      "strengths": ["Complete solution", "Well-formatted", "All fields present"],
      "weaknesses": ["Minor style inconsistency in header"]
    },
    "B": {
      "score": 5,
      "strengths": ["Readable output", "Correct basic structure"],
      "weaknesses": ["Missing date field", "Formatting inconsistencies", "Partial data extraction"]
    }
  },
  "expectation_results": {
    "A": {
      "passed": 4,
      "total": 5,
      "pass_rate": 0.80,
      "details": [
        {"text": "Output includes name", "passed": true}
      ]
    },
    "B": {
      "passed": 3,
      "total": 5,
      "pass_rate": 0.60,
      "details": [
        {"text": "Output includes name", "passed": true}
      ]
    }
  }
}
```

---

## analysis.json

事後分析エージェントからの出力です。`<grading-dir>/analysis.json` に配置されます。

```json
{
  "comparison_summary": {
    "winner": "A",
    "winner_skill": "path/to/winner/skill",
    "loser_skill": "path/to/loser/skill",
    "comparator_reasoning": "Brief summary of why comparator chose winner"
  },
  "winner_strengths": [
    "Clear step-by-step instructions for handling multi-page documents",
    "Included validation script that caught formatting errors"
  ],
  "loser_weaknesses": [
    "Vague instruction 'process the document appropriately' led to inconsistent behavior",
    "No script for validation, agent had to improvise"
  ],
  "instruction_following": {
    "winner": {
      "score": 9,
      "issues": ["Minor: skipped optional logging step"]
    },
    "loser": {
      "score": 6,
      "issues": [
        "Did not use the skill's formatting template",
        "Invented own approach instead of following step 3"
      ]
    }
  },
  "improvement_suggestions": [
    {
      "priority": "high",
      "category": "instructions",
      "suggestion": "Replace 'process the document appropriately' with explicit steps",
      "expected_impact": "Would eliminate ambiguity that caused inconsistent behavior"
    }
  ],
  "transcript_insights": {
    "winner_execution_pattern": "Read skill -> Followed 5-step process -> Used validation script",
    "loser_execution_pattern": "Read skill -> Unclear on approach -> Tried 3 different methods"
  }
}
```
