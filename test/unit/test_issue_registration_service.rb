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

  def test_register_applies_dependencies_and_hierarchy_in_same_call
    tasks = [
      { id: 'parent', subject: 'Parent Task' },
      { id: 'predecessor', subject: 'Predecessor Task' },
      { id: 'child', subject: 'Child Task', parent_task_id: 'parent', dependencies: ['predecessor'] }
    ]

    result = @service.register(tasks, { relation_mode: 'dependency' })

    assert_equal 3, result.success_count
    assert_empty result.failures

    parent_issue = Issue.find_by(subject: 'Parent Task')
    predecessor_issue = Issue.find_by(subject: 'Predecessor Task')
    child_issue = Issue.find_by(subject: 'Child Task')

    assert_equal parent_issue.id, child_issue.parent_id
    assert IssueRelation.where(
      issue_from_id: predecessor_issue.id,
      issue_to_id: child_issue.id,
      relation_type: 'precedes'
    ).exists?
  end

  def test_register_does_not_duplicate_existing_precedes_relation
    predecessor_issue = Issue.generate!(project: @project, subject: 'Existing Predecessor', status_id: 1)
    tasks = [
      {
        id: 'child',
        subject: 'New Child',
        dependencies: [predecessor_issue.id.to_s, predecessor_issue.id.to_s]
      }
    ]

    result = @service.register(tasks)

    assert_equal 1, result.success_count
    assert_empty result.failures
    child_issue = Issue.find_by(subject: 'New Child')

    assert_equal 1, IssueRelation.where(
      issue_from_id: predecessor_issue.id,
      issue_to_id: child_issue.id,
      relation_type: 'precedes'
    ).count
  end

  private

  def warnings_for(result, task_id)
    result.warnings.select { |warning| warning[:task_id] == task_id.to_s }
  end
end
