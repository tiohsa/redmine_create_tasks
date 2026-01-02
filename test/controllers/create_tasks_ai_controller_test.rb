require_relative '../test_helper'

class CreateTasksAiControllerTest < ActionController::TestCase
  include CreateTasksTestHelper

  fixtures :projects, :users, :members, :roles, :member_roles, :enabled_modules

  def setup
    @project = Project.find(1)
    create_tasks_login_as(User.find(1))
  end

  def test_extract_returns_tasks
    post :extract, params: { project_id: @project.identifier, topic: '品質改善' }
    assert_response :success

    body = JSON.parse(@response.body)
    assert body.key?('tasks')
    assert body['tasks'].is_a?(Array)
    assert body['tasks'].length.between?(3, 5)
  end

  def test_extract_missing_topic_returns_error
    post :extract, params: { project_id: @project.identifier, topic: '' }
    assert_response :unprocessable_entity

    body = JSON.parse(@response.body)
    assert body.key?('error')
  end
end

  def test_settings_returns_provider_and_prompt
    get :settings, params: { project_id: @project.identifier }
    assert_response :success

    body = JSON.parse(@response.body)
    assert body.key?('provider')
    assert body.key?('prompt')
  end

  def test_update_settings_requires_payload
    put :update_settings, params: { project_id: @project.identifier }
    assert_response :unprocessable_entity

    body = JSON.parse(@response.body)
    assert body.key?('error')
  end
