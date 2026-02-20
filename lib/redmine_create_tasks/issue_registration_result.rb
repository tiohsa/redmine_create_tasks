module RedmineCreateTasks
  class IssueRegistrationResult
    attr_reader :success_count, :success_sample_ids, :failures, :warnings, :id_mapping

    def initialize
      @success_count = 0
      @success_sample_ids = []
      @failures = []
      @warnings = []
      @id_mapping = {}
    end

    def add_success(task_id, issue_id)
      @success_count += 1
      @success_sample_ids << issue_id if @success_sample_ids.length < 5
      @id_mapping[task_id.to_s] = issue_id.to_s
    end

    def add_failure(task_id, reason)
      @failures << { task_id: task_id.to_s, reason: reason }
    end

    def add_warning(task_id, reason)
      @warnings << { task_id: task_id.to_s, reason: reason }
    end

    def to_h
      {
        success_count: @success_count,
        success_sample_ids: @success_sample_ids,
        failures: @failures,
        warnings: @warnings,
        id_mapping: @id_mapping
      }
    end
  end
end
