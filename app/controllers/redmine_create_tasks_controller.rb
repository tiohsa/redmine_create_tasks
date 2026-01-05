require_relative '../../lib/redmine_create_tasks/issue_registration_result'
require_relative '../../lib/redmine_create_tasks/issue_registration_service'

class RedmineCreateTasksController < ApplicationController
  layout 'base'

  before_action :find_project_by_project_id
  before_action :require_redmine_create_tasks_access

  def index
  end

  def spa
    render layout: false
  end

  def assets
    candidate_path = asset_path_for(params[:asset])

    unless asset_path_allowed?(candidate_path)
      render plain: 'Not Found', status: :not_found
      return
    end

    send_file candidate_path,
              type: Rack::Mime.mime_type(candidate_path.extname),
              disposition: 'inline'
  end

  def register_issues
    tasks = params[:tasks]
    unless tasks.is_a?(Array)
      render json: { error: 'tasks is required' }, status: :unprocessable_entity
      return
    end

    defaults = params[:defaults]
    # defaults is optional, but if provided, it should be a hash.
    # Strong parameters handling might be needed depending on Rails version/config,
    # but for now we expect a simple hash or nil.
    
    service = RedmineCreateTasks::IssueRegistrationService.new(project: @project, user: User.current)
    result = service.register(tasks, defaults: defaults)
    render json: result.to_h
  end

  def data
    render json: {
      trackers: @project.trackers.select(:id, :name).map { |t| { id: t.id, name: t.name } },
      users: @project.assignable_users.map { |u| { id: u.id, name: u.name } },
      issue_statuses: IssueStatus.all.select(:id, :name).map { |s| { id: s.id, name: s.name } },
      priorities: IssuePriority.active.select(:id, :name).map { |p| { id: p.id, name: p.name } },
      categories: @project.issue_categories.select(:id, :name).map { |c| { id: c.id, name: c.name } }
    }
  end

  private

  def ensure_logged_in
    return true if User.current.logged?

    redirect_to signin_path
    false
  end

  def require_redmine_create_tasks_access
    return unless ensure_logged_in
    deny_access unless User.current.allowed_to?(:add_issues, @project)
  end

  def assets_root
    Rails.root.join('plugins', 'redmine_create_tasks', 'frontend', 'dist', 'assets').expand_path
  end

  def asset_path_for(requested)
    assets_root.join(requested.to_s).expand_path
  end

  def asset_path_allowed?(candidate)
    candidate.to_s.start_with?(assets_root.to_s) && File.file?(candidate)
  end
end
