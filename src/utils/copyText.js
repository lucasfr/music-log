// Copy text to the clipboard on the web, or open the system share sheet on a phone, which has Copy
// among its choices. The project has no clipboard library, and this needs none.
import { Platform, Share } from 'react-native';

export const copiesDirectly = Platform.OS === 'web';

// -> 'copied' | 'shared' | 'cancelled' | 'failed'
export async function copyText(text) {
  try {
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return 'copied';
      }
      return 'failed';
    }
    const result = await Share.share({ message: text });
    return result && result.action === Share.dismissedAction ? 'cancelled' : 'shared';
  } catch {
    return 'failed';
  }
}
