# dependency replacement 実装判断ログ

日付: 2026-06-07

ステータス: 実装完了・検証済み

プロジェクトルート: `/home/glorydays/projects/src/ruby/redmine-all/plugins/redmine_create_tasks`

参照元: ユーザー提供計画「依存関係の付け替え機能」

## 決定 1: incoming dependency がある場合だけ `drop先 -> ドラッグ元` へ付け替える

`addDependencyConnection(data, connections, fromId, toId, connectionId)` の既存 API は変えず、`fromId` に対する dependency incoming edge を見て付け替え対象を判定した。

付け替え時は `*.toId === fromId` の dependency を削除し、`toId -> fromId` を追加する。`toId -> fromId` が既に存在し、他の incoming dependency もある場合は、既存 edge を残して他の incoming dependency だけ削除する。

## 決定 2: 子/子孫を親へ依存化する既存動作を付け替えより優先する

計画に「親子関係解除の既存挙動は維持」とあるため、`fromId` が `toId` の子孫であるケースは従来どおり `fromId -> toId` を追加し、必要に応じて `fromId` を root へ detach する分岐に流した。

このため、子孫ノードに incoming dependency がある場合でも、親子解除操作として扱われる。

## 決定 3: cycle 判定は削除予定の incoming dependency を除外して行う

付け替えでは既存 incoming dependency を削除してから `toId -> fromId` を追加するため、cycle 判定も削除後の接続集合に対して行う。

これにより、削除される `B -> D` が残っている前提で `C -> D` を誤って cycle 扱いすることを避ける。一方で、削除後にも `D -> A -> C` のような path が残る場合は `C -> D` を拒否する。

## 決定 4: 旧 cycle テストの期待値を新仕様に合わせて更新した

既存テストの `B -> A`, `C -> B` がある状態で `A` を `C` に drop するケースは、旧仕様では `A -> C` 追加による cycle 拒否だった。

新仕様では `A` に incoming dependency があるため、`B -> A` を削除して `C -> A` に付け替えるのが正しい。cycle 拒否は別途、付け替え後も cycle になるケースで検証した。

## 検証

- `cd frontend && npx vitest run utils/__tests__/nodeMove.test.ts components/__tests__/MindMapCanvas.test.tsx`
- `cd frontend && pnpm build`

どちらも成功。
