require_relative '../test_helper'
require 'fileutils'

class RedmineCreateTasksControllerTest < ActionController::TestCase
  include RedmineCreateTasksTestHelper

  fixtures :projects, :users, :members, :roles, :member_roles, :enabled_modules

  def setup
    @project = Project.find(1)
    @asset_dir = Rails.root.join('plugins', 'redmine_create_tasks', 'frontend', 'dist', 'assets')
    FileUtils.mkdir_p(@asset_dir)
    @test_asset = @asset_dir.join('test-asset.js')
    File.write(@test_asset, 'console.log("redmine_create_tasks");')
  end

  def teardown
    FileUtils.rm_f(@test_asset)
  end

  def test_index_renders_iframe
    redmine_create_tasks_login_as(User.find(1))
    get :index, params: project_params
    assert_response :success
    assert_select 'iframe.create-tasks-frame'
  end

  def test_spa_renders_root
    redmine_create_tasks_login_as(User.find(1))
    get :spa, params: project_params
    assert_response :success
    assert_includes @response.body, 'id="root"'
  end

  def test_assets_serves_static_file
    redmine_create_tasks_login_as(User.find(1))
    get :assets, params: project_params.merge(asset: 'test-asset.js')
    assert_response :success
    assert_includes @response.body, 'redmine_create_tasks'
  end

  def test_requires_login_redirects_to_signin
    get :index, params: project_params
    assert_redirected_to signin_path
  end

  def test_assets_returns_not_found_for_missing_file
    redmine_create_tasks_login_as(User.find(1))
    get :assets, params: project_params.merge(asset: 'missing.js')
    assert_response :not_found
  end

  private

  def project_params
    { project_id: @project.identifier }
  end
end
