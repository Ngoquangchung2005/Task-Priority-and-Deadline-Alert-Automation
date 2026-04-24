package com.task.automation.service;

import com.task.automation.dto.request.TaskRequest;
import com.task.automation.dto.request.AiSubtaskSuggestionRequest;
import com.task.automation.dto.request.WebhookSyncRequest;
import com.task.automation.entity.Subtask;
import com.task.automation.entity.Task;
import com.task.automation.entity.TaskLog;
import com.task.automation.entity.User;
import com.task.automation.enums.ActionType;
import com.task.automation.enums.Role;
import com.task.automation.enums.TaskStatus;
import com.task.automation.repository.TaskLogRepository;
import com.task.automation.repository.TaskRepository;
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
import java.time.Duration;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.Objects;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.HashSet;
import java.util.Set;
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
        return taskRepository.findByIdAndAssigneeEmail(id, userEmail);
    }

    public java.util.Optional<Task> getTaskForManager(Long id, String managerEmail) {
        return taskRepository.findByIdAndManagerEmail(id, managerEmail);
    }

    @Transactional
    public Task createTask(TaskRequest request, String managerEmail, String managerName) {
        if (!userRepository.existsByEmail(request.getAssigneeEmail())) {
            User newUser = new User();
            newUser.setEmail(request.getAssigneeEmail());
            newUser.setFullName(request.getAssigneeEmail().split("@")[0]);
            newUser.setPasswordHash(passwordEncoder.encode("123456"));
            newUser.setRole(Role.USER);
            newUser.setMustChangePassword(true);
            userRepository.save(newUser);
        }

        Task task = new Task();
        task.setTaskId("TSK-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        task.setTaskName(request.getTaskName());
        task.setTaskDescription(request.getTaskDescription());
        task.setAssigneeEmail(request.getAssigneeEmail());
        task.setManagerEmail(managerEmail);
        task.setOwnerName(managerName);
        task.setPriority(request.getPriority());
        task.setStatus(TaskStatus.PENDING);
        task.setArchived(false);
        task.setArchivedAt(null);

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

        // Create subtasks if provided
        if (request.getSubtaskTitles() != null && !request.getSubtaskTitles().isEmpty()) {
            List<Subtask> subtasks = new ArrayList<>();
            for (int i = 0; i < request.getSubtaskTitles().size(); i++) {
                String title = request.getSubtaskTitles().get(i);
                if (title != null && !title.trim().isEmpty()) {
                    Subtask subtask = new Subtask();
                    subtask.setTitle(title.trim());
                    subtask.setStatus(TaskStatus.TODO);
                    subtask.setPositionIndex(i);
                    subtask.setTask(task);
                    subtasks.add(subtask);
                }
            }
            task.setSubtasks(subtasks);
            task.setTotalSubTask(subtasks.size());
        }

        Task savedTask = taskRepository.save(task);
        logTaskAction(savedTask.getId(), ActionType.CREATED, "Task created by " + managerEmail);
        triggerN8nWebhook(savedTask, "TASK_CREATED", "New task created by " + managerEmail);

        return savedTask;
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

        if (task.getStatus() == TaskStatus.IN_PROGRESS) {
            boolean assigneeChanged = !Objects.equals(task.getAssigneeEmail(), request.getAssigneeEmail());
            boolean nameChanged = !Objects.equals(task.getTaskName(), request.getTaskName());
            boolean descriptionChanged = !Objects.equals(task.getTaskDescription(), request.getTaskDescription());
            if (assigneeChanged || nameChanged || descriptionChanged) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "In-progress tasks only allow updating deadline, priority, and admin note");
            }
        }

        String beforeAssignee = task.getAssigneeEmail();
        LocalDateTime beforeDeadline = task.getDeadline();
        String beforePriority = task.getPriority() != null ? task.getPriority().name() : null;
        String beforeNote = task.getAdminNote();
        String beforeDescription = task.getTaskDescription();
        String beforeName = task.getTaskName();

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
            changes.add(String.format("Task name changed from '%s' to '%s'", safe(beforeName), safe(savedTask.getTaskName())));
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
            changes.add(String.format("Assignee changed from '%s' to '%s'", safe(beforeAssignee), safe(savedTask.getAssigneeEmail())));
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
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only cancelled or archived tasks can be permanently deleted");
        }

        taskLogRepository.deleteByTaskId(task.getId());
        taskRepository.delete(task);
    }

    public List<Task> getAllTasksForManager(String managerEmail) {
        return syncOverdueStatuses(taskRepository.findByManagerEmail(managerEmail));
    }

    public List<Task> getTasksForUser(String userEmail) {
        return syncOverdueStatuses(taskRepository.findByAssigneeEmail(userEmail));
    }

    @Transactional
    public Task updateTaskStatusForUser(Long id, TaskStatus newStatus, String userEmail) {
        Task task = taskRepository.findByIdAndAssigneeEmail(id, userEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));
        return updateTaskStatus(task, newStatus, userEmail);
    }

    @Transactional
    public Task updateTaskStatusForManager(Long id, TaskStatus newStatus, String managerEmail) {
        Task task = taskRepository.findByIdAndManagerEmail(id, managerEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));
        return updateTaskStatus(task, newStatus, managerEmail);
    }

    private Task updateTaskStatus(Task task, TaskStatus newStatus, String actorEmail) {
        if (task.getStatus() == TaskStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cancelled tasks cannot change status");
        }
        if (Boolean.TRUE.equals(task.getArchived())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Archived tasks cannot change status");
        }
        task.setStatus(newStatus);
        if (newStatus == TaskStatus.DONE) {
            task.setCompletedAt(LocalDateTime.now());
        }
        Task savedTask = taskRepository.save(task);
        logTaskAction(savedTask.getId(), ActionType.STATUS_CHANGED,
                "Status changed to " + newStatus + " by " + actorEmail);

        triggerN8nWebhook(savedTask, "TASK_STATUS_CHANGED",
                "Status changed to " + newStatus + " by " + actorEmail);

        return savedTask;
    }

    @Transactional
    public void handleWebhookSync(WebhookSyncRequest request) {
        Task task = taskRepository.findByTaskId(request.getTaskId())
                .orElseThrow(() -> new RuntimeException("Task not found: " + request.getTaskId()));

        if (request.getActionType() == ActionType.REMINDER_SENT) {
            task.setLastRemindedAt(LocalDateTime.now());
            task.setReminderCount(task.getReminderCount() + 1);
        } else if (request.getActionType() == ActionType.ESCALATED) {
            task.setEscalatedAt(LocalDateTime.now());
        }

        taskRepository.save(task);
        logTaskAction(task.getId(), request.getActionType(), request.getActionMessage());
    }

    public List<Task> getOverdueTasks() {
        return syncOverdueStatuses(
                taskRepository.findOverdueTasks(List.of(TaskStatus.PENDING, TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW, TaskStatus.OVERDUE)));
    }

    public List<Task> getPendingReminders() {
        return syncOverdueStatuses(
                taskRepository.findTasksByStatuses(List.of(TaskStatus.PENDING, TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW, TaskStatus.OVERDUE)));
    }

    public List<Task> getEmployeeStatisticsTasks() {
        LocalDateTime startOfWeek = LocalDate.now()
                .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
                .atStartOfDay();

        return syncOverdueStatuses(
                taskRepository.findTasksForEmployeeStatistics(
                        List.of(TaskStatus.PENDING, TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW, TaskStatus.OVERDUE),
                        TaskStatus.DONE,
                        startOfWeek));
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
        String deadline = request.getDeadline() != null && !request.getDeadline().isBlank() ? request.getDeadline() : "N/A";
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
            Map<String, Object> payload = new LinkedHashMap<>(mapper.convertValue(task, Map.class));
            payload.put("eventType", eventType != null ? eventType : "");
            if (eventMessage != null && !eventMessage.isBlank()) {
                payload.put("eventMessage", eventMessage);
            }
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

    private String formatDateTime(LocalDateTime value) {
        return value == null ? "null" : value.toString();
    }

    private String safe(String value) {
        return value == null ? "null" : value;
    }
}
