import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT a.*, 
        COUNT(t.id) as total_tasks,
        SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks
      FROM agents a
      LEFT JOIN tasks t ON a.id = t.agent_id
      GROUP BY a.id
      ORDER BY a.created_at DESC
    `);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching agents:', error);
    return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { goal, model } = await request.json();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create agent
      const agentResult = await client.query(
        'INSERT INTO agents (goal, model, status) VALUES ($1, $2, $3) RETURNING *',
        [goal, model, 'idle']
      );
      const agent = agentResult.rows[0];

      // Decompose goal into tasks using OpenRouter
      const apiKey = process.env.OPENROUTER_API_KEY;
      const decompositionResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'user',
              content: `Break down this goal into exactly 5 specific, actionable subtasks. Return ONLY a JSON array with 5 objects, each with a "title" field. Goal: "${goal}"\n\nReturn format: [{"title": "Task 1"}, {"title": "Task 2"}, ...]`
            }
          ],
          temperature: 0.7,
        })
      });

      const decompositionData = await decompositionResponse.json();
      let tasks = [];

      try {
        const content = decompositionData.choices[0].message.content;
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          tasks = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        tasks = [
          { title: 'Research and gather information' },
          { title: 'Analyze findings' },
          { title: 'Develop strategy' },
          { title: 'Create implementation plan' },
          { title: 'Generate final report' }
        ];
      }

      // Insert tasks
      for (let i = 0; i < Math.min(tasks.length, 5); i++) {
        await client.query(
          'INSERT INTO tasks (agent_id, title, status, order_index) VALUES ($1, $2, $3, $4)',
          [agent.id, tasks[i].title, 'pending', i]
        );
      }

      await client.query('COMMIT');
      return NextResponse.json(agent);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error creating agent:', error);
    return NextResponse.json({ error: 'Failed to create agent' }, { status: 500 });
  }
}
