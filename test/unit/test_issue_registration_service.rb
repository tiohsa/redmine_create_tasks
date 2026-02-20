require File.expand_path('../../test_helper', __FILE__)

class IssueRegistrationServiceTest < ActiveSupport::TestCase
  fixtures :projects, :users, :email_addresses, :trackers, :issue_statuses, :enumerations, :issues

  def setup
    @project = Project.find(1)
    @user = User.find(2) # jsmith
    @service = RedmineCreateTasks::IssueRegistrationService.new(project: @project, user: @user)
  end

  def test_register_with_existing_external_parent
    parent_issue = Issue.generate!(project: @project, subject: 'External Parent', status_id: 1)

    tasks = [
      { id: 't1', subject: 'Child Task', parent_task_id: parent_issue.id }
    ]

    result = @service.register(tasks)

    assert_equal 1, result.success_count
    assert_empty result.failures
    assert_empty warnings_for(result, 't1')

    child_issue = Issue.last
    assert_equal 'Child Task', child_issue.subject
    assert_equal parent_issue.id, child_issue.parent_id
  end

  def test_register_with_closed_external_parent
    closed_status = IssueStatus.find_by(is_closed: true) || IssueStatus.create!(name: 'Closed', is_closed: true)
    parent_issue = Issue.generate!(project: @project, subject: 'Closed Parent', status: closed_status)

    tasks = [
      { id: 't1', subject: 'Child Task', parent_task_id: parent_issue.id }
    ]

    result = @service.register(tasks)

    assert_equal 1, result.success_count
    assert_empty result.failures
    assert_operator warnings_for(result, 't1').length, :>=, 1

    child_issue = Issue.last
    assert_equal 'Child Task', child_issue.subject
    assert_nil child_issue.parent_id
  end

  def test_register_with_non_existent_external_parent
    tasks = [
      { id: 't1', subject: 'Child Task', parent_task_id: 999_999 }
    ]

    result = @service.register(tasks)

    assert_equal 1, result.success_count
    assert_empty result.failures
    assert_operator warnings_for(result, 't1').length, :>=, 1

    child_issue = Issue.last
    assert_equal 'Child Task', child_issue.subject
    assert_nil child_issue.parent_id
  end

  private

  def warnings_for(result, task_id)
    result.warnings.select { |warning| warning[:task_id] == task_id.to_s }
  end
end
