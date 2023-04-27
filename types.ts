export interface CreateDirectoryWatcher {
	eventName: "createDirectoryWatcher";
	id: number;
	path: string;
	recursive: boolean | undefined;
}
export interface CreateFileWatcher {
	eventName: "createFileWatcher";
	id: number;
	path: string;
}
export interface CloseWatcher {
	eventName: "closeWatcher";
	id: number;
	type: "file" | "dir" | "rDir";
}

export type PluginRequest = CreateDirectoryWatcher | CreateFileWatcher | CloseWatcher;
export interface OnWatchChangeEventData {
    id: number,
    path: string,
    eventType: 'create' | 'update' | 'delete',
}