import { LegalDoc } from '../../components/LegalDoc';
import { PRIVACY_SECTIONS, PRIVACY_SUBTITLE } from '../../lib/legal';

/** 개인정보 처리방침 (앱스토어 필수). 본문은 lib/legal.ts. */
export default function PrivacyScreen() {
  return (
    <LegalDoc title="개인정보 처리방침" subtitle={PRIVACY_SUBTITLE} sections={PRIVACY_SECTIONS} />
  );
}
