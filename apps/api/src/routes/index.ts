import { Router } from 'express';
import { validate } from '../middlewares/validate';
import { authenticate } from '../middlewares/auth';
import { requireProjectMember } from '../middlewares/projectAuth';
import * as auth from '../controllers/auth.controller';
import * as projects from '../controllers/projects.controller';
import * as tasks from '../controllers/tasks.controller';
import * as dashboard from '../controllers/dashboard.controller';
import {
  SignupSchema, LoginSchema,
  CreateProjectSchema, UpdateProjectSchema, AddMemberSchema, UpdateMemberRoleSchema,
  CreateTaskSchema, UpdateTaskSchema, TaskFilterSchema,
} from '@taskflow/validators';

const router = Router();

// ── Auth ──────────────────────────────────────────────────────
router.post('/auth/signup', validate(SignupSchema), auth.signup);
router.post('/auth/login', validate(LoginSchema), auth.login);
router.post('/auth/refresh', auth.refresh);
router.post('/auth/logout', auth.logout);
router.get('/auth/me', authenticate, auth.me);

// ── Dashboard ─────────────────────────────────────────────────
router.get('/dashboard', authenticate, dashboard.getDashboard);

// ── Projects ──────────────────────────────────────────────────
router.get('/projects', authenticate, projects.listProjects);
router.post('/projects', authenticate, validate(CreateProjectSchema), projects.createProject);

router.get('/projects/:projectId', authenticate, requireProjectMember(), projects.getProject);
router.patch('/projects/:projectId', authenticate, requireProjectMember('admin'), validate(UpdateProjectSchema), projects.updateProject);
router.delete('/projects/:projectId', authenticate, requireProjectMember('admin'), projects.deleteProject);

// Project members
router.get('/projects/:projectId/members', authenticate, requireProjectMember(), projects.listMembers);
router.post('/projects/:projectId/members', authenticate, requireProjectMember('admin'), validate(AddMemberSchema), projects.addMember);
router.patch('/projects/:projectId/members/:userId', authenticate, requireProjectMember('admin'), validate(UpdateMemberRoleSchema), projects.updateMemberRole);
router.delete('/projects/:projectId/members/:userId', authenticate, requireProjectMember('admin'), projects.removeMember);

// ── Tasks ─────────────────────────────────────────────────────
router.get('/projects/:projectId/tasks', authenticate, requireProjectMember(), validate(TaskFilterSchema, 'query'), tasks.listTasks);
router.post('/projects/:projectId/tasks', authenticate, requireProjectMember('member'), validate(CreateTaskSchema), tasks.createTask);

router.get('/projects/:projectId/tasks/:taskId', authenticate, requireProjectMember(), tasks.getTask);
router.patch('/projects/:projectId/tasks/:taskId', authenticate, requireProjectMember('member'), validate(UpdateTaskSchema), tasks.updateTask);
router.delete('/projects/:projectId/tasks/:taskId', authenticate, requireProjectMember('admin'), tasks.deleteTask);

export default router;
