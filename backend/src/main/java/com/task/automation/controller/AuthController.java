package com.task.automation.controller;

import com.task.automation.dto.request.ChangePasswordRequest;
import com.task.automation.dto.request.LoginRequest;
import com.task.automation.security.UserDetailsImpl;
import com.task.automation.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    
    private final AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<?> authenticateUser(@Valid @RequestBody LoginRequest loginRequest) {
        return ResponseEntity.ok(authService.authenticateUser(loginRequest));
    }

    @PostMapping("/change-password")
    public ResponseEntity<?> changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        return ResponseEntity.ok(authService.changePassword(request));
    }

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser() {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        Map<String, Object> currentUser = new LinkedHashMap<>();
        currentUser.put("id", userDetails.getId());
        currentUser.put("fullName", userDetails.getFullName());
        currentUser.put("email", userDetails.getEmail());
        currentUser.put("role", userDetails.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(authority -> authority.startsWith("ROLE_"))
                .map(authority -> authority.substring("ROLE_".length()))
                .findFirst()
                .orElse(null));
        currentUser.put("mustChangePassword", userDetails.getMustChangePassword());
        currentUser.put("isActive", userDetails.getIsActive());
        return ResponseEntity.ok(currentUser);
    }
}
