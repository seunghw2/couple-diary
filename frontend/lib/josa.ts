/**
 * 한국어 조사 헬퍼. 닉네임 등 앞 단어의 받침 유무에 따라 조사를 골라 붙인다.
 * 예) subj('근육남친') → '근육남친이', subj('요정체리') → '요정체리가'
 * 한글이 아닌 끝글자(영문/숫자)는 받침 없음으로 취급(가/는/를).
 */
export function hasBatchim(word: string): boolean {
  const ch = (word ?? '').trim().slice(-1);
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false; // 한글 음절이 아니면 받침 없음 취급
  return (code - 0xac00) % 28 !== 0;
}

/** 받침 여부로 두 조사 중 하나를 붙인다. */
export function josa(word: string, withBatchim: string, withoutBatchim: string): string {
  return `${word}${hasBatchim(word) ? withBatchim : withoutBatchim}`;
}

/** 주격 이/가. */
export const subj = (word: string) => josa(word, '이', '가');
/** 보조사 은/는. */
export const topic = (word: string) => josa(word, '은', '는');
/** 목적격 을/를. */
export const obj = (word: string) => josa(word, '을', '를');
/** 공동격 과/와. */
export const with_ = (word: string) => josa(word, '과', '와');
