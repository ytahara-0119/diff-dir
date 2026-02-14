# diff-dir

Electron + TypeScript + React の初期構成です。

## Scripts

- `npm install`
- `npm run dev`
- `npm run lint`
- `npm run build`
- `npm run test`
- `npm run test:e2e:run`

## macOS 配布（Issue #15）

前提:
- macOS
- `npm install` 済み

実行コマンド:
- `npm run pack:mac`
  - 署名なしの `.app` を `dist-release/mac-arm64/` に出力（開発確認向け）
- `npm run dist:mac`
  - `.dmg` と `.zip` を `dist-release/` に出力（配布向け）

備考:
- アプリアイコンは `build-resources/icon.icns` を使用
- 現在は署名・notarize 未対応（ローカル配布向け）
