package com.task.automation.entity;

import com.task.automation.enums.TaskPriority;
import com.task.automation.enums.TaskStatus;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "tasks")
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

    private String sourceInput;
    private String createdBy;
    private String adminNote;

    private Integer totalSubTask = 0;

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
