import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// Execute tasks in background
async function executeTasksInBackground(agentId: string) {
  const client = await pool.connect();
  try {
    // Get agent and tasks
    const agentResult = await client.query('SELECT * FROM agents WHERE id = $1', [agentId]);
    const agent = agentResult.rows[0];

    if (!agent) return;

    // Get all tasks
    const tasksResult = await client.query(
      'SELECT * FROM tasks WHERE agent_id = $1 ORDER BY order_index ASC',
      [agentId]
    );
    const tasks = tasksResult.rows;

    // Execute tasks sequentially
    let previousResult = '';
    for (const task of tasks) {
      // Update task status to running
      await client.query('UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2', ['running', task.id]);

      let result = '';

      // Try to use OpenRouter API if key is available
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (apiKey) {
        try {
          const executionResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: agent.model,
              messages: [
                {
                  role: 'user',
                  content: `Goal: ${agent.goal}\n\nCurrent Task: ${task.title}\n\n${previousResult ? `Previous Results:\n${previousResult}\n\n` : ''}Please complete this task with detailed, actionable output.`
                }
              ],
              temperature: 0.7,
              max_tokens: 1000,
            })
          });

          const executionData = await executionResponse.json();
          if (executionData.choices && executionData.choices[0]) {
            result = executionData.choices[0].message.content;
          } else {
            result = `Task completed: ${task.title}`;
          }
        } catch (apiError) {
          console.error('OpenRouter API error:', apiError);
          result = `Task completed: ${task.title}`;
        }
      } else {
        // Mock execution for demonstration
        result = `Task completed: ${task.title}\n\nThis is a demonstration result. To enable real AI execution, please set the OPENROUTER_API_KEY environment variable.`;
      }

      // Update task with result
      await client.query(
        'UPDATE tasks SET status = $1, result = $2, updated_at = NOW() WHERE id = $3',
        ['completed', result, task.id]
      );

      previousResult = result;

      // Add a small delay between tasks for better UX
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Update agent status to completed
    await client.query('UPDATE agents SET status = $1, updated_at = NOW() WHERE id = $2', ['completed', agentId]);
  } catch (error) {
    console.error('Error executing agent:', error);
    await client.query('UPDATE agents SET status = $1, updated_at = NOW() WHERE id = $2', ['failed', agentId]);
  } finally {
    client.release();
  }
}

export async function POST(request: NextRequest) {
  try {
    const { agentId } = await request.json();

    const client = await pool.connect();
    try {
      // Get agent
      const agentResult = await client.query('SELECT * FROM agents WHERE id = $1', [agentId]);
      const agent = agentResult.rows[0];

      if (!agent) {
        return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
      }

      // Update agent status to running
      await client.query('UPDATE agents SET status = $1, updated_at = NOW() WHERE id = $2', ['running', agentId]);

      // Start background execution (don't await)
      executeTasksInBackground(agentId).catch(err => console.error('Background execution error:', err));

      return NextResponse.json({ success: true, message: 'Agent execution started' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error starting agent execution:', error);
    return NextResponse.json({ error: 'Failed to start agent execution' }, { status: 500 });
  }
}
