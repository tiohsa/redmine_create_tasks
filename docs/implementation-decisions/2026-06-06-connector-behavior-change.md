# connector behavior change 実装判断ログ

日付: 2026-06-06
ステータス: 実装完了・検証制限あり
プロジェクトルート: `/home/glorydays/projects/src/ruby/redmine-all/plugins/redmine_create_tasks`
参照元: `docs/redmine_create_tasks_connector_behavior_change_spec.md`

## 決定 1: `connections` を依存関係専用として扱う

- 時刻: 2026-06-06
- 判断: 登録payloadとエクスポート用の依存マップは `children` ツリーから作らず、`connections` だけから作る。既存保存データの型なし connection は `connection.type ?? 'dependency'` で依存として扱う。
- 理由: 仕様が「親子は `children`、依存は `connections`」に分離し、`relation_mode` を削除することを求めているため。
- 影響: 旧来の `direction: 'left'` child を依存として登録する挙動は廃止される。旧データで左側 child として保存されているノードは親子ツリーとして残るが、依存として登録するには connection 化が必要。
- レビュー要否: 旧保存データの完全移行ポリシーが必要なら追加判断が必要。

## 決定 2: 左プラスクリックは root 直下の左側ノードと dependency connection を作る

- 時刻: 2026-06-06
- 判断: 任意ノードの左プラスクリックでは新規ノードを target の child にせず、root 直下の `direction: 'left'` ノードとして配置し、`newNode -> target` の dependency connection を追加する。
- 理由: 仕様の「左側に視覚配置しつつ predecessor として扱う」と「parent-child は `children` ツリーで表現」を同時に満たすため。
- 影響: 新規 predecessor は target の子ではないため、Redmine 登録では `parent_task_id` を持たず、`dependencies` のみで target に関連付く。
- 補足: target が root の場合も dependency connection を作る。root 直下に視覚配置された predecessor は、payload 作成時に root の子としては登録しないことで同一ペアの親子/依存重複を避ける。
- レビュー要否: predecessor を root 直下以外のどこに置くべきか追加UX要件が出た場合は再検討する。

## 決定 3: bottom plus click は既存の child 追加として残す

- 時刻: 2026-06-06
- 判断: 右側プラスは削除し、bottom plus は既存ノードの drop target に加えて新規 child 追加にも使う。
- 理由: 仕様は bottom plus のクリック挙動を optional としており、既存の新規 child 追加導線を維持すると操作性を落とさずに済むため。
- 影響: 新規 child の `direction` は既存描画ロジックに合わせて `'right'` を使うが、右側プラスUIは表示しない。
- レビュー要否: bottom click を完全に無効化したい場合はUX判断が必要。

## 決定 4: 検証範囲

- 時刻: 2026-06-06
- 実行済み: `npx vitest run components/__tests__/MindMapCanvas.test.tsx`、`npm run build`、`ruby -c lib/redmine_create_tasks/issue_registration_service.rb`、`ruby -c test/unit/test_issue_registration_service.rb`
- 制限: `npx vitest run` は既存の `AiTaskExtractModal` テスト2件で失敗した。今回追加した `MindMapCanvas` テストは成功している。
- 制限: `bundle exec ruby -Itest test/unit/test_issue_registration_service.rb` はプラグイン単体ディレクトリに `Gemfile` が無く実行できなかった。Redmine 本体の test DB 設定がある環境で再実行が必要。
- レビュー要否: CI/Redmine test 環境で backend unit test とE2Eを実行する必要がある。
