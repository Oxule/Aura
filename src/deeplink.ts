export const DEEPLINK_PREFIX = "aura://";
//export const DEEPLINK_USER_PREFIX = DEEPLINK_PREFIX+"usr/";
//export const DEEPLINK_CHANNEL_PREFIX = DEEPLINK_PREFIX+"ch/";

export function process_user_deeplink(link:string):string|undefined {
    if(link.startsWith(DEEPLINK_PREFIX)){
        return link.slice(DEEPLINK_PREFIX.length,link.length);
    }
    return undefined;
}