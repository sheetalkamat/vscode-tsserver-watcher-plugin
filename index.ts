import * as ts from "typescript/lib/tsserverlibrary";
import * as net from "net";
import * as readline from 'readline';
import type { OnWatchChangeEventData, CreateFileWatcher, CreateDirectoryWatcher, CloseWatcher } from "./types";

type CanonicalPath = string & { __CanonicalPath: any; }
interface WatcherCollection<T> {
    idToCallbacks: Map<number, Set<T>>;
    pathToId: Map<CanonicalPath, number>;
}
function getWatcherCollection<T>(): WatcherCollection<T> {
    return { idToCallbacks: new Map(), pathToId: new Map() };
}

function factory({ typescript }: { typescript: typeof ts }): ts.UserWatchFactory {
    let session: ts.server.Session<unknown>;
    const watchedFiles = getWatcherCollection<ts.FileWatcherCallback>();
    const watchedDirectories = getWatcherCollection<ts.DirectoryWatcherCallback>();
    const watchedDirectoriesRecursive = getWatcherCollection<ts.DirectoryWatcherCallback>();
    let socket: net.Socket | undefined;
    const pending = new Map<number, string>();
    let ids = 1;
    return {
        // TODO:: do we want to configure this as watchFactory in vscode instead of using globalPlugin
        // currently this gails because we dont return the ls
        // also we need to make user set WatchFactory in settings to be able to use this
        create: createInfo => {
            if (!createInfo.session) throw new Error("Dont support this plugin without session");
            setSession(createInfo.session);
            return undefined!;
        },
        watchDirectory,
        watchFile,
        onConfigurationChanged,
    };

    function setSession(newSession: ts.server.Session<unknown>) {
        if (session === newSession) return;
        else if (!session) session = newSession;
        else console.error(`vscode-tsserver-watcher-plugin:: Another session in same module?`);
    }

    function onConfigurationChanged(config: any) {
        // console.log(`vscode-tsserver-watcher-plugin:: onConfigurationChanged:: ${JSON.stringify(config)}`);
        socket = net.createConnection(config, () => {
            console.log('tsserver-watcher-plugin:: connected to server!');
        });
        const rl = readline.createInterface({ input: socket });
        rl.on('line', data => {
            onWatchChange(JSON.parse(data));
        })
        socket.on('close', () => {
            console.log('tsserver-watcher-plugin:: disconnected from server');
            socket = undefined;
        });
        pending.forEach((value, id) => {
            pending.delete(id);
            socket!.write(value);
        });
    }

    function watchDirectory(
        path: string,
        callback: ts.DirectoryWatcherCallback,
        recursive?: boolean,
    ): ts.FileWatcher {
        // console.log(`vscode-tsserver-watcher-plugin:: watchDirectory:: path: ${path} ${recursive}`);
        return getOrCreateFileWatcher(
            recursive ? watchedDirectoriesRecursive : watchedDirectories,
            path,
            callback,
            recursive ? "rDir" : "dir",
            recursive,
        );
    }
    function watchFile(
        path: string,
        callback: ts.FileWatcherCallback,
    ) {
        // console.log(`vscode-tsserver-watcher-plugin:: watchFile:: path: ${path}`);
        return getOrCreateFileWatcher(
            watchedFiles,
            path,
            callback,
            "file",
        );
    }

    function getOrCreateFileWatcher<T>(
        { pathToId, idToCallbacks }: WatcherCollection<T>,
        path: string,
        callback: T,
        type: CloseWatcher["type"],
        recursive?: boolean,
    ) {
        const key = session.getCanonicalFileName(path) as CanonicalPath;
        let id = pathToId.get(key);
        if (!id) pathToId.set(key, id = ids++);
        let callbacks = idToCallbacks.get(id);
        if (!callbacks) {
            idToCallbacks.set(id, callbacks = new Set());
            // Add watcher
            const eventName = type === "file" ? "createFileWatcher" : "createDirectoryWatcher";
            // console.log(`vscode-tsserver-watcher-plugin:: Sending ${eventName}:: ${type}:: ${key} ${id}`);
            const request: CreateFileWatcher | CreateDirectoryWatcher = { eventName, path, id, recursive };
            const message = JSON.stringify(request) + "\n";
            if (!socket) pending.set(id, message);
            else socket.write(message)
        }
        callbacks.add(callback);
        return {
            close() {
                const callbacks = idToCallbacks.get(id!);
                if (!callbacks?.delete(callback)) return;
                if (callbacks.size) return;
                idToCallbacks.delete(id!);
                pathToId.delete(key);
                // console.log(`vscode-tsserver-watcher-plugin:: closeWatcher::  ${type}:: ${key} ${id}`);
                if (pending.has(id!)) pending.delete(id!);
                else {
                    const request: CloseWatcher = { eventName: "closeWatcher", id: id!, type };
                    socket!.write(JSON.stringify(request) + "\n");
                }
            }
        }
    }

    function onWatchChange(
        { id, path, eventType }: OnWatchChangeEventData
    ) {
        // console.log(`vscode-tsserver-watcher-plugin:: Invoke:: ${id}:: ${path}:: ${eventType}`);
        onFileWatcherCallback(id, path, eventType);
        onDirectoryWatcherCallback(watchedDirectories, id, path, eventType);
        onDirectoryWatcherCallback(watchedDirectoriesRecursive, id, path, eventType);
    }

    function onFileWatcherCallback(
        id: number,
        eventPath: string,
        eventType: OnWatchChangeEventData["eventType"],
    ) {
        watchedFiles.idToCallbacks.get(id)?.forEach(callback => {
            const eventKind = eventType === "create" ?
                typescript.FileWatcherEventKind.Created :
                eventType === "delete" ?
                    typescript.FileWatcherEventKind.Deleted :
                    typescript.FileWatcherEventKind.Changed;
            // console.log(`vscode-tsserver-watcher-plugin:: watchFile:: Invoke:: ${eventPath}:: Event: ${eventKind}`);
            callback(eventPath, eventKind);
        });
    }

    function onDirectoryWatcherCallback(
        { idToCallbacks }: WatcherCollection<ts.DirectoryWatcherCallback>,
        id: number,
        eventPath: string,
        eventType: OnWatchChangeEventData["eventType"],
    ) {
        if (eventType === "update") return;
        idToCallbacks.get(id)?.forEach(callback => {
            // console.log(`vscode-tsserver-watcher-plugin:: watchDirectory:: Invoke:: ${eventPath}`);
            callback(eventPath);
        });
    }
}
export = factory;