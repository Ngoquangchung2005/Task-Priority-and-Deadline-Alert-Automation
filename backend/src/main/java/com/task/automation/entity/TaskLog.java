package com.task.automation.entity;

import com.task.automation.enums.ActionType;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "task_logs")
@Data
public class TaskLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long taskId;

    @Enumerated(EnumType.STRING)
    private ActionType actionType;

    private String actionMessage;

    @CreationTimestamp
    private LocalDateTime createdAt;
}
