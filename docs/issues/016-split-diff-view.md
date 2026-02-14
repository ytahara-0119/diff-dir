# Issue #16: WinMerge風の左右分割差分ビュー

## 目的
差分を左右比較で読み取れるようにし、WinMergeに近い視認性を提供する。

## スコープ
- 差分表示を左右4列（Left # / Left / Right # / Right）へ変更
- removed/added の連続ブロックを左右行でペアリング
- 追加・削除・変更・文脈を行/セル色で可視化
- 既存の wrap / context 折りたたみ機能を維持

## 受け入れ条件
- [ ] テキスト差分が左右並列で表示される
- [ ] 追加/削除/変更が視認できる
- [ ] `npm run test` / `npm run lint` / `npm run build` が通る
