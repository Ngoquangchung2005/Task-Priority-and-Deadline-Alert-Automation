package com.task.automation.service;

import com.task.automation.dto.request.SubtaskRequest;
import com.task.automation.entity.Subtask;
import com.task.automation.entity.Task;
import com.task.automation.entity.TaskLog;
import com.task.automation.enums.ActionType;
import com.task.automation.enums.TaskPriority;
import com.task.automation.enums.TaskStatus;
import com.task.automation.repository.SubtaskRepository;
import com.task.automation.repository.TaskLogRepository;
import com.task.automation.repository.TaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class SubtaskService {

    private final SubtaskRepository subtaskRepository;
    private final TaskRepository taskRepository;
    private final TaskLogRepository taskLogRepository;
    private final TaskService taskService;

    public List<Subtask> getSubtasksForManager(Long taskId, String managerEmail) {
        Task task = taskRepository.findByIdAndManagerEmail(taskId, managerEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));
        return subtaskRepository.findByTaskIdOrderByPositionIndexAsc(task.getId());
    }

    public List<Subtask> getSubtasksForUser(Long taskId, String userEmail) {
        return subtaskRepository.findByTaskIdAndAssignedIdentityOrderByPositionIndexAsc(
                taskId, userEmail, identityLocalPart(userEmail));
    }

    public List<Subtask> getVisibleSubtasksForUser(Long taskId, String userEmail) {
        boolean ownsParent = taskRepository.findByIdAndAssigneeIdentity(
                taskId, userEmail, identityLocalPart(userEmail)).isPresent();
        if (ownsParent) {
            return subtaskRepository.findByTaskIdOrderByPositionIndexAsc(taskId);
        }

        List<Subtask> assignedSubtasks = subtaskRepository.findByTaskIdAndAssignedIdentityOrderByPositionIndexAsc(
                taskId, userEmail, identityLocalPart(userEmail));
        if (assignedSubtasks.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found");
        }
        return assignedSubtasks;
    }

    public List<Subtask> getMySubtasks(String userEmail) {
        return subtaskRepository.findByAssignedIdentityOrderByCreatedAtDescPositionIndexAsc(
                userEmail, identityLocalPart(userEmail));
    }

    public List<Subtask> getSubtasksByAssigneeEmail(String email) {
        return subtaskRepository.findByAssignedToIgnoreCaseOrderByDeadlineAscPositionIndexAsc(email);
    }

    @Transactional
    public Subtask createSubtask(Long taskId, SubtaskRequest request, String managerEmail) {
        Task task = taskRepository.findByIdAndManagerEmail(taskId, managerEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));
        guardParentTaskCanChange(task);

        String assignedTo = requireText(request.getAssignedTo(), "assignedTo");
        taskService.ensureUserExists(assignedTo);

        Subtask subtask = new Subtask();
        subtask.setTitle(requireText(request.getTitle(), "title"));
        subtask.setStatus(normalizeSubtaskStatus(request.getStatus()));
        TaskPriority priority = taskService.normalizeSubtaskPriority(request.getPriority(), task.getPriority(), "priority");
        subtask.setPriority(priority);
        subtask.setDeadline(resolveSubtaskDeadline(request.getDeadline(), priority));
        subtask.setAssignedTo(assignedTo);
        subtask.setCreatedBy(managerEmail);
        subtask.setTask(task);

        // Set position to be at end
        List<Subtask> existing = subtaskRepository.findByTaskIdOrderByPositionIndexAsc(taskId);
        subtask.setPositionIndex(request.getPositionIndex() != null ? request.getPositionIndex() : existing.size());

        Subtask saved = subtaskRepository.save(subtask);

        // Update total count
        task.setTotalSubTask(existing.size() + 1);
        taskRepository.save(task);
        logTaskAction(task.getId(), ActionType.UPDATED,
                "Subtask '" + saved.getTitle() + "' assigned to " + assignedTo + " by " + managerEmail);
        syncParentTaskStatus(task, managerEmail);
        taskService.triggerN8nSubtaskWebhook(saved, "SUBTASK_CREATED",
                "Subtask '" + saved.getTitle() + "' assigned to " + assignedTo + " by " + managerEmail);

        return saved;
    }

    @Transactional
    public int createSubtasksFromWebhook(String taskPublicId, List<String> titles) {
        Task task = taskRepository.findByTaskId(taskPublicId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));

        if (titles == null || titles.isEmpty()) {
            return 0;
        }

        List<Subtask> existing = subtaskRepository.findByTaskIdOrderByPositionIndexAsc(task.getId());
        Set<String> existingNormalizedTitles = new LinkedHashSet<>();
        for (Subtask subtask : existing) {
            if (subtask.getTitle() != null) {
                existingNormalizedTitles.add(subtask.getTitle().trim().toLowerCase());
            }
        }

        Set<String> candidates = new LinkedHashSet<>();
        for (String rawTitle : titles) {
            if (rawTitle == null) continue;
            String normalized = rawTitle.trim();
            if (normalized.isEmpty()) continue;
            if (normalized.length() > 255) {
                normalized = normalized.substring(0, 255);
            }
            String key = normalized.toLowerCase();
            if (existingNormalizedTitles.contains(key)) continue;
            candidates.add(normalized);
            if (candidates.size() >= 10) break;
        }

        int position = existing.size();
        int created = 0;
        for (String title : candidates) {
            Subtask subtask = new Subtask();
            subtask.setTitle(title);
            subtask.setStatus(TaskStatus.TODO);
            subtask.setPriority(task.getPriority());
            subtask.setDeadline(resolveSubtaskDeadline(null, task.getPriority()));
            subtask.setAssignedTo(task.getAssigneeEmail());
            subtask.setCreatedBy(task.getManagerEmail());
            subtask.setTask(task);
            subtask.setPositionIndex(position++);
            Subtask saved = subtaskRepository.save(subtask);
            taskService.triggerN8nSubtaskWebhook(saved, "SUBTASK_CREATED",
                    "Subtask '" + saved.getTitle() + "' assigned to " + saved.getAssignedTo()
                            + " by " + task.getManagerEmail());
            created++;
        }

        if (created > 0) {
            task.setTotalSubTask(existing.size() + created);
            taskRepository.save(task);
            syncParentTaskStatus(task, task.getManagerEmail());
        }

        return created;
    }

    @Transactional
    public Subtask updateSubtask(Long subtaskId, SubtaskRequest request, String managerEmail) {
        Subtask subtask = getManagerOwnedSubtask(subtaskId, managerEmail);
        guardParentTaskCanChange(subtask.getTask());

        String assignedTo = requireText(request.getAssignedTo(), "assignedTo");
        taskService.ensureUserExists(assignedTo);

        subtask.setTitle(requireText(request.getTitle(), "title"));
        TaskPriority priority = taskService.normalizeSubtaskPriority(
                request.getPriority(), subtask.getTask().getPriority(), "priority");
        subtask.setPriority(priority);
        subtask.setDeadline(resolveSubtaskDeadline(request.getDeadline(), priority));
        subtask.setAssignedTo(assignedTo);
        if (request.getPositionIndex() != null) {
            subtask.setPositionIndex(request.getPositionIndex());
        }
        if (request.getStatus() != null) {
            subtask.setStatus(normalizeSubtaskStatus(request.getStatus()));
        }

        Subtask saved = subtaskRepository.save(subtask);
        logTaskAction(subtask.getTask().getId(), ActionType.UPDATED,
                "Subtask '" + saved.getTitle() + "' updated by " + managerEmail);
        syncParentTaskStatus(subtask.getTask(), managerEmail);
        taskService.triggerN8nSubtaskWebhook(saved, "SUBTASK_UPDATED",
                "Subtask '" + saved.getTitle() + "' updated by " + managerEmail);
        return saved;
    }

    @Transactional
    public Subtask updateSubtaskStatus(Long subtaskId, TaskStatus newStatus, String managerEmail) {
        Subtask subtask = getManagerOwnedSubtask(subtaskId, managerEmail);
        return updateSubtaskStatusInternal(subtask, newStatus, managerEmail);
    }

    @Transactional
    public Subtask updateSubtaskStatusForUser(Long subtaskId, TaskStatus newStatus, String userEmail) {
        Subtask subtask = subtaskRepository.findById(subtaskId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Subtask not found"));

        if (!sameIdentity(subtask.getAssignedTo(), userEmail)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Subtask not found");
        }

        return updateSubtaskStatusInternal(subtask, normalizeUserSubtaskStatus(newStatus), userEmail);
    }

    @Transactional
    public Subtask updateSubtaskPosition(Long subtaskId, int newPosition, String managerEmail) {
        Subtask subtask = getManagerOwnedSubtask(subtaskId, managerEmail);
        guardParentTaskCanChange(subtask.getTask());
        subtask.setPositionIndex(newPosition);
        return subtaskRepository.save(subtask);
    }

    @Transactional
    public Subtask updateSubtaskPositionForUser(Long subtaskId, int newPosition, String userEmail) {
        Subtask subtask = subtaskRepository.findById(subtaskId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Subtask not found"));

        if (!sameIdentity(subtask.getAssignedTo(), userEmail)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Subtask not found");
        }
        guardParentTaskCanChange(subtask.getTask());

        subtask.setPositionIndex(newPosition);
        return subtaskRepository.save(subtask);
    }

    @Transactional
    public void deleteSubtask(Long subtaskId, String managerEmail) {
        Subtask subtask = getManagerOwnedSubtask(subtaskId, managerEmail);
        Task task = subtask.getTask();
        guardParentTaskCanChange(task);
        String title = subtask.getTitle();

        subtaskRepository.delete(subtask);

        // Update total count
        List<Subtask> remaining = subtaskRepository.findByTaskIdOrderByPositionIndexAsc(task.getId());
        task.setTotalSubTask(remaining.size());
        taskRepository.save(task);

        // Re-sync parent status
        logTaskAction(task.getId(), ActionType.UPDATED,
                "Subtask '" + title + "' deleted by " + managerEmail);
        syncParentTaskStatus(task, managerEmail);
        taskService.triggerN8nSubtaskWebhook(subtask, "SUBTASK_DELETED",
                "Subtask '" + title + "' deleted by " + managerEmail);
    }

    /**
     * Auto-sync parent task status based on subtask statuses.
     * - All subtasks DONE -> parent IN_REVIEW so the manager can approve DONE
     * - All subtasks still TODO/PENDING -> parent remains not-started
     * - Otherwise -> parent IN_PROGRESS
     */
    private void syncParentTaskStatus(Task task, String actorEmail) {
        List<Subtask> subtasks = subtaskRepository.findByTaskIdOrderByPositionIndexAsc(task.getId());

        task.setTotalSubTask(subtasks.size());
        if (subtasks.isEmpty()) {
            taskRepository.save(task);
            return;
        }

        TaskStatus originalStatus = task.getStatus();
        LocalDateTime originalCompletedAt = task.getCompletedAt();
        boolean allDone = subtasks.stream().allMatch(s -> s.getStatus() == TaskStatus.DONE);
        boolean allNotStarted = subtasks.stream()
                .allMatch(s -> s.getStatus() == TaskStatus.TODO || s.getStatus() == TaskStatus.PENDING);

        if (allDone) {
            task.setStatus(TaskStatus.IN_REVIEW);
            task.setCompletedAt(null);
        } else if (allNotStarted) {
            if (originalStatus != TaskStatus.PENDING
                    && originalStatus != TaskStatus.TODO
                    && originalStatus != TaskStatus.OVERDUE) {
                task.setStatus(TaskStatus.PENDING);
            }
            task.setCompletedAt(null);
        } else {
            task.setStatus(TaskStatus.IN_PROGRESS);
            task.setCompletedAt(null);
        }

        Task savedTask = taskRepository.save(task);

        boolean statusChanged = originalStatus != savedTask.getStatus();
        boolean completedAtChanged = (originalCompletedAt == null && savedTask.getCompletedAt() != null)
                || (originalCompletedAt != null && !originalCompletedAt.equals(savedTask.getCompletedAt()));

        if (statusChanged || completedAtChanged) {
            if (statusChanged) {
                logTaskAction(savedTask.getId(), ActionType.STATUS_CHANGED,
                        "Parent task status changed to " + savedTask.getStatus() + " after subtask update by " + actorEmail);
            }
            if (allDone && originalStatus != TaskStatus.IN_REVIEW) {
                taskService.triggerN8nWebhook(savedTask, "TASK_READY_FOR_REVIEW",
                        "All subtasks completed by " + actorEmail + "; waiting for manager review");
            } else {
                taskService.triggerN8nWebhook(savedTask, "TASK_STATUS_CHANGED",
                        "Parent task status changed to " + savedTask.getStatus() + " after subtask update by " + actorEmail);
            }
        }
    }

    private Subtask getManagerOwnedSubtask(Long subtaskId, String managerEmail) {
        Subtask subtask = subtaskRepository.findById(subtaskId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Subtask not found"));

        if (!managerEmail.equalsIgnoreCase(subtask.getTask().getManagerEmail())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Subtask not found");
        }

        return subtask;
    }

    private Subtask updateSubtaskStatusInternal(Subtask subtask, TaskStatus newStatus, String actorEmail) {
        guardParentTaskCanChange(subtask.getTask());
        TaskStatus normalizedStatus = normalizeSubtaskStatus(newStatus);
        TaskStatus previousStatus = subtask.getStatus();

        if (previousStatus == normalizedStatus) {
            return subtask;
        }

        subtask.setStatus(normalizedStatus);
        Subtask saved = subtaskRepository.save(subtask);
        logTaskAction(subtask.getTask().getId(), ActionType.STATUS_CHANGED,
                "Subtask '" + saved.getTitle() + "' status changed from " + previousStatus
                        + " to " + normalizedStatus + " by " + actorEmail);

        syncParentTaskStatus(subtask.getTask(), actorEmail);
        return saved;
    }

    private TaskStatus normalizeSubtaskStatus(TaskStatus status) {
        TaskStatus normalized = status != null ? status : TaskStatus.TODO;
        if (normalized == TaskStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Subtask status cannot be CANCELLED");
        }
        return normalized;
    }

    private LocalDateTime resolveSubtaskDeadline(LocalDateTime requestedDeadline, TaskPriority priority) {
        if (requestedDeadline != null) {
            return requestedDeadline;
        }
        TaskPriority normalizedPriority = priority != null ? priority : TaskPriority.MEDIUM;
        int days = switch (normalizedPriority) {
            case HIGH -> 7;
            case MEDIUM -> 14;
            case LOW -> 30;
        };
        return LocalDateTime.now().plusDays(days);
    }

    private TaskStatus normalizeUserSubtaskStatus(TaskStatus status) {
        TaskStatus normalized = normalizeSubtaskStatus(status);
        if (normalized == TaskStatus.IN_REVIEW) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Users can only move assigned subtasks to TODO, IN_PROGRESS, or DONE");
        }
        if (normalized != TaskStatus.TODO && normalized != TaskStatus.PENDING
                && normalized != TaskStatus.IN_PROGRESS && normalized != TaskStatus.DONE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid user subtask status: " + normalized);
        }
        return normalized;
    }

    private void guardParentTaskCanChange(Task task) {
        if (task.getStatus() == TaskStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cancelled tasks cannot change subtasks");
        }
        if (task.getStatus() == TaskStatus.DONE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Completed tasks cannot change subtasks");
        }
        if (Boolean.TRUE.equals(task.getArchived())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Archived tasks cannot change subtasks");
        }
    }

    private void logTaskAction(Long taskId, ActionType actionType, String message) {
        TaskLog log = new TaskLog();
        log.setTaskId(taskId);
        log.setActionType(actionType);
        log.setActionMessage(message);
        taskLogRepository.save(log);
    }

    private String requireText(String value, String fieldName) {
        if (value == null || value.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, fieldName + " is required");
        }
        return value.trim();
    }

    private boolean sameIdentity(String storedValue, String userEmail) {
        if (storedValue == null || storedValue.trim().isEmpty() || userEmail == null || userEmail.trim().isEmpty()) {
            return false;
        }

        String stored = storedValue.trim().toLowerCase();
        String email = userEmail.trim().toLowerCase();
        String localPart = identityLocalPart(email).toLowerCase();
        return stored.equals(email) || stored.equals(localPart);
    }

    private String identityLocalPart(String email) {
        if (email == null) {
            return "";
        }
        String trimmed = email.trim();
        int atIndex = trimmed.indexOf('@');
        return atIndex > 0 ? trimmed.substring(0, atIndex) : trimmed;
    }
}