package com.task.automation.repository;

import com.task.automation.entity.Subtask;
import com.task.automation.enums.TaskStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface SubtaskRepository extends JpaRepository<Subtask, Long> {
    List<Subtask> findByTaskIdOrderByPositionIndexAsc(Long taskId);
    List<Subtask> findByAssignedToIgnoreCaseOrderByDeadlineAscPositionIndexAsc(String assignedTo);
    List<Subtask> findByAssignedToIgnoreCaseOrderByCreatedAtDescPositionIndexAsc(String assignedTo);
    List<Subtask> findByTaskIdAndAssignedToIgnoreCaseOrderByPositionIndexAsc(Long taskId, String assignedTo);
    boolean existsByTaskIdAndAssignedToIgnoreCase(Long taskId, String assignedTo);

    @Query("""
            SELECT s
            FROM Subtask s
            WHERE s.task.id = :taskId
              AND (
                LOWER(s.assignedTo) = LOWER(:email)
                OR LOWER(s.assignedTo) = LOWER(:localPart)
              )
            ORDER BY s.positionIndex ASC
            """)
    List<Subtask> findByTaskIdAndAssignedIdentityOrderByPositionIndexAsc(
            @Param("taskId") Long taskId,
            @Param("email") String email,
            @Param("localPart") String localPart);

    @Query("""
            SELECT s
            FROM Subtask s
            WHERE LOWER(s.assignedTo) = LOWER(:email)
               OR LOWER(s.assignedTo) = LOWER(:localPart)
            ORDER BY s.createdAt DESC, s.positionIndex ASC
            """)
    List<Subtask> findByAssignedIdentityOrderByCreatedAtDescPositionIndexAsc(
            @Param("email") String email,
            @Param("localPart") String localPart);

    @Query("""
            SELECT s
            FROM Subtask s
            JOIN FETCH s.task t
            WHERE s.status IN :statuses
              AND COALESCE(t.archived, false) = false
              AND t.status <> :cancelledStatus
            """)
    List<Subtask> findWebhookSubtasksByStatuses(
            @Param("statuses") List<TaskStatus> statuses,
            @Param("cancelledStatus") TaskStatus cancelledStatus);

    @Query("""
            SELECT s
            FROM Subtask s
            JOIN FETCH s.task t
            WHERE s.status IN :statuses
              AND s.deadline <= CURRENT_TIMESTAMP
              AND COALESCE(t.archived, false) = false
              AND t.status <> :cancelledStatus
            """)
    List<Subtask> findOverdueWebhookSubtasks(
            @Param("statuses") List<TaskStatus> statuses,
            @Param("cancelledStatus") TaskStatus cancelledStatus);

    @Query("""
            SELECT s
            FROM Subtask s
            JOIN FETCH s.task t
            WHERE COALESCE(t.archived, false) = false
              AND t.status <> :cancelledStatus
              AND (
                s.status IN :openStatuses
                OR (s.status = :doneStatus AND t.completedAt IS NOT NULL AND t.completedAt >= :completedFrom)
              )
            """)
    List<Subtask> findWebhookSubtasksForEmployeeStatistics(
            @Param("openStatuses") List<TaskStatus> openStatuses,
            @Param("doneStatus") TaskStatus doneStatus,
            @Param("cancelledStatus") TaskStatus cancelledStatus,
            @Param("completedFrom") LocalDateTime completedFrom);
}
