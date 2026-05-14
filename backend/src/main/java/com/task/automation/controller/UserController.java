package com.task.automation.controller;

import com.task.automation.dto.response.UserResponse;
import com.task.automation.entity.User;
import com.task.automation.repository.UserRepository;
import com.task.automation.security.UserDetailsImpl;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Comparator;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;

    @GetMapping
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<List<UserResponse>> getUsers() {
        List<UserResponse> users = userRepository.findAll().stream()
                .sorted(Comparator.comparing(User::getEmail, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)))
                .map(UserResponse::from)
                .toList();
        return ResponseEntity.ok(users);
    }

    @PatchMapping("/{id}/active")
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<UserResponse> updateActiveState(@PathVariable("id") Long id, @RequestBody Map<String, Boolean> body) {
        Boolean active = body == null ? null : (body.containsKey("active") ? body.get("active") : body.get("isActive"));
        if (active == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "active is required");
        }

        UserDetailsImpl currentUser = (UserDetailsImpl) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (currentUser.getId().equals(id) && !active) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cannot deactivate your own account");
        }

        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        user.setIsActive(active);
        return ResponseEntity.ok(UserResponse.from(userRepository.save(user)));
    }

    @PatchMapping("/{id}/reset-password")
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<UserResponse> requirePasswordChange(@PathVariable("id") Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        user.setMustChangePassword(true);
        return ResponseEntity.ok(UserResponse.from(userRepository.save(user)));
    }
}
