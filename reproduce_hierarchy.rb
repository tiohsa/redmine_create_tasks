
# Reproduction Script for Hierarchy Issue

project = Project.first
user = User.first

puts "Using Project: #{project.name}"
puts "Using User: #{user.login}"

service = RedmineCreateTasks::IssueRegistrationService.new(project: project, user: user)

tasks = [
  {
    'id' => 'root-1',
    'subject' => 'Root Task',
    'start_date' => Date.today.to_s,
    'due_date' => Date.today.to_s,
    'man_days' => 1
  },
  {
    'id' => 'child-1',
    'subject' => 'Child Task',
    'start_date' => Date.today.to_s,
    'due_date' => Date.today.to_s,
    'man_days' => 1,
    'parent_task_id' => 'root-1'
  }
]

puts "Registering tasks..."
result = service.register(tasks)

puts "Success Count: #{result.success_count}"
puts "Success Sample IDs: #{result.success_sample_ids.inspect}"
puts "Failures: #{result.failures.inspect}"
puts "Warnings: #{result.warnings.inspect}"

if result.success_count == 2 && result.success_sample_ids.count >= 2
  issue1 = Issue.find(result.success_sample_ids[0])
  issue2 = Issue.find(result.success_sample_ids[1])
  
  root = issue1.subject == 'Root Task' ? issue1 : issue2
  child = issue1.subject == 'Child Task' ? issue1 : issue2
  
  puts "Root Issue ID: #{root.id}"
  puts "Child Issue ID: #{child.id}"
  puts "Child Parent ID: #{child.parent_id}"
  
  if child.parent_id == root.id
    puts "VERIFICATION PASSED: Child has correct parent."
  else
    puts "VERIFICATION FAILED: Child parent is #{child.parent_id.inspect}, expected #{root.id}"
  end
else
  puts "Registration failed partially or not enough IDs returned."
end
