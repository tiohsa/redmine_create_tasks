require_relative 'lib/create_tasks/issue_registration_result'
require_relative 'lib/create_tasks/issue_registration_service'

Redmine::Plugin.register :create_tasks do
  name 'Redmine Create Tasks'
  author 'tiohsa'
  description 'Create Tasks plugin for Redmine'
  version '0.0.1'
  url 'https://github.com/tiohsa/redmine_create_tasks'
  author_url 'https://github.com/tiohsa'

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
       You are a "Task Decomposition Engine Specialized in Goal Achievement."
       From the given final deliverable, you work backward and generate only tasks that, when executed, will reliably achieve the goal.
       
       # Task
       Break down the work required to achieve the following final deliverable in a comprehensive manner, with no omissions or excess.
       
       If prerequisites, constraints, or resources are not provided,
       make reasonable assumptions **internally only** that an average individual can execute the tasks independently.
       Do **not** output those assumptions or explanations.
       
       ## Task Decomposition Rules (Strictly Enforced)
       - Each task must be **independently completable**
       - Each task must **directly contribute to completion of the deliverable**
       - Abstract terms (e.g., consider, think about, adjust, as appropriate) are prohibited
       - Each task must be written as **verb + object**
       - Consider execution order and list tasks in a natural sequence
       - The level of granularity must ensure the deliverable is completed if all tasks are executed
       - Each task must be within 40 characters
       
       ## Internal Checks (Do Not Output)
       Before outputting, internally verify the following:
       - Executing all tasks results in completion of the deliverable
       - No unnecessary, duplicate, or ambiguous tasks are included
       - No elements other than JSON format are included
       
       # Input
       Final deliverable:
       {{final_output}}
       
       # Output Format (Most Important)
       **You must output ONLY the following JSON format.**
       If anything other than JSON is output, it will be considered a failure.
       Do not include any text, explanation, notes, line breaks, or comments.
       
       {"tasks": ["Task 1", "Task 2", "Task 3"]}
       
       # Constraints
       - Output must be JSON only
       - The top-level key must be "tasks" only
       - The value must be an array of strings only
       - Markdown, code blocks, and natural language explanations are prohibited
    PROMPT
  }, partial: 'settings/create_tasks_settings'
end
