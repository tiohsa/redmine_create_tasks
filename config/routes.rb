# Plugin's routes
# See: http://guides.rubyonrails.org/routing.html
Rails.application.routes.draw do
  get 'projects/:project_id/create_tasks', to: 'create_tasks#index', as: 'project_create_tasks'
  get 'projects/:project_id/create_tasks/spa', to: 'create_tasks#spa', as: 'project_create_tasks_spa'
  get 'projects/:project_id/create_tasks/assets/*asset', to: 'create_tasks#assets', as: 'project_create_tasks_assets'
  post 'projects/:project_id/create_tasks/issues', to: 'create_tasks#register_issues', as: 'project_create_tasks_issues'
  get 'projects/:project_id/create_tasks/data', to: 'create_tasks#data', as: 'project_create_tasks_data'
  get 'projects/:project_id/create_tasks/ai/settings', to: 'create_tasks_ai#settings', as: 'project_create_tasks_ai_settings'
  get 'projects/:project_id/create_tasks/ai/defaults', to: 'create_tasks_ai#defaults', as: 'project_create_tasks_ai_defaults'
  put 'projects/:project_id/create_tasks/ai/settings', to: 'create_tasks_ai#update_settings', as: 'project_create_tasks_ai_update_settings'
  post 'projects/:project_id/create_tasks/ai/extract', to: 'create_tasks_ai#extract', as: 'project_create_tasks_ai_extract'
end
