# クロスプラットフォーム対応ルール

本プロジェクトは **Windows / macOS / Linux** の3プラットフォームで動作することを前提とする。

## プラットフォーム別の実装方針

- OS固有の処理は `#[cfg(target_os = "...")]` で分岐すること
- 可能な限りOS標準APIを使い、追加ソフトウェアのインストールを不要にすること
- やむを得ず外部ソフトが必要な機能は、その旨をユーザーに明示すること

## Npcap依存の最小化

| 機能 | Windows | macOS | Linux |
|---|---|---|---|
| ネットワーク情報取得 | OS標準API | OS標準API | OS標準API |
| LANスキャン (ARP) | `SendARP` Win32 API | pnet (raw socket) | pnet (raw socket) |
| ポートスキャン | TCP connect (標準) | TCP connect (標準) | TCP connect (標準) |
| ARPスプーフ + pcap | **Npcap必須** | pnet + libpcap | pnet + libpcap |

- ARPスプーフ/パケットキャプチャのみNpcapが必須（Windows）
- それ以外の機能はNpcap不要で動作すること
