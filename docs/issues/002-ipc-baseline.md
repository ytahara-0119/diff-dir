# Issue #2: IPC基盤と型定義の整備

## 目的
Renderer(UI) と Main(比較ロジック) の通信を、安全で拡張しやすい形で整備する。

## スコープ
- `contextBridge` 経由で公開する API の設計
- IPC channel 定義（送受信イベント名の固定）
- Request/Response の TypeScript 型定義
- ダミー比較リクエストの往復実装

## 実装タスク
- [ ] `src/shared/ipc.ts` を作成し、channel 名と型を定義する
- [ ] `src/preload/preload.ts` で `window.diffDirApi` を expose する
- [ ] `src/main` 側で IPC handler を実装する（まずはダミー応答）
- [ ] `src/renderer` 側から API 呼び出しを行う
- [ ] 失敗時のエラー型（最低限 message）を統一する

## 受け入れ条件
- [ ] Renderer から Main にダミー比較リクエストを送信できる
- [ ] Main から型付きレスポンスを返せる
- [ ] 型エラーなしで `npm run build` が通る
- [ ] `npm run lint` が通る

## メモ
- 先に API の最小セットを固定し、Issue #4 以降で中身の比較ロジックを置き換える。
- 今回は merge 機能は考慮しない。
