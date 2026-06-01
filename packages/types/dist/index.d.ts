export interface User {
    id: string;
    username: string;
    email: string;
    global_role: 'admin' | 'member';
    created_at: string;
    updated_at: string;
}
export interface AuthResponse {
    user: User;
    access_token: string;
}
export interface JWTPayload {
    sub: string;
    email: string;
    role: 'admin' | 'member';
    iat: number;
    exp: number;
}
export interface Project {
    id: string;
    name: string;
    description: string | null;
    created_by: string;
    creator?: Pick<User, 'id' | 'username' | 'email'>;
    member_count?: number;
    task_count?: number;
    created_at: string;
    updated_at: string;
}
export interface ProjectMember {
    user_id: string;
    project_id: string;
    role: 'admin' | 'member';
    user: Pick<User, 'id' | 'username' | 'email'>;
    joined_at: string;
}
export interface ProjectWithRole extends Project {
    user_role: 'admin' | 'member';
}
export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';
export interface Task {
    id: string;
    title: string;
    description: string | null;
    status: TaskStatus;
    priority: TaskPriority;
    due_date: string | null;
    project_id: string;
    created_by: string;
    assigned_to: string | null;
    assignee?: Pick<User, 'id' | 'username' | 'email'> | null;
    creator?: Pick<User, 'id' | 'username' | 'email'>;
    project?: Pick<Project, 'id' | 'name'>;
    is_overdue?: boolean;
    created_at: string;
    updated_at: string;
}
export interface DashboardStats {
    total_projects: number;
    total_tasks: number;
    tasks_by_status: {
        status: TaskStatus;
        count: number;
    }[];
    tasks_by_priority: {
        priority: TaskPriority;
        count: number;
    }[];
    overdue_tasks: number;
    my_tasks: number;
    recent_tasks: Task[];
    overdue_task_list: Task[];
    completion_rate: number;
    weekly_velocity: {
        week: string;
        completed: number;
        assigned: number;
    }[];
}
export interface ApiSuccess<T> {
    success: true;
    data: T;
    message?: string;
}
export interface ApiError {
    success: false;
    error: string;
    details?: Record<string, string[]>;
}
export type ApiResponse<T> = ApiSuccess<T> | ApiError;
export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
}
