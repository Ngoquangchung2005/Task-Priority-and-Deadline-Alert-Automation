package com.task.automation.service;

import com.task.automation.dto.request.SubtaskRequest;
import com.task.automation.entity.Subtask;
import com.task.automation.entity.Task;
import com.task.automation.enums.TaskStatus;
import com.task.automation.repository.SubtaskRepository;
import com.task.automation.repository.TaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SubtaskService {

    private final SubtaskRepository subtaskRepository;
    private final TaskRepository taskRepository;
    private final TaskService taskService;

    public List<Subtask> getSubtasksForManager(Long taskId, String managerEmail) {
        Task task = taskRepository.findByIdAndManagerEmail(taskId, managerEmail)
                .orElseThrow(() -> new RuntimeException("Task not found"));
        return subtaskRepository.findByTaskIdOrderByPositionIndexAsc(task.getId());
    }

    public List<Subtask> getSubtasksForUser(Long taskId, String userEmail) {
        Task task = taskRepository.findByIdAndAssigneeEmail(taskId, userEmail)
                .orElseThrow(() -> new RuntimeException("Task not found"));
        return subtaskRepository.findByTaskIdOrderByPositionIndexAsc(task.getId());
    }

    @Transactional
    public Subtask createSubtask(Long taskId, SubtaskRequest request, String managerEmail) {
        Task task = taskRepository.findByIdAndManagerEmail(taskId, managerEmail)
                .orElseThrow(() -> new RuntimeException("Task not found"));

        Subtask subtask = new Subtask();
        subtask.setTitle(request.getTitle().trim());
        subtask.setStatus(TaskStatus.TODO);
        subtask.setPriority(request.getPriority());
        subtask.setDeadline(request.getDeadline());
        subtask.setAssignedTo(request.getAssignedTo());
        subtask.setCreatedBy(managerEmail);
        subtask.setTask(task);

        // Set position to be at end
        List<Subtask> existing = subtaskRepository.findByTaskIdOrderByPositionIndexAsc(taskId);
        subtask.setPositionIndex(existing.size());

        Subtask saved = subtaskRepository.save(subtask);

        // Update total count
        task.setTotalSubTask(existing.size() + 1);
        taskRepository.save(task);

        return saved;
    }

    @Transactional
    public Subtask updateSubtask(Long subtaskId, SubtaskRequest request, String managerEmail) {
        Subtask subtask = getManagerOwnedSubtask(subtaskId, managerEmail);

        subtask.setTitle(request.getTitle().trim());
        subtask.setPriority(request.getPriority());
        subtask.setDeadline(request.getDeadline());
        subtask.setAssignedTo(request.getAssignedTo());

        return subtaskRepository.save(subtask);
    }

    @Transactional
    public Subtask updateSubtaskStatus(Long subtaskId, TaskStatus newStatus, String managerEmail) {
        Subtask subtask = getManagerOwnedSubtask(subtaskId, managerEmail);

        subtask.setStatus(newStatus);
        Subtask saved = subtaskRepository.save(subtask);

        // Auto-sync parent task status
        syncParentTaskStatus(subtask.getTask());

        return saved;
    }

    @Transactional
    public Subtask updateSubtaskStatusForUser(Long subtaskId, TaskStatus newStatus, String userEmail) {
        Subtask subtask = subtaskRepository.findById(subtaskId)
                .orElseThrow(() -> new RuntimeException("Subtask not found"));

        if (!userEmail.equalsIgnoreCase(subtask.getTask().getAssigneeEmail())) {
            throw new RuntimeException("Subtask not found");
        }

        subtask.setStatus(newStatus);
        Subtask saved = subtaskRepository.save(subtask);
        syncParentTaskStatus(subtask.getTask());
        return saved;
    }

    @Transactional
    public Subtask updateSubtaskPosition(Long subtaskId, int newPosition, String managerEmail) {
        Subtask subtask = getManagerOwnedSubtask(subtaskId, managerEmail);
        subtask.setPositionIndex(newPosition);
        return subtaskRepository.save(subtask);
    }

    @Transactional
    public Subtask updateSubtaskPositionForUser(Long subtaskId, int newPosition, String userEmail) {
        Subtask subtask = subtaskRepository.findById(subtaskId)
                .orElseThrow(() -> new RuntimeException("Subtask not found"));

        if (!userEmail.equalsIgnoreCase(subtask.getTask().getAssigneeEmail())) {
            throw new RuntimeException("Subtask not found");
        }

        subtask.setPositionIndex(newPosition);
        return subtaskRepository.save(subtask);
    }

    @Transactional
    public void deleteSubtask(Long subtaskId, String managerEmail) {
        Subtask subtask = getManagerOwnedSubtask(subtaskId, managerEmail);
        Task task = subtask.getTask();

        subtaskRepository.delete(subtask);

        // Update total count
        List<Subtask> remaining = subtaskRepository.findByTaskIdOrderByPositionIndexAsc(task.getId());
        task.setTotalSubTask(remaining.size());
        taskRepository.save(task);

        // Re-sync parent status
        syncParentTaskStatus(task);
    }

    /**
     * Auto-sync parent task status based on subtask statuses.
     * - All subtasks DONE → parent IN_REVIEW (+ set completedAt)
     * - Otherwise → parent IN_PROGRESS
     */
    private void syncParentTaskStatus(Task task) {
        List<Subtask> subtasks = subtaskRepository.findByTaskIdOrderByPositionIndexAsc(task.getId());

        if (subtasks.isEmpty())
            return;

        TaskStatus originalStatus = task.getStatus();
        LocalDateTime originalCompletedAt = task.getCompletedAt();
        boolean allDone = subtasks.stream().allMatch(s -> s.getStatus() == TaskStatus.DONE);

        if (allDone) {
            task.setStatus(TaskStatus.IN_REVIEW);
            task.setCompletedAt(LocalDateTime.now());
        } else {
            task.setStatus(TaskStatus.IN_PROGRESS);
            if (task.getCompletedAt() != null && task.getStatus() != TaskStatus.DONE) {
                task.setCompletedAt(null);
            }
        }

        Task savedTask = taskRepository.save(task);

        boolean statusChanged = originalStatus != savedTask.getStatus();
        boolean completedAtChanged = (originalCompletedAt == null && savedTask.getCompletedAt() != null)
                || (originalCompletedAt != null && !originalCompletedAt.equals(savedTask.getCompletedAt()));

        if (statusChanged || completedAtChanged) {
            taskService.triggerN8nWebhook(savedTask);
        }
    }

    private Subtask getManagerOwnedSubtask(Long subtaskId, String managerEmail) {
        Subtask subtask = subtaskRepository.findById(subtaskId)
                .orElseThrow(() -> new RuntimeException("Subtask not found"));

        if (!managerEmail.equalsIgnoreCase(subtask.getTask().getManagerEmail())) {
            throw new RuntimeException("Subtask not found");
        }

        return subtask;
    }
}
