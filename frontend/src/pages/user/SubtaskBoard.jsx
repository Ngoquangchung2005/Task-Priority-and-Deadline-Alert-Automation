import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import api from '../../services/api';
import LoadingCompass from '../../components/LoadingCompass';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, GripVertical, CheckCircle, AlertTriangle, Clock, ListTodo, Flag, User, Calendar, Lock } from 'lucide-react';

const COLUMNS = [
    { id: 'TODO', title: 'To Do', icon: <ListTodo size={16} />, color: '#64748B' },
    { id: 'IN_PROGRESS', title: 'In Progress', icon: <Clock size={16} />, color: '#3B82F6' },
    { id: 'DONE', title: 'Done', icon: <CheckCircle size={16} />, color: '#10B981' },
];package com.task.automation.service;

import com.task.automation.dto.request.TaskRequest;
import com.task.automation.dto.request.AiSubtaskSuggestionRequest;
import com.task.automation.dto.request.WebhookSyncRequest;
import com.task.automation.dto.response.WebhookWorkItemResponse;
import com.task.automation.entity.Subtask;
import com.task.automation.entity.Task;
import com.task.automation.entity.TaskLog;
import com.task.automation.entity.User;
import com.task.automation.enums.ActionType;
import com.task.automation.enums.Role;
import com.task.automation.enums.TaskPriority;
import com.task.automation.enums.TaskStatus;
import com.task.automation.repository.TaskLogRepository;
import com.task.automation.repository.TaskRepository;
import com.task.automation.repository.SubtaskRepository;
import com.task.automation.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.time.temporal.TemporalAdjusters;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.Objects;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.HashSet;
import java.util.Set;
import java.util.LinkedHashSet;
import org.springframework.beans.factory.annotation.Value;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class TaskService {

    private static final RestClient REST_CLIENT = buildRestClient();

    private final TaskRepository taskRepository;
    private final SubtaskRepository subtaskRepository;
    private final UserRepository userRepository;
    private final TaskLogRepository taskLogRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${n8n.webhook.url:}")
    private String n8nWebhookUrl;

    @Value("${n8n.ai.webhook.url:}")
    private String n8nAiWebhookUrl;

    @Value("${openrouter.api.key:${OPENROUTER_API_KEY:}}")
    private String openRouterApiKey;

    @Value("${openrouter.model:nvidia/nemotron-3-super-120b-a12b:free}")
    private String openRouterModel;

    private static RestClient buildRestClient() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(3));
        factory.setReadTimeout(Duration.ofSeconds(3));
        return RestClient.builder().requestFactory(factory).build();
    }

    public java.util.Optional<Task> getTaskById(Long id) {
        return taskRepository.findById(id);
    }

    public java.util.Optional<Task> getTaskForActor(Long id, String actorEmail, boolean isManager) {
        return isManager ? getTaskForManager(id, actorEmail) : getTaskForUser(id, actorEmail);
    }

    public java.util.Optional<Task> getTaskForUser(Long id, String userEmail) {
        java.util.Optional<Task> parentTask = taskRepository.findByIdAndAssigneeIdentity(
                id, userEmail, identityLocalPart(userEmail));
        if (parentTask.isPresent()) {
            return parentTask;
        }

        boolean ownsSubtask = !subtaskRepository
                .findByTaskIdAndAssignedIdentityOrderByPositionIndexAsc(
                        id, userEmail, identityLocalPart(userEmail))
                .isEmpty();
        return ownsSubtask ? taskRepository.findById(id) : java.util.Optional.empty();
    }

    public java.util.Optional<Task> getTaskForManager(Long id, String managerEmail) {
        return taskRepository.findByIdAndManagerEmail(id, managerEmail);
    }

    @Transactional
    public Task createTask(TaskRequest request, String managerEmail, String managerName) {
        if (request.getPriority() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "priority is required");
        }

        String assigneeEmail = requireEmail(request.getAssigneeEmail(), "assigneeEmail");
        ensureUserExists(assigneeEmail);

        Task task = new Task();
        task.setTaskId("TSK-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        task.setTaskName(requireText(request.getTaskName(), "taskName"));
        task.setTaskDescription(request.getTaskDescription());
        task.setAssigneeEmail(assigneeEmail);
        task.setManagerEmail(managerEmail);
        task.setOwnerName(managerName);
        task.setPriority(request.getPriority());
        task.setStatus(TaskStatus.PENDING);
        task.setArchived(false);
        task.setArchivedAt(null);
        task.setReminderCount(0);

        // Auto-calculate deadline based on priority if not provided
        if (request.getDeadline() != null) {
            task.setDeadline(request.getDeadline());
        } else {
            int days = switch (request.getPriority()) {
                case HIGH -> 7;
                case MEDIUM -> 14;
                case LOW -> 30;
            };
            task.setDeadline(LocalDateTime.now().plusDays(days));
        }

        task.setCreatedBy(managerEmail);
        task.setAdminNote(request.getAdminNote());
        task.setSourceInput(request.getSourceInput());

        List<Subtask> subtasks = buildSubtasksForTask(request, task, managerEmail);
        task.getSubtasks().clear();
        task.getSubtasks().addAll(subtasks);
        task.setTotalSubTask(subtasks.size());

        Task savedTask = taskRepository.save(task);
        logTaskAction(savedTask.getId(), ActionType.CREATED, "Task created by " + managerEmail);
        triggerN8nWebhook(savedTask, "TASK_CREATED", "New task created by " + managerEmail);

        return savedTask;
    }

    private List<Subtask> buildSubtasksForTask(TaskRequest request, Task task, String managerEmail) {
        if (request.getSubtasks() != null && !request.getSubtasks().isEmpty()) {
            List<Subtask> subtasks = new ArrayList<>();
            for (int i = 0; i < request.getSubtasks().size(); i++) {
                var subtaskRequest = request.getSubtasks().get(i);
                if (subtaskRequest == null) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "subtasks[" + i + "] is required");
                }

                TaskStatus status = subtaskRequest.getStatus() != null ? subtaskRequest.getStatus() : TaskStatus.TODO;
                if (status == TaskStatus.CANCELLED) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "subtasks[" + i + "].status cannot be CANCELLED");
                }

                String assignedTo = requireEmail(subtaskRequest.getAssignedTo(), "subtasks[" + i + "].assignedTo");
                ensureUserExists(assignedTo);

                Subtask subtask = new Subtask();
                subtask.setTitle(requireText(subtaskRequest.getTitle(), "subtasks[" + i + "].title"));
                subtask.setStatus(status);
                subtask.setPriority(normalizeSubtaskPriority(
                        subtaskRequest.getPriority(),
                        task.getPriority(),
                        "subtasks[" + i + "].priority"));
                subtask.setDeadline(subtaskRequest.getDeadline());
                subtask.setAssignedTo(assignedTo);
                subtask.setCreatedBy(managerEmail);
                subtask.setPositionIndex(
                        subtaskRequest.getPositionIndex() != null ? subtaskRequest.getPositionIndex() : i);
                subtask.setTask(task);
                subtasks.add(subtask);
            }
            return subtasks;
        }

        if (request.getSubtaskTitles() == null || request.getSubtaskTitles().isEmpty()) {
            return List.of();
        }

        List<Subtask> subtasks = new ArrayList<>();
        for (int i = 0; i < request.getSubtaskTitles().size(); i++) {
            String title = request.getSubtaskTitles().get(i);
            if (title == null || title.trim().isEmpty()) {
                continue;
            }

            Subtask subtask = new Subtask();
            subtask.setTitle(title.trim());
            subtask.setStatus(TaskStatus.TODO);
            subtask.setPriority(task.getPriority());
            subtask.setDeadline(task.getDeadline());
            subtask.setAssignedTo(task.getAssigneeEmail());
            subtask.setCreatedBy(managerEmail);
            subtask.setPositionIndex(subtasks.size());
            subtask.setTask(task);
            subtasks.add(subtask);
        }
        return subtasks;
    }

    @Transactional
    public Task updateTask(Long id, TaskRequest request, String managerEmail) {
        Task task = taskRepository.findByIdAndManagerEmail(id, managerEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));
        if (task.getStatus() == TaskStatus.DONE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Completed tasks cannot be edited");
        }
        if (task.getStatus() == TaskStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cancelled tasks cannot be edited");
        }
        if (Boolean.TRUE.equals(task.getArchived())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Archived tasks cannot be edited");
        }

        if (task.getStatus() == TaskStatus.IN_PROGRESS && hasStartedSubtaskWork(task.getId())) {
            boolean assigneeChanged = !Objects.equals(task.getAssigneeEmail(), request.getAssigneeEmail());
            boolean nameChanged = !Objects.equals(task.getTaskName(), request.getTaskName());
            boolean descriptionChanged = !Objects.equals(task.getTaskDescription(), request.getTaskDescription());
            if (assigneeChanged || nameChanged || descriptionChanged) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Tasks with started subtasks only allow updating deadline, priority, and admin note");
            }
        }

        String beforeAssignee = task.getAssigneeEmail();
        LocalDateTime beforeDeadline = task.getDeadline();
        String beforePriority = task.getPriority() != null ? task.getPriority().name() : null;
        String beforeNote = task.getAdminNote();
        String beforeDescription = task.getTaskDescription();
        String beforeName = task.getTaskName();

        ensureExistingSubtasksFitParentPriority(task.getId(), request.getPriority());

        task.setTaskName(request.getTaskName());
        task.setTaskDescription(request.getTaskDescription());
        task.setAssigneeEmail(request.getAssigneeEmail());
        task.setPriority(request.getPriority());
        if (request.getDeadline() != null) {
            task.setDeadline(request.getDeadline());
        }
        task.setAdminNote(request.getAdminNote());
        Task savedTask = taskRepository.save(task);

        List<String> changes = new ArrayList<>();
        if (!Objects.equals(beforeName, savedTask.getTaskName())) {
            changes.add(String.format("Task name changed from '%s' to '%s'", safe(beforeName),
                    safe(savedTask.getTaskName())));
        }
        if (!Objects.equals(beforeDescription, savedTask.getTaskDescription())) {
            changes.add("Task description updated");
        }
        if (!Objects.equals(beforePriority, savedTask.getPriority() != null ? savedTask.getPriority().name() : null)) {
            changes.add(String.format("Priority changed from '%s' to '%s'", safe(beforePriority),
                    savedTask.getPriority() != null ? savedTask.getPriority().name() : "null"));
        }
        if (!Objects.equals(beforeNote, savedTask.getAdminNote())) {
            changes.add("Admin note updated");
        }
        if (!Objects.equals(beforeDeadline, savedTask.getDeadline())) {
            changes.add(String.format("Deadline changed from '%s' to '%s'",
                    formatDateTime(beforeDeadline), formatDateTime(savedTask.getDeadline())));
            logTaskAction(savedTask.getId(), ActionType.DEADLINE_CHANGED,
                    String.format("Deadline changed from %s to %s by %s",
                            formatDateTime(beforeDeadline), formatDateTime(savedTask.getDeadline()), managerEmail));
        }
        if (!Objects.equals(beforeAssignee, savedTask.getAssigneeEmail())) {
            changes.add(String.format("Assignee changed from '%s' to '%s'", safe(beforeAssignee),
                    safe(savedTask.getAssigneeEmail())));
            logTaskAction(savedTask.getId(), ActionType.REASSIGNED,
                    String.format("Task reassigned from %s to %s by %s",
                            safe(beforeAssignee), safe(savedTask.getAssigneeEmail()), managerEmail));
        }

        if (!changes.isEmpty()) {
            logTaskAction(savedTask.getId(), ActionType.UPDATED,
                    "Task updated by " + managerEmail + ": " + String.join("; ", changes));
            triggerN8nWebhook(savedTask, "TASK_UPDATED",
                    "Task updated by " + managerEmail + ": " + String.join("; ", changes));
        }
        return savedTask;
    }

    @Transactional
    public Task cancelTask(Long id, String managerEmail) {
        Task task = taskRepository.findByIdAndManagerEmail(id, managerEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));
        if (task.getStatus() == TaskStatus.DONE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Completed tasks cannot be cancelled");
        }
        if (task.getStatus() == TaskStatus.CANCELLED) {
            return task;
        }
        if (Boolean.TRUE.equals(task.getArchived())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Archived tasks cannot be cancelled");
        }
        if (task.getStatus() != TaskStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only pending tasks can be cancelled");
        }

        task.setStatus(TaskStatus.CANCELLED);
        task.setCompletedAt(null);
        Task savedTask = taskRepository.save(task);
        logTaskAction(savedTask.getId(), ActionType.CANCELLED, "Task cancelled by " + managerEmail);
        triggerN8nWebhook(savedTask, "TASK_CANCELLED", "Task cancelled by " + managerEmail);
        return savedTask;
    }

    @Transactional
    public Task archiveTask(Long id, String managerEmail) {
        Task task = taskRepository.findByIdAndManagerEmail(id, managerEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));
        if (task.getStatus() != TaskStatus.DONE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only completed tasks can be archived");
        }
        if (Boolean.TRUE.equals(task.getArchived())) {
            return task;
        }

        task.setArchived(true);
        task.setArchivedAt(LocalDateTime.now());
        Task savedTask = taskRepository.save(task);
        logTaskAction(savedTask.getId(), ActionType.ARCHIVED, "Task archived by " + managerEmail);
        return savedTask;
    }

    @Transactional
    public Task unarchiveTask(Long id, String managerEmail) {
        Task task = taskRepository.findByIdAndManagerEmail(id, managerEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));
        if (!Boolean.TRUE.equals(task.getArchived())) {
            return task;
        }

        task.setArchived(false);
        task.setArchivedAt(null);
        Task savedTask = taskRepository.save(task);
        logTaskAction(savedTask.getId(), ActionType.UNARCHIVED, "Task unarchived by " + managerEmail);
        return savedTask;
    }

    @Transactional
    public void permanentlyDeleteStoredTask(Long id, String managerEmail) {
        Task task = taskRepository.findByIdAndManagerEmail(id, managerEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));

        boolean canDelete = task.getStatus() == TaskStatus.CANCELLED || Boolean.TRUE.equals(task.getArchived());
        if (!canDelete) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Only cancelled or archived tasks can be permanently deleted");
        }

        taskLogRepository.deleteByTaskId(task.getId());
        taskRepository.delete(task);
    }

    public List<Task> getAllTasksForManager(String managerEmail) {
        return syncOverdueStatuses(taskRepository.findByManagerEmailOrderByCreatedAtDesc(managerEmail));
    }

    public List<Task> getTasksForUser(String userEmail) {
        return syncOverdueStatuses(taskRepository.findByAssigneeIdentityOrderByCreatedAtDesc(
                userEmail, identityLocalPart(userEmail)));
    }

    @Transactional
    public Task updateTaskStatusForUser(Long id, TaskStatus newStatus, String userEmail) {
        Task task = taskRepository.findByIdAndAssigneeIdentity(id, userEmail, identityLocalPart(userEmail))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));
        TaskStatus allowedStatus = normalizeUserParentStatus(task, newStatus);
        return updateTaskStatus(task, allowedStatus, userEmail);
    }

    @Transactional
    public Task updateTaskStatusForManager(Long id, TaskStatus newStatus, String managerEmail) {
        Task task = taskRepository.findByIdAndManagerEmail(id, managerEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));
        return updateTaskStatus(task, newStatus, managerEmail);
    }

    private Task updateTaskStatus(Task task, TaskStatus newStatus, String actorEmail) {
        if (newStatus == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "status is required");
        }
        if (task.getStatus() == TaskStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cancelled tasks cannot change status");
        }
        if (Boolean.TRUE.equals(task.getArchived())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Archived tasks cannot change status");
        }

        TaskStatus previousStatus = task.getStatus();
        if (previousStatus == newStatus) {
            return task;
        }

        if (newStatus == TaskStatus.IN_REVIEW && hasIncompleteSubtasks(task.getId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Parent task can only enter IN_REVIEW when all subtasks are DONE");
        }
        if (newStatus == TaskStatus.DONE) {
            if (previousStatus != TaskStatus.IN_REVIEW) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Parent task must be IN_REVIEW before it can be approved as DONE");
            }
            if (hasIncompleteSubtasks(task.getId())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Parent task can only be DONE when all subtasks are DONE");
            }
        }

        task.setStatus(newStatus);
        if (newStatus == TaskStatus.DONE) {
            task.setCompletedAt(LocalDateTime.now());
        } else {
            task.setCompletedAt(null);
        }
        Task savedTask = taskRepository.save(task);
        logTaskAction(savedTask.getId(), ActionType.STATUS_CHANGED,
                "Status changed to " + newStatus + " by " + actorEmail);
        if (newStatus == TaskStatus.DONE && previousStatus != TaskStatus.DONE) {
            logTaskAction(savedTask.getId(), ActionType.COMPLETED,
                    "Task completed by " + actorEmail);
        }

        triggerN8nWebhook(savedTask, "TASK_STATUS_CHANGED",
                "Status changed to " + newStatus + " by " + actorEmail);

        return savedTask;
    }

    private boolean hasIncompleteSubtasks(Long taskId) {
        List<Subtask> subtasks = subtaskRepository.findByTaskIdOrderByPositionIndexAsc(taskId);
        return !subtasks.isEmpty()
                && subtasks.stream().anyMatch(subtask -> subtask.getStatus() != TaskStatus.DONE);
    }

    private boolean hasStartedSubtaskWork(Long taskId) {
        List<Subtask> subtasks = subtaskRepository.findByTaskIdOrderByPositionIndexAsc(taskId);
        if (subtasks.isEmpty()) {
            return true;
        }
        return subtasks.stream()
                .anyMatch(
                        subtask -> subtask.getStatus() != TaskStatus.TODO && subtask.getStatus() != TaskStatus.PENDING);
    }

    private boolean hasSubtasks(Long taskId) {
        return !subtaskRepository.findByTaskIdOrderByPositionIndexAsc(taskId).isEmpty();
    }

    private TaskStatus normalizeUserParentStatus(Task task, TaskStatus newStatus) {
        if (newStatus == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "status is required");
        }
        if (newStatus == TaskStatus.DONE) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Only the manager can approve a parent task as DONE");
        }
        if (hasSubtasks(task.getId()) && newStatus != TaskStatus.IN_PROGRESS) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Use the subtask board to update assigned subtasks");
        }
        if (newStatus != TaskStatus.IN_PROGRESS && newStatus != TaskStatus.IN_REVIEW) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Users can only start a task or submit it for review");
        }
        return newStatus;
    }

    @Transactional
    public void handleWebhookSync(WebhookSyncRequest request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Webhook sync payload is required");
        }
        if (request.getTaskId() == null || request.getTaskId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "taskId is required");
        }
        if (request.getActionType() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "actionType is required");
        }

        String itemType = request.getItemType() == null || request.getItemType().isBlank()
                ? "TASK"
                : request.getItemType().trim().toUpperCase();
        boolean subtaskSync = "SUBTASK".equals(itemType) || request.getSubtaskId() != null;
        Subtask subtask = null;
        Task task;

        if (subtaskSync && request.getSubtaskId() != null) {
            subtask = subtaskRepository.findById(request.getSubtaskId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                            "Subtask not found: " + request.getSubtaskId()));
            task = subtask.getTask();
            if (task == null) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Subtask has no parent task: " + request.getSubtaskId());
            }
            if (!request.getTaskId().equals(task.getTaskId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "subtaskId does not belong to taskId " + request.getTaskId());
            }
        } else {
            task = taskRepository.findByTaskId(request.getTaskId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                            "Task not found: " + request.getTaskId()));
        }

        if (request.getActionType() == ActionType.REMINDER_SENT) {
            task.setLastRemindedAt(LocalDateTime.now());
            task.setReminderCount((task.getReminderCount() == null ? 0 : task.getReminderCount()) + 1);
        } else if (request.getActionType() == ActionType.ESCALATED) {
            task.setEscalatedAt(LocalDateTime.now());
        }

        taskRepository.save(task);
        logTaskAction(task.getId(), request.getActionType(), buildWebhookSyncLogMessage(request, subtask));
    }

    private String buildWebhookSyncLogMessage(WebhookSyncRequest request, Subtask subtask) {
        if (request.getActionMessage() != null && !request.getActionMessage().isBlank()) {
            return request.getActionMessage().trim();
        }

        String actionLabel = request.getActionType() == ActionType.ESCALATED ? "Escalation" : "Reminder";
        if (subtask == null) {
            return actionLabel + " sent by n8n for task " + request.getTaskId();
        }

        String assignee = subtask.getAssignedTo() != null && !subtask.getAssignedTo().isBlank()
                ? " assigned to " + subtask.getAssignedTo()
                : "";
        return actionLabel + " sent by n8n for subtask #" + subtask.getId()
                + " '" + subtask.getTitle() + "'" + assignee
                + " under task " + request.getTaskId();
    }

    public List<Task> getOverdueTasks() {
        return syncOverdueStatuses(
                taskRepository.findOverdueTasks(
                        List.of(TaskStatus.PENDING, TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW, TaskStatus.OVERDUE)));
    }

    public List<WebhookWorkItemResponse> getPendingReminderItems() {
        List<TaskStatus> openTaskStatuses = List.of(
                TaskStatus.PENDING,
                TaskStatus.TODO,
                TaskStatus.IN_PROGRESS,
                TaskStatus.IN_REVIEW,
                TaskStatus.OVERDUE);
        List<TaskStatus> openSubtaskStatuses = List.of(
                TaskStatus.PENDING,
                TaskStatus.TODO,
                TaskStatus.IN_PROGRESS,
                TaskStatus.IN_REVIEW,
                TaskStatus.OVERDUE);

        List<Task> tasks = syncOverdueStatuses(taskRepository.findTasksByStatuses(openTaskStatuses));
        List<Subtask> subtasks = syncOverdueSubtaskStatuses(
                subtaskRepository.findWebhookSubtasksByStatuses(openSubtaskStatuses, TaskStatus.CANCELLED));

        return buildWebhookWorkItems(tasks, subtasks, true);
    }

    public List<WebhookWorkItemResponse> getOverdueEscalationItems() {
        List<TaskStatus> openSubtaskStatuses = List.of(
                TaskStatus.PENDING,
                TaskStatus.TODO,
                TaskStatus.IN_PROGRESS,
                TaskStatus.IN_REVIEW,
                TaskStatus.OVERDUE);

        List<Task> tasks = getOverdueTasks();
        List<Subtask> subtasks = syncOverdueSubtaskStatuses(
                subtaskRepository.findOverdueWebhookSubtasks(openSubtaskStatuses, TaskStatus.CANCELLED));

        return buildWebhookWorkItems(tasks, subtasks, true);
    }

    public List<WebhookWorkItemResponse> getEmployeeStatisticItems() {
        LocalDateTime startOfWeek = LocalDate.now()
                .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
                .atStartOfDay();

        List<Task> parentTasksWithoutSubtasks = syncOverdueStatuses(
                taskRepository.findTasksForEmployeeStatistics(
                        List.of(TaskStatus.PENDING, TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW,
                                TaskStatus.OVERDUE),
                        TaskStatus.DONE,
                        startOfWeek))
                .stream()
                .filter(task -> task.getTotalSubTask() == null || task.getTotalSubTask() == 0)
                .toList();

        List<Subtask> subtasks = syncOverdueSubtaskStatuses(
                subtaskRepository.findWebhookSubtasksForEmployeeStatistics(
                        List.of(TaskStatus.PENDING, TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW,
                                TaskStatus.OVERDUE),
                        TaskStatus.DONE,
                        TaskStatus.CANCELLED,
                        startOfWeek));

        return buildWebhookWorkItems(parentTasksWithoutSubtasks, subtasks, false);
    }

    @Transactional
    protected List<Task> syncOverdueStatuses(List<Task> tasks) {
        if (tasks == null || tasks.isEmpty()) {
            return tasks;
        }

        LocalDateTime now = LocalDateTime.now();
        List<Task> changedTasks = new ArrayList<>();

        for (Task task : tasks) {
            if (task == null) {
                continue;
            }
            if (Boolean.TRUE.equals(task.getArchived())) {
                continue;
            }
            if (task.getDeadline() == null) {
                continue;
            }
            if (task.getStatus() == TaskStatus.DONE || task.getStatus() == TaskStatus.CANCELLED) {
                continue;
            }
            if (task.getDeadline().isAfter(now)) {
                continue;
            }
            if (task.getStatus() == TaskStatus.OVERDUE) {
                continue;
            }

            task.setStatus(TaskStatus.OVERDUE);
            changedTasks.add(task);
        }

        if (!changedTasks.isEmpty()) {
            taskRepository.saveAll(changedTasks);
        }

        return tasks;
    }

    @Transactional
    protected List<Subtask> syncOverdueSubtaskStatuses(List<Subtask> subtasks) {
        if (subtasks == null || subtasks.isEmpty()) {
            return subtasks;
        }

        LocalDateTime now = LocalDateTime.now();
        List<Subtask> changedSubtasks = new ArrayList<>();
        Map<Long, Task> changedParents = new LinkedHashMap<>();

        for (Subtask subtask : subtasks) {
            if (subtask == null || subtask.getDeadline() == null) {
                continue;
            }
            if (subtask.getStatus() == TaskStatus.DONE || subtask.getStatus() == TaskStatus.OVERDUE) {
                continue;
            }
            if (subtask.getDeadline().isAfter(now)) {
                continue;
            }

            subtask.setStatus(TaskStatus.OVERDUE);
            changedSubtasks.add(subtask);

            Task parent = subtask.getTask();
            if (parent == null || parent.getId() == null) {
                continue;
            }
            if (parent.getStatus() == TaskStatus.DONE || parent.getStatus() == TaskStatus.CANCELLED
                    || parent.getStatus() == TaskStatus.OVERDUE || Boolean.TRUE.equals(parent.getArchived())) {
                continue;
            }
            parent.setStatus(TaskStatus.OVERDUE);
            parent.setCompletedAt(null);
            changedParents.put(parent.getId(), parent);
        }

        if (!changedSubtasks.isEmpty()) {
            subtaskRepository.saveAll(changedSubtasks);
        }
        if (!changedParents.isEmpty()) {
            taskRepository.saveAll(changedParents.values());
        }

        return subtasks;
    }

    private List<WebhookWorkItemResponse> buildWebhookWorkItems(
            List<Task> tasks,
            List<Subtask> subtasks,
            boolean includeParentTasksWithSubtasks) {
        List<WebhookWorkItemResponse> items = new ArrayList<>();
        Set<Long> parentIdsWithSubtasks = new LinkedHashSet<>();

        if (subtasks != null) {
            for (Subtask subtask : subtasks) {
                if (subtask == null || subtask.getTask() == null || subtask.getAssignedTo() == null
                        || subtask.getAssignedTo().isBlank()) {
                    continue;
                }
                Task parent = subtask.getTask();
                if (!isWebhookTaskVisible(parent)) {
                    continue;
                }
                parentIdsWithSubtasks.add(parent.getId());
                items.add(WebhookWorkItemResponse.fromSubtask(subtask));
            }
        }

        if (tasks != null) {
            for (Task task : tasks) {
                if (!isWebhookTaskVisible(task)) {
                    continue;
                }
                boolean hasSubtasks = parentIdsWithSubtasks.contains(task.getId())
                        || (task.getTotalSubTask() != null && task.getTotalSubTask() > 0);
                if (hasSubtasks && !includeParentTasksWithSubtasks) {
                    continue;
                }
                items.add(WebhookWorkItemResponse.fromTask(task));
            }
        }

        items.sort((left, right) -> {
            LocalDateTime leftDeadline = left.getDeadline();
            LocalDateTime rightDeadline = right.getDeadline();
            if (leftDeadline == null && rightDeadline == null) {
                return safe(left.getTaskName()).compareToIgnoreCase(safe(right.getTaskName()));
            }
            if (leftDeadline == null) {
                return 1;
            }
            if (rightDeadline == null) {
                return -1;
            }
            return leftDeadline.compareTo(rightDeadline);
        });

        return items;
    }

    private boolean isWebhookTaskVisible(Task task) {
        return task != null
                && task.getStatus() != TaskStatus.CANCELLED
                && !Boolean.TRUE.equals(task.getArchived());
    }

    public List<String> suggestSubtasksWithAI(AiSubtaskSuggestionRequest request) {
        if (openRouterApiKey == null || openRouterApiKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "OPENROUTER_API_KEY is missing on backend");
        }

        String taskName = request.getTaskName() != null ? request.getTaskName().trim() : "";
        if (taskName.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Task name is required");
        }

        String description = request.getTaskDescription() != null ? request.getTaskDescription() : "";
        String priority = request.getPriority() != null ? request.getPriority().name() : "MEDIUM";
        String deadline = request.getDeadline() != null && !request.getDeadline().isBlank() ? request.getDeadline()
                : "N/A";
        String note = request.getAdminNote() != null ? request.getAdminNote() : "";
        String prompt = "Task: " + taskName
                + "\nDescription: " + description
                + "\nPriority: " + priority
                + "\nDeadline: " + deadline
                + "\nManager Note: " + note;

        try {
            ObjectMapper mapper = new ObjectMapper();
            Map<String, Object> payload = Map.of(
                    "model", openRouterModel,
                    "response_format", Map.of("type", "json_object"),
                    "messages", List.of(
                            Map.of(
                                    "role", "system",
                                    "content",
                                    "Ban la tro ly PM. Tach cong viec thanh cac task con ngan gon, co the thuc hien duoc. Tra ve JSON object voi key subtasks la array string. Khong giai thich them."),
                            Map.of("role", "user", "content", prompt)));

            String responseBody = REST_CLIENT.post()
                    .uri("https://openrouter.ai/api/v1/chat/completions")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("Authorization", "Bearer " + openRouterApiKey)
                    .body(mapper.writeValueAsString(payload))
                    .retrieve()
                    .body(String.class);

            Map<?, ?> response = mapper.readValue(responseBody, Map.class);
            List<?> choices = response.get("choices") instanceof List<?> list ? list : List.of();
            String content = "";
            if (!choices.isEmpty() && choices.get(0) instanceof Map<?, ?> choice) {
                Object messageObj = choice.get("message");
                if (messageObj instanceof Map<?, ?> message) {
                    Object contentObj = message.get("content");
                    content = contentObj instanceof String s ? s : "";
                }
            }

            if (content == null || content.isBlank()) {
                return List.of();
            }

            Map<?, ?> parsed = mapper.readValue(content, Map.class);
            List<?> raw = parsed.get("subtasks") instanceof List<?> list ? list : List.of();
            List<String> dedupe = new ArrayList<>();
            Set<String> seen = new HashSet<>();
            for (Object entry : raw) {
                if (!(entry instanceof String text)) {
                    continue;
                }
                String trimmed = text.trim();
                if (trimmed.isEmpty()) {
                    continue;
                }
                String key = trimmed.toLowerCase();
                if (seen.contains(key)) {
                    continue;
                }
                seen.add(key);
                dedupe.add(trimmed);
                if (dedupe.size() >= 10) {
                    break;
                }
            }
            return dedupe;
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Failed to generate AI subtasks", e);
        }
    }

    @Transactional
    public Task triggerAiSubtaskGeneration(Long id, String managerEmail) {
        Task task = taskRepository.findByIdAndManagerEmail(id, managerEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));

        if (task.getStatus() == TaskStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cancelled tasks cannot generate subtasks");
        }
        if (Boolean.TRUE.equals(task.getArchived())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Archived tasks cannot generate subtasks");
        }

        logTaskAction(task.getId(), ActionType.UPDATED,
                "Manual AI subtask generation requested by " + managerEmail);
        triggerN8nAiWebhook(task, "TASK_CREATED",
                "Manual AI subtask generation requested by " + managerEmail);
        return task;
    }

    private void logTaskAction(Long taskId, ActionType actionType, String message) {
        TaskLog log = new TaskLog();
        log.setTaskId(taskId);
        log.setActionType(actionType);
        log.setActionMessage(message);
        taskLogRepository.save(log);
    }

    public void triggerN8nWebhook(Task task) {
        triggerN8nWebhook(task, null, null);
    }

    public void triggerN8nAiWebhook(Task task, String eventType, String eventMessage) {
        String targetUrl = (n8nAiWebhookUrl == null || n8nAiWebhookUrl.isBlank()) ? n8nWebhookUrl : n8nAiWebhookUrl;
        triggerWebhook(task, eventType, eventMessage, targetUrl);
    }

    public void triggerN8nWebhook(Task task, String eventType, String eventMessage) {
        triggerWebhook(task, eventType, eventMessage, n8nWebhookUrl);
    }

    private void triggerWebhook(Task task, String eventType, String eventMessage, String webhookUrl) {
        if (webhookUrl == null || webhookUrl.isBlank()) {
            log.info("Skip n8n webhook for task {} because webhook URL is empty", task.getTaskId());
            return;
        }
        try {
            ObjectMapper mapper = new ObjectMapper();
            mapper.registerModule(new JavaTimeModule());
            Map<String, Object> payload = buildWebhookTaskPayload(task, eventType, eventMessage);
            String json = mapper.writeValueAsString(payload);
            java.util.concurrent.CompletableFuture.runAsync(() -> {
                try {
                    String responseBody = REST_CLIENT.post()
                            .uri(webhookUrl)
                            .contentType(MediaType.APPLICATION_JSON)
                            .body(json)
                            .retrieve()
                            .body(String.class);
                    log.info("Triggered n8n webhook for task {} -> {} body={}", task.getTaskId(), webhookUrl,
                            responseBody);
                } catch (Exception ex) {
                    log.error("Failed to trigger n8n webhook for task {} -> {}", task.getTaskId(), webhookUrl,
                            ex);
                }
            });
        } catch (Exception e) {
            log.error("Failed to trigger n8n webhook for task {} -> {}", task.getTaskId(), webhookUrl, e);
        }
    }

    private Map<String, Object> buildWebhookTaskPayload(Task task, String eventType, String eventMessage) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("eventType", eventType != null ? eventType : "");
        payload.put("taskId", task.getTaskId());
        payload.put("taskName", task.getTaskName());
        payload.put("taskDescription", task.getTaskDescription());
        payload.put("assigneeEmail", task.getAssigneeEmail());
        payload.put("managerEmail", task.getManagerEmail());
        payload.put("ownerName", task.getOwnerName());
        payload.put("deadline", task.getDeadline());
        payload.put("priority", task.getPriority());
        payload.put("status", task.getStatus());
        payload.put("adminNote", task.getAdminNote());
        payload.put("sourceInput", task.getSourceInput());
        payload.put("createdAt", task.getCreatedAt());
        payload.put("completedAt", task.getCompletedAt());
        payload.put("reminderCount", task.getReminderCount());
        payload.put("subtasks", buildWebhookSubtaskPayload(task));
        if (eventMessage != null && !eventMessage.isBlank()) {
            payload.put("eventMessage", eventMessage);
        }
        return payload;
    }

    private List<Map<String, Object>> buildWebhookSubtaskPayload(Task task) {
        if (task.getSubtasks() == null || task.getSubtasks().isEmpty()) {
            return List.of();
        }

        return task.getSubtasks().stream()
                .sorted((left, right) -> Integer.compare(
                        left.getPositionIndex() == null ? Integer.MAX_VALUE : left.getPositionIndex(),
                        right.getPositionIndex() == null ? Integer.MAX_VALUE : right.getPositionIndex()))
                .map(subtask -> {
                    Map<String, Object> entry = new LinkedHashMap<>();
                    entry.put("id", subtask.getId());
                    entry.put("title", subtask.getTitle());
                    entry.put("assignedTo", subtask.getAssignedTo());
                    entry.put("deadline", subtask.getDeadline());
                    entry.put("priority", subtask.getPriority());
                    entry.put("status", subtask.getStatus());
                    entry.put("positionIndex", subtask.getPositionIndex());
                    return entry;
                })
                .toList();
    }

    public TaskPriority normalizeSubtaskPriority(TaskPriority requestedPriority, TaskPriority parentPriority,
            String fieldName) {
        TaskPriority normalized = requestedPriority != null ? requestedPriority : parentPriority;
        if (normalized != null && parentPriority != null && priorityRank(normalized) < priorityRank(parentPriority)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    fieldName + " cannot be lower than parent task priority " + parentPriority);
        }
        return normalized;
    }

    private void ensureExistingSubtasksFitParentPriority(Long taskId, TaskPriority parentPriority) {
        if (parentPriority == null) {
            return;
        }

        List<Subtask> subtasks = subtaskRepository.findByTaskIdOrderByPositionIndexAsc(taskId);
        for (Subtask subtask : subtasks) {
            TaskPriority subtaskPriority = subtask.getPriority();
            if (subtaskPriority != null && priorityRank(subtaskPriority) < priorityRank(parentPriority)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Cannot raise parent priority above existing subtask priority " + subtaskPriority);
            }
        }
    }

    private int priorityRank(TaskPriority priority) {
        if (priority == null) {
            return 0;
        }
        return switch (priority) {
            case LOW -> 1;
            case MEDIUM -> 2;
            case HIGH -> 3;
        };
    }

    public void ensureUserExists(String email) {
        if (userRepository.existsByEmail(email)) {
            return;
        }

        User newUser = new User();
        newUser.setEmail(email);
        newUser.setFullName(email.split("@")[0]);
        newUser.setPasswordHash(passwordEncoder.encode("123456"));
        newUser.setRole(Role.USER);
        newUser.setMustChangePassword(true);
        userRepository.save(newUser);
    }

    private String requireText(String value, String fieldName) {
        if (value == null || value.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, fieldName + " is required");
        }
        return value.trim();
    }

    private String requireEmail(String value, String fieldName) {
        return requireText(value, fieldName);
    }

    private String identityLocalPart(String email) {
        if (email == null) {
            return "";
        }
        String trimmed = email.trim();
        int atIndex = trimmed.indexOf('@');
        return atIndex > 0 ? trimmed.substring(0, atIndex) : trimmed;
    }

    private String formatDateTime(LocalDateTime value) {
        return value == null ? "null" : value.toString();
    }

    private String safe(String value) {
        return value == null ? "null" : value;
    }
}


