#!/usr/bin/env python3
"""評価結果に基づいてスキル説明文を改善する。

run_eval.py からの評価結果を受け取り、拡張思考を有効にした Claude を使って
改善された説明文を生成する。
"""

import argparse
import json
import re
import sys
from pathlib import Path

import anthropic

from scripts.utils import parse_skill_md


def improve_description(
    client: anthropic.Anthropic,
    skill_name: str,
    skill_content: str,
    current_description: str,
    eval_results: dict,
    history: list[dict],
    model: str,
    test_results: dict | None = None,
    log_dir: Path | None = None,
    iteration: int | None = None,
) -> str:
    """評価結果に基づいて Claude を呼び出し、説明文を改善する。"""
    failed_triggers = [
        r for r in eval_results["results"]
        if r["should_trigger"] and not r["pass"]
    ]
    false_triggers = [
        r for r in eval_results["results"]
        if not r["should_trigger"] and not r["pass"]
    ]

    # スコアサマリーの構築
    train_score = f"{eval_results['summary']['passed']}/{eval_results['summary']['total']}"
    if test_results:
        test_score = f"{test_results['summary']['passed']}/{test_results['summary']['total']}"
        scores_summary = f"訓練: {train_score}, テスト: {test_score}"
    else:
        scores_summary = f"訓練: {train_score}"

    prompt = f"""あなたは「{skill_name}」という Claude Code スキルの説明文を最適化しています。「スキル」はプロンプトのようなものですが、段階的な情報開示の仕組みを持っています。タイトルと説明文があり、Claude はスキルを使用するかどうかを判断する際にこれを参照します。スキルを使用すると決めた場合、.md ファイルを読み込み、そこにはより詳細な情報や、ヘルパーファイル・スクリプト・追加ドキュメント・サンプルなどスキルフォルダ内の他のリソースへのリンクが含まれている可能性があります。

説明文は Claude の「available_skills」リストに表示されます。ユーザーがクエリを送信すると、Claude はこのタイトルと説明文のみに基づいてスキルを起動するかどうかを判断します。あなたの目標は、関連するクエリに対してはトリガーし、無関係なクエリに対してはトリガーしない説明文を書くことです。

現在の説明文:
<current_description>
"{current_description}"
</current_description>

現在のスコア ({scores_summary}):
<scores_summary>
"""
    if failed_triggers:
        prompt += "トリガー失敗（トリガーされるべきだったがされなかった）:\n"
        for r in failed_triggers:
            prompt += f'  - "{r["query"]}" ({r["triggers"]}/{r["runs"]} 回トリガー)\n'
        prompt += "\n"

    if false_triggers:
        prompt += "誤トリガー（トリガーされるべきでないのにされた）:\n"
        for r in false_triggers:
            prompt += f'  - "{r["query"]}" ({r["triggers"]}/{r["runs"]} 回トリガー)\n'
        prompt += "\n"

    if history:
        prompt += "過去の試行（これらを繰り返さず、構造的に異なるアプローチを試してください）:\n\n"
        for h in history:
            train_s = f"{h.get('train_passed', h.get('passed', 0))}/{h.get('train_total', h.get('total', 0))}"
            test_s = f"{h.get('test_passed', '?')}/{h.get('test_total', '?')}" if h.get('test_passed') is not None else None
            score_str = f"訓練={train_s}" + (f", テスト={test_s}" if test_s else "")
            prompt += f'<attempt {score_str}>\n'
            prompt += f'説明文: "{h["description"]}"\n'
            if "results" in h:
                prompt += "訓練結果:\n"
                for r in h["results"]:
                    status = "合格" if r["pass"] else "不合格"
                    prompt += f'  [{status}] "{r["query"][:80]}" ({r["triggers"]}/{r["runs"]} 回トリガー)\n'
            if h.get("note"):
                prompt += f'備考: {h["note"]}\n'
            prompt += "</attempt>\n\n"

    prompt += f"""</scores_summary>

スキルの内容（スキルが何をするかの参考情報）:
<skill_content>
{skill_content}
</skill_content>

失敗に基づいて、より正確にトリガーされる新しい改善された説明文を書いてください。「失敗に基づいて」と言いましたが、これは微妙なバランスが必要です。特定のケースに過学習しないようにしたいからです。やってほしくないのは、このスキルがトリガーすべき/すべきでない特定のクエリのリストをどんどん拡大していくことです。代わりに、失敗から、より広いカテゴリのユーザー意図やこのスキルが有用/不要な状況を一般化してください。その理由は二つあります:

1. 過学習の回避
2. リストが非常に長くなる可能性があり、すべてのクエリに注入され、多くのスキルが存在する可能性があるため、個々の説明文にあまり多くのスペースを使いたくない

具体的には、説明文は約100〜200ワード以下にしてください。精度が多少犠牲になるとしても構いません。

説明文を書く際に効果的だとわかったヒント:
- スキルは命令形で表現する -- 「このスキルは〜をします」ではなく「このスキルを使って〜してください」
- スキルの説明文は、スキルの実装の詳細ではなく、ユーザーの意図（何を達成しようとしているか）に焦点を当てる
- 説明文は他のスキルと Claude の注意を競い合う -- 独特で即座に認識できるものにする
- 繰り返しの試行で多くの失敗がある場合は、方針を変えてみてください。異なる文構造や表現を試しましょう

複数の機会で異なるアプローチを試すことができ、最終的に最高スコアのものを採用するため、創造的にスタイルを変えることをお勧めします。

新しい説明文のテキストのみを <new_description> タグで囲んで返してください。それ以外は何も書かないでください。"""

    response = client.messages.create(
        model=model,
        max_tokens=16000,
        thinking={
            "type": "enabled",
            "budget_tokens": 10000,
        },
        messages=[{"role": "user", "content": prompt}],
    )

    # レスポンスから思考テキストとテキストを抽出
    thinking_text = ""
    text = ""
    for block in response.content:
        if block.type == "thinking":
            thinking_text = block.thinking
        elif block.type == "text":
            text = block.text

    # <new_description> タグをパース
    match = re.search(r"<new_description>(.*?)</new_description>", text, re.DOTALL)
    description = match.group(1).strip().strip('"') if match else text.strip().strip('"')

    # トランスクリプトを記録
    transcript: dict = {
        "iteration": iteration,
        "prompt": prompt,
        "thinking": thinking_text,
        "response": text,
        "parsed_description": description,
        "char_count": len(description),
        "over_limit": len(description) > 1024,
    }

    # 1024文字を超える場合、モデルに短縮を依頼
    if len(description) > 1024:
        shorten_prompt = f"あなたの説明文は {len(description)} 文字で、1024文字のハード制限を超えています。最も重要なトリガーワードと意図のカバレッジを維持しながら、1024文字以下に書き直してください。新しい説明文のみを <new_description> タグで囲んで返してください。"
        shorten_response = client.messages.create(
            model=model,
            max_tokens=16000,
            thinking={
                "type": "enabled",
                "budget_tokens": 10000,
            },
            messages=[
                {"role": "user", "content": prompt},
                {"role": "assistant", "content": text},
                {"role": "user", "content": shorten_prompt},
            ],
        )

        shorten_thinking = ""
        shorten_text = ""
        for block in shorten_response.content:
            if block.type == "thinking":
                shorten_thinking = block.thinking
            elif block.type == "text":
                shorten_text = block.text

        match = re.search(r"<new_description>(.*?)</new_description>", shorten_text, re.DOTALL)
        shortened = match.group(1).strip().strip('"') if match else shorten_text.strip().strip('"')

        transcript["rewrite_prompt"] = shorten_prompt
        transcript["rewrite_thinking"] = shorten_thinking
        transcript["rewrite_response"] = shorten_text
        transcript["rewrite_description"] = shortened
        transcript["rewrite_char_count"] = len(shortened)
        description = shortened

    transcript["final_description"] = description

    if log_dir:
        log_dir.mkdir(parents=True, exist_ok=True)
        log_file = log_dir / f"improve_iter_{iteration or 'unknown'}.json"
        log_file.write_text(json.dumps(transcript, indent=2))

    return description


