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

@Entity
@Table(name = "subtasks")
@Data
public class Subtask {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TaskStatus status = TaskStatus.TODO;

    @Enumerated(EnumType.STRING)
    private TaskPriority priority;

    private LocalDateTime deadline;

    private String assignedTo;

    private String createdBy;

    private Integer positionIndex = 0;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_id", nullable = false)
    @JsonIgnore
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Task task;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @Transient
    public Boolean getIsOverdue() {
        if (deadline == null || status == TaskStatus.DONE) return false;
        return LocalDateTime.now().isAfter(deadline);
    }
}
