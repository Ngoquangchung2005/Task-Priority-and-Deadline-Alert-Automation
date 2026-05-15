package com.task.automation.dto.response;

import com.task.automation.entity.Subtask;
import com.task.automation.entity.Task;
import com.task.automation.enums.TaskPriority;
import com.task.automation.enums.TaskStatus;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

@Data
@Builder
public class WebhookWorkItemResponse {
    private String itemType;
    private Long id;
    private String taskId;
    private String taskName;
    private String taskDescription;
    private String assigneeEmail;
    private String managerEmail;
    private String ownerName;
    private TaskPriority priority;
    private TaskStatus status;
    private LocalDateTime deadline;
    private Integer daysLeft;
    private Integer reminderCount;
    private LocalDateTime lastRemindedAt;
    private LocalDateTime escalatedAt;
    private LocalDateTime completedAt;
    private LocalDateTime createdAt;
    private String adminNote;
    private String sourceInput;
    private Integer totalSubTask;

    private Long parentTaskInternalId;
    private String parentTaskCode;
    private String parentTaskName;
    private String parentTaskDescription;
    private LocalDateTime parentDeadline;

    private Long subtaskId;
    private String subtaskTitle;
    private String assignedTo;
    private String createdBy;
    private Integer positionIndex;

    public static WebhookWorkItemResponse fromTask(Task task) {
        return WebhookWorkItemResponse.builder()
                .itemType("TASK")
                .id(task.getId())
                .taskId(task.getTaskId())
                .taskName(task.getTaskName())
                .taskDescription(task.getTaskDescription())
                .assigneeEmail(task.getAssigneeEmail())
                .managerEmail(task.getManagerEmail())
                .ownerName(task.getOwnerName())
                .priority(task.getPriority())
                .status(task.getStatus())
                .deadline(task.getDeadline())
                .daysLeft(calculateDaysLeft(task.getDeadline()))
                .reminderCount(task.getReminderCount())
                .lastRemindedAt(task.getLastRemindedAt())
                .escalatedAt(task.getEscalatedAt())
                .completedAt(task.getCompletedAt())
                .createdAt(task.getCreatedAt())
                .adminNote(task.getAdminNote())
                .sourceInput(task.getSourceInput())
                .totalSubTask(task.getTotalSubTask())
                .build();
    }

    public static WebhookWorkItemResponse fromSubtask(Subtask subtask) {
        Task parent = subtask.getTask();
        LocalDateTime deadline = subtask.getDeadline() != null ? subtask.getDeadline() : parent.getDeadline();
        TaskPriority priority = subtask.getPriority() != null ? subtask.getPriority() : parent.getPriority();
        LocalDateTime completedAt = subtask.getStatus() == TaskStatus.DONE ? parent.getCompletedAt() : null;

        return WebhookWorkItemResponse.builder()
                .itemType("SUBTASK")
                .id(subtask.getId())
                .taskId(parent.getTaskId())
                .taskName(subtask.getTitle())
                .taskDescription(parent.getTaskDescription())
                .assigneeEmail(subtask.getAssignedTo())
                .managerEmail(parent.getManagerEmail())
                .ownerName(parent.getOwnerName())
                .priority(priority)
                .status(subtask.getStatus())
                .deadline(deadline)
                .daysLeft(calculateDaysLeft(deadline))
                .reminderCount(parent.getReminderCount())
                .lastRemindedAt(parent.getLastRemindedAt())
                .escalatedAt(parent.getEscalatedAt())
                .completedAt(completedAt)
                .createdAt(subtask.getCreatedAt())
                .adminNote(parent.getAdminNote())
                .sourceInput(parent.getSourceInput())
                .totalSubTask(parent.getTotalSubTask())
                .parentTaskInternalId(parent.getId())
                .parentTaskCode(parent.getTaskId())
                .parentTaskName(parent.getTaskName())
                .parentTaskDescription(parent.getTaskDescription())
                .parentDeadline(parent.getDeadline())
                .subtaskId(subtask.getId())
                .subtaskTitle(subtask.getTitle())
                .assignedTo(subtask.getAssignedTo())
                .createdBy(subtask.getCreatedBy())
                .positionIndex(subtask.getPositionIndex())
                .build();
    }

    private static Integer calculateDaysLeft(LocalDateTime deadline) {
        if (deadline == null) {
            return null;
        }
        return (int) ChronoUnit.DAYS.between(LocalDateTime.now(), deadline);
    }
}