def main():
    parser = argparse.ArgumentParser(description="評価結果に基づいてスキル説明文を改善")
    parser.add_argument("--eval-results", required=True, help="評価結果JSON（run_eval.py の出力）のパス")
    parser.add_argument("--skill-path", required=True, help="スキルディレクトリのパス")
    parser.add_argument("--history", default=None, help="履歴JSON（過去の試行）のパス")
    parser.add_argument("--model", required=True, help="改善に使用するモデル")
    parser.add_argument("--verbose", action="store_true", help="思考過程を標準エラーに出力")
    args = parser.parse_args()

    skill_path = Path(args.skill_path)
    if not (skill_path / "SKILL.md").exists():
        print(f"エラー: {skill_path} に SKILL.md が見つかりません", file=sys.stderr)
        sys.exit(1)

    eval_results = json.loads(Path(args.eval_results).read_text())
    history = []
    if args.history:
        history = json.loads(Path(args.history).read_text())

    name, _, content = parse_skill_md(skill_path)
    current_description = eval_results["description"]

    if args.verbose:
        print(f"現在の説明文: {current_description}", file=sys.stderr)
        print(f"スコア: {eval_results['summary']['passed']}/{eval_results['summary']['total']}", file=sys.stderr)

    client = anthropic.Anthropic()
    new_description = improve_description(
        client=client,
        skill_name=name,
        skill_content=content,
        current_description=current_description,
        eval_results=eval_results,
        history=history,
        model=args.model,
    )

    if args.verbose:
        print(f"改善後: {new_description}", file=sys.stderr)

    # 新しい説明文と更新された履歴を JSON で出力
    output = {
        "description": new_description,
        "history": history + [{
            "description": current_description,
            "passed": eval_results["summary"]["passed"],
            "failed": eval_results["summary"]["failed"],
            "total": eval_results["summary"]["total"],
            "results": eval_results["results"],
        }],
    }
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
