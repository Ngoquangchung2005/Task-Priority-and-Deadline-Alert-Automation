package com.task.automation.entity;

import com.task.automation.enums.TaskPriority;
import com.task.automation.enums.TaskStatus;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.ToString;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(
    name = "tasks",
    indexes = {
        @Index(name = "idx_tasks_manager_email", columnList = "manager_email"),
        @Index(name = "idx_tasks_assignee_email", columnList = "assignee_email"),
        @Index(name = "idx_tasks_status", columnList = "status"),
        @Index(name = "idx_tasks_deadline", columnList = "deadline")
    }
)
@Data
public class Task {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String taskId;

    private String taskName;

    @Column(columnDefinition = "TEXT")
    private String taskDescription;

    private String ownerName;
    private String assigneeEmail;
    private String managerEmail;

    @Enumerated(EnumType.STRING)
    private TaskPriority priority;

    @Enumerated(EnumType.STRING)
    private TaskStatus status;

    private LocalDateTime deadline;

    @Transient
    private Integer daysLeft;

    private LocalDateTime lastRemindedAt;
    private Integer reminderCount = 0;
    private LocalDateTime escalatedAt;
    private LocalDateTime completedAt;
    private Boolean archived = false;
    private LocalDateTime archivedAt;

    private String sourceInput;
    private String createdBy;
    private String adminNote;

    private Integer totalSubTask = 0;

    @JsonIgnore
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @OneToMany(mappedBy = "task", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("positionIndex ASC")
    private List<Subtask> subtasks = new ArrayList<>();

    @CreationTimestamp
    private LocalDateTime createdAt;

    public Integer getDaysLeft() {
        if (deadline == null) return null;
        return (int) ChronoUnit.DAYS.between(LocalDateTime.now(), deadline);
    }
}
