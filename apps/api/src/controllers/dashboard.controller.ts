import { Request, Response } from 'express';
import { query } from '../db/pool';
import { sendSuccess } from '../lib/response';
import { DashboardStats } from '@taskflow/types';

export const getDashboard = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.sub;
  const isAdmin = req.user!.role === 'admin';

  // All queries run in parallel for max performance
  const [
    projectStats,
    tasksByStatus,
    tasksByPriority,
    overdueCount,
    myTasksCount,
    recentTasks,
    overdueTasks,
    weeklyVelocity,
  ] = await Promise.all([
    // Total projects accessible
    query<{ total_projects: string; total_tasks: string }>(
      isAdmin
        ? `SELECT COUNT(DISTINCT p.id)::text as total_projects, COUNT(t.id)::text as total_tasks
           FROM projects p LEFT JOIN tasks t ON t.project_id = p.id`
        : `SELECT COUNT(DISTINCT p.id)::text as total_projects, COUNT(t.id)::text as total_tasks
           FROM projects p
           JOIN project_memberships pm ON pm.project_id = p.id AND pm.user_id = $1
           LEFT JOIN tasks t ON t.project_id = p.id`,
      isAdmin ? [] : [userId]
    ),

    // Tasks by status
    query<{ status: string; count: string }>(
      isAdmin
        ? `SELECT status, COUNT(*)::text as count FROM tasks GROUP BY status`
        : `SELECT t.status, COUNT(*)::text as count FROM tasks t
           JOIN project_memberships pm ON pm.project_id = t.project_id AND pm.user_id = $1
           GROUP BY t.status`,
      isAdmin ? [] : [userId]
    ),

    // Tasks by priority
    query<{ priority: string; count: string }>(
      isAdmin
        ? `SELECT priority, COUNT(*)::text as count FROM tasks GROUP BY priority`
        : `SELECT t.priority, COUNT(*)::text as count FROM tasks t
           JOIN project_memberships pm ON pm.project_id = t.project_id AND pm.user_id = $1
           GROUP BY t.priority`,
      isAdmin ? [] : [userId]
    ),

    // Overdue count (partial index covers this)
    query<{ count: string }>(
      isAdmin
        ? `SELECT COUNT(*)::text as count FROM tasks WHERE due_date < NOW() AND status != 'done'`
        : `SELECT COUNT(t.*)::text as count FROM tasks t
           JOIN project_memberships pm ON pm.project_id = t.project_id AND pm.user_id = $1
           WHERE t.due_date < NOW() AND t.status != 'done'`,
      isAdmin ? [] : [userId]
    ),

    // My assigned tasks
    query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM tasks WHERE assigned_to = $1 AND status != 'done'`,
      [userId]
    ),

    // Recent 5 tasks
    query(
      isAdmin
        ? `SELECT t.id, t.title, t.status, t.priority, t.due_date, t.project_id,
                  p.name as project_name, t.created_at,
                  (t.due_date IS NOT NULL AND t.due_date < NOW() AND t.status != 'done') as is_overdue
           FROM tasks t JOIN projects p ON p.id = t.project_id
           ORDER BY t.created_at DESC LIMIT 5`
        : `SELECT t.id, t.title, t.status, t.priority, t.due_date, t.project_id,
                  p.name as project_name, t.created_at,
                  (t.due_date IS NOT NULL AND t.due_date < NOW() AND t.status != 'done') as is_overdue
           FROM tasks t
           JOIN projects p ON p.id = t.project_id
           JOIN project_memberships pm ON pm.project_id = t.project_id AND pm.user_id = $1
           ORDER BY t.created_at DESC LIMIT 5`,
      isAdmin ? [] : [userId]
    ),

    // Overdue tasks
    query(
      isAdmin
        ? `SELECT t.id, t.title, t.status, t.priority, t.due_date, t.project_id,
                  p.name as project_name, u.username as assignee_username
           FROM tasks t JOIN projects p ON p.id = t.project_id
           LEFT JOIN users u ON u.id = t.assigned_to
           WHERE t.due_date < NOW() AND t.status != 'done'
           ORDER BY t.due_date ASC LIMIT 10`
        : `SELECT t.id, t.title, t.status, t.priority, t.due_date, t.project_id,
                  p.name as project_name, u.username as assignee_username
           FROM tasks t
           JOIN projects p ON p.id = t.project_id
           JOIN project_memberships pm ON pm.project_id = t.project_id AND pm.user_id = $1
           LEFT JOIN users u ON u.id = t.assigned_to
           WHERE t.due_date < NOW() AND t.status != 'done'
           ORDER BY t.due_date ASC LIMIT 10`,
      isAdmin ? [] : [userId]
    ),

    // Weekly velocity (last 8 weeks)
    query<{ week: string; completed: string; assigned: string }>(
      isAdmin
        ? `SELECT
             TO_CHAR(DATE_TRUNC('week', created_at), 'Mon DD') as week,
             COUNT(CASE WHEN status = 'done' THEN 1 END)::text as completed,
             COUNT(*)::text as assigned
           FROM tasks
           WHERE created_at > NOW() - INTERVAL '8 weeks'
           GROUP BY DATE_TRUNC('week', created_at)
           ORDER BY DATE_TRUNC('week', created_at)`
        : `SELECT
             TO_CHAR(DATE_TRUNC('week', t.created_at), 'Mon DD') as week,
             COUNT(CASE WHEN t.status = 'done' THEN 1 END)::text as completed,
             COUNT(*)::text as assigned
           FROM tasks t
           JOIN project_memberships pm ON pm.project_id = t.project_id AND pm.user_id = $1
           WHERE t.created_at > NOW() - INTERVAL '8 weeks'
           GROUP BY DATE_TRUNC('week', t.created_at)
           ORDER BY DATE_TRUNC('week', t.created_at)`,
      isAdmin ? [] : [userId]
    ),
  ]);

  const stats = projectStats.rows[0] ?? { total_projects: '0', total_tasks: '0' };
  const totalTasks = parseInt(stats.total_tasks);
  const doneCount = parseInt(
    tasksByStatus.rows.find((r) => r.status === 'done')?.count ?? '0'
  );

  const dashboard: DashboardStats = {
    total_projects: parseInt(stats.total_projects),
    total_tasks: totalTasks,
    tasks_by_status: tasksByStatus.rows.map((r) => ({
      status: r.status as any,
      count: parseInt(r.count),
    })),
    tasks_by_priority: tasksByPriority.rows.map((r) => ({
      priority: r.priority as any,
      count: parseInt(r.count),
    })),
    overdue_tasks: parseInt(overdueCount.rows[0]?.count ?? '0'),
    my_tasks: parseInt(myTasksCount.rows[0]?.count ?? '0'),
    recent_tasks: recentTasks.rows as any,
    overdue_task_list: overdueTasks.rows as any,
    completion_rate: totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0,
    weekly_velocity: weeklyVelocity.rows.map((r) => ({
      week: r.week,
      completed: parseInt(r.completed),
      assigned: parseInt(r.assigned),
    })),
  };

  sendSuccess(res, dashboard);
};
