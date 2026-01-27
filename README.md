# Create Tasks Redmine Plugin

Create Tasks is a Redmine plugin that helps break down a final deliverable into actionable tasks, visualize dependencies, and register issues in bulk.

## Features

- Mind-map style task planning with prerequisites
- AI-assisted task extraction (Gemini or Azure OpenAI)
- Schedule calculation and critical path highlighting
- Issue registration with configurable defaults
- Multi-page planning, undo, and JSON export

![alt text](./images/redmine_create_tasks.png)

## Requirements

- Redmine
- Node.js and npm (for building frontend assets)

## Installation

1. **Install the plugin**
   ```bash
   cd /path/to/redmine/plugins
   git clone <repository-url> redmine_create_tasks
   ```

2. **Install frontend dependencies**
   ```bash
   cd redmine_create_tasks/frontend
   npm install
   ```

3. **Build frontend assets**
   ```bash
   npm run build
   ```
   This writes compiled assets to `assets/javascripts/spa.js` and `assets/stylesheets/spa.css`.

4. **Restart Redmine**

## Configuration

1. **Enable the module**
   - Project Settings → Modules → enable **Create Tasks**.

2. **Permissions**
   - Grant the role the `view_redmine_create_tasks` permission.
   - Users also need the standard `Add issues` permission to open the page.

3. **Plugin settings**
   - Administration → Plugins → Create Tasks → Configure.
   - Settings: `ai_provider`, `ai_prompt`, `issue_tracker_id`.

4. **Default prompt**
   - See `lib/prompts/task_extraction_prompt.md` for the recommended prompt text.

## AI Providers

### Gemini

Required environment variables:

- `GEMINI_API_KEY`

Optional:

- `GEMINI_MODEL` (default: `gemini-2.5-flash`)

### Azure OpenAI

Required environment variables:

- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_DEPLOYMENT`

Optional:

- `AZURE_OPENAI_API_VERSION` (default: `2024-02-15-preview`)

Set these in the Redmine process environment (systemd, docker-compose, etc.).

## Usage

1. Open a project and select **Create Tasks** from the project menu.
2. Build tasks in the mind map, set prerequisites, and calculate schedules/critical paths.
3. Use **Extract with AI** to generate tasks, then register issues in bulk.
4. Export the plan as JSON when needed.

## Development

- Run the frontend dev server:
  ```bash
  cd redmine_create_tasks/frontend
  npm run dev
  ```
- Rebuild assets before deploying:
  ```bash
  npm run build
  ```

## License

GNU General Public License v2.0 (GPLv2)
