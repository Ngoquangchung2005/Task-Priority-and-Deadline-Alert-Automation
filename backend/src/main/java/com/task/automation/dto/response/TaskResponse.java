package com.task.automation.dto.response;

import com.task.automation.entity.Task;
import com.task.automation.enums.TaskPriority;
import com.task.automation.enums.TaskStatus;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;

@Data
@Builder
public class TaskResponse {
    private Long id;
    private String taskId;
    private String taskName;
    private String taskDescription;
    private String ownerName;
    private String assigneeEmail;
    private String managerEmail;
    private TaskPriority priority;
    private TaskStatus status;
    private LocalDateTime deadline;
    private Integer daysLeft;
    private LocalDateTime lastRemindedAt;
    private Integer reminderCount;
    private LocalDateTime escalatedAt;
    private LocalDateTime completedAt;
    private Boolean archived;
    private LocalDateTime archivedAt;
    private String sourceInput;
    private String createdBy;
    private String adminNote;
    private Integer totalSubTask;
    private LocalDateTime createdAt;
    private List<SubtaskResponse> subtasks;

    public static TaskResponse from(Task task) {
        List<SubtaskResponse> subtaskResponses = task.getSubtasks() == null
                ? List.of()
                : task.getSubtasks().stream()
                        .sorted(Comparator.comparing(
                                subtask -> subtask.getPositionIndex() == null ? Integer.MAX_VALUE : subtask.getPositionIndex()))
                        .map(SubtaskResponse::from)
                        .toList();

        return TaskResponse.builder()
                .id(task.getId())
                .taskId(task.getTaskId())
                .taskName(task.getTaskName())
                .taskDescription(task.getTaskDescription())
                .ownerName(task.getOwnerName())
                .assigneeEmail(task.getAssigneeEmail())
                .managerEmail(task.getManagerEmail())
                .priority(task.getPriority())
                .status(task.getStatus())
                .deadline(task.getDeadline())
                .daysLeft(task.getDaysLeft())
                .lastRemindedAt(task.getLastRemindedAt())
                .reminderCount(task.getReminderCount())
                .escalatedAt(task.getEscalatedAt())
                .completedAt(task.getCompletedAt())
                .archived(task.getArchived())
                .archivedAt(task.getArchivedAt())
                .sourceInput(task.getSourceInput())
                .createdBy(task.getCreatedBy())
                .adminNote(task.getAdminNote())
                .totalSubTask(task.getTotalSubTask())
                .createdAt(task.getCreatedAt())
                .subtasks(subtaskResponses)
                .build();
    }
}
