package com.task.automation.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

public class AuthTokenFilter extends OncePerRequestFilter {
    @Autowired
    private JwtUtils jwtUtils;

    @Autowired
    private UserDetailsServiceImpl userDetailsService;

    private static final Logger logger = LoggerFactory.getLogger(AuthTokenFilter.class);

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        try {
            String jwt = parseJwt(request);
            if (jwt != null) {
                boolean isValid = jwtUtils.validateJwtToken(jwt);
                if (isValid) {
                    String email = jwtUtils.getEmailFromJwtToken(jwt);

                    UserDetails userDetails = userDetailsService.loadUserByUsername(email);

                    if (!userDetails.isEnabled()) {
                        reject(response, HttpServletResponse.SC_UNAUTHORIZED, "Account is inactive");
                        return;
                    }

                    if (userDetails instanceof UserDetailsImpl userDetailsImpl
                            && Boolean.TRUE.equals(userDetailsImpl.getMustChangePassword())
                            && !isPasswordChangeAllowedPath(request)) {
                        reject(response, HttpServletResponse.SC_FORBIDDEN, "Password change is required");
                        return;
                    }

                    UsernamePasswordAuthenticationToken authentication =
                            new UsernamePasswordAuthenticationToken(
                                    userDetails,
                                    null,
                                    userDetails.getAuthorities());
                    authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                    SecurityContextHolder.getContext().setAuthentication(authentication);
                }
            }
        } catch (Exception e) {
            logger.error("Cannot set user authentication: {}", e.getMessage());
        }

        filterChain.doFilter(request, response);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getServletPath();
        return "/api/auth/login".equals(path);
    }

    private String parseJwt(HttpServletRequest request) {
        String headerAuth = request.getHeader("Authorization");

        if (StringUtils.hasText(headerAuth) && headerAuth.startsWith("Bearer ")) {
            return headerAuth.substring(7);
        }

        return null;
    }

    private boolean isPasswordChangeAllowedPath(HttpServletRequest request) {
        String path = request.getServletPath();
        String method = request.getMethod();
        return ("POST".equalsIgnoreCase(method) && "/api/auth/change-password".equals(path))
                || ("GET".equalsIgnoreCase(method) && "/api/auth/me".equals(path));
    }

    private void reject(HttpServletResponse response, int status, String message) throws IOException {
        SecurityContextHolder.clearContext();
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write("{\"message\":\"" + message + "\"}");
    }
}
