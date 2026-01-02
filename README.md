# Create Tasks Redmine Plugin

A Redmine plugin to decompose a final goal into actionable tasks using AI.

## Features

- **AI-Powered Task Decomposition**: Uses AI (default: Gemini) to break down a "Final Output" goal into a list of specific tasks.
- **Issue Creation Permission-Based Access**: Accessible to users with `:add_issues` permission in the project.
- **Project Menu Integration**: Accessible directly from the project menu for authorized users.

## Requirements

- Redmine
- Node.js & npm (for building the frontend)
- Docker (optional, for development environment)

## Installation

1. **Clone the Plugin**
   Navigate to your Redmine plugins directory:
   ```bash
   cd plugins/
   git clone <repository-url> create_tasks
   ```

2. **Install Frontend Dependencies**
   Navigate to the frontend directory (if available for development):
   ```bash
   cd create_tasks/frontend
   npm install
   ```

3. **Build Frontend**
   Compile the frontend assets:
   ```bash
   npm run build
   ```

4. **Restart Redmine**
   Restart your Redmine instance to apply changes.
   If using Docker:
   ```bash
   docker compose restart redmine
   ```

## Configuration

Go to **Administration > Plugins > Create Tasks > Configure**.

Available settings:
- **AI Provider**: Select the AI provider (default: `gemini`).
- **Issue Tracker ID**: Specify the Tracker ID for the tasks to be created.
- **AI Prompt**: Customize the system prompt used for task decomposition.

## License

MIT License
