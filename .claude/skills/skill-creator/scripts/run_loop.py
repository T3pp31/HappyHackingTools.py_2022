#!/usr/bin/env python3
"""評価＋改善ループを、全件合格またはイテレーション上限まで実行する。

run_eval.py と improve_description.py をループで組み合わせ、履歴を追跡し、
最良の説明文を返す。過学習防止のためのtrain/testスプリットに対応。
"""

import argparse
import json
import random
import sys
import tempfile
import time
import webbrowser
from pathlib import Path

import anthropic

from scripts.generate_report import generate_html
from scripts.improve_description import improve_description
from scripts.run_eval import find_project_root, run_eval
from scripts.utils import parse_skill_md


def split_eval_set(eval_set: list[dict], holdout: float, seed: int = 42) -> tuple[list[dict], list[dict]]:
    """評価セットを should_trigger で層化してトレーニングセットとテストセットに分割する。"""
    random.seed(seed)

    # should_trigger で分離
    trigger = [e for e in eval_set if e["should_trigger"]]
    no_trigger = [e for e in eval_set if not e["should_trigger"]]

    # 各グループをシャッフル
    random.shuffle(trigger)
    random.shuffle(no_trigger)

    # 分割点を計算
    n_trigger_test = max(1, int(len(trigger) * holdout))
    n_no_trigger_test = max(1, int(len(no_trigger) * holdout))

    # 分割
    test_set = trigger[:n_trigger_test] + no_trigger[:n_no_trigger_test]
    train_set = trigger[n_trigger_test:] + no_trigger[n_no_trigger_test:]

    return train_set, test_set


