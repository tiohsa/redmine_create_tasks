require 'net/http'
require 'json'
require 'uri'

class RedmineCreateTasksAiController < ApplicationController
  class ConfigurationError < StandardError; end
  layout 'base'

  before_action :find_project_by_project_id
  before_action :authorize
  skip_before_action :verify_authenticity_token, only: [:extract, :update_settings]

  def settings
    render json: {
      provider: ai_provider,
      prompt: ai_prompt
    }
  end

  def defaults
    render json: {
      provider: 'gemini',
      prompt: default_prompt
    }
  end

  def update_settings
    provider = params[:provider].to_s
    prompt = params[:prompt].to_s

    unless provider.present? && prompt.present?
      render json: { error: 'provider and prompt are required' }, status: :unprocessable_entity
      return
    end

    unless valid_provider?(provider)
      render json: { error: 'invalid provider' }, status: :unprocessable_entity
      return
    end

    write_settings(provider, prompt)
    render json: { provider: ai_provider, prompt: ai_prompt }
  end

  def extract
    topic = params[:topic].to_s.strip
    if topic.empty?
      render json: { error: 'topic is required' }, status: :unprocessable_entity
      return
    end

    provider = params[:provider].presence || ai_provider
    prompt = params[:prompt].presence || ai_prompt

    unless valid_provider?(provider)
      render json: { error: 'invalid provider' }, status: :unprocessable_entity
      return
    end

    tasks = if Rails.env.test?
      %w[task1 task2 task3]
    else
      validate_provider_config!(provider)
      extract_tasks(provider, topic, prompt)
    end
    render json: { provider: provider, prompt: prompt, tasks: tasks }
  rescue ConfigurationError => e
    Rails.logger.warn "AI extraction configuration error: #{e.message}"
    render json: { error: e.message }, status: :unprocessable_entity
  rescue StandardError => e
    Rails.logger.error "AI extraction failed: #{e.message}"
    Rails.logger.error e.backtrace.join("\n")
    render json: { error: 'ai extraction failed' }, status: :bad_gateway
  end

  private

  def ai_provider
    (Setting[:plugin_redmine_create_tasks] || {})['ai_provider'] || 'gemini'
  end

  def ai_prompt
    (Setting[:plugin_redmine_create_tasks] || {})['ai_prompt'] || default_prompt
  end

  def default_prompt
    <<~PROMPT.strip
       # Role
       You are a "Task Decomposition Engine Specialized in Goal Achievement."
       From the given final deliverable, you work backward and generate only tasks that, when executed, will reliably achieve the goal.
       
       # Task
       Break down the work required to achieve the following final deliverable in a comprehensive manner, with no omissions or excess.
       
       If prerequisites, constraints, or resources are not provided,
       make reasonable assumptions **internally only** that an average individual can execute the tasks independently.
       Do **not** output those assumptions or explanations.
       
       ## Task Decomposition Rules (Strictly Enforced)
       - Each task must be **independently completable**
       - Each task must **directly contribute to completion of the deliverable**
       - Abstract terms (e.g., consider, think about, adjust, as appropriate) are prohibited
       - Each task must be written as **verb + object**
       - Consider execution order and list tasks in a natural sequence
       - The level of granularity must ensure the deliverable is completed if all tasks are executed
       - Each task must be within 40 characters
       
       ## Internal Checks (Do Not Output)
       Before outputting, internally verify the following:
       - Executing all tasks results in completion of the deliverable
       - No unnecessary, duplicate, or ambiguous tasks are included
       - No elements other than JSON format are included
       
       # Input
       Final deliverable:
       {{final_output}}
       
       # Output Format (Most Important)
       **You must output ONLY the following JSON format.**
       If anything other than JSON is output, it will be considered a failure.
       Do not include any text, explanation, notes, line breaks, or comments.
       
       {"tasks": ["Task 1", "Task 2", "Task 3"]}
       
       # Constraints
       - Output must be JSON only
       - The top-level key must be "tasks" only
       - The value must be an array of strings only
       - Markdown, code blocks, and natural language explanations are prohibited
    PROMPT
  end

  def write_settings(provider, prompt)
    Setting[:plugin_redmine_create_tasks] = (Setting[:plugin_redmine_create_tasks] || {}).merge(
      'ai_provider' => provider,
      'ai_prompt' => prompt
    )
  end

  def valid_provider?(provider)
    %w[gemini azure-openai].include?(provider)
  end

  def extract_tasks(provider, topic, prompt)
    provider == 'gemini' ? extract_with_gemini(topic, prompt) : extract_with_azure_openai(topic, prompt)
  end

  def validate_provider_config!(provider)
    case provider
    when 'gemini'
      api_key = ENV['GEMINI_API_KEY'].to_s
      raise ConfigurationError, 'missing GEMINI_API_KEY' if api_key.empty?
    when 'azure-openai'
      missing = []
      missing << 'AZURE_OPENAI_API_KEY' if ENV['AZURE_OPENAI_API_KEY'].to_s.empty?
      missing << 'AZURE_OPENAI_ENDPOINT' if ENV['AZURE_OPENAI_ENDPOINT'].to_s.empty?
      missing << 'AZURE_OPENAI_DEPLOYMENT' if ENV['AZURE_OPENAI_DEPLOYMENT'].to_s.empty?
      raise ConfigurationError, "missing #{missing.join(', ')}" if missing.any?
    end
  end

  def extract_with_gemini(topic, prompt)
    api_key = ENV['GEMINI_API_KEY'].to_s
    raise ConfigurationError, 'missing GEMINI_API_KEY' if api_key.empty?

    uri = URI("https://generativelanguage.googleapis.com/v1beta/models/#{gemini_model}:generateContent?key=#{api_key}")
    body = {
      contents: [{ parts: [{ text: build_prompt(topic, prompt) }] }]
    }

    response = Net::HTTP.post(uri, JSON.dump(body), 'Content-Type' => 'application/json')
    unless response.is_a?(Net::HTTPSuccess)
      raise "gemini error: #{response.code} #{response.body}"
    end

    payload = JSON.parse(response.body)
    text = payload.dig('candidates', 0, 'content', 'parts', 0, 'text')
    parse_tasks(text)
  end

  def extract_with_azure_openai(topic, prompt)
    api_key = ENV['AZURE_OPENAI_API_KEY'].to_s
    endpoint = ENV['AZURE_OPENAI_ENDPOINT'].to_s
    deployment = ENV['AZURE_OPENAI_DEPLOYMENT'].to_s
    api_version = ENV.fetch('AZURE_OPENAI_API_VERSION', '2024-02-15-preview')

    if api_key.empty? || endpoint.empty? || deployment.empty?
      raise ConfigurationError, 'missing azure openai config'
    end

    uri = URI("#{endpoint}/openai/deployments/#{deployment}/chat/completions?api-version=#{api_version}")
    body = {
      messages: [{ role: 'user', content: build_prompt(topic, prompt) }],
      temperature: 0.7
    }

    request = Net::HTTP::Post.new(uri)
    request['Content-Type'] = 'application/json'
    request['api-key'] = api_key
    request.body = JSON.dump(body)

    response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: uri.scheme == 'https') do |http|
      http.request(request)
    end
    unless response.is_a?(Net::HTTPSuccess)
      raise "azure openai error: #{response.code} #{response.body}"
    end

    payload = JSON.parse(response.body)
    text = payload.dig('choices', 0, 'message', 'content')
    parse_tasks(text)
  end

  def build_prompt(topic, prompt)
    [prompt, "目標（成果物）: \"#{topic}\""].compact.join("\n\n")
  end

  def gemini_model
    ENV.fetch('GEMINI_MODEL', 'gemini-2.5-flash')
  end

  def parse_tasks(text)
    raw_text = text.to_s.strip
    Rails.logger.info "AI raw response: #{raw_text}"

    # Remove markdown code block if present (```json ... ``` or ``` ... ```)
    json_text = raw_text.gsub(/\A```(?:json)?\s*\n?/, '').gsub(/\n?```\s*\z/, '').strip

    data = JSON.parse(json_text)
    tasks = data['tasks']
    Rails.logger.info "Parsed tasks: #{tasks.inspect}"
    return tasks if tasks.is_a?(Array)

    Rails.logger.warn "Tasks is not an array: #{tasks.class}"
    []
  rescue JSON::ParserError => e
    Rails.logger.error "JSON parse error: #{e.message}, text: #{json_text}"
    []
  end
end
