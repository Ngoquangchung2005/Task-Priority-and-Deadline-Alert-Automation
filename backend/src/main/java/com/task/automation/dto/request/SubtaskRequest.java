package com.task.automation.dto.request;

import com.task.automation.enums.TaskPriority;
import lombok.Data;

import jakarta.validation.constraints.NotBlank;
import java.time.LocalDateTime;

@Data
public class SubtaskRequest {
    @NotBlank
    private String title;

    private TaskPriority priority;

    private LocalDateTime deadline;

    private String assignedTo;
}
