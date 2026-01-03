# Plugin's routes
# See: http://guides.rubyonrails.org/routing.html
Rails.application.routes.draw do
  get 'projects/:project_id/redmine_create_tasks', to: 'redmine_create_tasks#index', as: 'project_redmine_create_tasks'
  get 'projects/:project_id/redmine_create_tasks/spa', to: 'redmine_create_tasks#spa', as: 'project_redmine_create_tasks_spa'
  get 'projects/:project_id/redmine_create_tasks/assets/*asset', to: 'redmine_create_tasks#assets', as: 'project_redmine_create_tasks_assets'
  post 'projects/:project_id/redmine_create_tasks/issues', to: 'redmine_create_tasks#register_issues', as: 'project_redmine_create_tasks_issues'
  get 'projects/:project_id/redmine_create_tasks/data', to: 'redmine_create_tasks#data', as: 'project_redmine_create_tasks_data'
  get 'projects/:project_id/redmine_create_tasks/ai/settings', to: 'redmine_create_tasks_ai#settings', as: 'project_redmine_create_tasks_ai_settings'
  get 'projects/:project_id/redmine_create_tasks/ai/defaults', to: 'redmine_create_tasks_ai#defaults', as: 'project_redmine_create_tasks_ai_defaults'
  put 'projects/:project_id/redmine_create_tasks/ai/settings', to: 'redmine_create_tasks_ai#update_settings', as: 'project_redmine_create_tasks_ai_update_settings'
  post 'projects/:project_id/redmine_create_tasks/ai/extract', to: 'redmine_create_tasks_ai#extract', as: 'project_redmine_create_tasks_ai_extract'
end
