import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const agentId = request.nextUrl.searchParams.get('agentId');
    const result = await pool.query(
      'SELECT * FROM tasks WHERE agent_id = $1 ORDER BY order_index ASC',
      [agentId]
    );
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { taskId, title } = await request.json();
    const result = await pool.query(
      'UPDATE tasks SET title = $1 WHERE id = $2 RETURNING *',
      [title, taskId]
    );
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const agentId = request.nextUrl.searchParams.get('agentId');
    await pool.query('DELETE FROM agents WHERE id = $1', [agentId]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting agent:', error);
    return NextResponse.json({ error: 'Failed to delete agent' }, { status: 500 });
  }
}
