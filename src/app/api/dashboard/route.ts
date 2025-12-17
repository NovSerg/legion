import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'review' | 'done' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignee: string | null;
  dueDate: string | null;
  tags: string[];
  estimate: number | null;
  timeSpent: number;
}

interface Ticket {
  id: string;
  userId: string;
  subject: string;
  description: string;
  status: 'open' | 'in-progress' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  createdAt: string;
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  capacity: number;
}

function loadTaskData() {
  try {
    const filePath = path.join(process.cwd(), 'mcp-servers', 'task-data.json');
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as { tasks: Task[]; team: TeamMember[] };
  } catch {
    return { tasks: [], team: [] };
  }
}

function loadSupportData() {
  try {
    const filePath = path.join(process.cwd(), 'mcp-servers', 'support-data.json');
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as { users: any[]; tickets: Ticket[] };
  } catch {
    return { users: [], tickets: [] };
  }
}

export async function GET() {
  const taskData = loadTaskData();
  const supportData = loadSupportData();

  // Task statistics
  const byStatus = {
    todo: 0,
    'in-progress': 0,
    review: 0,
    done: 0,
    blocked: 0,
  };
  const byPriority = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  let overdue = 0;
  const now = new Date();

  taskData.tasks.forEach((task) => {
    byStatus[task.status] = (byStatus[task.status] || 0) + 1;
    byPriority[task.priority] = (byPriority[task.priority] || 0) + 1;

    if (task.dueDate && new Date(task.dueDate) < now && task.status !== 'done') {
      overdue++;
    }
  });

  // Critical/urgent tasks
  const urgentTasks = taskData.tasks
    .filter(
      (t) =>
        t.status !== 'done' &&
        (t.priority === 'critical' ||
          (t.dueDate && new Date(t.dueDate) < now))
    )
    .slice(0, 5);

  // Ticket statistics
  const openTickets = supportData.tickets.filter((t) => t.status === 'open');
  const criticalTickets = supportData.tickets.filter(
    (t) => t.status !== 'closed' && t.priority === 'critical'
  );
  const recentOpen = openTickets.slice(0, 5);

  // Team workload
  const workload = taskData.team.map((member) => {
    const memberTasks = taskData.tasks.filter(
      (t) => t.assignee === member.name && t.status !== 'done'
    );
    const assignedHours = memberTasks.reduce(
      (sum, t) => sum + ((t.estimate || 0) - (t.timeSpent || 0)),
      0
    );
    const utilization = Math.round((assignedHours / member.capacity) * 100);

    return {
      name: member.name,
      role: member.role,
      tasksCount: memberTasks.length,
      inProgress: memberTasks.filter((t) => t.status === 'in-progress').length,
      utilization: Math.min(utilization, 150),
      capacity: member.capacity,
      assignedHours,
    };
  });

  // Priority recommendations
  const recommendations = taskData.tasks
    .filter((t) => t.status === 'todo' || t.status === 'in-progress')
    .map((t) => {
      let score = 0;
      const priorityScore = { critical: 100, high: 50, medium: 20, low: 5 };
      score += priorityScore[t.priority] || 0;

      if (t.dueDate && new Date(t.dueDate) < now) score += 75;
      if (t.status === 'in-progress') score += 30;

      return { task: t, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((item) => item.task);

  return NextResponse.json({
    tasks: {
      total: taskData.tasks.length,
      byStatus,
      byPriority,
      overdue,
      urgent: urgentTasks,
    },
    tickets: {
      total: supportData.tickets.length,
      open: openTickets.length,
      critical: criticalTickets.length,
      recentOpen,
    },
    team: {
      members: taskData.team,
      workload,
    },
    recommendations,
  });
}
