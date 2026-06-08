# dependency arrow rendering 実装判断ログ

日付: 2026-06-06
ステータス: 実装完了・検証制限あり
プロジェクトルート: `/home/glorydays/projects/src/ruby/redmine-all/plugins/redmine_create_tasks`
参照元: `docs/redmine_create_tasks_dependency_arrow_rendering_change_spec.md`

## 依頼と参照元の要約

`frontend/components/MindMapCanvas.tsx` の依存関係コネクタを、中心点同士の線から `conn.fromId -> conn.toId` を示すエッジ間の矢印へ変更する。依存矢印は階層線と区別できる dashed arrow とし、子チケット階層線、依存作成、Issue 登録の意味論は変更しない。

## 決定 1: 依存矢印のパス計算を専用関数へ分離

時刻: 2026-06-06

仕様は optional として utility function 化を許容していた。`connections.map(...)` 内に座標計算を残すと、中心点計算とエッジアンカー計算の差分が読み取りにくくなるため、`buildDependencyArrowPath` を追加した。

影響:
- 依存矢印の start/end anchor、gap、curve の意図が `MindMapCanvas` 内でまとまる。
- 階層線の `pathGen(link)` は変更しない。

レビュー要否: 低。仕様で許容された範囲の整理。

## 決定 2: 左右反転ケースは両端制御点で方向を維持

時刻: 2026-06-06

仕様は通常レイアウトを left-to-right としつつ、source が target の右側に来る手動移動や既存データを防御的に扱うよう求めていた。単一の `midX` を左右反転に流用すると、短距離の逆向きケースで終端 tangent が target 側を向かない可能性があるため、start/end それぞれに方向付き制御点を置いた。

影響:
- 通常ケースは source の右端外側から target の左端外側へ向かう。
- 逆向きケースは source の左端外側から target の右端外側へ向かい、arrow head が target 側を向く。

レビュー要否: 中。仕様の「direction-aware control points」を満たすための具体実装。

## 決定 3: `type` 未指定は dependency として描画し、非 dependency は除外

時刻: 2026-06-06

仕様の互換要件に `conn.type ?? 'dependency'` が明記されていた。既存データに `type` がない場合は依存として描画し、将来 `connections` に別種別が混在しても dependency arrow としては描画しないよう、描画側にも filter を追加した。

影響:
- `connections` の既存データ互換性を維持する。
- child-ticket 階層線との混同を避ける。

レビュー要否: 低。仕様に明記された互換処理。

## 検証

- `pnpm exec vitest run components/__tests__/MindMapCanvas.test.tsx`
  - `8 tests` passing
- `pnpm build`
  - Vite production build passing
- `pnpm exec vitest run`
  - `MindMapCanvas` / `Header` / `AiSettingsPanel` tests passed
  - `AiTaskExtractModal.test.tsx` failed on existing text expectations around `AIタスク抽出` and `Apply to defaults`

## 検証制限

Playwright による実ブラウザでの目視確認は未実行。SVG path の anchor 位置、marker、dashed style は unit test と production build で検証した。全体 `vitest` は `AiTaskExtractModal` の文言期待で失敗しており、この実装差分では未修正。
