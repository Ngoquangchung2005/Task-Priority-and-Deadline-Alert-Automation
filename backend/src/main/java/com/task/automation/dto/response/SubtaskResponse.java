package com.task.automation.dto.response;

import com.task.automation.entity.Subtask;
import com.task.automation.entity.Task;
import com.task.automation.enums.TaskPriority;
import com.task.automation.enums.TaskStatus;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class SubtaskResponse {
    private Long id;
    private String title;
    private TaskStatus status;
    private TaskPriority priority;
    private LocalDateTime deadline;
    private String assignedTo;
    private String createdBy;
    private Integer positionIndex;
    private LocalDateTime createdAt;
    private Boolean overdue;
    private Long taskId;
    private String parentTaskCode;
    private String parentTaskName;
    private String parentTaskDescription;
    private TaskStatus parentStatus;
    private Boolean parentArchived;
    private LocalDateTime parentDeadline;

    public static SubtaskResponse from(Subtask subtask) {
        Task task = subtask.getTask();
        return SubtaskResponse.builder()
                .id(subtask.getId())
                .title(subtask.getTitle())
                .status(subtask.getStatus())
                .priority(subtask.getPriority())
                .deadline(subtask.getDeadline())
                .assignedTo(subtask.getAssignedTo())
                .createdBy(subtask.getCreatedBy())
                .positionIndex(subtask.getPositionIndex())
                .createdAt(subtask.getCreatedAt())
                .overdue(subtask.getIsOverdue())
                .taskId(task != null ? task.getId() : null)
                .parentTaskCode(task != null ? task.getTaskId() : null)
                .parentTaskName(task != null ? task.getTaskName() : null)
                .parentTaskDescription(task != null ? task.getTaskDescription() : null)
                .parentStatus(task != null ? task.getStatus() : null)
                .parentArchived(task != null ? task.getArchived() : null)
                .parentDeadline(task != null ? task.getDeadline() : null)
                .build();
    }
}
