package com.today.upload;

import com.today.common.ApiException;
import com.today.common.ErrorCode;
import net.coobird.thumbnailator.Thumbnails;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Duration;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/photos")
public class PhotoUploadController {

    private static final long MAX_SIZE_BYTES = 10L * 1024 * 1024; // 10MB

    private static final int DEFAULT_THUMB_WIDTH = 300;
    private static final int MIN_THUMB_WIDTH = 40;
    private static final int MAX_THUMB_WIDTH = 1200;
    private static final long CACHE_MAX_AGE_SECONDS = 31536000L; // 1년

    private final Path uploadDir;
    private final Path thumbDir;

    public PhotoUploadController(@Value("${app.upload.dir}") String uploadDir) {
        this.uploadDir = Paths.get(uploadDir).toAbsolutePath().normalize();
        this.thumbDir = this.uploadDir.resolve("thumbs").normalize();
        try {
            Files.createDirectories(this.uploadDir);
            Files.createDirectories(this.thumbDir);
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

    /**
     * 온디맨드 썸네일: 업로드된 원본을 지정 너비로 리사이즈한 JPEG를 반환한다.
     * 그리드/리스트에서 원본 대신 작은 이미지를 로드하기 위한 용도.
     * 예: GET /api/photos/thumb?path=/files/abc.jpg&w=300 -> image/jpeg
     */
    @GetMapping("/thumb")
    public ResponseEntity<Resource> thumb(
            @RequestParam("path") String path,
            @RequestParam(value = "w", required = false) Integer w) {

        int width = clampWidth(w);

        // path -> 실제 파일명 추출 (/files/abc.jpg 또는 abc.jpg 모두 허용)
        String filename = extractFilename(path);
        if (filename.isEmpty()) {
            throw new ApiException(ErrorCode.INVALID_INPUT);
        }

        // path traversal 방어: 정규화 후 uploadDir 밖으로 나가면 거부
        Path source = uploadDir.resolve(filename).normalize();
        if (!source.startsWith(uploadDir) || source.startsWith(thumbDir)) {
            throw new ApiException(ErrorCode.INVALID_INPUT);
        }
        if (!Files.isRegularFile(source)) {
            throw new ApiException(ErrorCode.NOT_FOUND);
        }

        String base = filename.contains(".")
                ? filename.substring(0, filename.lastIndexOf('.'))
                : filename;
        Path cached = thumbDir.resolve(base + "_" + width + ".jpg").normalize();
        if (!cached.startsWith(thumbDir)) {
            throw new ApiException(ErrorCode.INVALID_INPUT);
        }

        try {
            // 캐시된 썸네일이 원본보다 최신이면 그대로 서빙
            boolean cacheValid = Files.isRegularFile(cached)
                    && Files.getLastModifiedTime(cached).toMillis()
                            >= Files.getLastModifiedTime(source).toMillis();

            if (!cacheValid) {
                // 원본이 실제로 디코드 가능한 이미지인지 확인 (깨진/비이미지 파일 방어)
                BufferedImage img = ImageIO.read(source.toFile());
                if (img == null) {
                    throw new ApiException(ErrorCode.INVALID_INPUT);
                }
                // 원본보다 크게 확대하지 않음
                int targetWidth = Math.min(width, img.getWidth());

                Files.createDirectories(thumbDir);
                Thumbnails.of(img)
                        .width(targetWidth)
                        .keepAspectRatio(true)
                        .outputFormat("jpg")
                        .outputQuality(0.8)
                        .toFile(cached.toFile());
            }
        } catch (IOException e) {
            // 디코드/인코드 실패 = 이미지가 아니거나 손상됨
            throw new ApiException(ErrorCode.INVALID_INPUT);
        }

        FileSystemResource resource = new FileSystemResource(cached);
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_JPEG)
                .cacheControl(CacheControl.maxAge(Duration.ofSeconds(CACHE_MAX_AGE_SECONDS))
                        .cachePublic()
                        .immutable())
                .body(resource);
    }

    private int clampWidth(Integer w) {
        int width = (w == null) ? DEFAULT_THUMB_WIDTH : w;
        if (width < MIN_THUMB_WIDTH) return MIN_THUMB_WIDTH;
        if (width > MAX_THUMB_WIDTH) return MAX_THUMB_WIDTH;
        return width;
    }

    /**
     * 저장된 url("/files/abc.jpg") 또는 파일명("abc.jpg")에서 순수 파일명만 추출.
     * 경로 구분자/상위경로(..)/절대경로는 traversal 위험이라 거부한다.
     */
    private String extractFilename(String path) {
        if (path == null) return "";
        String p = path.trim();
        if (p.isEmpty()) return "";
        // "/files/" 프리픽스 제거
        if (p.startsWith("/files/")) {
            p = p.substring("/files/".length());
        } else if (p.startsWith("files/")) {
            p = p.substring("files/".length());
        }
        // 남은 값에 경로 구분자나 상위경로 표기가 있으면 거부
        if (p.contains("/") || p.contains("\\") || p.contains("..")) {
            return "";
        }
        // 확장자 없는 파일명이라도 정규식으로 안전 문자만 허용
        if (!p.matches("[A-Za-z0-9._-]+")) {
            return "";
        }
        return p;
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
