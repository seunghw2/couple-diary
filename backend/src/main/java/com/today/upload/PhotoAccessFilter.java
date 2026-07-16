package com.today.upload;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * 정적 사진 서빙(/files/**)에 시간제한 서명(exp/sig)을 강제한다.
 * 유효 서명이 없으면 403 — 링크만으로 무인증 접근되던 것을 차단.
 */
@Component
@RequiredArgsConstructor
public class PhotoAccessFilter extends OncePerRequestFilter {

    private final PhotoUrlSigner signer;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/files/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String filename = req.getRequestURI().substring("/files/".length());
        if (!signer.verify(filename, req.getParameter("exp"), req.getParameter("sig"))) {
            res.setStatus(HttpServletResponse.SC_FORBIDDEN);
            res.setContentType("application/json");
            res.setCharacterEncoding("UTF-8");
            res.getWriter().write("{\"code\":\"C003\",\"message\":\"만료되었거나 잘못된 사진 링크예요.\"}");
            return;
        }
        chain.doFilter(req, res);
    }
}
