# Issue #13: 単体テストの追加

## 目的
比較ロジックの回帰を防ぐため、主要サービスに単体テストを導入する。

## スコープ
- Vitest導入
- `walk-directory` テスト
- `classify-compare` テスト
- `diff-policy` テスト
- `file-diff` テスト

## 受け入れ条件
- [ ] `npm run test` が通る
- [ ] `npm run lint` / `npm run build` が通る
- [ ] 正常系と代表的な異常系（NOT_FOUND/INVALID_INPUT）をカバー
