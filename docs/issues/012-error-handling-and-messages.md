# Issue #12: エラー処理とユーザーメッセージ強化

## 目的
比較処理と差分取得の失敗時に、原因と失敗箇所をユーザーが把握できるようにする。

## スコープ
- Compare/FileDiff のエラーフォーマット統一
- エラーに `source` / `step` / `retryable` を含める
- `NOT_FOUND` / `PERMISSION_DENIED` / `INVALID_INPUT` / `INTERNAL_ERROR` を整理
- Rendererで失敗箇所と再試行可否を表示

## 受け入れ条件
- [ ] 比較失敗時に失敗箇所が表示される
- [ ] 差分取得失敗時に失敗箇所が表示される
- [ ] retryable な場合のみリトライ導線が表示される
- [ ] `npm run lint` / `npm run build` が通る