const getColumnId = (status) => {
    if (status === 'DONE') return 'DONE';
    if (['IN_PROGRESS', 'IN_REVIEW', 'OVERDUE'].includes(status)) return 'IN_PROGRESS';
    return 'TODO';
};

const identityLocalPart = (value) => {
    if (!value) return '';
    const normalized = value.trim().toLowerCase();
    return normalized.includes('@') ? normalized.split('@')[0] : normalized;
};

const sameIdentity = (left, right) => {
    if (!left || !right) return false;
    const normalizedLeft = left.trim().toLowerCase();
    const normalizedRight = right.trim().toLowerCase();
    return normalizedLeft === normalizedRight
        || normalizedLeft === identityLocalPart(normalizedRight)
        || identityLocalPart(normalizedLeft) === normalizedRight
        || identityLocalPart(normalizedLeft) === identityLocalPart(normalizedRight);
};

const reorderSubtasks = (items, source, destination, subtaskId) => {
    const movedSubtask = items.find((item) => item.id === subtaskId);

    if (!movedSubtask) {
        return items;
    }

    const columnItems = Object.fromEntries(
        COLUMNS.map((column) => [
            column.id,
            items
                .filter((item) => getColumnId(item.status) === column.id && item.id !== subtaskId)
                .sort((a, b) => (a.positionIndex ?? 0) - (b.positionIndex ?? 0)),
        ]),
    );

    const destinationItems = [...(columnItems[destination.droppableId] ?? [])];
    destinationItems.splice(destination.index, 0, {
        ...movedSubtask,
        status: destination.droppableId,
    });
    columnItems[destination.droppableId] = destinationItems;

    return COLUMNS.flatMap((column) =>
        (columnItems[column.id] ?? []).map((item, index) => ({
            ...item,
            positionIndex: index,
        })),
    );
};

