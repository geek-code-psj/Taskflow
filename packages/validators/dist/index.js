import { z } from 'zod';
// ── Auth Schemas ──────────────────────────────────────────────
export const SignupSchema = z.object({
    username: z
        .string()
        .min(3, 'Username must be at least 3 characters')
        .max(30, 'Username must be at most 30 characters')
        .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
    email: z.string().email('Invalid email address'),
    password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number'),
});
export const LoginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
});
// ── Project Schemas ───────────────────────────────────────────
export const CreateProjectSchema = z.object({
    name: z.string().min(2, 'Project name must be at least 2 characters').max(100),
    description: z.string().max(500, 'Description must be at most 500 characters').optional(),
});
export const UpdateProjectSchema = CreateProjectSchema.partial();
export const AddMemberSchema = z.object({
    email: z.string().email('Invalid email address'),
    role: z.enum(['admin', 'member'], { message: 'Role must be admin or member' }),
});
export const UpdateMemberRoleSchema = z.object({
    role: z.enum(['admin', 'member']),
});
// ── Task Schemas ──────────────────────────────────────────────
export const TaskStatusEnum = z.enum(['todo', 'in_progress', 'done']);
export const TaskPriorityEnum = z.enum(['low', 'medium', 'high']);
export const CreateTaskSchema = z.object({
    title: z.string().min(3, 'Title must be at least 3 characters').max(200),
    description: z.string().max(2000).optional(),
    status: TaskStatusEnum.default('todo'),
    priority: TaskPriorityEnum.default('medium'),
    due_date: z
        .string()
        .datetime({ message: 'Invalid ISO-8601 datetime' })
        .optional()
        .nullable(),
    assigned_to: z.string().uuid('Invalid user ID').optional().nullable(),
});
export const UpdateTaskSchema = CreateTaskSchema.partial();
export const UpdateTaskStatusSchema = z.object({
    status: TaskStatusEnum,
});
// ── Query / Filter Schemas ────────────────────────────────────
export const PaginationSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});
export const TaskFilterSchema = PaginationSchema.extend({
    status: TaskStatusEnum.optional(),
    priority: TaskPriorityEnum.optional(),
    assigned_to: z.string().uuid().optional(),
    overdue: z.coerce.boolean().optional(),
    search: z.string().max(100).optional(),
    sort: z.enum(['created_at', 'due_date', 'priority', 'status']).default('created_at'),
    order: z.enum(['asc', 'desc']).default('desc'),
});
