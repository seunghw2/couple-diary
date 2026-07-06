package com.today.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.today.auth.JwtAuthFilter;
import com.today.common.ErrorCode;
import com.today.common.GlobalExceptionHandler.ErrorResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    @Value("${app.cors.allowed-origins}")
    private List<String> allowedOrigins;

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration cfg = new CorsConfiguration();
        cfg.setAllowedOriginPatterns(allowedOrigins);
        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        cfg.setAllowedHeaders(List.of("*"));
        cfg.setExposedHeaders(List.of("Authorization"));
        cfg.setAllowCredentials(true);
        cfg.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cfg);
        return source;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        ObjectMapper mapper = new ObjectMapper();

        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(c -> c.configurationSource(corsConfigurationSource()))
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(
                                "/api/auth/**",
                                "/api/health",
                                "/actuator/**",
                                // 관리자 배치 생성: JWT 대신 X-Admin-Token 헤더로 컨트롤러에서 직접 인증
                                "/api/admin/**"
                        ).permitAll()
                        // 업로드 사진 정적 서빙: UUID 파일명 난독화로 MVP에서는 공개 GET 허용
                        .requestMatchers(HttpMethod.GET, "/files/**").permitAll()
                        // 온디맨드 썸네일도 원본 서빙과 동일하게 공개 GET 허용 (<Image>가 토큰 없이 로드)
                        .requestMatchers(HttpMethod.GET, "/api/photos/thumb").permitAll()
                        .anyRequest().authenticated())
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((req, res, e) -> {
                            res.setStatus(ErrorCode.UNAUTHORIZED.getStatus().value());
                            res.setContentType(MediaType.APPLICATION_JSON_VALUE);
                            res.getWriter().write(mapper.writeValueAsString(new ErrorResponse(
                                    ErrorCode.UNAUTHORIZED.getCode(),
                                    ErrorCode.UNAUTHORIZED.getMessage(),
                                    null)));
                        })
                        .accessDeniedHandler((req, res, e) -> {
                            res.setStatus(ErrorCode.FORBIDDEN.getStatus().value());
                            res.setContentType(MediaType.APPLICATION_JSON_VALUE);
                            res.getWriter().write(mapper.writeValueAsString(new ErrorResponse(
                                    ErrorCode.FORBIDDEN.getCode(),
                                    ErrorCode.FORBIDDEN.getMessage(),
                                    null)));
                        }))
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