def run_loop(
    eval_set: list[dict],
    skill_path: Path,
    description_override: str | None,
    num_workers: int,
    timeout: int,
    max_iterations: int,
    runs_per_query: int,
    trigger_threshold: float,
    holdout: float,
    model: str,
    verbose: bool,
    live_report_path: Path | None = None,
    log_dir: Path | None = None,
) -> dict:
    """評価＋改善ループを実行する。"""
    project_root = find_project_root()
    name, original_description, content = parse_skill_md(skill_path)
    current_description = description_override or original_description

    # holdout > 0 の場合、train/test に分割
    if holdout > 0:
        train_set, test_set = split_eval_set(eval_set, holdout)
        if verbose:
            print(f"分割: 訓練 {len(train_set)} 件, テスト {len(test_set)} 件 (holdout={holdout})", file=sys.stderr)
    else:
        train_set = eval_set
        test_set = []

    client = anthropic.Anthropic()
    history = []
    exit_reason = "unknown"

    for iteration in range(1, max_iterations + 1):
        if verbose:
            print(f"\n{'='*60}", file=sys.stderr)
            print(f"イテレーション {iteration}/{max_iterations}", file=sys.stderr)
            print(f"説明文: {current_description}", file=sys.stderr)
            print(f"{'='*60}", file=sys.stderr)

        # 並列処理のため、train と test を一括で評価
        all_queries = train_set + test_set
        t0 = time.time()
        all_results = run_eval(
            eval_set=all_queries,
            skill_name=name,
            description=current_description,
            num_workers=num_workers,
            timeout=timeout,
            project_root=project_root,
            runs_per_query=runs_per_query,
            trigger_threshold=trigger_threshold,
            model=model,
        )
        eval_elapsed = time.time() - t0

        # クエリのマッチングにより結果を train/test に分割
        train_queries_set = {q["query"] for q in train_set}
        train_result_list = [r for r in all_results["results"] if r["query"] in train_queries_set]
        test_result_list = [r for r in all_results["results"] if r["query"] not in train_queries_set]

        train_passed = sum(1 for r in train_result_list if r["pass"])
        train_total = len(train_result_list)
        train_summary = {"passed": train_passed, "failed": train_total - train_passed, "total": train_total}
        train_results = {"results": train_result_list, "summary": train_summary}

        if test_set:
            test_passed = sum(1 for r in test_result_list if r["pass"])
            test_total = len(test_result_list)
            test_summary = {"passed": test_passed, "failed": test_total - test_passed, "total": test_total}
            test_results = {"results": test_result_list, "summary": test_summary}
        else:
            test_results = None
            test_summary = None

        history.append({
            "iteration": iteration,
            "description": current_description,
            "train_passed": train_summary["passed"],
            "train_failed": train_summary["failed"],
            "train_total": train_summary["total"],
            "train_results": train_results["results"],
            "test_passed": test_summary["passed"] if test_summary else None,
            "test_failed": test_summary["failed"] if test_summary else None,
            "test_total": test_summary["total"] if test_summary else None,
            "test_results": test_results["results"] if test_results else None,
            # レポート生成との後方互換
            "passed": train_summary["passed"],
            "failed": train_summary["failed"],
            "total": train_summary["total"],
            "results": train_results["results"],
        })

        # ライブレポートのパスが指定されている場合、レポートを書き出す
        if live_report_path:
            partial_output = {
                "original_description": original_description,
                "best_description": current_description,
                "best_score": "in progress",
                "iterations_run": len(history),
                "holdout": holdout,
                "train_size": len(train_set),
                "test_size": len(test_set),
                "history": history,
            }
            live_report_path.write_text(generate_html(partial_output, auto_refresh=True, skill_name=name))

        if verbose:
            def print_eval_stats(label, results, elapsed):
                pos = [r for r in results if r["should_trigger"]]
                neg = [r for r in results if not r["should_trigger"]]
                tp = sum(r["triggers"] for r in pos)
                pos_runs = sum(r["runs"] for r in pos)
                fn = pos_runs - tp
                fp = sum(r["triggers"] for r in neg)
                neg_runs = sum(r["runs"] for r in neg)
                tn = neg_runs - fp
                total = tp + tn + fp + fn
                precision = tp / (tp + fp) if (tp + fp) > 0 else 1.0
                recall = tp / (tp + fn) if (tp + fn) > 0 else 1.0
                accuracy = (tp + tn) / total if total > 0 else 0.0
                print(f"{label}: {tp+tn}/{total} 正解, 適合率={precision:.0%} 再現率={recall:.0%} 正解率={accuracy:.0%} ({elapsed:.1f}秒)", file=sys.stderr)
                for r in results:
                    status = "合格" if r["pass"] else "不合格"
                    rate_str = f"{r['triggers']}/{r['runs']}"
                    print(f"  [{status}] 発火率={rate_str} 期待値={r['should_trigger']}: {r['query'][:60]}", file=sys.stderr)

            print_eval_stats("訓練", train_results["results"], eval_elapsed)
            if test_summary:
                print_eval_stats("テスト", test_results["results"], 0)

        if train_summary["failed"] == 0:
            exit_reason = f"all_passed (イテレーション {iteration})"
            if verbose:
                print(f"\nイテレーション {iteration} で全ての訓練クエリが合格しました！", file=sys.stderr)
            break

        if iteration == max_iterations:
            exit_reason = f"max_iterations ({max_iterations})"
            if verbose:
                print(f"\nイテレーション上限 ({max_iterations}) に達しました。", file=sys.stderr)
            break

        # 訓練結果に基づいて説明文を改善
        if verbose:
            print(f"\n説明文を改善中...", file=sys.stderr)

        t0 = time.time()
        # 改善モデルがテストスコアを見れないよう、履歴からテスト情報を除去
        blinded_history = [
            {k: v for k, v in h.items() if not k.startswith("test_")}
            for h in history
        ]
        new_description = improve_description(
            client=client,
            skill_name=name,
            skill_content=content,
            current_description=current_description,
            eval_results=train_results,
            history=blinded_history,
            model=model,
            log_dir=log_dir,
            iteration=iteration,
        )
        improve_elapsed = time.time() - t0

        if verbose:
            print(f"提案 ({improve_elapsed:.1f}秒): {new_description}", file=sys.stderr)

        current_description = new_description

    # テストスコア（テストセットがない場合は訓練スコア）で最良イテレーションを選出
    if test_set:
        best = max(history, key=lambda h: h["test_passed"] or 0)
        best_score = f"{best['test_passed']}/{best['test_total']}"
    else:
        best = max(history, key=lambda h: h["train_passed"])
        best_score = f"{best['train_passed']}/{best['train_total']}"

    if verbose:
        print(f"\n終了理由: {exit_reason}", file=sys.stderr)
        print(f"最高スコア: {best_score} (イテレーション {best['iteration']})", file=sys.stderr)

    return {
        "exit_reason": exit_reason,
        "original_description": original_description,
        "best_description": best["description"],
        "best_score": best_score,
        "best_train_score": f"{best['train_passed']}/{best['train_total']}",
        "best_test_score": f"{best['test_passed']}/{best['test_total']}" if test_set else None,
        "final_description": current_description,
        "iterations_run": len(history),
        "holdout": holdout,
        "train_size": len(train_set),
        "test_size": len(test_set),
        "history": history,
    }


