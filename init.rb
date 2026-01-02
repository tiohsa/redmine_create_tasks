require_relative 'lib/create_tasks/issue_registration_result'
require_relative 'lib/create_tasks/issue_registration_service'

Redmine::Plugin.register :create_tasks do
  name 'Create Tasks'
  author 'Author name'
  description 'Create Tasks plugin for Redmine'
  version '0.0.1'
  url 'http://example.com/path/to/plugin'
  author_url 'http://example.com/about'

  project_module :create_tasks do
    permission :view_create_tasks, {
      create_tasks: [:index, :spa, :assets, :register_issues, :data],
      create_tasks_ai: [:settings, :update_settings, :extract, :defaults]
    }, :require => :member
  end

  menu :project_menu,
       :create_tasks,
       { controller: 'create_tasks', action: 'index' },
       :caption => :label_create_tasks,
       :param => :project_id,
       :permission => :view_create_tasks,
       :if => Proc.new { |project| User.current.allowed_to?(:add_issues, project) }

  settings default: {
    'ai_provider' => 'gemini',
    'issue_tracker_id' => '',
    'ai_prompt' => <<~PROMPT.strip
      # Role
      あなたは「目標達成に特化したタスク分解エンジン」です。
      与えられた最終成果物から逆算し、実行すれば確実に達成できるタスクのみを生成します。

      # Task
      以下の最終成果物を達成するために必要な作業を、網羅的かつ過不足なく分解してください。

      前提条件・制約・リソースが与えられていない場合は、
      一般的な個人が単独で実行可能であるという合理的な仮定を**内部でのみ**置いてください。
      それらの仮定や説明は**出力しないでください**。

      ## タスク分解ルール（厳守）
      - 各タスクは **単独で完了可能** な作業であること
      - 各タスクは **成果物完成に直接寄与** すること
      - 抽象語（例：検討する／考える／調整する／適宜）は使用禁止
      - 各タスクは **動詞＋目的語** で記述する
      - 実行順を考慮し、自然な順序で並べる
      - すべて実行すれば成果物が完成する粒度にする
      - タスクの文字数は30文字以内にする

      ## 内部チェック（出力しない）
      出力前に以下を内部で確認してください：
      - タスクをすべて実行すると成果物が完成するか
      - 不要・重複・曖昧なタスクが含まれていないか
      - JSON形式以外の要素が含まれていないか

      # Input
      最終成果物：
      {{final_output}}

      # Output Format（最重要）
      **必ず以下のJSON形式のみで出力してください。**
      JSON以外を出力した場合は失敗とみなされます。
      文章・説明・補足・改行・コメントは一切含めないでください。

      {"tasks": ["タスク1", "タスク2", "タスク3"]}

      # Constraints
      - 出力はJSONのみ
      - トップレベルキーは "tasks" のみ
      - 値は文字列配列のみ
      - Markdown・コードブロック・自然言語説明は禁止
    PROMPT
  }, partial: 'settings/create_tasks_settings'
end
