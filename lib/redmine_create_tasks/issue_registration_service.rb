require 'date'

module RedmineCreateTasks
  class IssueRegistrationService
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

      unless @user.allowed_to?(:add_issues, @project)
        task_list.each { |task| result.add_failure(task[:id], I18n.t('redmine_create_tasks.errors.no_permission')) }
        return result
      end

      tracker, tracker_warning = resolve_tracker(defaults)
      if tracker.nil?
        task_list.each { |task| result.add_failure(task[:id], I18n.t('redmine_create_tasks.errors.tracker_unavailable')) }
        return result
      end

      issues_by_task = {}

      task_list.each do |task|
        subject = task[:subject].to_s.strip
        if subject.empty?
          result.add_failure(task[:id], I18n.t('redmine_create_tasks.errors.subject_missing'))
          next
        end

        issue = Issue.new(
          project: @project,
          tracker: tracker,
          subject: subject,
          priority: resolve_priority(defaults),
          status: resolve_status(defaults)
        )
        
        assigned_to = resolve_assigned_to(defaults)
        issue.assigned_to = assigned_to if assigned_to
        issue.author = @user
        
        category = resolve_category(defaults)
        issue.category = category if category

        apply_dates(issue, task, result)
        apply_estimated_hours(issue, task, result)
        if tracker_warning
          result.add_warning(task[:id], I18n.t('redmine_create_tasks.warnings.tracker_default'))
        end

        if issue.save
          result.add_success(issue.id)
          issues_by_task[task[:id]] = issue
        else
          result.add_failure(task[:id], issue.errors.full_messages.join(', '))
        end
      end

      apply_dependencies(task_list, issues_by_task, result)
      # Only apply hierarchy in 'child' mode (or when relation_mode is not set)
      unless defaults[:relation_mode]&.to_s == 'dependency'
        apply_hierarchy(task_list, issues_by_task, result)
      end
      result
    end

    private

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
          dep_issue = issues_by_task[dep_id]
          
          # If not found in current batch, try to find external issue
          if dep_issue.nil?
            dep_issue = find_external_dependency(dep_id, result, task[:id])
            next if dep_issue.nil?
          end

          next if IssueRelation.where(
            issue_from_id: dep_issue.id,
            issue_to_id: issue.id,
            relation_type: 'precedes'
          ).exists?

          relation = IssueRelation.new(
            issue_from: dep_issue,
            issue_to: issue,
            relation_type: 'precedes'
          )

          unless relation.save
            result.add_warning(
              task[:id],
              I18n.t('redmine_create_tasks.warnings.dependency_create_failed', reason: relation.errors.full_messages.join(', '))
            )
          end
        end
      end
    end

    def apply_hierarchy(task_list, issues_by_task, result)
      task_list.each do |task|
        next unless task[:parent_task_id].present?

        issue = issues_by_task[task[:id]]
        parent_issue = issues_by_task[task[:parent_task_id]]

        next if issue.nil?

        # If parent_issue is nil (e.g. parent was not in the list), we ignore it.
        # But now we check if it is an existing external issue.
        if parent_issue.nil?
          parent_issue = find_external_parent(task[:parent_task_id], result, task[:id])
        end
        
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
      return nil unless parent_id.to_s.match?(/\A\d+\z/)

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
      return nil unless dep_id.to_s.match?(/\A\d+\z/)

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
