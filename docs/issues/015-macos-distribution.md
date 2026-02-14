# Issue #15: macOS配布準備

## 目的
MVPアプリを macOS で配布可能な形式（.app/.dmg）で出力できる状態にする。

## スコープ
- `electron-builder` 導入
- macOS 向け配布設定（appId / icon / target）
- 配布コマンド追加（`pack:mac` / `dist:mac`）
- README に配布手順を追記

## 受け入れ条件
- [ ] `npm run pack:mac` で `.app` が生成される
- [ ] `npm run dist:mac` で `.dmg` / `.zip` が生成される
- [ ] `npm run lint` / `npm run build` が通る