const SubtaskBoard = () => {
    const { taskId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [task, setTask] = useState(null);
    const [subtasks, setSubtasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [fetchError, setFetchError] = useState('');

    const fetchData = async () => {
        try {
            const [taskRes, subtaskRes] = await Promise.all([
                api.get(`/tasks/my-tasks/${taskId}`),
                api.get(`/tasks/my-tasks/${taskId}/subtasks`)
            ]);
            setTask(taskRes.data);
            setSubtasks(Array.isArray(subtaskRes.data) ? subtaskRes.data : []);
            setFetchError('');
        } catch (err) {
            console.error('Failed to load board data', err?.response?.status, err);
            setFetchError(err.response?.data?.message || 'Không tải được dữ liệu board subtask');
        } finally {
            setLoading(false);
        }
    };

    useAutoRefresh(fetchData, [taskId], 10000, !isDragging);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const currentUserEmail = user?.email?.toLowerCase();
    const isParentAssignee = sameIdentity(task?.assigneeEmail, currentUserEmail);
    const parentLocked = task?.archived || ['DONE', 'CANCELLED'].includes(task?.status);
    const canMoveSubtask = (subtask) => (
        !parentLocked
        && currentUserEmail
        && sameIdentity(subtask.assignedTo, currentUserEmail)
    );

    const getColumnSubtasks = (columnId) => subtasks
        .filter((subtask) => getColumnId(subtask.status) === columnId)
        .sort((a, b) => (a.positionIndex ?? 0) - (b.positionIndex ?? 0));

    const handleDragEnd = async (result) => {
        const { destination, source, draggableId } = result;
        setIsDragging(false);
        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;

        const subtaskId = Number.parseInt(draggableId, 10);
        const movedSubtask = subtasks.find((subtask) => subtask.id === subtaskId);
        if (!movedSubtask || !canMoveSubtask(movedSubtask)) {
            showToast('Bạn chỉ có thể cập nhật subtask được giao cho mình', 'error');
            return;
        }

        const newStatus = destination.droppableId;
        const reorderedSubtasks = reorderSubtasks(subtasks, source, destination, subtaskId);

        setSubtasks(reorderedSubtasks);

        try {
            const statusRes = await api.patch(`/tasks/my-tasks/subtasks/${subtaskId}/status`, { status: newStatus });
            await api.patch(`/tasks/my-tasks/subtasks/${subtaskId}/position`, { position: destination.index });
            await fetchData();
            if (statusRes.data?.parentStatus === 'IN_REVIEW') {
                showToast('Tất cả subtask đã xong, task cha đang chờ manager duyệt');
            } else if (reorderedSubtasks.length > 0 && reorderedSubtasks.every((subtask) => subtask.status === 'DONE')) {
                showToast('Phần subtask của bạn đã xong');
            }
        } catch {
            showToast('Lỗi cập nhật trạng thái', 'error');
            fetchData();
        }
    };

    const doneCount = subtasks.filter(s => s.status === 'DONE').length;
    const mySubtasks = subtasks.filter((subtask) => sameIdentity(subtask.assignedTo, currentUserEmail));
    const myDoneCount = mySubtasks.filter((subtask) => subtask.status === 'DONE').length;
    const progress = subtasks.length > 0 ? Math.round((doneCount / subtasks.length) * 100) : 0;

    const getPriorityBadge = (p) => {
        if (!p) return null;
        return <span className={`badge-priority ${p.toLowerCase()}`}>{p.charAt(0) + p.slice(1).toLowerCase()}</span>;
    };

    const getStatusBadge = (status) => {
        const map = { DONE: 'done', IN_PROGRESS: 'in-progress', PENDING: 'pending', IN_REVIEW: 'in-review', OVERDUE: 'danger', TODO: 'pending' };
        const label = { DONE: 'Done', IN_PROGRESS: 'In Progress', PENDING: 'Pending', IN_REVIEW: 'In Review', OVERDUE: 'Overdue', TODO: 'To Do' };
        return <span className={`badge ${map[status] || 'pending'}`}>{label[status] || status}</span>;
    };

    const getOverdueBadge = (subtask) => {
        if (subtask.status === 'DONE' || !subtask.deadline) return null;
        const now = new Date();
        const dl = new Date(subtask.deadline);
        const diffMs = dl - now;
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            return <span className="kanban-badge-overdue">🔴 Overdue ({Math.abs(diffDays)}d)</span>;
        } else if (diffDays <= 2) {
            return <span className="kanban-badge-due-soon">🟡 Due soon ({diffDays}d)</span>;
        }
        return null;
    };

    if (loading) return <div className="page-loading"><LoadingCompass size={40} /></div>;
    if (!task) {
        return (
            <div className="page-container fade-in">
                <div className="form-error-banner">{fetchError || 'Task not found.'}</div>
                <button className="btn-glass btn-sm" onClick={() => navigate('/user/tasks')}>
                    <ArrowLeft size={16} /> Quay lại
                </button>
            </div>
        );
    }

    return (
        <div className="page-container fade-in">
            {/* Header */}
            <div className="kanban-header">
                <div className="kanban-header-left">
                    <button className="btn-glass btn-sm" onClick={() => navigate('/user/tasks')}>
                        <ArrowLeft size={16} /> Quay lại
                    </button>
                    <div className="kanban-task-info">
                        <h1 className="kanban-task-title">{task.taskName}</h1>
                        <div className="kanban-task-meta">
                            {getPriorityBadge(task.priority)}
                            {getStatusBadge(task.status)}
                            {task.deadline && (
                                <span className="kanban-deadline">
                                    <Calendar size={13} /> {new Date(task.deadline).toLocaleDateString('vi-VN')}
                                    {task.daysLeft !== null && task.daysLeft <= 3 && task.status !== 'DONE' && (
                                        <span className={`days-inline ${task.daysLeft < 0 ? 'danger' : 'warning'}`}>
                                            {task.daysLeft < 0 ? `${Math.abs(task.daysLeft)}d late` : task.daysLeft === 0 ? 'Hôm nay' : `${task.daysLeft}d left`}
                                        </span>
                                    )}
                                </span>
                            )}
                        </div>
                        <div className="kanban-task-people">
                            <span className="kanban-people-item">
                                <User size={13} /> <strong>Giao bởi:</strong> {task.ownerName || task.managerEmail?.split('@')[0]}
                            </span>
                            <span className="kanban-people-item">
                                <User size={13} /> <strong>Thực hiện:</strong> {task.assigneeEmail?.split('@')[0]}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="kanban-progress-area">
                    <span className="kanban-progress-text">
                        {isParentAssignee
                            ? `${doneCount}/${subtasks.length} subtasks completed`
                            : `${doneCount}/${subtasks.length} my subtasks completed`}
                    </span>
                    <div className="kanban-progress-bar">
                        <div className="kanban-progress-fill" style={{ width: `${progress}%` }}></div>
                    </div>
                    <span className="kanban-progress-pct">{progress}%</span>
                    {isParentAssignee && subtasks.length !== mySubtasks.length && (
                        <span className="form-help-text">
                            Bạn phụ trách task cha nên thấy toàn bộ subtask. Phần của bạn: {myDoneCount}/{mySubtasks.length}.
                        </span>
                    )}
                </div>
            </div>

            {fetchError && <div className="form-error-banner">{fetchError}</div>}
            {parentLocked && (
                <div className="form-muted-banner">
                    Task cha đã {task.archived ? 'archive' : `ở trạng thái ${task.status}`}; board chỉ cho phép xem lại.
                </div>
            )}

            {/* Kanban Board */}
            <DragDropContext onDragStart={() => setIsDragging(true)} onDragEnd={handleDragEnd}>
                <div className="kanban-board">
                    {COLUMNS.map(col => (
                        <div className="kanban-column" key={col.id}>
                            <div className="kanban-column-header" style={{ borderTopColor: col.color }}>
                                <div className="kanban-column-title">
                                    {col.icon}
                                    <span>{col.title}</span>
                                    <span className="kanban-column-count">{getColumnSubtasks(col.id).length}</span>
                                </div>
                            </div>

                            <Droppable droppableId={col.id}>
                                {(provided, snapshot) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        className={`kanban-column-body ${snapshot.isDraggingOver ? 'kanban-drop-active' : ''}`}
                                    >
                                        {getColumnSubtasks(col.id).length === 0 && (
                                            <div className="detail-empty">No subtasks in this column.</div>
                                        )}
                                        {getColumnSubtasks(col.id).map((subtask, index) => {
                                            const movable = canMoveSubtask(subtask);
                                            return (
                                            <Draggable
                                                key={subtask.id}
                                                draggableId={String(subtask.id)}
                                                index={index}
                                                isDragDisabled={!movable}
                                            >
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        {...(movable ? provided.dragHandleProps : {})}
                                                        style={provided.draggableProps.style}
                                                        className={`kanban-card kanban-card-rich ${snapshot.isDragging ? 'kanban-card-dragging' : ''} ${subtask.isOverdue ? 'kanban-card-overdue' : ''} ${!movable ? 'kanban-card-locked' : ''}`}
                                                    >
                                                        <div className="kanban-card-top">
                                                            <span className="kanban-drag-handle" style={{ cursor: movable ? 'grab' : 'not-allowed' }}>
                                                                {movable ? <GripVertical size={14} /> : <Lock size={14} />}
                                                            </span>
                                                            <span className="kanban-card-title">{subtask.title}</span>
                                                        </div>
                                                        <div className="kanban-card-details">
                                                            {subtask.priority && (
                                                                <span className={`kanban-card-priority ${subtask.priority.toLowerCase()}`}>
                                                                    <Flag size={11} /> {subtask.priority.charAt(0) + subtask.priority.slice(1).toLowerCase()}
                                                                </span>
                                                            )}
                                                            {subtask.deadline && (
                                                                <span className="kanban-card-deadline">
                                                                    <Calendar size={11} /> {new Date(subtask.deadline).toLocaleDateString('vi-VN')}
                                                                </span>
                                                            )}
                                                            {subtask.assignedTo && (
                                                                <span className="kanban-card-assignee">
                                                                    <div className="avatar-xs">{subtask.assignedTo.charAt(0).toUpperCase()}</div>
                                                                    {subtask.assignedTo.split('@')[0]}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {!movable && (
                                                            <span className="kanban-card-lock-note">
                                                                <Lock size={11} /> {isParentAssignee ? 'Subtask của thành viên khác, chỉ xem' : 'Chỉ xem, không được kéo'}
                                                            </span>
                                                        )}
                                                        {getOverdueBadge(subtask)}
                                                    </div>
                                                )}
                                            </Draggable>
                                            );
                                        })}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </div>
                    ))}
                </div>
            </DragDropContext>
            {subtasks.length === 0 && (
                <div className="glass-panel user-empty-panel">
                    <ListTodo size={24} />
                    <span>{isParentAssignee ? 'Task cha này chưa có subtask.' : 'Bạn chưa được giao subtask nào trong task cha này.'}</span>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className={`toast-notification ${toast.type}`}>
                    {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                    {toast.msg}
                </div>
            )}
        </div>
    );
};

export default SubtaskBoard;
