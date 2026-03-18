#!/usr/bin/env python3
"""
スキルの簡易バリデーションスクリプト - 最小版
"""

import sys
import os
import re
import yaml
from pathlib import Path

def validate_skill(skill_path):
    """スキルの基本バリデーション"""
    skill_path = Path(skill_path)

    # SKILL.md の存在確認
    skill_md = skill_path / 'SKILL.md'
    if not skill_md.exists():
        return False, "SKILL.md が見つかりません"

    # フロントマターの読み込みとバリデーション
    content = skill_md.read_text()
    if not content.startswith('---'):
        return False, "YAML フロントマターが見つかりません"

    # フロントマターの抽出
    match = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
    if not match:
        return False, "フロントマターの形式が不正です"

    frontmatter_text = match.group(1)

    # YAML フロントマターのパース
    try:
        frontmatter = yaml.safe_load(frontmatter_text)
        if not isinstance(frontmatter, dict):
            return False, "フロントマターは YAML 辞書でなければなりません"
    except yaml.YAMLError as e:
        return False, f"フロントマターの YAML が不正です: {e}"

    # 許可されたプロパティの定義
    ALLOWED_PROPERTIES = {'name', 'description', 'license', 'allowed-tools', 'metadata', 'compatibility'}

    # 予期しないプロパティの確認（metadata 配下のネストされたキーは除外）
    unexpected_keys = set(frontmatter.keys()) - ALLOWED_PROPERTIES
    if unexpected_keys:
        return False, (
            f"SKILL.md フロントマターに予期しないキーがあります: {', '.join(sorted(unexpected_keys))}。"
            f"許可されたプロパティは: {', '.join(sorted(ALLOWED_PROPERTIES))}"
        )

    # 必須フィールドの確認
    if 'name' not in frontmatter:
        return False, "フロントマターに 'name' がありません"
    if 'description' not in frontmatter:
        return False, "フロントマターに 'description' がありません"

    # バリデーション用に名前を抽出
    name = frontmatter.get('name', '')
    if not isinstance(name, str):
        return False, f"name は文字列でなければなりません。{type(name).__name__} が指定されています"
    name = name.strip()
    if name:
        # 命名規則の確認（ケバブケース: 小文字とハイフン）
        if not re.match(r'^[a-z0-9-]+$', name):
            return False, f"name '{name}' はケバブケース（小文字、数字、ハイフンのみ）にしてください"
        if name.startswith('-') or name.endswith('-') or '--' in name:
            return False, f"name '{name}' はハイフンで始まったり終わったり、連続ハイフンを含むことはできません"
        # 名前の長さ確認（仕様上最大64文字）
        if len(name) > 64:
            return False, f"name が長すぎます（{len(name)} 文字）。最大は 64 文字です。"

    # 説明文の抽出とバリデーション
    description = frontmatter.get('description', '')
    if not isinstance(description, str):
        return False, f"description は文字列でなければなりません。{type(description).__name__} が指定されています"
    description = description.strip()
    if description:
        # 山括弧の確認
        if '<' in description or '>' in description:
            return False, "description に山括弧（< または >）は使用できません"
        # 説明文の長さ確認（仕様上最大1024文字）
        if len(description) > 1024:
            return False, f"description が長すぎます（{len(description)} 文字）。最大は 1024 文字です。"

    # compatibility フィールドのバリデーション（オプション）
    compatibility = frontmatter.get('compatibility', '')
    if compatibility:
        if not isinstance(compatibility, str):
            return False, f"compatibility は文字列でなければなりません。{type(compatibility).__name__} が指定されています"
        if len(compatibility) > 500:
            return False, f"compatibility が長すぎます（{len(compatibility)} 文字）。最大は 500 文字です。"

    return True, "スキルは有効です！"

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("使い方: python quick_validate.py <スキルディレクトリ>")
        sys.exit(1)

    valid, message = validate_skill(sys.argv[1])
    print(message)
    sys.exit(0 if valid else 1)
