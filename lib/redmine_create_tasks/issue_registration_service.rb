require 'date'

module RedmineCreateTasks
  class IssueRegistrationService
    EXTERNAL_ISSUE_ID_PATTERN = /\A\d+\z/.freeze

    attr_reader :project, :user

    def initialize(project:, user:)
      @project = project
      @user = user
    end

    def register(tasks, defaults: nil)
      result = IssueRegistrationResult.new
      task_list = normalize_tasks(tasks)
      return result if task_list.empty?

      defaults = normalize_defaults(defaults)
      resolved_defaults = resolve_issue_defaults(defaults)

      return add_failures_for_all_tasks(task_list, result, I18n.t('redmine_create_tasks.errors.no_permission')) unless @user.allowed_to?(:add_issues, @project)

      tracker, tracker_warning = resolve_tracker(defaults)
      return add_failures_for_all_tasks(task_list, result, I18n.t('redmine_create_tasks.errors.tracker_unavailable')) if tracker.nil?

      issues_by_task = create_issues(task_list, tracker, resolved_defaults, result, tracker_warning)

      apply_dependencies(task_list, issues_by_task, result)
      apply_hierarchy(task_list, issues_by_task, result) unless dependency_mode?(defaults)
      result
    end

    private

    def add_failures_for_all_tasks(task_list, result, reason)
      task_list.each { |task| result.add_failure(task[:id], reason) }
      result
    end

    def dependency_mode?(defaults)
      defaults[:relation_mode]&.to_s == 'dependency'
    end

    def normalize_defaults(defaults)
      return {} unless defaults.respond_to?(:to_h) || defaults.respond_to?(:to_unsafe_h)
      d = defaults.respond_to?(:to_unsafe_h) ? defaults.to_unsafe_h : defaults.to_h
      d.symbolize_keys
    end

    def normalize_tasks(tasks)
      tasks.each_with_index.filter_map do |task, index|
        next unless task.respond_to?(:to_h) || task.respond_to?(:to_unsafe_h)
        data = task.respond_to?(:to_unsafe_h) ? task.to_unsafe_h : task.to_h
        task_id = (data['id'] || data[:id] || "row-#{index + 1}").to_s
        {
          id: task_id,
          subject: data['subject'] || data[:subject] || data['text'] || data[:text],
          start_date: data['start_date'] || data[:start_date],
          due_date: data['due_date'] || data[:due_date],
          man_days: data['man_days'] || data[:man_days],
          dependencies: Array(data['dependencies'] || data[:dependencies]).map(&:to_s),
          parent_task_id: (data['parent_task_id'] || data[:parent_task_id])&.to_s
        }
      end
    end

    def resolve_issue_defaults(defaults)
      {
        priority: resolve_priority(defaults),
        status: resolve_status(defaults),
        assigned_to: resolve_assigned_to(defaults),
        category: resolve_category(defaults)
      }
    end

    def resolve_tracker(defaults)
      if defaults[:tracker_id].present?
        tracker = Tracker.find_by(id: defaults[:tracker_id])
        return [tracker, false] if tracker
      end

      setting_id = (Setting[:plugin_redmine_create_tasks] || {})['issue_tracker_id'].to_s
      return [Tracker.find_by(id: setting_id), false] if setting_id.present?

      default_tracker = @project.trackers.first
      [default_tracker, true]
    end

    def resolve_priority(defaults)
      if defaults[:priority_id].present?
        priority = IssuePriority.find_by(id: defaults[:priority_id])
        return priority if priority
      end
      IssuePriority.find_by(name: 'Normal') || IssuePriority.default
    end

    def resolve_status(defaults)
      if defaults[:status_id].present?
        status = IssueStatus.find_by(id: defaults[:status_id])
        return status if status
      end
      IssueStatus.find_by(name: 'New') || IssueStatus.default
    end

    def resolve_assigned_to(defaults)
      if defaults[:assigned_to_id].present?
        return Principal.find_by(id: defaults[:assigned_to_id])
      end
      @user
    end

    def resolve_category(defaults)
      if defaults[:category_id].present?
        return IssueCategory.find_by(id: defaults[:category_id])
      end
      nil
    end

    def create_issues(task_list, tracker, resolved_defaults, result, tracker_warning)
      issues_by_task = {}

      task_list.each do |task|
        subject = task[:subject].to_s.strip
        if subject.empty?
          result.add_failure(task[:id], I18n.t('redmine_create_tasks.errors.subject_missing'))
          next
        end

        issue = build_issue(task, subject, tracker, resolved_defaults, result, tracker_warning)
        save_issue(task, issue, issues_by_task, result)
      end

      issues_by_task
    end

    def build_issue(task, subject, tracker, resolved_defaults, result, tracker_warning)
      issue = Issue.new(
        project: @project,
        tracker: tracker,
        subject: subject,
        priority: resolved_defaults[:priority],
        status: resolved_defaults[:status]
      )

      issue.assigned_to = resolved_defaults[:assigned_to] if resolved_defaults[:assigned_to]
      issue.category = resolved_defaults[:category] if resolved_defaults[:category]
      issue.author = @user

      apply_dates(issue, task, result)
      apply_estimated_hours(issue, task, result)
      result.add_warning(task[:id], I18n.t('redmine_create_tasks.warnings.tracker_default')) if tracker_warning
      issue
    end

    def save_issue(task, issue, issues_by_task, result)
      if issue.save
        result.add_success(issue.id)
        issues_by_task[task[:id]] = issue
      else
        result.add_failure(task[:id], issue.errors.full_messages.join(', '))
      end
    end

    def apply_dates(issue, task, result)
      start_date = parse_date(task[:start_date])
      due_date = parse_date(task[:due_date])

      if start_date
        issue.start_date = start_date
      else
        result.add_warning(task[:id], I18n.t('redmine_create_tasks.warnings.start_date_missing'))
      end

      if due_date
        issue.due_date = due_date
      else
        result.add_warning(task[:id], I18n.t('redmine_create_tasks.warnings.due_date_missing'))
      end
    end

    def apply_estimated_hours(issue, task, result)
      man_days = parse_number(task[:man_days])
      if man_days.nil? || man_days <= 0
        result.add_warning(task[:id], I18n.t('redmine_create_tasks.warnings.man_days_missing'))
        return
      end

      issue.estimated_hours = (man_days * 8).round(1)
    end

    def apply_dependencies(task_list, issues_by_task, result)
      task_list.each do |task|
        issue = issues_by_task[task[:id]]
        next if issue.nil?

        Array(task[:dependencies]).each do |dep_id|
          dep_issue = resolve_dependency_issue(dep_id, issues_by_task, result, task[:id])
          next if dep_issue.nil? || precedes_relation_exists?(dep_issue, issue)

          create_precedes_relation(dep_issue, issue, result, task[:id])
        end
      end
    end

    def apply_hierarchy(task_list, issues_by_task, result)
      task_list.each do |task|
        next unless task[:parent_task_id].present?

        issue = issues_by_task[task[:id]]
        parent_issue = issues_by_task[task[:parent_task_id]]

        next if issue.nil?

        parent_issue = find_external_parent(task[:parent_task_id], result, task[:id]) if parent_issue.nil?
        next if parent_issue.nil?

        issue.reload
        parent_issue.reload
        issue.parent_id = parent_issue.id
        unless issue.save
          result.add_warning(
            task[:id],
            I18n.t('redmine_create_tasks.warnings.hierarchy_failed', reason: issue.errors.full_messages.join(', '))
          )
        end
      end
    end

    def resolve_dependency_issue(dep_id, issues_by_task, result, task_id)
      issues_by_task[dep_id] || find_external_dependency(dep_id, result, task_id)
    end

    def precedes_relation_exists?(from_issue, to_issue)
      IssueRelation.where(
        issue_from_id: from_issue.id,
        issue_to_id: to_issue.id,
        relation_type: 'precedes'
      ).exists?
    end

    def create_precedes_relation(dep_issue, issue, result, task_id)
      relation = IssueRelation.new(
        issue_from: dep_issue,
        issue_to: issue,
        relation_type: 'precedes'
      )

      return if relation.save

      result.add_warning(
        task_id,
        I18n.t('redmine_create_tasks.warnings.dependency_create_failed', reason: relation.errors.full_messages.join(', '))
      )
    end

    def parse_date(value)
      return nil if value.nil?
      Date.parse(value.to_s)
    rescue ArgumentError
      nil
    end

    def parse_number(value)
      return nil if value.nil?
      Float(value)
    rescue ArgumentError, TypeError
      nil
    end

    def find_external_parent(parent_id, result, task_id)
      return nil unless parent_id.to_s.match?(EXTERNAL_ISSUE_ID_PATTERN)

      issue = Issue.find_by(id: parent_id)
      if issue.nil?
        result.add_warning(
          task_id,
          I18n.t('redmine_create_tasks.warnings.parent_not_found', id: parent_id)
        )
        return nil
      end

      if issue.closed?
        result.add_warning(
          task_id,
          I18n.t('redmine_create_tasks.warnings.parent_closed', id: parent_id)
        )
        return nil
      end

      issue
    end

    def find_external_dependency(dep_id, result, task_id)
      return nil unless dep_id.to_s.match?(EXTERNAL_ISSUE_ID_PATTERN)

      issue = Issue.find_by(id: dep_id)
      if issue.nil?
        result.add_warning(
          task_id,
          I18n.t('redmine_create_tasks.warnings.dependency_missing', dependency: dep_id)
        )
        return nil
      end

      issue
    end
  end
end
