package com.today.upload;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Collection;
import java.util.stream.Stream;

/**
 * 업로드된 사진 파일(원본 + 캐시 썸네일)을 디스크에서 삭제한다.
 * 일기/사진 삭제 시 DB 행만 지우고 파일이 남아 쌓이던 "고아 파일" 문제를 막기 위한 것.
 * 삭제 실패는 무시한다(정리 목적이라 트랜잭션을 깨지 않는다).
 */
@Component
public class PhotoFileStore {

    private final Path uploadDir;
    private final Path thumbDir;

    public PhotoFileStore(@Value("${app.upload.dir}") String uploadDir) {
        this.uploadDir = Paths.get(uploadDir).toAbsolutePath().normalize();
        this.thumbDir = this.uploadDir.resolve("thumbs").normalize();
    }

    /** bare url("/files/abc.jpg") 목록의 원본 + 관련 캐시 썸네일을 삭제. */
    public void deleteByUrls(Collection<String> bareUrls) {
        if (bareUrls == null) return;
        for (String url : bareUrls) {
            if (url == null || url.isBlank()) continue;
            String name = url.startsWith("/files/") ? url.substring("/files/".length()) : url;
            int qi = name.indexOf('?');
            if (qi >= 0) name = name.substring(0, qi); // 서명 쿼리 제거
            if (name.isBlank() || name.contains("/") || name.contains("..")) continue; // 경로 이탈 방어

            Path original = uploadDir.resolve(name).normalize();
            if (original.startsWith(uploadDir)) {
                try { Files.deleteIfExists(original); } catch (IOException ignored) { /* 무시 */ }
            }

            // 캐시 썸네일: {base}_{width}.jpg
            String base = name.contains(".") ? name.substring(0, name.lastIndexOf('.')) : name;
            if (Files.isDirectory(thumbDir)) {
                try (Stream<Path> s = Files.list(thumbDir)) {
                    s.filter(p -> p.getFileName().toString().startsWith(base + "_"))
                            .forEach(p -> { try { Files.deleteIfExists(p); } catch (IOException ignored) { /* 무시 */ } });
                } catch (IOException ignored) { /* 무시 */ }
            }
        }
    }
}