def main():
    parser = argparse.ArgumentParser(description="評価＋改善ループを実行")
    parser.add_argument("--eval-set", required=True, help="評価セットJSONファイルのパス")
    parser.add_argument("--skill-path", required=True, help="スキルディレクトリのパス")
    parser.add_argument("--description", default=None, help="開始説明文の上書き")
    parser.add_argument("--num-workers", type=int, default=10, help="並列ワーカー数")
    parser.add_argument("--timeout", type=int, default=30, help="クエリごとのタイムアウト（秒）")
    parser.add_argument("--max-iterations", type=int, default=5, help="最大改善イテレーション数")
    parser.add_argument("--runs-per-query", type=int, default=3, help="クエリごとの実行回数")
    parser.add_argument("--trigger-threshold", type=float, default=0.5, help="発火率の閾値")
    parser.add_argument("--holdout", type=float, default=0.4, help="テスト用にホールドアウトする評価セットの割合（0で無効化）")
    parser.add_argument("--model", required=True, help="改善に使用するモデル")
    parser.add_argument("--verbose", action="store_true", help="進捗を標準エラーに出力")
    parser.add_argument("--report", default="auto", help="HTMLレポートの出力パス（デフォルト: 'auto'で一時ファイル、'none'で無効化）")
    parser.add_argument("--results-dir", default=None, help="全出力（results.json, report.html, log.txt）をタイムスタンプ付きサブディレクトリに保存")
    args = parser.parse_args()

    eval_set = json.loads(Path(args.eval_set).read_text())
    skill_path = Path(args.skill_path)

    if not (skill_path / "SKILL.md").exists():
        print(f"エラー: {skill_path} に SKILL.md が見つかりません", file=sys.stderr)
        sys.exit(1)

    name, _, _ = parse_skill_md(skill_path)

    # ライブレポートパスの設定
    if args.report != "none":
        if args.report == "auto":
            timestamp = time.strftime("%Y%m%d_%H%M%S")
            live_report_path = Path(tempfile.gettempdir()) / f"skill_description_report_{skill_path.name}_{timestamp}.html"
        else:
            live_report_path = Path(args.report)
        # ユーザーがすぐに確認できるようレポートを開く
        live_report_path.write_text("<html><body><h1>最適化ループを開始しています...</h1><meta http-equiv='refresh' content='5'></body></html>")
        webbrowser.open(str(live_report_path))
    else:
        live_report_path = None

    # 出力ディレクトリの決定（ログ書き込みのため run_loop の前に作成）
    if args.results_dir:
        timestamp = time.strftime("%Y-%m-%d_%H%M%S")
        results_dir = Path(args.results_dir) / timestamp
        results_dir.mkdir(parents=True, exist_ok=True)
    else:
        results_dir = None

    log_dir = results_dir / "logs" if results_dir else None

    output = run_loop(
        eval_set=eval_set,
        skill_path=skill_path,
        description_override=args.description,
        num_workers=args.num_workers,
        timeout=args.timeout,
        max_iterations=args.max_iterations,
        runs_per_query=args.runs_per_query,
        trigger_threshold=args.trigger_threshold,
        holdout=args.holdout,
        model=args.model,
        verbose=args.verbose,
        live_report_path=live_report_path,
        log_dir=log_dir,
    )

    # JSON出力を保存
    json_output = json.dumps(output, indent=2)
    print(json_output)
    if results_dir:
        (results_dir / "results.json").write_text(json_output)

    # 最終HTMLレポートの書き出し（自動更新なし）
    if live_report_path:
        live_report_path.write_text(generate_html(output, auto_refresh=False, skill_name=name))
        print(f"\nレポート: {live_report_path}", file=sys.stderr)

    if results_dir and live_report_path:
        (results_dir / "report.html").write_text(generate_html(output, auto_refresh=False, skill_name=name))

    if results_dir:
        print(f"結果の保存先: {results_dir}", file=sys.stderr)


if __name__ == "__main__":
    main()
