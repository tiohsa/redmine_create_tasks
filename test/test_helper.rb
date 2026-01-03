# Load the Redmine helper
require_relative '../../../test/test_helper'

module RedmineCreateTasksTestHelper
  def redmine_create_tasks_login_as(user)
    @request.session[:user_id] = user.id
  end
end
