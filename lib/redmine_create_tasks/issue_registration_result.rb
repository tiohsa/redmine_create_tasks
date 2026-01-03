module RedmineCreateTasks
  class IssueRegistrationResult
    attr_reader :success_count, :success_sample_ids, :failures, :warnings

    def initialize
      @success_count = 0
      @success_sample_ids = []
      @failures = []
      @warnings = []
    end

    def add_success(issue_id)
      @success_count += 1
      @success_sample_ids << issue_id if @success_sample_ids.length < 5
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
        warnings: @warnings
      }
    end
  end
end
