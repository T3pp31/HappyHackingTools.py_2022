# happyhackingtools

ペネトレーションツールを目指して作っているものです．
Pythonのバージョンは3.9
Poetryを使用しています

# 注意事項

ペネトレーション，CTF目的に作成しているので，第三者に対する攻撃に使用しないようにしてください．
本レポジトリ所有者はいかなる責任も負いません．

It is designed for penetration and CTF purposes, and should not be used for attacks against third parties.
The owner of this repository assumes no responsibility whatsoever.

# 動作環境

## ※Docker調整中

Dockerfileを用意していますが，そのままだと自分の属するセグメント内に存在するデバイスを探すことはできないです．そのための設定が以下のURL
<https://qiita.com/Meganezaru@github/items/69f406844532d731d370>

## 環境を用意する場合

Python3.9.7で動作確認済

必要なパッケージのインストール

```
pip install -r requirements.txt
```

サーバー作動

```
python3 app.py
```

[http://127.0.0.1:5000](http://127.0.0.1:5000)にアクセスして利用可能．

# 追加したい機能

指定した通信をキャプチャし，表示したい
HTTP通信をキャプチャ，内容を見れるようにし，Password，ID等を組み合わせたブルートフォースを行えるようにする

WfuzzやFfuf

ipスプーフィング
ARPスプーフィング
バッファオーバーフロー
ディレクトリとラバーサル
sqlインジェクション
コマンドインジェクション
DNSキャッシュポイゾニング
くろすさいとすくりぷてぃんぐ
DoS/DDoS
DNS amp攻撃
NTP増幅攻撃
Smurf攻撃
ICMP Flood攻撃
リプレイ攻撃
