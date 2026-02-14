# Issue #6: 相対パス突合と差分分類ロジック

## 目的
左右フォルダの走査結果を相対パスで突合し、比較状態を分類して返す。

## スコープ
- 相対パスで `left/right` のファイルを突合
- `same / different / left_only / right_only` の4分類
- `size` と `mtimeMs` によるMVP判定
- 件数サマリを返却

## 受け入れ条件
- [ ] 相対パス突合で4分類結果が得られる
- [ ] 件数サマリが返る
- [ ] レスポンスに分類結果配列が含まれる
- [ ] `npm run lint` / `npm run build` が通る
