package com.today.upload;

import com.today.common.ApiException;
import com.today.common.ErrorCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/photos")
public class PhotoUploadController {

    private static final long MAX_SIZE_BYTES = 10L * 1024 * 1024; // 10MB

    private final Path uploadDir;

    public PhotoUploadController(@Value("${app.upload.dir}") String uploadDir) {
        this.uploadDir = Paths.get(uploadDir).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.uploadDir);
        } catch (IOException e) {
            throw new UncheckedIOException("업로드 디렉토리 생성 실패: " + this.uploadDir, e);
        }
    }

    @PostMapping
    public Map<String, String> upload(@RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ApiException(ErrorCode.INVALID_INPUT);
        }
        String contentType = file.getContentType();
        if (contentType == null || !contentType.toLowerCase(Locale.ROOT).startsWith("image/")) {
            throw new ApiException(ErrorCode.INVALID_INPUT);
        }
        if (file.getSize() > MAX_SIZE_BYTES) {
            throw new ApiException(ErrorCode.INVALID_INPUT);
        }

        String ext = safeExtension(file.getOriginalFilename());
        String filename = UUID.randomUUID() + ext;
        Path target = uploadDir.resolve(filename).normalize();
        if (!target.startsWith(uploadDir)) { // path traversal 방어 (UUID라 사실상 불가하지만 방어적으로)
            throw new ApiException(ErrorCode.INVALID_INPUT);
        }
        try {
            file.transferTo(target);
        } catch (IOException e) {
            throw new UncheckedIOException("파일 저장 실패", e);
        }
        return Map.of("url", "/files/" + filename);
    }

    // 원본 파일명에서 확장자만 안전하게 추출 (영숫자 1~10자만 허용)
    private String safeExtension(String originalName) {
        if (originalName == null) return "";
        int dot = originalName.lastIndexOf('.');
        if (dot < 0 || dot == originalName.length() - 1) return "";
        String ext = originalName.substring(dot + 1);
        if (!ext.matches("[a-zA-Z0-9]{1,10}")) return "";
        return "." + ext.toLowerCase(Locale.ROOT);
    }
}
