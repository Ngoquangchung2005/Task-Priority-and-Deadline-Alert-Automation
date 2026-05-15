package com.task.automation.dto.request;

import com.task.automation.enums.ActionType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class WebhookSyncRequest {
    @NotBlank
    private String taskId;

    private String itemType;

    private Long id;

    private Long subtaskId;

    private String assigneeEmail;

    @NotNull
    private ActionType actionType;

    private String actionMessage;
}
