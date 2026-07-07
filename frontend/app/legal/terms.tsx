import { LegalDoc } from '../../components/LegalDoc';
import { TERMS_SECTIONS, TERMS_SUBTITLE } from '../../lib/legal';

/** 이용약관 (앱스토어 필수). 본문은 lib/legal.ts. */
export default function TermsScreen() {
  return <LegalDoc title="이용약관" subtitle={TERMS_SUBTITLE} sections={TERMS_SECTIONS} />;
}
