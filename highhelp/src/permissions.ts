import { User } from './types';

export enum PermissionLevel {
    BANNED = -2,
    MUTED = -1,
    DEFAULT = 0,
    VERIFIED = 1,
    SUBJECT_ANNOUNCER = 2,
    SUBJECT_MOD = 3,
    GLOBAL_MOD = 4,
    ADMIN = 5
}

export function getUserTags(user: User): string[] {
    if (!user.tags) return [];
    try {
        if (user.tags.startsWith('[') || user.tags.startsWith('{')) {
            const parsed = JSON.parse(user.tags);
            if (Array.isArray(parsed)) {
                return parsed.map(t => String(t).toLowerCase());
            } else if (typeof parsed === 'object' && parsed !== null) {
                return Object.entries(parsed as Record<string, number>)
                    .filter(([_, val]) => val >= 1)
                    .map(([key, _]) => key.toLowerCase());
            }
        }
    } catch (e) {
    }
    return user.tags.split(',').map(t => t.trim().toLowerCase());
}

export function hasSubjectTag(user: User, subject: string): boolean {
    if (!subject) return false;
    const tags = getUserTags(user);
    const subjectPrefix = subject.substring(0, 4).toLowerCase(); // checking first 4 letters for anyone else coding, so we can use math for both math ext and adv as well as math + tag
    return tags.some(tag => tag.startsWith(subjectPrefix));
}

export function canView(user: User): boolean {
    return Number(user.permission_level) > PermissionLevel.BANNED;
}

export function canPostGeneral(user: User): boolean {
    return Number(user.permission_level) > PermissionLevel.MUTED;
}

export function canUploadResource(user: User): boolean {
    if (Number(user.permission_level) <= PermissionLevel.DEFAULT) return false;
    return true;
}

export function canPostAnnouncement(user: User, subject: string): boolean {
    const level = Number(user.permission_level);
    if (level >= PermissionLevel.GLOBAL_MOD) return true;
    if (level < PermissionLevel.SUBJECT_ANNOUNCER) return false;
    return hasSubjectTag(user, subject);
}

export function canUploadPastPaper(user: User, subject: string): boolean {
    const level = Number(user.permission_level);
    if (level >= PermissionLevel.GLOBAL_MOD) return true;


    const tags = getUserTags(user);
    if (tags.includes('c*')) return true;
    const hasCTag = tags.includes('c');

    if (hasCTag) {
        return hasSubjectTag(user, subject);
    }

    if (level < PermissionLevel.SUBJECT_MOD) return false;

    return hasSubjectTag(user, subject);
}

export function canModerateSubject(user: User, subject: string): boolean {
    // edit/delete resources, announcements, past papers
    const level = Number(user.permission_level);
    if (level >= PermissionLevel.GLOBAL_MOD) return true;
    if (level < PermissionLevel.SUBJECT_MOD) return false;
    return hasSubjectTag(user, subject);
}

export function canCommentModeration(user: User): boolean {
    return Number(user.permission_level) >= PermissionLevel.GLOBAL_MOD;
}

export function canCreateTopic(user: User, subject: string): boolean {    
    if (Number(user.permission_level) >= PermissionLevel.GLOBAL_MOD) return true;

    const tags = getUserTags(user);
//contributors
    if (tags.includes('c') && hasSubjectTag(user, subject)) return true;
    if (tags.includes('c*')) return true;

    return false;
}

export function canViewDeleted(user: User): boolean {
    return Number(user.permission_level) >= PermissionLevel.ADMIN;
}
