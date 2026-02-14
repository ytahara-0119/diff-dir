# Issue #14: E2Eテストの追加

## 目的
ユーザー操作フロー（比較実行〜差分表示）をE2Eで自動検証し、UI統合の回帰を防ぐ。

## スコープ
- Playwright Test 導入
- Electronアプリ起動でのE2E
- 主要シナリオ
  - 比較実行と一覧表示
  - differentファイルの差分表示
  - binary / too_large のMVP表示
  - 無効パス時のエラーパネル表示

## 受け入れ条件
- [ ] `npm run test:e2e` が実行できる
- [ ] 主要ユーザーフローが自動検証される
- [ ] `npm run lint` / `npm run build` が通る
