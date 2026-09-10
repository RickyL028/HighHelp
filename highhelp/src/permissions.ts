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
    return true;
}

export function canUploadPastPaper(user: User, subject: string): boolean {
    const level = Number(user.permission_level);
    if (level >= PermissionLevel.GLOBAL_MOD) return true;
    if (level < PermissionLevel.SUBJECT_MOD) return false;
    return true;
}

export function canModerateSubject(user: User, subject: string): boolean {
    // edit/delete resources, announcements, past papers
    const level = Number(user.permission_level);
    if (level >= PermissionLevel.GLOBAL_MOD) return true;
    if (level < PermissionLevel.SUBJECT_MOD) return false;
    return true;
}

export function canCommentModeration(user: User): boolean {
    return Number(user.permission_level) >= PermissionLevel.GLOBAL_MOD;
}

export function canCreateTopic(user: User, subject: string): boolean {
    return Number(user.permission_level) >= PermissionLevel.GLOBAL_MOD;
}

export function canViewDeleted(user: User): boolean {
    return Number(user.permission_level) >= PermissionLevel.ADMIN;
}
