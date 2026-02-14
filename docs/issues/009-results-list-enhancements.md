# Issue #9: 比較結果一覧画面の強化

## 目的
差分件数が多いケースでも、目的ファイルへ素早く到達できる一覧UIにする。

## スコープ
- ステータスフィルタ（all / different / same / left_only / right_only）
- 相対パス検索
- ソート（path / status / left size / right size）
- 表示件数の可視化
- 選択中行のハイライト

## 受け入れ条件
- [ ] フィルタ/検索/ソートを同時利用できる
- [ ] 表示件数が確認できる
- [ ] 選択中ファイルが一覧で判別できる
- [ ] `npm run lint` / `npm run build` が通る
