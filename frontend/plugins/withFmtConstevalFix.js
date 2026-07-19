/**
 * fmt-consteval-fix
 *
 * 새 Xcode/Clang(예: Xcode 26)에서 Expo SDK54가 쓰는 `fmt` 라이브러리가
 * `basic_format_string`의 consteval 생성자를 컴파일하지 못해
 * "call to consteval function ... is not a constant expression" 에러로 빌드가 실패한다.
 *
 * Podfile의 post_install에 훅을 주입해, pod 다운로드 후 `fmt` 헤더의
 * `#define FMT_CONSTEVAL consteval` 을 무력화(빈 매크로)한다.
 * → 포맷 문자열의 컴파일타임 검사만 꺼질 뿐, 런타임 동작은 동일.
 *
 * (EAS 클라우드는 검증된 구버전 Xcode를 써서 이 훅이 no-op이어도 무해하다.)
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = 'fmt-consteval-fix';

const SNIPPET = `
    # ${MARKER}: neutralize fmt consteval so it compiles on newer Xcode/Clang
    fmt_root = File.join(installer.sandbox.root, 'fmt')
    if Dir.exist?(fmt_root)
      Dir.glob(File.join(fmt_root, '**', '*.h')).each do |header|
        text = File.read(header)
        patched = text.gsub('define FMT_CONSTEVAL consteval', 'define FMT_CONSTEVAL')
        File.write(header, patched) if patched != text
      end
    end
`;

module.exports = function withFmtConstevalFix(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfile, 'utf8');
      const anchor = 'post_install do |installer|';
      if (contents.includes(anchor) && !contents.includes(MARKER)) {
        contents = contents.replace(anchor, anchor + SNIPPET);
        fs.writeFileSync(podfile, contents);
      }
      return cfg;
    },
  ]);
};
