// Domain models for Cimoc, mirroring the Android app's data structures.

export type ComicStatus = 'finish' | 'serial';

export interface Comic {
    id: string;
    source: string; // source id
    sourceTitle: string; // display name of the source
    title: string;
    author: string;
    intro: string;
    cover: string; // placeholder color or url
    status: ComicStatus;
    updateTime: string;
    lastChapter: string;
    tags: string[];
    lastReadChapter: number; // index into chapters
    lastReadTime: number;
}

export interface Chapter {
    index: number;
    title: string;
    /** pages for this chapter, each is a placeholder color */
    pages: string[];
    downloaded: boolean;
    read: boolean;
}

export interface Source {
    id: string;
    title: string;
    enabled: boolean;
    favoriteCount: number;
}

export interface HistoryEntry {
    comicId: string;
    readTime: number;
}

export type LibraryTab = 'history' | 'favorite' | 'download' | 'local';

export interface DownloadItem {
    comicId: string;
    chapterIndexes: number[];
    paused: boolean;
    progress: number;
}
