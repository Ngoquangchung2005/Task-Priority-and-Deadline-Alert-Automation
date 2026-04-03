package com.task.automation.dto.request;

import com.task.automation.enums.ActionType;
import lombok.Data;

@Data
public class WebhookSyncRequest {
    private String taskId;
    private ActionType actionType;
    private String actionMessage;
}
