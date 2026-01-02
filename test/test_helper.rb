# Load the Redmine helper
require_relative '../../../test/test_helper'

module CreateTasksTestHelper
  def create_tasks_login_as(user)
    @request.session[:user_id] = user.id
  end
end
